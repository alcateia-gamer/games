import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { RecentActions } from "./CoopProtocol.js";
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
