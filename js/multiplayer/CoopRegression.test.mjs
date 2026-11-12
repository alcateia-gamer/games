import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { VisualSender, VisualReceiver, mergePendingFrame, describeVisual, applyVisual } from "./CoopVisuals.js";
import { CoopPlayers, playerVisualObjects } from "./CoopPlayers.js";
import { CoopRevival } from "./CoopRevival.js";
import { Inventory } from "../inventory/Inventory.js";
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

test("cliente mantém sala do boss apagada antes do spawn e durante recuperação de rede", () => {
  const arena = { xMin: 0, xMax: 200, yMin: -400, yMax: 0, entradaY: 0 };
  const scene = { map: { getObjectLayer: () => null }, novoBossConfig: { arena } };
  const runtime = { scene, host: false, mapKey: "Level1Parte2" };
  const replica = new BossReplica(runtime);
  const espera = scene.iluminacaoEntradaBossReplica;
  const dentro = { x: 40, y: -160, neon: true }, fora = { x: 400, y: -160, neon: true };
  assert.equal(espera.fatorLuz(dentro), 0);
  assert.equal(espera.fatorLuz(fora), 1);
  assert.equal(espera.ambiente, 0);
  replica.receive(null);
  replica.destroy();
  assert.equal(scene.iluminacaoEntradaBossReplica, espera, "perder o stream não acende a sala");
  runtime.disposed = true;
  replica.destroy();
  assert.equal(scene.iluminacaoEntradaBossReplica, null);
});

test("estado de espera do cliente não interfere na iluminação do host", () => {
  const scene = {};
  new BossReplica({ scene, host: true, mapKey: "Level1Parte2" });
  assert.equal(scene.iluminacaoEntradaBossReplica, undefined);
});


test("dash do aliado replica flash, duas camadas do rastro e desaparecimento sem duplicar no host", () => {
  const scene = visualScene();
  const visual = (type, x, y, alpha = 1) => ({
    ...scene.add.sprite(x, y), type, alpha, depth: 16.49, scaleX: 1, scaleY: 1, rotation: 0,
    originX: 0.5, originY: 0.5,
  });
  const arrow = visual("Sprite", 100, 200);
  const rastro = visual("Container", 80, 200, 0.7);
  const sombra = visual("Image", 0, 0, 0.62), brilho = visual("Image", 0, 0, 0.17);
  for (const layer of [arrow, sombra, brilho]) {
    layer.texture = { key: "walk" };
    layer.frame = { name: 18, cutX: 0, cutY: 0, cutWidth: 128, cutHeight: 128 };
  }
  sombra.tintTopLeft = 0x2376c7;
  brilho.tintTopLeft = 0x31c8ff; brilho.blendMode = 1;
  sombra.parentContainer = brilho.parentContainer = rastro;
  rastro.list = [sombra, brilho];
  const flash = Object.assign(visual("Arc", 90, 200, 0.5), {
    radius: 15, fillColor: 0x00bfff, fillAlpha: 0.1,
    strokeColor: 0x00bfff, strokeAlpha: 0.55, lineWidth: 2, isFilled: true, isStroked: true,
  });
  scene.projeteisPlayer = { getChildren: () => [arrow] };
  scene.estadoDash = { rastros: new Set([rastro]), efeitos: new Set([flash]) };
  const source = playerVisualObjects(scene);
  assert.deepEqual(source, [arrow, rastro, sombra, brilho, flash]);
  const sender = new VisualSender(), packet = sender.capture(source, true);
  const payload = object => packet.changed.find(n => n.id === sender.id(object)).s;
  assert.equal(payload(sombra).parent, sender.id(rastro));
  assert.equal(payload(brilho).parent, sender.id(rastro));
  assert.equal(payload(brilho).blend, 1);
  assert.equal(payload(sombra).tint, 0x2376c7);
  assert.equal(payload(brilho).tint, 0x31c8ff);
  assert.equal(payload(flash).stroke, 0x00bfff);
  const remote = visualScene();
  remote.add.container = (x, y) => Object.assign(remote.add.sprite(x, y), {
    type: "Container", list: [], add(child) { this.list.push(child); child.parentContainer = this; },
  });
  remote.add.circle = (x, y) => Object.assign(remote.add.sprite(x, y), { type: "Arc", setRadius() {} });
  const receiver = new VisualReceiver(remote);
  receiver.receive(packet);
  assert.equal(receiver.get(sender.id(rastro)).list.length, 2);
  assert.equal(receiver.get(sender.id(brilho)).parentContainer, receiver.get(sender.id(rastro)));
  rastro.alpha = 0.2;
  receiver.receive(sender.capture(playerVisualObjects(scene), true));
  assert.equal(receiver.entries.get(sender.id(rastro)).state.a, 0.2, "o fade local chega ao aliado");
  const enemy = visual("Sprite", 300, 200);
  scene.children = { list: [arrow, rastro, flash, enemy] };
  const world = CoopRuntime.prototype.worldObjects.call({ scene, baseline: new Set(),
    players: { objects: () => [], effects: new Map() } });
  assert.deepEqual(world, [enemy], "o mesmo dash não é reenviado como objeto do mundo");
  scene.estadoDash.rastros.clear(); scene.estadoDash.efeitos.clear();
  receiver.receive(sender.capture(playerVisualObjects(scene), true));
  assert.equal(receiver.entries.size, 1, "terminar o dash remove todas as réplicas temporárias");
  assert.ok(receiver.get(sender.id(arrow)));
});

