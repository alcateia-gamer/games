import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { CoopAudio, cenaSomCompartilhado, prepararAudioCoop } from "./CoopAudio.js";

function setup(t, count = 4) {
  const clock = { now: 10000 };
  t.mock.method(Date, "now", () => clock.now);
  t.mock.method(performance, "now", () => clock.now);
  const peers = [], messages = [];
  for (let i = 0; i < count; i++) {
    const sounds = [], scene = { multiplayer: true, sys: { settings: { key: "Level1" } },
      events: new EventEmitter(), player: { x: 0, y: 0 }, cache: { audio: { exists: () => true } } };
    const native = { sounds, locked: false, context: { state: "running" },
      add(key, config = {}) {
        const sound = Object.assign(new EventEmitter(), { key, volume: config.volume ?? 1,
          rate: 1, detune: 0, loop: config.loop ?? false, totalDuration: 10,
          currentConfig: { ...config }, currentMarker: null, markers: {},
          isPlaying: false, isPaused: false, plays: 0, destroys: 0, position: 0,
          get seek() {
            const position = this.position + (this.isPlaying ? (clock.now - this.startedAt) / 1000 * this.rate * 2 ** (this.detune / 1200) : 0);
            return this.loop ? position % (this.currentMarker?.duration ?? this.totalDuration) : position;
          },
          addMarker(marker) { this.markers[marker.name] = marker; },
          play(marker, options) {
            if (native.locked || native.context.state !== "running") return false;
            if (typeof marker !== "string") { options = marker ?? {}; marker = null; }
            this.currentMarker = this.markers[marker] ?? null;
            this.currentConfig = { ...this.currentConfig, ...options };
            for (const key of ["volume", "rate", "detune", "loop"]) if (key in this.currentConfig) this[key] = this.currentConfig[key];
            this.position = options.seek ?? 0; this.startedAt = clock.now;
            this.isPlaying = true; this.isPaused = false; this.plays++;
            this.emit("play"); return true;
          },
          stop() { this.isPlaying = this.isPaused = false; return this; },
          pause() { this.position = this.seek; this.isPlaying = false; this.isPaused = true; return this; },
          resume() { this.startedAt = clock.now; this.isPlaying = true; this.isPaused = false; return this; },
          destroy() { this.stop(); this.destroys++; },
          setVolume(value) { this.volume = value; return this; },
          setPan(value) { this.pan = value; return this; },
        });
        Object.defineProperty(sound, "seek", { get() {
          const position = this.position + (this.isPlaying ? (clock.now - this.startedAt) / 1000 * this.rate * 2 ** (this.detune / 1200) : 0);
          return this.loop ? position % (this.currentMarker?.duration ?? this.totalDuration) : position;
        } });
        sounds.push(sound); return sound;
      },
      getAll(key) { return sounds.filter(s => s.key === key && !s.destroys); },
      play(key, config) { return this.add(key, config).play(config); },
    };
    const manager = { playerId: `p${i}`, room: { hostId: "p0", players: Array.from({ length: count }, (_, n) => ({ id: `p${n}` })) },
      sendCoopAction(kind, payload, { authority = false } = {}) {
        const action = JSON.parse(JSON.stringify({ kind, payload, authority, playerId: this.playerId }));
        messages.push(action);
        for (let duplicate = 0; duplicate < 2; duplicate++) {
          if (authority) for (const peer of peers) peer.audio.receive(action);
          else peers[0].audio.receive(action);
        }
      } };
    scene.sound = native; scene.multiplayerManager = manager;
    const audio = prepararAudioCoop(scene);
    scene.coopRuntime = { audio, music: { hostOffset: 0 } };
    peers.push({ scene, audio, native, manager, sounds });
  }
  return { clock, peers, messages };
}
const plays = (p, key) => p.sounds.filter(s => s.key === key).reduce((n, s) => n + s.plays, 0);

test("solo mantém o áudio original e seu contexto", () => {
  const scene = { multiplayer: false, sound: {} };
  assert.equal(prepararAudioCoop(scene), null);
  assert.equal(cenaSomCompartilhado(scene, {}), scene);
});

