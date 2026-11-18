import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { criarMissionManager, MISSION_FACTS_KEY, MISSION_POWER_KEY, MISSION_DOOR_KEYS } from "./MissionManager.js";
import { Inventory } from "../inventory/Inventory.js";
import { HACKING_KEYS as H } from "../puzzles/HackingConfig.js";

function registryFixture() {
  const data = new Map(), events = new EventEmitter();
  return {
    events, get: key => data.get(key),
    set(key, value) {
      const event = data.has(key) ? "changedata" : "setdata";
      data.set(key, value); events.emit(event, this, key);
    },
    remove(key) { data.delete(key); events.emit("removedata", this, key); },
  };
}
function start(key, registry = registryFixture(), progress) {
  const events = new EventEmitter(), views = [];
  const inventory = new Inventory({ slots: [], collectedItemIds: [] });
  const scene = { game: { registry }, events, inventory, sys: { settings: { key } } };
  if (progress) scene.coopRuntime = { manager: { room: { coopProgress: progress } } };
  criarMissionManager(scene, view => views.push(view));
  return { registry, events, views, inventory, view: () => views.at(-1),
    collect: (itemId, uid = `${key}:${itemId}`) => events.emit("inventario:coleta-confirmada", { itemId, uid }),
  };
}

test("dois recursos paralelos persistem, ignoram duplicatas e são limpos na nova campanha", () => {
  for (const order of [["bateria", "gasolina"], ["gasolina", "bateria"]]) {
    const city = start("Level1");
    city.collect(order[0]);
    assert.equal(city.view().id, "recursos");
    assert.equal(city.view().completed[order[0]], true);
    if (order[0] === "gasolina") {
      assert.equal(city.view().tasks.find(task => task.id === "galaoCheio")?.status, "active");
      assert.equal(city.view().tasks.find(task => task.id === "bateria")?.status, "available");
    } else {
      assert.ok(!city.view().tasks.some(task => task.id === "galaoCheio"));
    }
    const updates = city.views.length;
    city.collect(order[0]); city.collect("sucata");
    assert.equal(city.views.length, updates);
    city.collect(order[1]);
    assert.equal(city.view().id, "travessia");
    assert.deepEqual(city.view().tasks.map(task => task.id), ["galaoCheio"]);
    city.inventory.addItem("gasolina", 1);
    city.inventory.fillFuel(0.5);
    assert.equal(city.view().tasks[0].status, "active");
    city.inventory.fillFuel(0.5);
    assert.deepEqual(city.view().tasks.map(({ id, status }) => [id, status]), [
      ["galaoCheio", "completed"], ["fabrica", "active"],
    ]);
    city.events.emit("shutdown");
    assert.equal(city.registry.events.listenerCount("changedata"), 0);
    const factory = start("Level1Parte2", city.registry);
    assert.equal(factory.view().id, "energia");
    assert.equal(factory.view().completed[order[1]], true);
    factory.events.emit("shutdown");
    city.registry.remove(MISSION_FACTS_KEY);
    assert.equal(start("Level1", city.registry).view().id, "recursos");
  }
});

test("descobertas, encaixes e tentativas nunca substituem confirmações da campanha", () => {
  const s = start("Level1Parte2");
  assert.deepEqual(s.view().tasks.map(task => task.id), ["gerador"]);
  s.events.emit("gerador:aberto");
  assert.equal(s.view().completed.energia, false);
  s.events.emit("gerador:encaixes", { bateria: true, gasolina: true });
  assert.equal(s.view().tasks.find(task => task.id === "energia").status, "active");
  s.events.emit("gerador:encaixes", {});
  assert.ok(!s.view().tasks.some(task => task.id === "energia"));
  s.registry.set(MISSION_POWER_KEY, true);
  assert.equal(s.view().id, "seguranca");
  s.events.emit("hacking:terminal-aberto", "fabrica");
  assert.equal(s.view().completed.breach, false);
  s.registry.set(H.fabrica, true);
  assert.equal(s.view().id, "acesso");
  s.collect("card");
  s.events.emit("hacking:terminal-aberto", "bruteforce");
  s.registry.set(H.bruteforce, true);
  s.registry.set(H.cartao, true);
  assert.equal(s.view().id, "acesso");
  assert.equal(s.view().completed.porta, false);
  s.registry.set(MISSION_DOOR_KEYS[0], true);
  assert.equal(s.view().id, "sentinel");
  s.events.emit("novo-boss:derrotada");
  assert.equal(s.view().id, "virus");
  s.events.emit("hacking:terminal-aberto", "matrix");
  assert.equal(s.view().completed.virus, false);
  s.registry.set(H.final, true);
  assert.equal(s.view().id, "final");
});

test("checkpoint e progresso cooperativo convergem com coletas simultâneas e encaixes compartilhados", () => {
  const progress = { collected: {
    b: { itemId: "bateria", uid: "Level1:b", playerId: "a" },
    g: { itemId: "gasolina", uid: "Level1:g", playerId: "b" },
  }, flags: {}, generator: { slots: { bateria: { playerId: "a" } } } };
  const host = start("Level1Parte2", registryFixture(), progress);
  const late = start("Level1Parte2", registryFixture(), progress);
  assert.deepEqual(host.view(), late.view());
  assert.equal(late.view().completed.encaixeBateria, true);
  progress.generator.slots.gasolina = { playerId: "b" };
  progress.flags[MISSION_POWER_KEY] = true;
  progress.flags[H.fabrica] = true;
  for (const client of [host, late]) {
    client.events.emit("missao:progresso-coop");
    assert.equal(client.view().id, "acesso");
    const count = client.views.length;
    client.events.emit("missao:progresso-coop");
    assert.equal(client.views.length, count);
  }
  assert.deepEqual(host.view(), late.view());
});
