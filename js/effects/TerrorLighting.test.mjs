import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import criarIluminacaoTerror from "./TerrorLighting.js";

test("flashlight updates on movement and direction changes only while factory power is off", t => {
  const previousPhaser = globalThis.Phaser;
  const previousDocument = globalThis.document;
  globalThis.Phaser = {
    Math: { Vector2: class {
      constructor(x = 0, y = 0) { this.set(x, y); }
      set(x, y) { Object.assign(this, { x, y }); }
    } },
    Textures: { FilterMode: { LINEAR: 0 } },
    Renderer: { Events: { RENDER: "render" } },
    Scenes: { Events: { PRE_RENDER: "prerender", SHUTDOWN: "shutdown" } },
  };
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
  }) }) };
  t.after(() => { globalThis.Phaser = previousPhaser; globalThis.document = previousDocument; });
  let uploads = 0;
  let dimensions;
  const context = Object.fromEntries(["setTransform", "scale", "clearRect", "fillRect", "save", "restore",
    "transform", "drawImage", "translate", "beginPath", "arc", "fill"]
    .map(name => [name, () => {}]));
  context.createRadialGradient = () => ({ addColorStop() {} });
  const texture = { getContext: () => context, setFilter() {}, refresh() { uploads++; } };
  const overlay = { visible: true };
  for (const name of ["setOrigin", "setScrollFactor", "setDepth", "setDisplaySize", "setPosition", "setRotation", "setScale"])
    overlay[name] = () => overlay;
  overlay.setAlpha = alpha => { overlay.alpha = alpha; return overlay; };
  overlay.setVisible = visible => { overlay.visible = visible; return overlay; };
  overlay.destroy = () => {};
  const scene = {
    game: { renderer: new EventEmitter() },
    map: { getObjectLayer: () => ({ objects: [] }) },
    sys: { game: { device: { input: { touch: true } } } },
    cameras: { main: { width: 850, height: 405, originX: 0.5, originY: 0.5,
      zoom: 1, scrollX: 0, scrollY: 0,
      matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } } },
    textures: { exists: () => false, createCanvas(key, w, h) {
      dimensions = [w, h]; return texture;
    } },
    events: new EventEmitter(), time: { now: 0 },
    player: { active: true, x: 100, y: 100, body: { velocity: { x: 0, y: 0 } },
      getCenter(point) { point.set(this.x, this.y); } },
    add: { image: () => overlay },
  };
  const cleanup = criarIluminacaoTerror(scene);
  t.after(cleanup);
  const render = () => scene.game.renderer.emit("render", scene, scene.cameras.main);
  assert.deepEqual(dimensions, [850, 405]);
  render();
  const stationaryUploads = uploads;
  for (let i = 0; i < 120; i++) render();
  assert.equal(uploads, stationaryUploads);
  scene.player.body.velocity.x = 100;
  render();
  assert.equal(uploads, stationaryUploads + 1, "mudar direção atualiza o cone");
  scene.definirIluminacaoFabrica(true);
  render();
  assert.equal(uploads, stationaryUploads + 2, "ligar a fábrica apaga a lanterna");
  scene.player.x += 40;
  scene.player.body.velocity.x = -100;
  render();
  assert.equal(uploads, stationaryUploads + 2, "personagem não invalida a máscara com a fábrica ligada");
  scene.definirIluminacaoFabrica(false);
  render();
  assert.equal(uploads, stationaryUploads + 3);
  scene.player.x += 10;
  render();
  assert.equal(uploads, stationaryUploads + 4, "lanterna acompanha o personagem sem energia");
  Object.assign(scene.player, { texture: { key: "walk" }, frame: { name: 18 },
    displayOriginX: 64, displayOriginY: 64 });
  render();
  const animationUploads = uploads;
  scene.player.frame.name = 21;
  render();
  assert.equal(uploads, animationUploads, "o movimento dos braços não desloca a origem na barriga");
  scene.player.body.velocity.x = 0;
  render();
  assert.equal(uploads, animationUploads, "parar preserva a mira e reutiliza a máscara");
  cleanup();
  assert.equal(scene.game.renderer.listenerCount("render"), 0);
});
