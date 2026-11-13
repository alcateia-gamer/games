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

test("contorno varre bordas e buracos sem saltar até outra ilha", () => {
  const area = criarAreaMapa({ tileWidth: 48, tileHeight: 48,
    layers: [layer([[0, 0], [1, 0], [3, 0], [4, 0]])] });
  const start = { x: 10, y: 10 };
  for (const fim of [{ x: 200, y: 10 }, { x: 1e9, y: 10 }]) {
    const result = area.limitarPasso(start, fim, 20, 20);
    assert.ok(result.x <= 76 && result.x > 75.99);
    assert.ok(area.contem({ ...result, width: 20, height: 20 }));
  }
  const back = area.limitarPasso(start, { x: -500, y: 10 }, 20, 20);
  assert.equal(back.x, 0);
  assert.equal(area.intersecta({ x: 90, y: 10, width: 20, height: 20 }), true);
  assert.equal(area.intersecta({ x: 97, y: 10, width: 20, height: 20 }), false);
});

test("sombras não ampliam área da cidade e somente pretos opacos fecham a borda", async () => {
  const { criarAreaRobosCidade } = await import('./AreaMapa.js');
  const piso = { ...layer([[0, 0], [1, 0], [2, 0]]), name: 'Chão' };
  const sombra = { ...layer([[1, 0, 2713], [2, 0, 1429]]), name: 'Sombra' };
  const geral = { ...layer([[10, 10, 1429]]), name: 'SombraGeral' };
  const area = criarAreaRobosCidade({ tileWidth: 48, tileHeight: 48, layers: [piso, sombra, geral],
    tilesets: [{ name: 'A5_SciFi_Outside_Rasak', firstgid: 2713 }] });
  assert.equal(area.contem({ x: 5, y: 5, width: 20, height: 20 }), true);
  assert.equal(area.contem({ x: 53, y: 5, width: 20, height: 20 }), false);
  assert.equal(area.contem({ x: 101, y: 5, width: 20, height: 20 }), true);
  assert.equal(area.intersecta({ x: 485, y: 485, width: 20, height: 20 }), false);
});
