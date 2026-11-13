import { cenaSomCompartilhado } from "../multiplayer/CoopAudio.js";

const CHAVE = "boss-impacto-chuva";
const controles = new WeakMap();
const MAX_VOZES = 4;

export function carregarSomImpactoChuvaBoss(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/EXPLOSAO_BOSS.mp3");
}

/** Um disparo por impacto. Frames atrasados entram na fase correta do áudio. */
export function tocarSomImpactoChuvaBoss(scene, ponto, atrasoMs = 0) {
  if (!scene.cache?.audio?.exists(CHAVE) || !scene.sound?.add) return;
  const seek = Math.max(0, atrasoMs) / 1000;
  const duracao = scene.cache.audio.get?.(CHAVE)?.duration;
  if (duracao > 0 && seek >= duracao) return;
  let controle = controles.get(scene);
  if (!controle) {
    controle = { vozes: [] };
    controles.set(scene, controle);
    scene.events.once("shutdown", () => {
      for (const voz of [...controle.vozes]) voz.remover();
      controles.delete(scene);
    });
  }
  // Preserva os impactos mais recentes sem empilhar uma voz por frame/míssil.
  while (controle.vozes.length >= MAX_VOZES) controle.vozes[0].remover();
  const fonte = cenaSomCompartilhado(scene, { x: ponto.x, y: ponto.y }, { range: 1200 });
  const som = fonte.sound.add(CHAVE);
  let encerrado = false;
  const voz = { remover() {
    if (encerrado) return;
    encerrado = true;
    controle.vozes = controle.vozes.filter(v => v !== voz);
    som.stop(); som.destroy();
  } };
  controle.vozes.push(voz);
  som.once("complete", voz.remover);
  if (som.play({ volume: 0.4, loop: false, rate: 1, detune: 0, seek }) === false) voz.remover();
}
