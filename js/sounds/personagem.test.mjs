import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { configurarSomCorrida, atualizarSomCorrida } from "./personagem.js";

globalThis.Phaser = { Scenes: { Events: { SHUTDOWN: "shutdown" } } };
function criarCena() {
  const reproducoes = [];
  const som = {
    isPlaying: false,
    play(config) { reproducoes.push(config); this.isPlaying = true; return true; },
    stop() { this.isPlaying = false; },
    destroy() { this.destruido = true; },
  };
  const scene = {
    time: { now: 100 }, input: { keyboard: new EventEmitter() }, events: new EventEmitter(),
    teclasWASD: Object.fromEntries([87, 65, 83, 68].map(keyCode => [keyCode, { keyCode }])),
    sound: { add(key, config) {
      assert.equal(key, "running");
      assert.deepEqual(config, { loop: true, volume: 0.3 });
      return som;
    } },
  };
  configurarSomCorrida(scene);
  return { scene, som, reproducoes };
}

test("toques curtos em WASD deixam o primeiro passo terminar a 30%", () => {
  const { scene, som, reproducoes } = criarCena();
  for (const keyCode of [87, 65, 83, 68]) {
    scene.input.keyboard.emit("keydown", { keyCode });
    atualizarSomCorrida(scene, false);
    assert.equal(som.isPlaying, true);
    scene.time.now += 179;
    atualizarSomCorrida(scene, false);
    assert.equal(som.isPlaying, true);
    scene.time.now++;
    atualizarSomCorrida(scene, false);
    assert.equal(som.isPlaying, false);
  }
  assert.equal(reproducoes.length, 4);
  assert.ok(reproducoes.every(config => config.volume === 0.3 && config.rate === undefined));
});

test("movimento contínuo e trocas rápidas de direção mantêm uma única reprodução original", () => {
  const { scene, som, reproducoes } = criarCena();
  atualizarSomCorrida(scene, true);
  for (let i = 0; i < 100; i++) {
    scene.time.now += 16;
    scene.input.keyboard.emit("keydown", { keyCode: [87, 65, 83, 68][i % 4] });
    scene.solicitarPasso();
    atualizarSomCorrida(scene, true);
  }
  assert.equal(reproducoes.length, 1);
  atualizarSomCorrida(scene, false);
  assert.equal(som.isPlaying, false);
});

test("bloqueios impedem o som e o encerramento libera o áudio", () => {
  const { scene, som, reproducoes } = criarCena();
  scene.movimentoBloqueado = true;
  scene.solicitarPasso();
  scene.input.keyboard.emit("keydown", { keyCode: 87 });
  assert.equal(reproducoes.length, 0);
  scene.movimentoBloqueado = false;
  scene.solicitarPasso();
  scene.morteEmAndamento = true;
  atualizarSomCorrida(scene, false);
  assert.equal(som.isPlaying, false);
  scene.events.emit("shutdown");
  assert.equal(som.destruido, true);
  assert.equal(scene.input.keyboard.listenerCount("keydown"), 0);
});
