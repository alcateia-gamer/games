import test from "node:test";
import assert from "node:assert/strict";
import { criarDisplayGerador } from "./FactoryGeneratorDisplay.js";

test("painel parado não redesenha nem consulta layout; invalidação e resize atualizam", t => {
  const oldDocument = globalThis.document, oldWindow = globalThis.window;
  t.after(() => { globalThis.document = oldDocument; globalThis.window = oldWindow; });
  let reads = 0, draws = 0;
  const bounds = () => { reads++; return { width: 800, height: 400, left: 0, top: 0 }; };
  const context = { setTransform() {}, clearRect() { draws++; }, translate() {} };
  const parent = { appendChild(canvas) { canvas.parentElement = this; }, getBoundingClientRect: bounds };
  const canvas = { style: {}, dataset: {}, setAttribute() {}, getContext: () => context };
  globalThis.document = { createElement: () => canvas };
  globalThis.window = { devicePixelRatio: 3, innerWidth: 800, innerHeight: 400 };
  const scene = { game: { canvas: { parentElement: parent, getBoundingClientRect: bounds } },
    sys: { game: { device: { input: { touch: true } } } }, scale: { gameSize: { width: 800, height: 400 } } };
  const display = criarDisplayGerador(scene, 740, 390, "test", { manualInvalidation: true });
  const camera = { x: 0, y: 0, width: 800, height: 400 };
  display.render(camera, 1, true);
  assert.equal(canvas.width, 1110, "limita a densidade em aparelhos móveis");
  for (let i = 0; i < 120; i++) display.render(camera, 1, true);
  assert.equal(draws, 1); assert.equal(reads, 2);
  display.invalidate(); display.render(camera, 1, true);
  assert.equal(draws, 2); assert.equal(reads, 2);
  camera.width = 400; display.render(camera, 0.5, true);
  assert.equal(draws, 3); assert.equal(reads, 4);
  display.hide(); display.render(camera, 0.5, true);
  assert.equal(reads, 6);
});
