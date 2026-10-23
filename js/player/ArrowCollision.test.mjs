import test from "node:test";
import assert from "node:assert/strict";
import { tempoImpactoFlecha, obstaculosFlecha } from "./ArrowCollision.js";

test("flecha diagonal não colide com cantos vazios de sua AABB", () => {
  const d = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  assert.equal(tempoImpactoFlecha({ x: 0, y: 0 }, { x: 0, y: 0 }, d,
    { x: -12, y: 9, width: 2, height: 2 }), null);
  assert.equal(tempoImpactoFlecha({ x: 0, y: 0 }, { x: 0, y: 0 }, d,
    { x: 9, y: 9, width: 2, height: 2 }), 0);
});

test("varredura em oito ângulos detecta obstáculos finos mesmo com delta longo", () => {
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
    const d = { x: Math.cos(angle), y: Math.sin(angle) };
    const resultado = tempoImpactoFlecha({ x: 0, y: 0 }, { x: d.x * 300, y: d.y * 300 }, d,
      { x: d.x * 150 - 1, y: d.y * 150 - 1, width: 2, height: 2 });
    assert.ok(resultado > 0 && resultado < 1);
  }
});

test("varredura rejeita alvos paralelos ao caminho, incluindo em diagonais", () => {
  const d = { x: Math.SQRT1_2, y: Math.SQRT1_2 };
  assert.equal(tempoImpactoFlecha({ x: 0, y: 0 }, { x: 200, y: 200 }, d,
    { x: 90, y: 130, width: 4, height: 4 }), null);
});

test("consulta espacial filtra corpos desativados e alheios ao mapa", () => {
  const objeto = {}, outro = {};
  const bodies = [{ enable: true, gameObject: objeto }, { enable: false, gameObject: objeto }, { enable: true, gameObject: outro }];
  const scene = { collisionGroup: { contains: obj => obj === objeto },
    physics: { world: { staticTree: { search: () => bodies } } } };
  assert.deepEqual(obstaculosFlecha(scene, { x: 0, y: 0 }, { x: 100, y: 100 }), [bodies[0]]);
});
