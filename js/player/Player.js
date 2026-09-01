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
  // FIM DA ANIMAÇÃO DE ATAQUE
  // =====================================================

  scene.player.on("animationcomplete", (animation) => {
    if (!animation.key.startsWith("attack-")) {
      return;
    }

    scene.atacando = false;

    scene.player.setVelocity(0, 0);

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
  if (scene.atacando) {
    return;
  }

  scene.atacando = true;

  scene.player.setVelocity(0, 0);

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
}

export { criarPlayer, atacar, respawnPlayer };
