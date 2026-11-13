import { cenaSomCompartilhado } from "../multiplayer/CoopAudio.js";
import { encontrarInicioPasso } from "./personagem.js";

const INVOCACAO = "aria-especial";
const PASSOS = "aria-clone-passos";
const ALCANCE = 600;
const ALCANCE_PASSOS = 900;
const DISTANCIA_PASSOS_PROXIMOS = 225;
const VOLUME_PASSOS = 0.65;

export function carregarSomEspecialAria(loader) {
  loader.audio(INVOCACAO, "sounds.mp3/SONS PARA BOTAR AINDA/ESPECIAL_ARIA.mp3");
  loader.audio(PASSOS, "sounds.mp3/running.mp3");
}

/** Troca: áudio inteiro a 2×, independente do clone consumido. */
export function tocarSomTrocaAria(scene, destino) {
  if (!scene.sound?.add || !scene.cache?.audio?.exists(INVOCACAO)) return;
  const fonte = cenaSomCompartilhado(scene, { x: destino.x, y: destino.y },
    { range: ALCANCE, curve: "linear" });
  const som = fonte.sound.add(INVOCACAO);
  let encerrado = false;
  const limpar = () => {
    if (encerrado) return;
    encerrado = true;
    scene.events.off("shutdown", limpar);
    som.destroy();
  };
  som.once("complete", limpar);
  scene.events.once("shutdown", limpar);
  if (!som.play({ volume: 0.5, rate: 2, loop: false, seek: 0 })) limpar();
}

/** Invocação no nascimento; passos pertencem ao clone, com posição e vida próprias. */
export function iniciarSomCloneAria(scene, clone) {
  if (!scene.sound?.add || !scene.cache?.audio?.exists(INVOCACAO)) return;
  const fonte = cenaSomCompartilhado(scene, clone, { range: ALCANCE, curve: "linear" });
  const fontePassos = cenaSomCompartilhado(scene, clone,
    { range: ALCANCE_PASSOS, near: DISTANCIA_PASSOS_PROXIMOS, curve: "nearfield" });
  const invocacao = fonte.sound.add(INVOCACAO);
  const passos = scene.cache.audio.exists(PASSOS) ? fontePassos.sound.add(PASSOS, { loop: true }) : null;
  const inicioPasso = encontrarInicioPasso(passos?.audioBuffer);
  let ultimoMovimento = -Infinity;
  let x = clone.x, y = clone.y, encerrado = false;
  const volume = (base, alcance = ALCANCE) => {
    if (scene.coopAudio) return base; // A ponte aplica distância para cada jogador.
    const ouvinte = scene.player?.body?.center ?? scene.player;
    const d = Math.hypot(clone.x - ouvinte.x, clone.y - ouvinte.y);
    if (alcance === ALCANCE_PASSOS) {
      const afastamento = Math.max(0, d - DISTANCIA_PASSOS_PROXIMOS);
      return base * Math.max(0, 1 - afastamento / (alcance - DISTANCIA_PASSOS_PROXIMOS)) ** 2;
    }
    return base * Math.max(0, 1 - d / alcance) ** 2;
  };
  invocacao.play({ volume: volume(0.5), loop: false });
  const atualizar = () => {
    if (!clone.active || scene.morteEmAndamento) { limpar(); return; }
    if (Math.hypot(clone.x - x, clone.y - y) > 0.05) ultimoMovimento = scene.time.now;
    const andando = !clone.parado && scene.time.now - ultimoMovimento <= 120;
    x = clone.x; y = clone.y;
    invocacao.setVolume(volume(0.5));
    if (!passos) return;
    if (andando) {
      const ganho = volume(VOLUME_PASSOS, ALCANCE_PASSOS);
      if (!passos.isPlaying) passos.play({ volume: ganho, loop: true, seek: inicioPasso });
      else passos.setVolume(ganho);
      if (!scene.coopAudio) passos.setPan?.(Math.max(-0.65,
        Math.min(0.65, (clone.x - scene.player.x) / 550)));
    } else if (passos.isPlaying) passos.stop();
  };
  const limpar = () => {
    if (encerrado) return;
    encerrado = true;
    scene.events.off("postupdate", atualizar);
    scene.events.off("shutdown", limpar);
    clone.off?.("destroy", limpar);
    invocacao.stop(); invocacao.destroy();
    passos?.stop(); passos?.destroy();
  };
  scene.events.on("postupdate", atualizar);
  scene.events.once("shutdown", limpar);
  clone.once?.("destroy", limpar);
  return limpar;
}
