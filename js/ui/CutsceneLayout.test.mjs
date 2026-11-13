import test from "node:test";
import assert from "node:assert/strict";
import { CUTSCENE_LAYOUT, CutsceneGate, fitCutscene } from "./CutsceneLayout.js";

test("preserva a composição industrial completa em diferentes resoluções", () => {
  for (const [w, h] of [[844, 390], [932, 430], [667, 375], [1280, 720], [2560, 1080], [390, 844], [800, 600]]) {
    const stage = fitCutscene(w, h);
    assert.ok(stage.x >= -1e-9 && stage.y >= -1e-9);
    assert.ok(stage.x + stage.width <= w + 1e-9);
    assert.ok(stage.y + stage.height <= h + 1e-9);
    assert.ok(Math.abs(stage.width - w) < 1e-9 ||
      Math.abs(stage.height - h) < 1e-9, "Arte usa o espaço disponível sem cortar as extremidades");
    assert.ok(Math.abs(stage.width / stage.height - CUTSCENE_LAYOUT.width / CUTSCENE_LAYOUT.height) < 1e-9);
    assert.ok(Math.abs(stage.x - (w - stage.width) / 2) < 1e-9);
    assert.ok(Math.abs(stage.y - (h - stage.height) / 2) < 1e-9);
    const screen = CUTSCENE_LAYOUT.screen;
    assert.ok(screen.x + screen.width < CUTSCENE_LAYOUT.width);
    assert.ok(screen.y + screen.height < CUTSCENE_LAYOUT.height);
  }
});

test("assets prontos não interrompem a cutscene antes de terminar", () => {
  const gate = new CutsceneGate();
  gate.assetsReady = true;
  assert.equal(gate.complete(), false);
  gate.videoFinished = true;
  assert.equal(gate.complete(), true);
  assert.equal(gate.complete(), false, "uma única entrada na fase");
});

test("terminar ou pular o vídeo aguarda os assets em uma conexão lenta", () => {
  const gate = new CutsceneGate();
  gate.videoFinished = true;
  assert.equal(gate.complete(), false);
  gate.assetsReady = true;
  assert.equal(gate.complete(), true);
});
