import test from "node:test";
import assert from "node:assert/strict";

import {
  GENERATOR_REQUIREMENTS,
  distanceToInteractionArea,
  findGeneratorInteraction,
  pointerDentroDoBotao,
} from "./FactoryGenerator.js";

test("finds the named interaction area without depending on layer casing", () => {
  const object = {
    name: "gerador01",
    x: -647,
    y: -1595,
    width: 220,
    height: 126,
  };
  const result = findGeneratorInteraction({
    objects: [{ name: "Interacoes", objects: [object] }],
  });

  assert.deepEqual(result, { status: "ok", object });
});

test("supports the raw Tiled JSON layer list as well as Phaser object layers", () => {
  const object = {
    name: "gerador01",
    x: 0,
    y: 0,
    width: 20,
    height: 20,
  };
  const result = findGeneratorInteraction({
    layers: [{ name: "Interacoes", objects: [object] }],
  });

  assert.deepEqual(result, { status: "ok", object });
});

test("reports missing Tiled layers and objects instead of using coordinates", () => {
  assert.deepEqual(findGeneratorInteraction({ objects: [] }), {
    status: "missing-layer",
  });
  assert.deepEqual(
    findGeneratorInteraction({
      objects: [{ name: "interacoes", objects: [] }],
    }),
    { status: "missing-object" },
  );
});

test("rejects point objects and rectangles without dimensions", () => {
  assert.deepEqual(
    findGeneratorInteraction({
      objects: [
        {
          name: "interacoes",
          objects: [{ name: "gerador01", point: true, x: 0, y: 0 }],
        },
      ],
    }),
    { status: "invalid-area" },
  );
});

test("measures proximity to the rectangle edges, including its interior", () => {
  const area = { x: 10, y: 20, width: 40, height: 30 };

  assert.equal(distanceToInteractionArea(25, 35, area), 0);
  assert.equal(distanceToInteractionArea(55, 35, area), 5);
});

test("recognizes pointer clicks inside the centered generator button", () => {
  const area = { x: -95, y: 119, width: 220, height: 44 };

  assert.equal(pointerDentroDoBotao({ x: 305, y: 344 }, 800, 450, area), true);
  assert.equal(pointerDentroDoBotao({ x: 100, y: 344 }, 800, 450, area), false);
});

test("uses the registered gasoline and battery IDs at one unit each", () => {
  assert.deepEqual(
    GENERATOR_REQUIREMENTS.map(({ id, quantity }) => ({ id, quantity })),
    [
      { id: "gasolina", quantity: 1 },
      { id: "bateria", quantity: 1 },
    ],
  );
});
