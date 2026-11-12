/** Fixture de navegador: quatro jogos Phaser/WebAudio reais e transporte local com atraso. */
import { prepararAudioCoop } from "../js/multiplayer/CoopAudio.js";
import { CoopMusic } from "../js/multiplayer/CoopMusic.js";
import { CoopRuntime } from "../js/multiplayer/CoopRuntime.js";
import MultiplayerManager from "../js/multiplayer/multiplayerManager.js";
import { registrarDesbloqueioAudio } from "../js/core/AudioUnlock.js";
import { iniciarMusicaCidade } from "../js/sounds/musicaCidade.js";

export async function criarFixtureAudio() {
  const peers = [], games = [], errors = [];
  const assets = {
    running: "running.mp3", "tiro-laser": "tiro_laser.mp3", "robo-explodindo": "robo_explodindo.mp3",
    "aria-soltar-flecha": "soltar_flecha.mp3", "katana-ataque": "katana_ataque.mp3",
    "musica-cidade": "SONS AMBIENETE/01 - The Street of Rage.mp3",
  };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  await Promise.all(Array.from({ length: 4 }, (_, index) => new Promise(resolve => {
    const context = new AudioContext();
    const game = new Phaser.Game({ type: Phaser.HEADLESS, width: 32, height: 32,
      banner: false, audio: { context }, fps: { target: 30 }, scene: {
        key: "Level1",
        preload() {
          this.load.on("loaderror", file => errors.push(file.key));
          for (const [key, file] of Object.entries(assets)) this.load.audio(key, `/assets/sounds.mp3/${file}`);
        },
        create() {
          this.multiplayer = true; this.player = { x: 0, y: 0 };
          const mqtt = new Phaser.Events.EventEmitter();
          mqtt.clientId = `p${index}`; mqtt.connect = () => {};
          mqtt.publish = (topic, packet) => {
            for (const peer of peers) if (peer) setTimeout(() => peer.manager.receive(topic,
              JSON.parse(JSON.stringify({ ...packet, clientId: mqtt.clientId }))), 20);
            return true;
          };
          const manager = new MultiplayerManager(mqtt);
          manager.roomTopic = "room/TEST";
          manager.room = { roomCode: "TEST", hostId: "p0", status: "PLAYING",
            players: Array.from({ length: 4 }, (_, i) => manager.normalizePlayer({ id: `p${i}`, character: "kai-mercer" })) };
          manager.enableCoop(); this.multiplayerManager = manager;
          const runtime = Object.assign(Object.create(CoopRuntime.prototype), { scene: this,
            manager, host: index === 0, mapKey: "Level1" });
          this.coopRuntime = runtime;
          runtime.music = new CoopMusic(runtime);
          runtime.audio = prepararAudioCoop(this);
          manager.on("coopAction", action => runtime.receiveAction(action));
          manager.on("coopFrame", packet => runtime.music.receive(packet.music, "fixture"));
          const cleanup = registrarDesbloqueioAudio(game);
          this.events.once("shutdown", cleanup);
          const timer = setInterval(() => {
            runtime.music.update(); runtime.audio.update();
            if (runtime.host) manager.publishCoopFrame({ music: runtime.music.snapshot(),
              streamId: "fixture", mapKey: "Level1" });
          }, 100);
          this.events.once("shutdown", () => clearInterval(timer));
          peers[index] = { scene: this, runtime, manager, game, timer };
          resolve();
        },
        update() {
          const r = this.coopRuntime;
          if (!r) return;
          r.music.update(); r.audio.update();
          if (r.host && performance.now() - (r.lastAudioFrame ?? 0) >= 100) {
            r.lastAudioFrame = performance.now();
            r.manager.publishCoopFrame({ music: r.music.snapshot(), streamId: "fixture", mapKey: "Level1" });
          }
        },
      } });
    games.push(game);
  })));
  const unlock = document.createElement("button");
  unlock.id = "audio-fixture-unlock"; unlock.textContent = "TESTAR ÁUDIO";
  unlock.style.cssText = "position:fixed;top:8px;left:8px;z-index:999999";
  unlock.addEventListener("click", () => {
    for (const peer of peers) { peer.game.sound.unlock(); void peer.game.sound.context.resume(); }
  });
  document.body.append(unlock);
  return {
    peers, errors, wait,
    startMusic() { iniciarMusicaCidade(peers[0].scene); },
    report(key) { return peers.map(peer => ({
      state: peer.game.sound.context.state, locked: peer.game.sound.locked,
      sounds: peer.game.sound.getAll(key).filter(s => !s.pendingRemove).map(s => ({
        playing: s.isPlaying, paused: s.isPaused, seek: s.seek,
        volume: s.volume, duration: s.totalDuration, marker: s.currentMarker?.name,
      })),
    })); },
    destroy() {
      for (const peer of peers) {
        clearInterval(peer.timer); peer.runtime.audio.destroy(); peer.runtime.music.destroy();
        peer.game.sound.stopAll(); void peer.game.sound.context.close(); peer.game.destroy(true);
      }
      unlock.remove();
    },
  };
}
