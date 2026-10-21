import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  GENERATOR_REQUIREMENTS,
  distanceToInteractionArea,
  findFactoryInteraction,
  findGeneratorInteraction,
  pointerDentroDoBotao,
} from "./FactoryGenerator.js";

test("finds the generator and door in the current factory map", () => {
  const map = JSON.parse(readFileSync(
    new URL("../../assets/map/parte2-fase1.json", import.meta.url),
  ));
  for (const name of ["gerador01", "porta01"]) {
    const result = findFactoryInteraction(map, name);
    assert.equal(result.status, "ok");
    assert.equal(result.object.name, name);
  }
});

test("finds interactions in Coletaveis even when Interacoes also exists", () => {
  const object = { name: "gerador01", x: 10, y: 20, width: 40, height: 30 };
  assert.deepEqual(findGeneratorInteraction({ objects: [
    { name: "Interacoes", objects: [] },
    { name: "COLETAVEIS", objects: [object] },
  ] }), { status: "ok", object });
});

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
