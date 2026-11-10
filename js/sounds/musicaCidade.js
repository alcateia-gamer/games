import { iniciarMusicaAmbiente } from "./musicaAmbiente.js";

const CHAVE = "musica-cidade";

export function carregarMusicaCidade(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS AMBIENETE/01 - The Street of Rage.mp3");
}

export function iniciarMusicaCidade(scene) {
  // Frases equivalentes antes do encerramento da gravação, separadas por 19,2 s.
  return iniciarMusicaAmbiente(scene, { chave: CHAVE, volumeMaximo: 0.06,
    trechoLoop: { nome: "cidade-continua", inicio: 43.2, fim: 62.4 } });
}
