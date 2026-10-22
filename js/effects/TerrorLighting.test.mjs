import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import criarIluminacaoTerror from "./TerrorLighting.js";

test("mobile flashlight uses a smaller mask and skips stationary and hidden texture uploads", t => {
  const previousPhaser = globalThis.Phaser;
  const previousDocument = globalThis.document;
  globalThis.Phaser = {
    Math: { Vector2: class {
      constructor(x = 0, y = 0) { this.set(x, y); }
      set(x, y) { Object.assign(this, { x, y }); }
    } },
    Textures: { FilterMode: { LINEAR: 0 } },
    Scenes: { Events: { PRE_RENDER: "prerender", SHUTDOWN: "shutdown" } },
  };
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
  }) }) };
  t.after(() => { globalThis.Phaser = previousPhaser; globalThis.document = previousDocument; });
  let uploads = 0;
  let dimensions;
  const context = Object.fromEntries(["scale", "clearRect", "fillRect", "save", "restore",
    "transform", "drawImage", "translate", "beginPath", "arc", "fill"]
    .map(name => [name, () => {}]));
  context.createRadialGradient = () => ({ addColorStop() {} });
  const texture = { getContext: () => context, setFilter() {}, refresh() { uploads++; } };
  const overlay = { visible: true };
  for (const name of ["setOrigin", "setScrollFactor", "setDepth", "setDisplaySize", "setPosition"])
    overlay[name] = () => overlay;
  overlay.setAlpha = alpha => { overlay.alpha = alpha; return overlay; };
  overlay.setVisible = visible => { overlay.visible = visible; return overlay; };
  overlay.destroy = () => {};
  const scene = {
    sys: { game: { device: { input: { touch: true } } } },
    cameras: { main: { width: 850, height: 405, originX: 0.5, originY: 0.5,
      zoom: 1, worldView: { x: 0, y: 0 } } },
    textures: { exists: () => false, createCanvas(key, w, h) {
      dimensions = [w, h]; return texture;
    } },
    events: new EventEmitter(), time: { now: 0 },
    player: { active: true, body: { velocity: { x: 0, y: 0 } },
      getCenter(point) { point.set(100, 100); } },
    add: { image: () => overlay },
  };
  const cleanup = criarIluminacaoTerror(scene);
  assert.deepEqual(dimensions, [425, 203]);
  scene.events.emit("prerender");
  const stationaryUploads = uploads;
  for (let i = 0; i < 120; i++) scene.events.emit("prerender");
  assert.equal(uploads, stationaryUploads);
  scene.player.body.velocity.x = 100;
  scene.events.emit("prerender");
  assert.equal(uploads, stationaryUploads + 1, "mudar direção atualiza o cone");
  scene.definirIluminacaoFabrica(true);
  scene.cameras.main.worldView.x = 40;
  scene.events.emit("prerender");
  assert.equal(uploads, stationaryUploads + 1, "luz acesa dispensa a máscara");
  scene.definirIluminacaoFabrica(false);
  scene.events.emit("prerender");
  assert.equal(uploads, stationaryUploads + 2);
  cleanup();
  assert.equal(scene.events.listenerCount("prerender"), 0);
});
