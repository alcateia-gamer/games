import test from "node:test";
import assert from "node:assert/strict";
import { criarTexturaIluminacao } from "./LightingTexture.js";

test("a máscara prepara o canvas para composição antes de entregá-lo ao Phaser", t => {
  const previous = globalThis.document;
  t.after(() => { globalThis.document = previous; });
  const calls = [], canvas = { getContext(type, options) { calls.push([type, options]); } };
  globalThis.document = { createElement: () => canvas };
  const texture = {};
  const textures = { addCanvas(key, source) {
    assert.deepEqual(calls, [["2d", { willReadFrequently: false }]], "o contexto já deve estar configurado");
    assert.equal(key, "lighting");
    assert.equal(source, canvas);
    assert.equal(source.width, 800); assert.equal(source.height, 450);
    return texture;
  } };
  assert.equal(criarTexturaIluminacao(textures, "lighting", 800, 450), texture);
});
