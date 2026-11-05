import { configurarZonasNovoBoss } from "../enemies/novoBoss/NovoBossConfig.js";
import { luzAfetaCamera } from "./FactoryLighting.js";

const CLARIDADE_SALA_BOSS = 0.25;

/** Luz ambiente suave restrita à união dos retângulos de ZonaBoss. */
export default class BossRoomLighting {
  constructor(map) {
    const zonas = configurarZonasNovoBoss(map).arena.zonas ?? [];
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

  desenhar(context, camera) {
    if (!this.canvas || !luzAfetaCamera(this.area, camera)) return;
    context.save();
    context.globalAlpha = CLARIDADE_SALA_BOSS;
    context.drawImage(this.canvas, this.x, this.y);
    context.restore();
  }

  destroy() {
    if (this.canvas) this.canvas.width = this.canvas.height = 0;
    this.canvas = null;
  }
}
