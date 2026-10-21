/**
 * @file Estado do inventário: slots, pilhas, consumo atômico e objetos já coletados. O
 * registry mantém os dados por jogador entre as cenas.
 */

import { getInventoryItem } from "./InventoryItems.js";

const INVENTORY_REGISTRY_KEY = "inventoriesByPlayer";
const MAX_INVENTORY_SLOTS = 20;

class Inventory {
  /**
   * Valida a capacidade, aproveita o estado persistente recebido e prepara os assinantes de
   * alterações.
   */
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

  /**
   * Retorna cópias dos slots para impedir alterações diretas no estado interno pela interface.
   */
  getSlots() {
    return this.state.slots.map((slot) => ({ ...slot }));
  }

  /**
   * Soma a quantidade de um item em todas as suas pilhas.
   */
  getQuantity(itemId) {
    return this.state.slots
      .filter((slot) => slot.itemId === itemId)
      .reduce((total, slot) => total + slot.quantity, 0);
  }

  /**
   * Informa quantos slots estão ocupados no inventário.
   */
  getSlotCount() {
    return this.state.slots.length;
  }

  /**
   * Adiciona a quantidade inteira solicitada, reutilizando pilhas; se faltar espaço, não
   * adiciona parcialmente.
   */
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

    // A capacidade é verificada antes de alterar pilhas para evitar adição parcial.
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

  /**
   * Remove até a quantidade disponível, elimina pilhas vazias e retorna quanto foi removido.
   */
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

  /**
   * Valida todos os requisitos antes de consumir os itens, evitando um consumo parcial quando
   * falta algum recurso.
   */
  removeItems(requirements) {
    if (!Array.isArray(requirements) || requirements.length === 0) {
      return false;
    }

    const totalsByItem = new Map();

    for (const requirement of requirements) {
      if (
        typeof requirement?.itemId !== "string" ||
        !Number.isInteger(requirement.quantity) ||
        requirement.quantity < 1
      ) {
        return false;
      }

      totalsByItem.set(
        requirement.itemId,
        (totalsByItem.get(requirement.itemId) ?? 0) + requirement.quantity,
      );
    }

    // Primeiro verifica todos os saldos; só depois o próximo laço realiza o consumo.
    for (const [itemId, quantity] of totalsByItem) {
      if (this.getQuantity(itemId) < quantity) return false;
    }

    for (const [itemId, quantity] of totalsByItem) {
      let remaining = quantity;

      for (
        let index = this.state.slots.length - 1;
        index >= 0 && remaining > 0;
        index -= 1
      ) {
        const slot = this.state.slots[index];
        if (slot.itemId !== itemId) continue;

        const amount = Math.min(remaining, slot.quantity);
        slot.quantity -= amount;
        remaining -= amount;

        if (slot.quantity === 0) this.state.slots.splice(index, 1);
      }
    }

    this.notifyChanged();
    return true;
  }

  /**
   * Verifica se o identificador de um objeto do mapa já foi marcado como coletado.
   */
  hasCollected(itemId) {
    return this.state.collectedItemIds.includes(itemId);
  }

  /**
   * Registra um objeto coletado uma única vez para impedir sua reaparição ao retornar ao mapa.
   */
  markCollected(itemId) {
    if (this.hasCollected(itemId)) return false;

    this.state.collectedItemIds.push(itemId);
    return true;
  }

  /**
   * Assina alterações do inventário e retorna uma função que desfaz a assinatura.
   */
  onChange(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove os assinantes desta instância sem apagar o estado compartilhado do jogador.
   */
  destroy() {
    this.listeners.clear();
  }

  /**
   * Notifica os assinantes com uma cópia atualizada dos slots.
   */
  notifyChanged() {
    for (const listener of this.listeners) {
      listener(this.getSlots());
    }
  }
}

/**
 * Recupera ou cria o estado no registry, isolando o inventário pelo ID multiplayer ou pelo
 * jogador local.
 */
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
