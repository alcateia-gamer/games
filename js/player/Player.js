import { gastarEstamina } from "./PlayerStatus.js";

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
  // FIM DA ANIMAÇÃO DE ATAQUE
  // =====================================================

  scene.player.on("animationcomplete", (animation) => {
    if (!animation.key.startsWith("attack-")) {
      return;
    }

    scene.atacando = false;

    scene.player.setVelocity(0, 0);

    // =================================================
    // VOLTA PARA A DIREÇÃO CORRETA
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
// ATAQUE
// =====================================================

function atacar(scene) {
  // =====================================================
  // NÃO PODE ATACAR DURANTE OUTRO ATAQUE
  // =====================================================

  if (scene.atacando) {
    return;
  }

  // =====================================================
  // VERIFICA E GASTA ESTAMINA
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
  // ATAQUE PARA CIMA
  // =====================================================

  if (scene.direcaoAtual === "up") {
    scene.player.anims.play("attack-up", true);
  }

  // =====================================================
  // ATAQUE PARA ESQUERDA
  // =====================================================
  else if (scene.direcaoAtual === "left") {
    scene.player.anims.play("attack-left", true);
  }

  // =====================================================
  // ATAQUE PARA BAIXO
  // =====================================================
  else if (scene.direcaoAtual === "down") {
    scene.player.anims.play("attack-down", true);
  }

  // =====================================================
  // ATAQUE PARA DIREITA
  // =====================================================
  else if (scene.direcaoAtual === "right") {
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
  // RECUPERA VIDA E ESTAMINA
  // =====================================================

  scene.vida = scene.vidaMaxima;

  scene.estamina = scene.estaminaMaxima;
}

export { criarPlayer, atacar, respawnPlayer };
