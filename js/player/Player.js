/**
 * @file Sprite e combate do jogador. Mantém separadas as colisões com o chão, a área que
 * recebe dano e a área ofensiva da katana.
 */

import { gastarEstamina } from "./PlayerStatus.js";
import { dispararProjetil } from "./PlayerProjectiles.js";
import { ARIA_ATTACK_CONFIG, ARIA_AIM_DIRECTIONS, calcularCargaAria } from "../controls/AriaAttackConfig.js";
import { pararSomTensaoAria } from "../sounds/SOUNDS_PERSONAGENS.js/sounds_Aria.js";

import { causarDanoInimigo } from "../enemies/EnemyTest.js";
import { causarDanoBoss } from "../enemies/BossFinal.js";
import { tocarSomKatanaAcerto, tocarSomKatanaErro } from "../sounds/katana.js";
import { COMBAT_FEEL } from "../combat/CombatEffects.js";
import { calcularDepthAtor } from "../map/ProfundidadeMapa.js";
import {
  obterConfiguracaoHitboxAtaque,
  obterConfiguracaoHitboxWalk,
} from "./colisoes/index.mjs";

/**
 * Consulta a configuração de depuração para decidir se as hitboxes devem ser desenhadas.
 */
function debugHitboxesAtivado(scene) {
  return !!scene?.game?.config?.physics?.arcade?.debug;
}

/**
 * Identifica se o personagem selecionado é Magnus.
 */
function personagem2Ativa(scene) {
  return scene.personagemSelecionada === "magnus-force";
}

/**
 * Identifica se o personagem selecionado é Aria.
 */
function personagem3Ativa(scene) {
  return scene.personagemSelecionada === "aria-kade";
}

/**
 * Identifica se o personagem selecionado é Nyx.
 */
function personagem4Ativa(scene) {
  return scene.personagemSelecionada === "nyx";
}

/**
 * Considera Kai como personagem quando nenhum dos outros três está selecionado.
 */
function personagemKaiAtiva(scene) {
  return (
    !personagem2Ativa(scene) &&
    !personagem3Ativa(scene) &&
    !personagem4Ativa(scene)
  );
}

// Quadro exibido enquanto a Aria carrega o ataque, conforme a direção atual.
const framesCarregadosAria = {
  up: 8,
  left: 21,
  down: 34,
  right: 47,
};

const KAI_ATTACK_ORIGIN_Y = 0.43;
const NYX_ATTACK_ORIGIN_Y = 0.45;

/**
 * Retorna a chave da textura de caminhada do personagem selecionado.
 */
function texturaWalk(scene, direcao = scene.direcaoAtual) {
  if (personagem4Ativa(scene)) {
    return "personagem4-walk";
  }
  if (personagem3Ativa(scene)) {
    return "personagem3-walk";
  }
  return personagem2Ativa(scene) ? "personagem2-walk" : "walk";
}

/**
 * Configura a origem visual de caminhada e ajusta o ponto de ancoragem específico da Aria.
 */
function configurarVisualWalk(scene) {
  scene.player.setOrigin(0.5, 0.5);
  if (personagem3Ativa(scene)) {
    scene.player.setDisplayOrigin(64, 68);
  }
}

/**
 * Escolhe o frame parado do personagem conforme a direção informada.
 */
function frameParado(scene, direcao = scene.direcaoAtual) {
  // Quadro inicial usado ao criar/retomar o personagem, por direção.
  // Atualize junto com idleFrames em PlayerAnimations.js para manter as poses consistentes.
  const frames = personagem4Ativa(scene)
    ? { down: 18, up: 0, left: 9, right: 27 }
    : personagem3Ativa(scene)
      ? { up: 0, left: 9, down: 18, right: 27 }
      : personagem2Ativa(scene)
        ? { up: 0, left: 9, down: 18, right: 27 }
        : { up: 0, left: 9, down: 18, right: 27 };
  return frames[direcao] ?? frames.down;
}

/**
 * Obtém o Y dos pés pela hitbox física ou, sem corpo, pelos limites visuais.
 */
function calcularFootYPlayer(scene) {
  if (!scene?.player?.body) {
    return scene?.player?.getBounds().bottom ?? 0;
  }

  return scene.player.body.bottom;
}

