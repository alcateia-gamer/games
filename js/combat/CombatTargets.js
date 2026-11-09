/** Alvos de encontros próprios, sem inseri-los nas listas de robôs ou no boss antigo. */
export function alvosAdicionaisCombate(scene) {
  // O encontro só participa do combate solo até receber protocolo de rede próprio.
  if (scene?.multiplayer && !scene.coopRuntime) return [];
  const encontro = scene?.novoBoss;
  if (encontro?.encerrado || encontro?.morto || encontro?.suspenso ||
      encontro?.jogadorNaArena === false) return [];
  return [encontro, ...(encontro?.alvosIlusorios ?? []),
    ...(encontro?.geradores ?? []).filter(gerador => gerador.torre).sort((a, b) => a.id - b.id)].filter(alvo =>
    alvo?.active && alvo.visible !== false && !alvo.morto &&
    alvo.body?.enable !== false && alvo.vida > 0 && alvo.hitboxDano);
}

export function eAlvoAdicionalCombate(scene, alvo) {
  return !!alvo && (alvo === scene?.novoBoss ||
    (scene?.novoBoss?.alvosIlusorios ?? []).includes(alvo) ||
    (alvo.torre === true && (scene?.novoBoss?.geradores ?? []).includes(alvo)));
}

/** O próprio encontro decide vulnerabilidade, vida e efeitos de um acerto. */
export function causarDanoAlvoAdicional(scene, alvo, quantidade, regiaoAtaque = null, ataque = null) {
  if (!eAlvoAdicionalCombate(scene, alvo) || !alvosAdicionaisCombate(scene).includes(alvo)) {
    return false;
  }
  return alvo.receberDano?.(quantidade, regiaoAtaque, ataque) === true;
}

/** Resolve o mesmo impacto de área antes de fechar a exposição: uma única morte, por ID. */
export function causarDanoAreaAlvosAdicionais(scene, alvos, quantidade, regiao = null, ataque = null) {
  const validos = alvosAdicionaisCombate(scene).filter(alvo => alvos.includes(alvo));
  const torres = validos.filter(a => a.torre).sort((a, b) => a.id - b.id);
  const fatal = scene.novoBoss?.prologo?.estado === "GERADORES_EXPOSTOS"
    ? torres.find(t => t.vida <= quantidade) : null;
  const atingidos = new Set();
  // Dano não fatal dos sobreviventes é preservado, inclusive em um impacto simultâneo.
  for (const alvo of validos.filter(a => a !== fatal)) {
    const dano = fatal && alvo.torre ? Math.min(quantidade, Math.max(0, alvo.vida - 1)) : quantidade;
    if (dano > 0 && causarDanoAlvoAdicional(scene, alvo, dano, regiao, ataque)) atingidos.add(alvo);
  }
  if (fatal && causarDanoAlvoAdicional(scene, fatal, quantidade, regiao, ataque)) atingidos.add(fatal);
  return atingidos;
}
