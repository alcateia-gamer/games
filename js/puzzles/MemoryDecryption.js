import { randomHacking } from './HackingMotion.js';
export const MEMORY_MODULES = Object.freeze(['identificacao', 'integridade', 'autorizacao']);
export const MEMORY_NAMES = Object.freeze(['IDENTIFICAÇÃO', 'INTEGRIDADE', 'AUTORIZAÇÃO']);
const orientacoes = [
  'N.O.V.A.: os registros de Elias identificam a função dos servidores. Procure o núcleo de processamento.',
  'N.O.V.A.: nós não precisamos destruir a rede. Apenas separar suas defesas dos sistemas vitais.',
  'N.O.V.A.: a chave recuperada no terminal da fábrica pode reconstruir a autorização.',
];
function embaralhar(items, seed) {
  const result = [...items], rand = randomHacking(seed);
  for (let i = result.length - 1; i > 0; i--) { const j = (rand() >>> 8) % (i + 1); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
const descricao = node => ({ CORE: 'PROCESSAMENTO CENTRAL', SEC: 'SEGURANÇA INDUSTRIAL', LIFE: 'SUPORTE VITAL', BIO: 'CONTROLE BIOLÓGICO' })[node.tipo];

/** Três objetivos independentes; erros só afetam a seleção do módulo atual. */
export class MemoryDecryption {
  constructor(config, recuperados = 0, tentativa = 1) {
    this.config = config; this.recuperados = Math.max(0, Math.min(3, recuperados)); this.tentativa = tentativa >>> 0;
    this.estado = this.recuperados === 3 ? 'sucesso' : 'ativo';
    this.erros = [0, 0, 0]; this.isolamento = []; this.sequencia = [];
    this.mensagem = 'N.O.V.A.: o núcleo está protegido por três arquivos. Recupere um por vez para estabelecer a conexão.';
    this.gerarAlternativas();
  }
  gerarAlternativas() {
    const c = this.config, node = id => { const n = c.nodes.find(n => n.id === id); return { id: n.id, tipo: n.tipo, descricao: descricao(n) }; };
    const seed = (c.seed ^ this.tentativa) >>> 0;
    this.identificacoes = embaralhar([node(c.core), node(c.seguranca[0]), node(c.vitais[0])], seed);
    this.sistemas = embaralhar([...c.seguranca, ...c.vitais].map(id => ({ ...node(id), descricao: c.seguranca.includes(id) ? c.seguranca.indexOf(id) === 0 ? 'FIREWALL CENTRAL' : 'MONITORAMENTO DE INVASÃO' : descricao(node(id)) })), seed + 733);
    this.fragmentos = embaralhar(c.assinatura, seed + 1297);
  }
  falhar(base) {
    const i = this.recuperados, count = ++this.erros[i];
    const sugestao = count === 2 ? '\nConsulte os registros recuperados antes de tentar novamente.' : count >= 3 ? '\n' + [
      'N.O.V.A.: CORE designa processamento central. Compare a função dos três servidores.',
      'N.O.V.A.: LIFE e BIO mantêm pessoas vivas; os módulos SEC protegem a instalação.',
      'N.O.V.A.: os fragmentos da chave LEVEL 7 vêm primeiro, na ordem registrada. O selo LEVEL 5 encerra a autorização.',
    ][i] : '';
    this.mensagem = base + sugestao;
  }
  recuperar(mensagem) {
    this.recuperados++; this.mensagem = mensagem;
    if (this.recuperados === 3) this.estado = 'sucesso';
  }
  acao(op, valor) {
    if (this.estado !== 'ativo') return false;
    const c = this.config;
    if (this.recuperados === 0 && op === 'identificar' && this.identificacoes.some(n => n.id === valor)) {
      if (valor === c.core) this.recuperar('CORE IDENTIFIED\nARCHIVE 01 RECOVERED');
      else {
        this.falhar('INVALID SERVER IDENTIFICATION\nCONSULT RECOVERED INTELLIGENCE');
        this.tentativa++;
        const anterior = this.identificacoes; this.identificacoes = embaralhar(anterior, (c.seed ^ this.tentativa) >>> 0);
        if (this.identificacoes.every((n, i) => n.id === anterior[i].id)) this.identificacoes.push(this.identificacoes.shift());
      }
    } else if (this.recuperados === 1 && op === 'alternarIsolamento' && this.sistemas.some(n => n.id === valor)) {
      this.isolamento = this.isolamento.includes(valor) ? this.isolamento.filter(id => id !== valor) : [...this.isolamento, valor];
    } else if (this.recuperados === 1 && op === 'executarIsolamento') {
      if (this.isolamento.length === c.seguranca.length && c.seguranca.every(id => this.isolamento.includes(id)))
        this.recuperar('SECURITY SYSTEMS ISOLATED\nEDEN LIFE SUPPORT: STABLE\nARCHIVE 02 RECOVERED');
      else this.falhar('INVALID ISOLATION CONFIGURATION\nESSENTIAL SYSTEMS MUST REMAIN ACTIVE');
    } else if (this.recuperados === 2 && op === 'adicionarFragmento' && this.fragmentos.includes(valor) && !this.sequencia.includes(valor) && this.sequencia.length < 3) this.sequencia.push(valor);
    else if (this.recuperados === 2 && op === 'removerFragmento' && Number.isInteger(valor) && valor >= 0 && valor < this.sequencia.length) this.sequencia.splice(valor, 1);
    else if (this.recuperados === 2 && op === 'limparFragmentos') this.sequencia = [];
    else if (this.recuperados === 2 && op === 'validarAutorizacao') {
      if (this.sequencia.length === 3 && c.assinatura.every((part, i) => this.sequencia[i] === part))
        this.recuperar('AUTHORIZATION ACCEPTED\nARCHIVE 03 RECOVERED\nMEMORY DECRYPTION COMPLETE\nCORE ACCESS PROTOCOL AVAILABLE');
      else this.falhar('INVALID AUTHORIZATION SEQUENCE\nCONSULT RECOVERED AUTHENTICATION');
    } else return false;
    return true;
  }
  atualizar() {}
  snapshot() {
    return { tipo: 'memory', estado: this.estado, recuperados: this.recuperados, modulo: MEMORY_MODULES[this.recuperados] ?? 'concluido',
      modulos: MEMORY_NAMES.map((nome, i) => ({ nome, status: i < this.recuperados ? 'RECUPERADO' : i === this.recuperados ? 'CRIPTOGRAFADO' : 'BLOQUEADO' })),
      identificacoes: this.identificacoes.map(n => ({ ...n })), sistemas: this.sistemas.map(n => ({ ...n })), fragmentos: [...this.fragmentos],
      isolamento: [...this.isolamento], sequencia: [...this.sequencia], erros: [...this.erros], suporteVida: 'STABLE',
      orientacao: orientacoes[this.recuperados] ?? 'N.O.V.A.: autorização aceita. Agora precisamos localizar o host verdadeiro.', mensagem: this.mensagem };
  }
}