for (const key of ["running", "aria-tensar-arco", "aria-soltar-flecha", "dano-soft", "katana-ataque",
  "ataque-no-ar", "enchendo-galao", "cartao-passando", "cartao-acesso-concedido", "colocando-item", "porta-fabrica"]) {
  test(`${key}: som do cliente chega uma única vez aos quatro jogadores, sem eco`, t => {
    const { peers } = setup(t);
    peers[2].scene.sound.play(key, { volume: .3 });
    for (const peer of peers) assert.equal(plays(peer, key), 1);
  });
}
for (const key of ["kai-especial", "magnus-especial", "tiro-laser", "robo-explodindo", "robot-walk", "walk-robo-serra", "robo-serra-ataque",
  "boss-escotilha", "boss-impacto-escotilha", "boss-explosao-escotilha", "boss-raio-escotilha", "boss-escudo-quebrado"]) {
  test(`${key}: som do mundo chega uma única vez aos quatro jogadores`, t => {
    const { peers } = setup(t);
    peers[0].scene.sound.play(key, { volume: .3 });
    for (const peer of peers) assert.equal(plays(peer, key), 1);
    assert.equal(peers[1].scene.sound.play(key, { volume: .3 }), false, "réplicas não duplicam o som do host");
  });
}

test("fonte distante do host continua audível ao cliente próximo, com volume por jogador", t => {
  const { peers } = setup(t);
  peers[0].scene.player.x = 2000;
  const source = { x: 0, y: 0 };
  const scene = cenaSomCompartilhado(peers[0].scene, source, { range: 700 });
  assert.equal(scene.player.x, source.x, "controlador não elimina evento por distância ao host");
  scene.sound.play("tiro-laser", { volume: .4 });
  assert.equal(peers[0].sounds.at(-1).volume, 0);
  assert.equal(peers[1].sounds.at(-1).volume, .4);
  peers[1].scene.player.x = 700; peers[1].audio.update();
  assert.equal(peers[1].sounds.at(-1).volume, 0);
});

test("loop acompanha posição, volume, pausa, retomada, parada e destruição", t => {
  const { peers, clock } = setup(t);
  const sound = peers[1].scene.sound.add("running", { volume: .3, loop: true });
  sound.play({ loop: true, seek: 2 });
  clock.now += 1000;
  peers[1].scene.player.x = 100;
  assert.equal(sound.setVolume(.15), sound, "API encadeável continua disponível");
  peers[1].audio.update();
  const remote = peers[3].sounds.at(-1);
  assert.ok(Math.abs(remote.seek - 3) < .001);
  assert.ok(remote.volume < .15);
  sound.pause(); assert.equal(remote.isPaused, true);
  clock.now += 1000; sound.resume(); assert.equal(remote.isPlaying, true);
  sound.stop(); assert.equal(remote.destroys, 1);
  sound.destroy(); assert.equal(remote.destroys, 1, "parada repetida não duplica destruição remota");
});

test("autoplay bloqueado espera desbloqueio e não repete efeitos já vencidos", t => {
  const { peers, clock } = setup(t);
  peers[1].native.locked = true; peers[2].native.context.state = "suspended";
  peers[0].scene.sound.play("tiro-laser", { volume: .2 });
  assert.equal(plays(peers[1], "tiro-laser"), 0);
  clock.now += 1000; peers[1].native.locked = false; peers[1].audio.update();
  assert.equal(plays(peers[1], "tiro-laser"), 1);
  assert.equal(peers[1].sounds.at(-1).position, 1);
  clock.now += 10000; peers[2].native.context.state = "running"; peers[2].audio.update();
  assert.equal(plays(peers[2], "tiro-laser"), 0, "não despeja sons antigos após voltar à aba");
});

test("marcadores, velocidade e afinação são preservados sem multiplicar o pitch", t => {
  const { peers } = setup(t);
  const sound = peers[1].scene.sound.add("cartao-passando");
  sound.addMarker({ name: "efeito", start: .2, duration: 2 });
  sound.play("efeito", { seek: .4, rate: 1.25, detune: 100, volume: .3 });
  const remote = peers[2].sounds.at(-1);
  assert.equal(remote.currentMarker.start, .2); assert.equal(remote.position, .4);
  assert.equal(remote.rate, 1.25); assert.equal(remote.detune, 100);
});

test("músicas, Nyx e ambientes existentes não ganham uma segunda replicação", t => {
  const { peers, messages } = setup(t);
  for (const key of ["musica-cidade", "musica-fabrica", "musica-novo-boss", "nyx-aura-cura",
    "nyx-aura-invocacao", "robo-bola-propulsao", "gerador-diesel", "luz-fabrica-oscilando"]) {
    peers[0].scene.sound.play(key, { volume: .1 });
    assert.equal(plays(peers[1], key), 0);
  }
  assert.equal(messages.length, 0);
});

