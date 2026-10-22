import test from "node:test";
import assert from "node:assert/strict";
import { criarCanvasHUDNitido, criarBotaoHUDNitido } from "./HudCanvas.js";
import { EventEmitter } from "node:events";

test("HUD stays sharp after display changes without reallocating stable canvases or enlarging the world", t => {
  const previous = { document: globalThis.document, window: globalThis.window, Phaser: globalThis.Phaser };
  t.after(() => Object.assign(globalThis, previous));
  globalThis.window = { devicePixelRatio: 3 };
  globalThis.Phaser = { Scenes: { Events: { PRE_RENDER: "prerender", SHUTDOWN: "shutdown" } } };
  let paints = 0, allocations = 0, destroyed = 0;
  const context = { setTransform() {}, clearRect() { paints++; }, fillRect() {},
    strokeRect() {}, fillText() {} };
  globalThis.document = { createElement() {
    let width = 300, height = 150;
    return { style: {}, setAttribute() {}, getContext: () => context,
      get width() { return width; }, set width(value) { width = value; allocations++; },
      get height() { return height; }, set height(value) { height = value; allocations++; } };
  } };
  const object = { destroy() { destroyed++; } };
  for (const method of ["setOrigin", "setScrollFactor", "setDepth", "setPosition", "setScale", "setVisible", "setAlpha"])
    object[method] = () => object;
  const scene = { events: new EventEmitter(), add: { dom: () => object },
    scale: { displaySize: { width: 850 }, gameSize: { width: 850 } },
    game: { canvas: { width: 850, height: 405 } } };
  const view = criarCanvasHUDNitido(scene, 90, 104, 10);
  assert.equal(view.atualizarResolucao(), true);
  assert.deepEqual([view.canvas.width, view.canvas.height], [270, 312]);
  const allocated = allocations;
  for (let frame = 0; frame < 100; frame++) assert.equal(view.atualizarResolucao(), false);
  assert.equal(allocations, allocated);
  scene.scale.displaySize.width = 425;
  assert.equal(view.atualizarResolucao(), true);
  assert.deepEqual([view.canvas.width, view.canvas.height], [135, 156]);
  assert.deepEqual(scene.game.canvas, { width: 850, height: 405 });
  const background = { width: 80, height: 30, x: 810, y: 150, scaleX: 1, scaleY: 1,
    depth: 200, alpha: 1, visible: true, fillColor: 0x1f2937, fillAlpha: 0.9,
    strokeColor: 0x6ee7b7, strokeAlpha: 1, lineWidth: 2 };
  const label = { text: "DEV", style: { fontSize: 14, color: "#e5e7eb" }, setAlpha() {} };
  criarBotaoHUDNitido(scene, background, label);
  const initialPaints = paints;
  for (let frame = 0; frame < 100; frame++) scene.events.emit("prerender");
  assert.equal(paints, initialPaints, "botões parados não precisam ser repintados");
  label.text = "DEV ON";
  scene.events.emit("prerender");
  assert.equal(paints, initialPaints + 1, "trocar o estado atualiza o rótulo");
  assert.equal(context.font, "bold 14px monospace");
  scene.events.emit("shutdown");
  assert.equal(scene.events.listenerCount("prerender"), 0);
  assert.equal(destroyed, 1);
  view.destroy();
});
