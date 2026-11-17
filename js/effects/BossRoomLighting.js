import { configurarZonasNovoBoss } from "../enemies/novoBoss/NovoBossConfig.js";
import { luzAfetaCamera } from "./FactoryLighting.js";

const CLARIDADE_SALA_BOSS = 0.25;

/** Luz ambiente suave restrita à união dos retângulos de ZonaBoss. */
export default class BossRoomLighting {
  constructor(map) {
    const zonas = this.zonas = configurarZonasNovoBoss(map).arena.zonas ?? [];
    this.canvas = null;
    if (!zonas.length) return;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const zona of zonas) {
      for (const [dx, dy] of [[0, 0], [zona.width, 0], [zona.width, zona.height], [0, zona.height]]) {
        const x = zona.x + dx * zona.cos - dy * zona.sin, y = zona.y + dx * zona.sin + dy * zona.cos;
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
      }
    }
    this.x = Math.floor(left); this.y = Math.floor(top);
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.ceil(right) - this.x;
    this.canvas.height = Math.ceil(bottom) - this.y;
    const c = this.canvas.getContext("2d");
    c.fillStyle = "#FFFFFF";
    for (const zona of zonas) {
      c.setTransform(zona.cos, zona.sin, -zona.sin, zona.cos, zona.x - this.x, zona.y - this.y);
      c.fillRect(0, 0, zona.width, zona.height);
    }
    this.area = { area: true, x: this.x, y: this.y, rotacao: 0,
      largura: this.canvas.width, altura: this.canvas.height };
  }

  contem(luz) {
    const x = luz.area ? luz.x + Math.cos(luz.rotacao) * luz.largura / 2 - Math.sin(luz.rotacao) * luz.altura / 2 : luz.x;
    const y = luz.area ? luz.y + Math.sin(luz.rotacao) * luz.largura / 2 + Math.cos(luz.rotacao) * luz.altura / 2 : luz.y;
    return this.zonas.some(zona => {
      const dx = x - zona.x, dy = y - zona.y;
      const localX = dx * zona.cos + dy * zona.sin, localY = -dx * zona.sin + dy * zona.cos;
      return localX >= 0 && localX <= zona.width && localY >= 0 && localY <= zona.height;
    });
  }

  visivel(camera) {
    return !!this.canvas && luzAfetaCamera(this.area, camera);
  }

  /** Substitui só o exterior da união de ZonaBoss, preservando os pixels originais da sala. */
  preencherExterior(context, camera, width, height, alpha) {
    context.save();
    const m = camera.matrix;
    // Interseção dos exteriores: funciona também com zonas sobrepostas e rotacionadas.
    for (const zona of this.zonas) {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.beginPath();
      context.rect(0, 0, width, height);
      context.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
      context.transform(zona.cos, zona.sin, -zona.sin, zona.cos, zona.x, zona.y);
      context.rect(0, 0, zona.width, zona.height);
      context.clip("evenodd");
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, width, height);
    context.fillStyle = `rgba(0,0,0,${alpha})`;
    context.fillRect(0, 0, width, height);
    context.restore();
  }

  desenhar(context, camera, fator = 1) {
    if (!fator || !this.canvas || !luzAfetaCamera(this.area, camera)) return;
    context.save();
    context.globalAlpha = CLARIDADE_SALA_BOSS * fator;
    context.drawImage(this.canvas, this.x, this.y);
    context.restore();
  }

  destroy() {
    if (this.canvas) this.canvas.width = this.canvas.height = 0;
    this.canvas = null;
  }
}