test("mudança de mapa e saída limpam loops; desconexão não deixa passos presos", t => {
  const { peers } = setup(t);
  peers[1].scene.sound.play("running", { volume: .3, loop: true });
  const remote = peers[0].sounds.at(-1);
  peers[0].manager.room.players = peers[0].manager.room.players.filter(p => p.id !== "p1");
  peers[0].audio.update(); assert.equal(remote.destroys, 1);
  const original = peers[1].native;
  peers[1].scene.events.emit("shutdown");
  assert.equal(peers[1].scene.sound, original);
  peers[2].manager.room.players = peers[0].manager.room.players;
  peers[2].audio.update();
  assert.equal(peers[2].audio.remote.size, 0);
});

test("pacotes de outro mapa, emissores falsificados e sons arbitrários são ignorados", t => {
  const { peers, messages } = setup(t);
  peers[1].scene.sound.play("running", { volume: .3 });
  const action = messages.find(m => !m.authority);
  const receiver = peers[2];
  for (const payload of [
    { ...action.payload, mapKey: "Level1Parte2" },
    { ...action.payload, owner: "p9" },
    { ...action.payload, sounds: action.payload.sounds.map(s => ({ ...s, key: "arbitrario" })) },
    { ...action.payload, sounds: action.payload.sounds.map(s => ({ ...s, key: "tiro-laser" })) },
    { ...action.payload, sounds: action.payload.sounds.map(s => ({ ...s, volume: Infinity })) },
  ]) receiver.audio.receive({ ...action, authority: true, payload });
  assert.equal(plays(receiver, "running"), 1);
  assert.equal(plays(receiver, "tiro-laser"), 0);
});

test("controlador real dos passos de robô transmite o loop mesmo com o host longe", async t => {
  const { configurarSomPassoRobo, atualizarSomPassoRobo } = await import("../sounds/inimigos.js");
  const previous = globalThis.Phaser;
  globalThis.Phaser = { Scenes: { Events: { SHUTDOWN: "shutdown" } },
    Math: { Clamp: (n, min, max) => Math.max(min, Math.min(max, n)) } };
  try {
    const { peers } = setup(t);
    peers[0].scene.player.x = 2000;
    const enemy = { tipoRobo: "padrao", x: 0, y: 0, active: true };
    configurarSomPassoRobo(peers[0].scene, enemy);
    atualizarSomPassoRobo(peers[0].scene, enemy, true, 2000, true);
    assert.equal(plays(peers[1], "robot-walk"), 1);
    assert.equal(peers[1].sounds.at(-1).volume, .22);
    assert.equal(peers[0].sounds.at(-1).volume, 0);
    atualizarSomPassoRobo(peers[0].scene, enemy, true, 2000, false);
    assert.equal(peers[1].audio.remote.size, 0);
  } finally { globalThis.Phaser = previous; }
});

test("controladores reais da escotilha e de impacto chegam aos clientes próximos", async t => {
  const { criarSomEscotilhaBoss } = await import("../sounds/escotilhaBoss.js");
  const { criarSomImpactoEscotilhaBoss } = await import("../sounds/impactoEscotilhaBoss.js");
  const { peers } = setup(t);
  const host = peers[0].scene; host.player.x = 2000;
  const p = { x: 0, y: 0 };
  const hatch = criarSomEscotilhaBoss(host, p, 2000);
  hatch.atualizar(100, true);
  peers[0].audio.update();
  assert.equal(plays(peers[1], "boss-escotilha"), 1);
  assert.ok(peers[1].sounds.at(-1).volume > 0);
  const impact = criarSomImpactoEscotilhaBoss(host, p);
  impact.tocar();
  assert.equal(plays(peers[1], "boss-impacto-escotilha"), 1);
  assert.equal(peers[1].sounds.at(-1).volume, .07);
  hatch.destruir(); impact.destruir();
  assert.equal(peers[1].audio.remote.size, 0);
});

test("shutdown publica parada antes de destruir o backend de áudio", t => {
  const { peers } = setup(t);
  const sound = peers[1].scene.sound.add("running", { loop: true });
  sound.play({ loop: true, volume: .3 });
  const native = peers[1].sounds.at(-1);
  native.destroy = function () { this.stop(); Object.defineProperty(this, "seek", { get() { throw Error("destruído"); } }); };
  assert.doesNotThrow(() => sound.destroy());
  assert.equal(peers[2].audio.remote.size, 0);
});

