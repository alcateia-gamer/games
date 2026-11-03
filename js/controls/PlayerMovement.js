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
import { obterImpulsoFlorete } from "../player/FloretePersonagemTeste.js";
import { jogadorPresoNovoBoss } from "../player/PlayerControlEffects.js";

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

  if (scene.movimentoBloqueado || jogadorPresoNovoBoss(scene)) {
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

  const impulso = obterImpulsoFlorete(scene);
  const controle = impulso?.controle ?? 1;
  // Estocadas somam um passo; no terceiro golpe o dash assume a direção da mira.
  if (direcao.x !== 0 || direcao.y !== 0 || impulso) {
    // Armazena a direção para o próximo dash.
    scene.ultimaDirecaoDash?.copy(direcao);

    scene.player.setVelocity(
      direcao.x * velocidadeAtual * controle + (impulso?.x ?? 0),
      direcao.y * velocidadeAtual * controle + (impulso?.y ?? 0),
    );

    atualizarSomCorrida(scene, true);
    atualizarVelocidadeAnimacao(scene);

    const animacao = direcao.x || direcao.y ? direcao : impulso;
    if (Math.abs(animacao.x) > Math.abs(animacao.y)) {
      atualizarAnimacaoCaminhada(scene, animacao.x > 0 ? "right" : "left");
    } else {
      atualizarAnimacaoCaminhada(scene, animacao.y > 0 ? "down" : "up");
    }
  } else {
    atualizarSomCorrida(scene, false);
    scene.player.setVelocity(0, 0);
    scene.player.anims.timeScale = 1;
    atualizarAnimacaoParado(scene);
  }
}

export { criarMovimento, atualizarMovimento };
