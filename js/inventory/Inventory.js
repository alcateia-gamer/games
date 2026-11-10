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
    // Cada galão tem seu próprio nível; pilhas de partidas anteriores são desmembradas.
    this.state.slots = this.state.slots.flatMap(slot => slot.itemId === "gasolina"
      ? Array.from({ length: slot.quantity }, () => ({ ...slot, quantity: 1,
        fuel: Number.isFinite(slot.fuel) ? Math.max(0, Math.min(1, slot.fuel)) : 0 }))
      : [slot]);
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
  getQuantity(itemId, { minFuel } = {}) {
    return this.state.slots
      .filter((slot) => slot.itemId === itemId &&
        (minFuel == null || (slot.fuel ?? 0) >= minFuel))
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
   * adiciona parcialmente. O nível inicial de combustível vale apenas para os novos galões.
   */
  addItem(itemId, quantity = 1, { fuel = 0 } = {}) {
    const definition = getInventoryItem(itemId);

    if (!definition || !Number.isInteger(quantity) || quantity < 1) {
      return false;
    }
    if (itemId === "gasolina" && (!Number.isFinite(fuel) || fuel < 0 || fuel > 1)) {
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
      this.state.slots.push({ itemId, quantity: added,
        ...(itemId === "gasolina" ? { fuel } : {}) });
      remaining -= added;
    }

    this.notifyChanged();
    return true;
  }

  /** Abastece um galão por vez; devolve seu nível ou null se não houver galão incompleto. */
  fillFuel(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const slot = this.state.slots.find(slot => slot.itemId === "gasolina" && slot.fuel < 1);
    if (!slot) return null;
    slot.fuel = Math.min(1, slot.fuel + amount);
    this.notifyChanged();
    return slot.fuel;
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

    for (const requirement of requirements) {
      if (
        typeof requirement?.itemId !== "string" ||
        !Number.isInteger(requirement.quantity) ||
        requirement.quantity < 1 ||
        (requirement.minFuel != null && (!Number.isFinite(requirement.minFuel) ||
          requirement.minFuel < 0 || requirement.minFuel > 1))
      ) {
        return false;
      }
    }

    // Reserva primeiro os slots que atendem aos requisitos mais restritos, sem consumir.
    const planned = new Map();
    for (const { itemId, quantity, minFuel } of [...requirements]
      .sort((a, b) => (b.minFuel ?? 0) - (a.minFuel ?? 0))) {
      let remaining = quantity;
      for (let index = this.state.slots.length - 1; index >= 0 && remaining > 0; index--) {
        const slot = this.state.slots[index];
        if (slot.itemId !== itemId || (minFuel != null && (slot.fuel ?? 0) < minFuel)) continue;
        const reserved = planned.get(slot) ?? 0;
        const amount = Math.min(remaining, slot.quantity - reserved);
        planned.set(slot, reserved + amount);
        remaining -= amount;
      }
      if (remaining > 0) return false;
    }

    for (const [slot, amount] of planned) slot.quantity -= amount;
    this.state.slots = this.state.slots.filter(slot => slot.quantity > 0);
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
