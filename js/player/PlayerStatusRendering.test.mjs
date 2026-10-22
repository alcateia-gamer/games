import test from "node:test";
import assert from "node:assert/strict";
import { recuperarVida, gastarEstamina } from "./PlayerStatus.js";

test("HUD preserves its sharp textures and only redraws when a visible bar changes", t => {
  const previous = globalThis.Phaser;
  globalThis.Phaser = { Math: { Clamp: (n, min, max) => Math.max(min, Math.min(max, n)) } };
  t.after(() => { globalThis.Phaser = previous; });
  let redraws = 0;
  const context = { clearRect() { redraws++; }, drawImage() {}, save() {},
    restore() {}, beginPath() {}, rect() {}, clip() {} };
  const textures = { chave: "350x117", base: {}, vida: {}, estamina: {} };
  const scene = {
    vida: 100, vidaMaxima: 100, estamina: 100, estaminaMaxima: 100,
    hudStatus: { active: true, elemento: { width: 350, height: 117,
      getContext: () => context }, texturasDeTela: textures },
    hudStatusDados: { largura: 350, altura: 117,
      vida: { x: 100, y: 20, width: 200, height: 10 },
      estamina: { x: 100, y: 40, width: 200, height: 10 } },
  };
  recuperarVida(scene, 0);
  assert.equal(redraws, 1);
  for (let i = 0; i < 120; i++) recuperarVida(scene, 0);
  assert.equal(redraws, 1, "HUD parada não deve repintar a cada quadro");
  gastarEstamina(scene, 25);
  assert.equal(redraws, 2, "dash deve atualizar a barra imediatamente");
  scene.vida = 80;
  recuperarVida(scene, 0);
  assert.equal(redraws, 3);
  assert.equal(scene.hudStatus.texturasDeTela, textures, "preserva a resolução e o cache");
});
