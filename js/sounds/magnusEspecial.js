import { cenaSomCompartilhado } from "../multiplayer/CoopAudio.js";

const CHAVE = "magnus-especial";

export function carregarSomEspecialMagnus(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/magnus_especial.mp3");
}

/** A onda autoritativa dispara o áudio uma vez, na posição real do impacto. */
export function tocarSomEspecialMagnus(scene, impacto) {
  if (!scene.cache?.audio?.exists(CHAVE)) return;
  const fonte = cenaSomCompartilhado(scene, impacto, { range: 800, curve: "linear" });
  fonte.sound?.play(CHAVE, { volume: 0.15, loop: false });
}
