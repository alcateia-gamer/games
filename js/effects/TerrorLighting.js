const TEXTURA_ESCURIDAO_PARTE2 = "level1-parte2-escuridao";
const ALCANCE_LANTERNA = 290;
const MEIA_LARGURA_MAXIMA = 540;
const MEIA_LARGURA_INICIAL = 1;
const INTENSIDADE_NUCLEO = 0.42;
const INTENSIDADE_HALO = 0.18;
const DEPTH_ESCURIDAO = 150;
const DIRECOES_INICIAIS = {
  right: [1, 0],
  down: [0, 1],
  left: [-1, 0],
  up: [0, -1],
};

function smoothstep(minimo, maximo, valor) {
  const normalizado = Math.max(0, Math.min(1, (valor - minimo) / (maximo - minimo)));
  return normalizado * normalizado * (3 - 2 * normalizado);
}

function desenharDispersaoLocal(context, centerX, centerY, zoomX, zoomY) {
  const radius = 72;

  context.save();
  context.translate(centerX, centerY);
  context.scale(zoomX * 0.72, zoomY);

  const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0.2)");
  gradient.addColorStop(0.38, "rgba(255, 255, 255, 0.16)");
  gradient.addColorStop(0.72, "rgba(255, 255, 255, 0.08)");
  gradient.addColorStop(0.92, "rgba(255, 255, 255, 0.025)");
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

  context.fillStyle = gradient;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function criarMascaraCone() {
  const canvas = document.createElement("canvas");
  canvas.width = ALCANCE_LANTERNA;
  canvas.height = MEIA_LARGURA_MAXIMA * 2;

  const context = canvas.getContext("2d");
  const image = context.createImageData(canvas.width, canvas.height);
  const centerY = MEIA_LARGURA_MAXIMA;

  for (let x = 0; x < canvas.width; x += 1) {
    const progresso = x / (canvas.width - 1);
    const meiaLargura =
      MEIA_LARGURA_INICIAL +
      (MEIA_LARGURA_MAXIMA - MEIA_LARGURA_INICIAL) *
        Math.pow(progresso, 0.82);
    const inicioSuave = smoothstep(0, 0.045, progresso);
    const fimSuave = 1 - smoothstep(0.76, 1, progresso);
    const quedaDistancia = 1 - 0.34 * progresso;

    for (let y = 0; y < canvas.height; y += 1) {
      const deslocamentoLateral = Math.abs(y - centerY) / meiaLargura;
      if (deslocamentoLateral >= 1) continue;

      const bordaSuave = 1 - smoothstep(0.72, 1, deslocamentoLateral);
      const nucleo =
        INTENSIDADE_NUCLEO *
        Math.exp(-Math.pow(deslocamentoLateral / 0.3, 2) * 2);
      const halo =
        INTENSIDADE_HALO *
        Math.exp(-Math.pow(deslocamentoLateral / 0.72, 2) * 2);
      const variacao =
        0.95 +
        Math.sin(progresso * 22 + deslocamentoLateral * 7) * 0.025 +
        Math.sin(progresso * 47 - deslocamentoLateral * 13) * 0.015;
      const alpha = Math.min(
        1,
        (nucleo + halo) *
          bordaSuave *
          inicioSuave *
          fimSuave *
          quedaDistancia *
          variacao,
      );
      const pixel = (y * canvas.width + x) * 4;

      image.data[pixel] = 255;
      image.data[pixel + 1] = 255;
      image.data[pixel + 2] = 255;
      image.data[pixel + 3] = Math.round(alpha * 255);
    }
  }

  context.putImageData(image, 0, 0);

  return canvas;
}

function criarIluminacaoTerror(scene) {
  const camera = scene.cameras.main;
  const width = Math.ceil(camera.width);
  const height = Math.ceil(camera.height);

  if (scene.textures.exists(TEXTURA_ESCURIDAO_PARTE2)) {
    scene.textures.remove(TEXTURA_ESCURIDAO_PARTE2);
  }

  const texture = scene.textures.createCanvas(
    TEXTURA_ESCURIDAO_PARTE2,
    width,
    height,
  );
  const context = texture.getContext();
  const coneCanvas = criarMascaraCone();
  const playerCenter = new Phaser.Math.Vector2();
  const direcaoInicial = DIRECOES_INICIAIS[scene.direcaoAtual] || [0, 1];
  const direcaoLanterna = new Phaser.Math.Vector2(
    direcaoInicial[0],
    direcaoInicial[1],
  );

  const desenharEscuridao = (
    centerX,
    centerY,
    zoomX = 1,
    zoomY = 1,
    direcao = direcaoLanterna,
  ) => {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);

    context.globalCompositeOperation = "destination-out";
    context.save();
    context.transform(
      direcao.x * zoomX,
      direcao.y * zoomY,
      -direcao.y * zoomX,
      direcao.x * zoomY,
      centerX,
      centerY,
    );
    context.drawImage(
      coneCanvas,
      0,
      -MEIA_LARGURA_MAXIMA,
      ALCANCE_LANTERNA,
      MEIA_LARGURA_MAXIMA * 2,
    );
    context.restore();

    desenharDispersaoLocal(context, centerX, centerY, zoomX, zoomY);
    context.globalCompositeOperation = "source-over";

    texture.refresh();
  };

  desenharEscuridao(width / 2, height / 2, 1, 1, direcaoLanterna);

  const overlay = scene.add
    .image(0, 0, TEXTURA_ESCURIDAO_PARTE2)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(DEPTH_ESCURIDAO)
    .setDisplaySize(width, height);

  const ajustarOverlayAoZoom = (zoomX, zoomY) => {
    const centerX = camera.width * camera.originX;
    const centerY = camera.height * camera.originY;

    overlay
      .setPosition(
        centerX - centerX / zoomX,
        centerY - centerY / zoomY,
      )
      .setScale(1 / zoomX, 1 / zoomY);
  };

  const atualizarLanterna = () => {
    const player = scene.player;
    const zoomX = camera.zoomX || camera.zoom || 1;
    const zoomY = camera.zoomY || camera.zoom || 1;
    ajustarOverlayAoZoom(zoomX, zoomY);

    if (!player?.active) return;

    const velocidade = player.body?.velocity;
    if (velocidade) {
      const magnitude = Math.hypot(velocidade.x, velocidade.y);
      if (magnitude > 0.1) {
        direcaoLanterna.set(
          velocidade.x / magnitude,
          velocidade.y / magnitude,
        );
      }
    }

    player.getCenter(playerCenter);
    const origemX = playerCenter.x + direcaoLanterna.x * 10;
    const origemY = playerCenter.y + 10 + direcaoLanterna.y * 10;
    const worldView = camera.worldView;
    const centerX = (origemX - worldView.x) * zoomX;
    const centerY = (origemY - worldView.y) * zoomY;

    desenharEscuridao(
      centerX,
      centerY,
      zoomX,
      zoomY,
      direcaoLanterna,
    );
  };

  const limparIluminacao = () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, atualizarLanterna);
    overlay.destroy();
    scene.textures.remove(TEXTURA_ESCURIDAO_PARTE2);
    coneCanvas.width = 0;
    coneCanvas.height = 0;
  };

  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, atualizarLanterna);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, limparIluminacao);
}

export default criarIluminacaoTerror;