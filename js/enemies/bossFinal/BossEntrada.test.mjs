import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { jogadorNaEntradaArena, prepararEntradaBoss } from "./BossEntrada.js";

globalThis.Phaser = { Scenes: { Events: { POST_UPDATE: "postupdate", SHUTDOWN: "shutdown" } } };

function criarCena() {
  const peca = {
    active: true, visible: true, body: { enable: true },
    x: -1093, y: -5905, width: 100, height: 100, originX: 0, originY: 0,
    getData: () => "ObjetosBoss",
    setVisible(visible) { this.visible = visible; },
  };
  return {
    player: { active: true, x: -1080, y: -5400 },
    events: new EventEmitter(), objetosMapaParte2: [peca],
  };
}

test("entrada usa os limites do zoom e exige jogador ativo", () => {
  for (const x of [-1606, -1080, -550]) {
    assert.equal(jogadorNaEntradaArena({ active: true, x, y: -5470 }), true);
  }
  for (const player of [null, { active: false, x: -1080, y: -5500 },
    { active: true, x: -1607, y: -5500 }, { active: true, x: -549, y: -5500 },
    { active: true, x: -1080, y: -5469 }]) {
    assert.equal(jogadorNaEntradaArena(player), false);
  }
});

test("não cria antes da entrada e cria uma única vez ao cruzar o gatilho", () => {
  const scene = criarCena();
  let criacoes = 0;
  prepararEntradaBoss(scene, (recebida) => { assert.equal(recebida, scene); criacoes++; });
  assert.equal(scene.objetosMapaParte2[0].visible, false);
  assert.equal(scene.objetosMapaParte2[0].body.enable, false);
  scene.events.emit("postupdate");
  assert.equal(criacoes, 0);
  scene.player.y = -5470;
  scene.events.emit("postupdate");
  assert.equal(criacoes, 1);
  assert.equal(scene.objetosMapaParte2[0].visible, true);
  assert.equal(scene.objetosMapaParte2[0].body.enable, true);
  scene.player.y = -5400;
  scene.events.emit("postupdate");
  scene.player.y = -5500;
  scene.events.emit("postupdate");
  assert.equal(criacoes, 1);
  assert.equal(scene.events.listenerCount("shutdown"), 0);
});

test("encerra o gatilho ao sair da cena e funciona em uma nova visita", () => {
  const scene = criarCena();
  prepararEntradaBoss(scene, () => assert.fail("boss criado depois do encerramento"));
  scene.events.emit("shutdown");
  scene.player.y = -5500;
  scene.events.emit("postupdate");
  assert.equal(scene.events.listenerCount("postupdate"), 0);
  let criacoes = 0;
  prepararEntradaBoss(scene, () => criacoes++);
  scene.events.emit("postupdate");
  assert.equal(criacoes, 1);
});
