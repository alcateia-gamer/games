import test from "node:test";
import assert from "node:assert/strict";

import {
  Inventory,
  obterInventarioDoJogador,
} from "./Inventory.js";
import {
  getInventoryItem,
  registerInventoryItem,
} from "./InventoryItems.js";

function registerTestItem(id, maxStack = 5) {
  return registerInventoryItem({
    id,
    name: id,
    image: `test-image-${id}`,
    maxStack,
  });
}

test("groups identical items and splits stacks at the item limit", () => {
  registerTestItem("inventory-test-stack", 5);
  const inventory = new Inventory({ slots: [], collectedItemIds: [] });

  assert.equal(inventory.addItem("inventory-test-stack", 7), true);
  assert.deepEqual(inventory.getSlots(), [
    { itemId: "inventory-test-stack", quantity: 5 },
    { itemId: "inventory-test-stack", quantity: 2 },
  ]);
  assert.equal(inventory.getQuantity("inventory-test-stack"), 7);
});

test("removes empty slots and notifies subscribers", () => {
  registerTestItem("inventory-test-remove", 5);
  const inventory = new Inventory({ slots: [], collectedItemIds: [] });
  let notifications = 0;
  inventory.onChange(() => {
    notifications += 1;
  });

  inventory.addItem("inventory-test-remove", 3);
  assert.equal(inventory.removeItem("inventory-test-remove", 3), 3);
  assert.deepEqual(inventory.getSlots(), []);
  assert.equal(notifications, 2);
});

test("removes multiple requirements atomically and notifies once", () => {
  const inventory = new Inventory({ slots: [], collectedItemIds: [] });
  let notifications = 0;
  inventory.onChange(() => {
    notifications += 1;
  });
  inventory.addItem("gasolina", 2);
  inventory.addItem("bateria", 1);
  notifications = 0;

  assert.equal(
    inventory.removeItems([
      { itemId: "gasolina", quantity: 1 },
      { itemId: "bateria", quantity: 1 },
    ]),
    true,
  );
  assert.equal(inventory.getQuantity("gasolina"), 1);
  assert.equal(inventory.getQuantity("bateria"), 0);
  assert.equal(notifications, 1);
});

test("does not partially remove multiple requirements when one is missing", () => {
  const inventory = new Inventory({ slots: [], collectedItemIds: [] });
  inventory.addItem("gasolina", 1);

  assert.equal(
    inventory.removeItems([
      { itemId: "gasolina", quantity: 1 },
      { itemId: "bateria", quantity: 1 },
    ]),
    false,
  );
  assert.equal(inventory.getQuantity("gasolina"), 1);
  assert.equal(inventory.getQuantity("bateria"), 0);
});

test("does not partially add an item when all 20 slots are occupied", () => {
  const slots = [];

  for (let index = 0; index < 20; index += 1) {
    const itemId = `inventory-test-full-${index}`;
    registerTestItem(itemId, 1);
    slots.push({ itemId, quantity: 1 });
  }

  registerTestItem("inventory-test-overflow", 1);
  const inventory = new Inventory({ slots, collectedItemIds: [] });

  assert.equal(inventory.addItem("inventory-test-overflow"), false);
  assert.equal(inventory.getSlotCount(), 20);
  assert.equal(inventory.getQuantity("inventory-test-overflow"), 0);
});

test("preserves collected object identifiers in shared player state", () => {
  const state = { slots: [], collectedItemIds: [] };
  const firstSceneInventory = new Inventory(state);

  assert.equal(firstSceneInventory.markCollected("Level1:object-12"), true);
  firstSceneInventory.destroy();

  const nextSceneInventory = new Inventory(state);
  assert.equal(nextSceneInventory.hasCollected("Level1:object-12"), true);
});

test("keeps inventory data isolated by multiplayer player ID", () => {
  const registryValues = new Map();
  const registry = {
    get(key) {
      return registryValues.get(key);
    },
    set(key, value) {
      registryValues.set(key, value);
    },
  };
  const firstPlayer = obterInventarioDoJogador({
    game: { registry },
    multiplayerManager: { playerId: "player-a" },
  });
  const secondPlayer = obterInventarioDoJogador({
    game: { registry },
    multiplayerManager: { playerId: "player-b" },
  });

  firstPlayer.addItem("sucata", 2);

  assert.equal(firstPlayer.getQuantity("sucata"), 2);
  assert.equal(secondPlayer.getQuantity("sucata"), 0);
});

test("registers gasoline with its image and supports collected quantities", () => {
  const gasoline = getInventoryItem("gasolina");
  const inventory = new Inventory({ slots: [], collectedItemIds: [] });

  assert.equal(gasoline.name, "Gasolina");
  assert.equal(gasoline.image.path, "COLETAVEIS/gasolina.png");
  assert.equal(gasoline.showQuantity, false);
  assert.equal(inventory.addItem("gasolina", 3), true);
  assert.equal(inventory.getQuantity("gasolina"), 3);
});

test("registers battery with its image and hides its stack quantity", () => {
  const battery = getInventoryItem("bateria");
  const inventory = new Inventory({ slots: [], collectedItemIds: [] });

  assert.equal(battery.name, "Bateria");
  assert.equal(battery.image.path, "COLETAVEIS/bateria.png");
  assert.equal(battery.showQuantity, false);
  assert.equal(inventory.addItem("bateria", 3), true);
  assert.equal(inventory.getQuantity("bateria"), 3);
});

test("shows stack quantities by default for other inventory items", () => {
  assert.equal(getInventoryItem("sucata").showQuantity, true);
  const item = registerTestItem("inventory-test-default-quantity");
  assert.equal(item.showQuantity, true);
});
