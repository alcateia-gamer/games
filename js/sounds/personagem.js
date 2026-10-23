/**
 * @file Carregamento dos sons do jogador e loop de passos. Inicia e interrompe o áudio
 * conforme movimento e estado de morte.
 */

// Volume máximo do som de corrida do personagem.
const VOLUME_CORRIDA = 0.3;
const DURACAO_MINIMA_PASSO_MS = 180;

/**
 * Enfileira os sons de corrida, tensão e disparo da Aria e dano dos personagens.
 */
function carregarSonsPersonagem(loader) {
  // =====================================================
  // SOM DE CORRIDA
  // =====================================================

  loader.audio("running", "sounds.mp3/running.mp3");

  // =====================================================
  // SONS DA ARIA KADE
  // =====================================================

  // Som utilizado ao manter o arco tensionado.
  // O nome "tenasr" é o nome real do arquivo no GitHub.
  loader.audio("aria-tensar-arco", "sounds.mp3/tenasr_arco.mp3");

  // Som utilizado sempre que a flecha é disparada.
  loader.audio("aria-soltar-flecha", "sounds.mp3/soltar_flecha.mp3");

  // =====================================================
  // SOM DE DANO DOS PERSONAGENS JOGÁVEIS
  // =====================================================

  // Som reproduzido quando qualquer personagem
  // jogável recebe dano.
  //
  // Kai Mercer
  // Magnus Force
  // Aria Kade
  // Nyx

  loader.audio("dano-soft", "sounds.mp3/dano_soft.mp3");
}

/** Descarta somente o silêncio anterior ao primeiro impacto, mantendo o áudio original. */
function encontrarInicioPasso(buffer) {
  if (!buffer?.getChannelData) return 0;
  const canais = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  let pico = 0;
  for (const canal of canais) {
    for (const valor of canal) pico = Math.max(pico, Math.abs(valor));
  }
  if (!pico) return 0;
  for (let i = 0; i < buffer.length; i++) {
    if (canais.some(canal => Math.abs(canal[i]) >= pico * 0.18)) {
      return Math.max(0, i / buffer.sampleRate - 0.003);
    }
  }
  return 0;
}

function passosBloqueados(scene) {
  return scene.morteEmAndamento || scene.movimentoBloqueado || scene.generatorMenuOpen ||
    scene.estadoDash?.ativo || scene.input?.enabled === false ||
    (!scene.multiplayer && scene.player?.combatKnockbackUntil > scene.time.now);
}

/** Mantém o loop original; um toque curto tem tempo para completar o primeiro passo. */
function configurarSomCorrida(scene) {
  const som = scene.sound.add("running", { loop: true, volume: VOLUME_CORRIDA });
  scene.somCorrida = som;
  const inicio = encontrarInicioPasso(som.audioBuffer);
  scene.passoMinimoAte = 0;
  const solicitarPasso = () => {
    // Trocas de direção não reiniciam nem sobrepõem o loop que já está tocando.
    if (passosBloqueados(scene) || som.isPlaying) return;
    if (som.play({ volume: VOLUME_CORRIDA, seek: inicio })) {
      scene.passoMinimoAte = scene.time.now + DURACAO_MINIMA_PASSO_MS;
    }
  };
  scene.solicitarPasso = solicitarPasso;
  const aoPressionar = (event) => {
    if (event.repeat || scene.input.keyboard.enabled === false) return;
    if (Object.values(scene.teclasWASD || {}).some(tecla => tecla.keyCode === event.keyCode)) {
      solicitarPasso();
    }
  };
  scene.input.keyboard.on("keydown", aoPressionar);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.keyboard.off("keydown", aoPressionar);
    som.stop();
    som.destroy();
    if (scene.somCorrida === som) {
      scene.somCorrida = null;
      scene.solicitarPasso = null;
    }
  });
}

/** A caminhada mantém o loop; ao soltar, conclui apenas o primeiro passo de um toque curto. */
function atualizarSomCorrida(scene, estaSeMovendo) {
  if (!scene.somCorrida) return;
  if (passosBloqueados(scene)) {
    scene.somCorrida.stop();
    scene.passoMinimoAte = 0;
    return;
  }
  if (estaSeMovendo) {
    scene.solicitarPasso?.();
  } else if (scene.somCorrida.isPlaying && scene.time.now >= scene.passoMinimoAte) {
    scene.somCorrida.stop();
  }
}

export { carregarSonsPersonagem, configurarSomCorrida, atualizarSomCorrida };
