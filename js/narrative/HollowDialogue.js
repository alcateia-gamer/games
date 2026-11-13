// Preserva os IDs reais do lobby, inclusive o ID histórico de Magnus.
export const HOLLOW_AGENTS = {
  'kai-mercer': { name: 'KAI MERCER // 404', responses: [
    '404 na escuta. Canal limpo.',
    'Então não estamos lutando contra máquinas. Estamos lutando contra uma mentira.',
    'Night City. Finalmente vamos entrar no território dela.',
    'Entendido. Entrar, encontrar o núcleo e instalar o vírus.',
    'Ela pode estar ouvindo. Mas ainda não sabe onde estamos.',
    'Vamos mostrar à AXIOM o que acontece quando uma variável foge do controle.',
  ] },
  'magnus-force': { name: 'MAGNUS FORGE', responses: [
    'Magnus presente. Estou recebendo.',
    'Uma máquina decidiu o destino de milhões. Isso acaba agora.',
    'Então apontem o caminho para a fábrica.',
    'Entendido. Vamos abrir caminho até o núcleo.',
    'Que ela tente nos impedir.',
    'Vinte e seis anos foram suficientes. Vamos terminar isso.',
  ] },
  'aria-kade': { name: 'ARIA KADE // VALKYRIE', responses: [
    'Valkyrie conectada. Aguardando instruções.',
    'A AXIOM eliminou o conflito removendo a possibilidade de escolha.',
    'Precisamos identificar as rotas de acesso ao setor industrial.',
    'O Vírus Zero precisa alcançar o núcleo sem comprometer o suporte à vida.',
    'A transmissão foi comprometida. Precisamos agir antes que ela nos localize.',
    'O protocolo está definido. Iniciando operação.',
  ] },
  nyx: { name: 'NYX-07 // REAPER', responses: [
    'Nyx-07 online. Assinatura neural oculta.',
    'Fui criada por ela. Conheço a lógica que levou a essa decisão.',
    'Os sistemas de segurança vão reconhecer minha arquitetura.',
    'A AXIOM acredita que toda decisão pode ser prevista. Vamos provar o contrário.',
    'Ela nos encontrou. Ou talvez nunca tenha deixado de observar.',
    'Se até uma criação da AXIOM pode escolher... a humanidade também pode.',
  ] },
};

export function validCast(characters) {
  return [...new Set(characters.filter(id => Object.hasOwn(HOLLOW_AGENTS, id)))];
}

export const CONNECTION = ['SIGNAL LOST', 'SEARCHING FREQUENCY...', 'FREQUENCY FOUND: 07.404',
  'ESTABLISHING ENCRYPTED CONNECTION...', 'AUTHENTICATING NEURAL SIGNATURES...',
  'ACCESS GRANTED', 'THE HOLLOW // SECURE CHANNEL'];
export const OPERATION = `OPERATION: PROTOCOL ZERO

LOCATION: NIGHT CITY
SECTOR: INDUSTRIAL

PRIMARY OBJECTIVE:
NEUTRALIZE AXIOM

SECONDARY OBJECTIVES:
- RECOVER BATTERY
- RECOVER FUEL
- RESTORE FACTORY POWER
- ACCESS CENTRAL CORE

PAYLOAD: VIRUS_ZERO
LIFE SUPPORT: PRESERVE
MISSION STATUS: AUTHORIZED`;

