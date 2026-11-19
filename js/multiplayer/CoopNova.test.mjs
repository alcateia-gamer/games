import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { CoopNova } from "./CoopNova.js";
import { VisualSender, VisualReceiver } from "./CoopVisuals.js";
import { criarFalaFlutuante } from "../ui/PlayerSpeechBubble.js";
import { prepararPetNoTerminal } from "../interactions/HackingPetDock.js";
import { createHollowSession } from "./HollowSession.js";

globalThis.Phaser = {
  Events: { EventEmitter }, Scenes: { Events: { POST_UPDATE: "postupdate", SHUTDOWN: "shutdown" } },
  Math: {
    Distance: { Between: (x, y, a, b) => Math.hypot(x - a, y - b) },
    Angle: { Wrap: x => x }, Between: () => 0,
    Clamp: (value, min, max) => Math.max(min, Math.min(max, value)),
    Linear: (x, y, t) => x + (y - x) * t,
  },
  Geom: { Rectangle: class { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } } },
};
const { default: MultiplayerManager } = await import("./multiplayerManager.js");

function visual(x = 0, y = 0, key, frame = 0) {
  const object = Object.assign(new EventEmitter(), { active: true, visible: true, type: "Sprite",
    depth: 0, scaleX: 1, scaleY: 1, rotation: 0, alpha: 1, x, y,
    setPosition(a, b) { Object.assign(this, { x: a, y: b }); return this; },
    setDepth(depth) { this.depth = depth; return this; },
    setScale(scale) { this.scaleX = this.scaleY = scale; return this; },
    setVisible(visible) { this.visible = visible; return this; },
    setName(name) { this.name = name; return this; },
    setFrame(name) { this.frame = { name }; return this; },
    setTexture(k, f) { this.texture = { key: k }; return this.setFrame(f); },
    setText(text) { this.text = text; return this; },
    setFixedSize(width, height) { this.width = width; this.height = height; return this; },
    getTopCenter() { return { x: this.x, y: this.y - 24 }; },
    destroy() { this.active = false; this.emit("destroy"); },
  });
  for (const method of ["setData", "setOrigin", "setRotation", "setAlpha", "setFlip", "setBlendMode",
    "setTint", "setColor", "clear", "fillStyle", "fillRoundedRect", "fillTriangle", "lineStyle",
    "strokeRoundedRect"]) object[method] = () => object;
  return key ? object.setTexture(key, frame) : object;
}

function peer(host, x = 0) {
  const physicsSprites = [], text = [];
  const scene = { player: { active: true, x, y: 0 }, multiplayer: true, map: { layers: [] },
    events: new EventEmitter(), time: { now: 0, delayedCall() { return { remove() {} }; } },
    add: { sprite: visual, text() { const label = visual(); text.push(label); return label; }, graphics: visual },
    textures: { exists: () => true, get: () => ({ has: () => true }) },
    anims: { exists: () => false, create() {}, generateFrameNumbers: () => [] },
    physics: { add: { sprite(x, y, key) {
      const sprite = visual(x, y, key);
      const body = sprite.body = { bottom: y, checkCollision: {}, velocity: { x: 0, y: 0 },
        setAllowGravity() {}, setImmovable() {}, setSize() {}, setOffset() {}, updateFromGameObject() {},
        reset: (a, b) => sprite.setPosition(a, b),
      };
      sprite.setVelocity = (a, b) => { body.velocity = { x: a, y: b }; };
      sprite.anims = { play(animation) { sprite.animation = animation; }, stop() {} };
      physicsSprites.push(sprite);
      return sprite;
    } } },
  };
  const runtime = { scene, host, sender: new VisualSender(), receiver: new VisualReceiver(scene) };
  const nova = new CoopNova(runtime);
  return { scene, runtime, nova, physicsSprites, text };
}

function deliver(host, client, { full = true, snapshot = host.nova.snapshot() } = {}) {
  client.runtime.receiver.receive(host.runtime.sender.capture([host.nova.pet], full));
  client.nova.receive(snapshot);
}

for (const size of [2, 3, 4]) {
  test(`${size} jogadores: uma N.O.V.A. segue o host e todos veem a pose e a fala`, () => {
    const host = peer(true, 200), clients = Array.from({ length: size - 1 }, () => peer(false, -500));
    const pet = host.nova.pet;
    assert.equal(pet.x, 155);
    assert.equal(pet.body.checkCollision.none, true);
    host.scene.player.x += 230;
    host.scene.time.now = 1600;
    host.nova.update(1600, 80);
    assert.ok(pet.body.velocity.x > 0);
    assert.equal(pet.animation, "companion-pet-walk-right");
    const line = criarFalaFlutuante(host.scene, "teste-nova", { falante: "nova" });
    line.mostrar("N.O.V.A.: Portas liberadas.");
    pet.setFrame(27);
    for (const client of clients) {
      deliver(host, client);
      assert.equal(client.physicsSprites.length, 0);
      assert.equal(client.nova.visual.frame.name, 27);
      assert.equal(client.text[0].x, pet.x + 8);
      deliver(host, client);
      assert.equal(client.text.length, 1);
      const x = client.nova.visual.x;
      pet.x += 40;
      deliver(host, client, { full: false });
      client.runtime.receiver.update(20);
      client.nova.update(1620, 20);
      assert.ok(client.nova.visual.x > x && client.nova.visual.x < pet.x);
      assert.equal(client.text[0].x, client.nova.visual.x + 8);
    }
    host.nova.destroy();
    assert.equal(host.scene.companionPet, null);
    assert.equal(host.scene.events.listenerCount("postupdate"), 0);
  });
}

