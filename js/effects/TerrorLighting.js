/**
 * @file Máscara de escuridão da fábrica: cápsulas difusas revelam o cenário sem pintar luz
 * branca no chão. A sombra residual limita a exposição mesmo entre fontes sobrepostas.
 */

import FactoryLighting, { ESCURIDAO_AMBIENTE_FABRICA, MULTIPLICADOR_ALCANCE_FABRICA } from "./FactoryLighting.js";
export { intensidadeLuzPartida } from "./FactoryLighting.js";

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
  const renderer = scene.game.renderer;
  let width = Math.ceil(camera.width);
  let height = Math.ceil(camera.height);
  let invalidada = true;
  const ultimoQuadro = { width: 0, height: 0, a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, revisao: -1 };
  let encerrada = false;
  const iluminacao = new FactoryLighting(scene.map);
  scene.iluminacaoFabrica = iluminacao;

  if (scene.textures.exists(TEXTURA_ESCURIDAO_PARTE2)) {
    scene.textures.remove(TEXTURA_ESCURIDAO_PARTE2);
  }
  const texture = scene.textures.createCanvas(TEXTURA_ESCURIDAO_PARTE2, width, height);
  // A máscara é um gradiente; esse filtro não altera o pixel art dos tiles e personagens.
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const context = texture.getContext();
  const perfil = criarPerfilLuminaria();
  const luminariaCanvas = criarMascaraLuminaria(perfil);
  const coresCanvas = new Map();
  for (const luz of iluminacao.lampadas) {
    if (!coresCanvas.has(luz.cor.css)) coresCanvas.set(luz.cor.css, criarMascaraLuminaria(perfil, luz.cor.phaser));
  }

  // Já cobre a cena antes do primeiro render, mesmo sem jogador ou lâmpadas visíveis.
  context.fillStyle = COR_ESCURIDAO;
  context.fillRect(0, 0, width, height);
  texture.refresh();
  const overlay = scene.add.image(0, 0, TEXTURA_ESCURIDAO_PARTE2)
    .setOrigin(0).setScrollFactor(0).setDepth(DEPTH_ESCURIDAO);

  const definirIluminacaoFabrica = (ligada, obterProgresso = null) => {
    iluminacao.definirEnergia(ligada, obterProgresso, scene.time.now);
    invalidada = true;
  };
  scene.definirIluminacaoFabrica = definirIluminacaoFabrica;
  definirIluminacaoFabrica(scene.luzFabricaAcesa === true);

  /** Compensa a transformação da câmera, incluindo deslocamentos do efeito de tremor. */
  const posicionarOverlay = () => {
    const m = camera.matrix;
    const e = m.e + m.a * camera.scrollX + m.c * camera.scrollY;
    const f = m.f + m.b * camera.scrollX + m.d * camera.scrollY;
    const det = m.a * m.d - m.b * m.c;
    const escalaX = Math.hypot(m.d, m.b) / det;
    overlay.setPosition((m.c * f - m.d * e) / det, (m.b * e - m.a * f) / det)
      .setRotation(Math.atan2(-m.b, m.d))
      .setScale(escalaX, 1 / (det * escalaX));
  };

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

  const limparIluminacao = () => {
    if (encerrada) return;
    encerrada = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, limparIluminacao);
    renderer.off(Phaser.Renderer.Events.RENDER, atualizarIluminacao);
    if (scene.definirIluminacaoFabrica === definirIluminacaoFabrica) scene.definirIluminacaoFabrica = null;
    if (scene.iluminacaoFabrica === iluminacao) scene.iluminacaoFabrica = null;
    iluminacao.destroy();
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

export { calcularPerfilLuz, ESCURIDAO_MINIMA_FABRICA };
export default criarIluminacaoTerror;
