function criarAnimacoesInimigo(scene) {
  // As duas texturas de inimigo usam a mesma grade de quadros por direção.
  const estados = [
    { key: "normal", texture: "robo-teste-normal" },
    { key: "alerta", texture: "robo-teste" },
  ];

  for (const estado of estados) {
    const prefixo = estado.key === "alerta" ? "robo-alerta" : "robo";

    if (!scene.anims.exists(`${prefixo}-down`)) {
      scene.anims.create({
        key: `${prefixo}-down`,
        frames: scene.anims.generateFrameNumbers(estado.texture, {
          // down = baixo; intervalo inclusivo de quadros da direção.
          start: 0,
          end: 2,
        }),
        frameRate: 6,
        repeat: -1,
      });
    }

    if (!scene.anims.exists(`${prefixo}-left`)) {
      scene.anims.create({
        key: `${prefixo}-left`,
        frames: scene.anims.generateFrameNumbers(estado.texture, {
          // left = esquerda; intervalo inclusivo de quadros da direção.
          start: 3,
          end: 5,
        }),
        frameRate: 6,
        repeat: -1,
      });
    }

    if (!scene.anims.exists(`${prefixo}-right`)) {
      scene.anims.create({
        key: `${prefixo}-right`,
        frames: scene.anims.generateFrameNumbers(estado.texture, {
          // right = direita; intervalo inclusivo de quadros da direção.
          start: 6,
          end: 8,
        }),
        frameRate: 6,
        repeat: -1,
      });
    }

    if (!scene.anims.exists(`${prefixo}-up`)) {
      scene.anims.create({
        key: `${prefixo}-up`,
        frames: scene.anims.generateFrameNumbers(estado.texture, {
          // up = cima; intervalo inclusivo de quadros da direção.
          start: 9,
          end: 11,
        }),
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  // Quadros usados na animação de morte; start/end determinam a direção do robô.
  const direcoes = [
    { key: "down", start: 0, end: 2 },
    { key: "left", start: 3, end: 5 },
    { key: "right", start: 6, end: 8 },
    { key: "up", start: 9, end: 11 },
  ];

  for (const direcao of direcoes) {
    const chave = `robo-morte-${direcao.key}`;

    if (!scene.anims.exists(chave)) {
      scene.anims.create({
        key: chave,
        frames: [
          { key: "robo-morte", frame: direcao.start, duration: 70 },
          { key: "robo-morte", frame: direcao.start + 1, duration: 90 },
          { key: "robo-morte", frame: direcao.end, duration: 230 },
        ],
        frameRate: 10,
        repeat: 0,
      });
    }
  }

  const direcoesSerra = [
    { key: "up", ataque: [1, 2, 3, 4] },
    { key: "down", ataque: [6, 7, 8, 9] },
    { key: "left", ataque: [11, 12, 13, 14] },
    { key: "right", ataque: [16, 17, 18, 19] },
  ];

  for (const direcao of direcoesSerra) {
    const ataque = `robo-serra-ataque-${direcao.key}`;

    if (!scene.anims.exists(ataque)) {
      scene.anims.create({
        key: ataque,
        frames: direcao.ataque.map((frame) => ({
          key: "robo-serra",
          frame,
        })),
        frameRate: 10,
        repeat: 0,
      });
    }
  }
}

function atualizarEstadoVisualRobo(inimigo) {
  if (!inimigo) {
    return;
  }

  if (inimigo.tipoRobo === "serra") {
    return;
  }

  const emAlerta = Boolean(inimigo.alerta || inimigo.estado === "alerta");
  const novoEstado = emAlerta ? "alerta" : "normal";
  const texturaAlvo = emAlerta ? "robo-teste" : "robo-teste-normal";

  if (
    inimigo.visualAtual === novoEstado &&
    inimigo.texture?.key === texturaAlvo
  ) {
    return;
  }

  inimigo.visualAtual = novoEstado;
  const frameAtual =
    inimigo.anims?.currentFrame?.index ?? inimigo.frame?.name ?? 0;
  inimigo.setTexture(texturaAlvo, frameAtual);
}

function tocarAnimacaoInimigo(inimigo) {
  if (inimigo.tipoRobo === "serra") {
    if (inimigo.estado === "atacando" && inimigo.anims.isPlaying) {
      return;
    }

    inimigo.estado = inimigo.alerta ? "alerta" : "idle";
    inimigo.anims.stop();
    inimigo.setFrame(frameParadoRoboSerra(inimigo.direcaoAtual));
    return;
  }

  const animacaoBase =
    inimigo.visualAtual === "alerta" ? "robo-alerta" : "robo";

  if (inimigo.direcaoAtual === "down") {
    inimigo.anims.play(`${animacaoBase}-down`, true);
  } else if (inimigo.direcaoAtual === "left") {
    inimigo.anims.play(`${animacaoBase}-left`, true);
  } else if (inimigo.direcaoAtual === "right") {
    inimigo.anims.play(`${animacaoBase}-right`, true);
  } else if (inimigo.direcaoAtual === "up") {
    inimigo.anims.play(`${animacaoBase}-up`, true);
  }
}

// =====================================================
// PARA ANIMAÇÃO
// =====================================================

function pararAnimacaoInimigo(inimigo) {
  if (inimigo.tipoRobo === "serra") {
    if (inimigo.estado === "atacando" && inimigo.anims.isPlaying) {
      return;
    }

    inimigo.estado = inimigo.alerta ? "alerta" : "idle";
    inimigo.anims.stop();
    inimigo.setFrame(frameParadoRoboSerra(inimigo.direcaoAtual));
    return;
  }

  if (inimigo.anims && inimigo.anims.isPlaying) {
    inimigo.anims.stop();
  }

  const frameBase = inimigo.visualAtual === "alerta" ? 0 : 0;

  if (inimigo.direcaoAtual === "down") {
    inimigo.setFrame(frameBase);
  } else if (inimigo.direcaoAtual === "left") {
    inimigo.setFrame(3);
  } else if (inimigo.direcaoAtual === "right") {
    inimigo.setFrame(6);
  } else if (inimigo.direcaoAtual === "up") {
    inimigo.setFrame(9);
  }
}

function frameParadoRoboSerra(direcao) {
  const frames = { up: 0, down: 5, left: 10, right: 15 };
  return frames[direcao] ?? frames.down;
}

function tocarAnimacaoAtaqueInimigo(inimigo) {
  if (!inimigo || inimigo.tipoRobo !== "serra") {
    return;
  }

  inimigo.estado = "atacando";
  inimigo.anims.play(`robo-serra-ataque-${inimigo.direcaoAtual}`, true);
}

// =====================================================
// TENTA DISPARAR LASER
// =====================================================

export {
  criarAnimacoesInimigo,
  atualizarEstadoVisualRobo,
  tocarAnimacaoInimigo,
  tocarAnimacaoAtaqueInimigo,
  pararAnimacaoInimigo,
};
