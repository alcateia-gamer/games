const CODES = ['1C', '55', 'E9', 'BD', '7A', 'A4'];
export const BREACH = Object.freeze({ lado: 5, buffer: 10, tempoMs: 90000 });
function random(seed) {
  let value = seed >>> 0;
  return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
export function gerarBreach(seed = 1) {
  const rand = random(seed), pick = a => a[Math.floor(rand() * a.length)];
  const grade = Array.from({ length: 25 }, () => pick(CODES)), caminho = [];
  let eixo = 'linha', faixa = 0;
  for (let i = 0; i < BREACH.buffer; i++) {
    const opcoes = Array.from({ length: 25 }, (_, j) => j).filter(j => !caminho.includes(j) &&
      (eixo === 'linha' ? Math.floor(j / 5) === faixa : j % 5 === faixa));
    if (!opcoes.length) return gerarBreach(seed + 1);
    const cell = pick(opcoes); caminho.push(cell);
    faixa = eixo === 'linha' ? cell % 5 : Math.floor(cell / 5);
    eixo = eixo === 'linha' ? 'coluna' : 'linha';
  }
  const sequencia = caminho.map(i => grade[i]);
  return { grade, alvos: [
    { id: 'portas', nome: 'LIBERAR PORTAS', obrigatorio: true, codigo: sequencia.slice(0, 4) },
    { id: 'robos', nome: 'PARALISAR ROBÔS · 12 s', codigo: sequencia.slice(4, 7) },
    { id: 'registro', nome: 'REGISTRO DA AXIOM', codigo: sequencia.slice(7, 10) },
  ] };
}
export class BreachPuzzle {
  constructor(seed = 1, recuperados = []) {
    this.recuperados = [...recuperados];
    Object.assign(this, gerarBreach(seed)); this.selecoes = []; this.tempo = 0;
    this.estado = 'ativo'; this.eixo = 'linha'; this.faixa = 0; this.concluidos = [];
  }
  podeSelecionar(index) {
    return this.estado === 'ativo' && Number.isInteger(index) && index >= 0 && index < 25 &&
      !this.selecoes.includes(index) && (this.eixo === 'linha' ? Math.floor(index / 5) === this.faixa : index % 5 === this.faixa);
  }
  selecionar(index) {
    if (!this.podeSelecionar(index)) return false;
    this.selecoes.push(index);
    const buffer = this.selecoes.map(i => this.grade[i]);
    this.concluidos = this.alvos.filter(a => !this.recuperados.includes(a.id) && buffer.some((_, i) =>
      a.codigo.every((c, j) => buffer[i + j] === c))).map(a => a.id);
    this.faixa = this.eixo === 'linha' ? index % 5 : Math.floor(index / 5);
    this.eixo = this.eixo === 'linha' ? 'coluna' : 'linha';
    if (this.selecoes.length >= BREACH.buffer || !this.grade.some((_, i) => this.podeSelecionar(i))) this.finalizar();
    return true;
  }
  podeConfirmar() {
    return this.estado === 'ativo' && (this.recuperados.includes('portas')
      ? this.concluidos.length > 0 : this.concluidos.includes('portas'));
  }
  finalizar() { this.estado = this.podeConfirmar() ? 'sucesso' : 'falha'; }
  atualizar(delta) {
    if (this.estado !== 'ativo' || !this.selecoes.length || !Number.isFinite(delta)) return;
    this.tempo += Math.max(0, Math.min(delta, 100));
    if (this.tempo >= BREACH.tempoMs) this.finalizar();
  }
  snapshot() {
    return { tipo: 'fabrica', grade: this.grade, alvos: this.alvos, selecoes: [...this.selecoes],
      eixo: this.eixo, faixa: this.faixa, concluidos: [...this.concluidos], recuperados: [...this.recuperados],
      podeConfirmar: this.podeConfirmar(), estado: this.estado,
      restante: Math.max(0, BREACH.tempoMs - this.tempo), buffer: BREACH.buffer };
  }
}
