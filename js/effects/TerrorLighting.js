/**
 * @file Escuridão da fábrica e cone de lanterna. Desenha uma máscara em canvas e a acompanha
 * com o jogador e o zoom.
 */

import { GENERATOR_LOOP_START_SECONDS } from "../sounds/gerador.js";
import { criarSomLuzFabrica } from "../sounds/luzFabrica.js";

// Tentativas de partida, quedas breves de tensão e recuperação final, sem flashes brancos.
const PARTIDA_GERADOR = [
  [0, 0], [0.06, 0.025], [0.13, 0.09], [0.18, 0.03],
  [0.28, 0.22], [0.34, 0.08], [0.46, 0.4], [0.5, 0.14],
  [0.62, 0.56], [0.66, 0.28], [0.78, 0.78], [0.83, 0.69],
  [0.92, 0.94], [1, 1],
];

// O áudio observa as quedas existentes, sem alterar a curva de iluminação.
const QUEDAS_LUZ_FABRICA = PARTIDA_GERADOR.flatMap(([inicio, luz], indice) => {
  const proximo = PARTIDA_GERADOR[indice + 1];
  return proximo && luz > proximo[1]
    ? [{
      inicio,
      inicioOscilacao: PARTIDA_GERADOR[indice - 1]?.[0] ?? inicio,
      fim: proximo[0],
      intensidade: luz - proximo[1],
    }]
    : [];
});

function intensidadeLuzPartida(progresso) {
  const p = Math.max(0, Math.min(1, progresso));
  for (let i = 1; i < PARTIDA_GERADOR.length; i += 1) {
    const [fim, luzFim] = PARTIDA_GERADOR[i];
    if (p > fim) continue;
    const [inicio, luzInicio] = PARTIDA_GERADOR[i - 1];
    return luzInicio + (luzFim - luzInicio) * smoothstep(inicio, fim, p);
  }
  return 1;
}

const TEXTURA_ESCURIDAO_PARTE2 = "level1-parte2-escuridao";
const DEPTH_ESCURIDAO = 50;
const TAMANHO_MASCARA = 256;
const ESCURIDAO_MINIMA_FABRICA = 0.2;
const GANHO_LUZ_FABRICA = 1.2;
const GANHO_DISPERSAO_FABRICA = 2;
const COR_ESCURIDAO = `rgba(0,0,0,${ESCURIDAO_AMBIENTE_FABRICA})`;
// Após destination-out, q é a sombra restante em [0,1]. A composição final produz
// alpha = mínima + (ambiente - mínima) * q, sem readback de pixels por frame.
const OPACIDADE_CAMPO = (ESCURIDAO_AMBIENTE_FABRICA - ESCURIDAO_MINIMA_FABRICA) /
  (1 - ESCURIDAO_MINIMA_FABRICA);

function suavizar(valor) {
  const p = Math.max(0, Math.min(1, valor));
  return p * p * p * (p * (6 * p - 15) + 10);
}

/**
 * Distância ao segmento horizontal [-0.1, 0.1], em unidades do Raio do Tiled.
 * Três quedas contínuas misturam núcleo, dispersão e halo. A variação longitudinal
 * impede a área uniforme que fazia o núcleo anterior parecer um retângulo com blur.
 */
function calcularPerfilLuz(nx, ny) {
  const radial = Math.hypot(nx, ny);
  if (radial >= MULTIPLICADOR_ALCANCE_FABRICA) return 0;
  const distancia = Math.hypot(Math.max(0, Math.abs(nx) - 0.1), ny);
  const axial = Math.exp(-0.8 * (nx / 0.14) ** 2);
  const pesoNucleo = axial * Math.exp(-0.5 * (distancia / 0.045) ** 2);
  const nucleo = 0.46 * pesoNucleo;
  const dispersao = 0.28 * Math.exp(-0.5 * (distancia / (0.16 * MULTIPLICADOR_ALCANCE_FABRICA)) ** 2);
  const halo = 0.16 * Math.exp(-0.5 * (distancia / (0.45 * MULTIPLICADOR_ALCANCE_FABRICA)) ** 2);
  // Dobra a luz difusa fora do núcleo, com transição contínua que preserva seu pico.
  const ganhoDifuso = 1 + (GANHO_DISPERSAO_FABRICA - 1) * (1 - pesoNucleo);
  // Amplia só a dispersão; o núcleo conserva suas dimensões e queda anteriores.
  const perfil = nucleo * (1 - suavizar(radial)) +
    (dispersao + halo) * ganhoDifuso * (1 - suavizar(radial / MULTIPLICADOR_ALCANCE_FABRICA));
  // Reforça a luz suavemente, sem recortar o gradiente ou criar um platô no núcleo.
  return 1 - (1 - perfil) ** GANHO_LUZ_FABRICA;
}

