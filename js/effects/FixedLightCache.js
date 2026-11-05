import { luzAfetaCamera, MULTIPLICADOR_ALCANCE_FABRICA } from "./FactoryLighting.js";

// Evita um canvas gigante se pontos de luz forem espalhados por mapas futuros.
const MAX_PIXELS = 4 * 1024 * 1024;

/** Compõe neons e arandelas uma vez no mundo, reutilizando duas imagens durante a luta. */
export default class FixedLightCache {
  constructor(pintar) {
    this.pintar = pintar;
    this.fontes = [];
    this.canvasMascara = document.createElement("canvas");
    this.canvasCor = document.createElement("canvas");
    this.contextMascara = this.canvasMascara.getContext("2d");
    this.contextCor = this.canvasCor.getContext("2d");
    this.revisao = 0;
    this.sujo = true;
    this.areaSuja = true;
    this.versoes = [];
  }

  adicionar(luz, perfis) {
    this.fontes.push({ luz, perfis, intensidade: -1, angulo: null });
    this.areaSuja = this.sujo = true;
  }

  atualizar(agora, zonas, paredes, estatuas, oclusao) {
    let mudou = false;
    const versoes = [paredes.revisao, estatuas.revisao, oclusao.revisao];
    for (let i = 0; i < versoes.length; i++) {
      if (this.versoes[i] !== versoes[i]) { this.versoes[i] = versoes[i]; mudou = true; }
    }
    for (const fonte of this.fontes) {
      const luz = fonte.luz;
      const intensidade = luz.ligada ? luz.intensidade * (luz.cor?.alpha ?? 1) * zonas.fatorLuz(luz, agora) : 0;
      const angulo = luz.neon ? luz.fase : luz.angulo;
      if (fonte.x !== luz.x || fonte.y !== luz.y || fonte.raio !== luz.raio) {
        fonte.x = luz.x; fonte.y = luz.y; fonte.raio = luz.raio;
        this.areaSuja = mudou = true;
      }
      if (fonte.intensidade !== intensidade || fonte.angulo !== angulo) mudou = true;
      fonte.intensidade = intensidade;
      fonte.angulo = angulo;
    }
    if (mudou) { this.sujo = true; this.revisao++; }
  }

  atualizarArea() {
    this.areaSuja = false;
    if (!this.fontes.length) { this.area = null; return; }
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const { luz } of this.fontes) {
      const raio = luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
      left = Math.min(left, luz.x - raio); top = Math.min(top, luz.y - raio);
      right = Math.max(right, luz.x + raio); bottom = Math.max(bottom, luz.y + raio);
    }
    const x = Math.floor(left), y = Math.floor(top);
    const largura = Math.ceil(right) - x, altura = Math.ceil(bottom) - y;
    this.area = { area: true, x, y, largura, altura, rotacao: 0 };
    this.individual = largura > 4096 || altura > 4096 || largura * altura > MAX_PIXELS;
    if (!this.individual) {
      this.canvasMascara.width = this.canvasCor.width = largura;
      this.canvasMascara.height = this.canvasCor.height = altura;
    }
  }

  pintarFontes(context, cor, camera = null) {
    for (const fonte of this.fontes) {
      if (fonte.intensidade <= 0 || (camera && !luzAfetaCamera(fonte.luz, camera))) continue;
      if (!cor) {
        context.globalAlpha = fonte.intensidade;
        this.pintar(context, fonte.perfis[0], fonte);
      } else {
        context.globalAlpha = fonte.intensidade * (fonte.luz.neon ? 0.55 : 0.35);
        this.pintar(context, fonte.perfis[1], fonte);
        context.globalAlpha = fonte.intensidade * 0.95;
        this.pintar(context, fonte.perfis[2], fonte);
      }
    }
  }

  desenhar(context, cor, camera) {
    if (this.areaSuja) this.atualizarArea();
    if (!this.area || !luzAfetaCamera(this.area, camera)) return;
    if (this.individual) {
      context.save();
      this.pintarFontes(context, cor, camera);
      context.restore();
      return;
    }
    if (this.sujo) {
      for (const [c, colorido] of [[this.contextMascara, false], [this.contextCor, true]]) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, this.area.largura, this.area.altura);
        c.setTransform(1, 0, 0, 1, -this.area.x, -this.area.y);
        c.globalCompositeOperation = "source-over";
        this.pintarFontes(c, colorido);
      }
      this.sujo = false;
    }
    context.save();
    context.globalAlpha = 1;
    context.drawImage(cor ? this.canvasCor : this.canvasMascara, this.area.x, this.area.y);
    context.restore();
  }

  destroy() {
    this.canvasMascara.width = this.canvasMascara.height = 0;
    this.canvasCor.width = this.canvasCor.height = 0;
    this.fontes.length = this.versoes.length = 0;
    this.pintar = null;
  }
}
