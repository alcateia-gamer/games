import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { RecentActions, mergeCoopProgress } from "./CoopProtocol.js";
import { VisualSender } from "./CoopVisuals.js";
globalThis.Phaser = { Events: { EventEmitter } };
const { default: Manager } = await import("./multiplayerManager.js");

function pair() {
  const transports = [], sent = [];
  class MQTT extends EventEmitter {
    constructor(id) { super(); this.clientId = id; transports.push(this); }
    connect() {} subscribe() {} unsubscribe() {}
    disconnect() { this.disconnected = true; }
    publish(topic, value, options) {
      const data = structuredClone({ ...value, clientId: this.clientId });
      sent.push({ topic, data, options });
      for (const peer of transports) peer.emit("message", topic, data);
      return true;
    }
  }
  const host = new Manager(new MQTT("host")), client = new Manager(new MQTT("client"));
  host.roomTopic = client.roomTopic = "room/TEST";
  host.room = { roomCode: "TEST", hostId: "host", status: "PLAYING", players: [
    host.normalizePlayer({ id: "host", character: "kai-mercer" }),
    host.normalizePlayer({ id: "client", character: "nyx" })], enemies: [] };
  host.publishState(); host.enableCoop(); client.enableCoop(); sent.length = 0;
  return { host, client, sent };
}

test("entradas de jogadores não provocam broadcast da sala por comando", () => {
  const { host, client, sent } = pair();
  for (let i = 0; i < 20; i++) client.sendPlayerState(i, 10, "right", true, false, "right", 0, "normal", [], { mapKey: "Level1", health: 100 });
  assert.equal(sent.filter(s => s.topic.endsWith("/state")).length, 0);
  assert.equal(host.room.players[1].x, 19);
  host.publishCoopFrame({ mapKey: "Level1", visuals: { full: true, changed: [], removed: [] } });
  assert.equal(sent.filter(s => s.topic.endsWith("/frame")).length, 1);
  assert.equal(client.room.players[1].x, 19);
});

test("snapshot atrasado não apaga progresso já confirmado nem reinicia o gerador", () => {
  const { host, client } = pair();
  const progress = { flags: { factoryGeneratorPowered: true }, generatorStartedAt: 1000,
    collected: { fuel: { uid: "fuel", playerId: "client" } } };
  client.room.coopProgress = progress;
  const stale = { flags: {}, collected: {} };
  assert.deepEqual(mergeCoopProgress(progress, stale), progress);
  client.receiveState({ ...host.room, revision: host.room.revision + 1, coopProgress: stale });
  assert.deepEqual(client.room.coopProgress, progress);
});

test("frames e sala recebidos provam presença do host sem regredir o heartbeat", () => {
  const { host, client } = pair();
  host.room.players.forEach(p => { p.lastSeen = 1; });
  const receivedAt = Date.now();
  host.publishCoopFrame({ mapKey: "Level1" });
  assert.ok(client.room.players.find(p => p.id === "host").lastSeen >= receivedAt);
  const heartbeat = Date.now();
  client.room.players.find(p => p.id === "client").lastSeen = heartbeat;
  client.receiveState({ ...host.room, revision: host.room.revision + 1 });
  assert.ok(client.room.players.find(p => p.id === "host").lastSeen >= receivedAt);
  assert.equal(client.room.players.find(p => p.id === "client").lastSeen, heartbeat);
});

test("host atualiza sua entrada local sem viagem ao broker e ignora estado parado repetido", () => {
  const { host, sent } = pair();
  assert.equal(host.sendPlayerState(10, 20, "down", false, false, "down", 0, "normal", [], { health: 100 }), true);
  assert.equal(host.sendPlayerState(10, 20, "down", false, false, "down", 0, "normal", [], { health: 100 }), false);
  assert.equal(host.room.players[0].x, 10);
  assert.equal(sent.length, 0);
});

test("quadros atrasados e remetentes sem autoridade não substituem o mundo", () => {
  const { host, client } = pair();
  host.publishCoopFrame({ mapKey: "Level1", value: 1 });
  host.publishCoopFrame({ mapKey: "Level1", value: 2 });
  client.receiveCoopFrame({ ...client.coopWorld, sequence: 1, value: 0 });
  assert.equal(client.coopWorld.value, 2);
  client.receiveCoopFrame({ ...client.coopWorld, clientId: "client", sequence: 9, value: 99 });
  assert.equal(client.coopWorld.value, 2);
});

test("ações confiáveis são deduplicadas e só o host pode curar/ferir outro jogador", () => {
  const { host, client, sent } = pair(); let actions = 0, heals = 0;
  host.on("coopAction", () => actions++); client.on("coopAction", () => heals++);
  client.sendCoopAction("damage", { target: "boss", amount: 25 });
  const action = sent.at(-1).data;
  host.receiveAction(action); assert.equal(actions, 1);
  assert.equal(sent.at(-1).options.qos, 1);
  assert.equal(client.sendCoopAction("heal", {}, { authority: true }), false);
  host.sendCoopAction("heal", { amount: 5 }, { authority: true, targetId: "client" });
  assert.equal(heals, 1);
});