/** Um perfil compartilhado, calculado só na criação da iluminação. */
function criarPerfilLuminaria() {
  const perfil = new Uint8Array(TAMANHO_MASCARA * TAMANHO_MASCARA);
  for (let y = 0; y < TAMANHO_MASCARA; y++) {
    const ny = ((y + 0.5) / TAMANHO_MASCARA * 2 - 1) * MULTIPLICADOR_ALCANCE_FABRICA;
    for (let x = 0; x < TAMANHO_MASCARA; x++) {
      const nx = ((x + 0.5) / TAMANHO_MASCARA * 2 - 1) * MULTIPLICADOR_ALCANCE_FABRICA;
      perfil[y * TAMANHO_MASCARA + x] = Math.round(calcularPerfilLuz(nx, ny) * 255);
    }
  }
  return perfil;
}

/** Branco é usado apenas para apagar a máscara; nunca é desenhado sobre o cenário. */
function criarMascaraLuminaria(perfil, cor = 0xFFFFFF) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = TAMANHO_MASCARA;
  const context = canvas.getContext("2d");
  const image = context.createImageData(canvas.width, canvas.height);
  const red = (cor >> 16) & 255;
  const green = (cor >> 8) & 255;
  const blue = cor & 255;
  for (let i = 0; i < perfil.length; i++) {
    image.data[i * 4] = red;
    image.data[i * 4 + 1] = green;
    image.data[i * 4 + 2] = blue;
    image.data[i * 4 + 3] = perfil[i];
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

function desenharLuminaria(context, canvas, luz) {
  context.save();
  if (luz.orientacao === "vertical") context.transform(0, 1, -1, 0, luz.x, luz.y);
  else context.translate(luz.x, luz.y);
  const alcance = luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
  context.drawImage(canvas, -alcance, -alcance, alcance * 2, alcance * 2);
  context.restore();
}

/** Uma única máscara mantém a sombra ambiente e recebe apenas as luzes do teto. */
function criarIluminacaoTerror(scene) {
  const camera = scene.cameras.main;
  const width = Math.ceil(camera.width);
  const height = Math.ceil(camera.height);
  // A máscara contém apenas gradientes. Metade da resolução usa 1/4 dos
  // pixels no mobile, preservando a definição do cenário e dos personagens.
  const escalaMascara = scene.sys.game.device.input.touch ? 0.5 : 1;

  if (scene.textures.exists(TEXTURA_ESCURIDAO_PARTE2)) {
    scene.textures.remove(TEXTURA_ESCURIDAO_PARTE2);
  }

  const texture = scene.textures.createCanvas(
    TEXTURA_ESCURIDAO_PARTE2,
    Math.ceil(width * escalaMascara),
    Math.ceil(height * escalaMascara),
  );
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const context = texture.getContext();
  context.scale(escalaMascara, escalaMascara);
  const coneCanvas = criarMascaraCone();
  const playerCenter = new Phaser.Math.Vector2();
  const direcaoInicial = DIRECOES_INICIAIS[scene.direcaoAtual] || [0, 1];
  const direcaoLanterna = new Phaser.Math.Vector2(
    direcaoInicial[0],
    direcaoInicial[1],
  );

  /**
   * Renderer.RENDER acontece depois de camera.preRender tanto em Canvas quanto em WebGL.
   * Scene.PRE_RENDER ainda tem a matriz do frame anterior durante o seguimento do jogador.
   */
  const atualizarIluminacao = (cenaRenderizada, cameraRenderizada) => {
    if (encerrada || cenaRenderizada !== scene || cameraRenderizada !== camera) return;
    if (width !== Math.ceil(camera.width) || height !== Math.ceil(camera.height)) {
      width = Math.ceil(camera.width);
      height = Math.ceil(camera.height);
      texture.setSize(width, height);
      overlay.setTexture(TEXTURA_ESCURIDAO_PARTE2);
      invalidada = true;
    }
    posicionarOverlay();
    const fontes = iluminacao.atualizar(scene.time.now, camera);
    const m = camera.matrix;
    // Compara valores em memória reutilizada, sem criar arrays ou strings a cada frame.
    if (!invalidada && ultimoQuadro.width === width && ultimoQuadro.height === height &&
      ultimoQuadro.a === m.a && ultimoQuadro.b === m.b && ultimoQuadro.c === m.c && ultimoQuadro.d === m.d &&
      ultimoQuadro.e === m.e && ultimoQuadro.f === m.f && ultimoQuadro.revisao === iluminacao.revisao) return;
    invalidada = false;
    ultimoQuadro.width = width;
    ultimoQuadro.height = height;
    ultimoQuadro.a = m.a;
    ultimoQuadro.b = m.b;
    ultimoQuadro.c = m.c;
    ultimoQuadro.d = m.d;
    ultimoQuadro.e = m.e;
    ultimoQuadro.f = m.f;
    ultimoQuadro.revisao = iluminacao.revisao;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);
    context.save();
    context.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    context.globalCompositeOperation = "destination-out";
    for (const { luz, intensidade } of fontes) {
      context.globalAlpha = intensidade;
      desenharLuminaria(context, luminariaCanvas, luz);
    }
    context.restore();
    // Reintroduz a sombra mínima em coordenadas de tela, antes da coloração.
    // source-in escala o campo e destination-over estabelece seu piso de opacidade.
    context.globalCompositeOperation = "source-in";
    context.fillStyle = `rgba(0,0,0,${OPACIDADE_CAMPO})`;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "destination-over";
    context.fillStyle = `rgba(0,0,0,${ESCURIDAO_MINIMA_FABRICA})`;
    context.fillRect(0, 0, width, height);
    context.save();
    context.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    // Colore suavemente só a sombra restante. source-atop preserva seu alpha e evita
    // acumular círculos amarelos opacos quando várias lâmpadas se sobrepõem.
    context.globalCompositeOperation = "source-atop";
    const escalaCor = 0.025 / Math.max(1, fontes.length);
    for (const { luz, intensidade } of fontes) {
      context.globalAlpha = intensidade * escalaCor;
      desenharLuminaria(context, coresCanvas.get(luz.cor.css), luz);
    }
    context.restore();
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

  let partida = null;
  const somOscilacoes = criarSomLuzFabrica(scene, QUEDAS_LUZ_FABRICA);
  const aplicarIntensidade = (intensidade) => {
    overlay.setAlpha(1 - intensidade).setVisible(intensidade < 1);
  };

  /**
   * Usa o relógio do áudio durante a partida; visitas posteriores já começam iluminadas.
   */
  const definirIluminacaoFabrica = (ligada, obterProgresso = null) => {
    somOscilacoes.stop();
    partida = ligada && obterProgresso
      ? { obterProgresso, inicio: scene.time.now }
      : null;
    aplicarIntensidade(ligada && !partida ? 1 : 0);
  };

  scene.definirIluminacaoFabrica = definirIluminacaoFabrica;
  definirIluminacaoFabrica(scene.luzFabricaAcesa === true);

  /**
   * Compensa o zoom para manter a máscara cobrindo a mesma área da tela.
   */
  const ajustarOverlayAoZoom = (zoomX, zoomY) => {
    const centerX = camera.width * camera.originX;
    const centerY = camera.height * camera.originY;

    overlay
      .setPosition(
        centerX - centerX / zoomX,
        centerY - centerY / zoomY,
      )
      .setDisplaySize(width / zoomX, height / zoomY);
  };

  let ultimoDesenho = "";

  /**
   * Atualiza direção e origem da lanterna e transforma suas coordenadas de mundo para a tela.
   */
  const atualizarLanterna = () => {
    if (partida) {
      // Sem áudio disponível, mantém o efeito visual com a mesma duração de partida.
      // Se o áudio estiver bloqueado ou pausado, seu progresso também segura a luz.
      const progresso = partida.obterProgresso() ??
        (scene.time.now - partida.inicio) / (GENERATOR_LOOP_START_SECONDS * 1000);
      somOscilacoes.update(progresso);
      aplicarIntensidade(intensidadeLuzPartida(progresso));
      if (progresso >= 1) partida = null;
    }
    if (!overlay.visible) return;

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

    const chaveDesenho = [Math.round(centerX * escalaMascara),
      Math.round(centerY * escalaMascara), zoomX, zoomY,
      direcaoLanterna.x, direcaoLanterna.y].join(":");
    if (chaveDesenho === ultimoDesenho) return;
    ultimoDesenho = chaveDesenho;

    desenharEscuridao(
      centerX,
      centerY,
      zoomX,
      zoomY,
      direcaoLanterna,
    );
  };

  /**
   * Remove listeners, overlay, textura e referência do controle de iluminação ao encerrar a
   * cena.
   */
  const limparIluminacao = () => {
    if (encerrada) return;
    encerrada = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, limparIluminacao);
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, atualizarLanterna);
    partida = null;
    somOscilacoes.destroy();
    if (scene.definirIluminacaoFabrica === definirIluminacaoFabrica) {
      scene.definirIluminacaoFabrica = null;
    }
    overlay.destroy();
    if (scene.textures.exists(TEXTURA_ESCURIDAO_PARTE2)) scene.textures.remove(TEXTURA_ESCURIDAO_PARTE2);
    for (const canvas of [luminariaCanvas, ...coresCanvas.values()]) {
      canvas.width = canvas.height = 0;
    }
    coresCanvas.clear();
  };
  renderer.on(Phaser.Renderer.Events.RENDER, atualizarIluminacao);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, limparIluminacao);
  return limparIluminacao;
}

export { intensidadeLuzPartida, QUEDAS_LUZ_FABRICA };
export default criarIluminacaoTerror;
