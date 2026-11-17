import { MATRIX_NODES as N, MATRIX_LINKS as LINKS } from './HackingConfig.js';
const distancia = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
function distanciaSegmento(p, a, b) {
  const t = clamp(((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) /
    ((b.x - a.x) ** 2 + (b.y - a.y) ** 2), 0, 1);
  return distancia(p, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
}
export class MatrixPuzzle {
  constructor(registro = false) {
    this.estado = 'ativo'; this.tempo = 0; this.avatar = { x: N.entrada.x, y: N.entrada.y };
    this.input = { x: 0, y: 0 }; this.inputAte = 0; this.rastro = 0;
    this.memoria = { camada: 'visual', instante: 0, visual: false, rede: false };
    this.anomalia = false; this.estavelAte = 0; this.vida = { A: false, B: false, preservada: true };
    this.rota = 'vida'; this.comunicacao = false; this.registro = registro;
    this.virus = { liberado: false, no: 'entrada', destino: null, progresso: 0, x: N.entrada.x, y: N.entrada.y };
    this.ice = { x: N.desvio.x, y: N.desvio.y, alvo: 0, pausadoAte: 0, contatoAte: 0 };
    this.abrigoAte = 0; this.conclusao = 0;
    this.mensagem = registro ? 'REGISTRO AXIOM: preservar vidas, restringir escolhas. Token de manutenção exposto no instante 04 s.'
      : 'N.O.V.A.: examine a memória e encontre a divergência no acesso.';
  }
  estadoLigacao(a, b, tipo) {
    if (tipo === 'anomalia') {
      if (!this.anomalia) return 'oculta';
      return this.tempo < this.estavelAte || this.tempo % 6000 < 3600 ? 'livre' : 'instavel';
    }
    if (tipo === 'ice') {
      const t = this.tempo % 8000;
      return t < 4200 ? 'livre' : t < 5600 ? 'alerta' : 'bloqueada';
    }
    if (tipo === 'nucleo' && !(this.vida.A && this.vida.B && this.comunicacao)) return 'bloqueada';
    return 'livre';
  }
  caminhavel(p) {
    return Object.values(N).some(n => distancia(p, n) <= 31) || LINKS.some(([a, b, tipo]) =>
      ['livre', 'alerta'].includes(this.estadoLigacao(a, b, tipo)) && distanciaSegmento(p, N[a], N[b]) <= 17);
  }
  mover(x, y) {
    if (this.estado !== 'ativo' || ![x, y].every(Number.isFinite)) return false;
    const tamanho = Math.max(1, Math.hypot(x, y));
    this.input = { x: clamp(x / tamanho, -1, 1), y: clamp(y / tamanho, -1, 1) };
    this.inputAte = this.tempo + 400; return true;
  }
  proximo() {
    return Object.entries(N).filter(([, n]) => distancia(this.avatar, n) < 48)
      .sort(([, a], [, b]) => distancia(this.avatar, a) - distancia(this.avatar, b))[0]?.[0] ?? null;
  }
  acao(op, valor) {
    if (this.estado !== 'ativo') return false;
    const no = this.proximo();
    if (op === 'camada' && no === 'memoria' && ['visual', 'rede'].includes(valor)) this.memoria.camada = valor;
    else if (op === 'instante' && no === 'memoria' && Number.isInteger(valor) && valor >= 0 && valor <= 6) this.memoria.instante = valor;
    else if (op === 'examinar' && no === 'memoria') {
      if (this.memoria.instante !== 4) this.mensagem = 'N.O.V.A.: a divergência ocorre no pulso marcado na linha do tempo.';
      else {
        this.memoria[this.memoria.camada] = true;
        this.anomalia = this.memoria.visual && this.memoria.rede;
        this.mensagem = this.anomalia
          ? 'ANOMALIA: a porta negou acesso, mas o operador atravessou. Token de manutenção exposto.'
          : 'Fragmento identificado. Compare a outra camada no mesmo instante.';
      }
    } else if (op === 'interagir') {
      if (no === 'entrada') {
        if (!this.anomalia) { this.mensagem = 'Encontre a vulnerabilidade na memória antes de conduzir o Vírus Zero.'; return false; }
        this.virus.liberado = true; this.mensagem = 'VÍRUS ZERO EM TRÂNSITO. Configure as rotas e preserve os dois circuitos vitais.';
      } else if (no === 'anomalia' && this.anomalia) {
        this.estavelAte = this.tempo + 10000; this.mensagem = 'Passagem da anomalia estabilizada por 10 segundos.';
      } else if (no === 'vidaA' || no === 'vidaB') {
        this.vida[no === 'vidaA' ? 'A' : 'B'] = true;
        this.mensagem = 'SUPORTE À VIDA ISOLADO DO VÍRUS · alimentação humana preservada.';
      } else if (no === 'roteador') {
        this.rota = this.rota === 'vida' ? 'direta' : this.rota === 'direta' ? 'desvio' : 'vida';
        this.mensagem = `ROTA: ${this.rota === 'vida' ? 'SUPORTE À VIDA · INSEGURA' : this.rota === 'direta' ? 'CONTROLE · atravessa ICE' : 'CONTROLE · desvio inferior'}`;
      } else if (no === 'comunicacao') {
        this.comunicacao = true; this.mensagem = 'Canal de despertar gradual autorizado. A infraestrutura vital continua ativa.';
      } else if (no === 'abrigo' && this.tempo >= this.abrigoAte) {
        this.rastro = Math.max(0, this.rastro - 25); this.ice.pausadoAte = this.tempo + 6000;
        this.abrigoAte = this.tempo + 8000; this.mensagem = 'Rastreamento interrompido. ICE isolado por 6 segundos.';
      } else return false;
    } else return false;
    return true;
  }
  falhar(mensagem) { this.estado = 'falha'; this.input = { x: 0, y: 0 }; this.mensagem = mensagem; }
  proximoVirus() {
    const v = this.virus;
    if (v.no === 'roteador' && this.rota === 'vida') {
      this.falhar('INJEÇÃO CONTIDA: a rota alcançaria suporte à vida. Nada foi danificado. Reconfigure o roteador.'); return null;
    }
    return { entrada: 'memoria', memoria: this.anomalia ? 'anomalia' : null,
      anomalia: 'roteador', roteador: this.rota === 'direta' ? 'comunicacao' : 'desvio',
      desvio: 'comunicacao', comunicacao: 'nucleo' }[v.no] ?? null;
  }
  atualizar(delta) {
    if (this.estado === 'sucesso' || this.estado === 'falha' || !Number.isFinite(delta)) return;
    const dt = Math.max(0, Math.min(delta, 100)); this.tempo += dt;
    if (this.estado === 'executando') {
      this.conclusao = Math.min(1, this.conclusao + dt / 4000);
      if (this.conclusao >= 1) { this.estado = 'sucesso'; this.mensagem = 'VÍRUS ZERO EXECUTANDO. Despertar gradual iniciado. Suporte à vida preservado.'; }
      return;
    }
    if (this.tempo < this.inputAte) {
      const steps = Math.max(1, Math.ceil(dt / 16));
      for (let i = 0; i < steps; i++) {
        const x = this.avatar.x + this.input.x * 132 * dt / steps / 1000;
        const y = this.avatar.y + this.input.y * 132 * dt / steps / 1000;
        if (this.caminhavel({ x, y })) this.avatar = { x, y };
        else {
          if (this.caminhavel({ x, y: this.avatar.y })) this.avatar.x = x;
          if (this.caminhavel({ x: this.avatar.x, y })) this.avatar.y = y;
        }
      }
    }
    if (!this.caminhavel(this.avatar)) {
      this.avatar = { x: N.memoria.x, y: N.memoria.y }; this.rastro += 12;
      this.mensagem = 'A passagem oscilou. Estabilize a anomalia ou aguarde a janela azul.';
    }
    const v = this.virus;
    if (v.liberado) {
      this.rastro += dt * .00035;
      v.destino ??= this.proximoVirus();
      if (this.estado === 'falha') return;
      if (v.destino) {
        const link = LINKS.find(([a, b]) => (a === v.no && b === v.destino) || (b === v.no && a === v.destino));
        if (link && ['livre', 'alerta'].includes(this.estadoLigacao(...link))) {
          v.progresso = Math.min(1, v.progresso + 48 * dt / 1000 / distancia(N[v.no], N[v.destino]));
          v.x = N[v.no].x + (N[v.destino].x - N[v.no].x) * v.progresso;
          v.y = N[v.no].y + (N[v.destino].y - N[v.no].y) * v.progresso;
          if (v.progresso >= 1) {
            v.no = v.destino; v.destino = null; v.progresso = 0;
            if (v.no === 'nucleo') {
              this.estado = 'executando'; this.input = { x: 0, y: 0 };
              this.mensagem = 'AXIOM: Eu mantive essas pessoas vivas. / N.O.V.A.: E continuarão vivas. O controle termina aqui.';
            }
          }
        }
      }
      this.atualizarICE(dt);
    }
    if (this.rastro >= 100) this.falhar('ICE encerrou o canal. O Vírus Zero foi contido; suporte à vida intacto. Tente outra rota.');
  }
  atualizarICE(dt) {
    const ice = this.ice;
    if (this.tempo < ice.pausadoAte) return;
    const patrol = ['abrigo', 'entrada', 'memoria', 'anomalia', 'roteador', 'comunicacao', 'desvio'];
    const n = N[patrol[ice.alvo]], d = distancia(ice, n), passo = Math.min(d, dt * .055);
    if (d > 0) { ice.x += (n.x - ice.x) / d * passo; ice.y += (n.y - ice.y) / d * passo; }
    if (d < 3) ice.alvo = (ice.alvo + 1) % patrol.length;
    if (this.tempo < ice.contatoAte) return;
    if (distancia(ice, this.avatar) < 26) {
      this.avatar = { x: N.entrada.x, y: N.entrada.y }; this.rastro += 20; ice.contatoAte = this.tempo + 2000;
      this.mensagem = 'ICE interceptou N.O.V.A. Use o abrigo inferior para quebrar o rastreamento.';
    } else if (distancia(ice, this.virus) < 22) {
      Object.assign(this.virus, { x: N[this.virus.no].x, y: N[this.virus.no].y, progresso: 0 });
      this.rastro += 15; ice.contatoAte = this.tempo + 2000;
      this.mensagem = 'ICE bloqueou o pacote. Abra outra rota ou interrompa seu rastreamento.';
    }
  }
  snapshot() {
    return { tipo: 'matrix', estado: this.estado, tempo: this.tempo, avatar: { ...this.avatar },
      memoria: { ...this.memoria }, anomalia: this.anomalia, estavelAte: this.estavelAte,
      vida: { ...this.vida }, rota: this.rota, comunicacao: this.comunicacao,
      virus: { ...this.virus }, ice: { ...this.ice }, rastro: this.rastro,
      registro: this.registro, mensagem: this.mensagem, conclusao: this.conclusao, proximo: this.proximo() };
  }
}
