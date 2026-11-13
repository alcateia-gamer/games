import { cenaSomCompartilhado } from "../multiplayer/CoopAudio.js";

const CHAVE = "boss-explosao-pulso";
const AFINACAO = -200;

export function carregarSomExplosaoPulsoBoss(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/EXPLOSAO_DE_VENTO_BOSS.mp3");
}

/** Começa no zero do aviso, junto à explosão, sem modificar a animação. */
export function tocarSomExplosaoPulsoBoss(scene, origem, atrasoMs = 0) {
  if (!scene.cache?.audio?.exists(CHAVE) || !scene.sound?.add) return;
  const seek = Math.max(0, atrasoMs) / 1000 * 2 ** (AFINACAO / 1200);
  const duracao = scene.cache.audio.get?.(CHAVE)?.duration;
  if (duracao > 0 && seek >= duracao) return;
  const fonte = cenaSomCompartilhado(scene, { x: origem.x, y: origem.y }, { range: 1400 });
  const som = fonte.sound.add(CHAVE);
  let encerrado = false;
  const limpar = () => {
    if (encerrado) return;
    encerrado = true;
    scene.events.off("shutdown", limpar);
    som.stop(); som.destroy();
  };
  som.once("complete", limpar);
  scene.events.once("shutdown", limpar);
  if (som.play({ volume: 0.55, loop: false, rate: 1, detune: AFINACAO, seek }) === false) limpar();
}
