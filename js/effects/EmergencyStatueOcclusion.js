import { MULTIPLICADOR_ALCANCE_FABRICA } from "./FactoryLighting.js";
import { ocultarBrilhoAtrasSprite } from "./SpriteLightOcclusion.js";

const CAMPOS = ["x", "y", "scaleX", "scaleY", "rotation", "flipX", "flipY",
  "displayOriginX", "displayOriginY", "alpha", "visible", "active", "frame"];

/** Oculta apenas a contribuição do giroflex atrás dos pixels das estátuas. */
export default class EmergencyStatueOcclusion {
  constructor(scene, luzes) {
    this.estatuas = (scene.objetosMapaParte2 ?? [])
      .filter(objeto => objeto.getData?.("objectLayerName") === "EstátuaRobos");
    this.anteriores = new WeakMap();
    this.revisao = 0;
    this.canvas = null;
    if (!this.estatuas.length || !luzes.length) return;
    const raio = Math.max(...luzes.map(luz => luz.raio * MULTIPLICADOR_ALCANCE_FABRICA));
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = Math.ceil(raio) * 2;
    this.context = this.canvas.getContext("2d");
  }

  atualizar() {
    let alterada = false;
    for (const estatua of this.estatuas) {
      let anterior = this.anteriores.get(estatua);
      if (!anterior) {
        anterior = {};
        this.anteriores.set(estatua, anterior);
        alterada = true;
      }
      for (const campo of CAMPOS) {
        if (anterior[campo] !== estatua[campo]) {
          anterior[campo] = estatua[campo];
          alterada = true;
        }
      }
    }
    if (alterada) this.revisao++;
    return alterada;
  }

  desenhar(context, perfil, { luz, angulo }) {
    if (!this.canvas) return false;
    const c = this.context;
    const tamanho = this.canvas.width, centro = tamanho / 2;
    const raio = luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
    const cos = Math.cos(angulo), sin = Math.sin(angulo);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, tamanho, tamanho);
    c.setTransform(cos, sin, -sin, cos, centro, centro);
    c.imageSmoothingEnabled = true;
    c.drawImage(perfil, -raio, -raio, raio * 2, raio * 2);
    c.setTransform(1, 0, 0, 1, centro - luz.x, centro - luz.y);
    this.recortar(c, luz, raio);
    context.drawImage(this.canvas, luz.x - centro, luz.y - centro, tamanho, tamanho);
    return true;
  }

  /** A silhueta é estática enquanto a luz gira; também atende ao cache do giroflex. */
  recortar(context, luz, raio) {
    for (const estatua of this.estatuas) {
      const frame = estatua.frame;
      if (estatua.active === false || estatua.visible === false || estatua.alpha === 0 || !frame?.source?.image) continue;
      const w = frame.realWidth ?? estatua.width ?? frame.cutWidth;
      const h = frame.realHeight ?? estatua.height ?? frame.cutHeight;
      const ox = estatua.displayOriginX ?? w / 2, oy = estatua.displayOriginY ?? h / 2;
      // Limite conservador inclui escala, rotação, espelhamento e origem fora do sprite.
      const alcance = Math.hypot(Math.max(Math.abs(ox), Math.abs(w - ox)) * Math.abs(estatua.scaleX ?? 1),
        Math.max(Math.abs(oy), Math.abs(h - oy)) * Math.abs(estatua.scaleY ?? 1));
      if (Math.abs(estatua.x - luz.x) > raio + alcance || Math.abs(estatua.y - luz.y) > raio + alcance) continue;
      ocultarBrilhoAtrasSprite(context, estatua);
    }
  }

  destroy() {
    if (this.canvas) this.canvas.width = this.canvas.height = 0;
    this.canvas = this.context = null;
    this.estatuas.length = 0;
    this.anteriores = new WeakMap();
  }
}