/**
 * Atualiza a ordem de desenho do jogador usando a posição dos pés no mundo.
 */
function atualizarDepthPlayer(scene) {
  if (!scene?.player?.active) {
    return;
  }

  const footY = calcularFootYPlayer(scene);
  const depth = calcularDepthAtor(scene, footY);

  scene.player.setDepth(depth);

  if (scene.DEBUG_DEPTH_SORTING) {
    console.log({ playerY: scene.player.y, footY, depth });
  }
}

// =====================================================
// CRIA PLAYER
// =====================================================

/**
 * Cria sprite, colisões e área de dano e restaura caminhada e estados ao terminar ataques.
 */
function criarPlayer(scene) {
  // As cenas são reutilizadas ao jogar novamente pelo menu.
  scene.movimentoBloqueado = false;
  scene.atacando = false;
  scene.ariaAtaqueCarregando = false;
  scene.ariaCargaInicio = null;
  scene.ariaMira = null;
  scene.ariaProximoDisparoRapido = 0;
  scene.attackPhase = "normal";
  scene.attackBufferedUntil = 0;
  scene.combatHitStopRemaining = 0;
  scene.direcaoAtual = "down";
  scene.direcaoAtaque = null;

  // =====================================================
  // PERSONAGEM
  // =====================================================

  scene.player = scene.physics.add.sprite(
    scene.respawnX,
    scene.respawnY,
    texturaWalk(scene, "down"),
    frameParado(scene, "down"),
  );

  // Usa o mesmo alinhamento dos tiles, sem arredondar posições físicas ou a câmera.
  scene.player.setVertexRoundMode("safe");

  scene.player.setAlpha(1).clearTint().setBlendMode(Phaser.BlendModes.NORMAL);
  configurarVisualWalk(scene);

  scene.player.invulneravel = false;

  if (personagem3Ativa(scene) || personagem4Ativa(scene)) {
    scene.player.anims.play("idle-down", true);
  }

  scene.player.body.setAllowGravity(false);

  // =====================================================
  // HITBOX DE COLISÃO - WALK 64x64
  // =====================================================

  configurarHitboxWalk(scene);

  // =====================================================
  // HITBOX DE DANO
  // =====================================================

  scene.hitboxDanoPlayer = new Phaser.Geom.Rectangle(
    scene.player.x - 19,
    scene.player.y + 26 - 46,
    38,
    46,
  );

  // =====================================================
  // DEBUG DA HITBOX DE DANO
  // =====================================================

  scene.debugHitboxDanoPlayer = scene.add.graphics();

  scene.debugHitboxDanoPlayer.setDepth(100);
  scene.debugHitboxDanoPlayer.setVisible(debugHitboxesAtivado(scene));

  // =====================================================
  // ATUALIZA POSIÇÃO INICIAL
  // =====================================================

  atualizarDepthPlayer(scene);
  atualizarHitboxDanoPlayer(scene);

  // =====================================================
  // FIM DO ATAQUE
  // =====================================================

  scene.player.on("animationcomplete", (animation) => {
    if (animation.key.startsWith("aria-charge-")) {
      if (scene.ariaAtaqueCarregando) {
        scene.player.anims.stop();
      }
      return;
    }

    if (
      !animation.key.startsWith("attack-") &&
      !animation.key.startsWith("aria-release-")
    ) {
      return;
    }

    // =================================================
    // ATAQUE TERMINOU
    // =================================================

    scene.atacando = false;
    if (personagem3Ativa(scene)) scene.ariaCargaInicio = null;

    if (
      scene.multiplayer !== true &&
      scene.attackBufferedUntil > scene.time.now
    ) {
      scene.attackBufferedUntil = 0;
      // Só mantém a textura e a hitbox de ataque se o próximo golpe realmente começar.
      // Sem estamina, ainda é necessário restaurar a caminhada abaixo.
      if (atacar(scene)) {
        return;
      }
    }
    scene.attackBufferedUntil = 0;

    // =================================================
    // VOLTA PARA WALK
    // =================================================

    const direcaoAtaque = scene.direcaoAtaque ?? scene.direcaoAtual;
    scene.player.setTexture(
      texturaWalk(scene, direcaoAtaque),
      frameParado(scene, direcaoAtaque),
    );
    configurarVisualWalk(scene);

    // =================================================
    // RESTAURA HITBOX PARA WALK 64x64
    // =================================================

    configurarHitboxWalk(scene);
    scene.direcaoAtaque = null;
    scene.ariaAtaqueCarregando = false;
  });
}

