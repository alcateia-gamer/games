/**
 * @file Converte WASD ou joystick em movimento normalizado, respeitando bloqueios, dash e
 * animações.
 */

import {
  configurarSomCorrida,
  atualizarSomCorrida,
} from "../sounds/personagem.js";

import {
  atualizarVelocidadeAnimacao,
  atualizarAnimacaoCaminhada,
  atualizarAnimacaoParado,
} from "./PlayerAnimations.js";

import { atualizarDash } from "./PlayerDashControls.js";
import { obterDirecaoMovimento } from "./PlayerMovementInput.js";
import { ARIA_ATTACK_CONFIG } from "./AriaAttackConfig.js";

/**
 * Prepara o som de caminhada ou corrida usado pelo sistema de movimento.
 */
function criarMovimento(scene) {
  configurarSomCorrida(scene);
}

/**
 * Desativa a colisão com o mapa enquanto o modo desenvolvedor e a tecla Espaço estão ativos.
 */
function atualizarColisaoMapaPlayer(scene) {
  if (!scene.colliderPlayerMapa) {
    return;
  }

  const atravessandoMapa = !!scene.developerMode && !!scene.teclaEspaco?.isDown;

  scene.colliderPlayerMapa.active = !atravessandoMapa;
}

/**
 * Aplica a entrada de movimento; o teclado tem prioridade sobre o joystick e o dash assume a
 * velocidade durante seu impulso.
 */
function atualizarMovimento(scene) {
  atualizarColisaoMapaPlayer(scene);

  if (scene.movimentoBloqueado) {
    scene.player.setVelocity(0, 0);
    atualizarSomCorrida(scene, false);
    return;
  }

  // Preserva o impulso de dano antes de consultar o dash ou a entrada normal.
  if (!scene.multiplayer && scene.player.combatKnockbackUntil > scene.time.now) {
    atualizarSomCorrida(scene, false);
    return;
  }

  // O dash controla a velocidade durante seu impulso.
  // Evita que o movimento normal cancele o dash.
  if (atualizarDash(scene)) {
    atualizarSomCorrida(scene, false);
    return;
  }

  const direcao = obterDirecaoMovimento(scene);

  const velocidadeBase = scene.speed ?? 200;
  const velocidadeTurbo = scene.speedTurbo ?? 400;

  const usandoTurbo =
    !!scene.developerMode && !!scene.teclaShift && scene.teclaShift.isDown;

  const velocidadeAtualBase = usandoTurbo ? velocidadeTurbo : velocidadeBase;

  const configAria = scene.ariaAttackConfig ?? ARIA_ATTACK_CONFIG;
  const penalidadeAria = scene.ariaAtaqueCarregando &&
    scene.time.now - scene.ariaCargaInicio >= configAria.movePenaltyStart
    ? configAria.movePenaltyMultiplier : 1;
  const velocidadeAtual = scene.personagemSelecionada === "aria-kade"
    ? velocidadeAtualBase * penalidadeAria
    : !scene.multiplayer && scene.atacando
      ? velocidadeAtualBase * 0.72
      : velocidadeAtualBase;

  // MOVIMENTO E CAMINHADA
  if (direcao.x !== 0 || direcao.y !== 0) {
    // Armazena a direção para o próximo dash.
    scene.ultimaDirecaoDash?.copy(direcao);

    scene.player.setVelocity(
      direcao.x * velocidadeAtual,
      direcao.y * velocidadeAtual,
    );

    atualizarSomCorrida(scene, true);
    atualizarVelocidadeAnimacao(scene);

    if (Math.abs(direcao.x) > Math.abs(direcao.y)) {
      atualizarAnimacaoCaminhada(scene, direcao.x > 0 ? "right" : "left");
    } else {
      atualizarAnimacaoCaminhada(scene, direcao.y > 0 ? "down" : "up");
    }
  } else {
    atualizarSomCorrida(scene, false);
    scene.player.setVelocity(0, 0);
    scene.player.anims.timeScale = 1;
    atualizarAnimacaoParado(scene);
  }
}

export { criarMovimento, atualizarMovimento };
