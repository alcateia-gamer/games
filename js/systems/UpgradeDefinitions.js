/** Valores acumulados, nunca somados entre níveis. Custos são por instalação. */
const module = (id, name, region, stat, values, prices, description, category = 'cyber') =>
  Object.freeze({ id, name, region, stat, values: Object.freeze([0, ...values]), prices: Object.freeze(prices), description, category, max: 3 });
export const CHARACTER_NAMES = Object.freeze({ 'kai-mercer': 'Kai Mercer', 'magnus-force': 'Magnus', 'aria-kade': 'Aria', nyx: 'Nyx' });
export const CYBERNETICS = Object.freeze([
  module('muscle', 'REFORÇO MUSCULAR', 'Braços', 'melee', [.05,.10,.15], [8,14,22], 'Amplifica o dano corpo a corpo. Não altera flechas.'),
  module('health', 'REGULADOR BIOSSINTÉTICO', 'Tronco', 'health', [.05,.10,.15], [8,14,22], 'Amplia a vida máxima preservando a proporção de vida atual.'),
  module('motor', 'ATUADORES NEURAIS', 'Pernas', 'speed', [.03,.06,.09], [9,15,23], 'Aumenta a velocidade de caminhada com os limites físicos originais.'),
  module('processor', 'PROCESSADOR DE COMBATE', 'Cabeça', 'cooldown', [.05,.10,.15], [10,17,25], 'Reduz a recarga real da habilidade especial.'),
  module('armor', 'BLINDAGEM SUBDÉRMICA', 'Tronco', 'armor', [.03,.06,.09], [10,17,25], 'Absorve parte do dano recebido, uma única vez por acerto.'),
]);
const weapon = (name, stat = 'weapon') => module('weapon', name, 'Braços', stat, [.06,.12,.18], [10,18,28], stat === 'healing' ? 'Aumenta a cura de cada pulso da aura, preservando dez pulsos e o limite de vida.' : 'Aumenta o dano da arma original sem alterar animações ou alcance.', 'weapon');
const special = (name, values, stat, description) => module('special', name, 'Sistema neural', stat, values, [10,17,25], description, 'special');
const PERSONAL = Object.freeze({
  'kai-mercer': [weapon('SISTEMA DE COMBATE'), special('REFLEXO NEURAL', [.02,.04,.06], 'recovery', 'Reduz a recuperação do domo e amplia o dano refletido em 4% / 8% / 12%. Duração e raio permanecem limitados.')],
  'magnus-force': [weapon('MARRETA ATLAS'), special('IMPACTO SÍSMICO', [.05,.10,.15], 'impact', 'Amplifica o dano da onda sísmica, preservando alcance e duração.')],
  'aria-kade': [weapon('ARCO DE PRECISÃO'), special('PROJEÇÃO FANTASMA', [.05,.10,.15], 'clone', 'Amplia a duração do único holograma e a janela de teleporte.')],
  nyx: [weapon('NÚCLEO DE RESTAURAÇÃO', 'healing'), special('ESTABILIZADOR NEURAL', [.03,.06,.09], 'recovery', 'Reduz a recarga da aura de cura sem ampliar o número de pulsos.')],
});
export function upgradeDefinitions(character) { return [...CYBERNETICS.filter(d => character !== 'aria-kade' || d.id !== 'muscle'), ...(PERSONAL[character] ?? PERSONAL['kai-mercer'])]; }
