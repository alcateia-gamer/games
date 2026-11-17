import { tocarSomColocando } from '../sounds/colocando.js';
import { findGeneratorInteraction, distanceToInteractionArea, GENERATOR_REQUIREMENTS } from '../interactions/FactoryGenerator.js';
export const GENERATOR_ESCROW_KEY = 'nullborns:generator-escrow';
const requirements = new Map(GENERATOR_REQUIREMENTS.map(r => [r.id, r]));

/** Inventário local reserva a peça; o host serializa os encaixes e a partida do motor. */
export class CoopGenerator {
  constructor(world) { this.world = world; this.lastSend = -Infinity; this.emptyState = { revision: 0, slots: {} }; }
  get runtime() { return this.world.r; }
  get scene() { return this.world.scene; }
  get manager() { return this.world.manager; }
  get state() { return this.manager.room.coopProgress.generator ?? this.emptyState; }
  get pending() { return this.scene.game.registry.get?.(GENERATOR_ESCROW_KEY)?.[this.manager.playerId]; }
  save(pending) {
    const registry = this.scene.game.registry;
    const all = { ...registry.get(GENERATOR_ESCROW_KEY) };
    if (pending) all[this.manager.playerId] = pending; else delete all[this.manager.playerId];
    registry.set(GENERATOR_ESCROW_KEY, all);
  }
  ready() { return [...requirements.keys()].every(id => this.state.slots[id]); }
  requestInstall(itemId) {
    const s = this.scene, requirement = requirements.get(itemId);
    if (!requirement || this.pending || this.state.slots[itemId] || s.luzFabricaAcesa) return false;
    // Retira somente do inventário do contribuinte. A reserva sobrevive à troca de cena/conexão.
    if (!s.inventory.removeItems([{ itemId, quantity: 1, minFuel: requirement.minFuel }])) return false;
    this.save({ itemId, operationId: `${this.manager.playerId}:generator:${Date.now()}:${Math.random().toString(36).slice(2)}` });
    this.lastSend = -Infinity; this.update(); return true;
  }
  requestStart() {
    if (!this.ready()) return false;
    return this.manager.sendCoopAction('generatorStart');
  }
  restore() {
    const pending = this.pending;
    if (!pending || !this.scene.inventory) return;
    const installed = this.state.slots[pending.itemId];
    if (installed?.operationId === pending.operationId && installed.playerId === this.manager.playerId) {
      this.save(null); tocarSomColocando(this.scene, 'encaixe'); return;
    }
    // Outro jogador venceu a disputa pelo encaixe: devolve a reserva, sem perder itens se a bolsa estiver cheia.
    if (installed || pending.refund) {
      if (this.scene.inventory.addItem(pending.itemId, 1, { fuel: pending.itemId === 'gasolina' ? 1 : 0 })) this.save(null);
      else if (!pending.refund) this.save({ ...pending, refund: true });
    }
  }
  update() {
    this.restore();
    const pending = this.pending;
    if (!pending || pending.refund || Date.now() - this.lastSend < 1500) return;
    this.lastSend = Date.now();
    if (!this.manager.sendCoopAction('generatorInstall', pending)) {
      this.save({ ...pending, refund: true }); this.restore();
    }
  }
  publish() {
    this.restore();
    this.world.applyFlags(this.manager.room.coopProgress.flags);
    this.manager.sendCoopAction('progressState', { progress: this.manager.room.coopProgress,
      devLighting: this.manager.room.coopDevLighting ?? null }, { authority: true });
    this.manager.publishState();
  }
  receive(action) {
    const p = action.payload || {};
    if (action.authority) {
      if (action.kind !== 'generatorRejected') return false;
      if (p.operationId && p.operationId === this.pending?.operationId) {
        this.save({ ...this.pending, refund: true }); this.restore();
      }
      this.scene.events.emit('generatorSharedResult', p.reason); return true;
    }
    if (!['generatorInstall', 'generatorStart'].includes(action.kind)) return false;
    if (!this.runtime.host) return true;
    const progress = this.manager.room.coopProgress;
    const reject = reason => {
      const payload = { operationId: p.operationId, reason };
      if (action.playerId === this.manager.playerId) this.receive({ authority: true, kind: 'generatorRejected', payload });
      else this.manager.sendCoopAction('generatorRejected', payload, { authority: true, targetId: action.playerId });
    };
    const requirement = requirements.get(p.itemId);
    const installed = this.state.slots[p.itemId];
    // Reenvio de uma reserva já aceita confirma o estado sem consumir outra peça.
    if (action.kind === 'generatorInstall' && installed?.operationId === p.operationId && installed.playerId === action.playerId) {
      this.publish(); return true;
    }
    const entry = this.runtime.players.remotes.get(action.playerId);
    const local = action.playerId === this.manager.playerId;
    const player = local ? this.scene.player : entry?.actor;
    const area = findGeneratorInteraction(this.scene.map).object;
    const center = player?.body?.center ?? player;
    if (this.runtime.mapKey !== 'Level1Parte2' || !area || !player?.active ||
        (local ? this.scene.morteEmAndamento || this.scene.vida <= 0 : entry?.data?.dead || entry?.health <= 0) ||
        !Number.isFinite(center.x) || !Number.isFinite(center.y) ||
        distanceToInteractionArea(center.x, center.y, area) > 48) {
      reject('Aproxime-se do gerador para conectar as peças.'); return true;
    }
    if (action.kind === 'generatorInstall') {
      if (!requirement || typeof p.operationId !== 'string' || !p.operationId.startsWith(`${action.playerId}:generator:`) ||
          p.operationId.length > 200 || installed || progress.flags.factoryGeneratorPowered) {
        reject('Encaixe já preenchido ou peça indisponível.'); return true;
      }
      progress.generator ??= { revision: 0, slots: {} };
      progress.generator.slots[p.itemId] = { operationId: p.operationId, playerId: action.playerId };
      progress.generator.revision++;
    } else {
      if (!this.ready()) { reject('Conecte a bateria e o galão cheio antes de ligar.'); return true; }
      if (!progress.flags.factoryGeneratorPowered) {
        progress.flags.factoryGeneratorPowered = true;
        progress.generatorStartedAt = Date.now();
      }
      this.manager.room.coopDevLighting = null;
    }
    this.publish(); return true;
  }
}
