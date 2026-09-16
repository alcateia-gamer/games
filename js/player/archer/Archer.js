import { causarDanoInimigo } from "../../enemies/EnemyTest.js";
import { gastarEstamina } from "../PlayerStatus.js";

const VELOCIDADE_FLECHA = 440;
const DURACAO_CARGA = 550;

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
    const x = pontoMundo.x - scene.player.x;
    const y = pontoMundo.y - scene.player.y;
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

  return direcoes[scene.direcaoAtual] || direcoes.down;
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
    ? Phaser.Math.Clamp((scene.time.now - scene.inicioCargaArco) / DURACAO_CARGA, 0, 1)
    : 0;

  const offset = {
    up: { x: 0, y: -14 },
    left: { x: -14, y: 0 },
    right: { x: 14, y: 0 },
    down: { x: 0, y: 14 },
  };
  const pos = offset[scene.direcaoAtual] || offset.down;

  scene.arcoArqueira.setPosition(scene.player.x + pos.x, scene.player.y + pos.y);
  scene.arcoArqueira.setRotation(0);
  scene.arcoArqueira.setFlipX(false);
  scene.arcoArqueira.setVisible(true);
  scene.arcoArqueira.setDepth(scene.player.depth + 0.2);
  scene.arcoArqueira.setFrame(
    scene.carregandoArco ? Math.min(3, Math.floor(progresso * 4)) : 0,
  );
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
    : [];

  for (const flecha of scene.flechasArqueira.getChildren()) {
    if (!flecha || !flecha.active) {
      continue;
    }

    flecha.x += flecha.velX * (scene.game.loop.delta / 1000);
    flecha.y += flecha.velY * (scene.game.loop.delta / 1000);
    flecha.rotation = Math.atan2(flecha.velY, flecha.velX);

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
      if (!inimigo?.body || !inimigo.active) {
        continue;
      }

      const hitboxInimigo =
        inimigo.hitboxDano ||
        new Phaser.Geom.Rectangle(
          inimigo.body.x,
          inimigo.body.y,
          inimigo.body.width,
          inimigo.body.height,
        );

      const hitboxFlecha = new Phaser.Geom.Rectangle(
        flecha.x - 8,
        flecha.y - 8,
        16,
        16,
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
  scene.flechasArqueira = scene.add.group();
  scene.arcoArqueira = scene.add.sprite(
    scene.player.x,
    scene.player.y,
    "personagem4-bow",
    0,
  );
  scene.arcoArqueira.setScale(0.9);
  scene.arcoArqueira.setVisible(true);
  scene.arcoArqueira.setDepth(scene.player.depth + 0.2);
  scene.miraArqueira = { x: 0, y: 1 };
  scene.carregandoArco = false;

  scene.events.on(Phaser.Scenes.Events.UPDATE, () => {
    atualizarArco(scene);
    verificarFlechas(scene);
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.flechasArqueira?.clear(true, true);
    scene.arcoArqueira?.destroy();
    scene.flechasArqueira = null;
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
  if (scene.personagemSelecionada !== "personagem4" || !scene.carregandoArco) {
    return;
  }

  scene.carregandoArco = false;
  scene.atacando = false;

  if (!gastarEstamina(scene, scene.custoAtaque)) {
    atualizarArco(scene);
    return;
  }

  const direcao = scene.miraArqueira || obterMira(scene);
  const comprimento = Math.hypot(direcao.x, direcao.y) || 1;
  const vx = direcao.x / comprimento;
  const vy = direcao.y / comprimento;
  const origemX = scene.player.x + vx * 20;
  const origemY = scene.player.y + vy * 20;
  const angulo = Math.atan2(vy, vx);
  const texturaFlecha = scene.textures.exists("personagem4-arrow")
    ? "personagem4-arrow"
    : "personagem4-arrow-fallback";

  const flecha = scene.add.image(origemX, origemY, texturaFlecha);
  flecha.setVisible(true);
  flecha.setDepth(scene.player.depth + 1);
  flecha.setScale(1.2);
  flecha.setAlpha(1);
  flecha.setOrigin(0.5, 0.5);
  flecha.rotation = angulo;
  flecha.setData("dano", 25);
  flecha.velX = vx * VELOCIDADE_FLECHA;
  flecha.velY = vy * VELOCIDADE_FLECHA;
  scene.flechasArqueira.add(flecha);

  if (scene.arcoArqueira) {
    scene.arcoArqueira.setFrame(4);
  }

  scene.tweens.add({
    targets: flecha,
    alpha: 1,
    scale: 1.2,
    duration: 90,
  });

  scene.time.delayedCall(90, () => {
    if (scene.arcoArqueira?.active) {
      scene.arcoArqueira.setFrame(5);
    }
  });
  scene.time.delayedCall(180, () => {
    if (scene.arcoArqueira?.active && !scene.carregandoArco) {
      scene.arcoArqueira.setFrame(0);
    }
  });
  scene.time.delayedCall(1400, () => destruirFlecha(flecha));
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
