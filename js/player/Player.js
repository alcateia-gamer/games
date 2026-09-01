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

  scene.player.setDepth(50);

  // =====================================================
  // FIM DO ATAQUE
  // =====================================================

  scene.player.on("animationcomplete", (animation) => {
    if (!animation.key.startsWith("attack-")) {
      return;
    }

    scene.atacando = false;

    scene.player.setVelocity(0, 0);

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
  let x = scene.player.x;

  let y = scene.player.y;

  let largura = 50;

  let altura = 50;

  // =====================================================
  // CIMA
  // =====================================================

  if (scene.direcaoAtual === "up") {
    y -= 42;

    largura = 42;

    altura = 55;
  }

  // =====================================================
  // BAIXO
  // =====================================================
  else if (scene.direcaoAtual === "down") {
    y += 42;

    largura = 42;

    altura = 55;
  }

  // =====================================================
  // ESQUERDA
  // =====================================================
  else if (scene.direcaoAtual === "left") {
    x -= 42;

    largura = 55;

    altura = 42;
  }

  // =====================================================
  // DIREITA
  // =====================================================
  else if (scene.direcaoAtual === "right") {
    x += 42;

    largura = 55;

    altura = 42;
  }

  // =====================================================
  // ZONA TEMPORÁRIA
  // =====================================================

  const hitbox = scene.add.zone(x, y, largura, altura);

  scene.physics.add.existing(hitbox);

  hitbox.body.setAllowGravity(false);

  hitbox.body.setImmovable(true);

  // =====================================================
  // VERIFICA DANO
  // =====================================================

  if (scene.inimigoTeste && scene.inimigoTeste.active) {
    scene.physics.overlap(hitbox, scene.inimigoTeste, () => {
      causarDanoInimigo(scene, 25);
    });
  }

  // =====================================================
  // DESTRÓI A HITBOX
  // =====================================================

  scene.time.delayedCall(100, () => {
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

  scene.player.setVelocity(0, 0);

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
