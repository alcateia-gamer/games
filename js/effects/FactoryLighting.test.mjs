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

test("mapa real preserva Piscando e todas as lâmpadas ligadas participam das falhas", () => {
  const raw = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const layer = raw.layers.find(layer => layer.name === "LuzesFabrica");
  const before = JSON.stringify(layer);
  let seed = 321;
  const lights = new FactoryLighting(mapa(...layer.objects.map(object => parseObject(object))), {
    aleatorio: () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646,
  });
  const marcadas = layer.objects.filter(object => object.properties.some(property =>
    property.name === "Piscando" && property.value === true)).map(object => object.id);
  assert.ok(marcadas.length > 0 && marcadas.length < lights.lampadas.length);
  assert.deepEqual(lights.lampadas.filter(light => light.piscando).map(light => light.id), marcadas);
  lights.definirEnergia(true);
  const camera = criarCamera();
  const failing = new Set();
  for (let now = 0; now <= 65000; now += 25) {
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
function dentroRecortes(op, x, y) {
  return (op.recortes ?? []).every(pontos => {
    let dentro = false;
    for (let i = 0, j = pontos.length - 1; i < pontos.length; j = i++) {
      const a = pontos[i], b = pontos[j];
      if ((a.y > y) !== (b.y > y) && x < (b.x-a.x) * (y-a.y) / (b.y-a.y) + a.x) dentro = !dentro;
    }
    return dentro;
  });
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
    // Canvas copia os pixels no momento do desenho, inclusive ao reutilizar um carimbo.
    if (image instanceof CanvasAmostrado) {
      const copia = new CanvasAmostrado();
      copia.width = image.width; copia.height = image.height;
      copia.context.bitmap = image.context.bitmap;
      copia.context.operacoes = image.context.operacoes.slice();
      image = copia;
    }
    if (args.length === 8) {
      const [sx, sy, sw, sh, x, y, width, height] = args;
      this.registrar("image", [x, y, width, height, image, sx, sy, sw, sh]);
    } else {
      const [x, y, width = image.width, height = image.height] = args;
      this.registrar("image", [x, y, width, height, image]);
    }
  }
  beginPath() { this.caminho = []; }
  moveTo(x, y) {
    const m = this.estado.matriz;
    this.caminho.push({ x: m[0]*x + m[2]*y + m[4], y: m[1]*x + m[3]*y + m[5] });
  }
  lineTo(x, y) { this.moveTo(x, y); }
  rect(x, y, width, height) {
    this.moveTo(x, y); this.lineTo(x + width, y);
    this.lineTo(x + width, y + height); this.lineTo(x, y + height);
  }
  closePath() {}
  clip() { this.estado.recortes = [...(this.estado.recortes ?? []), this.caminho]; }
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
      if (!dentroRecortes(op, screenX, screenY)) continue;
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
      else if (op.globalCompositeOperation === "source-in" || op.globalCompositeOperation === "destination-in") destination *= source;
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
      if (!dentroRecortes(op, screenX, screenY)) continue;
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
      else if (op.globalCompositeOperation === "destination-in") { fs = 0; fd = sa; }
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
    map: audio.map ?? mapa(...objects), time: { now: 0 }, direcaoAtual: "right", luzFabricaAcesa: powered,
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

test("ParedeAcimaPerso aparece sobre a lanterna pelo alpha dos tiles sem alterar a ordem do mapa", t => {
  const { scene, render, texture, canvases } = cenaComMascara(t, [ponto({}, 460, 235)]);
  const sheet = document.createElement("canvas");
  sheet.width = 96;
  sheet.height = 48;
  const context = sheet.getContext("2d");
  context.fillRect(48, 0, 48, 48);
  context.clearRect(48 + 8, 20, 8, 8);
  const tile = { index: 7, pixelX: 440, pixelY: 211, alpha: 1 };
  const layer = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1, visible: true,
    depth: 26, gidMap: { 7: {
      tileWidth: 48, tileHeight: 48, tileOffset: { x: 0, y: 0 },
      getAnimatedTileId: index => index,
      getTileTextureCoordinates: () => ({ x: 48, y: 0 }),
      image: { getSourceImage: () => sheet },
    } }, cull: () => [tile] };
  scene.camadaParedeAcimaPerso = layer;
  scene.player = { active: true, x: 400, y: 225 };
  const camera = scene.cameras.main;
  const alpha = (x, y) => {
    const m = camera.matrix;
    return texture.canvas.alphaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
  };
  for (const [zoom, rotacao] of [[1, 0], [1.7, 0.2]]) {
    camera.setZoom(zoom).setRotation(rotacao);
    render();
    assertSombraAmbiente(alpha(466, 235), "o pixel opaco da parede fica acima da lanterna");
    assert.ok(alpha(452, 235) < 0.5, "a transparência do tile deixa ver o cenário iluminado");
    assert.ok(alpha(430, 235) < 0.5, "o cenário antes da parede continua iluminado");
    assert.equal(layer.depth, 26, "a camada conserva sua ordem em relação ao mapa e ao jogador");
  }
  tile.flipX = true;
  camera.setZoom(1).setRotation(0);
  render();
  assertSombraAmbiente(alpha(452, 235), "o pixel opaco acompanha o espelhamento do tile");
  assert.ok(alpha(476, 235) < 0.5, "o buraco transparente acompanha o espelhamento do tile");
  const quantidade = canvases.length;
  const uploads = texture.refreshes;
  render();
  assert.equal(texture.refreshes, uploads, "a sobreposição parada reutiliza a máscara");
  layer.visible = false;
  render();
  const semParede = alpha(466, 235);
  assert.ok(semParede < 0.5, "ocultar a camada libera o feixe com o jogador parado");
  layer.visible = true;
  layer.alpha = 0.5;
  render();
  assert.ok(alpha(466, 235) > semParede && alpha(466, 235) < ESCURIDAO_AMBIENTE_FABRICA,
    "a sobreposição respeita a transparência da camada");
  layer.alpha = 1;
  scene.definirIluminacaoFabrica(true);
  render();
  assert.ok(alpha(466, 235) < 0.5, "as lâmpadas da fábrica continuam iluminando normalmente");
  assert.equal(canvases.length, quantidade, "a camada não cria novas máscaras a cada quadro");
});

test("a lanterna fica atrás da fachada da sala dentro ou acima do gatilho sem apagar o piso", t => {
  const { scene, render, texture, canvases } = cenaComMascara(t, [ponto({}, 426, 235)]);
  const sheet = document.createElement("canvas");
  sheet.width = sheet.height = 48;
  sheet.getContext("2d").fillRect(0, 0, 48, 48);
  sheet.getContext("2d").clearRect(8, 20, 8, 8);
  const tileset = { tileWidth: 48, tileHeight: 48, tileOffset: { x: 0, y: 0 },
    getAnimatedTileId: index => index, getTileTextureCoordinates: () => ({ x: 0, y: 0 }),
    image: { getSourceImage: () => sheet } };
  const layer = (name, depth, positions) => ({ layer: { name }, depth, visible: true, alpha: 1,
    gidMap: { 7: tileset },
    cull: () => positions.map(pixelX => ({ index: 7, pixelX, pixelY: 211, alpha: 1 })),
    setDepth() { assert.fail("a lanterna não deve reordenar nenhuma camada do mapa"); } });
  scene.camadasMapaParte2 = [
    ...["chão", "detalhes do chão", "ListrasChão", "Sujeira", "ChãoProdução"]
      .map(name => layer(name, 1, [368])),
    layer("ParedeAbaixoPerso", 8, [400]), layer("Portas", 13, [448]),
    layer("Objetos1", 16, [496, 560]),
  ];
  scene.regiaoTrocaCamada = { left: 360, top: 200, right: 500, bottom: 300 };
  scene.player = { active: true, x: 380, y: 225,
    body: { x: 380, y: 225, width: 20, height: 10 } };
  const camera = scene.cameras.main;
  const alpha = (x, y) => {
    const m = camera.matrix;
    return texture.canvas.alphaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
  };
  for (const [zoom, rotacao] of [[1, 0], [1.4, -0.1]]) {
    camera.setZoom(zoom).setRotation(rotacao);
    render();
    for (const x of [426, 474, 522]) assertSombraAmbiente(alpha(x, 235),
      "paredes, portas e detalhes da fachada aparecem diante da lanterna");
    assert.ok(alpha(388, 235) < 0.5, "todas as camadas de piso continuam iluminadas");
    assert.ok(alpha(412, 235) < 0.5, "pixels transparentes da fachada revelam o interior");
    assert.ok(alpha(586, 235) < ESCURIDAO_AMBIENTE_FABRICA - 0.05,
      "tiles fora do retângulo na mesma camada conservam sua iluminação");
  }
  const uploads = texture.refreshes, quantidade = canvases.length;
  render();
  assert.equal(texture.refreshes, uploads, "a sala parada reutiliza a máscara");
  scene.player.body.x = 340;
  render();
  assert.ok(alpha(426, 235) < 0.5, "sair pela lateral restaura o feixe mesmo sem mover a origem visual");
  scene.player.body.x = 341;
  render();
  assertSombraAmbiente(alpha(426, 235), "entrar parcialmente recoloca a fachada na frente");
  delete scene.player.body;
  Object.assign(scene.player, { x: 426, y: 150 });
  scene.direcaoAtual = "down";
  render();
  assertSombraAmbiente(alpha(426, 235), "acima do retângulo a luz também fica atrás da parede");
  scene.player.y = 320;
  scene.direcaoAtual = "up";
  render();
  assert.ok(alpha(426, 235) < 0.5, "abaixo do gatilho a lanterna volta à composição normal");
  scene.player.y = 150;
  scene.direcaoAtual = "down";
  scene.definirIluminacaoFabrica(true);
  render();
  assert.ok(alpha(426, 235) < 0.5, "a sobreposição não interfere nas lâmpadas do gerador");
  assert.equal(canvases.length, quantidade, "o movimento usa o mesmo carimbo de oclusão");
});

test("olhar para cima de dentro da fachada ilumina o interior sem mostrar a luz sobre seus tiles", t => {
  let sheet;
  const tile = { index: 7, x: 0, y: 0, pixelX: 400, pixelY: 211, width: 48, height: 48, alpha: 1 };
  const layer = { layer: { name: "ParedeAbaixoPerso" }, visible: true, alpha: 1, depth: 8,
    forEachTile(callback) { callback(tile); },
    tileToWorldXY: () => ({ x: tile.pixelX, y: tile.pixelY }), cull: () => [tile],
    gidMap: { 7: { tileWidth: 48, tileHeight: 48, tileOffset: { x: 0, y: 0 },
      getAnimatedTileId: index => index, getTileTextureCoordinates: () => ({ x: 0, y: 0 }),
      image: { getSourceImage: () => sheet } } } };
  const regiao = { left: 360, top: 200, right: 500, bottom: 300 };
  const map = { layers: [{ name: layer.layer.name, tilemapLayer: layer }],
    getObjectLayer: name => name === "collision"
      ? { objects: [{ x: 400, y: 110, width: 48, height: 6 }] } : { objects: [] } };
  const { scene, render, texture } = cenaComMascara(t, [], false,
    { map, regiaoTrocaCamada: regiao, camadasMapaParte2: [layer] });
  sheet = document.createElement("canvas");
  sheet.width = sheet.height = 48;
  sheet.getContext("2d").fillRect(0, 0, 48, 48);
  scene.player = { active: true, x: 426, y: 225,
    body: { x: 416, y: 225, width: 20, height: 10 } };
  scene.direcaoAtual = "up";
  const camera = scene.cameras.main;
  const alpha = (x, y) => {
    const m = camera.matrix;
    return texture.canvas.alphaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
  };
  for (const [zoom, rotacao] of [[1, 0], [1.7, 0.15]]) {
    camera.setZoom(zoom).setRotation(rotacao);
    render();
    assertSombraAmbiente(alpha(426, 235), "os pixels da fachada ocultam a lanterna na origem");
    assert.ok(alpha(426, 185) < 0.5, "o feixe continua iluminando acima da fachada");
    assert.ok(alpha(426, 125) < ESCURIDAO_AMBIENTE_FABRICA - 0.1, "a luz alcança o interior adiante");
    assertSombraAmbiente(alpha(426, 95), "a colisão física adiante continua bloqueando o feixe");
  }
  scene.player.body.x = 340;
  render();
  assertSombraAmbiente(alpha(426, 185), "fora do gatilho os tiles voltam a bloquear a propagação");
  scene.player.body.x = 416;
  render();
  assert.ok(alpha(426, 185) < 0.5, "reentrar atualiza o recorte mesmo com a origem visual parada");
});

test("o giroflex vermelho gira com a câmera parada, funciona sem gerador e acompanha zoom e rotação", t => {
  const point = { id: 1, point: true, x: 400, y: 225, properties: { Lateral: true, Cima: true } };
  const map = { getObjectLayer: name => ({ objects: name === "Luzedeemergencia" ? [point] : [] }) };
  const { scene, render, texture, canvases, cleanup } = cenaComMascara(t, [], false, { map });
  scene.player = { active: true, x: 100, y: 330 };
  const camera = scene.cameras.main;
  const rgba = (x, y) => {
    const m = camera.matrix;
    return texture.canvas.rgbaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
  };
  const alpha = (x, y) => rgba(x, y)[3];
  for (const [zoom, rotacao] of [[1, 0], [1.4, 0.15]]) {
    camera.setZoom(zoom).setRotation(rotacao);
    scene.time.now = 0;
    render();
    assert.ok(alpha(490, 225) < alpha(400, 315) - 0.08, "o feixe começa na horizontal");
    assert.ok(alpha(200, 340) < 0.6, "a lanterna continua acesa junto do giroflex");
    const red = rgba(490, 225);
    assert.ok(red[0] > red[1] + 0.1 && red[0] > red[2] + 0.1, "o feixe tinge o cenário de vermelho");
    const uploads = texture.refreshes;
    scene.time.now = 500;
    render();
    assert.equal(texture.refreshes, uploads + 1, "o giro atualiza a luz sem mover jogador ou câmera");
    assert.ok(alpha(400, 315) < alpha(490, 225) - 0.08, "um quarto de volta leva o feixe à vertical");
  }
  const uploads = texture.refreshes, quantidade = canvases.length;
  render();
  assert.equal(texture.refreshes, uploads, "o mesmo instante reutiliza a composição");
  scene.definirIluminacaoFabrica(true);
  render();
  assert.ok(rgba(400, 225)[0] > 0.2, "ligar o gerador conserva a iluminação de emergência");
  scene.time.now = 750;
  render();
  assert.ok(scene.iluminacaoEmergencia.fontesVisiveis[0].angulo > Math.PI / 2);
  assert.equal(canvases.length, quantidade, "a rotação usa as mesmas texturas");
  cleanup();
  assert.equal(scene.iluminacaoEmergencia, null);
  assert.ok(canvases.slice(1).every(canvas => canvas.width === 0 && canvas.height === 0));
});

test("no celular o giroflex compartilha máscara e cor em 256px sem atrasar câmera ou portas", t => {
  const body = { x: 460, y: 100, width: 6, height: 250, enable: false };
  const map = { getObjectLayer: name => ({ objects: name === "Luzedeemergencia"
    ? [ponto({}, 400, 225)] : [] }) };
  const { scene, render, texture, canvases } = cenaComMascara(t, [], true, {
    map, sys: { game: { device: { input: { touch: true } } } },
    portasFabrica: [{ colisao: { body } }],
  });
  render();
  const locais = canvases.slice(-2), quantidade = canvases.length;
  assert.ok(locais.every(canvas => canvas.width === 256 && canvas.height === 256));
  const uploads = texture.refreshes;
  for (let quadro = 1; quadro <= 60; quadro++) {
    scene.time.now = quadro * 1000 / 60;
    render();
  }
  const atualizacoes = texture.refreshes - uploads;
  assert.ok(atualizacoes >= 25 && atualizacoes <= 30, `uploads do giro em 1s: ${atualizacoes}`);
  assert.equal(canvases.length, quantidade, "o giro reutiliza os mesmos carimbos");
  const desenhos = () => locais.reduce((soma, canvas) => soma + canvas.context.operacoes.length, 0);
  const antes = desenhos();
  scene.cameras.main.setScroll(10, 0);
  render();
  assert.equal(desenhos(), antes, "mover a câmera apenas reposiciona os carimbos");
  assert.ok(texture.refreshes > uploads + atualizacoes, "a câmera atualiza a composição imediatamente");
  scene.cameras.main.setScroll(0, 0);
  scene.time.now = 2000;
  render();
  assert.ok(texture.canvas.rgbaEm(490, 225)[0] > 0.1);
  body.enable = true;
  scene.time.now = 2001;
  render();
  assertSombraAmbiente(texture.canvas.alphaEm(490, 225), "a porta invalida o cache dentro do intervalo do giro");
  assert.equal(texture.canvas.rgbaEm(490, 225)[0], 0);
  scene.cameras.main.setScroll(5000, 0);
  render();
  assert.ok(locais.every(canvas => canvas.width === 0 && canvas.height === 0), "libera o cache fora da tela");
  t.diagnostic(`uploads do giroflex em 60 quadros: ${atualizacoes}; carimbos locais: 2 × 256 × 256`);
});

test("no celular a máscara usa um quarto dos pixels e mantém luz, câmera, zoom e resize alinhados", t => {
  const { scene, render, texture, images } = cenaComMascara(t, [ponto()], true, {
    sys: { game: { device: { os: { desktop: false }, input: { touch: true } } } },
  });
  const camera = scene.cameras.main;
  const alpha = (x, y) => {
    const m = camera.matrix;
    return texture.canvas.alphaEm((m.a*x + m.c*y + m.e) * texture.canvas.width / camera.width,
      (m.b*x + m.d*y + m.f) * texture.canvas.height / camera.height);
  };
  render();
  assert.deepEqual([texture.canvas.width, texture.canvas.height], [400, 225]);
  assert.equal(images[0].scaleX, 2);
  assert.equal(images[0].scaleY, 2);
  assert.ok(alpha(400, 225) < 0.3, "a fonte continua no centro esperado");
  assertSombraAmbiente(alpha(10, 10));
  const uploads = texture.refreshes;
  render();
  assert.equal(texture.refreshes, uploads, "a redução de pixels conserva a invalidação por estado");
  camera.setZoom(1.3).setRotation(0.1).setScroll(-20, 10);
  render();
  assert.ok(alpha(400, 225) < 0.3, "zoom e rotação usam a mesma transformação nas coordenadas reduzidas");
  camera.setViewport(0, 0, 801, 451);
  render();
  assert.deepEqual([texture.canvas.width, texture.canvas.height], [401, 226]);
  assert.ok(alpha(400, 225) < 0.3, "dimensões ímpares não deslocam a máscara após resize");
});

test("giroflex lateral varre acima e abaixo sem projetar luz ou halo para fora da sala", async t => {
  for (const lado of ["Esquerda", "Direita"]) {
    await t.test(lado, t => {
      const sentido = lado === "Esquerda" ? 1 : -1;
      const body = { x: lado === "Esquerda" ? 460 : 334, y: 100, width: 6, height: 250, enable: false };
      const map = { getObjectLayer: name => ({ objects: name === "Luzedeemergencia"
        ? [ponto({ Lateral: true, [lado]: true }, 400, 225)] : [] }) };
      const { scene, render, texture, canvases, cleanup } = cenaComMascara(t, [], false,
        { map, portasFabrica: [{ colisao: { body } }] });
      const camera = scene.cameras.main;
      const rgba = (x, y) => {
        const m = camera.matrix;
        return texture.canvas.rgbaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
      };
      render(); // Os carimbos locais são alocados apenas quando a fonte aparece.
      const quantidade = canvases.length;
      for (const [zoom, rotacao] of [[1, 0], [1.4, 0.15]]) {
        camera.setZoom(zoom).setRotation(rotacao);
        scene.time.now = 0;
        render();
        assert.ok(rgba(400 + sentido * 90, 225)[0] > 0.1, "o facho aponta para o interior");
        assertSombraAmbiente(rgba(400 - sentido * 90, 225)[3], "o exterior continua escuro");
        assert.equal(rgba(400 - sentido * 90, 225)[0], 0, "nenhum vermelho sai pelo lado errado");
        scene.time.now = 500;
        render();
        const cima = rgba(400 + sentido * 8, 145)[0], baixo = rgba(400 + sentido * 8, 305)[0];
        assert.ok(cima > baixo + 0.08, "um quarto do ciclo aponta para cima");
        scene.time.now = 1500;
        render();
        assert.ok(rgba(400 + sentido * 8, 305)[0] > rgba(400 + sentido * 8, 145)[0] + 0.08,
          "três quartos do ciclo apontam para baixo");
        for (const y of [145, 225, 305]) assert.equal(rgba(400 - sentido * 8, y)[0], 0);
      }
      const uploads = texture.refreshes;
      render();
      assert.equal(texture.refreshes, uploads);
      scene.time.now = 0;
      body.enable = true;
      render();
      assert.ok(rgba(400 + sentido * 40, 225)[0] > 0.1, "ilumina antes da porta fechada");
      assertSombraAmbiente(rgba(400 + sentido * 90, 225)[3], "a porta também recorta o giro lateral");
      assert.equal(rgba(400 + sentido * 90, 225)[0], 0);
      body.enable = false;
      render();
      assert.ok(rgba(400 + sentido * 90, 225)[0] > 0.1);
      assert.equal(canvases.length, quantidade, "os perfis laterais são reutilizados");
      cleanup();
      assert.ok(canvases.slice(1).every(canvas => canvas.width === 0 && canvas.height === 0));
    });
  }
});

test("colisões recortam o feixe e a cor vermelha do giroflex, respeitando Luzatravessa", async t => {
  for (const atravessa of [false, true]) {
    await t.test(`Luzatravessa=${atravessa}`, t => {
      const source = { id: 1, point: true, x: 400, y: 225 };
      const map = { getObjectLayer: name => ({ objects: name === "Luzedeemergencia" ? [source]
        : name === "collision" ? [
          { x: 390, y: 215, width: 20, height: 20 },
          { x: 460, y: 100, width: 6, height: 250,
            properties: [{ name: "Luzatravessa", type: "bool", value: atravessa }] },
        ] : [] }) };
      const { scene, render, texture } = cenaComMascara(t, [], false, { map });
      const camera = scene.cameras.main;
      const rgba = (x, y) => {
        const m = camera.matrix;
        return texture.canvas.rgbaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
      };
      for (const [zoom, rotacao] of [[1, 0], [1.5, 0.15]]) {
        camera.setZoom(zoom).setRotation(rotacao);
        scene.time.now = 0;
        render();
        assert.ok(rgba(440, 225)[0] > 0.1, "o giroflex na parede ilumina antes do obstáculo");
        if (atravessa) assert.ok(rgba(490, 225)[0] > 0.1, "a exceção do Tiled deixa passar luz vermelha");
        else {
          assertSombraAmbiente(rgba(490, 225)[3], "não há claridade atrás da colisão");
          assert.equal(rgba(490, 225)[0], 0, "a cor vermelha também fica bloqueada");
        }
        scene.time.now = 500;
        render();
        assert.ok(rgba(400, 145)[0] > 0.1, "o feixe continua girando nas direções livres");
        if (!atravessa) assert.equal(rgba(490, 225)[0], 0, "o halo vermelho não vaza ao girar");
      }
    });
  }
});

test("portas bloqueiam o giroflex mesmo com gerador ligado e a lanterna apagada", t => {
  const map = { getObjectLayer: name => ({ objects: name === "Luzedeemergencia"
    ? [{ id: 1, point: true, x: 400, y: 225 }] : [] }) };
  const body = { x: 460, y: 100, width: 6, height: 250, enable: true };
  const { scene, render, texture } = cenaComMascara(t, [], true,
    { map, portasFabrica: [{ colisao: { body } }] });
  render();
  assertSombraAmbiente(texture.canvas.alphaEm(490, 225));
  body.enable = false;
  render();
  assert.ok(texture.canvas.rgbaEm(490, 225)[0] > 0.1, "abrir a porta ilumina sem avançar o relógio");
  body.enable = true;
  render();
  assertSombraAmbiente(texture.canvas.alphaEm(490, 225), "fechar bloqueia luz e cor novamente");
});

test("giroflex com Raio grande não é cortado pelo alcance da lanterna e respeita colisões distantes", t => {
  const map = { getObjectLayer: name => ({ objects: name === "Luzedeemergencia"
    ? [{ id: 1, point: true, x: 200, y: 225, properties: { Raio: 400 } }]
    : name === "collision" ? [{ x: 600, y: 0, width: 6, height: 450 }] : [] }) };
  const { render, texture } = cenaComMascara(t, [], false, { map });
  render();
  assert.ok(texture.canvas.rgbaEm(590, 225)[0] > 0.05, "a luz alcança além de 360 pixels");
  assertSombraAmbiente(texture.canvas.alphaEm(650, 225), "a colisão distante bloqueia a claridade");
  assert.equal(texture.canvas.rgbaEm(650, 225)[0], 0, "a colisão distante também bloqueia o vermelho");
});

test("giroflex passa atrás das estátuas pelo alpha do sprite sem apagar o cenário ou outras luzes", t => {
  const estatua = { active: true, visible: true, alpha: 1, x: 462, y: 249, depth: 15,
    scaleX: 1, scaleY: 1, displayOriginX: 24, displayOriginY: 48,
    getData: name => name === "objectLayerName" ? "EstátuaRobos" : undefined,
    setDepth() { assert.fail("a sobreposição da luz não deve reordenar as estátuas"); } };
  const outro = { ...estatua, x: 532,
    getData: name => name === "objectLayerName" ? "Objetos1" : undefined };
  const map = { getObjectLayer: name => ({ objects: name === "Luzedeemergencia"
    ? [{ id: 1, point: true, x: 400, y: 225 }]
    : name === "LuzesFabrica" ? [ponto({}, 470, 225)] : [] }) };
  const { scene, render, texture, canvases, cleanup } = cenaComMascara(t, [], false,
    { map, objetosMapaParte2: [estatua, outro] });
  const sheet = document.createElement("canvas");
  sheet.width = 96;
  sheet.height = 48;
  sheet.getContext("2d").fillRect(48, 0, 48, 48);
  sheet.getContext("2d").clearRect(48 + 8, 20, 8, 8);
  estatua.frame = outro.frame = { source: { image: sheet }, cutX: 48, cutY: 0,
    cutWidth: 48, cutHeight: 48, realWidth: 48, realHeight: 48 };
  const camera = scene.cameras.main;
  const rgba = (x, y) => {
    const m = camera.matrix;
    return texture.canvas.rgbaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
  };
  for (const [zoom, rotacao] of [[1, 0], [1.4, 0.15]]) {
    camera.setZoom(zoom).setRotation(rotacao);
    render();
    assertSombraAmbiente(rgba(470, 225)[3], "o corpo opaco oculta a claridade do giroflex");
    assert.equal(rgba(470, 225)[0], 0, "o brilho vermelho também passa atrás da estátua");
    assert.ok(rgba(450, 225)[0] > 0.1, "a transparência do sprite deixa a luz passar");
    assert.ok(rgba(430, 225)[0] > 0.1 && rgba(540, 225)[0] > 0.05,
      "o cenário ao redor e os objetos de outras camadas continuam iluminados");
    assert.equal(estatua.depth, 15);
  }
  const count = canvases.length, uploads = texture.refreshes;
  render();
  assert.equal(texture.refreshes, uploads, "a estátua parada reutiliza a composição");
  estatua.flipX = true;
  render();
  assert.ok(rgba(474, 225)[0] > 0.1, "o recorte acompanha os sprites espelhados");
  assert.equal(rgba(450, 225)[0], 0);
  estatua.frame = { ...estatua.frame, cutX: 0 };
  render();
  assert.ok(rgba(470, 225)[0] > 0.1, "trocar o frame atualiza o recorte com o relógio parado");
  estatua.frame = { ...estatua.frame, cutX: 48 };
  Object.assign(estatua, { flipX: false, scaleX: 1.5, scaleY: 1.2, rotation: Math.PI / 2 });
  render();
  assert.ok(rgba(490.8, 231)[0] > 0.05, "a transparência acompanha escala, origem e rotação do objeto");
  assert.equal(rgba(490.8, 261)[0], 0);
  Object.assign(estatua, { scaleX: 1, scaleY: 1, rotation: 0, visible: false });
  render();
  const livre = rgba(470, 225)[0];
  assert.ok(livre > 0.1, "uma estátua invisível não oculta o giroflex");
  Object.assign(estatua, { visible: true, alpha: 0.5 });
  render();
  assert.ok(rgba(470, 225)[0] > 0 && rgba(470, 225)[0] < livre, "o recorte respeita a opacidade da estátua");
  estatua.alpha = 1;
  scene.player = { active: true, x: 400, y: 215 };
  render();
  assert.ok(rgba(470, 225)[3] < 0.5, "a lanterna conserva sua iluminação independente do giroflex");
  scene.definirIluminacaoFabrica(true);
  render();
  assert.ok(rgba(470, 225)[3] < 0.5, "as lâmpadas normais continuam iluminando as estátuas");
  assert.equal(canvases.length, count, "o giro usa um único carimbo reutilizável");
  const carimbo = canvases.find(canvas => canvas.width === 480 && canvas.height === 480);
  assert.ok(carimbo);
  cleanup();
  assert.equal(carimbo.width, 0);
  assert.equal(sheet.width, 96, "encerrar a luz não destrói a textura das estátuas");
});

test("giroflex lateral mantém a luz atrás dos pixels opacos das estátuas", t => {
  const estatua = { active: true, visible: true, alpha: 1, x: 470, y: 249,
    scaleX: 1, scaleY: 1, displayOriginX: 24, displayOriginY: 48,
    getData: name => name === "objectLayerName" ? "EstátuaRobos" : undefined };
  const map = { getObjectLayer: name => ({ objects: name === "Luzedeemergencia"
    ? [ponto({ Lateral: true, Esquerda: true }, 400, 225)] : [] }) };
  const { render, texture } = cenaComMascara(t, [], false, { map, objetosMapaParte2: [estatua] });
  const sheet = document.createElement("canvas");
  sheet.width = sheet.height = 48;
  sheet.getContext("2d").fillRect(0, 0, 48, 48);
  estatua.frame = { source: { image: sheet }, cutX: 0, cutY: 0,
    cutWidth: 48, cutHeight: 48, realWidth: 48, realHeight: 48 };
  render();
  assert.ok(texture.canvas.rgbaEm(430, 225)[0] > 0.1, "ilumina antes da estátua");
  assertSombraAmbiente(texture.canvas.alphaEm(470, 225), "o corpo oculta a claridade lateral");
  assert.equal(texture.canvas.rgbaEm(470, 225)[0], 0);
  assert.ok(texture.canvas.rgbaEm(540, 225)[0] > 0.05, "continua iluminando o cenário ao redor");
  assert.equal(texture.canvas.rgbaEm(370, 225)[0], 0, "o carimbo das estátuas preserva o recorte da parede");
});

test("personagem aparece acima dos brilhos, preservando transparência, animação e depth do mapa", async t => {
  for (const tipo of ["neon vermelho", "neon amarelo", "arandela", "energia azul"]) {
    await t.test(tipo, t => {
      const map = { getObjectLayer: name => ({ objects: name === "Luzedeemergencia" && tipo.startsWith("neon")
        ? [ponto({ Neon: true, ...(tipo === "neon amarelo" ? { Cor: "#ffffd35a" } : {}) })]
        : name === "IluminaçãoBoss" && tipo === "arandela" ? [ponto({ Direita: true, Amarelo: true })] : [] }) };
      const novoBoss = tipo === "energia azul" ? { jogadorNaArena: true,
        projeteisBoss: [{ active: true, visible: true, x: 400, y: 225 }] } : null;
      const { scene, render, texture, canvases } = cenaComMascara(t, [], true, { map, novoBoss });
      const sheet = document.createElement("canvas");
      sheet.width = 96; sheet.height = 48;
      sheet.getContext("2d").fillRect(48, 0, 48, 48);
      sheet.getContext("2d").clearRect(80, 20, 8, 8);
      const frame = { source: { image: sheet }, cutX: 48, cutY: 0, cutWidth: 48, cutHeight: 48,
        realWidth: 48, realHeight: 48 };
      const player = scene.player = { active: true, visible: false, alpha: 1,
        x: 400, y: 225, frame, displayOriginX: 24, displayOriginY: 24, depth: 16.5,
        setDepth() { assert.fail("a luz não altera o depth do personagem"); } };
      const camera = scene.cameras.main;
      const brilho = (x, y) => {
        const m = camera.matrix;
        return texture.canvas.rgbaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f).slice(0, 3).reduce((a, b) => a + b, 0);
      };
      for (const [zoom, rotacao] of [[1, 0], [1.4, 0.15]]) {
        camera.setZoom(zoom).setRotation(rotacao);
        player.visible = false;
        render();
        const livre = brilho(406, 224);
        assert.ok(livre > 0.01);
        player.visible = true;
        render();
        assert.equal(brilho(406, 224), 0, "o brilho passa atrás da silhueta opaca");
        assert.ok(brilho(410, 224) > 0.01, "a transparência do personagem revela a luz do chão");
        player.alpha = 0.5;
        render();
        assert.ok(brilho(406, 224) > 0 && brilho(406, 224) < livre, "respeita a opacidade do personagem");
        player.alpha = 1;
        player.frame = { ...frame, cutX: 0 };
        render();
        assert.ok(brilho(406, 224) > 0.01, "a máscara acompanha a animação com a câmera parada");
        player.frame = frame;
      }
      const quantidade = canvases.length;
      if (tipo !== "arandela") {
        player.flipX = true;
        render();
        assert.ok(brilho(390, 224) > 0.01, "o recorte acompanha o espelhamento");
        assert.equal(brilho(410, 224), 0);
      }
      player.x = 600;
      render();
      assert.ok(brilho(406, 224) > 0.01, "mover o personagem revela a luz sem deixar um recorte antigo");
      assert.equal(player.depth, 16.5);
      assert.equal(canvases.length, quantidade, "reutiliza a composição de brilhos");
    });
  }
});

test("a sala do boss tem claridade ambiente local, sem acumular sobreposições nem revelar salas fechadas", t => {
  const porta = { estado: "fechada", area: { x: 200, y: 190, width: 50, height: 10 } };
  const zonas = [
    { x: 100, y: 100, width: 300, height: 200 },
    { x: 350, y: 250, width: 150, height: 100 },
    { x: 600, y: 100, width: 50, height: 100 },
    { x: 620, y: 250, width: 100, height: 60, rotation: 90 },
  ];
  const map = { getObjectLayer: name => ({ visible: false, objects: name === "ZonaBoss" ? zonas
    : name === "LuzApagada" ? [{ x: 200, y: 150, width: 50, height: 40 }] : [] }) };
  const { scene, render, texture, cleanup, canvases } = cenaComMascara(t, [], false,
    { map, portasFabrica: [porta] });
  const camera = scene.cameras.main;
  const alpha = (x, y) => {
    const m = camera.matrix;
    return texture.canvas.alphaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
  };
  for (const [zoom, rotacao] of [[1, 0], [0.8, 0.15]]) {
    camera.setZoom(zoom).setRotation(rotacao);
    render();
    const sala = alpha(150, 150);
    assert.ok(sala > 0.55 && sala < 0.65, "a sala fica moderadamente mais clara");
    assert.equal(alpha(375, 275), sala, "retângulos sobrepostos não acumulam claridade");
    assert.equal(alpha(610, 150), sala, "inclui todas as áreas da sala");
    assert.equal(alpha(590, 300), sala, "acompanha retângulos rotacionados");
    assertSombraAmbiente(alpha(550, 225), "não clareia o espaço entre os retângulos");
    assertSombraAmbiente(alpha(50, 150), "preserva a escuridão no resto da fábrica");
    assert.equal(alpha(225, 170), 1, "a porta fechada conserva a zona escura");
  }
  porta.estado = "aberta";
  render();
  scene.time.now = 200;
  render();
  assert.equal(alpha(225, 170), alpha(150, 150), "abrir a porta também revela a iluminação ambiente");
  cleanup();
  assert.ok(canvases.slice(1).every(canvas => canvas.width === 0 && canvas.height === 0));
});

test("luzes fixas reutilizam os recortes durante o movimento do boss e invalidam ao mover estátuas", t => {
  const neons = Array.from({ length: 24 }, (_, i) => ({ ...ponto({ Neon: true }, 150 + i * 20, 225), id: i + 1 }));
  const estatuas = Array.from({ length: 24 }, (_, i) => ({ active: true, visible: true, alpha: 1,
    x: 160 + i * 20, y: 249, displayOriginX: 24, displayOriginY: 48,
    getData: name => name === "objectLayerName" ? "EstátuaRobos" : undefined }));
  const novoBoss = { jogadorNaArena: true, sprite: { active: true, visible: true, x: 400, y: 209, alpha: 1 } };
  const map = { getObjectLayer: name => ({ objects: name === "Luzedeemergencia" ? neons : [] }) };
  const { scene, render, canvases, cleanup } = cenaComMascara(t, [], false,
    { map, novoBoss, objetosMapaParte2: estatuas });
  const sheet = document.createElement("canvas");
  sheet.width = sheet.height = 48;
  sheet.getContext("2d").fillRect(0, 0, 48, 48);
  for (const estatua of estatuas) estatua.frame = { source: { image: sheet }, cutX: 0, cutY: 0,
    cutWidth: 48, cutHeight: 48, realWidth: 48, realHeight: 48 };
  let desenhos = 0;
  for (const canvas of canvases) {
    const context = canvas.getContext("2d"), original = context.drawImage.bind(context);
    context.drawImage = (...args) => { desenhos++; original(...args); };
  }
  render();
  const primeiraComposicao = desenhos, quantidade = canvases.length;
  desenhos = 0;
  novoBoss.sprite.x++;
  render();
  const movimento = desenhos;
  t.diagnostic(`drawImage: primeira composição=${primeiraComposicao}; boss em movimento=${movimento}`);
  assert.ok(movimento < primeiraComposicao * 0.15, "movimento do boss não recalcula as máscaras das luzes fixas");
  assert.ok(movimento <= 6, "a composição das luzes fixas não cresce com a quantidade de neons");
  desenhos = 0;
  scene.cameras.main.setZoom(1.1).setRotation(0.1);
  render();
  assert.ok(desenhos < primeiraComposicao * 0.15, "a câmera reutiliza os recortes em coordenadas do mundo");
  desenhos = 0;
  estatuas[0].x++;
  render();
  assert.ok(desenhos > movimento, "mover a estátua atualiza os recortes guardados");
  assert.equal(canvases.length, quantidade, "não cria novos canvases durante a luta");
  cleanup();
  assert.ok(canvases.filter(canvas => canvas !== sheet).slice(1)
    .every(canvas => canvas.width === 0 && canvas.height === 0));
});

test("energia azul dos projéteis e do escudo ilumina o cenário, acompanha o boss e respeita portas", async t => {
  for (const escudo of [false, true]) {
    await t.test(escudo ? "Escudo" : "Projétil", t => {
      const projetil = { active: true, visible: true, alpha: 1, x: 400, y: 225,
        novoBossDisparoEnergia: true };
      const sprite = { active: true, visible: escudo, alpha: 1, x: 400, y: 209 };
      const novoBoss = { jogadorNaArena: true, sprite, barreiraAtiva: escudo,
        projeteisBoss: escudo ? [] : [projetil], config: { geradores: { raioBarreira: 95 } } };
      const body = { x: escudo ? 510 : 418, y: 50, width: 4, height: 350, enable: false };
      const { scene, render, texture, cleanup, canvases } = cenaComMascara(t, [], false,
        { novoBoss, portasFabrica: [{ colisao: { body } }] });
      const camera = scene.cameras.main;
      const rgba = (x, y) => {
        const m = camera.matrix;
        return texture.canvas.rgbaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
      };
      const antes = escudo ? 480 : 410, depois = escudo ? 525 : 432;
      for (const [zoom, rotacao] of [[1, 0], [1.4, 0.15]]) {
        camera.setZoom(zoom).setRotation(rotacao);
        render();
        const halo = rgba(antes, 225);
        assert.ok(halo[2] > 0.01 && halo[2] > halo[0] * 3, "o cenário recebe um halo azul");
        assert.ok(halo[3] < ESCURIDAO_AMBIENTE_FABRICA, "a energia clareia o piso ao redor");
        assert.ok(rgba(depois, 225)[2] > 0.005, "o halo também alcança além do contorno do efeito");
        body.enable = true;
        render();
        assert.equal(rgba(depois, 225)[2], 0, "a coloração azul não atravessa a porta fechada");
        assertSombraAmbiente(rgba(depois, 225)[3]);
        assert.deepEqual(rgba(antes, 225), halo, "a luz continua antes da porta");
        body.enable = false;
        render();
        assert.ok(rgba(depois, 225)[2] > 0.005, "abrir a porta revela a luz com o relógio parado");
      }
      const uploads = texture.refreshes;
      render();
      assert.equal(texture.refreshes, uploads, "a energia parada reutiliza a composição");
      scene.definirIluminacaoFabrica(true);
      render();
      assert.ok(rgba(antes, 225)[2] > 0.01, "também funciona com o gerador ligado");
      (escudo ? sprite : projetil).x = 600;
      render();
      assert.equal(rgba(400, 225)[2], 0, "mover a fonte não deixa luz na posição antiga");
      assert.ok(rgba(escudo ? 680 : 610, 225)[2] > 0.01);
      if (escudo) novoBoss.barreiraAtiva = false;
      else projetil.active = false;
      render();
      assert.equal(rgba(escudo ? 680 : 610, 225)[2], 0, "o halo desaparece junto com a fonte");
      cleanup();
      assert.equal(scene.iluminacaoEnergiaBoss, null);
      assert.ok(canvases.slice(1).every(canvas => canvas.width === 0 && canvas.height === 0));
    });
  }
});

test("foco branco ilumina o personagem durante o combate, acompanha movimento e respeita portas", t => {
  const novoBoss = { active: true, jogadorNaArena: true,
    sprite: { active: true, visible: true, x: -5000, y: 225 } };
  const body = { x: 440, y: 50, width: 4, height: 350, enable: true };
  const { scene, render, texture } = cenaComMascara(t, [], true,
    { novoBoss, portasFabrica: [{ colisao: { body } }] });
  scene.player = { active: true, visible: true, x: 400, y: 225 };
  const camera = scene.cameras.main;
  const rgba = (x, y) => {
    const m = camera.matrix;
    return texture.canvas.rgbaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
  };
  for (const [zoom, rotacao] of [[1, 0], [1.4, 0.15]]) {
    camera.setZoom(zoom).setRotation(rotacao);
    render();
    const centro = rgba(400, 217);
    assert.ok(centro[3] < 0.4, "o foco clareia bem o personagem");
    assert.ok(centro[0] > 0.05);
    assert.equal(centro[0], centro[1]);
    assert.equal(centro[1], centro[2], "a luz é branca neutra");
    assertSombraAmbiente(rgba(460, 217)[3], "a porta bloqueia o foco");
    assert.equal(rgba(460, 217)[0], 0);
  }
  body.enable = false;
  render();
  assert.ok(rgba(460, 217)[0] > 0.001);
  scene.player.x = 600;
  render();
  assertSombraAmbiente(rgba(400, 217)[3], "o foco não fica na posição anterior");
  assert.ok(rgba(600, 217)[3] < 0.4);
  novoBoss.active = false;
  render();
  assertSombraAmbiente(rgba(600, 217)[3], "encerrar o combate apaga o foco branco");
});

test("rajadas com cópias preservam todas as luzes, portas e a silhueta do personagem na composição reduzida", t => {
  const projetil = () => ({ active: true, visible: true, alpha: 1, x: 400, y: 225 });
  const reais = Array.from({ length: 55 }, projetil);
  const copias = Array.from({ length: 495 }, () => ({ ...projetil(), novoBossDisparoEnergia: true,
    novoBossAtaqueIlusorio: true }));
  const novoBoss = { jogadorNaArena: true, projeteisBoss: reais };
  const body = { x: 420, y: 50, width: 5, height: 350, enable: true };
  const { scene, render, texture, canvases, cleanup } = cenaComMascara(t, [], true,
    { novoBoss, children: { list: copias }, portasFabrica: [{ colisao: { body } }] });
  const sheet = document.createElement("canvas");
  sheet.width = sheet.height = 8;
  sheet.getContext("2d").fillRect(0, 0, 8, 8);
  scene.player = { active: true, visible: true, x: 410, y: 225, displayOriginX: 4, displayOriginY: 4,
    frame: { source: { image: sheet }, cutX: 0, cutY: 0, cutWidth: 8, cutHeight: 8, realWidth: 8, realHeight: 8 } };
  const camera = scene.cameras.main;
  const rgba = (x, y) => {
    const m = camera.matrix;
    return texture.canvas.rgbaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
  };
  for (const [zoom, rotacao] of [[1, 0], [0.8, 0.15]]) {
    camera.setZoom(zoom).setRotation(rotacao);
    render();
    assert.equal(scene.iluminacaoEnergiaBoss.fontesVisiveis.length, 550, "todas as fontes reais e ilusórias continuam iluminando");
    assert.ok(rgba(400, 225)[2] > 0.5, "a rajada ilumina o cenário de azul");
    assert.equal(rgba(410, 225)[2], 0, "o personagem continua acima do brilho em resolução normal");
    assert.equal(rgba(440, 225)[2], 0, "a porta bloqueia os halos também sob carga");
    assertSombraAmbiente(rgba(440, 225)[3]);
  }
  assert.equal(canvases.filter(canvas => canvas.width === 400 && canvas.height === 225).length, 2,
    "os dois campos de energia usam um quarto dos pixels da tela");
  const quantidade = canvases.length;
  body.enable = false;
  render();
  assert.ok(rgba(440, 225)[2] > 0.01, "abrir a porta atualiza a composição reduzida");
  for (const p of [...reais, ...copias]) p.active = false;
  render();
  assert.equal(rgba(400, 225)[2], 0, "a rajada encerrada não deixa luz residual");
  assert.equal(canvases.length, quantidade, "reutiliza os buffers durante toda a rajada");
  cleanup();
  assert.ok(canvases.filter(canvas => canvas !== sheet).slice(1)
    .every(canvas => canvas.width === 0 && canvas.height === 0));
});

test("neons do chão com camada oculta emitem sua cor local e fixa, acompanhando orientação, câmera e portas", async t => {
  for (const [vertical, amarela] of [[false, false], [true, false], [false, true], [true, true]]) {
    await t.test(`${amarela ? "Amarelo" : "Vermelho"} ${vertical ? "Vertical" : "Horizontal"}`, t => {
      const body = { x: 406, y: 210, width: 2, height: 30, enable: false };
      const map = { getObjectLayer: name => ({ visible: false, objects: name === "Luzedeemergencia"
        ? [ponto({ Neon: true, Orientacao: vertical ? "Vertical" : "Horizontal",
          ...(amarela ? { Cor: "#ffffd35a" } : {}) })] : [] }) };
      const { scene, render, texture, cleanup, canvases } = cenaComMascara(t, [], false,
        { map, portasFabrica: [{ colisao: { body } }] });
      const camera = scene.cameras.main;
      const rgba = (x, y) => {
        const m = camera.matrix;
        return texture.canvas.rgbaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
      };
      for (const [zoom, rotacao] of [[1, 0], [1.4, 0.15]]) {
        camera.setZoom(zoom).setRotation(rotacao);
        render();
        const centro = rgba(400, 225), halo = rgba(400, 230);
        assert.ok(centro[0] > 0.8 && centro[0] > centro[1], "núcleo luminoso");
        assert.ok(halo[0] > 0.01, "halo visível junto ao ponto");
        if (amarela) assert.ok(halo[1] > halo[2] * 2, "o halo amarelo ilumina as listras");
        else assert.ok(halo[0] > halo[1] * 5, "os neons existentes continuam vermelhos");
        assert.ok(halo[3] < ESCURIDAO_AMBIENTE_FABRICA, "ilumina o chão mesmo sem gerador");
        const longitudinal = vertical ? rgba(400, 228) : rgba(403, 225);
        const transversal = vertical ? rgba(403, 225) : rgba(400, 228);
        assert.ok(longitudinal[1] > transversal[1] + 0.05, "a faixa acompanha a orientação da marca");
        assert.ok(rgba(400, 241)[0] > 0.01, "o halo ilumina uma área maior ao redor do neon");
        assert.ok(rgba(400, 241)[3] < ESCURIDAO_AMBIENTE_FABRICA);
        assert.equal(rgba(400, 253)[0], 0, "o brilho mantém um alcance local");
        assertSombraAmbiente(rgba(400, 253)[3]);
      }
      const uploads = texture.refreshes;
      scene.time.now = 500;
      render();
      assert.equal(texture.refreshes, uploads, "permanece fixo sem pulsar ou girar");
      assert.ok(rgba(409, 225)[0] > 0.01);
      body.enable = true;
      render();
      assert.equal(rgba(409, 225)[0], 0, "a cor não atravessa a porta fechada");
      assertSombraAmbiente(rgba(409, 225)[3]);
      body.enable = false;
      render();
      assert.ok(rgba(409, 225)[0] > 0.01, "reabrir a porta restaura o halo");
      cleanup();
      assert.ok(canvases.slice(1).every(canvas => canvas.width === 0 && canvas.height === 0));
    });
  }
});

test("IluminaçãoBoss desenha faixas amarelas fixas nas quatro direções, respeitando portas e câmera", async t => {
  for (const [direcao, dx, dy] of [["Direita", 1, 0], ["Esquerda", -1, 0], ["Cima", 0, -1], ["Baixo", 0, 1]]) {
    await t.test(direcao, t => {
      const body = { x: 400 + dx * 60 - (dx ? 3 : 125), y: 225 + dy * 60 - (dy ? 3 : 125),
        width: dx ? 6 : 250, height: dy ? 6 : 250, enable: false };
      const map = { getObjectLayer: name => ({ objects: name === "IluminaçãoBoss"
        ? [ponto({ [direcao]: true, Amarelo: true })] : [] }) };
      const { scene, render, texture, canvases, cleanup } = cenaComMascara(t, [], false,
        { map, portasFabrica: [{ colisao: { body } }] });
      const camera = scene.cameras.main;
      const rgba = distancia => {
        const m = camera.matrix, x = 400 + dx * distancia, y = 225 + dy * distancia;
        return texture.canvas.rgbaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
      };
      const quantidade = canvases.length;
      for (const [zoom, rotacao] of [[1, 0], [1.4, 0.15]]) {
        camera.setZoom(zoom).setRotation(rotacao);
        render();
        const halo = rgba(40), emissor = rgba(1);
        assert.ok(halo[3] < ESCURIDAO_AMBIENTE_FABRICA, "ilumina o interior");
        assert.ok(halo[0] > 0.2 && halo[1] > halo[2] + 0.08, "o halo é amarelo");
        assert.ok(emissor[0] > halo[0] + 0.2, "a faixa junto da parede é mais luminosa");
        assertSombraAmbiente(rgba(-40)[3], "não emite atrás da parede");
        assert.equal(rgba(-40)[0], 0);
      }
      const uploads = texture.refreshes;
      scene.time.now = 60000;
      render();
      assert.equal(texture.refreshes, uploads, "a arandela fica estável e reutiliza a composição");
      body.enable = true;
      render();
      assert.ok(rgba(30)[0] > 0.1);
      assertSombraAmbiente(rgba(90)[3]);
      assert.equal(rgba(90)[0], 0, "a porta recorta também a cor");
      body.enable = false;
      render();
      assert.ok(rgba(90)[0] > 0.1, "abrir a porta atualiza a iluminação com o relógio parado");
      assert.equal(canvases.length, quantidade);
      cleanup();
      assert.equal(scene.iluminacaoBoss, null);
      assert.ok(canvases.slice(1).every(canvas => canvas.width === 0 && canvas.height === 0));
    });
  }
});

test("faixas Cima da IluminaçãoBoss e seu halo ficam atrás das bordas e paredes, iluminando a sala", async t => {
  for (const nome of ["BordaAlta", "BordaCurvas", "ParedeAcimaPerso", "ParedeAbaixoPerso"]) {
    await t.test(nome, t => {
      let sheet;
      const tile = { index: 7, pixelX: 376, pixelY: 200, alpha: 1 };
      const layer = { layer: { name: nome }, x: 0, y: 0, scaleX: 1, scaleY: 1,
        rotation: 0, alpha: 1, visible: true, depth: 26, timeElapsed: 0,
        gidMap: { 7: { tileWidth: 48, tileHeight: 48, tileOffset: { x: 0, y: 0 },
          getAnimatedTileId: (index, tempo) => tempo >= 1000 ? 8 : index,
          getTileTextureCoordinates: index => ({ x: index === 7 ? 48 : 0, y: 0 }),
          image: { getSourceImage: () => sheet } } },
        getTilesWithinWorldXY() { return [tile]; },
        cull() { assert.fail("a oclusão das arandelas consulta a região das luzes, não a câmera"); },
        setDepth() { assert.fail("a oclusão não altera o depth das paredes"); } };
      const map = { getObjectLayer: name => ({ objects: name === "IluminaçãoBoss"
        ? [ponto({ Cima: true, Amarelo: true })] : [] }) };
      const { scene, render, texture, canvases, cleanup } = cenaComMascara(t, [], false,
        { map, camadasMapaParte2: [layer] });
      sheet = document.createElement("canvas");
      sheet.width = 96; sheet.height = 48;
      sheet.getContext("2d").fillRect(48, 0, 48, 48);
      sheet.getContext("2d").clearRect(56, 20, 8, 8);
      const camera = scene.cameras.main;
      const rgba = (x, y) => {
        const m = camera.matrix;
        return texture.canvas.rgbaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
      };
      for (const [zoom, rotacao] of [[1, 0], [1.4, 0.15]]) {
        camera.setZoom(zoom).setRotation(rotacao);
        render();
        assert.ok(rgba(390, 224)[0] > rgba(406, 224)[0] + 0.2,
          "pixels transparentes deixam ver a faixa; pixels opacos escondem o emissor");
        assert.equal(rgba(400, 210)[0], 0, "o halo amarelo não aparece por cima da parede");
        assertSombraAmbiente(rgba(400, 210)[3], "a luz também não clareia a parede");
        assert.ok(rgba(390, 221)[3] < ESCURIDAO_AMBIENTE_FABRICA,
          "os pixels transparentes do tile deixam a iluminação passar");
        assert.ok(rgba(400, 170)[0] > 0.1, "a luz continua saindo e alcança a sala");
        const halo = rgba(400, 170);
        layer.visible = false;
        render();
        assert.deepEqual(rgba(400, 170), halo, "a parede não muda o alcance do halo");
        assert.ok(rgba(400, 210)[0] > 0.2, "ocultar a parede revela o halo que estava atrás dela");
        assert.ok(rgba(400, 210)[3] < ESCURIDAO_AMBIENTE_FABRICA,
          "ocultar a parede revela também a iluminação");
        layer.visible = true;
        render();
        assert.equal(layer.depth, 26);
      }
      const quantidade = canvases.length, uploads = texture.refreshes;
      render();
      assert.equal(texture.refreshes, uploads, "o emissor parado reutiliza a máscara");
      tile.flipX = true;
      render();
      assert.ok(rgba(410, 224)[0] > rgba(390, 224)[0] + 0.2, "o recorte acompanha o espelhamento do tile");
      layer.visible = false;
      render();
      const livre = rgba(406, 224)[0];
      layer.visible = true; layer.alpha = 0.5;
      render();
      const parcial = rgba(406, 224)[0];
      layer.alpha = 1;
      render();
      assert.ok(parcial > rgba(406, 224)[0] && parcial < livre, "preserva a transparência parcial da camada");
      layer.timeElapsed = 1000;
      render();
      assert.ok(rgba(406, 224)[0] > parcial, "trocar o frame do tile atualiza a oclusão com a câmera parada");
      assert.equal(canvases.length, quantidade, "usa um único carimbo reutilizável");
      cleanup();
      assert.equal(sheet.width, 96, "preserva a textura dos tiles");
      assert.ok(canvases.filter(canvas => canvas !== sheet).slice(1)
        .every(canvas => canvas.width === 0 && canvas.height === 0));
    });
  }
});

test("LimitaLuz bloqueia lanterna, giroflex, luminárias, pulsos e áreas luminosas", async t => {
  for (const tipo of ["lanterna", "giroflex", "luminaria", "pulso", "area"]) {
    await t.test(tipo, t => {
      const gerador = ["luminaria", "pulso", "area"].includes(tipo);
      const objeto = tipo === "area"
        ? { id: 1, x: 360, y: 185, width: 160, height: 80, properties: {} }
        : ponto({ Pulsando: tipo === "pulso" }, 400, 225);
      const map = { getObjectLayer: name => ({ objects:
        name === "LimitaLuz" ? [{ x: 460, y: 100, width: 16, height: 250,
          properties: [{ name: "Luzatravessa", type: "bool", value: true }] }]
        : name === "LuzesFabrica" && gerador ? [objeto]
        : name === "Luzedeemergencia" && tipo === "giroflex" ? [objeto]
        : name === "collision" && gerador ? [{ x: 420, y: 100, width: 4, height: 250 }]
        : [] }) };
      const { scene, render, texture } = cenaComMascara(t, [], gerador, { map });
      if (tipo === "lanterna") scene.player = { active: true, x: 400, y: 215 };
      const camera = scene.cameras.main;
      const rgba = (x, y) => {
        const m = camera.matrix;
        return texture.canvas.rgbaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
      };
      for (const [zoom, rotacao] of [[1, 0], [1.5, 0.15]]) {
        camera.setZoom(zoom).setRotation(rotacao);
        render();
        assert.ok(rgba(430, 225)[3] < ESCURIDAO_AMBIENTE_FABRICA - 0.01,
          "a fonte continua iluminando antes da barreira");
        assertSombraAmbiente(rgba(465, 225)[3], "o bloqueio começa na borda do objeto");
        assertSombraAmbiente(rgba(490, 225)[3], "a luz não passa para o outro lado");
        assert.equal(rgba(490, 225)[0], 0, "a coloração da fonte também respeita o limite");
      }
    });
  }
});

test("LuzApagada oculta no Tiled cobre todas as luzes e revela só a sala aberta com partida das lâmpadas", t => {
  const areas = [
    { id: 1, x: 100, y: 100, width: 160, height: 100 },
    { id: 2, x: 500, y: 100, width: 160, height: 100 },
  ];
  const portas = areas.map(area => ({ estado: "fechada",
    area: { ...area, y: 200, height: 30 } }));
  const lampadas = [ponto({}, 200, 150), ponto({}, 580, 150), ponto({}, 400, 225)];
  const map = { getObjectLayer: name => ({ visible: name !== "LuzApagada", objects: name === "LuzApagada" ? areas
    : name === "LuzesFabrica" ? lampadas
    : name === "Luzedeemergencia" ? [ponto({}, 320, 150)] : [] }) };
  const { scene, render, texture, cleanup } = cenaComMascara(t, [], true, { map, portasFabrica: portas });
  const camera = scene.cameras.main;
  const rgba = (x, y) => {
    const m = camera.matrix;
    return texture.canvas.rgbaEm(m.a*x + m.c*y + m.e, m.b*x + m.d*y + m.f);
  };
  for (const [zoom, rotation] of [[1, 0], [1.3, 0.1]]) {
    camera.setZoom(zoom).setRotation(rotation);
    render();
    assert.deepEqual(rgba(200, 150), [0, 0, 0, 1], "a sombra cobre inclusive o giroflex externo");
    assert.deepEqual(rgba(580, 150), [0, 0, 0, 1]);
    assert.ok(rgba(400, 225)[3] < ESCURIDAO_AMBIENTE_FABRICA, "as lâmpadas externas continuam ligadas");
  }
  const uploads = texture.refreshes;
  render();
  assert.equal(texture.refreshes, uploads, "zonas fechadas reutilizam a composição parada");
  scene.definirIluminacaoFabrica(false);
  scene.player = { active: true, x: 60, y: 140 };
  render();
  assert.deepEqual(rgba(200, 150), [0, 0, 0, 1], "a lanterna também fica coberta pela sombra");
  delete scene.player;
  scene.definirIluminacaoFabrica(true);
  portas[0].estado = "abrindo";
  render();
  assert.equal(rgba(200, 150)[3], 1);
  portas[0].estado = "aberta";
  scene.time.now = 100;
  render();
  assert.equal(rgba(200, 150)[3], 1, "a revelação começa após terminar de abrir");
  scene.time.now = 175;
  render();
  assert.ok(rgba(200, 150)[3] < 1 && rgba(200, 150)[3] > 0.5, "a zona escura desaparece suavemente");
  scene.time.now = 350;
  render();
  assert.equal(scene.zonasLuzApagada.zonas[0].opacidade, 0);
  const fonte = scene.iluminacaoFabrica.fontesVisiveis.find(f => f.luz.x === 200);
  assert.ok(fonte.intensidade > 0 && fonte.intensidade < 1, "a lâmpada passa pela animação de partida");
  scene.time.now = 850;
  render();
  assert.equal(fonte.intensidade, 1);
  assert.ok(rgba(200, 150)[3] < ESCURIDAO_AMBIENTE_FABRICA);
  assert.deepEqual(rgba(580, 150), [0, 0, 0, 1], "a outra sala permanece totalmente escura");
  cleanup();
  assert.equal(scene.zonasLuzApagada, null);
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
    if (source.context.bitmap === canvases[1].context.bitmap) assert.equal(op.globalCompositeOperation, "destination-out", "white alpha stamp is only used to remove darkness");
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
  scene.cache = { tilemap: { remove() {} } };
  scene.scene = { get: () => null };
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
  assert.equal(defaults.piscando, false);
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

test("Piscando aceita apenas booleanos e usa falhas espaçadas quando ausente ou inválido", () => {
  for (const value of [undefined, null, 0, 1, "true", "false", false, true]) {
    for (const properties of [{ Piscando: value }, [{ name: "Piscando", type: "bool", value }]]) {
      const [light] = lerLuzesFabrica(mapa(ponto(properties)));
      assert.equal(light.piscando, value === true);
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

test("Piscando=true repete sem pausas e reutiliza o perfil sem novos sorteios", () => {
  let sorteios = 0;
  const lights = new FactoryLighting(mapa(ponto({ Piscando: true }), ponto({ Piscando: false })), {
    aleatorio: () => { sorteios++; return 0; },
  });
  const camera = criarCamera();
  lights.definirEnergia(true);
  lights.atualizar(0, camera);
  const perfil = lights.estados[0].falha;
  assert.ok(perfil);
  assert.equal(lights.estados[1].falha, null);
  assert.equal(lights.falhasIniciadas.length, 0, "o estalo aguarda a queda visível");
  const sorteiosIniciais = sorteios;
  for (let agora = 10; agora <= 15000; agora += 10) {
    lights.atualizar(agora, camera);
    assert.equal(lights.estados[0].falha, perfil, "sem alocar um novo perfil a cada ciclo");
    assert.equal(lights.estados[0].proximaFalha, null);
    assert.equal(lights.estados[1].falha, null);
    if (agora % perfil.duracao === 1100) assert.ok(lights.estados[0].intensidade < 0.5);
  }
  assert.equal(sorteios, sorteiosIniciais, "não sorteia novamente durante os ciclos");
  lights.definirEnergia(false);
  assert.equal(lights.estados[0].falha, null);
  assert.equal(lights.atualizar(16000, camera).length, 0);
  lights.definirEnergia(true);
  lights.atualizar(16000, camera);
  assert.equal(lights.estados[0].falha, perfil, "reutiliza o perfil ao religar");
  assert.equal(perfil.inicio, 16000);
});

test("piscadas contínuas aguardam a partida e não acumulam áudio fora da tela ou após suspensão", () => {
  let progresso = 0.5;
  const lights = new FactoryLighting(mapa(ponto({ Piscando: true }, 900, 200)), { aleatorio: () => 0 });
  const camera = criarCamera();
  lights.definirEnergia(true, () => progresso);
  lights.atualizar(0, camera);
  assert.equal(lights.estados[0].falha, null);
  progresso = 1;
  lights.atualizar(1000, camera);
  assert.ok(lights.estados[0].falha);
  const perfil = lights.estados[0].falha;
  const primeiroEstalo = perfil.inicio + perfil.estalos[0].tempo;
  lights.atualizar(primeiroEstalo, camera);
  assert.equal(lights.falhasIniciadas.length, 0, "início do ciclo fora do campo de visão");
  camera.setScroll(500, 0);
  camera.preRender();
  lights.atualizar(primeiroEstalo + 100, camera);
  assert.ok(lights.fontesVisiveis[0].intensidade < 0.5);
  assert.equal(lights.falhasIniciadas.length, 0, "entrar na tela não repete áudio");
  lights.atualizar(100000, camera);
  assert.ok(lights.estados[0].falha, "continua piscando após a suspensão");
  assert.equal(lights.falhasIniciadas.length, 0, "descarta os eventos vencidos");
  const proximo = perfil.estalos[perfil.proximoEstalo];
  lights.atualizar(perfil.inicio + proximo.tempo, camera);
  assert.equal(lights.falhasIniciadas.length, 1, "um evento por queda visível");
});

test("lâmpadas não marcadas têm falhas independentes com pausas maiores", () => {
  let seed = 12;
  const lights = new FactoryLighting(mapa(ponto({ Piscando: false }), ponto({ Piscando: false }), ponto()), {
    aleatorio: () => ((seed = seed * 16807 % 2147483647) - 1) / 2147483646,
  });
  lights.definirEnergia(true);
  const camera = criarCamera();
  const starts = lights.estados.map(() => []);
  const ends = lights.estados.map(() => []);
  const values = lights.estados.map(() => []);
  const previous = lights.estados.map(() => false);
  let simultaneous = false;
  for (let now = 0; now < 360000; now += 20) {
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
    assert.ok(Math.min(...values[index]) < 0.55);
    assert.ok(values[index].every(value => value >= 0 && value <= 1));
    assert.ok(times.length >= 3, "também falha com Piscando=false ou sem a propriedade");
    assert.ok(times[0] >= 20000 && times[0] <= 60020);
    assert.ok(new Set(times.slice(1).map((time, i) => time - times[i])).size > 1);
    for (let i = 0; i < ends[index].length; i++) {
      const duration = ends[index][i] - times[i];
      assert.ok(duration >= 1185 && duration <= 5466);
      if (times[i + 1] !== undefined) {
        const rest = times[i + 1] - ends[index][i];
        assert.ok(rest >= 30000 && rest <= 90020, "pausas estáveis entre sequências");
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


test("uma falha ocasional faz um corte profundo com repique e volta a estabilizar", () => {
  const lights = new FactoryLighting(mapa(
    ponto({ Piscando: false }),
  ), { aleatorio: () => 0 });
  lights.definirEnergia(true);
  const camera = criarCamera();
  const valores = [];
  let eventos = 0;
  for (let agora = 0; agora <= 24000; agora += 10) {
    lights.atualizar(agora, camera);
    eventos += lights.falhasIniciadas.length;
    if (agora >= 20000) valores.push(lights.fontesVisiveis[0].intensidade);
  }
  let quedas = 0;
  let recuperacoes = 0;
  for (let i = 1; i < valores.length; i++) {
    if (valores[i] < 0.6 && valores[i - 1] >= 0.6) quedas++;
    if (valores[i] > 0.9 && valores[i - 1] <= 0.9) recuperacoes++;
  }
  assert.equal(eventos, 1, "uma sequência dispara só um evento de áudio");
  assert.equal(quedas, 2, "corta, tenta reacender e corta novamente");
  assert.equal(recuperacoes, 1, "só firma a luz após o repique");
  assert.ok(Math.min(...valores) < 0.08, "a falhada quase apaga a lâmpada");
  assert.equal(valores.at(-1), 1);
  assert.equal(lights.estados[0].falha, null);
});

test("a máscara acompanha as falhas e volta a reutilizar a textura quando estabiliza", t => {
  const { scene, render, texture } = cenaComMascara(t, [ponto({ Piscando: false })], true);
  scene.iluminacaoFabrica.aleatorio = () => 0;
  render();
  const acesa = texture.canvas.alphaEm(400, 225);
  scene.time.now = 20000;
  render();
  const uploads = texture.refreshes;
  scene.time.now = 21100;
  render();
  assert.ok(texture.canvas.alphaEm(400, 225) > acesa + 0.1, "o cenário escurece na queda");
  assert.ok(texture.refreshes > uploads);
  scene.time.now = 21610;
  render();
  assert.equal(texture.canvas.alphaEm(400, 225), acesa);
  const stable = texture.refreshes;
  scene.time.now = 21700;
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
  lights.atualizar(49999, camera);
  assert.equal(lights.estados[0].falha, null);
  lights.atualizar(50000, camera);
  assert.ok(lights.estados[0].falha);
});


test("falhas simultâneas respeitam os limites de duração e desligar cancela todos os relógios", () => {
  for (const sorteio of [0, 0.5, 1]) {
    const lights = new FactoryLighting(mapa(
      ponto({ Piscando: false }, 100, 200),
      ponto({ Piscando: false }, 200, 200),
      ponto({ Piscando: false }, 300, 200),
    ), { aleatorio: () => sorteio });
    lights.definirEnergia(true);
    const camera = criarCamera();
    const intervalo = 20000 + sorteio * 40000;
    lights.atualizar(0, camera);
    lights.atualizar(intervalo - 1, camera);
    assert.equal(lights.falhasIniciadas.length, 0);
    lights.atualizar(intervalo, camera);
    assert.equal(lights.falhasIniciadas.length, 0, "a falha começa acesa antes da primeira queda");
    const perfil = lights.estados[0].falha;
    const duracao = perfil.duracao;
    lights.atualizar(intervalo + perfil.estalos[0].tempo, camera);
    assert.equal(lights.falhasIniciadas.length, 3);
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
    ponto({ Piscando: false }, -50, 200),
    ponto({ Piscando: false }, 900, 200),
  ), { aleatorio: () => 0 });
  lights.definirEnergia(true);
  const camera = criarCamera();
  for (const tempo of [0, 20000]) {
    lights.atualizar(tempo, camera);
    assert.equal(lights.falhasIniciadas.length, 0, "o halo visível não basta");
  }
  assert.ok(lights.estados.every(state => state.falha), "lâmpadas fora da tela também participam");
  camera.setScroll(500, 0);
  camera.preRender();
  lights.atualizar(21100, camera);
  assert.ok(lights.fontesVisiveis.find(state => state.luz.x === 900).intensidade < 1);
  assert.equal(lights.falhasIniciadas.length, 0);
  lights.atualizar(21610, camera);
  lights.atualizar(120000, camera);
  assert.ok(lights.estados.every(state => !state.falha));
  assert.equal(lights.falhasIniciadas.length, 0, "não dispara uma fila de falhas vencidas");
  lights.atualizar(150000, camera);
  lights.atualizar(150958, camera);
  assert.deepEqual(lights.falhasIniciadas.map(estalo => estalo.luz.x), [900]);
});
