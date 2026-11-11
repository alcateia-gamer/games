import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { VisualSender, VisualReceiver, mergePendingFrame, describeVisual, applyVisual } from "./CoopVisuals.js";
import { CoopWorld } from "./CoopWorld.js";
import FactoryLighting from "../effects/FactoryLighting.js";
import { BossReplica } from "./CoopBossReplica.js";

globalThis.Phaser = { Scene: class {}, Events: { EventEmitter } };
const { CoopRuntime } = await import("./CoopRuntime.js");

function visualScene() {
  const sprite = (x, y) => {
    const o = { active: true, type: "Sprite", x, y,
      setPosition(x, y) { Object.assign(this, { x, y }); return this; },
      destroy() { this.active = false; } };
    for (const key of ["setTexture", "setScale", "setRotation", "setDepth", "setAlpha",
      "setVisible", "setOrigin", "setFlip", "setBlendMode", "setTint"]) o[key] = () => o;
    return o;
  };
  return { add: { sprite }, textures: { exists: () => true, get: () => ({ has: () => true }) },
    multiplayerManager: { playerId: "client" }, player: { active: true, x: 70, y: 80 } };
}
const pose = { t: "Sprite", k: "nyx", f: 0, x: 10, y: 20, sx: 1, sy: 1, a: 1, v: true };

test("borda sem preenchimento não cobre a barra vermelha na réplica", () => {
  const scene = visualScene(), border = scene.add.sprite(10, 20);
  Object.assign(border, { type: "Rectangle", width: 60, height: 6, isFilled: false, isStroked: true,
    fillColor: 0xffffff, fillAlpha: 1, lineWidth: 1, strokeColor: 0xffffff, strokeAlpha: 0.7 });
  const state = describeVisual(border);
  border.setFillStyle = () => { border.isFilled = true; };
  border.setStrokeStyle = () => { border.isStroked = true; };
  border.setSize = (w, h) => { border.width = w; border.height = h; };
  applyVisual(scene, border, state, false);
  assert.equal(border.isFilled, false);
  assert.equal(border.isStroked, true);
  applyVisual(scene, border, { ...state, w: 30, fill: 0xe52b2b, filled: true, stroked: false }, false);
  assert.equal(border.width, 30);
  assert.equal(border.isFilled, true);
  assert.equal(border.isStroked, false);
});

test("fim do flash restaura multiplicação mesmo se a cor continuar branca", () => {
  const scene = visualScene(), object = scene.add.sprite(0, 0);
  object.tintTopLeft = 0xffffff;
  object.setTint = () => { object.tintFill = false; };
  object.setTintFill = () => { object.tintFill = true; };
  applyVisual(scene, object, { ...pose, tint: 0xffffff, tf: true });
  assert.equal(object.tintFill, true);
  applyVisual(scene, object, { ...pose, tint: 0xffffff, tf: false });
  assert.equal(object.tintFill, false);
});

test("efeitos presos ao personagem acompanham a posição local sem interpolação adicional", () => {
  const s = visualScene(), receiver = new VisualReceiver(s);
  receiver.receive({ full: true, removed: [], changed: [{ id: "aura", s: {
    ...pose, x: 15, y: 32, anchor: { id: "client", x: 10, y: 20 } } }] });
  receiver.update(16);
  assert.equal(receiver.get("aura").x, 75);
  assert.equal(receiver.get("aura").y, 92);
  s.player.x += 120;
  receiver.update(16);
  assert.equal(receiver.get("aura").x, 195);
});

test("keyframe recria sprite destruído e elimina tiros ausentes", () => {
  const receiver = new VisualReceiver(visualScene());
  receiver.receive({ full: true, removed: [], changed: [{ id: "enemy", s: pose }, { id: "shot", s: pose }] });
  const old = receiver.get("enemy"); old.destroy();
  receiver.receive({ full: true, removed: [], changed: [{ id: "enemy", s: pose }] });
  assert.notEqual(receiver.get("enemy"), old);
  assert.equal(receiver.get("enemy").active, true);
  assert.equal(receiver.get("shot"), undefined);
});

