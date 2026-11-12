import { cenaSomCompartilhado } from "../multiplayer/CoopAudio.js";
/**
 * @file Áudio dos robôs. Centraliza carregamento, passos com volume por
 * distância e limpeza dos sons temporários.
 */

// =====================================================
// VOLUMES DOS SONS DOS INIMIGOS
// =====================================================

// Volume máximo do passo do robô que atira laser (15%).
const VOLUME_PASSO_ROBO_MAXIMO = 0.22;
const VOLUME_PASSO_SERRA_MAXIMO = 0.020;
// Alcance compartilhado; a serra ganha 40 pixels em relação aos 480 anteriores.
const DISTANCIA_SOM_PASSOS_ROBOS = 700;

// Volume dos sons existentes.
const VOLUME_TIRO_LASER = 0.02;
const VOLUME_MORTE_ROBO = 0.13;

/** Enfileira os sons de tiro, passos e explosão dos robôs. */
function carregarSonsInimigos(loader) {
  loader.audio("tiro-laser", "sounds.mp3/tiro_laser.mp3");
  loader.audio("robot-walk", "sounds.mp3/robot_walk_3.mp3");
  loader.audio("walk-robo-serra", "sounds.mp3/walk_robo_serra.mp3");
  loader.audio("robo-explodindo", "sounds.mp3/robo_explodindo.mp3");
}

// =====================================================
// SOM DOS PASSOS DOS ROBÔS - ORIGINAL
// =====================================================

/**
 * Atualiza passos conforme movimento e distância ao jogador, com volume reduzido para o
 * robô-serra.
 */
function atualizarSomPassoRobo(
  scene,
  inimigo,
  viuPlayer,
  distancia,
  estaSeMovendo,
) {
  scene = cenaSomCompartilhado(scene, inimigo, { range: DISTANCIA_SOM_PASSOS_ROBOS });
  const ehSerra = inimigo?.tipoRobo === "serra";

  if (scene.morteEmAndamento) {
    if (inimigo.somPassoRobo?.isPlaying) {
      inimigo.somPassoRobo.stop();
    }

    return;
  }

  const podeTocar = estaSeMovendo;

  // O ouvinte é o jogador local, mesmo quando o robô persegue outro jogador.
  const distanciaOuvinte = scene.player
    ? Math.hypot(scene.player.x - inimigo.x, scene.player.y - inimigo.y)
    : distancia;

  // Ambos perdem a mesma proporção do volume com a distância, independentemente da IA.
  const volumeRelativo =
    Phaser.Math.Clamp(1 - distanciaOuvinte / DISTANCIA_SOM_PASSOS_ROBOS, 0, 1) ** 2;

  const volume = volumeRelativo *
    (ehSerra ? VOLUME_PASSO_SERRA_MAXIMO : VOLUME_PASSO_ROBO_MAXIMO);

  const podeOuvir = volume > 0;

  inimigo.podeTocarPasso = podeTocar;
  inimigo.volumePasso = volume;

  if (inimigo.somPassoRobo) {
    if (!podeTocar || !podeOuvir) {
      inimigo.somPassoRobo.stop();
    } else if (!inimigo.somPassoRobo.isPlaying) {
      inimigo.somPassoRobo.play({ volume });
    } else if (inimigo.somPassoRobo.isPlaying) {
      inimigo.somPassoRobo.setVolume(volume);
    }
  }
}

// =====================================================
// CONFIGURAR PASSOS DOS ROBÔS - ORIGINAL
// =====================================================

/**
 * Cria o loop de passos adequado ao tipo de robô e agenda a destruição da instância na saída
 * da cena.
 */
function configurarSomPassoRobo(scene, inimigo) {
  scene = cenaSomCompartilhado(scene, inimigo, { range: DISTANCIA_SOM_PASSOS_ROBOS });
  const chaveSomPasso =
    inimigo?.tipoRobo === "serra" ? "walk-robo-serra" : "robot-walk";

  inimigo.somPassoRobo = scene.sound.add(chaveSomPasso, { loop: true });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    if (!inimigo.somPassoRobo) {
      return;
    }

    inimigo.somPassoRobo.stop();
    inimigo.somPassoRobo.destroy();
    inimigo.somPassoRobo = null;
  });
}

// =====================================================
// SOM DO LASER DOS ROBÔS - ORIGINAL
// =====================================================

/**
 * Reproduz o som de disparo dos robôs se a morte do jogador não está em andamento.
 */
function tocarSomTiroLaser(scene, inimigo = scene.player) {
  scene = cenaSomCompartilhado(scene, inimigo, { range: 900 });
  if (scene.morteEmAndamento) {
    return;
  }

  scene.sound.play("tiro-laser", {
    volume: VOLUME_TIRO_LASER,
  });
}

// =====================================================
// SOM DE MORTE DOS ROBÔS - ORIGINAL
// =====================================================

/**
 * Toca a explosão de um robô apenas uma vez, evitando repetições durante sua destruição.
 */
function tocarSomMorteRobo(scene, inimigo) {
  scene = cenaSomCompartilhado(scene, inimigo, { range: 900 });
  if (
    !scene?.sound ||
    scene.morteEmAndamento ||
    !inimigo ||
    inimigo.somMorteTocado
  ) {
    return;
  }

  inimigo.somMorteTocado = true;

  scene.sound.play("robo-explodindo", {
    volume: VOLUME_MORTE_ROBO,
  });
}

// =====================================================
// EXPORTAÇÕES
// =====================================================

export {
  carregarSonsInimigos,
  configurarSomPassoRobo,
  atualizarSomPassoRobo,
  tocarSomTiroLaser,
  tocarSomMorteRobo,
};
