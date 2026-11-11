import test from "node:test";
import assert from "node:assert/strict";
import { CoopMusic, musicPosition } from "./CoopMusic.js";
import { iniciarMusicaCidade } from "../sounds/musicaCidade.js";
import { iniciarMusicaFabrica } from "../sounds/musicaFabrica.js";

function fixture(t, host = false) {
  const clock = { ms: 1000 }, sent = [], sounds = [];
  t.mock.method(performance, "now", () => clock.ms);
  const manager = { locked: false, context: { state: "running" }, sounds,
    getAll: key => sounds.filter(s => s.key === key),
    add(key, config) {
      const sound = { key, volume: config.volume, totalDuration: 120, rate: 1, plays: [], markers: {},
        isPlaying: false, isPaused: false, pendingRemove: false, position: 0, startMs: clock.ms,
        addMarker(marker) { this.markers[marker.name] = marker; },
        get seek() {
          const value = this.position + (this.isPlaying ? (clock.ms - this.startMs) / 1000 * this.rate : 0);
          const end = this.currentMarker?.duration || this.totalDuration;
          return value >= end ? value % end : value;
        },
        play(marker, options) {
          if (typeof marker !== "string") { options = marker; marker = null; }
          this.plays.push({ marker, ...options }); this.currentMarker = this.markers[marker];
          this.position = options.seek || 0; this.startMs = clock.ms;
          this.isPlaying = true; this.isPaused = false; this.rate = options.rate || 1;
          return true;
        },
        setVolume(value) { this.volume = value; },
        pause() { this.position = this.seek; this.isPlaying = false; this.isPaused = true; },
        stop() { this.isPlaying = this.isPaused = false; },
        destroy() { this.pendingRemove = true; },
      };
      sounds.push(sound); return sound;
    } };
  const scene = { sound: manager, cache: { audio: { exists: () => true } } };
  const runtime = { scene, host, manager: { sendCoopAction(...args) { sent.push(args); } } };
  const music = new CoopMusic(runtime); scene.coopRuntime = { ...runtime, music };
  return { clock, scene, sounds, sent, runtime, music };
}

const track = (clock, extra = {}) => ({ id: 1, key: "musica-cidade", at: clock.ms,
  position: 12, start: 43.2, end: 62.4, marker: "cidade-continua", paused: false, volume: 0.06, rate: 1, ...extra });

test("introdução toca uma vez e avanço por atraso respeita o trecho de loop", () => {
  const s = { position: 0, start: 43.2, end: 62.4, rate: 1, paused: false };
  assert.equal(musicPosition(s, 12), 12);
  assert.ok(Math.abs(musicPosition(s, 65) - 45.8) < 1e-8);
  assert.equal(musicPosition({ ...s, paused: true }, 100), 0);
});

test("cliente espera a faixa do host e não inicia cidade ou fábrica sozinho", t => {
  const { scene, sounds } = fixture(t);
  assert.equal(iniciarMusicaCidade(scene), null);
  assert.equal(iniciarMusicaFabrica(scene), null);
  assert.equal(sounds.length, 0);
});

test("entrada tardia inicia na posição correta, sem repetir a introdução ou criar cópias", t => {
  const { clock, music, sounds } = fixture(t);
  music.hostOffset = 0;
  music.receive(track(clock, { at: clock.ms - 3000, position: 61 }), "city");
  assert.equal(sounds.length, 1);
  assert.ok(Math.abs(sounds[0].seek - 1.6) < 1e-8);
  clock.ms += 1000; music.update();
  assert.equal(sounds[0].plays.length, 1);
  assert.equal(sounds[0].volume, 0.06);
});

test("drift curto não reinicia a música; retorno após pausa corrige a posição", t => {
  const { clock, music } = fixture(t);
  music.receive(track(clock), "city");
  const sound = music.replica;
  clock.ms += 200;
  music.receive(track(clock, { position: 12.25 }), "city");
  assert.equal(sound.plays.length, 1);
  sound.pause(); clock.ms += 2000;
  music.update();
  assert.equal(sound.plays.length, 2);
  assert.ok(Math.abs(sound.currentMarker.start + sound.seek - 14.25) < 1e-8);
});

