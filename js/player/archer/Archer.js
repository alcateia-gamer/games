import { causarDanoInimigo } from "../../enemies/EnemyTest.js";
import { gastarEstamina } from "../PlayerStatus.js";

const CONFIG_ARCO = {
  bowDistance: 17,
  bowLowerOffsetY: 3,
  bowOrigin: { x: 0.5, y: 0.73 },
  arrowSpeed: 440,
  arrowLifetime: 1400,
  arrowScale: 1.2,
  chargeDuration: 550,
  bowRotationOffset: 0,
  arrowRotationOffset: -Math.PI / 2,
  chargeFrames: [0, 1, 2, 3],
  releaseFrame: 4,
  releasedFrame: 5,
};

function obterTexturaFlecha(scene) {
  const texturaOriginal = "personagem4-arrow";
  const texturaRecortada = "personagem4-arrow-trimmed";

  if (!scene.textures.exists(texturaOriginal)) {
    criarTexturaFlechaFallback(scene);
    return "personagem4-arrow-fallback";
  }

  if (!scene.textures.exists(texturaRecortada)) {
    const source = scene.textures.get(texturaOriginal).getSourceImage();
    const canvasTexture = scene.textures.createCanvas(texturaRecortada, 3, 15);
    canvasTexture.context.clearRect(0, 0, 3, 15);
    canvasTexture.context.drawImage(source, 13, 65, 3, 15, 0, 0, 3, 15);
    canvasTexture.refresh();
  }

  return texturaRecortada;
}

function criarTexturaFlechaFallback(scene) {
  if (scene.textures.exists("personagem4-arrow-fallback")) {
    return;
  }

  const grafico = scene.make.graphics({ x: 0, y: 0, add: false });
  grafico.clear();
  grafico.fillStyle(0xf5f5f5, 1);
  grafico.fillTriangle(0, 0, 26, 4, 0, 8);
  grafico.fillStyle(0xdfe7ff, 1);
  grafico.fillTriangle(12, 1, 26, 4, 12, 7);
  grafico.generateTexture("personagem4-arrow-fallback", 26, 8);
  grafico.destroy();
}

