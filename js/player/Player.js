import { gastarEstamina } from "./PlayerStatus.js";

import { causarDanoInimigo } from "../enemies/EnemyTest.js";

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
    "walk",
    26,
  );

  scene.player.body.setAllowGravity(false);

  scene.player.setDepth(12);

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

  // =====================================================
  // ATUALIZA POSIÇÃO INICIAL
  // =====================================================

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

    if (scene.direcaoAtual === "up") {
      scene.player.setTexture("walk", 0);
    } else if (scene.direcaoAtual === "left") {
      scene.player.setTexture("walk", 13);
    } else if (scene.direcaoAtual === "down") {
      scene.player.setTexture("walk", 26);
    } else if (scene.direcaoAtual === "right") {
      scene.player.setTexture("walk", 39);
    }

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

  scene.player.body.setSize(30, 15);

  scene.player.body.setOffset(18, 50);
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
// Y = 50
//
// OFFSET ATAQUE:
// X = 18 + 32 = 50
// Y = 50 + 32 = 82
// =====================================================

function configurarHitboxAtaque(scene) {
  if (!scene.player || !scene.player.body) {
    return;
  }

  scene.player.body.setSize(30, 15);

  scene.player.body.setOffset(50, 82);
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

  const largura = 38;

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

  // =====================================================
  // DEBUG
  // =====================================================

  const debugKatana = scene.add.graphics();

  debugKatana.setDepth(101);

  // =====================================================
  // ATUALIZA HITBOX
  // =====================================================

  const atualizarHitboxKatana = () => {
    if (!scene.player || !scene.player.active) {
      return;
    }

    let centroX = scene.player.x;

    let centroY = scene.player.y;

    let largura = 40;

    let altura = 40;

    // =================================================
    // CIMA
    // =================================================

    if (scene.direcaoAtual === "up") {
      centroY -= 35;

      largura = 34;

      altura = 42;
    }

    // =================================================
    // BAIXO
    // =================================================
    else if (scene.direcaoAtual === "down") {
      centroY += 35;

      largura = 34;

      altura = 42;
    }

    // =================================================
    // ESQUERDA
    // =================================================
    else if (scene.direcaoAtual === "left") {
      centroX -= 35;

      largura = 42;

      altura = 34;
    }

    // =================================================
    // DIREITA
    // =================================================
    else if (scene.direcaoAtual === "right") {
      centroX += 35;

      largura = 42;

      altura = 34;
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

      // ===============================================
      // INIMIGO NÃO EXISTE
      // ===============================================

      if (
        !scene.inimigoTeste ||
        !scene.inimigoTeste.active ||
        !scene.inimigoTeste.body
      ) {
        return;
      }

      // ===============================================
      // HITBOX DO INIMIGO
      // ===============================================

      const hitboxInimigo = new Phaser.Geom.Rectangle(
        scene.inimigoTeste.body.x,
        scene.inimigoTeste.body.y,
        scene.inimigoTeste.body.width,
        scene.inimigoTeste.body.height,
      );

      // ===============================================
      // KATANA X INIMIGO
      // ===============================================

      const acertou = Phaser.Geom.Intersects.RectangleToRectangle(
        hitboxKatana,
        hitboxInimigo,
      );

      if (!acertou) {
        return;
      }

      // ===============================================
      // DANO UMA VEZ
      // ===============================================

      jaAcertou = true;

      causarDanoInimigo(scene, 25);
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

  scene.player.setTexture("walk", 26);

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

export { criarPlayer, atacar, respawnPlayer, atualizarHitboxDanoPlayer };
