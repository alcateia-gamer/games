function criarAnimacoesPlayer(scene) {
  // =====================================================
  // CAMINHADA
  // =====================================================

  scene.anims.create({
    key: "walk-up",
    frames: scene.anims.generateFrameNumbers("walk", {
      start: 0,
      end: 8,
    }),
    frameRate: 12,
    repeat: -1,
  });

  scene.anims.create({
    key: "walk-left",
    frames: scene.anims.generateFrameNumbers("walk", {
      start: 13,
      end: 21,
    }),
    frameRate: 12,
    repeat: -1,
  });

  scene.anims.create({
    key: "walk-down",
    frames: scene.anims.generateFrameNumbers("walk", {
      start: 26,
      end: 34,
    }),
    frameRate: 12,
    repeat: -1,
  });

  scene.anims.create({
    key: "walk-right",
    frames: scene.anims.generateFrameNumbers("walk", {
      start: 39,
      end: 47,
    }),
    frameRate: 12,
    repeat: -1,
  });

  // =====================================================
  // ATAQUE
  // =====================================================

  scene.anims.create({
    key: "attack-up",
    frames: scene.anims.generateFrameNumbers("attack", {
      start: 0,
      end: 5,
    }),
    frameRate: 12,
    repeat: 0,
  });

  scene.anims.create({
    key: "attack-left",
    frames: scene.anims.generateFrameNumbers("attack", {
      start: 6,
      end: 11,
    }),
    frameRate: 12,
    repeat: 0,
  });

  scene.anims.create({
    key: "attack-down",
    frames: scene.anims.generateFrameNumbers("attack", {
      start: 12,
      end: 17,
    }),
    frameRate: 12,
    repeat: 0,
  });

  scene.anims.create({
    key: "attack-right",
    frames: scene.anims.generateFrameNumbers("attack", {
      start: 18,
      end: 23,
    }),
    frameRate: 12,
    repeat: 0,
  });
}

export default criarAnimacoesPlayer;
