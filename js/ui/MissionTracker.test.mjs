import assert from "node:assert/strict";
import test from "node:test";
import { posicionarMissoesMobile } from "./MissionTracker.js";

test("mantém as missões no topo ao lado do minimapa em celular largo", () => {
  const position = posicionarMissoesMobile(
    { left: 0, top: 0, right: 868 },
    { left: 774, top: 10 },
    { right: 510, bottom: 44 },
    { right: 320, bottom: 48 },
    { right: 145, bottom: 120 },
  );
  assert.deepEqual(position, { right: 766, top: 10, width: 248 });
});

test("em paisagem estreita, usa a faixa abaixo do relógio e ao lado dos aliados", () => {
  const position = posicionarMissoesMobile(
    { left: 0, top: 0, right: 568 },
    { left: 485, top: 9 },
    { right: 340, bottom: 42 },
    { right: 220, bottom: 39 },
    { right: 145, bottom: 108 },
  );
  assert.deepEqual(position, { right: 477, top: 50, width: 324 });
});

test("em retrato, desce abaixo do HUD quando a faixa lateral é estreita", () => {
  const position = posicionarMissoesMobile(
    { left: 0, top: 0, right: 320 },
    { left: 236, top: 10 },
    { right: 215, bottom: 46 },
    { right: 100, bottom: 32 },
    { right: 104, bottom: 88 },
  );
  assert.deepEqual(position, { right: 228, top: 96, width: 220 });
});
