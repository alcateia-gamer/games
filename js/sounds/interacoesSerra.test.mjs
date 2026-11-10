import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { carregarSomColocando, tocarSomColocando } from "./colocando.js";
import { carregarSomAtaqueSerra, configurarSomAtaqueSerra } from "./ataqueSerra.js";

function fixture() {
  const chamadas = [];
  const som = { isPlaying: false, totalDuration: 1.573,
    play(...args) { this.isPlaying = true; chamadas.push(["play", ...args]); return true; },
    stop() { this.isPlaying = false; chamadas.push(["stop"]); },
    destroy() { chamadas.push(["destroy"]); },
    addMarker(m) { chamadas.push(["marker", m]); },
    setVolume(v) { chamadas.push(["volume", v]); },
    setPan(v) { chamadas.push(["pan", v]); },
    setRate(v) { chamadas.push(["rate", v]); },
    pause() { chamadas.push(["pause"]); }, resume() { chamadas.push(["resume"]); },
  };
  const scene = { events: new EventEmitter(), player: { x: 0, y: 0 },
    anims: { globalTimeScale: 1 }, cache: { audio: { exists: () => true } },
    sound: { add(key) { chamadas.push(["add", key]); return som; } } };
  const robo = Object.assign(new EventEmitter(), { active: true, tipoRobo: "serra", x: 0, y: 0,
    anims: { isPlaying: true, timeScale: 1, currentAnim: { key: "robo-serra-ataque-down" } } });
  return { scene, robo, chamadas };
}
const iniciar = robo => robo.emit("animationstart", robo.anims.currentAnim);
const ultimo = (chamadas, tipo) => chamadas.filter(c => c[0] === tipo).at(-1)?.[1];

test("os dois sons carregam arquivos reais", () => {
  for (const carregar of [carregarSomColocando, carregarSomAtaqueSerra]) carregar({
    audio(_key, path) { assert.ok(existsSync(new URL(`../../assets/${path}`, import.meta.url))); },
  });
});
test("feedback reutiliza uma voz, diferencia acesso e encaixe e limpa na saída", () => {
  const { scene, chamadas } = fixture();
  tocarSomColocando(scene, "acesso");
  assert.equal(ultimo(chamadas, "play").volume, 0.28);
  tocarSomColocando(scene, "encaixe");
  assert.equal(ultimo(chamadas, "play").volume, 0.55);
  assert.equal(chamadas.filter(c => c[0] === "add").length, 1);
  assert.equal(chamadas.filter(c => c[0] === "stop").length, 1);
  scene.events.emit("shutdown");
  assert.equal(chamadas.at(-1)[0], "destroy");
});
test("serra dispara o original inteiro sem alterar timbre e preserva a cauda", () => {
  const { scene, robo, chamadas } = fixture();
  configurarSomAtaqueSerra(scene, robo);
  robo.emit("animationstart", { key: "robo-down" });
  assert.equal(chamadas.length, 0);
  iniciar(robo);
  assert.equal(chamadas.some(c => c[0] === "marker"), false);
  assert.deepEqual(ultimo(chamadas, "play"), {
    volume: 0.45, loop: false, rate: 1, detune: 0, seek: 0,
  });
  // Nem a velocidade da animação altera a rotação original da serra.
  robo.anims.timeScale = 0.25;
  scene.events.emit("update", 100, 100);
  assert.equal(chamadas.some(c => c[0] === "rate"), false);
  scene.player.x = 350;
  scene.events.emit("update", 200, 100);
  assert.equal(ultimo(chamadas, "volume"), 0.1125);
  assert.ok(ultimo(chamadas, "pan") < 0);
  const paradas = chamadas.filter(c => c[0] === "stop").length;
  robo.anims.isPlaying = false;
  robo.emit("animationcomplete");
  scene.events.emit("update", 400, 200);
  assert.equal(chamadas.filter(c => c[0] === "stop").length, paradas,
    "fim da animação preserva a cauda do MP3");
  robo.emit("animationstop");
  assert.equal(chamadas.at(-1)[0], "stop");
  iniciar(robo);
  robo.morto = true;
  scene.events.emit("update", 400, 20);
  assert.equal(chamadas.at(-1)[0], "stop");
  robo.emit("destroy");
  assert.equal(chamadas.at(-1)[0], "destroy");
  assert.equal(scene.events.listenerCount("update"), 0);
  assert.equal(scene.events.listenerCount("shutdown"), 0);
});
test("serra distante fica silenciosa; pausa e saída encerram o áudio corretamente", () => {
  const { scene, robo, chamadas } = fixture();
  configurarSomAtaqueSerra(scene, robo);
  scene.player.x = 701;
  iniciar(robo);
  assert.equal(chamadas.length, 0);
  scene.player.x = 0; iniciar(robo);
  scene.events.emit("pause");
  assert.equal(chamadas.at(-1)[0], "pause");
  scene.events.emit("resume");
  assert.equal(chamadas.at(-1)[0], "resume");
  scene.events.emit("shutdown");
  assert.equal(chamadas.at(-1)[0], "destroy");
  assert.equal(robo.listenerCount("animationstart"), 0);
});

test("coleta cooperativa só toca após confirmar o item local, sem repetir na restauração", async () => {
  const { CoopWorld } = await import("../multiplayer/CoopWorld.js");
  const { Inventory } = await import("../inventory/Inventory.js");
  const { scene, chamadas } = fixture();
  scene.inventory = new Inventory({});
  scene.itensColetaveis = [];
  const world = Object.assign(Object.create(CoopWorld.prototype), {
    scene, manager: { playerId: "local" }, pending: new Set(["battery1"]),
  });
  const grant = { uid: "battery1", playerId: "local", itemId: "bateria", quantity: 1 };
  world.applyCollected(grant);
  assert.equal(chamadas.filter(c => c[0] === "play").length, 1);
  world.applyCollected(grant);
  world.applyCollected({ ...grant, uid: "restored" });
  world.pending.add("remote");
  world.applyCollected({ ...grant, uid: "remote", playerId: "other" });
  assert.equal(chamadas.filter(c => c[0] === "play").length, 1);
  scene.events.emit("shutdown");
});