test("gerador ligado bloqueia o retorno à cidade sem remover a regra de resgate", () => {
  const { world, manager, scene, sent } = worldFixture();
  world.r.host = true; world.r.mapKey = "Level1Parte2";
  manager.room.coopProgress.flags.factoryGeneratorPowered = true;
  Object.assign(scene.player, { x: 95, y: -916 });
  world.receive({ kind: "map", playerId: manager.playerId,
    payload: { from: "Level1Parte2", key: "Level1" } });
  assert.equal(world.transitioning, false);
  assert.equal(scene.started, undefined);
  assert.equal(sent.length, 0);
  world.destroy();
});


test("host atualiza repetidamente com CoopWorld real sem erros e continua publicando os quadros", () => {
  const { world, scene, manager } = worldFixture();
  const runtime = Object.setPrototypeOf(world.r, CoopRuntime.prototype);
  Object.assign(scene, { vida: 100, time: { now: 0 }, direcaoAtual: "down", personagemSelecionada: "kai-mercer" });
  manager.room.players = [{ id: manager.playerId, health: 100 }];
  let inputs = 0, frames = 0;
  manager.sendPlayerState = () => { inputs++; };
  manager.publishCoopFrame = () => { frames++; };
  Object.assign(runtime, { host: true, world, localContext: scene,
    players: new CoopPlayers(runtime), revival: new CoopRevival(runtime),
    music: { update() {}, snapshot: () => null }, sender: new VisualSender(), baseline: new Set(),
    lastInput: -Infinity, lastFrame: -Infinity, lastKeyframe: -Infinity,
    forceKeyframe: true, metrics: { frames: 0, bytes: 0, maxBytes: 0 } });
  for (let frame = 0; frame < 120; frame++) {
    scene.time.now = frame * 16;
    assert.doesNotThrow(() => runtime.update(scene.time.now, 16));
  }
  assert.ok(inputs > 0);
  assert.ok(frames > 0);
  assert.equal(runtime.metrics.frames, frames);
  runtime.revival.destroy(); world.destroy();
});

function prepararDrops(scene) {
  scene.sys = { settings: { key: "Level1" } };
  scene.inventory = new Inventory({ slots: [], collectedItemIds: [] });
  scene.itensColetaveis = [];
  scene.textures = { exists: () => true, getFrame: () => ({ cutWidth: 16, cutHeight: 16 }) };
  const visual = (x, y) => Object.assign(new EventEmitter(), {
    x, y, active: true, displayHeight: 28,
    setDisplaySize() { return this; }, setDepth() { return this; },
    setPosition(x, y) { Object.assign(this, { x, y }); return this; },
    fillStyle() { return this; }, fillRect() { return this; },
    destroy() { this.active = false; this.emit("destroy"); },
  });
  scene.add = { image: visual, graphics: () => visual(0, 0) };
  scene.tweens = { add() {}, killTweensOf() {} };
}

test("itens de uma queda chegam pela ação ou snapshot uma única vez e conservam combustível na coleta", () => {
  const { world, scene, manager, sent } = worldFixture();
  world.r.host = true;
  prepararDrops(scene);
  manager.room.players = [{ id: "ally", coop: {} }];
  manager.publishState = () => {};
  const drop = { id: "ally:1", mapKey: "Level1", x: 0, y: 0,
    slots: [{ itemId: "gasolina", quantity: 1, fuel: 0.75 }, { itemId: "bateria", quantity: 1 }] };
  world.receive({ kind: "inventoryDrop", playerId: "ally", payload: { drop } });
  assert.equal(scene.itensColetaveis.length, 2);
  manager.room.players[0].coop.inventoryDrop = drop;
  world.syncInventoryDrops(); world.restore();
  assert.equal(scene.itensColetaveis.length, 2, "ação, snapshots e restauração não duplicam os itens");
  assert.equal(sent.filter(a => a[0] === "progressState").length, 1);
  world.receive({ kind: "pickup", playerId: manager.playerId, payload: { uid: "drop:ally:1:0" } });
  assert.equal(scene.inventory.getSlots()[0].fuel, 0.75);
  world.restore();
  assert.equal(scene.itensColetaveis.length, 1, "restaurar progresso não recria o item já coletado");
  const next = { ...drop, id: "ally:2" };
  manager.room.players[0].coop.inventoryDrop = next;
  world.syncInventoryDrops();
  assert.equal(scene.itensColetaveis.length, 3, "o snapshot recupera uma ação de queda perdida");
  world.destroy();
});

test("drop local do host é publicado e cliente solicita o drop sem autoridade própria", () => {
  const { world, scene, manager, sent } = worldFixture();
  world.r.host = true; prepararDrops(scene); manager.publishState = () => {};
  const drop = { id: `${manager.playerId}:1`, mapKey: "Level1", x: 0, y: 0,
    slots: [{ itemId: "bateria", quantity: 1 }] };
  assert.equal(world.dropInventory(drop), true);
  assert.equal(scene.itensColetaveis.length, 1);
  assert.equal(world.dropInventory(drop), false);
  world.r.host = false;
  world.dropInventory({ ...drop, id: `${manager.playerId}:2` });
  assert.equal(sent.at(-1)[0], "inventoryDrop");
  assert.equal(scene.itensColetaveis.length, 1);
  world.destroy();
});
