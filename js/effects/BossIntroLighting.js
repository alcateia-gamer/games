
/** Ambiente e aura da introdução derivados da arena, sem fontes individuais. */
export default class BossIntroLighting {
  constructor(arena) {
    this.arena = arena;
    this.revisao = 0;
    // A sala já espera apagada, inclusive antes de o boss ser criado ao entrar na arena.
    this.iniciar();
  }

  iniciar() {
    this.topo = this.arena.yMin;
    this.base = this.arena.yMax;
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

  /** A réplica mantém revisão local e refaz os limiares se o enquadramento mudar. */
  aplicarEstadoRede(estado) {
    if (!estado) return;
    let alterada = false;
    for (const campo of ["ativa", "progresso", "aura", "ambiente", "topo", "base"]) {
      if (estado[campo] === undefined || this[campo] === estado[campo]) continue;
      this[campo] = estado[campo];
      alterada = true;
    }
    if (alterada) this.revisao++;
  }

  restaurar() {
    this.ativa = false;
    this.aura = this.ambiente = 1;
    this.revisao++;
  }
}
