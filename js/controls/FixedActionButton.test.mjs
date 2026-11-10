import test from "node:test";
import assert from "node:assert/strict";
import { posicaoAcaoNaTela, posicionarBotaoAcao } from "./FixedActionButton.js";

test("ações mantêm distância das bordas em telas largas, tablets e retrato, mesmo com zoom", () => {
  for (const [width, height] of [[800, 450], [1186.875, 450], [800, 600], [800, 1776.7]]) {
    for (const [zoomX, zoomY] of [[1, 1], [1.5, 1.5], [2, 0.75]]) {
      const camera = { width, height, zoomX, zoomY, originX: 0.5, originY: 0.5 };
      const botao = { setPosition(x, y) { Object.assign(this, { x, y }); },
        setScale(x, y) { Object.assign(this, { scaleX: x, scaleY: y }); } };
      posicionarBotaoAcao(camera, botao, 720, 350);
      const xTela = width / 2 + (botao.x - width / 2) * zoomX;
      const yTela = height / 2 + (botao.y - height / 2) * zoomY;
      assert.ok(Math.abs(width - xTela - 80) < 1e-8);
      assert.ok(Math.abs(height - yTela - 100) < 1e-8);
      assert.equal(botao.scaleX * zoomX, 1);
      assert.equal(botao.scaleY * zoomY, 1);
      assert.deepEqual(posicaoAcaoNaTela(camera, 720, 350), { x: width - 80, y: height - 100 });
    }
  }
});
