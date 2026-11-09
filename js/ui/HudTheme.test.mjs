import test from "node:test";
import assert from "node:assert/strict";
import { colorirContornoEstaminaHUD, colorirMolduraHUD, colorirPixelHUD } from "./HudTheme.js";

test("recolorir preserva luzes, sombras, cinzas e o alfa da arte", () => {
  for (const cor of [0x38bdf8, 0xff9b42, 0xff70b5, 0xb486ff]) {
    const pixels = new Uint8ClampedArray([0, 210, 200, 173, 30, 245, 236, 255,
      0, 50, 48, 200, 70, 70, 70, 255]);
    const original = pixels.slice();
    for (let i = 0; i < pixels.length; i += 4) colorirPixelHUD(pixels, i, cor);
    for (let i = 0; i < pixels.length; i += 4) {
      assert.equal(pixels[i + 3], original[i + 3]);
      assert.equal(Math.max(...pixels.slice(i, i + 3)), Math.max(...original.slice(i, i + 3)));
    }
    assert.deepEqual([...pixels.slice(12)], [70, 70, 70, 255]);
    assert.notDeepEqual(pixels.slice(0, 3), original.slice(0, 3));
  }
});

test("o contorno superior e direito da estamina recebe o tema mesmo fora do preenchimento", () => {
  const largura = 20, altura = 12;
  const pixels = new Uint8ClampedArray(largura * altura * 4);
  const estamina = { x: 6, y: 3, width: 12, height: 3 };
  const vida = { x: 6, y: 9, width: 12, height: 2 };
  const pontos = [[10, 2], [18, 4], [19, 4], [10, 6]];
  for (const [x, y] of [...pontos, [2, 2], [10, 4], [10, 8]]) {
    pixels.set([0, 35, 40, 180], (y * largura + x) * 4);
  }
  const original = pixels.slice();
  for (const cor of [0x38bdf8, 0xff9b42, 0xff70b5, 0xb486ff]) {
    pixels.set(original);
    colorirContornoEstaminaHUD(pixels, largura, altura, estamina, vida, cor);
    for (const [x, y] of pontos) {
      const i = (y * largura + x) * 4;
      assert.notDeepEqual(pixels.slice(i, i + 3), original.slice(i, i + 3));
      assert.equal(pixels[i + 3], original[i + 3]);
    }
    for (const [x, y] of [[2, 2], [10, 4], [10, 8]]) {
      const i = (y * largura + x) * 4;
      assert.deepEqual(pixels.slice(i, i + 4), original.slice(i, i + 4),
        "retratos, preenchimento original e região da vida não entram na máscara");
    }
  }
});

test("a moldura muda de cor sem tingir o retrato, seus detalhes ciano ou a barra de vida", () => {
  const largura = 64, altura = 32, limiteRetrato = 32;
  const pixels = new Uint8ClampedArray(largura * altura * 4);
  const put = (x, y, cor) => pixels.set(cor, (y * largura + x) * 4);
  for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) {
    if (x < limiteRetrato) put(x, y, [35, 30, 28, 255]);
    if (x >= limiteRetrato) put(x, y, [240, 10, 20, 255]);
    if (x >= 2 && x <= 29 && y >= 2 && y <= 29 &&
        (x === 2 || x === 29 || y === 2 || y === 29)) put(x, y, [0, 220, 210, 255]);
  }
  put(15, 15, [5, 190, 220, 255]);
  put(16, 15, [5, 190, 220, 140]);
  put(5, 15, [43, 100, 102, 255]);
  const original = pixels.slice();
  colorirMolduraHUD(pixels, largura, altura, limiteRetrato, 0xff9b42);
  assert.ok(pixels[(2 * largura + 2) * 4] > 200, "a moldura fica laranja");
  const roupa = (15 * largura + 5) * 4;
  assert.deepEqual(pixels.slice(roupa, roupa + 4), original.slice(roupa, roupa + 4),
    "o reflexo azulado da roupa junto à borda também permanece intacto");
  for (let y = 0; y < altura; y++) for (let x = 0; x < largura; x++) {
    const i = (y * largura + x) * 4;
    assert.equal(pixels[i + 3], original[i + 3]);
    if (x >= limiteRetrato || (x >= 10 && x <= 21 && y >= 10 && y <= 21)) {
      assert.deepEqual(pixels.slice(i, i + 4), original.slice(i, i + 4));
    }
  }
});
