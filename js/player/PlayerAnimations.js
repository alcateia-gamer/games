function criarAnimacoesPlayer(scene) {
  const personagem2 = scene.personagemSelecionada === "personagem2";
  const walkTexture = personagem2 ? "personagem2-walk" : "walk";
  const attackTexture = personagem2 ? "personagem2-attack" : "attack";
  const idleTexture = personagem2 ? "personagem2-idle" : walkTexture;
  const walkFrames = personagem2
    ? { up: [24, 31], left: [8, 15], down: [0, 7], right: [40, 47] }
    : { up: [0, 8], left: [13, 21], down: [26, 34], right: [39, 47] };
  const attackFrames = personagem2
    ? walkFrames
    : { up: [0, 5], left: [6, 11], down: [12, 17], right: [18, 23] };

  [
    "walk-up",
    "walk-left",
    "walk-down",
    "walk-right",
    "attack-up",
    "attack-left",
    "attack-down",
    "attack-right",
    "idle-up",
    "idle-left",
    "idle-down",
    "idle-right",
  ].forEach((key) => {
    if (scene.anims.exists(key)) {
      scene.anims.remove(key);
    }
  });

  Object.entries(walkFrames).forEach(([direcao, [start, end]]) => {
    scene.anims.create({
      key: `walk-${direcao}`,
      frames: scene.anims.generateFrameNumbers(walkTexture, { start, end }),
      frameRate: 20,
      repeat: -1,
    });
    scene.anims.create({
      key: `idle-${direcao}`,
      frames: scene.anims.generateFrameNumbers(idleTexture, { start, end }),
      frameRate: 8,
      repeat: -1,
    });
  });

  Object.entries(attackFrames).forEach(([direcao, [start, end]]) => {
    scene.anims.create({
      key: `attack-${direcao}`,
      frames: scene.anims.generateFrameNumbers(attackTexture, { start, end }),
      frameRate: 20,
      repeat: 0,
    });
  });
}

export default criarAnimacoesPlayer;
