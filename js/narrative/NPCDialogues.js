// Conteúdo local: não integra o estado autoritativo da economia.
export const NPC_NAME = 'SUCATEIRO // AXIOM';
const exchange = (npc, player, end = 'Tenho componentes recuperados. Vamos ver o que serve em você.') => [
  { speaker: 'npc', text: npc }, { speaker: 'player', text: player }, { speaker: 'npc', text: end },
];
export const NPC_DIALOGUES = {
  'kai-mercer': {
    first: exchange('Olha só... alguém que ainda não virou sucata. Kai Mercer, certo? Esse refletor já viu dias melhores.', 'Sabe meu nome demais para um desconhecido. Mostre as peças. Eu testo o refletor.'),
    recurring: [
      exchange('Mais projéteis devolvidos ao remetente, Kai?', 'Enquanto meu escudo resistir. Tem algo confiável?'),
      exchange('Trouxe marcas novas no refletor.', 'Antes nele do que em mim. Preciso reforçá-lo.'),
      exchange('A AXIOM anda gastando munição com você.', 'Quero garantir que ela receba tudo de volta.'),
      exchange('Ainda não confia na minha bancada?', 'Confio nos resultados. Mostre o que mudou.'),
    ],
  },
  nyx: {
    first: exchange('Nyx... suas rotinas de cura estão mantendo muita gente de pé.', 'E cada pulso deixa um rastro. Preciso de eficiência sem comprometer nossa assinatura.'),
    recurring: [
      exchange('Como está o campo de cura?', 'Estável. Mas podemos reduzir o desperdício de energia.'),
      exchange('Encontrei um circuito médico quase intacto.', 'Quase não basta. Vou verificar o isolamento antes de instalar.'),
      exchange('Você conserta gente. Eu conserto máquinas.', 'Então sabe que diagnóstico vem antes de qualquer intervenção.'),
      exchange('Mais uma equipe salva, Nyx?', 'Ainda há trabalho. Vamos melhorar a recuperação.'),
    ],
  },
  'aria-kade': {
    first: exchange('Aria. Arco, clones e teleporte... você nunca entra pela porta?', 'Só quando ela merece. Tem melhoria para mim ou só decoração enferrujada?'),
    recurring: [
      exchange('Esse é seu corpo de verdade ou um clone?', 'Se fosse o clone, já teria conseguido um desconto.'),
      exchange('Seu arco precisa de ajuste.', 'E sua simpatia também. Vamos começar pelo arco.'),
      exchange('Não se teleporte para dentro da bancada.', 'Relaxa. Meu clone ficou responsável por esse desastre.'),
      exchange('As flechas estão encontrando o alvo?', 'Sempre. Quero que o alvo tenha menos tempo para reclamar.'),
    ],
  },
  'magnus-force': {
    first: exchange('Magnus. Essa marreta parece capaz de derrubar a oficina.', 'Então seja rápido. Preciso de mais impacto, não de conversa.'),
    recurring: [
      exchange('Amassou outra patrulha?', 'Duas. Reforce a marreta.'),
      exchange('Tenho um amplificador de impacto.', 'Instale. Quero atingir o grupo inteiro.'),
      exchange('Seu equipamento está pedindo descanso.', 'Ele descansa quando a AXIOM cair.'),
      exchange('Pode deixar a marreta fora do balcão?', 'Pode trabalhar mais rápido?'),
    ],
  },
};
export const SHOP_LINES = {
  purchase: 'Instalado. Faça essa sucata valer a pena lá fora.',
  insufficient: 'Sem sucata, sem milagre. Recupere mais componentes.',
  maximum: 'Tudo no limite. Agora só falta você acompanhar a máquina.',
  goodbye: 'Volte inteiro. Peças de reposição não fazem milagres.',
  unavailable: 'O terminal perdeu a conexão. Tente novamente.',
};
export function selectConversation(character, history, random = Math.random) {
  const content = NPC_DIALOGUES[character] || NPC_DIALOGUES['kai-mercer'];
  const record = history[character] ||= { met: false, last: -1 };
  if (!record.met) { record.met = true; return content.first; }
  const choices = content.recurring.map((_, i) => i).filter(i => i !== record.last);
  record.last = choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
  return content.recurring[record.last];
}
