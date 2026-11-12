/** Referência única para atributos e ataques básicos nos dois modos. */
export const DANO_BASICO_PADRAO = 25;
export const CUSTO_ATAQUE_BASICO = 20;
const PERSONAGENS = Object.freeze({
  "kai-mercer": { vida: 100, percentual: 100, solo: 7, multiplayer: 6 },
  "magnus-force": { vida: 115, percentual: 133.2, solo: 6, multiplayer: 5 },
  "aria-kade": { vida: 85, percentual: 100, solo: 8, multiplayer: 7 },
  nyx: { vida: 95, percentual: 112, solo: 8, multiplayer: 6 },
});
export function obterBalanceamento(personagem, multiplayer = false) {
  const config = PERSONAGENS[personagem] ?? PERSONAGENS["kai-mercer"];
  return { vida: config.vida, dano: DANO_BASICO_PADRAO * config.percentual / 100,
    custoAtaque: CUSTO_ATAQUE_BASICO,
    estamina: CUSTO_ATAQUE_BASICO * (multiplayer ? config.multiplayer : config.solo) };
}
