import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { criarStatusPlayer, gastarEstamina, atualizarStatusPlayer } from "./PlayerStatus.js";

globalThis.Phaser = { Scenes: { Events: { POST_UPDATE: "postupdate", SHUTDOWN: "shutdown" } } };

function cena(modo) {
  const load = Object.assign(new EventEmitter(), { image() {}, isLoading: () => false, start() {} });
  const scene = { ...modo, events: new EventEmitter(), load, textures: { exists: () => false } };
  criarStatusPlayer(scene);
  return scene;
}

for (const [nome, modo, ataques] of [
  ["single player", { multiplayer: false }, 8],
  ["multiplayer", { multiplayer: true }, 5],
  ["cooperativo", { multiplayer: true, coopRuntime: {} }, 5],
]) {
  test(`${nome}: barra cheia permite exatamente ${ataques} ataques e regenera até o teto`, () => {
    const scene = cena(modo);
    assert.equal(scene.estamina, scene.estaminaMaxima);
    assert.equal(scene.custoAtaque, 20);
    for (let i = 0; i < ataques; i++) assert.equal(gastarEstamina(scene, scene.custoAtaque), true);
    assert.equal(scene.estamina, 0);
    assert.equal(gastarEstamina(scene, scene.custoAtaque), false);
    scene.atacando = true;
    atualizarStatusPlayer(scene, 1000);
    assert.equal(scene.estamina, 0, "não regenera durante o ataque");
    scene.atacando = false;
    atualizarStatusPlayer(scene, 1000);
    assert.equal(scene.estamina, 18);
    atualizarStatusPlayer(scene, 60000);
    assert.equal(scene.estamina, ataques * 20);
    scene.events.emit("shutdown");
  });
}
