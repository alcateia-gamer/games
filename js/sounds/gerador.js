/**
 * @file Som localizado do gerador: partida completa uma vez, seguida do motor em loop.
 */

const GENERATOR_SOUND_KEY = "gerador-diesel";
const GENERATOR_MAX_VOLUME = 0.8;
// Distância em pixels a partir da área gerador01 (7,5 tiles de 48 px).
const GENERATOR_SOUND_RANGE = 360;
const GENERATOR_LOOP_START_SECONDS = 5;

function carregarSomGerador(loader) {
  loader.audio(GENERATOR_SOUND_KEY, "sounds.mp3/gerador_diasel.mp3");
}

function criarSomGerador(scene) {
  if (!scene.cache?.audio?.exists(GENERATOR_SOUND_KEY)) {
    return { update() {}, getStartupProgress: () => null, destroy() {} };
  }

  const sound = scene.sound.add(GENERATOR_SOUND_KEY, { volume: 0 });
  // Ao voltar à fábrica já energizada, não repete a partida do gerador.
  let playStartup = !scene.luzFabricaAcesa;
  let volume = 0;
  const loopStart = Math.min(
    GENERATOR_LOOP_START_SECONDS,
    Math.max(0, sound.totalDuration - 0.1),
  );
  sound.addMarker({
    name: "motor",
    start: loopStart,
    duration: sound.totalDuration - loopStart,
    config: { loop: true, volume: 0 },
  });

  const playMotor = () => {
    if (scene.luzFabricaAcesa) sound.play("motor", { volume });
  };
  sound.on("complete", playMotor);

  return {
    getStartupProgress() {
      if (playStartup) return 0;
      if (sound.currentMarker?.name === "motor" || loopStart === 0) return 1;
      return Math.max(0, Math.min(1, sound.seek / loopStart));
    },
    update(distance) {
      if (!scene.luzFabricaAcesa) {
        sound.stop();
        playStartup = true;
        return;
      }

      const proximity = Math.max(0, 1 - distance / GENERATOR_SOUND_RANGE);
      // A curva suaviza a queda e chega a silêncio total fora da sala e arredores.
      volume = GENERATOR_MAX_VOLUME * proximity * proximity;
      sound.setVolume(volume);

      // O motor usa a mesma fase da partida, inclusive para quem se aproxima depois.
      const startedAt = scene.multiplayerManager?.room?.coopProgress?.generatorStartedAt;
      if ((scene.multiplayer || scene.coopRuntime) && Number.isFinite(startedAt)) {
        if (sound.isPaused || !sound.isPlaying && volume === 0) return;
        const agora = scene.coopAudio?.hostTime() ?? Date.now();
        const tempo = Math.max(0, (agora - startedAt) / 1000);
        const motor = tempo >= loopStart;
        const duracao = sound.totalDuration - loopStart;
        const seek = motor && duracao > 0 ? (tempo - loopStart) % duracao : tempo;
        const noMotor = sound.currentMarker?.name === "motor";
        let desvio = Math.abs(sound.seek - seek);
        if (motor && noMotor && duracao > 0) desvio = Math.min(desvio, Math.abs(duracao - desvio));
        if (!sound.isPlaying || noMotor !== motor || desvio > 0.15) {
          const tocou = motor ? sound.play("motor", { volume, seek })
            : sound.play({ volume, loop: false, seek });
          if (tocou) playStartup = false;
        }
        return;
      }

      // Mantém a reprodução silenciosa à distância, sem reiniciar ao voltar.
      if (sound.isPlaying || sound.isPaused || volume === 0) return;
      if (playStartup) {
        // A primeira reprodução começa do zero; só as repetições pulam a partida.
        if (sound.play({ volume, loop: false, seek: 0 })) playStartup = false;
      } else {
        playMotor();
      }
    },
    destroy() {
      sound.off("complete", playMotor);
      sound.destroy();
    },
  };
}

export { GENERATOR_LOOP_START_SECONDS, carregarSomGerador, criarSomGerador };