test("entrada tardia, reconexão visual, troca de mapa e migração usam o pet da autoridade atual", () => {
  const original = peer(true, 100), guest = peer(false, 400), late = peer(false, 600);
  deliver(original, guest);
  deliver(original, late);
  const oldVisual = guest.nova.visual;
  original.runtime.manager = { mqtt: { connected: false } };
  original.nova.pet.setVelocity(100, 0);
  original.nova.update(100, 16);
  assert.equal(original.nova.pet.body.velocity.x, 0);
  original.runtime.manager.mqtt.connected = true;
  guest.nova.clearReplica();
  assert.equal(oldVisual.active, false);
  deliver(original, guest);
  assert.ok(guest.nova.visual?.active);
  original.runtime.host = false;
  original.nova.authority(false);
  guest.runtime.host = true;
  guest.nova.authority(true);
  assert.equal(original.scene.companionPet, null);
  assert.equal(guest.nova.visual, null);
  assert.equal(guest.nova.pet.x, 355);
  late.nova.clearReplica();
  deliver(guest, late);
  assert.equal(late.nova.visual.x, 355);
  guest.nova.destroy();
  const factory = peer(true, 900);
  assert.ok(factory.nova.pet.active);
  assert.equal(factory.nova.pet.x, 855);
  assert.equal(guest.scene.events.listenerCount("postupdate"), 0);
});

test("gerenciador aceita entrada após The Hollow e rejeita quadros fora de ordem ou do host anterior", () => {
  const mqtt = Object.assign(new EventEmitter(), { clientId: "host", connect() {}, publish() {} });
  const manager = new MultiplayerManager(mqtt);
  const owner = manager.normalizePlayer({ id: "host", character: "kai-mercer" });
  manager.room = { status: "PLAYING", roomCode: "NOVA", hostId: "host", players: [owner],
    coopMap: { key: "Level1Parte2", x: 900, y: -100 }, hollow: createHollowSession([owner], 0) };
  manager.publishState = () => {};
  manager.receiveAction({ type: "join_room", playerId: "late" });
  assert.equal(manager.room.players.length, 1);
  manager.room.hollow.releaseAt = Date.now() - 10;
  manager.receiveAction({ type: "join_room", playerId: "late" });
  const late = manager.room.players.at(-1);
  assert.notEqual(late.character, owner.character);
  assert.equal(late.mapKey, "Level1Parte2");
  assert.deepEqual([late.x, late.y], [900, -100]);
  manager.receiveAction({ type: "join_room", playerId: "late" });
  assert.equal(manager.room.players.length, 2);

  manager.room.hostId = "late";
  const seen = [];
  manager.on("coopFrame", frame => seen.push(frame.sequence));
  const packet = { roomCode: "NOVA", hostId: "late", players: manager.room.players };
  manager.receiveCoopFrame({ ...packet, sequence: 3 });
  manager.receiveCoopFrame({ ...packet, sequence: 2 });
  manager.receiveCoopFrame({ ...packet, hostId: "host", sequence: 4 });
  assert.deepEqual(seen, [3]);
});

test("hacking remoto conserva o tempo de entrada sem duplicar o pet e o host reutiliza sua instância", () => {
  const host = peer(true, 100);
  host.scene.coopRuntime = host.runtime;
  const pet = host.nova.pet;
  const operator = x => {
    const player = visual(x, 0);
    player.setVelocity = () => {};
    player.anims = { stop() {} };
    player.body = { moves: true, reset: (x, y) => player.setPosition(x, y), updateFromGameObject() {} };
    return player;
  };
  host.scene.player = operator(100);
  const remote = { player: operator(350) };
  const terminal = { x: 350, y: 0 };
  const remoteDock = prepararPetNoTerminal(host.scene, remote, terminal);
  for (let i = 0; i < 7; i++) remoteDock.atualizar(100);
  assert.equal(remoteDock.pronto, true);
  assert.equal(remote.player.body.moves, false);
  assert.equal(pet.emHack, undefined);
  assert.equal(host.physicsSprites.length, 1);
  remoteDock.destruir();
  assert.equal(remote.player.body.moves, true);
  const ownerDock = prepararPetNoTerminal(host.scene, host.scene, terminal);
  for (let i = 0; i < 7; i++) ownerDock.atualizar(100);
  assert.equal(pet.emHack, true);
  assert.equal(pet.x, terminal.x);
  ownerDock.destruir();
  assert.equal(host.scene.companionPet, pet);
  assert.equal(pet.emHack, false);
});

test("versão antiga de uma fala não apaga nem reinicia o balão atual", () => {
  const host = peer(true), client = peer(false);
  const snapshot = host.nova.snapshot();
  const line = { nome: "teste-nova", falante: "nova", frase: "Portas liberadas.", versao: 2, decorrido: 100 };
  deliver(host, client, { snapshot: { ...snapshot, speech: [line] } });
  const bubble = client.text[0];
  assert.equal(bubble.visible, true);
  const text = bubble.text;
  client.nova.receive({ ...snapshot, speech: [{ ...line, versao: 1, frase: "Aviso antigo." }] });
  assert.equal(bubble.visible, true);
  assert.equal(bubble.text, text);
  client.nova.receive(snapshot);
  client.nova.receive({ ...snapshot, speech: [line] });
  assert.equal(bubble.visible, false, "uma versão já encerrada não volta a aparecer");
});