// =====================================================
// HITBOX DE COLISÃO - WALK
// =====================================================
// SPRITE: 128x128
// =====================================================

/**
 * Aplica a largura, altura e deslocamentos da hitbox de caminhada configurada para o
 * personagem.
 */
function configurarHitboxWalk(scene) {
  if (!scene.player || !scene.player.body) {
    return;
  }

  const configuracao = obterConfiguracaoHitboxWalk(scene.personagemSelecionada);
  scene.player.body.setSize(
    configuracao.width,
    configuracao.height,
  );
  scene.player.body.setOffset(
    configuracao.offsetX,
    configuracao.offsetY,
  );
}

// =====================================================
// HITBOX DE COLISÃO - ATAQUE
// =====================================================
// Os offsets variam conforme o tamanho da folha de cada personagem.
// =====================================================

/**
 * Aplica a configuração de colisão usada quando a textura de ataque está ativa.
 */
function configurarHitboxAtaque(scene) {
  if (!scene.player || !scene.player.body) {
    return;
  }

  const configuracao = obterConfiguracaoHitboxAtaque(
    scene.personagemSelecionada,
  );
  scene.player.body.setSize(configuracao.width, configuracao.height);
  scene.player.body.setOffset(configuracao.offsetX, configuracao.offsetY);
}

/**
 * Permite mudar a direção da Aria durante a carga sem reiniciar o carregamento do ataque.
 */
function atualizarDirecaoAtaqueAria(scene, direcao) {
  if (
    !personagem3Ativa(scene) ||
    !scene.atacando ||
    !scene.ariaAtaqueCarregando ||
    scene.direcaoAtaque === direcao
  ) {
    return;
  }

  scene.direcaoAtaque = direcao;
  scene.player.anims.stop();
  scene.player.setTexture("personagem3-attack");
  scene.player.setFrame(framesCarregadosAria[direcao]);
  alinharVisualAtaqueAria(scene);
}

/** Compensa somente a folha de 64px; mantém o corpo nos mesmos pés da caminhada. */
function alinharVisualAtaqueAria(scene) {
  scene.player.setDisplayOrigin(35, 32);
}

/** Cancela sem criar projétil ou deixar ataques na fila. */
function cancelarAtaqueAria(scene) {
  pararSomTensaoAria(scene);
  scene.ariaCargaInicio = null;
  scene.ariaMira = null;
  scene.attackBufferedUntil = 0;
  if (!scene.ariaAtaqueCarregando) return;
  scene.ariaAtaqueCarregando = false;
  scene.atacando = false;
  scene.attackPhase = "normal";
  scene.direcaoAtaque = null;
  if (scene.player?.active) {
    scene.player.anims.stop();
    scene.player.setTexture(texturaWalk(scene), frameParado(scene));
    configurarVisualWalk(scene);
    configurarHitboxWalk(scene);
  }
}

// =====================================================
// ATUALIZA HITBOX DE DANO
// =====================================================

/**
 * Reposiciona a área que recebe dano e atualiza sua visualização de depuração.
 */
function atualizarHitboxDanoPlayer(scene) {
  if (!scene.player || !scene.player.active || !scene.hitboxDanoPlayer) {
    return;
  }

  // =====================================================
  // TAMANHO
  // =====================================================

  const largura = 30;

  const altura = 46;

  // =====================================================
  // POSIÇÃO
  // =====================================================

  const centroX = scene.player.x;

  const baseY = scene.player.y + 26;

  // =====================================================
  // ATUALIZA RETÂNGULO
  // =====================================================

  scene.hitboxDanoPlayer.setTo(
    centroX - largura / 2,
    baseY - altura,
    largura,
    altura,
  );

  // =====================================================
  // DEBUG
  // =====================================================

  if (scene.debugHitboxDanoPlayer) {
    const debugAtivado = debugHitboxesAtivado(scene);

    scene.debugHitboxDanoPlayer.setVisible(debugAtivado);

    if (!debugAtivado) {
      return;
    }

    scene.debugHitboxDanoPlayer.clear();

    scene.debugHitboxDanoPlayer.lineStyle(2, 0xff0000, 1);

    scene.debugHitboxDanoPlayer.fillStyle(0xff0000, 0.08);

    scene.debugHitboxDanoPlayer.fillRectShape(scene.hitboxDanoPlayer);

    scene.debugHitboxDanoPlayer.strokeRectShape(scene.hitboxDanoPlayer);
  }
}

