import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { EventEmitter } from "node:events";
import criarIluminacaoTerror, { calcularPerfilLuz, ESCURIDAO_MINIMA_FABRICA } from "./TerrorLighting.js";
import FactoryLighting, {
  ESCURIDAO_AMBIENTE_FABRICA, MULTIPLICADOR_ALCANCE_FABRICA, lerLuzesFabrica, lerCorTiled, intensidadeLuzPartida, luzAfetaCamera,
} from "./FactoryLighting.js";
import { atualizarPoseLanterna } from "./FlashlightPose.js";

const bundle = readFileSync(new URL("../libs/phaser.min.js", import.meta.url), "utf8");
const context = { module: { exports: {} }, exports: {}, importScripts() {}, window: {}, navigator: {} };
vm.runInNewContext(bundle.replace("i(85454)})());", "i})());"), context);
const load = context.module.exports;
const Camera = load(38058);
const parseObject = load(52205);

function assertSombraAmbiente(alpha, message) {
  assert.ok(Math.abs(alpha - ESCURIDAO_AMBIENTE_FABRICA) < 1e-12, message);
}

function criarCamera() {
  const camera = new Camera(0, 0, 800, 450);
  camera.preRender();
  return camera;
}

function mapa(...objects) {
  return { getObjectLayer: name => name === "LuzesFabrica" ? { objects } : null };
}
function ponto(properties = {}, x = 400, y = 225) {
  return { id: 1, point: true, x, y, properties };
}

test("reads every real Tiled point through Phaser without changing the negative coordinates", () => {
  const raw = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const layer = raw.layers.find(layer => layer.name === "LuzesFabrica");
  assert.ok(layer?.objects.length > 0);
  const before = JSON.stringify(layer);
  const lights = lerLuzesFabrica({ getObjectLayer: name => name === layer.name
    ? { ...layer, objects: layer.objects.map(object => parseObject(object)) } : null });
  assert.equal(lights.length, layer.objects.length);
  assert.deepEqual(lights.map(({ id, x, y }) => ({ id, x, y })),
    layer.objects.map(({ id, x, y }) => ({ id, x, y })));
  assert.equal(lights[0].raio, 170);
  assert.deepEqual(lights[0].cor, { css: "#FFD27A", phaser: 0xFFD27A, alpha: 1 });
  for (const object of layer.objects.filter(object => object.point)) {
    const orientation = object.properties.find(property => property.name === "Orientacao").value;
    assert.ok(["Horizontal", "Vertical", "Vetical"].includes(orientation), `lamp ${object.id} has a valid map orientation`);
    assert.equal(lights.find(light => light.id === object.id).orientacao,
      orientation === "Horizontal" ? "horizontal" : "vertical");
  }
  const verticalPoints = layer.objects.filter(object => object.properties?.some(property =>
    property.name === "Orientacao" && ["Vetical", "Vertical"].includes(property.value)));
  assert.ok(verticalPoints.length > 0);
  assert.equal(lights.filter(light => light.orientacao === "vertical").length, verticalPoints.length);
  assert.equal(JSON.stringify(layer), before);
});

test("100% das lâmpadas ligadas do mapa real participam das falhas sem editar o Tiled", () => {
  const raw = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const layer = raw.layers.find(layer => layer.name === "LuzesFabrica");
  const before = JSON.stringify(layer);
  let seed = 321;
  const lights = new FactoryLighting(mapa(...layer.objects.map(object => parseObject(object))), {
    aleatorio: () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646,
  });
  assert.ok(lights.lampadas.every(light => light.piscando));
  lights.definirEnergia(true);
  const camera = criarCamera();
  const failing = new Set();
  for (let now = 0; now <= 20000; now += 25) {
    lights.atualizar(now, camera);
    for (const state of lights.estados) if (state.falha) failing.add(state.luz.id);
  }
  const expected = lights.lampadas.filter(light => light.ligada && light.intensidade > 0 && light.cor.alpha > 0);
  assert.deepEqual([...failing].sort(), expected.map(light => light.id).sort());
  assert.equal(JSON.stringify(layer), before);
});

/**
 * Substituto do Canvas para verificar alpha e transformações da composição, sem navegador.
 * Amostra os desenhos e gradientes registrados; não simula GPU, cores finais ou desempenho.
 */
class CanvasAmostrado {
  constructor() {
    this.width = this.height = 0;
    this.context = new ContextoAmostrado();
  }
  getContext() { return this.context; }
  alphaEm(x, y) { return this.context.alphaEm(x, y); }
  rgbaEm(x, y) { return this.context.rgbaEm(x, y); }
}

