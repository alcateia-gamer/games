import { modulo, randomHacking, tempoObservado, deltaHacking } from './HackingMotion.js';
export const BRUTEFORCE_WORDS = Object.freeze(['PROTOCOL', 'OVERRIDE', 'FIREWALL', 'NULLNETS', 'NULLBORN']);
export const BRUTEFORCE_WINDOW = .34;

export function faseColuna(coluna, tempo) {
  const parada = coluna.falhaAte ? Math.max(0, Math.min(tempo, coluna.falhaAte) - coluna.pausaInicio) : 0;
  return coluna.fase + ((coluna.fixada ? coluna.congeladaEm : tempo) - coluna.atraso - parada) / coluna.passoMs;
}
export function deslocamentoLetra(coluna, indice, tempo) {
  return modulo(indice + faseColuna(coluna, tempo) + coluna.letras.length / 2, coluna.letras.length) - coluna.letras.length / 2;
}
export function lerColuna(coluna, tempo) {
  const indice = modulo(Math.round(-faseColuna(coluna, tempo)), coluna.letras.length);
  const deslocamento = deslocamentoLetra(coluna, indice, tempo);
  return { indice, letra: coluna.letras[indice], deslocamento, centralizada: Math.abs(deslocamento) <= BRUTEFORCE_WINDOW };
}

/** Oito tambores verticais: o instante do toque determina o caractere congelado. */
export class BruteforcePuzzle {
  constructor(seed = 1) {
    this.seed = seed >>> 0; this.tempo = 0; this.estado = 'ativo'; this.ativa = 0; this.erros = 0;
    const rand = randomHacking(seed);
    this.senha = BRUTEFORCE_WORDS[(rand() >>> 16) % BRUTEFORCE_WORDS.length];
    this.colunas = [...this.senha].map((alvo, i) => {
      const letras = [alvo], alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      while (letras.length < 8) { const c = alphabet[rand() % alphabet.length]; if (!letras.includes(c)) letras.push(c); }
      for (let n = letras.length - 1; n > 0; n--) { const j = rand() % (n + 1); [letras[n], letras[j]] = [letras[j], letras[n]]; }
      return { letras, alvo, fase: (rand() % 800) / 100, passoMs: (1250 - i * 45 + rand() % 90) / 3,
        fixada: false, congeladaEm: 0, confirmada: null, atraso: 0, falhaAte: 0, pausaInicio: 0 };
    });
    this.mensagem = 'N.O.V.A.: as letras verdes pertencem à senha. Espere a letra verde da coluna ativa atravessar a faixa central e congele-a.';
  }
  acao(op, valor) {
    if (this.estado !== 'ativo' || !valor || typeof valor !== 'object') return false;
    if (op === 'selecionarColuna') {
      if (!Number.isInteger(valor.coluna) || valor.coluna < 0 || valor.coluna >= 8) return false;
      this.mensagem = valor.coluna === this.ativa ? `COLUNA ${this.ativa + 1} SELECIONADA · aguarde a letra verde no centro.`
        : `Complete a coluna ${this.ativa + 1} primeiro. A senha é construída da esquerda para a direita.`;
      return true;
    }
    if (op !== 'congelar' || valor.coluna !== this.ativa) return false;
    const coluna = this.colunas[this.ativa], instante = tempoObservado(this.tempo, valor.tempo);
    if (instante === null || coluna.falhaAte > this.tempo) return false;
    const leitura = lerColuna(coluna, instante);
    if (!leitura.centralizada || leitura.letra !== coluna.alvo) {
      this.erros++; coluna.pausaInicio = instante; coluna.falhaAte = this.tempo + 650;
      this.mensagem = leitura.centralizada ? `LETRA ${leitura.letra} INCORRETA · tente novamente esta coluna. As anteriores continuam congeladas.`
        : 'FORA DA FAIXA CENTRAL · aguarde a letra verde atravessar a linha. Tente novamente esta coluna.';
      return true;
    }
    coluna.fixada = true; coluna.congeladaEm = instante; coluna.confirmada = leitura.letra; this.ativa++;
    if (this.ativa === 8) {
      this.estado = 'sucesso';
      this.mensagem = 'PASSWORD ACCEPTED\nEMPLOYEE ID: EV-041\nSECURITY CLEARANCE: RESTORED\nRECOVERING ARCHIVED DATA...';
    } else this.mensagem = `LETRA ${leitura.letra} CONFIRMADA · coluna ${this.ativa + 1} liberada.`;
    return true;
  }
  atualizar(delta) {
    if (this.estado !== 'ativo') return;
    this.tempo += deltaHacking(delta);
    for (const c of this.colunas) if (c.falhaAte && this.tempo >= c.falhaAte) {
      c.atraso += c.falhaAte - c.pausaInicio; c.falhaAte = 0;
    }
  }
  snapshot() {
    return { tipo: 'bruteforce', estado: this.estado, tempo: this.tempo, ativa: this.ativa, erros: this.erros,
      confirmadas: this.colunas.map(c => c.confirmada), colunas: this.colunas.map(c => ({ ...c, letras: [...c.letras] })), mensagem: this.mensagem };
  }
}
