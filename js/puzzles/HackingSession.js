import { BreachPuzzle } from './BreachPuzzle.js';
import { CoreInvasion } from './CoreInvasion.js';
import { BruteforcePuzzle } from './BruteforcePuzzle.js';
import { gerarMissao } from './MissionIntelligence.js';
/** Uma sessão autoritativa, um operador, comandos ordenados e conclusão idempotente. */
export class HackingSession {
  constructor(onComplete = () => {}, missao = () => ({ config: gerarMissao(1) }), salvar = () => {}, objetivosBreach = () => [], tutoriaisMostrados = new Map()) {
    this.atual = null; this.serial = 0; this.onComplete = onComplete; this.missao = missao; this.salvar = salvar; this.objetivosBreach = objetivosBreach;
    this.tutoriaisMostrados = tutoriaisMostrados;
  }
  criarModel(tipo, seed) {
    const m = this.missao();
    return tipo === 'fabrica' ? new BreachPuzzle(seed, this.objetivosBreach()) : tipo === 'bruteforce' ? new BruteforcePuzzle(seed)
      : new CoreInvasion(m.config, m.checkpoint, this.salvar, seed);
  }
  tipoTutorial(s) { const view = s.model.snapshot(); return s.tipo !== 'matrix' ? s.tipo : view.etapaTipo === 'memory' ? `memory-${view.modulo}` : 'host'; }
  abrir(tipo, owner) {
    if (this.atual || !['fabrica', 'bruteforce', 'matrix'].includes(tipo) || !owner) return false;
    const seed = (Date.now() + ++this.serial * 997) >>> 0;
    this.atual = { id: `${owner}:${seed}:${this.serial}`, tipo, owner, seed, seq: 0, terminou: false,
      concluidoMs: 0, model: this.criarModel(tipo, seed) };
    this.atual.tutorialTipo = this.tipoTutorial(this.atual);
    this.atual.tutorial = false;
    if (tipo !== 'matrix') {
      const vistos = this.tutoriaisMostrados.get(owner) ?? new Set();
      this.atual.tutorial = !vistos.has(tipo);
      vistos.add(tipo);
      this.tutoriaisMostrados.set(owner, vistos);
    }
    return true;
  }
  comando(owner, payload) {
    const s = this.atual;
    if (!s || owner !== s.owner || payload.id !== s.id || !Number.isSafeInteger(payload.seq) || payload.seq <= s.seq) return false;
    s.seq = payload.seq;
    if (payload.op === 'cancelar') { this.atual = null; return true; }
    if (s.terminou) return false;
    if (payload.op === 'tutorial' && typeof payload.valor === 'boolean' && s.model.snapshot().estado === 'ativo') {
      s.tutorial = payload.valor; return true;
    }
    if (s.tutorial) return false;
    if (payload.op === 'reiniciar' && s.model.estado === 'falha') {
      s.model = this.criarModel(s.tipo, ++s.seed); s.tutorialTipo = this.tipoTutorial(s); return true;
    }
    if (s.tipo === 'fabrica') {
      if (payload.op === 'selecionar') return s.model.selecionar(payload.valor);
      if (payload.op === 'confirmar' && s.model.podeConfirmar()) { s.model.finalizar(); return true; }
    } else {
      const accepted = s.model.acao(payload.op, payload.valor);
      if (accepted) s.tutorialTipo = this.tipoTutorial(s);
      return accepted;
    }
    return false;
  }
  atualizar(delta) {
    const s = this.atual;
    if (!s || !Number.isFinite(delta)) return;
    if (!s.tutorial) s.model.atualizar(delta);
    const tipo = this.tipoTutorial(s);
    if (tipo !== s.tutorialTipo) { s.tutorialTipo = tipo; s.tutorial = false; }
    if (s.model.estado === 'sucesso' && !s.terminou) {
      s.terminou = true;
      this.onComplete(s.tipo, s.model.snapshot());
    }
    if (s.terminou && s.tipo !== 'matrix') {
      s.concluidoMs += Math.max(0, Math.min(delta, 100));
      if (s.concluidoMs >= 1800) this.atual = null;
    }
  }
  cancelar(owner) { if (this.atual?.owner === owner) this.atual = null; }
  snapshot() {
    const s = this.atual;
    return s ? { id: s.id, tipo: s.tipo, owner: s.owner, seq: s.seq, terminou: s.terminou, model: { ...s.model.snapshot(), tutorial: s.tutorial } } : null;
  }
}
