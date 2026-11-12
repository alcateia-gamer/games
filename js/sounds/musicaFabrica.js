/** Trilha de exploração da fábrica, com a mesma entrada gradual da cidade. */
import { iniciarMusicaAmbiente } from "./musicaAmbiente.js";

const CHAVE = "musica-fabrica";
const controles = new WeakMap();

export function carregarMusicaFabrica(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS AMBIENETE/04. You Will Never Know.mp3");
}

export function iniciarMusicaFabrica(scene) {
  if (scene.coopRuntime && !scene.coopRuntime.host) return null;
  if (controles.has(scene)) return controles.get(scene);
  let musica = null, destruida = false;
  const sincronizar = () => {
    if (scene.coopRuntime && !scene.coopRuntime.host) { musica?.destruir(); musica = null; return; }
    const boss = scene.sound.get?.("musica-novo-boss");
    if ((scene.morteEmAndamento && !scene.coopRuntime) || boss?.isPlaying || boss?.isPaused) {
      musica?.destruir(); musica = null;
    } else if (!musica) {
      // Frases correspondentes, 32 compassos a 180 BPM; evita o fade final (~175 s).
      musica = iniciarMusicaAmbiente(scene, { chave: CHAVE, volumeMaximo: 0.06,
        trechoLoop: { nome: "fabrica-continua", inicio: 64 / 3, fim: 64 } });
    }
  };
  const controle = {
    destruir() {
      if (destruida) return;
      destruida = true;
      scene.events.off("update", sincronizar);
      scene.events.off("shutdown", controle.destruir);
      scene.events.off("destroy", controle.destruir);
      musica?.destruir(); musica = null;
      controles.delete(scene);
    },
  };
  controles.set(scene, controle);
  scene.events.on("update", sincronizar);
  scene.events.once("shutdown", controle.destruir);
  scene.events.once("destroy", controle.destruir);
  sincronizar();
  return controle;
}
