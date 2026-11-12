/**
 * @file Máscara de escuridão da fábrica: cápsulas difusas revelam o cenário sem pintar luz
 * branca no chão. A sombra residual limita a exposição mesmo entre fontes sobrepostas.
 */

import FactoryLighting, { ESCURIDAO_AMBIENTE_FABRICA, MULTIPLICADOR_ALCANCE_FABRICA, QUEDAS_LUZ_FABRICA } from "./FactoryLighting.js";
import { criarSomLuzFabrica, criarSomPiscadasAmbiente } from "../sounds/luzFabrica.js";
import { atualizarPoseLanterna, atualizarLanternasAliadas } from "./FlashlightPose.js";
import FlashlightWalls from "./FlashlightWalls.js";
import { ocultarLanternaAtrasCamada, ocultarLanternaAtrasSala, obterRegiaoFrenteLanterna } from "./FlashlightTileOcclusion.js";
import { camadaEhPisoFabrica } from "../map/TrocaCamada.js";
import EmergencyLighting, { calcularPerfilGiroflex, calcularPerfilNeon } from "./EmergencyLighting.js";
import EmergencyStatueOcclusion from "./EmergencyStatueOcclusion.js";
import GiroflexLightCache from "./GiroflexLightCache.js";
import DoorLightingZones from "./DoorLightingZones.js";
import BossWallLighting, { calcularPerfilLuzParede, calcularEmissorLuzParede } from "./BossWallLighting.js";
import BossEmitterOcclusion from "./BossEmitterOcclusion.js";
import BossEnergyLighting, { calcularPerfilEnergiaBoss, calcularPerfilAuraBoss } from "./BossEnergyLighting.js";
import FixedLightCache from "./FixedLightCache.js";
import BossRoomLighting from "./BossRoomLighting.js";
import BossEnergyLightBuffer from "./BossEnergyLightBuffer.js";
import BossAuraLightCache from "./BossAuraLightCache.js";
import { ocultarBrilhoAtrasSprite as ocultarBrilhoAtrasPersonagem } from "./SpriteLightOcclusion.js";
import { criarTexturaIluminacao } from "./LightingTexture.js";
export { intensidadeLuzPartida, QUEDAS_LUZ_FABRICA } from "./FactoryLighting.js";

const TEXTURA_ESCURIDAO_PARTE2 = "level1-parte2-escuridao";
const DEPTH_ESCURIDAO = 50;
const TAMANHO_MASCARA = 256;
const ESCURIDAO_MINIMA_FABRICA = 0.2;
const GANHO_LUZ_FABRICA = 1.6;
const GANHO_DISPERSAO_FABRICA = 2;
const CLARIDADE_SPRITE_BOSS = 0.55;
const CAMPOS_OCLUSAO = ["x", "y", "scaleX", "scaleY", "rotation", "flipX", "flipY",
  "displayOriginX", "displayOriginY", "alpha"];
