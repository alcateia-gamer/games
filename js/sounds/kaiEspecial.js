import { cenaSomCompartilhado } from "../multiplayer/CoopAudio.js";
import { encontrarInicioPasso } from "./personagem.js";

const CHAVE = "kai-especial";
const RICOCHETE = "kai-ricochete";
const INICIOS = new WeakMap();

export function carregarSomEspecialKai(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/ESPECIAL_KAI.mp3");
  loader.audio(RICOCHETE, "sounds.mp3/SONS PARA BOTAR AINDA/ricochet-KAI.mp3");
}

/** Começa junto à abertura da barreira e acompanha o Kai que a ativou. */
export function tocarSomEspecialKai(scene) {
  if (!scene.cache?.audio?.exists(CHAVE)) return;
  const fonte = cenaSomCompartilhado(scene, scene.player, { range: 800, curve: "linear" });
  fonte.sound?.play(CHAVE, { volume: 0.2, loop: false });
}

/** Um som por mudança de direção, no ponto de contato com a barreira. */
export function tocarSomRicocheteKai(scene, ponto) {
  if (!scene.cache?.audio?.exists(RICOCHETE)) return;
  const buffer = scene.cache.audio.get?.(RICOCHETE);
  let inicio = 0;
  if (buffer?.getChannelData) {
    if (!INICIOS.has(buffer)) INICIOS.set(buffer, encontrarInicioPasso(buffer));
    inicio = INICIOS.get(buffer);
  }
  const fonte = cenaSomCompartilhado(scene, { x: ponto.x, y: ponto.y }, { range: 800 });
  fonte.sound?.play(RICOCHETE, { volume: 0.4, loop: false, ...(inicio > 0 ? {seek: inicio} : {}) });
}