// =====================================================
// CRIA HITBOX DA KATANA
// =====================================================

/**
 * Cria a área geométrica da katana, o controle de acerto e a atualização vinculada ao ataque.
 */
function criarHitboxKatana(scene) {
  // =====================================================
  // RETÂNGULO GEOMÉTRICO
  //
  // NÃO TEM CORPO ARCADE.
  // PORTANTO NÃO INTERFERE NA COLISÃO DO MAPA.
  // =====================================================

  const hitboxKatana = new Phaser.Geom.Rectangle(0, 0, 40, 40);

  // =====================================================
  // CONTROLE DE DANO
  // =====================================================

  let jaAcertou = false;
  let somAtaqueTocado = false;

  // =====================================================
  // DEBUG
  // =====================================================

  const debugKatana = scene.add.graphics();

  debugKatana.setDepth(101);
  debugKatana.setVisible(debugHitboxesAtivado(scene));

  // =====================================================
  // ATUALIZA HITBOX
  // =====================================================

  /**
   * Posiciona a katana pela direção e processa acertos nos quadros válidos, evitando dano
   * repetido pelo mesmo golpe.
   */
  const atualizarHitboxKatana = () => {
    if (!scene.player || !scene.player.active) {
      return;
    }

    const debugAtivado = debugHitboxesAtivado(scene);

    debugKatana.setVisible(debugAtivado);

    let centroX = scene.player.x;

    let centroY = scene.player.y;

    let largura = 54;

    let altura = 54;

    // =================================================
    // CIMA
    // =================================================

    const direcaoAtaque = scene.direcaoAtaque ?? scene.direcaoAtual;

    if (direcaoAtaque === "up") {
      centroY -= 26;

      largura = 90;

      altura = 44;
    }

    // =================================================
    // BAIXO
    // =================================================
    else if (direcaoAtaque === "down") {
      centroY += 26;

      largura = 90;

      altura = 44;
    }

    // =================================================
    // ESQUERDA
    // =================================================
    else if (direcaoAtaque === "left") {
      centroX -= 30;

      largura = 44;

      altura = 90;
    }

    // =================================================
    // DIREITA
    // =================================================
    else if (direcaoAtaque === "right") {
      centroX += 30;

      largura = 44;

      altura = 90;
    }

    // =================================================
    // POSICIONA
    // =================================================

    hitboxKatana.setTo(
      centroX - largura / 2,
      centroY - altura / 2,
      largura,
      altura,
    );

    // =================================================
    // DEBUG
    // =================================================

    if (!debugAtivado) {
      return;
    }

    debugKatana.clear();

    debugKatana.lineStyle(2, 0xffff00, 1);

    debugKatana.fillStyle(0xffff00, 0.08);

    debugKatana.fillRectShape(hitboxKatana);

    debugKatana.strokeRectShape(hitboxKatana);
  };

  // =====================================================
  // POSIÇÃO INICIAL
  // =====================================================

  atualizarHitboxKatana();

  // =====================================================
  // ATUALIZA DURANTE O ATAQUE
  // =====================================================

  const eventoHitbox = scene.time.addEvent({
    delay: 16,

    loop: true,

    callback: () => {
      atualizarHitboxKatana();

      // ===============================================
      // JÁ ACERTOU
      // ===============================================

      if (jaAcertou) {
        return;
      }

      const alvos = [
        ...(Array.isArray(scene.inimigos)
          ? scene.inimigos.filter((inimigo) => inimigo && inimigo.active)
          : scene.inimigoTeste && scene.inimigoTeste.active
            ? [scene.inimigoTeste]
            : []),
        ...(scene.bossFinal?.active && !scene.bossFinal.morto
          ? [scene.bossFinal]
          : []),
      ];

      if (alvos.length === 0) {
        return;
      }

      let acertouAlgum = false;

      for (const inimigo of alvos) {
        const hitboxInimigo =
          inimigo.hitboxDano ||
          new Phaser.Geom.Rectangle(
            inimigo.body.x,
            inimigo.body.y,
            inimigo.body.width,
            inimigo.body.height,
          );

        const acertou = Phaser.Geom.Intersects.RectangleToRectangle(
          hitboxKatana,
          hitboxInimigo,
        );

        if (!acertou) {
          continue;
        }

        acertouAlgum = true;

        if (!somAtaqueTocado) {
          tocarSomKatanaAcerto(scene);
          somAtaqueTocado = true;
        }

        if (inimigo === scene.bossFinal) {
          causarDanoBoss(scene, 25);
        } else {
          causarDanoInimigo(scene, inimigo, 25);
        }
      }

      if (acertouAlgum) {
        jaAcertou = true;
      }
    },
  });

  // =====================================================
  // REMOVE HITBOX APÓS 140ms
  // =====================================================

  scene.time.delayedCall(140, () => {
    if (eventoHitbox) {
      eventoHitbox.remove();
    }

    if (debugKatana) {
      debugKatana.destroy();
    }

    if (!jaAcertou && !somAtaqueTocado) {
      tocarSomKatanaErro(scene);
    }
  });
}

