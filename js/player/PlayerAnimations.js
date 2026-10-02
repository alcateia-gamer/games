function criarAnimacoesPlayer(scene) {
  // Para usar uma sequência manual, informe os índices dos quadros na ordem desejada.
  // A numeração começa em 0 e corresponde à folha carregada no preloader.
  const criarFramesIntercalados = (texture, indices) =>
    indices.map((frame) => ({ key: texture, frame }));

  const personagem2 = scene.personagemSelecionada === "personagem2";
  const personagem3 = scene.personagemSelecionada === "personagem3";
  const personagem4 = scene.personagemSelecionada === "personagem4";

  // Caminhada por direção: up = cima, left = esquerda, down = baixo, right = direita.
  // Nos personagens 2, 4 e padrão, cada par [início, fim] é um intervalo inclusivo.
  // Na personagem 3, cada lista contém os índices exatos e pode ser reordenada livremente.
  const walkFrames = personagem3
    ? {
        up: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        left: [9, 10, 11, 12, 13, 14, 15, 16, 17],
        down: [18, 19, 20, 21, 22, 23, 24, 25, 26],
        right: [27, 28, 29, 30, 31, 32, 33, 34, 35],
      }
    : personagem2
      ? { up: [0, 8], left: [9, 17], down: [18, 26], right: [27, 35] }
      : personagem4
        ? { up: [0, 8], left: [9, 17], down: [18, 26], right: [27, 35] }
        : { up: [0, 8], left: [9, 17], down: [18, 26], right: [27, 35] };
  // Quadros da pose parada por direção. Para deixar uma pose fixa, use [quadro, quadro].
  const idleFrames = personagem3
    ? { up: [0, 0], left: [9, 9], down: [18, 18], right: [27, 27] }
    : personagem4
      ? { up: [0, 0], left: [9, 9], down: [18, 18], right: [27, 27] }
      : walkFrames;
  // Texturas usadas por cada animação. Se trocar a textura, confira os índices abaixo.
  const walkTexture = personagem3
    ? "personagem3-walk"
    : personagem2
      ? "personagem2-walk"
      : personagem4
        ? "personagem4-walk"
        : "walk";
  const idleTexture = personagem3
    ? "personagem3-walk"
    : personagem2
      ? "personagem2-walk"
      : personagem4
        ? "personagem4-walk"
        : "walk";
  const attackTexture = personagem3
    ? "personagem3-attack"
    : personagem2
      ? "personagem2-attack"
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
    "aria-charge-up",
    "aria-charge-left",
    "aria-charge-down",
    "aria-charge-right",
    "aria-release-up",
    "aria-release-left",
    "aria-release-down",
    "aria-release-right",
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

  // Quadros do ataque normal por direção; os índices seguem a mesma convenção da caminhada.
  const attackFrames = personagem3
    ? walkFrames
    : personagem2
      ? {
          up: [0, 1, 2, 3, 4, 5, 6],
          left: [7, 8, 9, 10, 11, 12, 13, 14, 15],
          down: [16, 17, 18, 19, 20, 21, 22, 23, 24],
          right: [25, 26, 27, 28, 29, 30, 31, 32, 33],
        }
      : personagem4
        ? {
            up: [0, 1, 2, 3, 4, 5],
            left: [6, 7, 8, 9, 10, 11],
            down: [12, 13, 14, 15, 16, 17],
            right: [18, 19, 20, 21, 22, 23],
          }
        : { up: [0, 5], left: [6, 11], down: [12, 17], right: [18, 23] };

  if (personagem3) {
    // Sequências exclusivas da Aria: charge = carregamento; release = disparo.
    // Cada direção aceita uma lista explícita de quadros na ordem de reprodução.
    const ariaAttackFrames = {
      up: {
        charge: [0, 1, 2, 3, 4, 5, 6, 7, 8],
        release: [9, 10, 11, 12],
      },
      left: {
        charge: [13, 14, 15, 16, 17, 18, 19, 20, 21],
        release: [22, 23, 24, 25],
      },
      down: {
        charge: [26, 27, 28, 29, 30, 31, 32, 33, 34],
        release: [35, 36, 37, 38],
      },
      right: {
        charge: [39, 40, 41, 42, 43, 44, 45, 46, 47],
        release: [48, 49, 50, 51],
      },
    };

    Object.entries(ariaAttackFrames).forEach(([direcao, frames]) => {
      scene.anims.create({
        key: `aria-charge-${direcao}`,
        frames: criarFramesIntercalados(attackTexture, frames.charge),
        frameRate: 12,
        repeat: 0,
      });
      scene.anims.create({
        key: `aria-release-${direcao}`,
        frames: criarFramesIntercalados(attackTexture, frames.release),
        frameRate: 20,
        repeat: 0,
      });
    });
  }

  Object.entries(attackFrames).forEach(([direcao, frames]) => {
    scene.anims.create({
      key: `attack-${direcao}`,
      frames:
        personagem2 || personagem4
          ? criarFramesIntercalados(attackTexture, frames)
          : personagem3
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
