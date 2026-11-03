import { criarPuxaoNovoBoss, atualizarPuxaoNovoBoss } from "../enemies/novoBoss/NovoBossPuxao.js";

/** Contenção por fonte: nunca altera bloqueios de menu, morte ou outros sistemas. */
export function jogadorPresoNovoBoss(scene) {
  const restricao = scene?.restricaoControleNovoBoss;
  return Boolean(restricao && (restricao.restanteMs > 0 || restricao.apertosNecessarios > 0) &&
    scene.player?.active && !scene.morteEmAndamento && (scene.vida ?? 1) > 0);
}

export function capturarJogadorNovoBoss(scene, fonte, duracaoMs, ponto = null, opcoes = {}) {
  if (!scene?.player?.active || scene.morteEmAndamento || scene.multiplayer ||
      (scene.vida ?? 1) <= 0 || jogadorPresoNovoBoss(scene) ||
      !Number.isFinite(duracaoMs) || duracaoMs <= 0 ||
      (scene.player.novoBossRecapturaAte ?? 0) > (scene.time?.now ?? 0)) return false;
  const puxao = ponto ? criarPuxaoNovoBoss(scene, ponto) : null;
  if (ponto && !puxao) return false;
  scene.restricaoControleNovoBoss = { fonte, restanteMs: duracaoMs, ...(puxao ? { puxao } : {}) };
  if (opcoes.apertos > 0) Object.assign(scene.restricaoControleNovoBoss, {
    restanteMs: null, apertos: 0, apertosNecessarios: Math.max(6, Math.min(10, Math.round(opcoes.apertos))),
  });
  if (scene.estadoDash) scene.estadoDash.ativo = false;
  scene.player.setVelocity?.(0, 0);
  scene.attackBufferedUntil = 0;
  return true;
}

/** Conta comandos de entrada, nunca frames de um botão segurado ou ataques automáticos. */
export function registrarApertoLibertacaoNovoBoss(scene) {
  const restricao = scene?.restricaoControleNovoBoss;
  if (!jogadorPresoNovoBoss(scene) || !(restricao.apertosNecessarios > 0)) return false;
  restricao.apertos++;
  if (restricao.apertos >= restricao.apertosNecessarios) {
    scene.player.novoBossRecapturaAte = (scene.time?.now ?? 0) + 600;
    liberarJogadorNovoBoss(scene, restricao.fonte);
  }
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
  const restricao = scene.restricaoControleNovoBoss;
  if (restricao.puxao && !atualizarPuxaoNovoBoss(scene, restricao.puxao,
      restricao.apertosNecessarios ? delta : Math.min(delta, restricao.restanteMs))) {
    liberarJogadorNovoBoss(scene, restricao.fonte);
    return;
  }
  if (restricao.apertosNecessarios > 0) return;
  scene.restricaoControleNovoBoss.restanteMs -= delta;
  if (scene.restricaoControleNovoBoss.restanteMs <= 0) liberarJogadorNovoBoss(scene);
}