const CAMPOS_BRILHO_ATOR = ["frame", ...CAMPOS_OCLUSAO];
const CAMPOS_OCLUSAO_CAMADA = ["x", "y", "scaleX", "scaleY", "rotation", "alpha", "visible"];
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
function criarPerfilLuminaria(pulsando = false) {
  const perfil = new Uint8Array(TAMANHO_MASCARA * TAMANHO_MASCARA);
  for (let y = 0; y < TAMANHO_MASCARA; y++) {
    const ny = ((y + 0.5) / TAMANHO_MASCARA * 2 - 1) * MULTIPLICADOR_ALCANCE_FABRICA;
    for (let x = 0; x < TAMANHO_MASCARA; x++) {
      const nx = ((x + 0.5) / TAMANHO_MASCARA * 2 - 1) * MULTIPLICADOR_ALCANCE_FABRICA;
      let alpha = calcularPerfilLuz(nx, ny);
      if (pulsando) {
        const radial = Math.hypot(nx, ny);
        const distancia = Math.hypot(Math.max(0, Math.abs(nx) - 0.1), ny);
        // Núcleo discreto com halo largo; o alcance continua respeitando o raio do mapa.
        const halo = Math.exp(-0.5 * (distancia / 0.55) ** 2) *
          (1 - suavizar(radial / MULTIPLICADOR_ALCANCE_FABRICA));
        alpha = alpha * 0.12 + halo * 0.65;
      }
      perfil[y * TAMANHO_MASCARA + x] = Math.round(alpha * 255);
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

function criarMascaraLanterna() {
  const perfil = new Uint8Array(TAMANHO_MASCARA ** 2);
  for (let y = 0; y < TAMANHO_MASCARA; y++) {
    for (let x = 0; x < TAMANHO_MASCARA; x++) {
      const px = (x + 0.5) / TAMANHO_MASCARA * 460 - 100;
      const py = (y + 0.5) / TAMANHO_MASCARA * 320 - 160;
      const distancia = Math.hypot(px, py);
      const cone = px > 0 ? (1 - suavizar(Math.abs(Math.atan2(py, px)) / 0.55)) *
        suavizar(distancia / 8) * (1 - suavizar(distancia / 350)) : 0;
      // O halo termina antes da borda da textura, evitando o recorte reto atrás do jogador.
      const halo = 0.4 * Math.exp(-0.5 * (distancia / 28) ** 2) * (1 - suavizar(distancia / 90));
      perfil[y * TAMANHO_MASCARA + x] = Math.round(Math.max(cone, halo) * 255);
    }
  }
  return criarMascaraLuminaria(perfil);
}

function criarPerfilGiroflex(lateral = false) {
  const perfil = new Uint8Array(TAMANHO_MASCARA ** 2);
  for (let y = 0; y < TAMANHO_MASCARA; y++) {
    for (let x = 0; x < TAMANHO_MASCARA; x++) {
      perfil[y * TAMANHO_MASCARA + x] = Math.round(calcularPerfilGiroflex(
        (x + 0.5) / TAMANHO_MASCARA * 2 - 1,
        (y + 0.5) / TAMANHO_MASCARA * 2 - 1, lateral) * 255);
    }
  }
  return perfil;
}

function criarPerfilParede(calcular) {
  const perfil = new Uint8Array(TAMANHO_MASCARA ** 2);
  for (let y = 0; y < TAMANHO_MASCARA; y++) {
    for (let x = 0; x < TAMANHO_MASCARA; x++) {
      perfil[y * TAMANHO_MASCARA + x] = Math.round(calcular(
        (x + 0.5) / TAMANHO_MASCARA * 2 - 1, (y + 0.5) / TAMANHO_MASCARA * 2 - 1) * 255);
    }
  }
  return perfil;
}

function desenharFonteDirecional(context, canvas, fonte, paredes, estatuas, oclusaoEmissor = null) {
  const { luz, angulo } = fonte;
  const cos = Math.cos(angulo), sin = Math.sin(angulo);
  const raio = luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
  context.save();
  if (luz.parede) {
    // Recorta também o halo: nenhum brilho é projetado para fora da sala.
    context.beginPath();
    context.rect(luz.parede === "direita" ? luz.x - raio : luz.x, luz.y - raio, raio, raio * 2);
    context.clip();
  }
  paredes.recortarFonte(context, luz, raio);
  if (!oclusaoEmissor?.desenhar(context, canvas, fonte, estatuas) && !estatuas.desenhar(context, canvas, fonte)) {
    context.transform(cos, sin, -sin, cos, luz.x, luz.y);
    context.drawImage(canvas, -raio, -raio, raio * 2, raio * 2);
  }
  context.restore();
}

/** A camada e o jogador ocultam só a lanterna, conservando a ordem visual do mapa. */
function ocultarLanterna(context, lanterna, scene, pose, atrasPlayer, regiao, player = scene.player) {
  const camera = scene.cameras.main;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = "source-over";
  context.clearRect(0, 0, 460, 320);
  context.drawImage(lanterna, 0, 0, 460, 320);

  // Mundo -> coordenadas da textura da lanterna, antes da transformação do sprite.
  const cos = Math.cos(pose.angulo), sin = Math.sin(pose.angulo);
  context.setTransform(cos, -sin, sin, cos,
    100 - cos * pose.x - sin * pose.y, 160 + sin * pose.x - cos * pose.y);
  ocultarLanternaAtrasCamada(context, scene.camadaParedeAcimaPerso, camera);
  ocultarLanternaAtrasSala(context, scene, camera, regiao);
  if (atrasPlayer) ocultarBrilhoAtrasPersonagem(context, player);
}

function desenharLuminaria(context, canvas, luz, limites) {
  context.save();
  if (luz.area) {
    const cos = Math.cos(luz.rotacao), sin = Math.sin(luz.rotacao);
    limites?.recortarFonte(context, luz, Math.hypot(luz.largura, luz.altura),
      luz.x + cos * luz.largura / 2 - sin * luz.altura / 2,
      luz.y + sin * luz.largura / 2 + cos * luz.altura / 2);
    context.transform(cos, sin, -sin, cos, luz.x, luz.y);
    context.drawImage(canvas, 0, 0, luz.largura, luz.altura);
    context.restore();
    return;
  }
  limites?.recortarFonte(context, luz, luz.raio * MULTIPLICADOR_ALCANCE_FABRICA);
  if (luz.orientacao === "vertical") context.transform(0, 1, -1, 0, luz.x, luz.y);
  else context.translate(luz.x, luz.y);
  const alcance = luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
  context.drawImage(canvas, -alcance, -alcance, alcance * 2, alcance * 2);
  context.restore();
}

/** Uma única máscara combina sombra ambiente, luzes do teto e lanterna sem energia. */
function criarIluminacaoTerror(scene) {
  const camera = scene.cameras.main;
  const renderer = scene.game.renderer;
  let width = Math.ceil(camera.width);
  let height = Math.ceil(camera.height);
  let invalidada = true;
  const ultimoQuadro = { width: 0, height: 0, a: 0, b: 0, c: 0, d: 0, e: 0, f: 0,
    revisao: -1, revisaoEmergencia: -1, revisaoZonas: -1, revisaoBoss: -1, revisaoEnergiaBoss: -1, revisaoFixas: -1,
    revisaoIntroducao: -1 };
  let encerrada = false;
  const iluminacao = new FactoryLighting(scene.map);
  const dispositivo = scene.sys?.game?.device;
  const celular = dispositivo?.os?.desktop === false || dispositivo?.input?.touch === true;
  // Só a composição de luz usa menos pixels no celular; a máscara é ampliada com filtro linear.
  const resolucao = dispositivo?.os?.desktop === false ? 0.5 : 1;
  let larguraMascara = Math.ceil(width * resolucao), alturaMascara = Math.ceil(height * resolucao);
  const transformarMascara = (ctx, a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) => {
    const sx = larguraMascara / width, sy = alturaMascara / height;
    ctx.setTransform(a * sx, b * sy, c * sx, d * sy, e * sx, f * sy);
  };
  const emergencia = new EmergencyLighting(scene.map, { quadrosPorSegundo: celular ? 30 : 60 });
  const arandelas = new BossWallLighting(scene.map);
  const energiaBoss = new BossEnergyLighting(scene);
  const luzesIndependentes = [...emergencia.luzes, ...arandelas.luzes];
  const zonas = new DoorLightingZones(scene.map, iluminacao.lampadas, luzesIndependentes);
  const obterLuzesIntroducao = () => scene.novoBoss?.introducao?.iluminacao ?? scene.iluminacaoEntradaBossReplica;
  const zonasCena = { fatorLuz(luz, agora) {
    return zonas.fatorLuz(luz, agora) * (obterLuzesIntroducao()?.fatorLuz(luz) ?? 1);
  } };
  const paredesLanterna = new FlashlightWalls(scene);
  const limitesLampadas = scene.map.getObjectLayer("LimitaLuz")?.objects?.length
    ? new FlashlightWalls(scene, { somenteLimites: true }) : null;
  let revisaoParedes = -1;
  scene.iluminacaoFabrica = iluminacao;
  scene.iluminacaoEmergencia = emergencia;
  scene.iluminacaoBoss = arandelas;
  scene.iluminacaoEnergiaBoss = energiaBoss;
  scene.zonasLuzApagada = zonas;
  const somPartida = criarSomLuzFabrica(scene, QUEDAS_LUZ_FABRICA);
  const somPiscadas = criarSomPiscadasAmbiente(scene);

  if (scene.textures.exists(TEXTURA_ESCURIDAO_PARTE2)) {
    scene.textures.remove(TEXTURA_ESCURIDAO_PARTE2);
  }
  const texture = criarTexturaIluminacao(scene.textures, TEXTURA_ESCURIDAO_PARTE2, larguraMascara, alturaMascara);
  // A máscara é um gradiente; esse filtro não altera o pixel art dos tiles e personagens.
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  const context = texture.getContext();
  const salaBoss = new BossRoomLighting(scene.map);
  const perfil = criarPerfilLuminaria();
  const luminariaCanvas = criarMascaraLuminaria(perfil);
  const perfilPulso = criarPerfilLuminaria(true);
  const luminariaPulsoCanvas = criarMascaraLuminaria(perfilPulso);
  const corPulsoCanvas = criarMascaraLuminaria(perfilPulso, 0xFF0000);
  const lanternaCanvas = criarMascaraLanterna();
  const perfilGiroflex = emergencia.luzes.some(luz => !luz.neon) ? criarPerfilGiroflex() : null;
  // destination-out só lê o alpha: o mesmo carimbo vermelho atende máscara e brilho.
  const giroflexCanvas = perfilGiroflex ? criarMascaraLuminaria(perfilGiroflex, 0xFF0000) : null;
  const perfilGiroflexLateral = emergencia.luzes.some(luz => luz.parede) ? criarPerfilGiroflex(true) : null;
  const giroflexLateralCanvas = perfilGiroflexLateral ? criarMascaraLuminaria(perfilGiroflexLateral, 0xFF0000) : null;
  const perfilNeon = emergencia.luzes.some(luz => luz.neon) ? criarPerfilParede(calcularPerfilNeon) : null;
  const neonCanvas = perfilNeon ? criarMascaraLuminaria(perfilNeon) : null;
  const perfilEmissorNeon = perfilNeon ? criarPerfilParede((x, y) => calcularPerfilNeon(x, y, true)) : null;
  const coresNeonCanvas = new Map();
  for (const luz of emergencia.luzes) {
    if (!luz.neon || coresNeonCanvas.has(luz.cor.css)) continue;
    const canais = [16, 8, 0].map(shift => (luz.cor.phaser >> shift) & 255);
    const clara = canais.reduce((cor, canal) => (cor << 8) | Math.round(canal + (255 - canal) * 0.6), 0);
    coresNeonCanvas.set(luz.cor.css, { halo: criarMascaraLuminaria(perfilNeon, luz.cor.phaser),
      emissor: criarMascaraLuminaria(perfilEmissorNeon, clara) });
  }
  const perfilParede = arandelas.luzes.length ? criarPerfilParede(calcularPerfilLuzParede) : null;
  const perfilEmissorParede = arandelas.luzes.length ? criarPerfilParede(calcularEmissorLuzParede) : null;
  const paredeCanvas = perfilParede ? criarMascaraLuminaria(perfilParede) : null;
  const perfilEnergia = criarPerfilParede(calcularPerfilEnergiaBoss);
  const perfilEscudo = criarPerfilParede((x, y) => calcularPerfilEnergiaBoss(x, y, true));
  const perfisEnergiaBoss = [0x289DFF, 0x289DFF, 0x40A8FF].map((cor, indice) => {
    const perfil = indice === 1 ? perfilEscudo : perfilEnergia;
    return { mascara: criarMascaraLuminaria(perfil), cor: criarMascaraLuminaria(perfil, cor) };
  });
  const auraBoss = new BossAuraLightCache(criarMascaraLuminaria(criarPerfilParede(calcularPerfilAuraBoss)));
  const obterPerfilEnergia = fonte => fonte.vermelha ? auraBoss.obter(fonte)
    : perfisEnergiaBoss[fonte.choqueTorre ? 2 : Number(fonte.escudo)];
  const campoEnergiaBoss = new BossEnergyLightBuffer((c, fonte, colorido) => {
    const perfil = obterPerfilEnergia(fonte);
    desenharLuminaria(c, colorido ? perfil.cor : perfil.mascara, fonte.luz, paredesLanterna);
  });
  const coresParedeCanvas = new Map();
  for (const luz of arandelas.luzes) {
    if (coresParedeCanvas.has(luz.cor.css)) continue;
    const canais = [16, 8, 0].map(shift => (luz.cor.phaser >> shift) & 255);
    const clara = canais.reduce((cor, canal) => (cor << 8) | Math.round(canal + (255 - canal) * 0.65), 0);
    coresParedeCanvas.set(luz.cor.css, { halo: criarMascaraLuminaria(perfilParede, luz.cor.phaser),
      emissor: criarMascaraLuminaria(perfilEmissorParede, clara) });
  }
  const estatuasGiroflex = new EmergencyStatueOcclusion(scene, luzesIndependentes);
  const carimbosGiroflex = new GiroflexLightCache(paredesLanterna, estatuasGiroflex, celular ? 256 : 512);
  const oclusaoEmissorBoss = new BossEmitterOcclusion(scene, arandelas.luzes);
  const luzesFixas = new FixedLightCache((c, perfil, fonte) => desenharFonteDirecional(c, perfil, fonte,
    paredesLanterna, estatuasGiroflex, fonte.luz.direcao ? oclusaoEmissorBoss : null));
  for (const luz of emergencia.luzes) {
    if (!luz.neon) continue;
    const cor = coresNeonCanvas.get(luz.cor.css);
    luzesFixas.adicionar(luz, [neonCanvas, cor.halo, cor.emissor]);
  }
  for (const luz of arandelas.luzes) {
    const cor = coresParedeCanvas.get(luz.cor.css);
    luzesFixas.adicionar(luz, [paredeCanvas, cor.halo, cor.emissor]);
  }
  // Carimbo local reutilizado; não cria outra máscara do tamanho da tela.
  const lanternaOclusaoCanvas = document.createElement("canvas");
  lanternaOclusaoCanvas.width = 460;
  lanternaOclusaoCanvas.height = 320;
  const oclusaoContext = lanternaOclusaoCanvas.getContext("2d");
  // Uma composição compartilhada permite recortar o brilho atrás dos atores.
  const brilhoCanvas = document.createElement("canvas");
  brilhoCanvas.width = larguraMascara; brilhoCanvas.height = alturaMascara;
  const brilhoContext = brilhoCanvas.getContext("2d");
  const brilhoAnterior = { frame: null };
  const brilhoAtoresAnteriores = new Map();
  const oclusaoAnterior = { frame: null };
  const camadasAnteriores = new Map();
  let paredeAnterior = null;
  let regiaoAnterior = null;
  const verificarCamada = layer => {
    if (!layer) return;
    let anterior = camadasAnteriores.get(layer);
    if (!anterior) {
      anterior = {};
      camadasAnteriores.set(layer, anterior);
      invalidada = true;
    }
    for (const campo of CAMPOS_OCLUSAO_CAMADA) {
      if (anterior[campo] !== layer[campo]) {
        anterior[campo] = layer[campo];
        invalidada = true;
      }
    }
  };
  const poseLanterna = { x: 0, y: 0, angulo: null, direcao: null };
  const lanternasAliadas = scene.lanternasAliadas = new Map();
  const lanternaAnterior = { x: null, y: null, angulo: null };
  const coresCanvas = new Map();
  const areasCanvas = new Map();
  for (const luz of iluminacao.lampadas) {
    if (!coresCanvas.has(luz.cor.css)) coresCanvas.set(luz.cor.css, criarMascaraLuminaria(perfil, luz.cor.phaser));
    if (luz.area) {
      const perfilArea = new Uint8Array(TAMANHO_MASCARA * TAMANHO_MASCARA);
      // A área inteira recebe a mesma luz, inclusive junto às bordas e nos cantos.
      perfilArea.fill(Math.round(0.55 * 255));
      areasCanvas.set(luz, { mascara: criarMascaraLuminaria(perfilArea),
        cor: criarMascaraLuminaria(perfilArea, luz.cor.phaser) });
    }
  }

  // Já cobre a cena antes do primeiro render, mesmo sem jogador ou lâmpadas visíveis.
  transformarMascara(context);
  context.fillStyle = COR_ESCURIDAO;
  context.fillRect(0, 0, width, height);
  texture.refresh();
  const overlay = scene.add.image(0, 0, TEXTURA_ESCURIDAO_PARTE2)
    .setOrigin(0).setScrollFactor(0).setDepth(DEPTH_ESCURIDAO);

  const definirIluminacaoFabrica = (ligada, obterProgresso = null) => {
    somPartida.stop();
    somPiscadas.stop();
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
      .setScale(escalaX * width / larguraMascara, height / (det * escalaX * alturaMascara));
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
      larguraMascara = Math.ceil(width * resolucao);
      alturaMascara = Math.ceil(height * resolucao);
      texture.setSize(larguraMascara, alturaMascara);
      brilhoCanvas.width = larguraMascara; brilhoCanvas.height = alturaMascara;
      overlay.setTexture(TEXTURA_ESCURIDAO_PARTE2);
      invalidada = true;
    }
    posicionarOverlay();
    zonas.atualizar(scene.time.now, scene.portasFabrica ?? [], iluminacao.energia);
    const luzesIntroducao = obterLuzesIntroducao();
    const fontes = iluminacao.atualizar(scene.time.now, camera, zonasCena);
    const giroflex = emergencia.atualizar(scene.time.now, camera, zonasCena);
    const fontesParede = arandelas.atualizar(scene.time.now, camera, zonasCena);
    const fontesEnergiaBoss = energiaBoss.atualizar(camera);
    auraBoss.sincronizar(fontesEnergiaBoss);
    if (fontesParede.some(fonte => fonte.luz.direcao === "Cima") && oclusaoEmissorBoss.atualizar(camera)) invalidada = true;
    if ((giroflex.length || fontesParede.length) && estatuasGiroflex.atualizar()) invalidada = true;
    carimbosGiroflex.sincronizar(giroflex);
    const player = scene.player;
    const temBrilho = giroflex.length || fontesParede.length || fontesEnergiaBoss.length ||
      luzesFixas.fontes.length || fontes.some(fonte => fonte.luz.pulsando);
    const atoresSobreBrilho = new Set();
    if (temBrilho) {
      for (const ator of [scene.companionPet,
        ...(scene.inimigos ?? []).filter(inimigo => inimigo?.tipoRobo === "bola"),
        ...(scene.remotePlayers?.values?.() ?? [])]) {
        if (!ator ||
            ator.active === false || ator.visible === false || (ator.alpha ?? 1) <= 0 ||
            !ator.frame?.source?.image || !Number.isFinite(ator.x) || !Number.isFinite(ator.y)) continue;
        atoresSobreBrilho.add(ator);
        let anterior = brilhoAtoresAnteriores.get(ator);
        if (!anterior) { anterior = {}; brilhoAtoresAnteriores.set(ator, anterior); invalidada = true; }
        for (const campo of CAMPOS_BRILHO_ATOR) {
          if (anterior[campo] !== ator[campo]) { anterior[campo] = ator[campo]; invalidada = true; }
        }
      }
    }
    for (const ator of brilhoAtoresAnteriores.keys()) {
      if (atoresSobreBrilho.has(ator)) continue;
      brilhoAtoresAnteriores.delete(ator);
      invalidada = true;
    }
    const personagemSobreBrilho = !!(temBrilho && player?.active !== false && player?.visible !== false &&
      (player?.alpha ?? 1) > 0 && player?.frame?.source?.image && Number.isFinite(player.x) && Number.isFinite(player.y));
    const bossSobreBrilho = fontesEnergiaBoss.some(fonte => fonte.vermelha && fonte.emissor?.frame?.source?.image);
    const separarBrilho = personagemSobreBrilho || bossSobreBrilho || atoresSobreBrilho.size > 0;
    const frameBrilho = personagemSobreBrilho ? player.frame : null;
    if (brilhoAnterior.frame !== frameBrilho) { brilhoAnterior.frame = frameBrilho; invalidada = true; }
    if (personagemSobreBrilho) {
      for (const campo of CAMPOS_OCLUSAO) {
        if (brilhoAnterior[campo] !== player[campo]) { brilhoAnterior[campo] = player[campo]; invalidada = true; }
      }
    }
    const lanternaAtiva = !iluminacao.energia && player?.active !== false &&
      !!player && Number.isFinite(player.x) && Number.isFinite(player.y);
    if (atualizarLanternasAliadas(scene, lanternasAliadas, iluminacao.energia)) invalidada = true;
    let angulo = null;
    if (lanternaAtiva || lanternasAliadas.size || giroflex.length || fontesParede.length || fontesEnergiaBoss.length) {
      paredesLanterna.atualizarPortas();
      if (revisaoParedes !== paredesLanterna.revisao) {
        invalidada = true;
        revisaoParedes = paredesLanterna.revisao;
      }
    }
    luzesFixas.atualizar(scene.time.now, zonasCena, paredesLanterna, estatuasGiroflex, oclusaoEmissorBoss);
    if (lanternaAtiva) {
      atualizarPoseLanterna(scene, poseLanterna);
      angulo = poseLanterna.angulo;
    }
    const lx = lanternaAtiva ? poseLanterna.x : null;
    const ly = lanternaAtiva ? poseLanterna.y : null;
    const lanternaAtras = lanternaAtiva && Math.sin(angulo) < -0.001 &&
      player.visible !== false && !!player.frame?.source?.image;
    const camadaFrenteLanterna = scene.camadaParedeAcimaPerso;
    const regiaoFrenteLanterna = lanternaAtiva ? obterRegiaoFrenteLanterna(scene, player) : null;
    if (lanternaAtiva) {
      if (paredeAnterior !== camadaFrenteLanterna || regiaoAnterior !== regiaoFrenteLanterna) {
        paredeAnterior = camadaFrenteLanterna;
        regiaoAnterior = regiaoFrenteLanterna;
        invalidada = true;
      }
      verificarCamada(camadaFrenteLanterna);
      if (regiaoFrenteLanterna) {
        for (const layer of scene.camadasMapaParte2 ?? []) {
          if (!camadaEhPisoFabrica(layer.layer?.name)) verificarCamada(layer);
        }
      }
    }
    const frameOclusao = lanternaAtras ? player.frame : null;
    if (oclusaoAnterior.frame !== frameOclusao) {
      invalidada = true;
      oclusaoAnterior.frame = frameOclusao;
    }
    if (lanternaAtras) {
      for (const campo of CAMPOS_OCLUSAO) {
        if (oclusaoAnterior[campo] !== player[campo]) {
          invalidada = true;
          oclusaoAnterior[campo] = player[campo];
        }
      }
    }
    if (lanternaAnterior.x !== lx || lanternaAnterior.y !== ly || lanternaAnterior.angulo !== angulo) {
      invalidada = true;
      Object.assign(lanternaAnterior, { x: lx, y: ly, angulo });
    }
    // Usa a mesma leitura do relógio do gerador que move as luzes, inclusive no último quadro.
    // O som da partida e os estalos ambientes têm volumes e controles próprios.
    if (iluminacao.progressoPartida !== null) somPartida.update(iluminacao.progressoPartida);
    somPiscadas.update(iluminacao.falhasIniciadas);
    const m = camera.matrix;
    // Compara valores em memória reutilizada, sem criar arrays ou strings a cada frame.
    if (!invalidada && ultimoQuadro.width === width && ultimoQuadro.height === height &&
      ultimoQuadro.a === m.a && ultimoQuadro.b === m.b && ultimoQuadro.c === m.c && ultimoQuadro.d === m.d &&
      ultimoQuadro.e === m.e && ultimoQuadro.f === m.f && ultimoQuadro.revisao === iluminacao.revisao &&
      ultimoQuadro.revisaoEmergencia === emergencia.revisao && ultimoQuadro.revisaoZonas === zonas.revisao &&
      ultimoQuadro.revisaoBoss === arandelas.revisao && ultimoQuadro.revisaoEnergiaBoss === energiaBoss.revisao &&
      ultimoQuadro.revisaoFixas === luzesFixas.revisao &&
      ultimoQuadro.revisaoIntroducao === (luzesIntroducao?.revisao ?? 0)) return;
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
    ultimoQuadro.revisaoEmergencia = emergencia.revisao;
    ultimoQuadro.revisaoZonas = zonas.revisao;
    ultimoQuadro.revisaoBoss = arandelas.revisao;
    ultimoQuadro.revisaoEnergiaBoss = energiaBoss.revisao;
    ultimoQuadro.revisaoFixas = luzesFixas.revisao;
    ultimoQuadro.revisaoIntroducao = luzesIntroducao?.revisao ?? 0;
    const energiaReduzida = fontesEnergiaBoss.length >= 32;
    if (energiaReduzida) campoEnergiaBoss.preparar(fontesEnergiaBoss, camera, width, height);

    transformarMascara(context);
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);
    context.save();
    transformarMascara(context, m.a, m.b, m.c, m.d, m.e, m.f);
    context.globalCompositeOperation = "destination-out";
    salaBoss.desenhar(context, camera, luzesIntroducao?.ambiente ?? 1);
    for (const { luz, intensidade } of fontes) {
      context.globalAlpha = intensidade;
      desenharLuminaria(context, areasCanvas.get(luz)?.mascara ?? (luz.pulsando ? luminariaPulsoCanvas : luminariaCanvas), luz, limitesLampadas);
    }
    for (const fonte of giroflex) {
      if (fonte.luz.neon) continue;
      context.globalAlpha = fonte.intensidade;
      carimbosGiroflex.desenhar(context, fonte, fonte.luz.parede ? giroflexLateralCanvas : giroflexCanvas);
    }
    luzesFixas.desenhar(context, false, camera);
    if (energiaReduzida) campoEnergiaBoss.desenhar(context, false, larguraMascara, alturaMascara);
    else for (const fonte of fontesEnergiaBoss) {
      context.globalAlpha = fonte.intensidade;
      desenharLuminaria(context, obterPerfilEnergia(fonte).mascara, fonte.luz, paredesLanterna);
    }
    if (lanternaAtiva) {
      const usarOclusao = lanternaAtras || !!camadaFrenteLanterna || !!regiaoFrenteLanterna;
      if (usarOclusao) ocultarLanterna(oclusaoContext, lanternaCanvas, scene, poseLanterna,
        lanternaAtras, regiaoFrenteLanterna);
      context.save();
      context.globalAlpha = 1;
      paredesLanterna.recortar(context, lx, ly, regiaoFrenteLanterna);
      const cos = Math.cos(angulo), sin = Math.sin(angulo);
      context.transform(cos, sin, -sin, cos, lx, ly);
      context.drawImage(usarOclusao ? lanternaOclusaoCanvas : lanternaCanvas, -100, -160, 460, 320);
      context.restore();
    }
    for (const { player: aliado, pose } of lanternasAliadas.values()) {
      const regiao = obterRegiaoFrenteLanterna(scene, aliado);
      const atras = Math.sin(pose.angulo) < -0.001 && !!aliado.frame?.source?.image;
      const oclusao = atras || !!camadaFrenteLanterna || !!regiao;
      if (oclusao) ocultarLanterna(oclusaoContext, lanternaCanvas, scene, pose, atras, regiao, aliado);
      context.save();
      context.globalAlpha = 1;
      paredesLanterna.recortar(context, pose.x, pose.y, regiao);
      const cos = Math.cos(pose.angulo), sin = Math.sin(pose.angulo);
      context.transform(cos, sin, -sin, cos, pose.x, pose.y);
      context.drawImage(oclusao ? lanternaOclusaoCanvas : lanternaCanvas, -100, -160, 460, 320);
      context.restore();
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
    transformarMascara(context, m.a, m.b, m.c, m.d, m.e, m.f);
    // Colore suavemente só a sombra restante. source-atop preserva seu alpha e evita
    // acumular círculos amarelos opacos quando várias lâmpadas se sobrepõem.
    context.globalCompositeOperation = "source-atop";
    const escalaCor = 0.025 / Math.max(1, fontes.length);
    for (const { luz, intensidade } of fontes) {
      if (luz.pulsando) continue;
      context.globalAlpha = intensidade * escalaCor;
      desenharLuminaria(context, areasCanvas.get(luz)?.cor ?? coresCanvas.get(luz.cor.css), luz, limitesLampadas);
    }
    context.restore();
    const corContext = separarBrilho ? brilhoContext : context;
    if (separarBrilho) {
      transformarMascara(corContext);
      corContext.clearRect(0, 0, width, height);
    }
    corContext.save();
    transformarMascara(corContext, m.a, m.b, m.c, m.d, m.e, m.f);
    // Vermelho puro sobre o cenário: limitar a cor à sombra residual deixava o piso
    // claro dominar o pulso. O mesmo gradiente mantém as bordas suaves.
    corContext.globalCompositeOperation = "source-over";
    for (const { luz, intensidade } of fontes) {
      if (!luz.pulsando) continue;
      corContext.globalAlpha = intensidade * 0.45;
      desenharLuminaria(corContext, areasCanvas.get(luz)?.cor ?? corPulsoCanvas, luz, limitesLampadas);
    }
    for (const fonte of giroflex) {
      if (fonte.luz.neon) continue;
      corContext.globalAlpha = fonte.intensidade * 0.55;
      carimbosGiroflex.desenhar(corContext, fonte, fonte.luz.parede ? giroflexLateralCanvas : giroflexCanvas);
    }
    luzesFixas.desenhar(corContext, true, camera);
    if (energiaReduzida) campoEnergiaBoss.desenhar(corContext, true, larguraMascara, alturaMascara);
    else for (const fonte of fontesEnergiaBoss) {
      corContext.globalAlpha = fonte.intensidade * 0.45;
      desenharLuminaria(corContext, obterPerfilEnergia(fonte).cor, fonte.luz, paredesLanterna);
    }
    if (personagemSobreBrilho) ocultarBrilhoAtrasPersonagem(corContext, player);
    for (const ator of atoresSobreBrilho) ocultarBrilhoAtrasPersonagem(corContext, ator);
    // Recorta também neons, arandelas e luzes de outras cópias, antes de juntar a cor à sombra.
    // O clareamento do sprite continua separado, sem deixar as faixas do piso atravessarem o corpo.
    if (bossSobreBrilho) for (const fonte of fontesEnergiaBoss) {
      if (fonte.vermelha) ocultarBrilhoAtrasPersonagem(corContext, fonte.emissor);
    }
    corContext.restore();
    if (separarBrilho) {
      context.save();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalAlpha = 1;
      context.globalCompositeOperation = "source-over";
      context.drawImage(brilhoCanvas, 0, 0);
      context.restore();
    }
    context.save();
    transformarMascara(context, m.a, m.b, m.c, m.d, m.e, m.f);
    zonas.desenharEscuridao(context);
    // Clareia apenas os pixels do boss e das cópias, preservando as cores da arte.
    // Reutiliza o overlay e sua invalidação por pose, sem outra textura ou luz no chão.
    for (const fonte of fontesEnergiaBoss) {
      if (fonte.vermelha) ocultarBrilhoAtrasPersonagem(context, fonte.emissor,
        fonte.emissor.x, fonte.emissor.y, CLARIDADE_SPRITE_BOSS);
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
    if (scene.iluminacaoEmergencia === emergencia) scene.iluminacaoEmergencia = null;
    if (scene.iluminacaoBoss === arandelas) scene.iluminacaoBoss = null;
    if (scene.iluminacaoEnergiaBoss === energiaBoss) scene.iluminacaoEnergiaBoss = null;
    if (scene.zonasLuzApagada === zonas) scene.zonasLuzApagada = null;
    somPartida.destroy();
    somPiscadas.destroy();
    iluminacao.destroy();
    emergencia.destroy();
    arandelas.destroy();
    energiaBoss.destroy();
    campoEnergiaBoss.destroy();
    auraBoss.destroy();
    salaBoss.destroy();
    luzesFixas.destroy();
    zonas.destroy();
    carimbosGiroflex.destroy();
    estatuasGiroflex.destroy();
    oclusaoEmissorBoss.destroy();
    paredesLanterna.destroy();
    brilhoAtoresAnteriores.clear();
    lanternasAliadas.clear();
    if (scene.lanternasAliadas === lanternasAliadas) scene.lanternasAliadas = null;
    limitesLampadas?.destroy();
    overlay.destroy();
    if (scene.textures.exists(TEXTURA_ESCURIDAO_PARTE2)) scene.textures.remove(TEXTURA_ESCURIDAO_PARTE2);
    for (const canvas of [luminariaCanvas, luminariaPulsoCanvas, corPulsoCanvas, lanternaCanvas,
      lanternaOclusaoCanvas, brilhoCanvas, giroflexCanvas,
      giroflexLateralCanvas, neonCanvas,
      paredeCanvas, ...coresCanvas.values()]) {
      if (!canvas) continue;
      canvas.width = canvas.height = 0;
    }
    coresCanvas.clear();
    for (const { halo, emissor } of coresNeonCanvas.values()) {
      halo.width = halo.height = emissor.width = emissor.height = 0;
    }
    coresNeonCanvas.clear();
    for (const { halo, emissor } of coresParedeCanvas.values()) {
      halo.width = halo.height = emissor.width = emissor.height = 0;
    }
    coresParedeCanvas.clear();
    for (const { mascara, cor } of perfisEnergiaBoss) {
      mascara.width = mascara.height = cor.width = cor.height = 0;
    }
    perfisEnergiaBoss.length = 0;
    for (const { mascara, cor } of areasCanvas.values()) {
      mascara.width = mascara.height = cor.width = cor.height = 0;
    }
    areasCanvas.clear();
    camadasAnteriores.clear();
  };
  renderer.on(Phaser.Renderer.Events.RENDER, atualizarIluminacao);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, limparIluminacao);
  return limparIluminacao;
}

export { calcularPerfilLuz, ESCURIDAO_MINIMA_FABRICA };
export default criarIluminacaoTerror;
