/** Entrada compartilhada das trilhas dos mapas, sincronizada ao relógio do áudio. */
const SILENCIO_INICIAL_MS = 500;
const DURACAO_ENTRADA_MS = 6000;
const controles = new WeakMap();
export const DURACAO_SAIDA_MUSICA_MS = 1800;

/** A apresentação do boss dirige a saída pelo progresso da câmera. */
export function atualizarSaidaMusicaAmbiente(scene, progresso) {
  for (const controle of controles.get(scene)?.values() ?? []) controle.sair(progresso);
}

export function retomarMusicaAmbiente(scene) {
  for (const controle of controles.get(scene)?.values() ?? []) controle.retomar();
}

/** A troca de mapa mantém a cena viva até terminar esta saída. */
export function desvanecerMusicaAmbiente(scene) {
  if (!controles.get(scene)?.size) return;
  const estado = { progresso: 0 };
  atualizarSaidaMusicaAmbiente(scene, 0);
  scene.tweens.add({ targets: estado, progresso: 1, duration: DURACAO_SAIDA_MUSICA_MS,
    onUpdate: () => atualizarSaidaMusicaAmbiente(scene, estado.progresso),
    onComplete: () => atualizarSaidaMusicaAmbiente(scene, 1) });
}

export function iniciarMusicaAmbiente(scene, { chave, volumeMaximo = 0.06, trechoLoop = null }) {
  if (scene.coopRuntime && !scene.coopRuntime.host) return null;
  const sonsCena = controles.get(scene) ?? new Map();
  if (sonsCena.has(chave)) return sonsCena.get(chave);
  if (!scene.cache?.audio?.exists(chave)) return null;
  const musica = scene.sound.add(chave, { volume: 0, loop: true });
  let destruida = false;
  let entradaVolume = null;
  let inicioEntradaAudio = null;
  let volumeInicioSaida = null;
  let volumeSaida = null;
  function programarVolumeAudio() {
    const contexto = musica.manager.context;
    const ganho = musica.volumeNode.gain;
    const agora = contexto.currentTime;
    const duracao = DURACAO_ENTRADA_MS / 1000;
    const pAtual = Math.max(0, Math.min(1, (agora - inicioEntradaAudio) / duracao));
    ganho.cancelScheduledValues(agora);
    ganho.setValueAtTime(volumeMaximo * pAtual * pAtual * (3 - 2 * pAtual), agora);
    if (agora < inicioEntradaAudio) ganho.setValueAtTime(0, inicioEntradaAudio);
    for (let i = 1; i <= 32; i++) {
      const p = i / 32;
      const instante = inicioEntradaAudio + p * duracao;
      if (instante > agora) ganho.linearRampToValueAtTime(volumeMaximo * p * p * (3 - 2 * p), instante);
    }
    // Preserva o teto nas retomadas do Phaser; a rampa controla o ganho audível.
    musica.currentConfig.volume = volumeMaximo;
  }
  function retomarEntrada() {
    if (!destruida && volumeInicioSaida === null && inicioEntradaAudio !== null) programarVolumeAudio();
  }
  function iniciarEntrada() {
    if (destruida || volumeInicioSaida !== null) return;
    const contexto = musica.manager?.context;
    const ganho = musica.volumeNode?.gain;
    if (contexto && ganho) {
      // O relógio de áudio fica parado enquanto o navegador bloqueia a reprodução.
      // Assim, a entrada não termina silenciosamente antes do primeiro som audível.
      const agora = contexto.currentTime;
      inicioEntradaAudio = Math.max(agora, musica.startTime ?? agora) + SILENCIO_INICIAL_MS / 1000;
      programarVolumeAudio();
    } else {
      // HTML Audio só inicia a animação de volume depois do evento de reprodução.
      entradaVolume = scene.tweens.add({ targets: musica, volume: volumeMaximo,
        delay: SILENCIO_INICIAL_MS, duration: DURACAO_ENTRADA_MS, ease: "Sine.easeInOut" });
    }
  }
  const controle = {
    retomar() {
      if (destruida || volumeInicioSaida === null) return;
      volumeInicioSaida = volumeSaida = null;
      iniciarEntrada();
    },
    sair(progresso) {
      if (destruida) return;
      if (volumeInicioSaida === null) {
        volumeInicioSaida = musica.coopMusicVolume();
        entradaVolume?.remove();
      }
      const p = Math.max(0, Math.min(1, progresso));
      volumeSaida = volumeInicioSaida * (1 - p * p * (3 - 2 * p));
      const contexto = musica.manager?.context;
      const ganho = musica.volumeNode?.gain;
      if (contexto && ganho) {
        ganho.cancelScheduledValues(contexto.currentTime);
        ganho.setValueAtTime(volumeSaida, contexto.currentTime);
        musica.currentConfig.volume = volumeSaida;
      } else musica.setVolume(volumeSaida);
    },
    destruir() {
      if (destruida) return;
      destruida = true;
      scene.events.off("shutdown", controle.destruir);
      scene.events.off("destroy", controle.destruir);
      musica.off("play", iniciarEntrada);
      musica.off("resume", retomarEntrada);
      entradaVolume?.remove();
      const contexto = musica.manager?.context;
      const ganho = musica.volumeNode?.gain;
      if (contexto && ganho) {
        ganho.cancelScheduledValues(contexto.currentTime);
        ganho.setValueAtTime(0, contexto.currentTime);
      }
      musica.stop();
      musica.destroy();
      sonsCena.delete(chave);
      if (sonsCena.size === 0) controles.delete(scene);
    },
  };
  sonsCena.set(chave, controle);
  musica.coopMusicControl = controle;
  musica.coopMusicVolume = () => {
    if (volumeSaida !== null) return volumeSaida;
    const context = musica.manager?.context;
    if (context && inicioEntradaAudio !== null) {
      const p = Math.max(0, Math.min(1, (context.currentTime - inicioEntradaAudio) / (DURACAO_ENTRADA_MS / 1000)));
      return volumeMaximo * p * p * (3 - 2 * p);
    }
    return musica.volume;
  };
  controles.set(scene, sonsCena);
  scene.events.once("shutdown", controle.destruir);
  scene.events.once("destroy", controle.destruir);
  musica.once("play", iniciarEntrada);
  musica.on("resume", retomarEntrada);
  if (trechoLoop && Number.isFinite(musica.totalDuration) && musica.totalDuration >= trechoLoop.fim) {
    musica.addMarker({ name: trechoLoop.nome, start: trechoLoop.inicio,
      duration: trechoLoop.fim - trechoLoop.inicio, config: { volume: 0, loop: true } });
    // O seek relativo negativo inclui a introdução só na primeira passagem.
    // O relógio do áudio agenda as voltas sem esperar um evento de conclusão.
    musica.play(trechoLoop.nome, { seek: -trechoLoop.inicio, volume: 0 });
  } else {
    musica.play({ volume: 0, loop: true });
  }
  return controle;
}
