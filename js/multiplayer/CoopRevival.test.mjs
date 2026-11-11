import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { CoopRevival, carregarQuedasCoop, REVIVE_MS } from "./CoopRevival.js";

globalThis.Phaser = { Scene: class {}, Events: { EventEmitter } };
const { CoopRuntime } = await import("./CoopRuntime.js");

function fixture(host = true) {
  const sent = [], revived = [], animations = [];
  const actor = (x, y) => ({ x, y, active: true });
  const label = () => {
    const o = { destroy() { this.destroyed = true; } };
    for (const key of ["setOrigin", "setDepth", "setPosition", "setText"]) o[key] = (...args) => { o[key + "Args"] = args; return o; };
    return o;
  };
  const scene = { vida: 100, vidaMaxima: 100, estaminaMaxima: 100, personagemSelecionada: "kai-mercer",
    player: actor(0, 0), add: { text: label }, anims: { exists: () => false,
      create: a => animations.push(a), generateFrameNumbers: (k, c) => [k, c] } };
  const p = scene.player;
  for (const key of ["setVelocity", "setTexture", "setOrigin", "setDisplayOrigin", "setRotation", "setAlpha", "clearTint"]) p[key] = (...args) => { p[key + "Args"] = args; return p; };
  p.setPosition = (x, y) => { Object.assign(p, { x, y }); return p; };
  p.anims = { stop() {}, play(k) { this.key = k; } };
  p.body = { enable: true, setSize() {}, setOffset() {}, updateFromGameObject() {} };
  const entry = { actor: actor(50, 0), health: 0, data: { id: "ally", dead: true, coop: { downId: "down-1" } } };
  const runtime = { host, scene, players: { remotes: new Map([["ally", entry]]) },
    manager: { playerId: "self", sendCoopAction: (...args) => sent.push(args) },
    revivePlayer: id => revived.push(id) };
  return { runtime, scene, entry, sent, revived, animations, system: new CoopRevival(runtime) };
}
const advance = (s, ms) => { for (let i = 0; i < ms; i += 100) s.update(100); };

test("carrega seis quadros de queda para os quatro operadores", () => {
  const loaded = [];
  carregarQuedasCoop({ spritesheet: (...args) => loaded.push(args) });
  assert.equal(loaded.length, 4);
  assert.ok(loaded.every(a => a[2].frameWidth === 64 && a[2].frameHeight === 64));
});

test("caído espera indefinidamente; aliado próximo revive uma vez após três segundos", () => {
  const f = fixture(); f.scene.player.x = 500;
  advance(f.system, 10000); assert.equal(f.sent.length, 0);
  f.scene.player.x = 0;
  advance(f.system, REVIVE_MS - 100); assert.equal(f.sent.length, 0);
  f.system.update(100);
  assert.deepEqual(f.sent[0], ["revive", { downId: "down-1" }, { authority: true, targetId: "ally" }]);
  advance(f.system, 5000); assert.equal(f.sent.length, 1, "não reenvia resgate enquanto aguarda confirmação");
});

test("afastar-se interrompe resgate e jogador morto não pode ajudar", () => {
  const f = fixture(); advance(f.system, 2000);
  f.scene.player.x = 500; f.system.update(100);
  f.scene.player.x = 0; advance(f.system, 2000); assert.equal(f.sent.length, 0);
  f.scene.morteEmAndamento = true; f.scene.vida = 0;
  advance(f.system, 5000); assert.equal(f.sent.length, 0);
});

test("cliente não decide resgate; host também pode ser revivido por aliado", () => {
  const client = fixture(false); advance(client.system, 10000); assert.equal(client.sent.length, 0);
  const f = fixture();
  f.scene.morteEmAndamento = true; f.scene.vida = 0; f.scene.coopDownId = "host-down";
  f.entry.data.dead = false; f.entry.health = 100;
  advance(f.system, REVIVE_MS); assert.deepEqual(f.revived, ["host-down"]);
  const labels = [...f.system.labels.values()];
  f.system.destroy(); assert.ok(labels.every(l => l.destroyed));
});

test("nova queda aceita novo resgate sem reutilizar o progresso anterior", () => {
  const f = fixture(); advance(f.system, REVIVE_MS); assert.equal(f.sent.length, 1);
  f.entry.data.coop.downId = "down-2";
  f.system.update(100); assert.equal(f.sent.length, 1);
  advance(f.system, REVIVE_MS - 100); assert.equal(f.sent.length, 2);
  assert.equal(f.sent[1][1].downId, "down-2");
});

