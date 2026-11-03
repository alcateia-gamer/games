/** Alvos de encontros próprios, sem inseri-los nas listas de robôs ou no boss antigo. */
export function alvosAdicionaisCombate(scene) {
  // O encontro só participa do combate solo até receber protocolo de rede próprio.
  if (scene?.multiplayer) return [];
  const encontro = scene?.novoBoss;
  if (encontro?.encerrado || encontro?.morto || encontro?.suspenso ||
      encontro?.jogadorNaArena === false) return [];
  return [encontro, ...(encontro?.alvosIlusorios ?? [])].filter(alvo =>
    alvo?.active && alvo.visible !== false && !alvo.morto &&
    alvo.body?.enable !== false && alvo.vida > 0 && alvo.hitboxDano);
}

export function eAlvoAdicionalCombate(scene, alvo) {
  return !!alvo && (alvo === scene?.novoBoss ||
    (scene?.novoBoss?.alvosIlusorios ?? []).includes(alvo));
}

/** O próprio encontro decide vulnerabilidade, vida e efeitos de um acerto. */
export function causarDanoAlvoAdicional(scene, alvo, quantidade, regiaoAtaque = null) {
  if (!eAlvoAdicionalCombate(scene, alvo) || !alvosAdicionaisCombate(scene).includes(alvo)) {
    return false;
  }
  return alvo.receberDano?.(quantidade, regiaoAtaque) === true;
}