// =====================================================
// ATAQUE
// =====================================================

/**
 * Consome estamina e inicia o ataque do personagem; no solo, guarda um comando recente se já
 * houver ataque em andamento. Retorna se um novo ataque foi iniciado.
 */
function atacar(scene) {
  // =====================================================
  // JÁ ESTÁ ATACANDO
  // =====================================================

  if (scene.atacando) {
    // Aria dispara na soltura: enfileirar outro ataque criaria uma carga sem dedo.
    if (personagem3Ativa(scene)) return false;
    if (scene.multiplayer !== true && scene.time) {
      scene.attackBufferedUntil =
        scene.time.now + COMBAT_FEEL.inputBufferMs;
    }
    return false;
  }

  // =====================================================
  // ESTAMINA
  // =====================================================

  const podeAtacar = gastarEstamina(scene, scene.custoAtaque);

  if (!podeAtacar) {
    return false;
  }

  // =====================================================
  // INICIA ATAQUE
  // =====================================================

  scene.atacando = true;
  scene.networkAttackId = (scene.networkAttackId || 0) + 1;
  scene.attackPhase = personagem3Ativa(scene) ? "charge" : "normal";
  scene.direcaoAtaque = scene.direcaoAtual;
  const originAtaqueY = personagemKaiAtiva(scene)
    ? KAI_ATTACK_ORIGIN_Y
    : personagem3Ativa(scene)
      ? 0.5
      : personagem4Ativa(scene)
        ? NYX_ATTACK_ORIGIN_Y
        : 0.5;
  scene.player.setOrigin(0.55, originAtaqueY);

  if (personagem3Ativa(scene)) {
    scene.ariaAtaqueCarregando = true;
    scene.ariaCargaInicio = scene.time.now;
    scene.ariaMira = { ...ARIA_AIM_DIRECTIONS[scene.direcaoAtaque] };
    scene.player.anims.timeScale = 1;
    scene.player.anims.play(`aria-charge-${scene.direcaoAtaque}`, false);
    alinharVisualAtaqueAria(scene);
    configurarHitboxAtaque(scene);
    return true;
  }

  // =====================================================
  // HITBOX DA KATANA
  // =====================================================

  criarHitboxKatana(scene);

  // =====================================================
  // ANIMAÇÃO
  // =====================================================

  const chaveAtaque = `attack-${scene.direcaoAtaque}`;

  if (personagemKaiAtiva(scene)) {
    const primeiroFrameAtaque = {
      up: 0,
      left: 6,
      down: 12,
      right: 18,
    }[scene.direcaoAtaque];

    scene.player.setTexture("attack", primeiroFrameAtaque);
    scene.player.setOrigin(0.5, KAI_ATTACK_ORIGIN_Y);
  }

  if (personagem2Ativa(scene)) {
    const primeiroFrameAtaque = {
      up: 0,
      left: 7,
      down: 16,
      right: 25,
    }[scene.direcaoAtaque];

    scene.player.setTexture("personagem2-attack", primeiroFrameAtaque);
    scene.player.setOrigin(0.5, 0.5);
    scene.player.setDisplayOrigin(59, 58);
  }

  if (personagem4Ativa(scene)) {
    const primeiroFrameAtaque = {
      up: 0,
      left: 6,
      down: 12,
      right: 18,
    }[scene.direcaoAtaque];

    scene.player.setTexture("personagem4-attack", primeiroFrameAtaque);
    scene.player.setOrigin(0.5, NYX_ATTACK_ORIGIN_Y);
  }

  scene.player.anims.play(chaveAtaque, false);

  // =====================================================
  // IMPORTANTE
  //
  // A TEXTURA AGORA É 128x128.
  // COMPENSA O OFFSET PARA A COLISÃO CONTINUAR
  // EXATAMENTE NA REGIÃO DOS PÉS.
  // =====================================================

  configurarHitboxAtaque(scene);
  return true;
}