test("identidades têm memória limitada e entradas inválidas são recusadas", () => {
  const ids = new RecentActions(2);
  assert.equal(ids.accept("one"), true); assert.equal(ids.accept("one"), false);
  ids.accept("two"); ids.accept("three"); assert.equal(ids.ids.size, 2);
  assert.equal(ids.accept("x".repeat(161)), false);
  const { host } = pair();
  host.receiveAction({ type: "game_state", playerId: "client", x: Infinity, y: 2 });
  assert.equal(host.room.players[1].x, -490);
});

test("destruição do gerenciador encerra a conexão MQTT", () => {
  const { host } = pair();
  host.destroy();
  assert.equal(host.mqtt.disconnected, true);
});

test("carregamento do mapa tem tolerância antes de expulsar um jogador sem heartbeat", t => {
  const { host } = pair(); let tick;
  t.mock.method(globalThis, "setInterval", callback => { tick = callback; return 1; });
  host.startHeartbeat();
  host.room.players[1].lastSeen = Date.now() - 20000;
  host.coopTransitionUntil = Date.now() + 60000;
  tick();
  assert.equal(host.room.players.length, 2);
  host.coopTransitionUntil = Date.now() - 1;
  tick();
  assert.equal(host.room.players.length, 1);
  host.stopHeartbeat();
});

test("sprites estáticos não são reenviados; mudanças, remoção e keyframes reconstroem o estado", () => {
  const sender = new VisualSender();
  const object = { active: true, type: "Image", x: 10, y: 20, scaleX: 1, scaleY: 1,
    rotation: 0, alpha: 1, depth: 50, texture: { key: "boss" },
    frame: { name: 0, cutX: 0, cutY: 0, cutWidth: 64, cutHeight: 64 } };
  const first = sender.capture([object]); assert.equal(first.changed.length, 1);
  assert.equal(sender.capture([object]).changed.length, 0);
  object.x = 12; const delta = sender.capture([object]);
  assert.deepEqual(delta.changed[0].s, { x: 12 });
  assert.equal(sender.capture([object], true).changed[0].s.k, "boss");
  assert.deepEqual(sender.capture([]).removed, [first.changed[0].id]);
});


test("quadros atrasados não apagam os itens derrubados já confirmados", () => {
  const progress = { flags: {}, collected: {}, inventoryDrops: { "host:1": { id: "host:1" } } };
  const stale = { flags: {}, collected: {}, inventoryDrops: {} };
  assert.deepEqual(mergeCoopProgress(progress, stale).inventoryDrops, progress.inventoryDrops);
  assert.equal(Object.keys(mergeCoopProgress(progress, { inventoryDrops: { "ally:1": { id: "ally:1" } } }).inventoryDrops).length, 2);
});

test("preparação do boss sobrevive ao preload sem runtime e snapshots atrasados não desfazem a barreira", () => {
  const { host, client } = pair();
  host.room.coopMap = { id: 1, key: "Level1Parte2" }; host.publishState();
  const first = { roomCode: "TEST", mapId: 1, id: "TEST:1:tentativa", revision: 1,
    phase: "loading", participants: ["host", "client"], clients: {} };
  host.sendCoopAction("bossPreparation", { preparation: first }, { authority: true });
  assert.equal(client.room.coopBossPreparation.id, first.id, "sem cena consumidora o Manager guarda a autorização");
  const next = { ...first, revision: 2, phase: "assembling", entrada: { id: first.id,
    jogadores: { host: { x: -1100, y: -5408 }, client: { x: -1036, y: -5408 } } } };
  host.publishCoopFrame({ mapKey: "Level1Parte2", bossPreparation: next });
  assert.equal(client.room.coopBossPreparation.revision, 2);
  client.receiveState({ ...host.room, revision: host.room.revision + 1, coopBossPreparation: first });
  assert.equal(client.room.coopBossPreparation.phase, "assembling");
  host.sendCoopAction("bossPreparation", { preparation: { ...next, roomCode: "OTHER", revision: 99 } }, { authority: true });
  assert.equal(client.room.coopBossPreparation.revision, 2);
  client.sendCoopAction("bossPreparation", { preparation: { ...next, revision: 100 } });
  assert.equal(host.room.coopBossPreparation.revision, 1, "cliente não escreve a revisão autoritativa");
});

test("host desconectado sai da barreira e o sucessor preserva a preparação sem nova tentativa", t => {
  const { host, client } = pair(); let tick;
  const preparation = { roomCode: "TEST", mapId: 1, id: "TEST:1:mesma", revision: 3,
    phase: "loading", participants: ["host", "client"], clients: { client: { session: "client-session", status: "ready" } } };
  host.room.coopMap = { id: 1, key: "Level1Parte2" };
  host.room.coopBossPreparation = preparation; host.publishState();
  // Host some do transporte; só o heartbeat do sucessor é executado.
  host.mqtt.removeAllListeners("message");
  t.mock.method(globalThis, "setInterval", callback => { tick = callback; return 1; });
  client.startHeartbeat();
  client.coopTransitionUntil = 0;
  client.room.players.find(p => p.id === "host").lastSeen = Date.now() - 20000;
  tick(); client.stopHeartbeat();
  assert.equal(client.room.hostId, "client");
  assert.ok(!client.room.players.some(p => p.id === "host"));
  assert.equal(client.room.coopBossPreparation.id, preparation.id);
  assert.equal(client.room.coopBossPreparation.clients.client.status, "ready");
});