test("delta cuja criação se perdeu não cria objeto com estado incompleto", () => {
  const receiver = new VisualReceiver(visualScene());
  receiver.receive({ full: false, removed: [], changed: [{ id: "enemy", s: { x: 120 } }] });
  assert.equal(receiver.entries.size, 0);
});

test("keyframe substitui metadados antigos de um efeito", () => {
  const receiver = new VisualReceiver(visualScene());
  receiver.receive({ full: true, removed: [], changed: [{ id: "effect", s: {
    ...pose, anchor: { id: "client", x: 10, y: 20 } } }] });
  receiver.receive({ full: true, removed: [], changed: [{ id: "effect", s: pose }] });
  assert.equal(receiver.entries.get("effect").state.anchor, undefined);
});

test("compressão lenta preserva criação, movimento e remoção dos quadros agrupados", () => {
  const sender = new VisualSender(), receiver = new VisualReceiver(visualScene());
  const shot = { active: true, type: "Image", x: 10, y: 20, texture: { key: "shot" }, frame: { name: 0 } };
  const frame = sequence => ({ sequence, mapKey: "Level1", streamId: "visit-1", visuals: sender.capture([shot]) });
  let queued = frame(1);
  shot.x = 40;
  queued = mergePendingFrame(queued, frame(2));
  receiver.receive(queued.visuals);
  assert.equal(receiver.entries.size, 1);
  assert.equal([...receiver.entries.values()][0].object.x, 40);
  shot.active = false;
  queued = mergePendingFrame(queued, frame(3));
  receiver.receive(queued.visuals);
  assert.equal(receiver.entries.size, 0);
});

test("agrupamento mantém keyframe completo e separa visitas ao mesmo mapa", () => {
  const base = { streamId: "old", mapKey: "Level1", visuals: { full: true,
    changed: [{ id: "a", s: pose }], removed: [] } };
  const next = { ...base, visuals: { full: false, changed: [{ id: "a", s: { x: 45 } }], removed: [] } };
  assert.equal(mergePendingFrame(base, next).visuals.full, true);
  assert.equal(mergePendingFrame(base, next).visuals.changed[0].s.k, "nyx");
  assert.equal(mergePendingFrame(base, { ...next, streamId: "new" }).visuals.full, false);
});

function worldFixture() {
  const sent = [], registry = { events: new EventEmitter(), set() {} };
  const camera = { zoom: 0.8, zoomX: 0.8, zoomY: 0.8, roundPixels: false,
    once(event, fn) { this.complete = fn; },
    fadeOut() { this.complete(); },
    setZoom(x, y = x) { this.zoom = this.zoomX = x; this.zoomY = y; return this; },
    centerOn() {}, stopFollow() {}, startFollow(target) { this.target = target; } };
  const scene = { map: {}, game: { registry }, registry, events: new EventEmitter(), children: { list: [] },
    player: { active: true, x: 0, y: 0, setVelocity() {}, anims: { pause() {}, resume() {} } },
    input: { enabled: true, keyboard: { enabled: true, resetKeys() {} } },
    cameras: { main: camera }, scene: { start(key, data) { scene.started = { key, data }; } } };
  const manager = { playerId: "client", room: { coopProgress: { flags: {}, collected: {} } },
    sendCoopAction(...args) { sent.push(args); return true; } };
  const runtime = { scene, manager, mapKey: "Level1", inArena: () => true };
  return { scene, manager, sent, world: new CoopWorld(runtime) };
}

