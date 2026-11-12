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

const personagens = [
  ["kai-mercer", 100, 7, 6], ["magnus-force", 115, 6, 5],
  ["aria-kade", 85, 8, 7], ["nyx", 95, 8, 6],
];
for (const [personagemSelecionada, vida, solo, multi] of personagens)
for (const [nome, modo, ataques] of [
  ["single player", { multiplayer: false }, solo],
  ["multiplayer", { multiplayer: true }, multi],
  ["cooperativo", { multiplayer: true, coopRuntime: {} }, multi],
]) {
  test(`${personagemSelecionada} ${nome}: vida inicial e exatamente ${ataques} ataques`, () => {
    const scene = cena({ ...modo, personagemSelecionada });
    assert.equal(scene.vida, vida);
    assert.equal(scene.vidaMaxima, vida);
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
