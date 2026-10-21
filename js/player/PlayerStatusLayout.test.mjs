import test from "node:test";
import assert from "node:assert/strict";
import { atualizarPosicaoHUD } from "./PlayerStatus.js";

test("HUD uses one canvas pixel per physical screen pixel at fractional display scales", t => {
  const previous = globalThis.window;
  t.after(() => {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  });
  for (const dpr of [1, 1.25, 1.5, 2, 3]) {
    globalThis.window = { devicePixelRatio: dpr };
    for (const width of [850, 1024, 1365, 1920]) {
      const overlay = { width: 0, height: 0, style: {},
        parentElement: { getBoundingClientRect: () => ({ left: 0, top: 0 }) } };
      const scene = {
        hudStatus: { elemento: overlay, texturasDeTela: {} },
        hudStatusDados: { largura: 2169, altura: 725 },
        scale: { gameSize: { width: 850, height: 405 } },
        game: { canvas: { getBoundingClientRect: () => ({
          width, height: width * 405 / 850, left: 3.25, top: 17.5,
        }) } },
      };
      atualizarPosicaoHUD(scene);
      assert.ok(Math.abs(parseFloat(overlay.style.width) * dpr - overlay.width) < 1e-8);
      assert.ok(Math.abs(parseFloat(overlay.style.height) * dpr - overlay.height) < 1e-8);
      assert.ok(Math.abs(parseFloat(overlay.style.left) * dpr - Math.round(parseFloat(overlay.style.left) * dpr)) < 1e-8);
      assert.equal(scene.hudStatus.texturasDeTela, null);
      const cached = {};
      scene.hudStatus.texturasDeTela = cached;
      atualizarPosicaoHUD(scene);
      assert.equal(scene.hudStatus.texturasDeTela, cached, "posição estável deve preservar o cache");
    }
  }
});
