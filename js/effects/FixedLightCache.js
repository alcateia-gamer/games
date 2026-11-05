import { MULTIPLICADOR_ALCANCE_FABRICA } from "./FactoryLighting.js";

/** Guarda os três desenhos de cada luz fixa em um único canvas do tamanho da fonte. */
export default class FixedLightCache {
  constructor() {
    this.fontes = new Map();
  }

  adicionar(luz, perfis) {
    const canvas = document.createElement("canvas");
    const tamanho = Math.ceil(luz.raio * MULTIPLICADOR_ALCANCE_FABRICA) * 2;
    canvas.width = tamanho;
    canvas.height = tamanho * perfis.length;
    this.fontes.set(luz, { canvas, context: canvas.getContext("2d"), tamanho,
      perfis: new Map(perfis.map((perfil, indice) => [perfil, { indice, valido: false }])) });
  }

  desenhar(context, perfil, fonte, estatuas, oclusao) {
    const { luz, angulo } = fonte;
    const cache = this.fontes.get(luz), estado = cache?.perfis.get(perfil);
    if (!estado) return false;
    const tamanho = Math.ceil(luz.raio * MULTIPLICADOR_ALCANCE_FABRICA) * 2;
    if (cache.tamanho !== tamanho) {
      cache.tamanho = cache.canvas.width = tamanho;
      cache.canvas.height = tamanho * cache.perfis.size;
      for (const item of cache.perfis.values()) item.valido = false;
    }
    const revisaoOclusao = luz.direcao === "Cima" ? oclusao?.revisao ?? 0 : 0;
    const y = estado.indice * tamanho, centro = tamanho / 2;
    if (!estado.valido || estado.x !== luz.x || estado.y !== luz.y || estado.angulo !== angulo ||
        estado.raio !== luz.raio || estado.estatuas !== estatuas.revisao || estado.oclusao !== revisaoOclusao) {
      const c = cache.context, raio = luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
      c.clearRect(0, y, tamanho, tamanho);
      c.beginPath();
      c.rect(0, y, tamanho, tamanho);
      c.clip();
      c.setTransform(1, 0, 0, 1, centro - luz.x, y + centro - luz.y);
      if (!oclusao?.desenhar(c, perfil, fonte, estatuas) && !estatuas.desenhar(c, perfil, fonte)) {
        const cos = Math.cos(angulo), sin = Math.sin(angulo);
        c.transform(cos, sin, -sin, cos, luz.x, luz.y);
        c.imageSmoothingEnabled = true;
        c.drawImage(perfil, -raio, -raio, raio * 2, raio * 2);
      }
      c.restore();
      Object.assign(estado, { valido: true, x: luz.x, y: luz.y, angulo, raio: luz.raio,
        estatuas: estatuas.revisao, oclusao: revisaoOclusao });
    }
    context.drawImage(cache.canvas, 0, y, tamanho, tamanho,
      luz.x - centro, luz.y - centro, tamanho, tamanho);
    return true;
  }

  destroy() {
    for (const { canvas } of this.fontes.values()) canvas.width = canvas.height = 0;
    this.fontes.clear();
  }
}
