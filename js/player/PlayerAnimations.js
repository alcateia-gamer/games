function criarAnimacoesPlayer(scene) {
  const criarFramesIntercalados = (texture, indices) =>
    indices.map((frame) => ({ key: texture, frame }));

  const personagem2 = scene.personagemSelecionada === "personagem2";
  const personagem3 = scene.personagemSelecionada === "personagem3";
  const personagem4 = scene.personagemSelecionada === "personagem4";

  const walkFrames = personagem3
    ? {
        down: [0, 4, 8, 12],
        up: [1, 5, 9, 13],
        left: [3, 7, 11, 15],
        right: [2, 6, 10, 14],
      }
    : personagem2
      ? { up: [24, 31], left: [8, 15], down: [0, 7], right: [40, 47] }
      : personagem4
        ? { up: [0, 8], left: [9, 17], down: [18, 26], right: [27, 35] }
        : { up: [0, 8], left: [13, 21], down: [26, 34], right: [39, 47] };
  const idleFrames = personagem3
    ? {
        down: [0, 4, 8, 12],
        up: [1, 5, 9, 13],
        left: [3, 7, 11, 15],
        right: [2, 6, 10, 14],
      }
    : personagem4
      ? { up: [0, 0], left: [9, 9], down: [18, 18], right: [27, 27] }
      : walkFrames;
  const walkTexture = personagem3
    ? "personagem3-walk"
    : personagem2
      ? "personagem2-walk"
      : personagem4
        ? "personagem4-walk"
        : "walk";
  const idleTexture = personagem3
    ? "personagem3-idle"
    : personagem2
      ? "personagem2-walk"
      : personagem4
        ? "personagem4-walk"
        : "walk";
  const attackTexture = personagem3
    ? "personagem3-attack"
    : personagem2
      ? "personagem2-walk"
      : personagem4
        ? "personagem4-attack"
        : "attack";

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

  Object.entries(walkFrames).forEach(([direcao, frames]) => {
    scene.anims.create({
      key: `walk-${direcao}`,
      frames: personagem3
        ? criarFramesIntercalados(walkTexture, frames)
        : scene.anims.generateFrameNumbers(walkTexture, {
            start: frames[0],
            end: frames[1],
          }),
      frameRate: 20,
      repeat: -1,
    });
  });

  Object.entries(idleFrames).forEach(([direcao, frames]) => {
    scene.anims.create({
      key: `idle-${direcao}`,
      frames: personagem3
        ? criarFramesIntercalados(idleTexture, frames)
        : scene.anims.generateFrameNumbers(idleTexture, {
            start: frames[0],
            end: frames[1],
          }),
      frameRate: 8,
      repeat: -1,
    });
  });

  const attackFrames =
    personagem3 || personagem2
      ? walkFrames
      : personagem4
        ? {
            up: [0, 1, 2, 3, 4, 5],
            left: [6, 7, 8, 9, 10, 11],
            down: [12, 13, 14, 15, 16, 17],
            right: [18, 19, 20, 21, 22, 23],
          }
        : { up: [0, 5], left: [6, 11], down: [12, 17], right: [18, 23] };

  Object.entries(attackFrames).forEach(([direcao, frames]) => {
    scene.anims.create({
      key: `attack-${direcao}`,
      frames: personagem3
        ? criarFramesIntercalados(attackTexture, frames)
        : scene.anims.generateFrameNumbers(attackTexture, {
            ...(personagem4
              ? { frames }
              : { start: frames[0], end: frames[1] }),
          }),
      frameRate: 20,
      repeat: 0,
    });
  });
}

export default criarAnimacoesPlayer;
