/** Contenção por fonte: nunca altera bloqueios de menu, morte ou outros sistemas. */
export function jogadorPresoNovoBoss(scene) {
  return Boolean(scene?.restricaoControleNovoBoss?.restanteMs > 0 &&
    scene.player?.active && !scene.morteEmAndamento && (scene.vida ?? 1) > 0);
}

export function capturarJogadorNovoBoss(scene, fonte, duracaoMs) {
  if (!scene?.player?.active || scene.morteEmAndamento || scene.multiplayer ||
      (scene.vida ?? 1) <= 0 || jogadorPresoNovoBoss(scene) ||
      !Number.isFinite(duracaoMs) || duracaoMs <= 0) return false;
  scene.restricaoControleNovoBoss = { fonte, restanteMs: duracaoMs };
  if (scene.estadoDash) scene.estadoDash.ativo = false;
  scene.player.setVelocity?.(0, 0);
  return true;
}

export function liberarJogadorNovoBoss(scene, fonte = null) {
  if (!scene?.restricaoControleNovoBoss ||
      (fonte !== null && scene.restricaoControleNovoBoss.fonte !== fonte)) return;
  scene.restricaoControleNovoBoss = null;
}

export function atualizarRestricaoNovoBoss(scene, delta) {
  if (!scene?.restricaoControleNovoBoss) return;
  if (!scene.player?.active || scene.morteEmAndamento || (scene.vida ?? 1) <= 0 ||
      scene.novoBoss?.morto || scene.novoBoss?.encerrado || !scene.novoBoss?.jogadorNaArena) {
    liberarJogadorNovoBoss(scene);
    return;
  }
  if (!Number.isFinite(delta) || delta < 0) return;
  scene.restricaoControleNovoBoss.restanteMs -= delta;
  if (scene.restricaoControleNovoBoss.restanteMs <= 0) liberarJogadorNovoBoss(scene);
}