function obterMira(scene) {
  if (scene.joystick?.force > scene.threshold) {
    const angulo = Phaser.Math.DegToRad(scene.joystick.angle);
    return { x: Math.cos(angulo), y: Math.sin(angulo) };
  }

  const pointer = scene.input.activePointer;
  if (pointer && scene.cameras.main) {
    const pontoMundo = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const centro = obterCentroPlayer(scene);
    const x = pontoMundo.x - centro.x;
    const y = pontoMundo.y - centro.y;
    const distancia = Math.hypot(x, y);
    if (distancia > 8) {
      return { x: x / distancia, y: y / distancia };
    }
  }

  const direcoes = {
    up: { x: 0, y: -1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
  };

  const direcao = direcoes[scene.direcaoAtual] || direcoes.right;
  const comprimento = Math.hypot(direcao.x, direcao.y) || 1;
  return { x: direcao.x / comprimento, y: direcao.y / comprimento };
}

function obterCentroPlayer(scene) {
  if (scene.player.getCenter) {
    const centro = scene.player.getCenter();
    return { x: centro.x, y: centro.y };
  }

  return { x: scene.player.x, y: scene.player.y };
}

function atualizarFlechaPreparada(scene, posicaoArco, angulo) {
  if (!scene.flechaPreparada?.active) {
    return;
  }

  scene.flechaPreparada.setPosition(posicaoArco.x, posicaoArco.y);
  scene.flechaPreparada.setRotation(
    angulo + CONFIG_ARCO.arrowRotationOffset,
  );
  scene.flechaPreparada.setDepth(scene.arcoArqueira.depth + 0.1);
  scene.flechaPreparada.setVisible(false);
}

function atualizarArco(scene) {
  if (!scene.arcoArqueira || !scene.player?.active) {
    return;
  }

  const mira = obterMira(scene);
  scene.miraArqueira = mira;
  scene.direcaoAtual =
    Math.abs(mira.x) > Math.abs(mira.y)
      ? mira.x < 0
        ? "left"
        : "right"
      : mira.y < 0
        ? "up"
        : "down";

  const progresso = scene.carregandoArco
    ? Phaser.Math.Clamp(
        (scene.time.now - scene.inicioCargaArco) /
          CONFIG_ARCO.chargeDuration,
        0,
        1,
      )
    : 0;

  const centro = obterCentroPlayer(scene);
  const angulo = Math.atan2(mira.y, mira.x);
  const posicaoArco = {
    x: centro.x + mira.x * CONFIG_ARCO.bowDistance,
    y:
      centro.y +
      mira.y * CONFIG_ARCO.bowDistance +
      CONFIG_ARCO.bowLowerOffsetY,
  };

  scene.arcoArqueira.setPosition(posicaoArco.x, posicaoArco.y);
  scene.arcoArqueira.setRotation(angulo + CONFIG_ARCO.bowRotationOffset);
  scene.arcoArqueira.setFlipX(false);
  scene.arcoArqueira.setVisible(true);
  scene.arcoArqueira.setDepth(scene.player.depth + 0.2);
  scene.arcoArqueira.setOrigin(
    CONFIG_ARCO.bowOrigin.x,
    CONFIG_ARCO.bowOrigin.y,
  );
  if (scene.carregandoArco) {
    const frameIndex = Math.min(
      CONFIG_ARCO.chargeFrames.length - 1,
      Math.floor(progresso * CONFIG_ARCO.chargeFrames.length),
    );
    scene.arcoArqueira.setFrame(CONFIG_ARCO.chargeFrames[frameIndex]);
  } else if (!scene.arcoDisparando) {
    scene.arcoArqueira.setFrame(0);
  }
  atualizarFlechaPreparada(scene, posicaoArco, angulo);
}

function destruirFlecha(flecha) {
  if (flecha && flecha.active) {
    flecha.destroy();
  }
}

function verificarFlechas(scene) {
  if (!scene.flechasArqueira) {
    return;
  }

  const alvos = Array.isArray(scene.inimigos)
    ? scene.inimigos.filter((inimigo) => inimigo && inimigo.active)
    : scene.inimigoTeste?.active
      ? [scene.inimigoTeste]
      : [];

  for (const flecha of scene.flechasArqueira.getChildren()) {
    if (!flecha || !flecha.active) {
      continue;
    }

    const deltaSegundos = scene.game.loop.delta / 1000;
    flecha.x += flecha.velX * deltaSegundos;
    flecha.y += flecha.velY * deltaSegundos;

    if (flecha.body?.updateFromGameObject) {
      flecha.body.updateFromGameObject();
    }

    const velocidadeX = flecha.velX;
    const velocidadeY = flecha.velY;
    flecha.rotation =
      Math.atan2(velocidadeY, velocidadeX) +
      CONFIG_ARCO.arrowRotationOffset;

    if (
      flecha.x < scene.physics.world.bounds.x - 80 ||
      flecha.x > scene.physics.world.bounds.right + 80 ||
      flecha.y < scene.physics.world.bounds.y - 80 ||
      flecha.y > scene.physics.world.bounds.bottom + 80
    ) {
      destruirFlecha(flecha);
      continue;
    }

    for (const inimigo of alvos) {
      if (!inimigo || !inimigo.active) {
        continue;
      }

      const hitboxInimigo =
        inimigo.hitboxDano ||
        (inimigo.body
          ? new Phaser.Geom.Rectangle(
              inimigo.body.x,
              inimigo.body.y,
              inimigo.body.width,
              inimigo.body.height,
            )
          : inimigo.getBounds());

      const hitboxFlecha = new Phaser.Geom.Rectangle(
        flecha.x - 9,
        flecha.y - 9,
        18,
        18,
      );

      if (!Phaser.Geom.Intersects.RectangleToRectangle(hitboxFlecha, hitboxInimigo)) {
        continue;
      }

      causarDanoInimigo(scene, inimigo, Number(flecha.getData("dano") ?? 25));
      destruirFlecha(flecha);
      break;
    }
  }
}

function prepararArqueira(scene) {
  if (scene.personagemSelecionada !== "personagem4") {
    return;
  }

  if (scene.flechasArqueira) {
    return;
  }

  criarTexturaFlechaFallback(scene);
  scene.flechasArqueira = scene.physics.add.group();
  scene.arcoArqueira = scene.add.sprite(
    scene.player.x,
    scene.player.y,
    "personagem4-bow",
    0,
  );
  scene.arcoArqueira.setScale(0.9);
  scene.arcoArqueira.setOrigin(
    CONFIG_ARCO.bowOrigin.x,
    CONFIG_ARCO.bowOrigin.y,
  );
  scene.arcoArqueira.setVisible(true);
  scene.arcoArqueira.setDepth(scene.player.depth + 0.2);
  scene.miraArqueira = { x: 1, y: 0 };
  scene.carregandoArco = false;
  scene.arcoDisparando = false;
  scene.flechaEmVoo = false;
  scene.flechaPreparada = scene.add.image(
    scene.player.x,
    scene.player.y,
    obterTexturaFlecha(scene),
  );
  scene.flechaPreparada.setScale(CONFIG_ARCO.arrowScale);
  scene.flechaPreparada.setOrigin(0.5, 0.5);
  scene.flechaPreparada.setDepth(scene.arcoArqueira.depth + 0.3);
  scene.flechaPreparada.setVisible(false);

  scene.events.on(Phaser.Scenes.Events.UPDATE, () => {
    atualizarArco(scene);
    verificarFlechas(scene);
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.flechasArqueira?.clear(true, true);
    scene.flechaPreparada?.destroy();
    scene.arcoArqueira?.destroy();
    scene.flechasArqueira = null;
    scene.flechaPreparada = null;
    scene.arcoArqueira = null;
  });
}

function iniciarCargaArco(scene) {
  if (
    scene.personagemSelecionada !== "personagem4" ||
    scene.carregandoArco ||
    scene.estamina < scene.custoAtaque
  ) {
    return;
  }

  scene.carregandoArco = true;
  scene.atacando = true;
  scene.inicioCargaArco = scene.time.now;
  atualizarArco(scene);
}

function dispararFlecha(scene) {
  if (
    scene.personagemSelecionada !== "personagem4" ||
    (!scene.carregandoArco && !scene.atacando)
  ) {
    return;
  }

  scene.carregandoArco = false;
  scene.atacando = false;
  scene.arcoDisparando = true;

  if (!gastarEstamina(scene, scene.custoAtaque)) {
    atualizarArco(scene);
    return;
  }

  const direcaoAtual = scene.miraArqueira || obterMira(scene);
  const direcao = { x: direcaoAtual.x, y: direcaoAtual.y };
  const comprimento = Math.hypot(direcao.x, direcao.y) || 1;
  const vx = direcao.x / comprimento;
  const vy = direcao.y / comprimento;
  const origemX = scene.arcoArqueira.x;
  const origemY = scene.arcoArqueira.y;
  const angulo = Math.atan2(vy, vx);
  const texturaFlecha = obterTexturaFlecha(scene);

  const flecha = scene.physics.add.image(origemX, origemY, texturaFlecha);
  flecha.setVisible(true);
  flecha.setDepth(scene.player.depth + 1);
  flecha.setScale(CONFIG_ARCO.arrowScale);
  flecha.setAlpha(1);
  flecha.setOrigin(0.5, 0.5);
  flecha.rotation = angulo + CONFIG_ARCO.arrowRotationOffset;
  flecha.setData("dano", 25);
  flecha.direcao = { x: vx, y: vy };
  flecha.velX = vx * CONFIG_ARCO.arrowSpeed;
  flecha.velY = vy * CONFIG_ARCO.arrowSpeed;
  flecha.body.setAllowGravity(false);
  flecha.body.setSize(12, 12, true);
  flecha.body.setVelocity(0, 0);
  scene.flechasArqueira.add(flecha);
  scene.flechaEmVoo = true;
  scene.flechaPreparada?.setVisible(false);

  if (scene.arcoArqueira) {
    scene.arcoArqueira.setFrame(CONFIG_ARCO.releaseFrame);
  }

  scene.tweens.add({
    targets: flecha,
    alpha: 1,
    scale: CONFIG_ARCO.arrowScale,
    duration: 90,
  });

  scene.time.delayedCall(90, () => {
    if (scene.arcoArqueira?.active) {
      scene.arcoArqueira.setFrame(CONFIG_ARCO.releasedFrame);
    }
  });
  scene.time.delayedCall(180, () => {
    scene.flechaEmVoo = false;
    scene.arcoDisparando = false;
    if (scene.arcoArqueira?.active && !scene.carregandoArco) {
      scene.arcoArqueira.setFrame(0);
    }
    if (scene.flechaPreparada?.active) {
      scene.flechaPreparada.setVisible(false);
    }
  });
  scene.time.delayedCall(CONFIG_ARCO.arrowLifetime, () => destruirFlecha(flecha));
}

function limparFlechas(scene) {
  scene.flechasArqueira?.clear(true, true);
}

export {
  prepararArqueira,
  iniciarCargaArco,
  dispararFlecha,
  atualizarArco,
  limparFlechas,
};
