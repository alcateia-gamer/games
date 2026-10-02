import { gastarEstamina } from "./PlayerStatus.js";
import { dispararProjetil } from "./PlayerProjectiles.js";

import { causarDanoInimigo } from "../enemies/EnemyTest.js";
import { tocarSomKatanaAcerto, tocarSomKatanaErro } from "../sounds/katana.js";

function debugHitboxesAtivado(scene) {
  return !!scene?.game?.config?.physics?.arcade?.debug;
}

function personagem2Ativa(scene) {
  return scene.personagemSelecionada === "personagem2";
}

function personagem3Ativa(scene) {
  return scene.personagemSelecionada === "personagem3";
}

function personagem4Ativa(scene) {
  return scene.personagemSelecionada === "personagem4";
}

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

function texturaWalk(scene, direcao = scene.direcaoAtual) {
  if (personagem4Ativa(scene)) {
    return "personagem4-walk";
  }
  if (personagem3Ativa(scene)) {
    return "personagem3-walk";
  }
  return personagem2Ativa(scene) ? "personagem2-walk" : "walk";
}

function configurarFiltroPersonagem2(scene) {
  const texture = scene.textures.get("personagem2-walk");
  texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
}

function configurarVisualWalk(scene) {
  scene.player.setOrigin(0.5, 0.5);
  if (personagem3Ativa(scene)) {
    scene.player.setDisplayOrigin(64, 68);
  }
}

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

function calcularFootYPlayer(scene) {
  if (!scene?.player?.body) {
    return scene?.player?.getBounds().bottom ?? 0;
  }

  return scene.player.body.bottom;
}

function atualizarDepthPlayer(scene) {
  if (!scene?.player?.active) {
    return;
  }

  const footY = calcularFootYPlayer(scene);
  const depth = scene.calcularDepthMundo
    ? scene.calcularDepthMundo(footY)
    : 12.5 + footY * 0.0003;

  scene.player.setDepth(depth);

  if (scene.DEBUG_DEPTH_SORTING) {
    console.log({ playerY: scene.player.y, footY, depth });
  }
}

// =====================================================
// CRIA PLAYER
// =====================================================

function criarPlayer(scene) {
  // =====================================================
  // PERSONAGEM
  // =====================================================

  scene.player = scene.physics.add.sprite(
    scene.respawnX,
    scene.respawnY,
    texturaWalk(scene, "down"),
    frameParado(scene, "down"),
  );

  if (personagem2Ativa(scene)) {
    configurarFiltroPersonagem2(scene);
  }

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

function configurarHitboxWalk(scene) {
  if (!scene.player || !scene.player.body) {
    return;
  }

  if (personagem2Ativa(scene)) {
    scene.player.body.setSize(23, 11);
    scene.player.body.setOffset(21, 47);
    return;
  }
  if (personagem3Ativa(scene)) {
    scene.player.body.setSize(30, 15);
    scene.player.body.setOffset(50, 78);
    return;
  }
  if (personagem4Ativa(scene)) {
    scene.player.body.setSize(30, 15);
    scene.player.body.setOffset(18, 45);
    return;
  }
  scene.player.body.setSize(30, 15);
  scene.player.body.setOffset(49, 82);
}

// =====================================================
// HITBOX DE COLISÃO - ATAQUE
// =====================================================
// Os offsets variam conforme o tamanho da folha de cada personagem.
// =====================================================

function configurarHitboxAtaque(scene) {
  if (!scene.player || !scene.player.body) {
    return;
  }

  if (personagem2Ativa(scene)) {
    // O displayOrigin desloca somente o desenho; o body permanece alinhado ao walk.
    scene.player.body.setSize(23, 11);
    scene.player.body.setOffset(48, 72);
    return;
  }
  if (personagem3Ativa(scene)) {
    scene.player.body.setSize(30, 15);
    scene.player.body.setOffset(20, 43);
    return;
  }
  if (personagem4Ativa(scene)) {
    scene.player.body.setSize(30, 15);
    scene.player.body.setOffset(82, 99);
    return;
  }
  scene.player.body.setSize(30, 50);
  scene.player.body.setOffset(49, 73);
}

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
  scene.player.setOrigin(0.5, 0.5);
}

// =====================================================
// ATUALIZA HITBOX DE DANO
// =====================================================

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

      const alvos = Array.isArray(scene.inimigos)
        ? scene.inimigos.filter((inimigo) => inimigo && inimigo.active)
        : scene.inimigoTeste && scene.inimigoTeste.active
          ? [scene.inimigoTeste]
          : [];

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

        causarDanoInimigo(scene, inimigo, 25);
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

function atacar(scene) {
  // =====================================================
  // JÁ ESTÁ ATACANDO
  // =====================================================

  if (scene.atacando) {
    return;
  }

  // =====================================================
  // ESTAMINA
  // =====================================================

  const podeAtacar = gastarEstamina(scene, scene.custoAtaque);

  if (!podeAtacar) {
    return;
  }

  // =====================================================
  // INICIA ATAQUE
  // =====================================================

  scene.atacando = true;
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
    scene.player.anims.play(`aria-charge-${scene.direcaoAtaque}`, false);
    configurarHitboxAtaque(scene);
    return;
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
}

function soltarAtaque(scene) {
  if (
    !personagem3Ativa(scene) ||
    !scene.atacando ||
    !scene.ariaAtaqueCarregando
  ) {
    return;
  }

  scene.ariaAtaqueCarregando = false;
  dispararProjetil(scene);
  scene.player.anims.play(`aria-release-${scene.direcaoAtaque}`, false);
  criarHitboxKatana(scene);
  configurarHitboxAtaque(scene);
}

// =====================================================
// RESPAWN
// =====================================================

function respawnPlayer(scene) {
  // =====================================================
  // PARA MOVIMENTO
  // =====================================================

  scene.player.setVelocity(0, 0);

  // =====================================================
  // RESETA ESTADO
  // =====================================================

  scene.atacando = false;
  scene.ariaAtaqueCarregando = false;

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
  respawnPlayer,
  atualizarHitboxDanoPlayer,
  atualizarDepthPlayer,
};
