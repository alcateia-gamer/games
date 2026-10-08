import test from "node:test";
import assert from "node:assert/strict";

import {
  obterConfiguracaoHitboxAtaque,
  obterConfiguracaoHitboxWalk,
} from "./index.mjs";

test("retorna a configuração de colisão de Kai Mercer", () => {
  assert.deepEqual(obterConfiguracaoHitboxWalk("kai-mercer"), {
    width: 30,
    height: 15,
    offsetX: 49,
    offsetY: 82,
  });
});

test("retorna configurações independentes para cada personagem", () => {
  assert.deepEqual(obterConfiguracaoHitboxWalk("magnus-force"), {
    width: 23,
    height: 11,
    offsetX: 21,
    offsetY: 47,
  });
  assert.deepEqual(obterConfiguracaoHitboxWalk("aria-kade"), {
    width: 30,
    height: 15,
    offsetX: 50,
    offsetY: 78,
  });
  assert.deepEqual(obterConfiguracaoHitboxWalk("nyx"), {
    width: 30,
    height: 15,
    offsetX: 18,
    offsetY: 45,
  });
});

test("retorna a configuração de colisão de ataque de cada personagem", () => {
  assert.deepEqual(obterConfiguracaoHitboxAtaque("kai-mercer"), {
    width: 30,
    height: 50,
    offsetX: 49,
    offsetY: 73,
  });
  assert.deepEqual(obterConfiguracaoHitboxAtaque("magnus-force"), {
    width: 23,
    height: 11,
    offsetX: 48,
    offsetY: 72,
  });
  assert.deepEqual(obterConfiguracaoHitboxAtaque("aria-kade"), {
    width: 30,
    height: 15,
    offsetX: 20,
    offsetY: 43,
  });
  assert.deepEqual(obterConfiguracaoHitboxAtaque("nyx"), {
    width: 30,
    height: 15,
    offsetX: 82,
    offsetY: 99,
  });
});
