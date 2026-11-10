import test from "node:test";
import assert from "node:assert/strict";
import { Inventory, obterInventarioDoJogador } from "./Inventory.js";
import { GENERATOR_REQUIREMENTS, listarRecursosFaltantes } from "../interactions/FactoryGenerator.js";

const criar = () => new Inventory({ slots: [], collectedItemIds: [] });
const requisitos = () => GENERATOR_REQUIREMENTS.map(({ id, quantity, minFuel }) =>
  ({ itemId: id, quantity, minFuel }));

test("cada galão nasce vazio e tem nível próprio; abastecer não enche todos de uma vez", () => {
  const inventory = criar();
  inventory.addItem("gasolina", 2);
  assert.deepEqual(inventory.getSlots().map(s => s.fuel), [0, 0]);
  assert.equal(inventory.getQuantity("gasolina", { minFuel: 1 }), 0);
  assert.equal(inventory.fillFuel(0.4), 0.4);
  assert.equal(inventory.fillFuel(0.9), 1);
  assert.deepEqual(inventory.getSlots().map(s => s.fuel), [1, 0]);
  assert.equal(inventory.getQuantity("gasolina", { minFuel: 1 }), 1);
  assert.equal(inventory.fillFuel(0.25), 0.25);
  assert.deepEqual(inventory.getSlots().map(s => s.fuel), [1, 0.25]);
});

test("galão vazio ou parcial não libera o gerador e não consome a bateria", () => {
  const inventory = criar();
  inventory.addItem("gasolina");
  inventory.addItem("bateria");
  for (const amount of [0, 0.5, 0.499]) {
    inventory.fillFuel(amount);
    const antes = inventory.getSlots();
    assert.deepEqual(listarRecursosFaltantes(inventory).map(r => r.id), ["gasolina"]);
    assert.equal(inventory.removeItems(requisitos()), false);
    assert.deepEqual(inventory.getSlots(), antes);
  }
});

test("galões podem ser concedidos cheios sem alterar os existentes e notificam uma única vez", () => {
  const inventory = criar();
  inventory.addItem("gasolina");
  inventory.fillFuel(0.25);
  let notifications = 0;
  inventory.onChange(() => notifications++);
  assert.equal(inventory.addItem("gasolina", 2, { fuel: 1 }), true);
  assert.deepEqual(inventory.getSlots().map(slot => slot.fuel), [0.25, 1, 1]);
  assert.equal(notifications, 1);
  const antes = inventory.getSlots();
  for (const fuel of [-1, 2, NaN, Infinity]) {
    assert.equal(inventory.addItem("gasolina", 1, { fuel }), false);
  }
  assert.deepEqual(inventory.getSlots(), antes);
});

test("o gerador consome exatamente um galão cheio e uma bateria, preservando o parcial", () => {
  const inventory = criar();
  inventory.addItem("gasolina", 2);
  inventory.fillFuel(1);
  inventory.fillFuel(0.3);
  inventory.addItem("bateria");
  assert.deepEqual(listarRecursosFaltantes(inventory), []);
  let notifications = 0;
  inventory.onChange(() => notifications++);
  assert.equal(inventory.removeItems(requisitos()), true);
  assert.equal(notifications, 1);
  assert.deepEqual(inventory.getSlots(), [{ itemId: "gasolina", quantity: 1, fuel: 0.3 }]);
  assert.equal(inventory.removeItems(requisitos()), false);
});

test("pedidos repetidos não reservam o mesmo galão duas vezes e priorizam o requisito de cheio", () => {
  const inventory = criar();
  inventory.addItem("gasolina");
  inventory.fillFuel(1);
  const mixed = [{ itemId: "gasolina", quantity: 1 }, { itemId: "gasolina", quantity: 1, minFuel: 1 }];
  assert.equal(inventory.removeItems(mixed), false);
  assert.equal(inventory.getQuantity("gasolina"), 1);
  inventory.addItem("gasolina");
  assert.equal(inventory.removeItems(mixed), true);
  assert.equal(inventory.getQuantity("gasolina"), 0);
});

test("progresso parcial persiste ao trocar de cena e fica isolado por jogador", () => {
  const registry = new Map();
  const scene = playerId => ({ game: { registry }, multiplayerManager: { playerId } });
  const first = obterInventarioDoJogador(scene("a"));
  first.addItem("gasolina");
  first.fillFuel(0.37);
  first.destroy();
  const next = obterInventarioDoJogador(scene("a"));
  assert.equal(next.getSlots()[0].fuel, 0.37);
  assert.equal(obterInventarioDoJogador(scene("b")).getQuantity("gasolina"), 0);
});

test("pilhas antigas viram galões vazios individuais; níveis inválidos não escapam de 0 a 100%", () => {
  const inventory = new Inventory({ slots: [{ itemId: "gasolina", quantity: 2 },
    { itemId: "gasolina", quantity: 1, fuel: 10 }, { itemId: "gasolina", quantity: 1, fuel: -2 }] });
  assert.deepEqual(inventory.getSlots().map(s => s.fuel), [0, 0, 1, 0]);
  const antes = inventory.getSlots();
  for (const invalid of [0, -1, NaN, Infinity]) assert.equal(inventory.fillFuel(invalid), null);
  assert.deepEqual(inventory.getSlots(), antes);
});
