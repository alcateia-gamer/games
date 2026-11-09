import { MULTIPLICADOR_ALCANCE_FABRICA } from "./FactoryLighting.js";

/** Carimbos vermelhos: o alpha clareia a máscara e a mesma imagem fornece a cor do feixe. */
export default class GiroflexLightCache {
  constructor(paredes, estatuas, resolucao = 512) {
    this.paredes = paredes;
    this.estatuas = estatuas;
    this.resolucao = resolucao;
    this.carimbos = new Map();
    this.visiveis = new Set();
  }

  sincronizar(fontes) {
    this.visiveis.clear();
    for (const { luz } of fontes) if (!luz.neon) this.visiveis.add(luz);
    for (const [luz, carimbo] of this.carimbos) {
      if (this.visiveis.has(luz)) continue;
      this.liberar(carimbo);
      this.carimbos.delete(luz);
    }
  }

  obter({ luz, angulo }, perfil) {
    let carimbo = this.carimbos.get(luz);
    const raio = luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
    const tamanho = Math.min(this.resolucao, Math.ceil(raio * 2));
    if (!carimbo) {
      carimbo = { recorte: document.createElement("canvas"), mascara: document.createElement("canvas"),
        angulo: null };
      this.carimbos.set(luz, carimbo);
    }
    const mudou = carimbo.x !== luz.x || carimbo.y !== luz.y || carimbo.raio !== raio ||
      carimbo.parede !== luz.parede || carimbo.revisaoParedes !== this.paredes.revisao ||
      carimbo.revisaoEstatuas !== this.estatuas.revisao;
    if (!mudou && carimbo.angulo === angulo && carimbo.perfil === perfil) return carimbo;
    const escala = tamanho / (raio * 2), centro = tamanho / 2;
    if (mudou) {
      for (const canvas of [carimbo.recorte, carimbo.mascara]) {
        if (canvas.width !== tamanho || canvas.height !== tamanho) canvas.width = canvas.height = tamanho;
      }
      const c = carimbo.recorte.getContext("2d");
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, tamanho, tamanho);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
      c.setTransform(escala, 0, 0, escala, centro - luz.x * escala, centro - luz.y * escala);
      c.save();
      if (luz.parede) {
        c.beginPath();
        c.rect(luz.parede === "direita" ? luz.x - raio : luz.x, luz.y - raio, raio, raio * 2);
        c.clip();
      }
      this.paredes.recortarFonte(c, luz, raio);
      c.fillStyle = "#FFFFFF";
      c.fillRect(luz.x - raio, luz.y - raio, raio * 2, raio * 2);
      c.restore();
      this.estatuas.recortar(c, luz, raio);
      carimbo.x = luz.x; carimbo.y = luz.y; carimbo.raio = raio; carimbo.parede = luz.parede;
      carimbo.revisaoParedes = this.paredes.revisao;
      carimbo.revisaoEstatuas = this.estatuas.revisao;
    }
    const c = carimbo.mascara.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, tamanho, tamanho);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    const cos = Math.cos(angulo) * escala, sin = Math.sin(angulo) * escala;
    c.setTransform(cos, sin, -sin, cos, centro, centro);
    c.imageSmoothingEnabled = true;
    c.drawImage(perfil, -raio, -raio, raio * 2, raio * 2);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "destination-in";
    c.drawImage(carimbo.recorte, 0, 0);
    carimbo.angulo = angulo;
    carimbo.perfil = perfil;
    return carimbo;
  }

  desenhar(context, fonte, perfil) {
    const carimbo = this.obter(fonte, perfil);
    const raio = carimbo.raio;
    context.drawImage(carimbo.mascara,
      fonte.luz.x - raio, fonte.luz.y - raio, raio * 2, raio * 2);
  }

  liberar(carimbo) {
    carimbo.recorte.width = carimbo.recorte.height = carimbo.mascara.width = carimbo.mascara.height = 0;
  }

  destroy() {
    for (const carimbo of this.carimbos.values()) this.liberar(carimbo);
    this.carimbos.clear();
    this.visiveis.clear();
    this.paredes = this.estatuas = null;
  }
}