test("desbloqueio de autoplay busca a posição atual e não consome a música em silêncio", t => {
  const { clock, scene, music, sounds } = fixture(t);
  scene.sound.locked = true;
  music.receive(track(clock), "city");
  clock.ms += 5000; music.update();
  assert.equal(sounds.length, 0);
  scene.sound.locked = false; music.update();
  assert.ok(Math.abs(music.replica.currentMarker.start + music.replica.seek - 17) < 1e-8);
});

test("pausa, volume, boss e silêncio seguem o host e limpam a trilha anterior", t => {
  const { clock, music, scene } = fixture(t);
  music.receive(track(clock, { paused: true, volume: 0.025 }), "city");
  const city = music.replica;
  assert.equal(city.isPaused, true); assert.equal(city.volume, 0.025);
  music.receive(track(clock, { id: 2, key: "musica-novo-boss", start: 48, end: 104,
    marker: "boss-continuo", volume: 0.1 }), "factory");
  assert.equal(city.pendingRemove, true);
  const boss = music.replica;
  assert.equal(boss.isPlaying, true); assert.equal(boss.key, "musica-novo-boss");
  scene.sound.locked = true;
  music.receive(null, "factory");
  assert.equal(boss.pendingRemove, true); assert.equal(music.replica, null);
});

test("relógio usa ida e volta e não depende do relógio local igual ao do host", t => {
  const { clock, music, sent } = fixture(t);
  clock.ms = 1400;
  music.receiveClock({ authority: true, payload: { sentAt: 1000, hostTime: 61000 } });
  assert.equal(music.hostOffset, 59800);
  music.receive(track(clock, { at: 61000, position: 10 }), "city");
  assert.ok(Math.abs(music.replica.currentMarker.start + music.replica.seek - 10.2) < 1e-8);
  music.receiveClock({ authority: true, payload: { sentAt: 0, hostTime: 90000 } });
  assert.equal(music.hostOffset, 59800, "amostra com maior atraso não piora o ajuste");
  assert.equal(sent[0][0], "musicClock");
});

test("host publica posição absoluta, volume audível e prioridade do boss", t => {
  const { clock, music, scene, sent } = fixture(t, true);
  const factory = scene.sound.add("musica-fabrica", { volume: 0.06 });
  factory.play({ seek: 10 });
  const boss = scene.sound.add("musica-novo-boss", { volume: 0 });
  boss.addMarker({ name: "boss-continuo", start: 48, duration: 56 });
  boss.play("boss-continuo", { seek: -48 });
  boss.volumeNode = { gain: { value: 0.035 } };
  clock.ms += 1000;
  const s = music.snapshot();
  assert.equal(s.key, "musica-novo-boss"); assert.equal(s.position, 1);
  assert.equal(s.volume, 0.035); assert.equal(s.marker, "boss-continuo");
  boss.volumeNode.gain.value = 1;
  boss.coopMusicVolume = () => 0.025;
  assert.equal(music.snapshot().volume, 0.025, "ganho padrão do primeiro bloco não vaza no volume replicado");
  music.receiveClock({ playerId: "client", payload: { sentAt: 123 } });
  assert.equal(sent[0][0], "musicClock");
  assert.equal(sent[0][1].sentAt, 123);
  assert.ok(Number.isFinite(sent[0][1].hostTime));
  assert.deepEqual(sent[0][2], { authority: true, targetId: "client" });
  scene.sound.context.state = "suspended";
  assert.equal(music.snapshot().paused, true);
});

test("reinício da mesma faixa e shutdown limpam a réplica sem acumular sons", t => {
  const { clock, music } = fixture(t);
  music.receive(track(clock), "visit1"); const first = music.replica;
  music.receive(track(clock), "visit2");
  assert.equal(first.pendingRemove, true); assert.notEqual(music.replica, first);
  const second = music.replica;
  music.destroy(); music.destroy();
  assert.equal(second.pendingRemove, true); assert.equal(music.state, null);
});
