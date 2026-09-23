function criarAnimacoesPlayer(scene) {
  const criarFramesIntercalados = (texture, indices) =>
    indices.map((frame) => ({ key: texture, frame }));

  const personagem2 = scene.personagemSelecionada === "personagem2";
  const personagem3 = scene.personagemSelecionada === "personagem3";
  const personagem4 = scene.personagemSelecionada === "personagem4";

  if (personagem4) {
    const direcoesPersonagem4 = {
      down: { idle: 0, walk: [0, 8] },
      left: { idle: 18, walk: [18, 26] },
      right: { idle: 9, walk: [9, 17] },
      up: { idle: 27, walk: [27, 35] },
    };

    ["walk", "idle"].forEach((tipo) => {
      Object.entries(direcoesPersonagem4).forEach(([direcao, ciclos]) => {
        const chave = `${tipo}-${direcao}`;
        if (scene.anims.exists(chave)) {
          scene.anims.remove(chave);
        }
        scene.anims.create({
          key: chave,
          frames: scene.anims.generateFrameNumbers("personagem4-walk", {
            start: tipo === "idle" ? ciclos.idle : ciclos.walk[0],
            end: tipo === "idle" ? ciclos.idle : ciclos.walk[1],
          }),
          frameRate: tipo === "idle" ? 4 : 12,
          repeat: -1,
        });
      });
    });

    const ataquesPersonagem4 = {
      down: [0, 5],
      left: [6, 11],
      right: [12, 17],
      up: [18, 23],
    };

    Object.entries(ataquesPersonagem4).forEach(([direcao, frames]) => {
        const chave = `attack-${direcao}`;
        if (scene.anims.exists(chave)) {
          scene.anims.remove(chave);
        }
        scene.anims.create({
          key: chave,
          frames: scene.anims.generateFrameNumbers("personagem4-attack", {
            start: frames[0],
            end: frames[1],
          }),
          frameRate: 12,
          repeat: 0,
        });
    });
    return;
  }
  const walkFrames = personagem3
    ? {
        down: [0, 4, 8, 12],
        up: [1, 5, 9, 13],
        left: [3, 7, 11, 15],
        right: [2, 6, 10, 14],
      }
    : personagem2
      ? { up: [24, 31], left: [8, 15], down: [0, 7], right: [40, 47] }
      : { up: [0, 8], left: [13, 21], down: [26, 34], right: [39, 47] };
  const idleFrames = personagem3
    ? {
        down: [0, 4, 8, 12],
        up: [1, 5, 9, 13],
        left: [3, 7, 11, 15],
        right: [2, 6, 10, 14],
      }
    : walkFrames;
  const walkTexture = personagem3
    ? "personagem3-walk"
    : personagem2
      ? "personagem2-walk"
      : "walk";
  const idleTexture = personagem3
    ? "personagem3-idle"
    : personagem2
      ? "personagem2-idle"
      : "walk";
  const attackTexture = personagem3
    ? "personagem3-attack"
    : personagem2
      ? "personagem2-attack"
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

  const attackFrames = personagem3
    ? walkFrames
    : personagem2
      ? walkFrames
      : { up: [0, 5], left: [6, 11], down: [12, 17], right: [18, 23] };

  Object.entries(attackFrames).forEach(([direcao, frames]) => {
    scene.anims.create({
      key: `attack-${direcao}`,
      frames: personagem3
        ? criarFramesIntercalados(attackTexture, frames)
        : scene.anims.generateFrameNumbers(attackTexture, {
            start: frames[0],
            end: frames[1],
          }),
      frameRate: 20,
      repeat: 0,
    });
  });
}

export default criarAnimacoesPlayer;
