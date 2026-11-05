import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { Inventory } from "../inventory/Inventory.js";
import { prepararRecursosTeste, darItensIniciaisTeste, usarItemRecuperacaoTeste } from "./RecursosPersonagemTeste.js";
import { atualizarStatusPlayer } from "./PlayerStatus.js";
import { custoEstaminaArmaTeste } from "./PersonagemTeste.js";

function cena(id = "personagem-teste") {
  return { personagemSelecionada: id, player: { active: true }, events: new EventEmitter(),
    game: { registry: new Map() }, inventory: new Inventory({ slots: [], collectedItemIds: [] }),
    vida: 50, vidaMaxima: 100, estamina: 40, estaminaMaxima: 100, tempoSemDano: 0,
    tempoSemDanoParaRegen: 4, regeneracaoVida: 4, regeneracaoEstamina: 18 };
}

test("os dois personagens de teste não regeneram; personagens originais continuam regenerando", () => {
  for (const id of ["personagem-teste", "personagem-teste-2"]) {
    const s = cena(id); atualizarStatusPlayer(s, 60000);
    assert.equal(s.vida, 50); assert.equal(s.estamina, 40);
  }
  const s = cena("kai-mercer"); atualizarStatusPlayer(s, 60000);
  assert.equal(s.vida, 100); assert.equal(s.estamina, 100);
});

test("um item inicial de cada, recuperação de 20%/30% e consumo sem duplicar estoque", () => {
  const s = cena(); darItensIniciaisTeste(s); darItensIniciaisTeste(s);
  assert.equal(s.inventory.getQuantity("toxina-de-cura"), 1);
  assert.equal(s.inventory.getQuantity("comprimidos-de-desempenho"), 1);
  assert.equal(usarItemRecuperacaoTeste(s, "toxina-de-cura"), true);
  assert.equal(s.vida, 70); assert.equal(s.estamina, 40);
  assert.equal(usarItemRecuperacaoTeste(s, "comprimidos-de-desempenho"), true);
  assert.equal(s.estamina, 70);
  assert.equal(usarItemRecuperacaoTeste(s, "toxina-de-cura"), false);
  darItensIniciaisTeste(s); assert.equal(s.inventory.getQuantity("toxina-de-cura"), 0);
});

test("recuperação usa o máximo e não consome com barra cheia, morte ou menu aberto", () => {
  const s = cena(); darItensIniciaisTeste(s);
  s.vida = 100; assert.equal(usarItemRecuperacaoTeste(s, "toxina-de-cura"), false);
  assert.equal(s.inventory.getQuantity("toxina-de-cura"), 1);
  s.vida = 95; assert.equal(usarItemRecuperacaoTeste(s, "toxina-de-cura"), true); assert.equal(s.vida, 100);
  s.estaminaMaxima = 200; s.estamina = 100;
  s.generatorMenuOpen = true; assert.equal(usarItemRecuperacaoTeste(s, "comprimidos-de-desempenho"), false);
  s.generatorMenuOpen = false; s.vida = 0;
  assert.equal(usarItemRecuperacaoTeste(s, "comprimidos-de-desempenho"), false);
  s.vida = 20; assert.equal(usarItemRecuperacaoTeste(s, "comprimidos-de-desempenho"), true);
  assert.equal(s.estamina, 160);
  const original = cena("aria-kade"); darItensIniciaisTeste(original);
  assert.equal(original.inventory.getQuantity("toxina-de-cura"), 0);
  assert.equal(usarItemRecuperacaoTeste(original, "toxina-de-cura"), false);
});

test("trocar de cena preserva barras; outra personagem não recebe o estado do protótipo", () => {
  const s = cena(); prepararRecursosTeste(s); s.vida = 32; s.estamina = 17;
  s.events.emit("shutdown");
  const destino = cena(); destino.game = s.game;
  prepararRecursosTeste(destino);
  assert.equal(destino.vida, 32); assert.equal(destino.estamina, 17);
  const original = cena("kai-mercer"); original.game = s.game;
  prepararRecursosTeste(original); assert.equal(original.vida, 50); assert.equal(original.estamina, 40);
});

test("custo é individual por categoria e compartilhado com o HUD", () => {
  const s = cena();
  for (const tipo of ["espada", "florete"]) assert.equal(custoEstaminaArmaTeste(s, { tipo }), 1);
  assert.equal(custoEstaminaArmaTeste(s, {}), 3);
});
