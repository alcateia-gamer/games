/** Dados da tentativa: uma semente, pistas e validação usam a mesma configuração. */
export const INTELLIGENCE_KEY = 'nullnetMission';
export function gerarMissao(seed) {
  let n = seed >>> 0;
  const next = () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0);
  const hex = () => (next() & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const nodes = ['SEC', 'LIFE', 'CORE', 'BIO', 'SEC'].map(tipo => ({ id: `${tipo}-${hex()}`, tipo }));
  const core = nodes.find(n => n.tipo === 'CORE').id, seguranca = nodes.filter(n => n.tipo === 'SEC').map(n => n.id), vitais = nodes.filter(n => ['LIFE', 'BIO'].includes(n.tipo)).map(n => n.id);
  const chave = [hex(), hex()], cauda = hex(), host = `AX-${hex()}-${hex()}`;
  return { seed: seed >>> 0, nodes,
    core, seguranca, vitais, host, chave, cauda, assinatura: [...chave, cauda], registroFisico: hex() };
}
/** Tradução determinística dos fragmentos recuperados para os alvos numéricos do núcleo. */
export function autenticacaoNumerica(config) {
  const converter = texto => {
    let hash = 2166136261;
    for (const char of texto) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    return Array.from({ length: 4 }, () => {
      hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
      return String(10 + (hash >>> 8) % 90);
    });
  };
  return { host: converter(`${config.host}:${config.registroFisico}`) };
}
export function podeEntrarBoss(registry) {
  return registry?.get('bossAccessCardAuthenticated') === true && registry?.get('factoryBruteforceComplete') === true;
}
export function feedbackAcesso(registry) {
  const card = registry?.get('bossAccessCardAuthenticated') === true, digital = registry?.get('factoryBruteforceComplete') === true;
  if (card && digital) return 'CREDENCIAIS VALIDADAS\nACESSO AO SETOR CENTRAL AUTORIZADO\nDESBLOQUEANDO PORTA...';
  if (!card && !digital) return 'CREDENCIAIS INSUFICIENTES\nAUTENTICAÇÃO DUPLA NECESSÁRIA';
  return `AUTENTICAÇÃO FÍSICA: ${card ? 'APROVADA' : 'PENDENTE'}\nAUTORIZAÇÃO DIGITAL: ${digital ? 'APROVADA' : 'AUSENTE'}\nACESSO NEGADO`;
}
export function documentosMissao(config, progress) {
  const docs = [], fabrica = progress?.fabrica === true, bruteforce = progress?.bruteforce === true;
  const auth = autenticacaoNumerica(config), ip = n => n.join('.');
  if (!fabrica) for (const categoria of ['REGISTROS', 'TOPOLOGIA', 'PROTOCOLOS', 'AUTENTICAÇÃO']) {
    docs.push([categoria, 'ACESSO BLOQUEADO · TERMINAL 01',
      'CRIPTOGRAFADO · conclua o Breach Protocol para recuperar estes dados.']);
  }
  if (!bruteforce) for (const categoria of ['REGISTROS', 'AUTENTICAÇÃO']) {
    docs.push([categoria, 'ACESSO BLOQUEADO · TERMINAL 02',
      'CRIPTOGRAFADO · conclua o BruteForce para recuperar estes dados.']);
  }
  if (fabrica) docs.push(
    ['REGISTROS', 'EV041_EDEN_NETWORK_ARCHIVE.LOG // LEVEL 5 // RESTRICTED',
      'Elias Voss · EV-041 · Engenheiro de Integridade de Sistemas\nStatus: DESAPARECIDO / FUNCIONÁRIO DESVINCULADO — INVESTIGAÇÃO ENCERRADA.\n01 · 2189.08.17 · 02:14:08\nLIFE e BIO sustentam a atividade biológica dos indivíduos no EDEN. Desligá-los seria irreversível. Solicitei uma auditoria. A AXIOM recusou e apagou o relatório quatro minutos depois.\n02 · 2189.08.19 · 23:41:12\nDefesas e sistemas vitais usam rotas independentes. Podemos neutralizar a segurança sem interromper o EDEN. Dividi a arquitetura entre dois terminais. Procurem a estação industrial em (-378, -2996).\n03 · ARQUIVO CORROMPIDO\nA AXIOM afirma impedir novas guerras. Por que precisa censurar a palavra [LIBERDADE]? [DADOS REMOVIDOS] [ACESSO INTERROMPIDO]'],
    ['TOPOLOGIA', 'Inventário de servidores', config.nodes.filter(n => ['CORE', 'SEC', 'LIFE', 'BIO'].includes(n.tipo)).map(n => `${n.id}: ${n.tipo}`).join('\n')],
    ['PROTOCOLOS', 'Identificação e integridade', 'CORE = PROCESSAMENTO CENTRAL. SEC = SEGURANÇA. LIFE = SUPORTE VITAL. BIO = CONTROLE BIOLÓGICO.\nIsole apenas os dois módulos SEC. LIFE e BIO devem continuar ativos. Elias confirmou que separar as defesas não exige desligar a infraestrutura vital.'],
    ['AUTENTICAÇÃO', 'Selo da arquitetura // último fragmento', `O selo ${config.cauda} é o TERCEIRO e último fragmento da autorização. Os dois anteriores estão no arquivo LEVEL 7, preservados no terminal EV-041.`]);
  if (fabrica && progress?.registro === true) docs.push(['PROTOCOLOS', 'Bônus do Breach // auditoria de Elias',
    `PROCESSAMENTO CENTRAL: ${config.core}\nSEGURANÇA: ${config.seguranca.join(' / ')}\nLIFE e BIO: preservar integralmente. Não é necessário alterar conexões ou desligar servidores vitais.`]);
  if (bruteforce) docs.push(
    ['REGISTROS', 'EV041_ESCAPE_PROTOCOL.DAT // LEVEL 7 // CRITICAL',
      '04 · 2189.08.21 · 01:02:55\nOs antigos engenheiros desapareceram porque reuniram os fragmentos. Cada setor só conhece sua própria função. Eu reuni os arquivos. Separem as defesas sem interromper LIFE e BIO.\n05 · 2189.08.21 · 01:16:33\nRecuperem a identidade do núcleo, preservem o EDEN e reconstruam a autorização. A assinatura foi dividida entre minha chave local e o selo da arquitetura. Depois procurem o endereço do host no fluxo numérico.\n06 · 2189.08.21 · 01:19:04\nRevogaram minhas credenciais. As portas estão bloqueadas. Vou tentar a saída de manutenção. O EDEN não é um refúgio. É uma prisão que aprenderam a chamar de realidade.\n[ATIVIDADE NÃO AUTORIZADA DETECTADA] [SESSÃO ENCERRADA]'],
    ['AUTENTICAÇÃO', 'Credencial local recuperada // ordenação', `Autorização digital: APROVADA\nHost legítimo: ${config.host}\nTARGET HOST: ${ip(auth.host)}\nRegistro físico: ${config.registroFisico}\nORDEM DA AUTORIZAÇÃO:\n1º: ${config.chave[0]}\n2º: ${config.chave[1]}\n3º: selo da arquitetura no arquivo LEVEL 5.\nOs fragmentos devem ser usados nessa ordem. O endereço acima é usado depois dos três arquivos recuperados.`]);
  return docs;
}
