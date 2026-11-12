import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { CoopPlayers } from "./CoopPlayers.js";

globalThis.Phaser = { Scene: class {}, Events: { EventEmitter } };
const { default: MultiplayerManager } = await import("./multiplayerManager.js");
const { CoopRuntime } = await import("./CoopRuntime.js");

for (const [character, health, damage, stamina] of [
  ["kai-mercer", 100, 25, 120], ["magnus-force", 115, 33.3, 100],
  ["aria-kade", 85, 25, 140], ["nyx", 95, 28, 120],
]) {
  test(`${character}: host valida dano básico e não repete o mesmo acerto`, () => {
    const hits = [], boss = { active: true, visible: true, vida: 1000, x: 0, y: 0,
      hitboxDano: {}, receberDano(amount) { hits.push(amount); return true; } };
    const localContext = { novoBoss: boss }, context = { personagemSelecionada: character, player: { x: 0, y: 0 } };
    const runtime = Object.assign(Object.create(CoopRuntime.prototype), {
      scene: { inimigos: [] }, localContext, manager: { playerId: "host" }, combatId: () => "boss",
    });
    const payload = { target: "boss", amount: 99, basic: { id: 1, danoAria: 25 } };
    runtime.applyDamage(context, payload, "guest");
    runtime.applyDamage(context, payload, "guest");
    assert.deepEqual(hits, [damage]);
    if (character === "aria-kade") {
      runtime.applyDamage(context, { ...payload, basic: { id: 2, danoAria: 99 } }, "guest");
      assert.deepEqual(hits, [damage, 62.5], "preserva carga, limitada ao máximo atual");
    }
    runtime.applyDamage(context, { ...payload, amount: NaN }, "guest");
    assert.equal(hits.length, character === "aria-kade" ? 2 : 1);
  });

  test(`${character}: vida e estamina atravessam envio, host e réplica com tetos corretos`, () => {
    const manager = Object.assign(Object.create(MultiplayerManager.prototype), {
      playerId: "host", coopEnabled: true, emit() {},
    });
    const player = manager.normalizePlayer({ id: "guest", character });
    assert.deepEqual([player.health, player.maxHealth, player.stamina, player.maxStamina],
      [health, health, stamina, stamina]);
    manager.room = { hostId: "host", players: [player] };
    const scene = { vida: health - 10, vidaMaxima: health,
      estamina: stamina - 20, estaminaMaxima: stamina, player: {},
      multiplayerManager: manager };
    const players = new CoopPlayers({ scene, mapKey: "Level1", host: false });
    const state = players.localState();
    manager.receiveAction({ type: "game_state", playerId: "guest", clientId: "guest",
      x: 0, y: 0, ...state });
    const replica = manager.normalizePlayer(player);
    assert.deepEqual([replica.health, replica.maxHealth, replica.stamina, replica.maxStamina],
      [health - 10, health, stamina - 20, stamina]);
    manager.receiveAction({ type: "game_state", playerId: "guest", x: 0, y: 0,
      ...state, health: 999, maxHealth: 999, stamina: 999, maxStamina: 999 });
    assert.deepEqual([player.health, player.maxHealth, player.stamina, player.maxStamina],
      [health, health, stamina, stamina]);
  });
}