test("primeira gravação de energia também publica progresso e aplicação remota não ecoa", () => {
  const { scene, sent, world } = worldFixture();
  scene.game.registry.events.emit("setdata", null, "factoryGeneratorPowered", true);
  assert.equal(sent[0][0], "progress");
  scene.game.registry.set = (key, value) => scene.game.registry.events.emit("changedata", null, key, value);
  world.applyFlags({ factoryGeneratorPowered: true });
  assert.equal(sent.length, 1);
  world.destroy();
  assert.equal(scene.game.registry.events.listenerCount("setdata"), 0);
});

test("DEV do cliente permite destino do boss mesmo com DEV desligado no host", () => {
  const { scene, manager, world } = worldFixture();
  manager.playerId = "host"; manager.publishState = () => {};
  const actor = { active: true, x: 0, y: 0 };
  world.r.host = true;
  world.r.players = { remotes: new Map([["client", { actor, data: { coop: { developer: true } } }]]) };
  world.receive({ playerId: "client", kind: "map", payload: { key: "Level1Parte2", from: "Level1", boss: true } });
  assert.equal(scene.started.key, "Level1Parte2");
  assert.equal(scene.started.data.spawnX, -1085);
  assert.equal(scene.started.data.spawnY, -5169);
  assert.equal(scene.started.data.developerMode, false, "DEV continua individual");
  world.destroy();
});

test("DEV pode apagar luz compartilhada mesmo depois do gerador confirmado", () => {
  const { scene, manager, world } = worldFixture();
  world.r.mapKey = "Level1Parte2";
  scene.luzFabricaAcesa = true;
  scene.definirIluminacaoFabrica = on => { scene.energy = on; };
  manager.room.coopDevLighting = false;
  world.applyFlags({ factoryGeneratorPowered: true });
  assert.equal(scene.luzFabricaAcesa, false);
  assert.equal(scene.energy, false);
  world.applyFlags({ factoryGeneratorPowered: true });
  assert.equal(scene.luzFabricaAcesa, false, "restauração não desfaz o comando DEV");
  manager.room.coopDevLighting = true;
  world.applyFlags();
  assert.equal(scene.luzFabricaAcesa, true);
  world.destroy();
});

test("acionar o gerador novamente encerra a iluminação DEV e recupera o estado normal", () => {
  const { scene, manager, world, sent } = worldFixture();
  world.r.mapKey = "Level1Parte2"; world.r.host = true;
  manager.publishState = () => {};
  manager.room.coopDevLighting = false;
  scene.acenderLuzFabrica = () => { scene.luzFabricaAcesa = true; };
  world.generatorProgress();
  assert.equal(sent[0][0], "progress");
  world.receive({ kind: sent[0][0], playerId: manager.playerId, payload: sent[0][1] });
  assert.equal(manager.room.coopDevLighting, null);
  assert.equal(manager.room.coopProgress.flags.factoryGeneratorPowered, true);
  assert.equal(scene.luzFabricaAcesa, true);
  world.destroy();
});

test("transição registra o fade antes de começar e não repete uma viagem antiga", () => {
  const { scene, manager, world } = worldFixture();
  world.applyMap({ key: "Level1Parte2", x: 98, y: -1040, id: 2 });
  assert.equal(scene.started.key, "Level1Parte2");
  assert.equal(manager.coopMapAppliedId, 2);
  world.transitioning = false; scene.started = null;
  world.receiveMap({ key: "Level1Parte2", x: 98, y: -1040, id: 1 });
  assert.equal(scene.started, null);
  world.destroy();
});

test("fim da cutscene restaura zoom, câmera, input e bloqueio de movimento", () => {
  const { scene, world } = worldFixture();
  world.receiveFrame({ introCamera: { x: 150, y: 100, zoom: 0.5 } });
  assert.equal(scene.input.enabled, false);
  assert.equal(scene.movimentoBloqueado, true);
  world.receiveFrame({ introCamera: null });
  assert.equal(scene.cameras.main.zoom, 0.8);
  assert.equal(scene.cameras.main.target, scene.player);
  assert.equal(scene.input.enabled, true);
  assert.equal(scene.input.keyboard.enabled, true);
  assert.equal(scene.movimentoBloqueado, false);
  world.destroy();
});

