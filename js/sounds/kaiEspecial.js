import { cenaSomCompartilhado } from "../multiplayer/CoopAudio.js";

const CHAVE = "kai-especial";

export function carregarSomEspecialKai(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/ESPECIAL_KAI.mp3");
}

/** Começa junto à abertura da barreira e acompanha o Kai que a ativou. */
export function tocarSomEspecialKai(scene) {
  if (!scene.cache?.audio?.exists(CHAVE)) return;
  const fonte = cenaSomCompartilhado(scene, scene.player, { range: 800, curve: "linear" });
  fonte.sound?.play(CHAVE, { volume: 0.2, loop: false });
}
