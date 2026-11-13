import { cenaSomCompartilhado } from "../multiplayer/CoopAudio.js";
import { encontrarInicioPasso } from "./personagem.js";

const CHAVE = "boss-disparo-laser";
const TRECHO = 0.12;
const controles = new WeakMap();
const inicios = new WeakMap();

export function carregarSomDisparoBoss(loader) {
  loader.audio(CHAVE, "sounds.mp3/tiro_laser.mp3");
}

/** Mesmo laser dos robôs, com ataque curto por emissão da animação. */
export function tocarSomDisparoBoss(scene, origem, atrasoMs = 0) {
  if (!scene.cache?.audio?.exists(CHAVE) || !scene.sound?.add) return;
  const buffer = scene.cache.audio.get?.(CHAVE);
  let inicio = 0;
  if (buffer) {
    if (!inicios.has(buffer)) inicios.set(buffer, encontrarInicioPasso(buffer));
    inicio = inicios.get(buffer);
  }
  const duracao = buffer?.duration > 0 ? Math.min(TRECHO, buffer.duration - inicio) : TRECHO;
  const seek = Math.max(0, atrasoMs) / 1000;
  if (duracao <= 0 || seek >= duracao) return;
  let controle = controles.get(scene);
  if (!controle) {
    controle = { vozes: [], ultimaEmissao: -Infinity };
    controles.set(scene, controle);
    scene.events.once("shutdown", () => {
      for (const voz of [...controle.vozes]) voz.remover();
      controles.delete(scene);
    });
  }
  const emissao = (scene.time?.now ?? 0) - Math.max(0, atrasoMs);
  // Um anel simultâneo é uma rajada; não soma o mesmo ataque sonoro 28 vezes.
  if (Math.abs(emissao - controle.ultimaEmissao) < 0.01) return;
  controle.ultimaEmissao = emissao;
  while (controle.vozes.length >= 2) controle.vozes[0].remover();
  const fonte = cenaSomCompartilhado(scene, { x: origem.x, y: origem.y }, { range: 900 });
  const som = fonte.sound.add(CHAVE);
  som.addMarker({ name: "disparo-curto", start: inicio, duration: duracao });
  let encerrado = false;
  const voz = { remover() {
    if (encerrado) return;
    encerrado = true;
    controle.vozes = controle.vozes.filter(v => v !== voz);
    som.stop(); som.destroy();
  } };
  controle.vozes.push(voz);
  som.once("complete", voz.remover);
  if (som.play("disparo-curto", { volume: 0.021, loop: false, rate: 1, detune: 0, seek }) === false) voz.remover();
}
