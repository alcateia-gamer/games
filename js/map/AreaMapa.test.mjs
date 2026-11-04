import test from "node:test";
import assert from "node:assert/strict";
import { criarAreaMapa } from "./AreaMapa.js";

const layer = positions => ({ tilemapLayer: {
  forEachTile(fn) { positions.forEach(([x, y, index = 1]) => fn({ x, y, index })); },
  tileToWorldXY(x, y) { return { x: x * 48, y: y * 48 }; },
} });

test("limite acompanha o contorno real, inclusive recortes e coordenadas negativas", () => {
  const area = criarAreaMapa({ tileWidth: 48, tileHeight: 48,
    layers: [layer([[-2, -2], [-1, -2], [-2, -1], [-1, -1, -1]])] });
  assert.equal(area.contem({ x: -90, y: -90, width: 22, height: 10 }), true);
  assert.equal(area.contem({ x: -97, y: -90, width: 22, height: 10 }), false);
  assert.equal(area.contem({ x: -10, y: -90, width: 22, height: 10 }), false);
  assert.equal(area.contem({ x: -45, y: -45, width: 22, height: 10 }), false,
    "o vazio dentro do retângulo total do mapa também fica fora");
  assert.equal(area.contem({ x: -55, y: -60, width: 22, height: 20 }), false,
    "o corpo inteiro precisa caber no contorno");
});

test("tiles de parede contam como mapa e permitem atravessar obstáculos internos", () => {
  const area = criarAreaMapa({ tileWidth: 48, tileHeight: 48,
    layers: [layer([[-1, 0]]), layer([[0, 0]])] });
  assert.equal(area.contem({ x: -10, y: 8, width: 22, height: 10 }), true);
  assert.deepEqual(area.centroMaisProximo(1000, 24), { x: 24, y: 24 });
});