test("protocolo e runtime reais encaminham áudio com QoS repetido e sem eco em quatro jogadores", async t => {
  const previous = globalThis.Phaser;
  globalThis.Phaser = { Scene: class {}, Events: { EventEmitter } };
  try {
    const { CoopRuntime } = await import("./CoopRuntime.js");
    const { default: MultiplayerManager } = await import("./multiplayerManager.js");
    const { RecentActions } = await import("./CoopProtocol.js");
    const { peers } = setup(t);
    for (const peer of peers) {
      const manager = peer.manager;
      manager.coopActions = new RecentActions(); manager.actionSequence = 0; manager.roomTopic = "room/TEST";
      manager.receiveAction = MultiplayerManager.prototype.receiveAction;
      manager.sendCoopAction = MultiplayerManager.prototype.sendCoopAction;
      manager.publishAction = action => {
        for (let repeat = 0; repeat < 2; repeat++) for (const target of peers) {
          target.manager.receiveAction(JSON.parse(JSON.stringify({ ...action, clientId: manager.playerId })));
        }
      };
      const runtime = Object.assign(Object.create(CoopRuntime.prototype), { scene: peer.scene, manager,
        audio: peer.audio, host: manager.playerId === "p0" });
      peer.scene.coopRuntime = runtime;
      manager.emit = (kind, action) => { if (kind === "coopAction") runtime.receiveAction(action); };
    }
    peers[1].scene.sound.play("aria-soltar-flecha", { volume: .2 });
    peers[0].scene.sound.play("robo-explodindo", { volume: .1 });
    for (const peer of peers) {
      assert.equal(plays(peer, "aria-soltar-flecha"), 1);
      assert.equal(plays(peer, "robo-explodindo"), 1);
    }
  } finally { globalThis.Phaser = previous; }
});

test("motor real do gerador mantém a mesma fase ao entrar no alcance depois", async t => {
  const { criarSomGerador } = await import("../sounds/gerador.js");
  const { peers, clock } = setup(t);
  for (const peer of peers) {
    peer.scene.luzFabricaAcesa = true;
    peer.manager.room.coopProgress = { generatorStartedAt: clock.now - 7000 };
  }
  const controls = peers.map(peer => criarSomGerador(peer.scene));
  controls[0].update(0); controls[1].update(0); controls[2].update(900); controls[3].update(0);
  assert.equal(peers[0].sounds.at(-1).currentMarker.name, "motor");
  assert.equal(peers[0].sounds.at(-1).position, 2);
  assert.equal(peers[1].sounds.at(-1).position, 2);
  assert.equal(peers[2].sounds.at(-1).plays, 0, "distante começa silencioso");
  clock.now += 1000; controls[2].update(0);
  assert.equal(peers[2].sounds.at(-1).currentMarker.name, "motor");
  assert.equal(peers[2].sounds.at(-1).position, 3, "aproximar não repete a partida do gerador");
});


test("especial Magnus replica som a 15% no local da explosão, inclusive longe do host", async t => {
  const { tocarSomEspecialMagnus } = await import("../sounds/magnusEspecial.js");
  const { peers, messages } = setup(t);
  peers[0].scene.player.x = 2000;
  tocarSomEspecialMagnus(peers[0].scene, { x: 0, y: 0 });
  for (const peer of peers) assert.equal(plays(peer, "magnus-especial"), 1);
  assert.equal(peers[0].sounds.at(-1).volume, 0);
  assert.equal(peers[1].sounds.at(-1).volume, 0.15);
  const evento = messages.find(m => m.kind === "audio").payload.sounds[0];
  assert.equal(evento.x, 0);
  assert.equal(evento.y, 0);
  assert.equal(evento.volume, 0.15);
});


test("especial Kai: áudio a 20% parte do jogador remoto que abriu a barreira", async t => {
  const { tocarSomEspecialKai } = await import("../sounds/kaiEspecial.js");
  const { peers, messages } = setup(t);
  const host = peers[0];
  host.scene.player.x = 2000;
  const kai = { x: 0, y: 0 };
  const contexto = new Proxy(host.scene, { get(target,key) {
    return key === "player" ? kai : target[key];
  } });
  tocarSomEspecialKai(contexto);
  for (const peer of peers) assert.equal(plays(peer, "kai-especial"), 1);
  assert.equal(host.sounds.at(-1).volume, 0);
  assert.equal(peers[1].sounds.at(-1).volume, 0.2);
  assert.equal(messages.find(m => m.kind === "audio").payload.sounds[0].volume, 0.2);
  const evento = messages.find(m => m.kind === "audio").payload.sounds[0];
  assert.equal(evento.x, 0, "fonte é o Kai remoto, não o host distante");
  assert.equal(evento.y, 0);
});
