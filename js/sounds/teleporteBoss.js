import { cenaSomCompartilhado } from "../multiplayer/CoopAudio.js";

const CHAVE = "boss-teleporte";

export function carregarSomTeleporteBoss(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/TELEPORT.mp3");
}

/** Um áudio por viagem, começando junto ao desaparecimento do boss. */
export function tocarSomTeleporteBoss(scene, origem) {
  if (!scene.cache?.audio?.exists(CHAVE) || !scene.sound?.add) return;
  const fonte = cenaSomCompartilhado(scene, { x: origem.x, y: origem.y }, { range: 1400 });
  const som = fonte.sound.add(CHAVE);
  som.addMarker({ name: "inicio-teleporte", start: 0, duration: 1.7 });
  let encerrado = false;
  const limpar = () => {
    if (encerrado) return;
    encerrado = true;
    scene.events.off("shutdown", limpar);
    som.stop(); som.destroy();
  };
  som.once("complete", limpar);
  scene.events.once("shutdown", limpar);
  if (som.play("inicio-teleporte", { volume: 0.15, loop: false, rate: 1, detune: 0, seek: 0 }) === false) limpar();
}
