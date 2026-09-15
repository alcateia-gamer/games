import { gastarEstamina } from "./PlayerStatus.js";

import { causarDanoInimigo } from "../enemies/EnemyTest.js";

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

function texturaWalk(scene, direcao = scene.direcaoAtual) {
  if (personagem4Ativa(scene)) {
    return "personagem4";
  }
  if (personagem3Ativa(scene)) {
    return "personagem3-walk";
  }
  return personagem2Ativa(scene) ? "personagem2-walk" : "walk";
}

function configurarFiltroPersonagem2(scene) {
  ["personagem2-walk", "personagem2-attack", "personagem2-idle"].forEach(
    (textureKey) => {
      const texture = scene.textures.get(textureKey);
      texture?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    },
  );
}

function frameParado(scene, direcao = scene.direcaoAtual) {
  const frames = personagem4Ativa(scene)
    ? { down: 0, up: 0, left: 0, right: 0 }
    : personagem3Ativa(scene)
      ? { down: 0, up: 1, left: 3, right: 2 }
      : personagem2Ativa(scene)
        ? { up: 24, left: 8, down: 0, right: 40 }
        : { up: 0, left: 13, down: 26, right: 39 };
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
    scene.player.setScale(1.6, 1.6);
  }

  scene.player.setAlpha(1).clearTint().setBlendMode(Phaser.BlendModes.NORMAL);

  scene.player.invulneravel = false;

  if (personagem2Ativa(scene) || personagem3Ativa(scene)) {
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
    if (!animation.key.startsWith("attack-")) {
      return;
    }

    // =================================================
    // ATAQUE TERMINOU
    // =================================================

    scene.atacando = false;

    // =================================================
    // VOLTA PARA WALK
    // =================================================

    scene.player.setTexture(texturaWalk(scene), frameParado(scene));

    // =================================================
    // RESTAURA HITBOX PARA WALK 64x64
    // =================================================

    configurarHitboxWalk(scene);
  });
}

// =====================================================
// HITBOX DE COLISÃO - WALK
// =====================================================
// SPRITE: 64x64
// =====================================================

function configurarHitboxWalk(scene) {
  if (!scene.player || !scene.player.body) {
    return;
  }

  if (personagem2Ativa(scene)) {
    scene.player.body.setSize(23, 11);
    scene.player.body.setOffset(13, 34);
    return;
  }
  if (personagem3Ativa(scene)) {
    scene.player.body.setSize(30, 15);
    scene.player.body.setOffset(18, 41);
    return;
  }
  scene.player.body.setSize(30, 15);
  scene.player.body.setOffset(18, 45);
}

// =====================================================
// HITBOX DE COLISÃO - ATAQUE
// =====================================================
// WALK = 64x64
// ATAQUE = 128x128
//
// DIFERENÇA:
// (128 - 64) / 2 = 32
//
// OFFSET WALK:
// X = 18
// Y = 45
//
// OFFSET ATAQUE:
// X = 18 + 32 = 50
// Y = 45 + 32 = 77
// =====================================================

function configurarHitboxAtaque(scene) {
  if (!scene.player || !scene.player.body) {
    return;
  }

  if (personagem2Ativa(scene) || personagem3Ativa(scene)) {
    configurarHitboxWalk(scene);
    return;
  }
  scene.player.body.setSize(30, 15);
  scene.player.body.setOffset(50, 77);
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

    if (scene.direcaoAtual === "up") {
      centroY -= 26;

      largura = 90;

      altura = 44;
    }

    // =================================================
    // BAIXO
    // =================================================
    else if (scene.direcaoAtual === "down") {
      centroY += 26;

      largura = 90;

      altura = 44;
    }

    // =================================================
    // ESQUERDA
    // =================================================
    else if (scene.direcaoAtual === "left") {
      centroX -= 30;

      largura = 44;

      altura = 90;
    }

    // =================================================
    // DIREITA
    // =================================================
    else if (scene.direcaoAtual === "right") {
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
          scene.sound.play("katana-ataque");
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
      scene.sound.play("ataque-no-ar");
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

  // =====================================================
  // HITBOX DA KATANA
  // =====================================================

  criarHitboxKatana(scene);

  // =====================================================
  // ANIMAÇÃO
  // =====================================================

  if (personagem4Ativa(scene)) {
    scene.atacando = false;
    return;
  }

  if (scene.direcaoAtual === "up") {
    scene.player.anims.play("attack-up", true);
  } else if (scene.direcaoAtual === "left") {
    scene.player.anims.play("attack-left", true);
  } else if (scene.direcaoAtual === "down") {
    scene.player.anims.play("attack-down", true);
  } else if (scene.direcaoAtual === "right") {
    scene.player.anims.play("attack-right", true);
  }

  // =====================================================
  // IMPORTANTE
  //
  // A TEXTURA AGORA É 128x128.
  // COMPENSA O OFFSET PARA A COLISÃO CONTINUAR
  // EXATAMENTE NA REGIÃO DOS PÉS.
  // =====================================================

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

  scene.direcaoAtual = "down";

  scene.player.anims.stop();

  // =====================================================
  // VOLTA PARA WALK
  // =====================================================

  scene.player.setTexture(
    texturaWalk(scene, "down"),
    frameParado(scene, "down"),
  );

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
  respawnPlayer,
  atualizarHitboxDanoPlayer,
  atualizarDepthPlayer,
};
