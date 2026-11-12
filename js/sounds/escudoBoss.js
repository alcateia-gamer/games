import { cenaSomCompartilhado } from "../multiplayer/CoopAudio.js";
const CHAVE = "boss-escudo-quebrado";

export function carregarSomEscudoBoss(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/escudo-quebrado.mp3");
}

export function criarSomEscudoBoss(scene) {
  const originalScene = scene;
  scene = cenaSomCompartilhado(scene, () => originalScene.novoBoss?.sprite ?? originalScene.player, { range: 1400 });
  let som = null;
  let destruido = false;
  return {
    tocar() {
      if (destruido || !scene.cache?.audio?.exists(CHAVE) || !scene.sound?.add) return;
      som ??= scene.sound.add(CHAVE, { volume: 0.35, loop: false });
      som.play({ volume: 0.35, loop: false, rate: 1, detune: 0, seek: 0 });
    },
    destruir() {
      if (destruido) return;
      destruido = true;
      som?.stop();
      som?.destroy();
      som = null;
    },
  };
}