const identidade = () => [1, 0, 0, 1, 0, 0];
function multiplicar(a, b) {
  return [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
}
function inversoPonto(m, x, y) {
  const det = m[0] * m[3] - m[1] * m[2];
  x -= m[4]; y -= m[5];
  return [(m[3] * x - m[2] * y) / det, (m[0] * y - m[1] * x) / det];
}
function alphaCor(color) {
  if (/^#[\da-f]{8}$/i.test(color)) return parseInt(color.slice(-2), 16) / 255;
  if (color.startsWith("rgba")) return Number(color.slice(color.lastIndexOf(",") + 1, -1));
  return 1;
}
class ContextoAmostrado {
  constructor() {
    this.estado = { matriz: identidade(), globalAlpha: 1, globalCompositeOperation: "source-over", fillStyle: "#000000" };
    this.pilha = [];
    this.operacoes = [];
    this.gradientes = 0;
  }
  set globalAlpha(value) { this.estado.globalAlpha = value; }
  get globalAlpha() { return this.estado.globalAlpha; }
  set globalCompositeOperation(value) { this.estado.globalCompositeOperation = value; }
  get globalCompositeOperation() { return this.estado.globalCompositeOperation; }
  set fillStyle(value) { this.estado.fillStyle = value; }
  save() { this.pilha.push({ ...this.estado, matriz: [...this.estado.matriz] }); }
  restore() { this.estado = this.pilha.pop(); }
  setTransform(...matriz) { this.estado.matriz = matriz; }
  transform(...matriz) { this.estado.matriz = multiplicar(this.estado.matriz, matriz); }
  translate(x, y) { this.transform(1, 0, 0, 1, x, y); }
  createImageData(width, height) { return { width, height, data: new Uint8ClampedArray(width * height * 4) }; }
  putImageData(image) { this.bitmap = image; }
  createRadialGradient(x, y, _inner, _endX, _endY, raio) {
    this.gradientes++;
    return { x, y, raio, stops: [], addColorStop(at, cor) { this.stops.push([at, alphaCor(cor)]); } };
  }
  registrar(tipo, args) { this.operacoes.push({ ...this.estado, matriz: [...this.estado.matriz], tipo, args }); }
  fillRect(...args) { this.registrar("rect", args); }
  clearRect(...args) { this.registrar("clear", args); }
  drawImage(image, ...args) {
    if (args.length === 8) {
      const [sx, sy, sw, sh, x, y, width, height] = args;
      this.registrar("image", [x, y, width, height, image, sx, sy, sw, sh]);
    } else {
      const [x, y, width = image.width, height = image.height] = args;
      this.registrar("image", [x, y, width, height, image]);
    }
  }
  beginPath() {}
  arc(x, y, raio) { this.circulo = [x, y, raio]; }
  fill() { this.registrar("circle", this.circulo); }
  alphaEm(screenX, screenY) {
    if (this.bitmap) {
      const { data, width, height } = this.bitmap;
      const x = Math.floor(screenX), y = Math.floor(screenY);
      return x >= 0 && y >= 0 && x < width && y < height ? data[(y * width + x) * 4 + 3] / 255 : 0;
    }
    let destination = 0;
    for (const op of this.operacoes) {
      const [x, y] = inversoPonto(op.matriz, screenX, screenY);
      const [left, top, width, height, image, sx = 0, sy = 0, sw = image?.width, sh = image?.height] = op.args;
      const inside = op.tipo === "circle" ? Math.hypot(x - left, y - top) < width
        : x >= left && y >= top && x < left + width && y < top + height;
      if (!inside) continue;
      if (op.tipo === "clear") { destination = 0; continue; }
      let source;
      if (image) source = image.alphaEm(sx + (x - left) / width * sw, sy + (y - top) / height * sh);
      else if (typeof op.fillStyle === "string") source = alphaCor(op.fillStyle);
      else {
        const gradient = op.fillStyle;
        const radius = Math.hypot(x - gradient.x, y - gradient.y) / gradient.raio;
        source = 0;
        for (let i = 1; i < gradient.stops.length; i++) {
          const [end, endAlpha] = gradient.stops[i];
          const [start, startAlpha] = gradient.stops[i - 1];
          if (radius <= end) {
            source = startAlpha + (endAlpha - startAlpha) * (radius - start) / (end - start);
            break;
          }
        }
      }
      source *= op.globalAlpha;
      if (op.globalCompositeOperation === "destination-out") destination *= 1 - source;
      else if (op.globalCompositeOperation === "source-in") destination *= source;
      else if (op.globalCompositeOperation === "destination-over") destination += source * (1 - destination);
      else if (op.globalCompositeOperation !== "source-atop") destination = source + destination * (1 - source);
    }
    return destination;
  }

  /** Amostra RGBA com as equações Porter-Duff, para conferir preservação da cor do piso. */
  rgbaEm(screenX, screenY) {
    if (this.bitmap) {
      const { data, width, height } = this.bitmap;
      const x = Math.floor(screenX), y = Math.floor(screenY);
      if (x < 0 || y < 0 || x >= width || y >= height) return [0, 0, 0, 0];
      return Array.from(data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4), value => value / 255);
    }
    let destination = [0, 0, 0, 0];
    for (const op of this.operacoes) {
      const [x, y] = inversoPonto(op.matriz, screenX, screenY);
      const [left, top, width, height, image, sx = 0, sy = 0, sw = image?.width, sh = image?.height] = op.args;
      if (!(x >= left && y >= top && x < left + width && y < top + height)) continue;
      if (op.tipo === "clear") { destination = [0, 0, 0, 0]; continue; }
      let source;
      if (image) source = image.rgbaEm(sx + (x - left) / width * sw, sy + (y - top) / height * sh);
      else if (op.fillStyle.startsWith("#")) source = [0, 2, 4].map(i => parseInt(op.fillStyle.slice(1 + i, 3 + i), 16) / 255).concat(alphaCor(op.fillStyle));
      else source = op.fillStyle.slice(5, -1).split(",").map(Number).map((v, i) => i < 3 ? v / 255 : v);
      source[3] *= op.globalAlpha;
      for (let i = 0; i < 3; i++) source[i] *= source[3];
      const sa = source[3], da = destination[3];
      let fs = 1, fd = 1 - sa;
      if (op.globalCompositeOperation === "destination-out") { fs = 0; fd = 1 - sa; }
      else if (op.globalCompositeOperation === "source-in") { fs = da; fd = 0; }
      else if (op.globalCompositeOperation === "destination-over") { fs = 1 - da; fd = 1; }
      else if (op.globalCompositeOperation === "source-atop") { fs = da; fd = 1 - sa; }
      destination = source.map((value, i) => value * fs + destination[i] * fd);
    }
    return destination.map((value, i) => i < 3 && destination[3] ? value / destination[3] : value);
  }
}

function cenaComMascara(t, objects = [ponto()], powered = false, audio = {}) {
  const oldPhaser = globalThis.Phaser;
  const oldDocument = globalThis.document;
  const Vector2 = load(26099);
  const canvases = [];
  globalThis.document = { createElement: () => {
    const canvas = new CanvasAmostrado();
    canvases.push(canvas);
    return canvas;
  } };
  globalThis.Phaser = {
    Math: { Vector2 }, Textures: { FilterMode: { LINEAR: 0 } },
    Renderer: { Events: { RENDER: "render" } },
    Scenes: { Events: { SHUTDOWN: "shutdown" } },
  };
  const textures = new Map();
  const images = [];
  const scene = {
    ...audio,
    map: mapa(...objects), time: { now: 0 }, direcaoAtual: "right", luzFabricaAcesa: powered,
    cameras: { main: criarCamera() }, events: new EventEmitter(),
    game: { renderer: new EventEmitter() },
    textures: {
      exists: key => textures.has(key),
      remove: key => textures.delete(key),
      createCanvas(key, width, height) {
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        const texture = { canvas, refreshes: 0, getContext: () => canvas.getContext("2d"),
          setFilter(value) { this.filter = value; },
          refresh() { this.refreshes++; },
          setSize(w, h) { canvas.width = w; canvas.height = h; canvas.context.operacoes = []; },
        };
        textures.set(key, texture);
        return texture;
      },
    },
    add: { image(x, y, key) {
      const image = { x, y, key, alpha: 1, visible: true,
        setOrigin() { return this; }, setScrollFactor() { return this; },
        setDepth(depth) { this.depth = depth; return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; },
        setRotation(rotation) { this.rotation = rotation; return this; },
        setScale(scaleX, scaleY) { this.scaleX = scaleX; this.scaleY = scaleY; return this; },
        setTexture(key) { this.key = key; return this; },
        destroy() { this.destroyed = true; },
      };
      images.push(image);
      return image;
    } },
  };
  const cleanup = criarIluminacaoTerror(scene);
  t.after(() => {
    cleanup();
    if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
    if (oldPhaser === undefined) delete globalThis.Phaser; else globalThis.Phaser = oldPhaser;
  });
  const texture = textures.get("level1-parte2-escuridao");
  function render() {
    scene.cameras.main.preRender();
    scene.game.renderer.emit("render", scene, scene.cameras.main);
  }
  return { scene, render, cleanup, texture, textures, images, canvases };
}

test("one mask preserves configured ambient shadow and soft local openings without overexposing overlapping lamps", t => {
  const { scene, render, texture, images } = cenaComMascara(t, [ponto(), ponto()]);
  render();
  const alpha = (x, y) => texture.canvas.alphaEm(x, y);
  assertSombraAmbiente(alpha(400, 225), "lamps stay off before generator activation");
  scene.definirIluminacaoFabrica(true);
  render();
  assert.equal(images.length, 1);
  assert.equal(images[0].alpha, 1);
  assert.equal(images[0].visible, true);
  assertSombraAmbiente(alpha(10, 10));
  assertSombraAmbiente(alpha(400 + 256, 225), "light fades completely outside its configured radius");
  const center = alpha(400, 225), middle = alpha(435, 225), edge = alpha(475, 225);
  assert.ok(center >= ESCURIDAO_MINIMA_FABRICA && center < 0.3);
  assert.ok(center < middle && middle < edge && edge < ESCURIDAO_AMBIENTE_FABRICA, "no solid light circles");
  const uploads = texture.refreshes;
  render();
  assert.equal(texture.refreshes, uploads, "stationary scenes reuse the composed texture");
});

test("pulsing lamps have a soft diffuse red glow while ordinary lamps keep their color", t => {
  const { render, texture, scene } = cenaComMascara(t, [
    ponto({ Pulsando: true, Cor: "#ff00ff00" }, 200, 225),
    ponto({ Cor: "#ff00ff00" }, 600, 225),
  ], true);
  render();
  const emergency = texture.canvas.rgbaEm(240, 225);
  const normal = texture.canvas.rgbaEm(640, 225);
  assert.ok(emergency[0] > 0.4, "emergency overlay keeps its red tint");
  assert.equal(emergency[1], 0);
  assert.equal(emergency[2], 0);
  const center = texture.canvas.rgbaEm(200, 225);
  const redCenter = center[0] * center[3];
  assert.ok(redCenter > 0.3 && redCenter < 0.5, "center preserves the floor instead of covering it in opaque red");
  const halo = texture.canvas.rgbaEm(200, 325);
  const redHalo = halo[0] * halo[3];
  assert.ok(redHalo > 0.08 && redHalo < redCenter, "red diffuses gradually away from the lamp");
  assert.ok(normal[1] > normal[0], "ordinary lamp keeps its configured green tint");
  assert.equal(scene.iluminacaoFabrica.lampadas[1].cor.css, "#00FF00");
});

test("pulsing light redraws the shared mask while the camera stays stationary", t => {
  const { scene, render, texture } = cenaComMascara(t, [
    ponto({ Pulsando: true, Cor: "#ffed333b", Orientacao: "Vertical" }),
  ], true);
  render();
  const peak = texture.canvas.rgbaEm(400, 225)[0];
  const uploads = texture.refreshes;
  scene.time.now = 800;
  render();
  assert.ok(texture.canvas.rgbaEm(400, 225)[0] < peak - 0.1);
  assert.equal(texture.refreshes, uploads + 1);
  render();
  assert.equal(texture.refreshes, uploads + 1, "paused time reuses the texture");
  scene.time.now = 1600;
  render();
  assert.equal(texture.canvas.rgbaEm(400, 225)[0], peak);
});

test("rectangular emergency areas cover all edges and corners at reduced intensity and pulse with generator power", t => {
  const area = { id: 2000, x: 100, y: 75, width: 600, height: 300, rotation: 0,
    properties: { Pulsando: true, Ligada: true, Raio: 60 } };
  const { scene, render, texture } = cenaComMascara(t, [area]);
  render();
  assertSombraAmbiente(texture.canvas.alphaEm(400, 225));
  scene.definirIluminacaoFabrica(true);
  render();
  const sampleRed = (x, y) => {
    const rgba = texture.canvas.rgbaEm(x, y);
    assert.equal(rgba[1], 0);
    assert.equal(rgba[2], 0);
    return rgba[0] * rgba[3];
  };
  const peak = sampleRed(400, 225);
  assert.ok(peak > 0.2 && peak < 0.3);
  assert.equal(sampleRed(250, 225), peak, "fills the rectangle beyond a point lamp radius");
  assert.equal(sampleRed(100, 75), peak, "covers the corners at full area intensity");
  assert.equal(sampleRed(699, 374), peak, "covers the opposite edge too");
  assert.equal(sampleRed(90, 225), 0, "stays inside the configured area");
  assert.equal(sampleRed(400, 385), 0);
  scene.time.now = 800;
  render();
  assert.ok(sampleRed(400, 225) < peak / 5);
  scene.definirIluminacaoFabrica(false);
  render();
  assertSombraAmbiente(texture.canvas.alphaEm(400, 225));
});

test("rectangle culling uses its full bounds even with an offscreen origin", () => {
  const [area] = lerLuzesFabrica(mapa({ id: 1, x: -1000, y: 100, width: 1600, height: 200,
    properties: [{ name: "Pulsando", type: "bool", value: true }] }));
  const camera = criarCamera();
  assert.equal(area.area, true);
  assert.equal(area.pulsando, true);
  assert.equal(luzAfetaCamera(area, camera), true);
  assert.equal(luzAfetaCamera({ ...area, x: -2000 }, camera), false);
  assert.equal(luzAfetaCamera({ ...area, x: 500, y: -1000, rotacao: Math.PI / 2 }, camera), true);
});

test("flashlight illuminates before power, switches off immediately with factory power, and returns after power loss", t => {
  const { scene, render, texture, canvases } = cenaComMascara(t, [ponto({}, 60, 80)]);
  scene.player = { active: true, body: { velocity: { x: 1, y: 0 } },
    x: 140, y: 330,
    getCenter(out) { return out.set(this.x, this.y); } };
  render();
  const sample = (x, y) => texture.canvas.alphaEm(x, y);
  assert.ok(sample(240, 340) < ESCURIDAO_AMBIENTE_FABRICA - 0.1);
  assert.ok(sample(140, 330) < ESCURIDAO_AMBIENTE_FABRICA);
  assertSombraAmbiente(sample(60, 80));
  scene.definirIluminacaoFabrica(true);
  render();
  assert.ok(sample(60, 80) > 0.2 && sample(60, 80) < 0.3);
  assertSombraAmbiente(sample(240, 340));
  assertSombraAmbiente(sample(140, 330));
  const uploads = texture.refreshes;
  const canvasCount = canvases.length;
  for (let i = 0; i < 20; i++) {
    scene.player.x += 10;
    scene.player.body.velocity.x *= -1;
    scene.time.now += 33;
    render();
  }
  assert.equal(texture.refreshes, uploads);
  assert.equal(canvases.length, canvasCount, "masks are reused without creating per-frame canvases");
  scene.definirIluminacaoFabrica(false);
  render();
  assert.ok(sample(scene.player.x + 100, scene.player.y) < ESCURIDAO_AMBIENTE_FABRICA - 0.1);
  assertSombraAmbiente(sample(60, 80));
});

test("flashlight rear halo fades smoothly before the texture boundary in all directions", t => {
  const { scene, render, texture } = cenaComMascara(t, []);
  scene.player = { active: true, x: 400, y: 225 };
  for (const [direction, dx, dy] of [["right", 1, 0], ["left", -1, 0], ["up", 0, -1], ["down", 0, 1]]) {
    scene.direcaoAtual = direction;
    render();
    const mao = atualizarPoseLanterna(scene, {});
    const alpha = distance => texture.canvas.alphaEm(mao.x - dx * distance, mao.y - dy * distance);
    assertSombraAmbiente(alpha(100));
    assertSombraAmbiente(alpha(91));
    let previous = alpha(100);
    for (let distance = 99; distance >= 5; distance--) {
      const current = alpha(distance);
      assert.ok(Math.abs(current - previous) < 0.025, "rear halo has no abrupt straight cutoff");
      previous = current;
    }
    assert.ok(alpha(10) < ESCURIDAO_AMBIENTE_FABRICA - 0.1);
  }
});

test("upward flashlight stays behind the animated silhouette, while downward light passes over the player", t => {
  const { scene, render, texture } = cenaComMascara(t, []);
  const sheet = document.createElement("canvas");
  sheet.width = 256;
  sheet.height = 128;
  const spriteContext = sheet.getContext("2d");
  spriteContext.fillStyle = "#FFFFFF";
  spriteContext.fillRect(128 + 58, 38, 8, 58);
  // Um buraco transparente confere que a oclusão segue alpha, sem um recorte retangular.
  spriteContext.clearRect(128 + 63, 45, 2, 3);
  scene.player = { active: true, visible: true, x: 400, y: 225,
    displayOriginX: 64, displayOriginY: 64, scaleX: 1, scaleY: 1,
    texture: { key: "walk" }, frame: { source: { image: sheet },
      cutX: 128, cutY: 0, cutWidth: 128, cutHeight: 128, realWidth: 128, realHeight: 128 },
    body: { velocity: { x: 0, y: -100 } } };
  scene.direcaoAtual = "up";
  render();
  const sample = (x, y) => texture.canvas.alphaEm(x, y);
  assertSombraAmbiente(sample(400, 203), "a cabeça opaca não recebe luz da lanterna por trás");
  assert.ok(sample(400, 207) < 0.5, "pixels transparentes deixam o feixe passar");
  assert.ok(sample(400, 150) < 0.5, "o cenário adiante continua iluminado");
  assertSombraAmbiente(sample(395, 203));
  assert.ok(sample(405, 203) < 0.6);
  const stationaryUploads = texture.refreshes;
  for (let i = 0; i < 10; i++) render();
  assert.equal(texture.refreshes, stationaryUploads, "silhueta parada reutiliza a máscara");
  scene.player.flipX = true;
  render();
  assert.ok(sample(395, 203) < 0.6, "a oclusão acompanha o espelhamento sem mudar a barriga");
  assertSombraAmbiente(sample(405, 203));
  scene.player.frame = { ...scene.player.frame, cutX: 0 };
  render();
  assert.ok(sample(400, 203) < 0.5, "trocar o frame atualiza a silhueta");
  scene.player.frame = { ...scene.player.frame, cutX: 128 };
  scene.player.flipX = false;
  scene.player.body.velocity.y = 100;
  scene.direcaoAtual = "down";
  render();
  assert.ok(sample(400, 250) < 0.5, "para baixo o feixe ilumina o jogador por cima");
});

test("capsule light varies continuously along and across its core without a uniform rectangular plateau", () => {
  const center = calcularPerfilLuz(0, 0);
  assert.ok(center > 0.9 && center < 0.95);
  assert.ok(center > calcularPerfilLuz(0.03, 0));
  assert.ok(calcularPerfilLuz(0.03, 0) > calcularPerfilLuz(0.08, 0));
  assert.ok(calcularPerfilLuz(0.08, 0) > calcularPerfilLuz(0, 0.08), "core follows a short line segment");
  for (const angle of [0, Math.PI / 8, Math.PI / 4, Math.PI / 2]) {
    let previous = center;
    for (let step = 1; step <= 2000; step++) {
      const radius = step / 2000 * MULTIPLICADOR_ALCANCE_FABRICA;
      const value = calcularPerfilLuz(Math.cos(angle) * radius, Math.sin(angle) * radius);
      assert.ok(value <= previous + 1e-12, "no rings or bands between the three regions");
      assert.ok(previous - value < 0.006, "no abrupt center or edge transition");
      previous = value;
    }
    assert.equal(calcularPerfilLuz(Math.cos(angle) * (MULTIPLICADOR_ALCANCE_FABRICA + 0.01), Math.sin(angle) * (MULTIPLICADOR_ALCANCE_FABRICA + 0.01)), 0);
  }
});

test("Vetical e Vertical do mapa real desenham o foco na vertical", async t => {
  const raw = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const layer = raw.layers.find(layer => layer.name === "LuzesFabrica");
  for (const orientation of ["Vetical", "Vertical"]) {
    await t.test(orientation, t => {
      const object = layer.objects.find(object => object.point && object.properties?.some(property =>
        property.name === "Orientacao" && property.value === orientation));
      assert.ok(object, `o mapa contém uma lâmpada com ${orientation}`);
      const { scene, render, texture } = cenaComMascara(t, [parseObject(object)], true);
      scene.cameras.main.setScroll(object.x - 400, object.y - 225);
      render();
      const sample = (x, y) => texture.canvas.alphaEm(x, y);
      assert.ok(sample(400, 225) < sample(400, 235), "foco permanece no ponto da lâmpada");
      assert.ok(sample(400, 235) < sample(410, 225), "foco se alonga no eixo vertical");
    });
  }
});

test("industrial light reveals an elongated capsule with smoothly diffused surroundings in both orientations", t => {
  const { render, texture } = cenaComMascara(t, [
    ponto({}, 200, 225), ponto({ Orientacao: "Vetical" }, 600, 225),
  ], true);
  render();
  const sample = (x, y) => texture.canvas.alphaEm(x, y);
  const center = sample(200, 225);
  assert.ok(center > 0.2 && center < 0.3);
  assert.ok(sample(210, 225) > center, "brightness changes even inside the luminous core");
  assert.ok(sample(200, 235) > sample(210, 225), "horizontal capsule is longer along X");
  assert.ok(sample(610, 225) > sample(600, 235), "vertical capsule is longer along Y");
  assert.ok(sample(260, 285) < ESCURIDAO_AMBIENTE_FABRICA, "diffuse region surrounds the capsule");
  assert.ok(sample(371, 225) < ESCURIDAO_AMBIENTE_FABRICA, "diffuse light extends past the former reach");
  let previous = center;
  for (const offset of [10, 20, 35, 60, 90, 120, 150, 171]) {
    const value = sample(200 + offset, 225);
    assert.ok(value >= previous && value <= ESCURIDAO_AMBIENTE_FABRICA);
    previous = value;
  }
});

test("a continuous halo reveals the floor out to the extended reach and generator power controls the entire profile", t => {
  const { scene, render, texture } = cenaComMascara(t, [ponto()], true);
  render();
  const sample = (dx, dy) => texture.canvas.alphaEm(400 + dx, 225 + dy);
  assert.ok(sample(0, 0) >= 0.2 && sample(0, 0) < 0.3);
  assert.ok(sample(100, 0) < ESCURIDAO_AMBIENTE_FABRICA);
  assert.ok(sample(0, 100) < ESCURIDAO_AMBIENTE_FABRICA);
  assert.ok(sample(60, 60) < ESCURIDAO_AMBIENTE_FABRICA);
  assert.ok(sample(0, 70) < sample(0, 100));
  assert.ok(sample(0, 100) < sample(0, 115));
  assert.ok(sample(0, 180) < ESCURIDAO_AMBIENTE_FABRICA, "halo reaches beyond the configured base radius");
  assertSombraAmbiente(sample(256, 0));
  scene.definirIluminacaoFabrica(false);
  render();
  assertSombraAmbiente(sample(0, 0));
  assertSombraAmbiente(sample(100, 0));
});

test("overlapping lamps retain residual shadow and only erase darkness, without painting white over the map", t => {
  const { render, texture, images, canvases } = cenaComMascara(t, Array.from({ length: 80 }, () => ponto()), true);
  render();
  assert.equal(images.length, 1);
  const center = texture.canvas.rgbaEm(400, 225);
  assert.ok(center[3] >= ESCURIDAO_MINIMA_FABRICA - 1e-12);
  assert.ok(center[3] <= ESCURIDAO_MINIMA_FABRICA + 0.001);
  assertSombraAmbiente(texture.canvas.alphaEm(10, 10));
  assert.ok(Math.abs(center[3] - texture.canvas.alphaEm(400, 225)) < 1e-12);
  for (let channel = 0; channel < 3; channel++) assert.ok(center[channel] < 0.025, "warm tint remains subtle even with many lights");
  const floor = [0.25, 0.4, 0.15];
  const result = floor.map((channel, i) => center[i] * center[3] + channel * (1 - center[3]));
  for (let i = 0; i < 3; i++) assert.ok(result[i] >= floor[i] * 0.79 && result[i] <= floor[i] * 0.84);
  for (const op of texture.getContext().operacoes.filter(op => op.tipo === "image")) {
    const source = op.args[4];
    if (source === canvases[1]) assert.equal(op.globalCompositeOperation, "destination-out", "white alpha stamp is only used to remove darkness");
    else assert.equal(op.globalCompositeOperation, "source-atop");
  }
});

test("a lamp remains visible when only its outer halo reaches the camera", t => {
  const { render, texture } = cenaComMascara(t, [ponto({}, -110, 225)], true);
  render();
  assert.ok(texture.canvas.alphaEm(1, 225) < ESCURIDAO_AMBIENTE_FABRICA);
  assertSombraAmbiente(texture.canvas.alphaEm(146, 225));
});

test("world lights and overlay stay aligned through camera movement, zoom, viewport and resize", t => {
  const { scene, render, texture, images } = cenaComMascara(t, [ponto({}, -1100, -2800)], true);
  const camera = scene.cameras.main;
  for (const [x, y, zoom] of [[-1400, -3000, 1], [-1500, -3050, 1.5], [-1500, -3100, 2]]) {
    camera.setScroll(x, y).setZoom(zoom).setViewport(40, 30, 800, 450);
    render();
    const point = camera.matrix.transformPoint(-1100, -2800);
    if (point.x >= 0 && point.y >= 0 && point.x < 800 && point.y < 450) {
      assert.ok(texture.canvas.alphaEm(point.x, point.y) > 0.2 && texture.canvas.alphaEm(point.x, point.y) < 0.3);
    }
    const overlay = images[0];
    const m = camera.matrix;
    const overlayMatrix = [Math.cos(overlay.rotation) * overlay.scaleX, Math.sin(overlay.rotation) * overlay.scaleX,
      -Math.sin(overlay.rotation) * overlay.scaleY, Math.cos(overlay.rotation) * overlay.scaleY, overlay.x, overlay.y];
    const fixedCamera = [m.a, m.b, m.c, m.d,
      m.e + m.a * camera.scrollX + m.c * camera.scrollY,
      m.f + m.b * camera.scrollX + m.d * camera.scrollY];
    const composed = multiplicar(fixedCamera, overlayMatrix);
    for (let i = 0; i < 6; i++) assert.ok(Math.abs(composed[i] - identidade()[i]) < 1e-5);
  }
  camera.setSize(450, 800);
  render();
  assert.equal(texture.canvas.width, 450);
  assert.equal(texture.canvas.height, 800);
});

test("shutdown releases renderer listeners, canvases and texture; restored visits retain local light and shadow", t => {
  const { scene, render, texture, images, textures, canvases, cleanup } = cenaComMascara(t, [ponto()], true);
  render();
  assert.ok(texture.canvas.alphaEm(400, 225) > 0.2 && texture.canvas.alphaEm(400, 225) < 0.3);
  assertSombraAmbiente(texture.canvas.alphaEm(10, 10));
  assert.equal(scene.game.renderer.listenerCount("render"), 1);
  scene.events.emit("shutdown");
  cleanup();
  assert.equal(scene.game.renderer.listenerCount("render"), 0);
  assert.equal(scene.events.listenerCount("shutdown"), 0);
  assert.equal(scene.definirIluminacaoFabrica, null);
  assert.equal(scene.iluminacaoFabrica, null);
  assert.equal(textures.size, 0);
  assert.equal(images[0].destroyed, true);
  assert.ok(canvases.slice(1).every(canvas => canvas.width === 0 && canvas.height === 0));
});

test("the real scene generator method persists power and forwards the startup clock to the local lights", async t => {
  const { scene, render, texture } = cenaComMascara(t);
  globalThis.Phaser.Scene = class {};
  const { default: Level1Parte2 } = await import("../scenes/Level1Parte2.js");
  const { FACTORY_GENERATOR_STATE_KEY } = await import("../interactions/FactoryGenerator.js");
  scene.game.registry = new Map();
  let progress = 0;
  Level1Parte2.prototype.acenderLuzFabrica.call(scene, () => progress);
  assert.equal(scene.luzFabricaAcesa, true);
  assert.equal(scene.game.registry.get(FACTORY_GENERATOR_STATE_KEY), true);
  render();
  assertSombraAmbiente(texture.canvas.alphaEm(400, 225));
  progress = 1;
  render();
  assert.ok(texture.canvas.alphaEm(400, 225) > 0.2 && texture.canvas.alphaEm(400, 225) < 0.3);
  assertSombraAmbiente(texture.canvas.alphaEm(10, 10));
  const uploads = texture.refreshes;
  Level1Parte2.prototype.acenderLuzFabrica.call(scene, () => 0);
  render();
  assert.equal(texture.refreshes, uploads, "an already powered generator does not repeat startup");
  const restored = { game: scene.game, profundidadePersonagemParte2: 16.5 };
  Level1Parte2.prototype.init.call(restored, {});
  assert.equal(restored.luzFabricaAcesa, true);
});

test("with a missing lights layer the factory stays at configured darkness even with a player and powered generator", t => {
  const { scene, render, textures, cleanup } = cenaComMascara(t, []);
  cleanup();
  scene.map = { getObjectLayer: () => null };
  const warning = console.warn;
  const messages = [];
  console.warn = message => messages.push(message);
  let remove;
  try { remove = criarIluminacaoTerror(scene); }
  finally { console.warn = warning; }
  try {
    scene.player = { active: true, getCenter: out => out.set(140, 330) };
    scene.definirIluminacaoFabrica(true);
    render();
    assert.equal(scene.iluminacaoFabrica.lampadas.length, 0);
    assert.match(messages[0], /LuzesFabrica.*ausente/);
    const mask = textures.get("level1-parte2-escuridao");
    assert.ok(mask);
    assertSombraAmbiente(mask.canvas.alphaEm(10, 10));
    assertSombraAmbiente(mask.canvas.alphaEm(240, 340));
    assertSombraAmbiente(mask.canvas.alphaEm(140, 330));
  } finally { remove(); }
});

test("validates types, uses defaults, and preserves explicit false and zero", () => {
  const [defaults] = lerLuzesFabrica(mapa(ponto({ Raio: "200", Intensidade: NaN, Ligada: "false", Piscando: 1 })));
  assert.equal(defaults.raio, 170);
  assert.equal(defaults.intensidade, 1);
  assert.equal(defaults.ligada, true);
  assert.equal(defaults.piscando, true);
  assert.equal(defaults.orientacao, "horizontal");
  const [configured] = lerLuzesFabrica(mapa(ponto({
    Raio: 230, Intensidade: 0, Ligada: false, Piscando: true, Cor: "#80FFAA00",
  })));
  assert.equal(configured.raio, 230);
  assert.equal(configured.intensidade, 0);
  assert.equal(configured.ligada, false);
  assert.equal(configured.piscando, true);
  assert.equal(configured.cor.phaser, 0xFFAA00);
  assert.equal(configured.cor.alpha, 128 / 255);
  for (const properties of [{ Raio: -5 }, { Raio: 2.5 }, { Raio: Infinity }, { Intensidade: -1 }]) {
    const [light] = lerLuzesFabrica(mapa(ponto(properties)));
    assert.equal(light.raio, 170);
    assert.equal(light.intensidade, 1);
  }
});

test("Orientacao accepts horizontal or vertical in raw and Phaser properties and defaults safely", () => {
  for (const value of [undefined, null, 1, false, "diagonal", ""]) {
    const [light] = lerLuzesFabrica(mapa(ponto({ Orientacao: value })));
    assert.equal(light.orientacao, "horizontal");
  }
  for (const value of ["horizontal", "vertical", "Horizontal", "Vertical", "VERTICAL", " Horizontal ", " Vertical ", "Vetical", "vetical"]) {
    for (const properties of [{ Orientacao: value }, [{ name: "Orientacao", type: "string", value }]]) {
      const [light] = lerLuzesFabrica(mapa(ponto(properties)));
      const normalized = value.trim().toLowerCase();
      assert.equal(light.orientacao, normalized === "vetical" ? "vertical" : normalized);
    }
  }
});

test("Pulsando reads only booleans from raw Tiled and Phaser properties", () => {
  for (const value of [undefined, null, 0, 1, "true", "false", false, true]) {
    for (const properties of [{ Pulsando: value }, [{ name: "Pulsando", type: "bool", value }]]) {
      const [light] = lerLuzesFabrica(mapa(ponto(properties)));
      assert.equal(light.pulsando, value === true);
    }
  }
});

test("Piscando antigo, ausente ou false não exclui uma lâmpada das falhas globais", () => {
  for (const value of [undefined, null, 0, 1, "true", "false", false, true]) {
    for (const properties of [{ Piscando: value }, [{ name: "Piscando", type: "bool", value }]]) {
      const [light] = lerLuzesFabrica(mapa(ponto(properties)));
      assert.equal(light.piscando, true);
    }
  }
});

test("emergency lamps pulse smoothly together, preserving map settings and generator power", () => {
  const lights = new FactoryLighting(mapa(
    ponto({ Pulsando: true, Cor: "#ffed333b", Orientacao: "Vertical", Intensidade: 0.8 }),
    ponto({ Pulsando: true, Intensidade: 0.8 }),
    ponto({ Pulsando: false }),
    ponto({ Pulsando: true, Ligada: false }),
  ));
  const camera = criarCamera();
  assert.equal(lights.atualizar(0, camera).length, 0);
  lights.definirEnergia(true);
  const values = [];
  for (let now = 0; now <= 3200; now += 20) {
    const [red, other, steady] = lights.atualizar(now, camera);
    assert.equal(lights.fontesVisiveis.length, 3);
    assert.equal(red.intensidade, other.intensidade);
    assert.equal(steady.intensidade, 1);
    assert.equal(red.luz.cor.css, "#FF0000");
    assert.equal(red.luz.orientacao, "vertical");
    values.push(red.intensidade);
  }
  assert.equal(values[0], 0.8);
  assert.ok(Math.min(...values) < 0.09);
  assert.equal(values[0], values[80]);
  assert.equal(values[0], values[160]);
  for (let i = 1; i < values.length; i++) assert.ok(Math.abs(values[i] - values[i - 1]) < 0.04);
  lights.definirEnergia(false);
  assert.equal(lights.atualizar(3400, camera).length, 0);
  lights.definirEnergia(true, () => 0);
  assert.equal(lights.atualizar(3400, camera).length, 0);
});

test("camera culling includes the rounded halo in either focal orientation", () => {
  const camera = criarCamera();
  const horizontal = { x: -110, y: 225, raio: 170, orientacao: "horizontal" };
  const vertical = { ...horizontal, orientacao: "vertical" };
  assert.equal(luzAfetaCamera(horizontal, camera), true);
  assert.equal(luzAfetaCamera(vertical, camera), true);
  horizontal.x = vertical.x = 400;
  horizontal.y = vertical.y = -110;
  assert.equal(luzAfetaCamera(horizontal, camera), true);
  assert.equal(luzAfetaCamera(vertical, camera), true);
  horizontal.y = vertical.y = -256;
  assert.equal(luzAfetaCamera(horizontal, camera), false);
  assert.equal(luzAfetaCamera(vertical, camera), false);
});

test("accepts RGB and Tiled ARGB colors, including transparent black", () => {
  assert.deepEqual(lerCorTiled("#FFD27A"), lerCorTiled("#ffffd27a"));
  assert.deepEqual(lerCorTiled("#abc"), { css: "#AABBCC", phaser: 0xAABBCC, alpha: 1 });
  assert.deepEqual(lerCorTiled("#00000000"), { css: "#000000", phaser: 0, alpha: 0 });
  for (const invalid of [null, true, 123, "#GGGGGG", "#12345"]) {
    assert.deepEqual(lerCorTiled(invalid), lerCorTiled("#FFD27A"));
  }
});

test("reports a missing layer and invalid objects instead of inventing lamp positions", () => {
  const warnings = [];
  assert.deepEqual(lerLuzesFabrica({ getObjectLayer: () => null }, text => warnings.push(text)), []);
  assert.match(warnings[0], /LuzesFabrica.*ausente/);
  assert.deepEqual(lerLuzesFabrica(mapa({ id: 2, x: 0, y: 0 }, ponto({}, NaN)), text => warnings.push(text)), []);
  assert.equal(warnings.length, 3);
});

test("Ligada only permits operation with generator power and persists across a restored visit", () => {
  const lights = new FactoryLighting(mapa(ponto(), ponto({ Ligada: false })));
  const camera = criarCamera();
  assert.equal(lights.atualizar(0, camera).length, 0);
  lights.definirEnergia(true);
  assert.equal(lights.atualizar(0, camera).length, 1);
  assert.equal(lights.fontesVisiveis[0].intensidade, 1);
  lights.definirEnergia(false);
  assert.equal(lights.atualizar(100, camera).length, 0);
  lights.definirEnergia(true);
  assert.equal(lights.atualizar(100, camera)[0].intensidade, 1);
});

test("startup follows audio progress even when paused and falls back to the existing five-second clock", () => {
  const lights = new FactoryLighting(mapa(ponto()));
  const camera = criarCamera();
  let progress = 0;
  lights.definirEnergia(true, () => progress, 100);
  assert.equal(lights.atualizar(10000, camera).length, 0);
  progress = 0.46;
  const starting = lights.atualizar(10000, camera)[0].intensidade;
  assert.ok(starting > 0 && starting < 1);
  assert.equal(lights.atualizar(20000, camera)[0].intensidade, starting);
  progress = 1;
  assert.equal(lights.atualizar(20000, camera)[0].intensidade, 1);
  assert.equal(lights.partida, null);
  lights.definirEnergia(true, () => null, 20000);
  assert.equal(lights.atualizar(20000, camera).length, 0);
  assert.ok(lights.atualizar(22500, camera)[0].intensidade < 1);
  assert.equal(lights.atualizar(25000, camera)[0].intensidade, 1);
  assert.equal(intensidadeLuzPartida(0), 0);
  assert.equal(intensidadeLuzPartida(1), 1);
});

test("todas as lâmpadas falham com ritmos independentes e intervalos irregulares", () => {
  let seed = 12;
  const lights = new FactoryLighting(mapa(ponto({ Piscando: true }), ponto({ Piscando: false }), ponto()), {
    aleatorio: () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646,
  });
  lights.definirEnergia(true);
  const camera = criarCamera();
  const starts = lights.estados.map(() => []);
  const ends = lights.estados.map(() => []);
  const values = lights.estados.map(() => []);
  const previous = lights.estados.map(() => false);
  let simultaneous = false;
  for (let now = 0; now < 160000; now += 20) {
    lights.atualizar(now, camera);
    simultaneous ||= lights.estados.filter(state => state.falha).length > 1;
    for (const [index, state] of lights.estados.entries()) {
      values[index].push(state.intensidade);
      const failing = !!state.falha;
      if (failing && !previous[index]) starts[index].push(now);
      if (!failing && previous[index]) ends[index].push(now);
      previous[index] = failing;
    }
  }
  assert.ok(simultaneous, "permite mais de uma luminária falhando ao mesmo tempo");
  assert.notDeepEqual(starts[0], starts[1], "as luminárias não ficam sincronizadas");
  for (const [index, times] of starts.entries()) {
    assert.ok(Math.min(...values[index]) < 0.3);
    assert.ok(values[index].every(value => value >= 0 && value <= 1));
    assert.ok(times.length >= 3, "também falha com Piscando=false ou sem a propriedade");
    assert.ok(times[0] >= 4000 && times[0] <= 16020);
    assert.ok(new Set(times.slice(1).map((time, i) => time - times[i])).size > 1);
    for (let i = 0; i < ends[index].length; i++) {
      const duration = ends[index][i] - times[i];
      assert.ok(duration >= 1200 && duration <= 3420);
      if (times[i + 1] !== undefined) {
        const rest = times[i + 1] - ends[index][i];
        assert.ok(rest >= 8000 && rest <= 24020, "pausas estáveis entre sequências");
      }
    }
  }
});

test("culling uses the configured world radius and current camera matrix at negative scroll and zoom", () => {
  const camera = criarCamera();
  camera.setViewport(50, 30, 800, 450);
  camera.setScroll(-1400, -3000);
  camera.setZoom(2);
  camera.preRender();
  const center = camera.getWorldPoint(camera.x + camera.width / 2, camera.y + camera.height / 2);
  assert.ok(luzAfetaCamera({ ...center, raio: 170 }, camera));
  const edge = camera.getWorldPoint(camera.x - 120, camera.y + camera.height / 2);
  assert.ok(luzAfetaCamera({ ...edge, raio: 170 }, camera), "60 world pixels beyond the left edge is inside the compact halo");
  assert.equal(luzAfetaCamera({ x: -10000, y: -10000, raio: 170 }, camera), false);
  const lights = new FactoryLighting(mapa(ponto({}, center.x, center.y), ponto({}, -10000, -10000)));
  lights.definirEnergia(true);
  assert.equal(lights.atualizar(0, camera).length, 1);
  lights.destroy();
  assert.equal(lights.partida, null);
  assert.equal(lights.fontesVisiveis.length, 0);
  assert.equal(lights.lampadas.length, 0);
});


test("som da partida mantém os três estalos e não se repete na revisita", t => {
  const reproducoes = [];
  const som = {
    totalDuration: 0.78, isPlaying: false, destruido: false,
    addMarker() {}, setVolume() {},
    play(nome, config) { reproducoes.push({ nome, config }); this.isPlaying = true; return true; },
    stop() { this.isPlaying = false; },
    destroy() { this.destruido = true; },
  };
  const { scene, render } = cenaComMascara(t, [ponto({ Piscando: true })], false, {
    cache: { audio: { exists: () => true } },
    sound: { add: () => som },
  });
  scene.iluminacaoFabrica.aleatorio = () => 0;
  render();
  assert.equal(reproducoes.length, 0, "antes de ligar não há estalos");
  let progresso = 0;
  let leituras = 0;
  scene.definirIluminacaoFabrica(true, () => { leituras++; return progresso; });
  for (const p of [0, 0.164, 0.17, 0.3, 0.49, 0.6, 0.82, 1]) {
    progresso = p;
    scene.time.now = p * 5000;
    const antes = leituras;
    render();
    assert.equal(leituras, antes + 1, "luz e áudio compartilham uma única leitura do progresso");
  }
  assert.equal(reproducoes.length, 3);
  assert.equal(som.isPlaying, false, "o último quadro da partida encerra o som");
  scene.time.now = 9000;
  render();
  scene.time.now = 9450;
  render();
  assert.ok(scene.iluminacaoFabrica.estados[0].falha, "uma luz está piscando durante o jogo");
  assert.equal(reproducoes.length, 3, "essa piscada não produz som");
  scene.definirIluminacaoFabrica(true);
  scene.time.now = 9000;
  render();
  assert.equal(reproducoes.length, 3, "restaurar energia já ligada não repete os estalos");

  scene.definirIluminacaoFabrica(true, () => 0.164);
  render();
  assert.equal(som.isPlaying, true);
  scene.definirIluminacaoFabrica(false);
  assert.equal(som.isPlaying, false, "interromper a partida silencia o som");
  scene.events.emit("shutdown");
  assert.equal(som.destruido, true);
});


test("uma falha faz várias quedas e recuperações parciais antes de estabilizar", () => {
  const lights = new FactoryLighting(mapa(
    ponto({ Piscando: false }),
  ), { aleatorio: () => 0 });
  lights.definirEnergia(true);
  const camera = criarCamera();
  const valores = [];
  let eventos = 0;
  for (let agora = 0; agora <= 6000; agora += 10) {
    lights.atualizar(agora, camera);
    eventos += lights.falhasIniciadas.length;
    if (agora >= 4000) valores.push(lights.fontesVisiveis[0].intensidade);
  }
  let quedas = 0;
  let recuperacoes = 0;
  for (let i = 1; i < valores.length; i++) {
    if (valores[i] < 0.15 && valores[i - 1] >= 0.15) quedas++;
    if (valores[i] > 0.5 && valores[i - 1] <= 0.5) recuperacoes++;
  }
  assert.equal(eventos, 1, "uma sequência dispara só um evento de áudio");
  assert.ok(quedas >= 3 && recuperacoes >= 3, "mau contato em vez de uma única piscada");
  assert.equal(valores.at(-1), 1);
  assert.equal(lights.estados[0].falha, null);
});

test("a máscara acompanha as falhas e volta a reutilizar a textura quando estabiliza", t => {
  const { scene, render, texture } = cenaComMascara(t, [ponto({ Piscando: false })], true);
  scene.iluminacaoFabrica.aleatorio = () => 0;
  render();
  const acesa = texture.canvas.alphaEm(400, 225);
  scene.time.now = 4000;
  render();
  const uploads = texture.refreshes;
  scene.time.now = 4100;
  render();
  assert.ok(texture.canvas.alphaEm(400, 225) > acesa + 0.1, "o cenário escurece na queda");
  assert.ok(texture.refreshes > uploads);
  scene.time.now = 5200;
  render();
  assert.equal(texture.canvas.alphaEm(400, 225), acesa);
  const stable = texture.refreshes;
  scene.time.now = 5300;
  render();
  assert.equal(texture.refreshes, stable, "nenhum upload extra durante a pausa estável");
});

test("a partida do gerador termina antes de agendar as falhas independentes", () => {
  let progress = 0.5;
  const lights = new FactoryLighting(mapa(ponto()), { aleatorio: () => 0 });
  const camera = criarCamera();
  lights.definirEnergia(true, () => progress);
  lights.atualizar(30000, camera);
  assert.equal(lights.estados[0].proximaFalha, null);
  assert.equal(lights.estados[0].falha, null);
  progress = 1;
  lights.atualizar(30000, camera);
  lights.atualizar(33999, camera);
  assert.equal(lights.estados[0].falha, null);
  lights.atualizar(34000, camera);
  assert.ok(lights.estados[0].falha);
});


test("falhas simultâneas respeitam os limites de duração e desligar cancela todos os relógios", () => {
  for (const sorteio of [0, 0.5, 1]) {
    const lights = new FactoryLighting(mapa(
      ponto({ Piscando: true }, 100, 200),
      ponto({ Piscando: true }, 200, 200),
      ponto({ Piscando: true }, 300, 200),
    ), { aleatorio: () => sorteio });
    lights.definirEnergia(true);
    const camera = criarCamera();
    const intervalo = 4000 + sorteio * 12000;
    lights.atualizar(0, camera);
    lights.atualizar(intervalo - 1, camera);
    assert.equal(lights.falhasIniciadas.length, 0);
    lights.atualizar(intervalo, camera);
    assert.equal(lights.falhasIniciadas.length, 3);
    const duracao = 1200 + sorteio * 2200;
    lights.atualizar(intervalo + duracao / 2, camera);
    assert.ok(lights.estados.every(state => state.intensidade < 1));
    lights.atualizar(intervalo + duracao, camera);
    assert.ok(lights.estados.every(state => state.intensidade === 1 && !state.falha));
    lights.definirEnergia(false);
    assert.ok(lights.estados.every(state => !state.falha && state.proximaFalha === null));
    assert.equal(lights.atualizar(100000, camera).length, 0);
    assert.equal(lights.falhasIniciadas.length, 0);
    lights.definirEnergia(true);
    lights.atualizar(100000, camera);
    assert.ok(lights.estados.every(state => state.intensidade === 1 && !state.falha));
  }
});

test("falhas seguem fora da tela sem áudio e não acumulam ao suspender o jogo", () => {
  const lights = new FactoryLighting(mapa(
    ponto({ Piscando: true }, -50, 200),
    ponto({ Piscando: true }, 900, 200),
  ), { aleatorio: () => 0 });
  lights.definirEnergia(true);
  const camera = criarCamera();
  for (const tempo of [0, 4000]) {
    lights.atualizar(tempo, camera);
    assert.equal(lights.falhasIniciadas.length, 0, "o halo visível não basta");
  }
  assert.ok(lights.estados.every(state => state.falha), "lâmpadas fora da tela também participam");
  camera.setScroll(500, 0);
  camera.preRender();
  lights.atualizar(4100, camera);
  assert.ok(lights.fontesVisiveis.find(state => state.luz.x === 900).intensidade < 1);
  assert.equal(lights.falhasIniciadas.length, 0);
  lights.atualizar(5200, camera);
  lights.atualizar(60000, camera);
  assert.ok(lights.estados.every(state => !state.falha));
  assert.equal(lights.falhasIniciadas.length, 0, "não dispara uma fila de falhas vencidas");
  lights.atualizar(68000, camera);
  assert.deepEqual(lights.falhasIniciadas.map(luz => luz.x), [900]);
});
