/** Regressões do retorno ao comportamento anterior ao pacote de consumíveis. */
import assert from "node:assert/strict";
import test from "node:test";
import { atualizarStatusPlayer, gastarEstamina } from "./PlayerStatus.js";
import { getInventoryItem } from "../inventory/InventoryItems.js";

test("protótipos e personagens originais recuperam vida e stamina automaticamente", () => {
  for (const personagemSelecionada of ["personagem-teste", "personagem-teste-2", "kai-mercer", "aria-kade"]) {
    const scene = { personagemSelecionada, vida: 50, vidaMaxima: 100,
      estamina: 40, estaminaMaxima: 100, regeneracaoVida: 4, regeneracaoEstamina: 18,
      tempoSemDano: 4000, tempoSemDanoParaRegen: 4 };
    atualizarStatusPlayer(scene, 1000);
    assert.equal(scene.vida, 54); assert.equal(scene.estamina, 58);
    atualizarStatusPlayer(scene, 60000);
    assert.equal(scene.vida, 100); assert.equal(scene.estamina, 100);
  }
});

test("consumíveis revertidos não integram o catálogo ativo", () => {
  assert.equal(getInventoryItem("toxina-de-cura"), null);
  assert.equal(getInventoryItem("comprimidos-de-desempenho"), null);
  assert.ok(getInventoryItem("gasolina")); assert.ok(getInventoryItem("bateria"));
});

test("DEV recupera a stamina como antes, inclusive nos personagens de teste", () => {
  for (const personagemSelecionada of ["personagem-teste", "personagem-teste-2", "kai-mercer"]) {
    const scene = { personagemSelecionada, developerMode: true, estamina: 5, estaminaMaxima: 100 };
    assert.equal(gastarEstamina(scene, 25), true); assert.equal(scene.estamina, 100);
  }
});
