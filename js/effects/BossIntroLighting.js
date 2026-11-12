import { jogadorNaArenaNovoBoss } from "../enemies/novoBoss/NovoBossConfig.js";

/** Sequência de luz por fileiras: referências e limiares ficam em cache, sem novos carimbos. */
export default class BossIntroLighting {
  constructor(arena) {
    this.arena = arena;
    this.limiares = new WeakMap();
    this.revisao = 0;
    // A sala já espera apagada, inclusive antes de o boss ser criado ao entrar na arena.
    this.iniciar();
  }

  contem(luz) {
    return jogadorNaArenaNovoBoss({ active: true, x: luz.x, y: luz.y }, this.arena);
  }

  iniciar(luzes = []) {
    this.limiares = new WeakMap();
    const piso = luzes.filter(luz => luz.neon && this.contem(luz));
    this.topo = piso.length ? Math.min(...piso.map(luz => luz.y)) : this.arena.yMin;
    this.base = piso.length ? Math.max(...piso.map(luz => luz.y)) : this.arena.yMax;
    this.ativa = true;
    this.progresso = -1;
    this.aura = this.ambiente = 0;
    this.revisao++;
  }

  avancar(progresso) {
    this.progresso = Math.max(this.progresso, Math.min(1, progresso));
  }

  perceber(progresso) {
    // Poucos níveis de alpha bastam para o acendimento, sem invalidar a máscara por frações invisíveis.
    const valor = Math.round(Math.min(1, progresso * 2) * 32) / 32;
    if (valor === this.aura) return;
    this.aura = this.ambiente = valor;
    this.revisao++;
  }

  fatorLuz(luz) {
    if (!this.ativa) return 1;
    let limiar = this.limiares.get(luz);
    if (limiar === undefined) {
      const cor = luz.cor?.phaser;
      const vermelha = luz.neon && Number.isFinite(cor) &&
        (cor >> 16 & 255) > (cor >> 8 & 255) * 2 && (cor >> 16 & 255) > (cor & 255) * 2;
      limiar = !this.contem(luz) ? -1 : vermelha ? -2 :
        Math.max(0, Math.min(1, (this.base - Math.round(luz.y / 16) * 16) /
          Math.max(1, this.base - this.topo)));
      this.limiares.set(luz, limiar);
    }
    if (limiar === -2) return this.aura;
    return limiar < 0 || this.progresso >= limiar ? 1 : 0;
  }

  /** A réplica mantém revisão local e refaz os limiares se o enquadramento mudar. */
  aplicarEstadoRede(estado) {
    if (!estado) return;
    let alterada = false;
    const reiniciar = this.topo !== estado.topo || this.base !== estado.base ||
      (!this.ativa && estado.ativa) || estado.progresso < this.progresso;
    for (const campo of ["ativa", "progresso", "aura", "ambiente", "topo", "base"]) {
      if (estado[campo] === undefined || this[campo] === estado[campo]) continue;
      this[campo] = estado[campo];
      alterada = true;
    }
    if (reiniciar) this.limiares = new WeakMap();
    if (alterada) this.revisao++;
  }

  restaurar() {
    this.ativa = false;
    this.aura = this.ambiente = 1;
    this.revisao++;
  }
}