test("perda de quadro pede keyframe, ignora deltas incompletos e recupera o mundo", () => {
  const r = Object.create(CoopRuntime.prototype), applied = [], requests = [];
  Object.assign(r, { mapKey: "Level1", scene: {}, host: false,
    manager: { playerId: "client", sendCoopAction: kind => requests.push(kind) },
    receiver: { receive: v => applied.push(v), get() {}, destroy() {} },
    replica: { receive() {}, destroy() {} }, revival: { receive() {} }, world: { receiveFrame() {} } });
  const packet = (sequence, full) => ({ sequence, streamId: "visit", mapKey: "Level1",
    visuals: { full, changed: [], removed: [] }, players: [], targets: [] });
  r.receiveFrame(packet(1, true));
  r.receiveFrame(packet(3, false));
  r.receiveFrame(packet(4, false));
  assert.deepEqual(requests, ["keyframe"]);
  assert.equal(applied.length, 1);
  r.receiveFrame(packet(5, true));
  assert.equal(applied.length, 2);
  assert.equal(r.awaitingKeyframe, false);
});

test("piscadas do gerador usam o perfil do host mesmo com relógios de cena diferentes", () => {
  const make = () => new FactoryLighting({ getObjectLayer: () => ({ objects: [] }) },
    { aleatorio: () => 0.5, avisar() {} });
  const host = make(), client = make();
  host.estados = [{ indice: 0, luz: {}, falha: host.criarFalha(1000) }];
  client.estados = [{ indice: 0, luz: {}, falha: null }];
  client.aplicarEstadoRede(host.snapshotRede(1200), 5200);
  for (const elapsed of [0, 400, 800, 1600, 2200]) {
    assert.equal(client.calcularFalha(client.estados[0], 5200 + elapsed),
      host.calcularFalha(host.estados[0], 1200 + elapsed));
  }
  assert.equal(client.coopReplica, true);
  host.estados[0].falha = null;
  client.aplicarEstadoRede(host.snapshotRede(1500), 5500);
  assert.equal(client.estados[0].falha, null);
});

test("sair do mapa encerra a réplica do boss e libera referências para a próxima visita", () => {
  const scene = {}, replica = new BossReplica({ scene });
  const encounter = scene.novoBoss = replica.encounter = { encerrado: false };
  replica.shield = { destroy() {} };
  replica.shieldCollision = { destruir() {} };
  replica.destroy();
  assert.equal(encounter.encerrado, true);
  assert.equal(scene.novoBoss, null);
  assert.equal(replica.shield, null);
  assert.equal(replica.shieldCollision, null);
  replica.destroy();
});


test("música acompanha o host mesmo quando o cliente ainda está no mapa anterior", () => {
  const recebidas = [];
  const runtime = { host: false, mapKey: "Level1", music: { receive: (...args) => recebidas.push(args) } };
  const music = { key: "musica-fabrica" };
  CoopRuntime.prototype.receiveFrame.call(runtime, { mapKey: "Level1Parte2", music, streamId: "fabrica" });
  assert.deepEqual(recebidas, [[music, "fabrica"]]);
});

test("equipe não troca de mapa para contornar o resgate de um aliado caído", () => {
  const { scene, manager, world } = worldFixture();
  manager.playerId = "host"; manager.publishState = () => {};
  world.r.host = true;
  world.r.players = { remotes: new Map([["client", {
    actor: { active: true, x: 0, y: 0 }, data: { coop: { developer: true } },
  }]]) };
  world.r.revival = { participants: () => [{ dead: true }] };
  world.receive({ playerId: "client", kind: "map", payload: { key: "Level1Parte2", from: "Level1", boss: true } });
  assert.equal(scene.started, undefined);
  assert.equal(world.transitioning, false);
  world.destroy();
});
