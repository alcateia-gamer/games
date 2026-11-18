import { autenticacaoNumerica } from './MissionIntelligence.js';
import { modulo, randomHacking, tempoObservado, deltaHacking } from './HackingMotion.js';
export const HACKCONNECT_VISIBLE = 8;
export const HACKCONNECT_ROWS = 4;
export const HACKCONNECT_STEP_MS = 1000;
const total = HACKCONNECT_VISIBLE * HACKCONNECT_ROWS;
const indice = (linha, inicio) => (HACKCONNECT_ROWS - 1 - linha) * HACKCONNECT_VISIBLE + inicio;
export function posicaoNumero(linha, inicio, tempo) {
  const position = modulo(indice(linha, inicio) + Math.floor(tempo / HACKCONNECT_STEP_MS), total);
  return { linha: HACKCONNECT_ROWS - 1 - Math.floor(position / HACKCONNECT_VISIBLE), coluna: position % HACKCONNECT_VISIBLE };
}
export function origemNumero(linha, coluna, tempo) {
  const position = modulo(indice(linha, coluna) - Math.floor(tempo / HACKCONNECT_STEP_MS), total);
  return { linha: HACKCONNECT_ROWS - 1 - Math.floor(position / HACKCONNECT_VISIBLE), inicio: position % HACKCONNECT_VISIBLE };
}
export function indicesSequencia(linha, inicio) {
  return Array.from({ length: 4 }, (_, i) => {
    const position = modulo(indice(linha, inicio) + i, total);
    return { linha: HACKCONNECT_ROWS - 1 - Math.floor(position / HACKCONNECT_VISIBLE), inicio: position % HACKCONNECT_VISIBLE };
  });
}
export function sequenciaLinha(linhas, linha, inicio) {
  return indicesSequencia(linha, inicio).map(n => linhas[n.linha].numeros[n.inicio]);
}
export function sequenciaVisivel(linhas, linha, inicio, tempo) {
  return posicaoNumero(linha, inicio, tempo).coluna <= HACKCONNECT_VISIBLE - 4;
}

/** Uma cadeia percorre a matriz para a direita, sobe de linha e retorna pela base a cada 1000 ms. */
export class HostConnection {
  constructor(config, conectado = false) {
    this.config = config; this.estado = 'ativo'; this.passo = conectado === true ? 1 : 0;
    this.tempo = 0; this.erros = 0; this.rastro = 0; this.transmissao = 0; this.mensagem = '';
    this.preparar();
  }
  preparar() {
    const auth = autenticacaoNumerica(this.config); this.tempo = 0;
    this.etapa = 'HOST';
    this.alvo = auth.host;
    const rand = randomHacking(this.config.seed + 7919 * (this.passo + 1));
    this.linhas = Array.from({ length: HACKCONNECT_ROWS }, () => ({
      numeros: Array.from({ length: HACKCONNECT_VISIBLE }, () => String(10 + rand() % 90)),
    }));
    const linha = rand() % HACKCONNECT_ROWS, inicio = rand() % (HACKCONNECT_VISIBLE - 3);
    this.alvo.forEach((n, i) => { this.linhas[linha].numeros[inicio + i] = n; });
    this.mensagem = 'N.O.V.A.: encontre a sequência numérica em movimento para estabelecer a conexão com o núcleo.';
    if (this.passo === 1) {
      this.estado = 'executando';
      this.mensagem = 'HOST IDENTIFIED\nCONNECTION ESTABLISHED\nAXIOM CORE ACCESS GRANTED\nVIRUS ZERO READY\nN.O.V.A.: suporte à vida estável. Iniciando transmissão e despertar gradual.';
    }
  }
  acao(op, valor) {
    if (this.estado !== 'ativo' || op !== 'selecionarSequencia' || !valor || typeof valor !== 'object') return false;
    const { linha, inicio } = valor;
    if (!Number.isInteger(linha) || linha < 0 || linha >= this.linhas.length || !Number.isInteger(inicio) || inicio < 0 || inicio >= HACKCONNECT_VISIBLE) return false;
    const tempo = tempoObservado(this.tempo, valor.tempo);
    if (tempo === null) return false;
    const completa = sequenciaVisivel(this.linhas, linha, inicio, tempo);
    const sequencia = sequenciaLinha(this.linhas, linha, inicio);
    if (!completa || !sequencia.every((n, i) => n === this.alvo[i])) {
      this.erros++; this.rastro = Math.min(100, this.rastro + 12);
      this.mensagem = completa ? 'SEQUÊNCIA INCORRETA · compare os quatro números com o alvo. Tente novamente; etapas confirmadas preservadas.'
        : 'SEQUÊNCIA PARCIAL · aguarde os quatro números ficarem juntos na mesma linha e selecione novamente.';
      if (this.erros === 2) this.mensagem += '\nConsulte os registros recuperados para conferir o endereço do host.';
      if (this.erros >= 3) this.mensagem += '\nN.O.V.A.: compare os quatro números, na mesma ordem e na mesma linha. Selecione o primeiro e confirme o grupo inteiro.';
      if (this.rastro >= 100) { this.rastro = 40; this.mensagem += ' Rastreio desviado; canal disponível.'; }
    } else { this.passo++; this.rastro = Math.max(0, this.rastro - 10); this.preparar(); }
    return true;
  }
  atualizar(delta) {
    if (this.estado === 'sucesso') return;
    const dt = deltaHacking(delta); this.tempo += dt;
    if (this.estado === 'executando') {
      this.transmissao = Math.min(1, this.transmissao + dt / 6500);
      if (this.transmissao >= 1 - 1e-9) { this.transmissao = 1; this.estado = 'sucesso'; }
    }
  }
  snapshot() {
    return { tipo: 'host', estado: this.estado, passo: this.passo, etapa: this.etapa, alvo: [...this.alvo],
      linhas: this.linhas.map(l => ({ ...l, numeros: [...l.numeros] })), tempo: this.tempo,
      rastro: this.rastro, erros: this.erros, mensagem: this.mensagem, transmissao: this.transmissao };
  }
}
