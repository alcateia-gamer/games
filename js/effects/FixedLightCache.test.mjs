import test from "node:test";
import assert from "node:assert/strict";
import FixedLightCache from "./FixedLightCache.js";

test("acender um LED recompõe só sua faixa, reaproveitando as outras luzes e os dois canvases", t => {
  const anterior = globalThis.document, canvases = [], desenhos = [];
  globalThis.document = { createElement() {
    const ctx = { clearRect(...args) { this.limpeza = args; } };
    for (const nome of ["setTransform", "save", "restore", "beginPath", "rect", "clip", "drawImage"]) ctx[nome] = () => {};
    const canvas = { getContext: () => ctx }; canvases.push(canvas); return canvas;
  } };
  t.after(() => { globalThis.document = anterior; });
  const cache = new FixedLightCache((context, perfil, fonte) => desenhos.push(fonte.luz.id));
  const a = { id: 1, x: 0, y: 0, raio: 10, ligada: true, intensidade: 1, neon: true };
  const b = { ...a, id: 2, y: 200 };
  const c = { ...a, id: 3, y: 210 };
  cache.adicionar(a, [0, 1, 2]); cache.adicionar(b, [0, 1, 2]); cache.adicionar(c, [0, 1, 2]);
  let ligada = false;
  const zonas = { fatorLuz: luz => luz === b && !ligada ? 0 : 1 };
  const obstaculos = { revisao: 0 }, camera = { width: 500, height: 500,
    matrix: { a: 1, b: 0, c: 0, d: 1, e: 100, f: 100 } };
  const destino = { save() {}, restore() {}, drawImage() {} };
  cache.atualizar(0, zonas, obstaculos, obstaculos, obstaculos);
  cache.desenhar(destino, false, camera);
  desenhos.length = 0; ligada = true;
  cache.atualizar(1, zonas, obstaculos, obstaculos, obstaculos);
  cache.desenhar(destino, false, camera);
  assert.deepEqual(desenhos, [2, 3, 2, 2, 3, 3], "recompõe as luzes sobrepostas na mesma ordem, sem repintar a distante");
  assert.equal(canvases.length, 2);
  assert.ok(cache.contextMascara.limpeza[3] < cache.area.altura);
  desenhos.length = 0;
  cache.atualizar(2, zonas, obstaculos, obstaculos, obstaculos);
  cache.desenhar(destino, true, camera); assert.equal(desenhos.length, 0);
  obstaculos.revisao++;
  cache.atualizar(3, zonas, obstaculos, obstaculos, obstaculos);
  cache.desenhar(destino, false, camera); assert.ok(desenhos.includes(1));
  cache.destroy();
});
