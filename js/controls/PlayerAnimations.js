/**
 * @file Escolhe as animações de movimento sem interromper ataques em andamento.
 */

import { atualizarDirecaoAtaqueAria } from "../player/Player.js";

/**
 * Reproduz uma animação quando necessário, preservando ataques e a direção da carga da Aria.
 */
function tocarAnimacaoSeNecessario(scene, chave) {
  if (
    scene.atacando &&
    scene.ariaAtaqueCarregando &&
    chave.startsWith("walk-")
  ) {
    atualizarDirecaoAtaqueAria(scene, chave.slice(5));
    return;
  }

  if (
    !scene.player?.anims ||
    (scene.atacando && !chave.startsWith("attack-")) ||
    (scene.player.anims.currentAnim?.key === chave &&
      scene.player.anims.isPlaying)
  ) {
    return;
  }

  scene.player.anims.play(chave);
}

/**
 * Ajusta a velocidade da animação quando o turbo de desenvolvedor aumenta a velocidade do
 * jogador.
 */
function atualizarVelocidadeAnimacao(scene) {
  if (!scene.player || !scene.player.anims) {
    return;
  }

  const velocidadeBase = scene.speed ?? 200;
  const velocidadeTurbo = scene.speedTurbo ?? 400;
  const velocidadeAtual =
    scene.developerMode && scene.teclaShift && scene.teclaShift.isDown
      ? velocidadeTurbo
      : velocidadeBase;

  scene.player.anims.timeScale =
    velocidadeAtual > velocidadeBase ? velocidadeAtual / velocidadeBase : 1;
}

/**
 * Guarda a direção atual e solicita a animação de caminhada correspondente.
 */
function atualizarAnimacaoCaminhada(scene, direcao) {
  scene.direcaoAtual = direcao;
  tocarAnimacaoSeNecessario(scene, `walk-${direcao}`);
}

/**
 * Exibe o estado parado de cada personagem sem cancelar um ataque em andamento.
 */
function atualizarAnimacaoParado(scene) {
  if (scene.atacando) {
    return;
  }

  if (scene.personagemSelecionada === "magnus-force") {
    const framesParados = { up: 0, left: 9, down: 18, right: 27 };
    scene.player.anims.stop();
    scene.player.setFrame(framesParados[scene.direcaoAtual] ?? 18);
  } else if (scene.personagemSelecionada === "nyx") {
    tocarAnimacaoSeNecessario(scene, `idle-${scene.direcaoAtual}`);
  } else {
    scene.player.anims.stop();
  }
}

export {
  tocarAnimacaoSeNecessario,
  atualizarVelocidadeAnimacao,
  atualizarAnimacaoCaminhada,
  atualizarAnimacaoParado,
};
