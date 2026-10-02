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
}

function atualizarEstadoVisualRobo(inimigo) {
  if (!inimigo) {
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

// =====================================================
// TENTA DISPARAR LASER
// =====================================================

export { criarAnimacoesInimigo, atualizarEstadoVisualRobo, tocarAnimacaoInimigo, pararAnimacaoInimigo };