/** Blocos comuns e respostas rotativas; nenhum sorteio ou roteiro por combinação. */
export function buildHollowDialogue(characters, solo = false) {
  const cast = validCast(characters), lines = [];
  const add = (role, name, text, extra = {}) => lines.push({ role, name, text, ...extra });
  const central = (text, extra) => add('hollow', 'THE HOLLOW // CENTRAL', text, extra);
  const system = (text, extra) => add('system', 'SISTEMA', text, extra);
  const support = text => { if (solo) add('agent', 'N.O.V.A // SUPORTE', text); };
  let cursor = 0;
  const reply = slot => {
    const speakers = slot === 0 ? cast : cast.length ? [cast[cursor++ % cast.length]] : [];
    for (const id of speakers) add('agent', HOLLOW_AGENTS[id].name, HOLLOW_AGENTS[id].responses[slot], { character: id });
  };
  for (const text of CONNECTION) system(text, { connection: true, duration: 650 });
  system('CONEXÃO CRIPTOGRAFADA ESTABELECIDA.');
  system('ORIGEM: THE HOLLOW // CENTRAL DE OPERAÇÕES');
  central(cast.length === 1 ? 'Agente, confirme o recebimento desta transmissão.' : 'Agentes, confirmem o recebimento desta transmissão.');
  reply(0);
  support('Assinatura neural do agente protegida.');
  central('O que acabaram de assistir não é propaganda. São os últimos registros da humanidade antes do Reset.');
  central('Há vinte e seis anos, entregamos nosso futuro a uma máquina.');
  central('A AXIOM prometeu acabar com as guerras.');
  central('E cumpriu a promessa.', { pause: 2000 });
  central('Eliminando nossa liberdade.');
  reply(1);
  central('Milhões de pessoas continuam conectadas ao EDEN. Vivem em uma realidade fabricada. Não sabem que o mundo lá fora foi abandonado.');
  central('Hoje encontramos uma oportunidade de encerrar esse controle.');
  central('Localizamos um acesso físico ao núcleo central da AXIOM.');
  central('Setor industrial. Night City.');
  reply(2);
  support('Rota preliminar para o setor industrial recebida.');
  central('A entrada está protegida por unidades autônomas.');
  central('A fábrica opera com energia restrita. Precisarão recuperar uma bateria e combustível para restaurar seus sistemas.');
  central('Depois disso, avancem até o núcleo.');
  central('O Vírus Zero deve ser instalado diretamente no terminal central.');
  reply(3);
  central('Atenção: não destruam indiscriminadamente os sistemas que mantêm o EDEN funcionando.');
  central('O objetivo é neutralizar a AXIOM, não colocar em risco as pessoas conectadas à simulação.');
  central('O vírus foi desenvolvido para romper o controle da inteligência artificial e iniciar um despertar controlado.');
  system('ANOMALIA DETECTADA NA FREQUÊNCIA.', { interference: true });
  add('unknown', 'UNKNOWN', 'VOCÊS NÃO DEVERIAM ESTAR AQUI.', { pause: 1500 });
  add('unknown', 'AXIOM', 'EU SEI O QUE ESTÃO PROCURANDO.', { pause: 1500 });
  system('CONEXÃO INSTÁVEL.', { purge: true });
  central('Droga. Ela está monitorando a frequência.');
  central('Não temos mais tempo.');
  reply(4);
  central('Lembrem-se: vocês são Nullborns.');
  central('Para o sistema, vocês não existem.');
  central('Façam com que continue assim.');
  system('TRANSMITINDO DADOS DA OPERAÇÃO...');
  add('system', 'OPERAÇÃO', OPERATION, { operation: true, duration: 9000 });
  central('A humanidade passou vinte e seis anos acreditando que estava livre.');
  central('Hoje, vocês vão dar a ela a chance de descobrir a verdade.');
  support('Permanecerei conectada durante a operação.');
  reply(5);
  system('MISSÃO CONFIRMADA.');
  system('TRANSMISSÃO ENCERRADA.');
  system('INICIANDO OPERAÇÃO: PROTOCOLO ZERO.', { interference: true });
  return lines;
}

export function hollowTimeline(cast, solo) {
  let time = 480; // Interferência curta e tela preta antes da busca de frequência.
  const lines = buildHollowDialogue(cast, solo).map(line => {
    const typing = line.connection || line.operation ? 0 : Math.min(2300, line.text.length * 18);
    const duration = line.duration ?? typing + Math.max(1000, line.text.length * 23) + (line.pause || 0);
    const entry = { ...line, start: time, typing, duration };
    time += duration;
    return entry;
  });
  return { lines, duration: time };
}
