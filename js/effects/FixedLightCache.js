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
    this.refazerTudo = true;
    this.regiaoSuja = null;
  }

  adicionar(luz, perfis) {
    this.fontes.push({ luz, perfis, intensidade: -1, angulo: null });
    this.areaSuja = this.sujo = true;
    this.refazerTudo = true;
  }

  /** A fábrica anterior já não é renderizada: encolhe o atlas ao cenário que permanece. */
  descartarAbaixo(limiteY) {
    this.fontes = this.fontes.filter(fonte => {
      if (fonte.luz.y - fonte.luz.raio * MULTIPLICADOR_ALCANCE_FABRICA <= limiteY) return true;
      this.liberarCarimbos(fonte);
      return false;
    });
    this.areaSuja = this.sujo = this.refazerTudo = true;
    this.regiaoSuja = null;
    this.revisao++;
  }

  liberarCarimbos(fonte) {
    for (const canvas of fonte.carimbos ?? []) if (canvas) canvas.width = canvas.height = 0;
    fonte.carimbos = null;
  }

  /** Guarda os três recortes pequenos de cada neon; intensidade só participa da composição. */
  desenharPerfil(context, fonte, indice) {
    const raio = fonte.luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
    if (!fonte.luz.neon || raio > 128) {
      this.pintar(context, fonte.perfis[indice], fonte);
      return;
    }
    fonte.carimbos ??= [];
    let canvas = fonte.carimbos[indice];
    if (!canvas) {
      canvas = fonte.carimbos[indice] = document.createElement("canvas");
      canvas.width = canvas.height = Math.ceil(raio * 2);
      const c = canvas.getContext("2d");
      c.setTransform(1, 0, 0, 1, raio - fonte.luz.x, raio - fonte.luz.y);
      c.globalAlpha = 1;
      this.pintar(c, fonte.perfis[indice], fonte);
    }
    context.drawImage(canvas, fonte.luz.x - raio, fonte.luz.y - raio);
  }

  atualizar(agora, zonas, paredes, estatuas, oclusao) {
    let mudou = false;
    const recortesAlterados = this.versoes[0] !== paredes.revisao || this.versoes[1] !== estatuas.revisao;
    const versoes = [paredes.revisao, estatuas.revisao, oclusao.revisao];
    for (let i = 0; i < versoes.length; i++) {
      if (this.versoes[i] !== versoes[i]) {
        this.versoes[i] = versoes[i]; mudou = this.refazerTudo = true;
      }
    }
    for (const fonte of this.fontes) {
      const luz = fonte.luz;
      const intensidade = luz.ligada ? luz.intensidade * (luz.cor?.alpha ?? 1) * zonas.fatorLuz(luz, agora) : 0;
      const angulo = luz.neon ? luz.fase : luz.angulo;
      if (recortesAlterados || fonte.x !== luz.x || fonte.y !== luz.y ||
          fonte.raio !== luz.raio || fonte.angulo !== angulo) this.liberarCarimbos(fonte);
      if (fonte.x !== luz.x || fonte.y !== luz.y || fonte.raio !== luz.raio) {
        fonte.x = luz.x; fonte.y = luz.y; fonte.raio = luz.raio;
        this.areaSuja = mudou = this.refazerTudo = true;
      }
      if (fonte.intensidade !== intensidade || fonte.angulo !== angulo) {
        mudou = true;
        const r = luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
        if (!this.regiaoSuja) this.regiaoSuja = { left: Math.floor(luz.x - r), right: Math.ceil(luz.x + r),
          top: Math.floor(luz.y - r), bottom: Math.ceil(luz.y + r) };
        else {
          this.regiaoSuja.left = Math.min(this.regiaoSuja.left, Math.floor(luz.x - r));
          this.regiaoSuja.right = Math.max(this.regiaoSuja.right, Math.ceil(luz.x + r));
          this.regiaoSuja.top = Math.min(this.regiaoSuja.top, Math.floor(luz.y - r));
          this.regiaoSuja.bottom = Math.max(this.regiaoSuja.bottom, Math.ceil(luz.y + r));
        }
      }
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

  pintarFontes(context, cor, camera = null, regiao = null) {
    for (const fonte of this.fontes) {
      if (fonte.intensidade <= 0 || (camera && !luzAfetaCamera(fonte.luz, camera))) continue;
      if (regiao) {
        const luz = fonte.luz, r = luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
        if (luz.x + r < regiao.left || luz.x - r > regiao.right ||
            luz.y + r < regiao.top || luz.y - r > regiao.bottom) continue;
      }
      if (!cor) {
        context.globalAlpha = fonte.intensidade;
        this.desenharPerfil(context, fonte, 0);
      } else {
        context.globalAlpha = fonte.intensidade * (fonte.luz.neon ? 0.55 : 0.35);
        this.desenharPerfil(context, fonte, 1);
        context.globalAlpha = fonte.intensidade * 0.95;
        this.desenharPerfil(context, fonte, 2);
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
      // Recompõe só a faixa alterada, preservando a ordem e a mistura das cores.
      // Durante a entrada, acender uma fileira não redesenha todos os LEDs da arena.
      const regiao = this.refazerTudo ? null : this.regiaoSuja;
      for (const [c, colorido] of [[this.contextMascara, false], [this.contextCor, true]]) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        if (regiao) c.clearRect(regiao.left - this.area.x, regiao.top - this.area.y,
          regiao.right - regiao.left, regiao.bottom - regiao.top);
        else c.clearRect(0, 0, this.area.largura, this.area.altura);
        c.save();
        c.setTransform(1, 0, 0, 1, -this.area.x, -this.area.y);
        if (regiao) {
          c.beginPath(); c.rect(regiao.left, regiao.top, regiao.right - regiao.left,
            regiao.bottom - regiao.top); c.clip();
        }
        c.globalCompositeOperation = "source-over";
        this.pintarFontes(c, colorido, null, regiao);
        c.restore();
      }
      this.sujo = false;
      this.refazerTudo = false;
      this.regiaoSuja = null;
    }
    context.save();
    context.globalAlpha = 1;
    context.drawImage(cor ? this.canvasCor : this.canvasMascara, this.area.x, this.area.y);
    context.restore();
  }

  destroy() {
    this.canvasMascara.width = this.canvasMascara.height = 0;
    this.canvasCor.width = this.canvasCor.height = 0;
    for (const fonte of this.fontes) this.liberarCarimbos(fonte);
    this.fontes.length = this.versoes.length = 0;
    this.pintar = null;
  }
}
