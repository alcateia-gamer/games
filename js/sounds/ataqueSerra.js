import { cenaSomCompartilhado } from "../multiplayer/CoopAudio.js";
/** O motor acompanha o ataque visual, inclusive interrupções e pausa da cena. */
const CHAVE = "robo-serra-ataque";
const PREFIXO = "robo-serra-ataque-";
const ALCANCE = 700;
const VOLUME = 0.45;
export function carregarSomAtaqueSerra(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/serra_circular.mp3");
}

export function configurarSomAtaqueSerra(scene, robo) {
  scene = cenaSomCompartilhado(scene, robo, { range: 700 });
  if (robo.tipoRobo !== "serra") return;
  let som = null, ativo = false, destruido = false;
  const volumeLocal = () => {
    const ouvinte = scene.player?.body?.center ?? scene.player;
    if (!ouvinte) return 0;
    const distancia = Math.hypot(ouvinte.x - robo.x, ouvinte.y - robo.y);
    return VOLUME * Math.max(0, 1 - distancia / ALCANCE) ** 2;
  };
  const parar = () => {
    if (!ativo) return;
    ativo = false;
    som?.stop();
  };
  const atualizar = () => {
    if (!ativo) return;
    if (!robo.active || robo.morto || scene.morteEmAndamento) {
      parar(); return;
    }
    // Só distância e posição: preserva o timbre, a velocidade e a cauda original.
    som.setVolume(volumeLocal());
    const ouvinte = scene.player?.body?.center ?? scene.player;
    som.setPan(Math.max(-0.65, Math.min(0.65, (robo.x - (ouvinte?.x ?? robo.x)) / 450)));
  };
  const iniciar = animacao => {
    if (destruido || !animacao.key.startsWith(PREFIXO)) return;
    parar();
    if (scene.morteEmAndamento || robo.morto || volumeLocal() === 0 ||
      !scene.cache?.audio?.exists(CHAVE) || !scene.sound?.add) return;
    if (!som) {
      som = scene.sound.add(CHAVE);
      som.on?.("complete", () => { ativo = false; });
    }
    // O golpe dispara o MP3 inteiro, uma vez, sem recorte, loop ou alteração de pitch.
    // A cauda termina naturalmente, mesmo após os quatro quadros da animação.
    ativo = !!som.play({ volume: volumeLocal(), loop: false,
      rate: 1, detune: 0, seek: 0 });
    atualizar();
  };
  const pausar = () => { if (ativo) som.pause(); };
  const retomar = () => { if (ativo) som.resume(); };
  const destruir = () => {
    if (destruido) return;
    destruido = true;
    parar(); som?.destroy(); som = null;
    robo.off("animationstart", iniciar);
    robo.off("animationstop", parar);
    robo.off("destroy", destruir);
    scene.events.off("update", atualizar);
    scene.events.off("pause", pausar);
    scene.events.off("resume", retomar);
    scene.events.off("shutdown", destruir);
  };
  robo.on("animationstart", iniciar);
  robo.on("animationstop", parar);
  robo.once("destroy", destruir);
  scene.events.on("update", atualizar);
  scene.events.on("pause", pausar);
  scene.events.on("resume", retomar);
  scene.events.once("shutdown", destruir);
}
