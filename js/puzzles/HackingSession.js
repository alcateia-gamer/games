import { BreachPuzzle } from './BreachPuzzle.js';
import { MatrixPuzzle } from './MatrixPuzzle.js';
/** Uma sessão autoritativa, um operador, comandos ordenados e conclusão idempotente. */
export class HackingSession {
  constructor(onComplete = () => {}) { this.atual = null; this.serial = 0; this.onComplete = onComplete; }
  abrir(tipo, owner, registro = false) {
    if (this.atual || !['fabrica', 'matrix'].includes(tipo) || !owner) return false;
    const seed = (Date.now() + ++this.serial * 997) >>> 0;
    this.atual = { id: `${owner}:${seed}:${this.serial}`, tipo, owner, seed, seq: 0, terminou: false,
      concluidoMs: 0, model: tipo === 'fabrica' ? new BreachPuzzle(seed) : new MatrixPuzzle(registro) };
    return true;
  }
  comando(owner, payload) {
    const s = this.atual;
    if (!s || owner !== s.owner || payload.id !== s.id || !Number.isSafeInteger(payload.seq) || payload.seq <= s.seq) return false;
    s.seq = payload.seq;
    if (payload.op === 'cancelar') { this.atual = null; return true; }
    if (s.terminou) return false;
    if (payload.op === 'reiniciar' && s.model.estado === 'falha') {
      s.model = s.tipo === 'fabrica' ? new BreachPuzzle(++s.seed) : new MatrixPuzzle(s.model.registro); return true;
    }
    if (s.tipo === 'fabrica') {
      if (payload.op === 'selecionar') return s.model.selecionar(payload.valor);
      if (payload.op === 'confirmar' && s.model.concluidos.includes('portas')) { s.model.finalizar(); return true; }
    } else {
      if (payload.op === 'mover') return s.model.mover(payload.x, payload.y);
      return s.model.acao(payload.op, payload.valor);
    }
    return false;
  }
  atualizar(delta) {
    const s = this.atual;
    if (!s || !Number.isFinite(delta)) return;
    s.model.atualizar(delta);
    if (s.model.estado === 'sucesso' && !s.terminou) {
      s.terminou = true;
      this.onComplete(s.tipo, s.model.snapshot());
    }
    if (s.terminou && s.tipo === 'fabrica') {
      s.concluidoMs += Math.max(0, Math.min(delta, 100));
      if (s.concluidoMs >= 1800) this.atual = null;
    }
  }
  cancelar(owner) { if (this.atual?.owner === owner) this.atual = null; }
  snapshot() {
    const s = this.atual;
    return s ? { id: s.id, tipo: s.tipo, owner: s.owner, seq: s.seq, terminou: s.terminou, model: s.model.snapshot() } : null;
  }
}