test("host encerra somente quando toda a sala morreu, incluindo aliados em outro mapa", () => {
  const f = fixture(), r = f.runtime;
  r.manager.room = { players: [{ id: "self" }, { id: "ally", health: 0, dead: true },
    { id: "other-map", mapKey: "Level1Parte2", health: 100 }] };
  let ended = 0;
  r.finishTeamGame = () => { r.teamDefeated = true; ended++; };
  const check = () => CoopRuntime.prototype.checkTeamDefeat.call(r);
  assert.equal(check(), false, "host vivo mantém a partida");
  f.scene.vida = 0; f.scene.morteEmAndamento = true;
  assert.equal(check(), false, "aliado vivo em outro mapa mantém a partida");
  r.manager.room.players[2].health = 0;
  r.host = false;
  assert.equal(check(), false, "cliente não decide a derrota");
  r.host = true;
  assert.equal(check(), true);
  assert.deepEqual(f.sent, [["teamDefeated", {}, { authority: true }]]);
  assert.equal(check(), false);
  assert.equal(ended, 1);
});

test("derrota recebida abre uma única tela mesmo para jogador já caído e bloqueia resgate", () => {
  const f = fixture(false), r = f.runtime, s = f.scene;
  s.morteEmAndamento = true; s.vida = 0; s.coopDownId = "down";
  s.events = new EventEmitter();
  globalThis.Phaser.Scenes = { Events: { PRE_RENDER: "prerender", SHUTDOWN: "shutdown" } };
  s.cameras = { main: { width: 800, height: 450, zoom: 1, originX: 0.5, originY: 0.5 } };
  let paused = 0, overlays = 0;
  s.physics = { pause() { paused++; } };
  s.time = { delayedCall() {} };
  const visual = () => {
    const obj = { scene: s, add() {} };
    for (const k of ["setDepth", "setScrollFactor", "setInteractive", "setPosition", "setScale", "setOrigin", "setAlpha"]) obj[k] = () => obj;
    return obj;
  };
  s.add = { rectangle: visual, text: visual, container() { overlays++; return visual(); } };
  r.revival = f.system;
  r.finishTeamGame = () => CoopRuntime.prototype.finishTeamGame.call(r);
  const receive = action => CoopRuntime.prototype.receiveAction.call(r, action);
  receive({ kind: "teamDefeated", authority: false });
  assert.equal(overlays, 0);
  receive({ kind: "teamDefeated", authority: true });
  receive({ kind: "teamDefeated", authority: true });
  assert.equal(r.teamDefeated, true);
  assert.equal(s.telaMorteMostrada, true);
  assert.equal(s.movimentoBloqueado, true);
  assert.equal(overlays, 1); assert.equal(paused, 1);
  assert.equal(CoopRuntime.prototype.revivePlayer.call(r, "down"), false);
});

test("morte toca animação sem timer de retorno e resgate restaura no lugar da queda", () => {
  for (const personagem of ["kai-mercer", "magnus-force", "aria-kade", "nyx"]) {
  const f = fixture(), r = f.runtime, s = f.scene;
  r.revivePlayer = id => CoopRuntime.prototype.revivePlayer.call(r, id);
  s.personagemSelecionada = personagem;
  s.player.x = 200; s.player.y = -300; s.respawnX = 10; s.respawnY = 20;
  s.time = { delayedCall() { assert.fail("não deve existir retorno automático"); } };
  CoopRuntime.prototype.downPlayer.call(r);
  assert.equal(s.morteEmAndamento, true); assert.equal(s.player.body.enable, false);
  assert.equal(s.player.anims.key, `coop-down-${personagem}`);
  assert.equal(f.animations[0].repeat, 0);
  assert.deepEqual(f.animations[0].frames[1], { start: 0, end: 5 });
  const id = s.coopDownId;
  assert.equal(r.revivePlayer("queda-antiga"), false);
  assert.equal(r.revivePlayer(id), true);
  assert.equal(s.player.x, 200); assert.equal(s.player.y, -300);
  assert.equal(s.morteEmAndamento, false); assert.equal(s.player.body.enable, true);
  assert.equal(s.vida, 100); assert.equal(s.player.setTextureArgs[0], { "kai-mercer": "walk", "magnus-force": "personagem2-walk", "aria-kade": "personagem3-walk", nyx: "personagem4-walk" }[personagem]);
  assert.equal(r.revivePlayer(id), false, "resgate duplicado não cura outra vez");
  }
});
