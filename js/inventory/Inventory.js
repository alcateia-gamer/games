import { getInventoryItem } from "./InventoryItems.js";

const INVENTORY_REGISTRY_KEY = "inventoriesByPlayer";
const MAX_INVENTORY_SLOTS = 20;

class Inventory {
  constructor(state, { maxSlots = MAX_INVENTORY_SLOTS } = {}) {
    if (!Number.isInteger(maxSlots) || maxSlots < 1) {
      throw new RangeError("A capacidade do inventário deve ser positiva.");
    }

    this.maxSlots = maxSlots;
    this.state = state;
    this.state.slots = Array.isArray(state.slots) ? state.slots : [];
    this.state.collectedItemIds = Array.isArray(state.collectedItemIds)
      ? state.collectedItemIds
      : [];
    this.listeners = new Set();
  }

  getSlots() {
    return this.state.slots.map((slot) => ({ ...slot }));
  }

  getQuantity(itemId) {
    return this.state.slots
      .filter((slot) => slot.itemId === itemId)
      .reduce((total, slot) => total + slot.quantity, 0);
  }

  getSlotCount() {
    return this.state.slots.length;
  }

  addItem(itemId, quantity = 1) {
    const definition = getInventoryItem(itemId);

    if (!definition || !Number.isInteger(quantity) || quantity < 1) {
      return false;
    }

    const currentSlots = this.state.slots.filter(
      (slot) => slot.itemId === itemId,
    );
    const availableInExistingSlots = currentSlots.reduce(
      (total, slot) => total + definition.maxStack - slot.quantity,
      0,
    );
    const remainingAfterExisting = Math.max(
      0,
      quantity - availableInExistingSlots,
    );
    const requiredSlots = Math.ceil(
      remainingAfterExisting / definition.maxStack,
    );

    if (this.state.slots.length + requiredSlots > this.maxSlots) {
      return false;
    }

    let remaining = quantity;

    for (const slot of currentSlots) {
      const added = Math.min(
        remaining,
        definition.maxStack - slot.quantity,
      );
      slot.quantity += added;
      remaining -= added;

      if (remaining === 0) break;
    }

    while (remaining > 0) {
      const added = Math.min(remaining, definition.maxStack);
      this.state.slots.push({ itemId, quantity: added });
      remaining -= added;
    }

    this.notifyChanged();
    return true;
  }

  removeItem(itemId, quantity = 1) {
    if (!Number.isInteger(quantity) || quantity < 1) {
      return 0;
    }

    let remaining = Math.min(quantity, this.getQuantity(itemId));
    const removed = remaining;

    for (let index = this.state.slots.length - 1; index >= 0; index -= 1) {
      const slot = this.state.slots[index];

      if (slot.itemId !== itemId) continue;

      const amount = Math.min(remaining, slot.quantity);
      slot.quantity -= amount;
      remaining -= amount;

      if (slot.quantity === 0) {
        this.state.slots.splice(index, 1);
      }

      if (remaining === 0) break;
    }

    if (removed > 0) {
      this.notifyChanged();
    }

    return removed;
  }

  hasCollected(itemId) {
    return this.state.collectedItemIds.includes(itemId);
  }

  markCollected(itemId) {
    if (this.hasCollected(itemId)) return false;

    this.state.collectedItemIds.push(itemId);
    return true;
  }

  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  destroy() {
    this.listeners.clear();
  }

  notifyChanged() {
    for (const listener of this.listeners) {
      listener(this.getSlots());
    }
  }
}

function obterInventarioDoJogador(scene) {
  const registry = scene.game.registry;
  const inventories = registry.get(INVENTORY_REGISTRY_KEY) ?? {};
  const playerId = scene.multiplayerManager?.playerId;
  const inventoryKey =
    typeof playerId === "string" && playerId.length > 0
      ? `player:${playerId}`
      : "player:local";

  if (!inventories[inventoryKey]) {
    inventories[inventoryKey] = { slots: [], collectedItemIds: [] };
    registry.set(INVENTORY_REGISTRY_KEY, inventories);
  }

  return new Inventory(inventories[inventoryKey]);
}

export {
  Inventory,
  MAX_INVENTORY_SLOTS,
  obterInventarioDoJogador,
};
