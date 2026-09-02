import { gastarEstamina } from "./PlayerStatus.js";

import { causarDanoInimigo } from "../enemies/EnemyTest.js";

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
  // HITBOX FÍSICA DO PERSONAGEM
  // =====================================================
  // O sprite continua 64x64.
  // Apenas a área de colisão fica menor.
  // =====================================================

  scene.player.body.setSize(28, 38);

  scene.player.body.setOffset(18, 20);

  // =====================================================
  // FIM DO ATAQUE
  // =====================================================

  scene.player.on("animationcomplete", (animation) => {
    if (!animation.key.startsWith("attack-")) {
      return;
    }

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
  });
}

// =====================================================
// CRIA HITBOX DO ATAQUE
// =====================================================

function criarHitboxKatana(scene) {
  // =====================================================
  // ZONA TEMPORÁRIA
  // =====================================================

  const hitbox = scene.add.zone(scene.player.x, scene.player.y, 40, 40);

  scene.physics.add.existing(hitbox);

  hitbox.body.setAllowGravity(false);

  hitbox.body.setImmovable(true);

  // =====================================================
  // CONTROLE DE DANO
  // =====================================================

  hitbox.jaAcertou = false;

  // =====================================================
  // ATUALIZA POSIÇÃO DA HITBOX
  // =====================================================

  const atualizarHitbox = () => {
    if (!hitbox || !hitbox.active || !scene.player || !scene.player.active) {
      return;
    }

    let x = scene.player.x;

    let y = scene.player.y;

    let largura = 40;

    let altura = 40;

    // ===================================================
    // CIMA
    // ===================================================

    if (scene.direcaoAtual === "up") {
      y -= 35;

      largura = 34;

      altura = 42;
    }

    // ===================================================
    // BAIXO
    // ===================================================
    else if (scene.direcaoAtual === "down") {
      y += 35;

      largura = 34;

      altura = 42;
    }

    // ===================================================
    // ESQUERDA
    // ===================================================
    else if (scene.direcaoAtual === "left") {
      x -= 35;

      largura = 42;

      altura = 34;
    }

    // ===================================================
    // DIREITA
    // ===================================================
    else if (scene.direcaoAtual === "right") {
      x += 35;

      largura = 42;

      altura = 34;
    }

    // ===================================================
    // MOVE A HITBOX
    // ===================================================

    hitbox.setPosition(x, y);

    hitbox.body.setSize(largura, altura);
  };

  // =====================================================
  // POSIÇÃO INICIAL
  // =====================================================

  atualizarHitbox();

  // =====================================================
  // ATUALIZA ENQUANTO O ATAQUE EXISTIR
  // =====================================================

  const eventoHitbox = scene.time.addEvent({
    delay: 16,

    loop: true,

    callback: () => {
      atualizarHitbox();

      // =================================================
      // VERIFICA DANO
      // =================================================

      if (
        !hitbox.jaAcertou &&
        scene.inimigoTeste &&
        scene.inimigoTeste.active
      ) {
        scene.physics.overlap(hitbox, scene.inimigoTeste, () => {
          if (hitbox.jaAcertou) {
            return;
          }

          hitbox.jaAcertou = true;

          causarDanoInimigo(scene, 25);
        });
      }
    },
  });

  // =====================================================
  // DESTRÓI A HITBOX
  // =====================================================

  scene.time.delayedCall(140, () => {
    if (eventoHitbox) {
      eventoHitbox.remove();
    }

    if (hitbox && hitbox.active) {
      hitbox.destroy();
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
  // CRIA HITBOX
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
}

// =====================================================
// RESPAWN
// =====================================================

function respawnPlayer(scene) {
  scene.player.setVelocity(0, 0);

  scene.atacando = false;

  scene.direcaoAtual = "down";

  scene.player.anims.stop();

  scene.player.setTexture("walk", 26);

  scene.player.setPosition(scene.respawnX, scene.respawnY);

  // =====================================================
  // RECUPERA VIDA
  // =====================================================

  scene.vida = scene.vidaMaxima;

  // =====================================================
  // RECUPERA ESTAMINA
  // =====================================================

  scene.estamina = scene.estaminaMaxima;
}

export { criarPlayer, atacar, respawnPlayer };