/**
 * Encerra a carga da Aria, cria a flecha e executa a animação de soltura na direção escolhida.
 */
function soltarAtaque(scene, agora = scene.time.now) {
  if (
    !personagem3Ativa(scene) ||
    !scene.atacando ||
    !scene.ariaAtaqueCarregando
  ) {
    return;
  }

  const tempo = Math.max(0, agora - (scene.ariaCargaInicio ?? agora));
  const config = scene.ariaAttackConfig ?? ARIA_ATTACK_CONFIG;
  if (tempo <= config.quickTapThreshold && agora < scene.ariaProximoDisparoRapido) {
    cancelarAtaqueAria(scene);
    return false;
  }
  const potencia = calcularCargaAria(tempo, config);
  const direction = scene.ariaAttackJoystick
    ? scene.ariaMira ?? ARIA_AIM_DIRECTIONS[scene.direcaoAtaque]
    : ARIA_AIM_DIRECTIONS[scene.direcaoAtaque];
  scene.ariaAtaqueCarregando = false;
  scene.ariaCargaInicio = null;
  scene.ariaProximoDisparoRapido = agora + config.quickShotCooldown;
  scene.attackPhase = "release";
  dispararProjetil(scene, { direction, damage: potencia.damage, speed: potencia.speed });
  scene.player.anims.play(`aria-release-${scene.direcaoAtaque}`, false);
  alinharVisualAtaqueAria(scene);
  configurarHitboxAtaque(scene);
  return true;
}

// =====================================================
// RESPAWN
// =====================================================

/**
 * Reposiciona o jogador no respawn e restaura textura, colisão, direção, vida, estamina e
 * estados de ataque.
 */
function respawnPlayer(scene) {
  scene.ariaAttackJoystick?.cancelar();
  if (personagem3Ativa(scene)) cancelarAtaqueAria(scene);
  scene.player.combatKnockbackUntil = 0;

  // =====================================================
  // PARA MOVIMENTO
  // =====================================================

  scene.player.setVelocity(0, 0);

  // =====================================================
  // RESETA ESTADO
  // =====================================================

  scene.atacando = false;
  scene.ariaAtaqueCarregando = false;
  scene.attackPhase = "normal";

  scene.direcaoAtual = "down";

  scene.player.anims.stop();
  scene.player.setOrigin(0.5, 0.5);

  // =====================================================
  // VOLTA PARA WALK
  // =====================================================

  scene.player.setTexture(
    texturaWalk(scene, "down"),
    frameParado(scene, "down"),
  );
  configurarVisualWalk(scene);

  // =====================================================
  // POSIÇÃO
  // =====================================================

  scene.player.setPosition(scene.respawnX, scene.respawnY);

  // =====================================================
  // RESTAURA HITBOX WALK
  // =====================================================

  configurarHitboxWalk(scene);

  // =====================================================
  // HITBOX DE DANO
  // =====================================================

  atualizarHitboxDanoPlayer(scene);

  // =====================================================
  // VIDA
  // =====================================================

  scene.vida = scene.vidaMaxima;

  // =====================================================
  // ESTAMINA
  // =====================================================

  scene.estamina = scene.estaminaMaxima;
}

// =====================================================
// EXPORTA
// =====================================================

export {
  criarPlayer,
  atacar,
  soltarAtaque,
  atualizarDirecaoAtaqueAria,
  cancelarAtaqueAria,
  respawnPlayer,
  atualizarHitboxDanoPlayer,
  atualizarDepthPlayer,
};
