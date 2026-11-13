/** Compartilha o ciclo dos efeitos sonoros; música e ambientes já replicados mantêm seus controladores. */
const EXCLUDED = new Set([
  "musica-menu", "musica-cidade", "musica-fabrica", "musica-novo-boss",
  "gerador-diesel", "luz-fabrica-oscilando", "robo-bola-propulsao",
  "nyx-aura-invocacao", "nyx-aura-cura",
]);
const WORLD = new Set(["tiro-laser", "robo-explodindo", "robot-walk", "walk-robo-serra",
  "magnus-especial",
  "kai-especial",
  "aria-especial", "aria-clone-passos",
  "boss-impacto-chuva",
  "boss-teleporte",
  "boss-explosao-pulso",
  "boss-disparo-laser",
  "kai-ricochete",
  "robo-serra-ataque", "boss-escotilha", "boss-impacto-escotilha", "boss-explosao-escotilha",
  "boss-raio-escotilha", "boss-escudo-quebrado"]);
const PLAYER = new Set(["running", "dash-personagem", "aria-tensar-arco", "aria-soltar-flecha", "dano-soft",
  "katana-ataque", "magnus-martelo-impacto", "ataque-no-ar", "enchendo-galao", "cartao-passando",
  "cartao-acesso-concedido", "colocando-item", "porta-fabrica"]);
const shared = key => !EXCLUDED.has(key) && (WORLD.has(key) || PLAYER.has(key));
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const time = () => typeof performance !== "undefined" ? performance.now() : Date.now();

/** Somente os módulos de áudio recebem este contexto: o ouvinte virtual não altera o combate. */
export function cenaSomCompartilhado(scene, source, profile = {}) {
  return scene.coopAudio?.sourceScene(scene, source, profile) ?? scene;
}
export function prepararAudioCoop(scene) {
  if (!scene.multiplayer || !scene.multiplayerManager?.room) return null;
  return scene.coopAudio = new CoopAudio(scene);
}

export class CoopAudio {
  constructor(scene) {
    this.scene = scene; this.manager = scene.multiplayerManager; this.original = scene.sound;
    this.local = new Map(); this.remote = new Map(); this.received = new Map(); this.sequence = 0;
    this.manager.coopAudioSequence = (this.manager.coopAudioSequence || 0) + 1;
    this.epoch = `${Date.now()}:${this.manager.coopAudioSequence}`;
    this.lastSend = -Infinity; this.disposed = false;
    this.mapKey = scene.sys?.settings?.key ?? scene.scene?.key;
    this.proxy = this.soundManager(() => scene.player, { range: 800, curve: "linear" });
    scene.sound = this.proxy;
    this.cleanup = () => this.destroy();
    scene.events.once("shutdown", this.cleanup);
  }
  get host() { return this.manager.room?.hostId === this.manager.playerId; }
  hostTime() {
    const offset = this.scene.coopRuntime?.music?.hostOffset;
    return !this.host && Number.isFinite(offset) ? time() + offset : Date.now();
  }
  sourceScene(scene, source, profile) {
    const point = () => typeof source === "function" ? source() : source;
    const sound = this.soundManager(point, profile);
    return new Proxy(scene, { get: (target, key) => {
      if (key === "sound") return sound;
      if (key === "coopSoundRoot") return this.scene;
      if (key === "player") {
        const p = point() ?? this.scene.player;
        return { x: p?.x, y: p?.y, active: true, body: { center: p } };
      }
      if (key === "morteEmAndamento") return !!this.scene.coopRuntime?.teamDefeated;
      if (key === "cameras" && scene.cenaEntradaBossAtiva && scene.cameras?.main) {
        return { main: { ...scene.cameras.main, midPoint: point() } };
      }
      return Reflect.get(target, key);
    } });
  }
  soundManager(source, profile) {
    const bridge = this, manager = this.original;
    return new Proxy(manager, { get(target, key) {
      if (key === "add") return (name, config = {}) => bridge.add(name, config, source, profile);
      if (key === "play") return (name, config = {}) => {
        if (!shared(name)) return manager.play(name, config);
        const sound = bridge.add(name, config, source, profile);
        sound.once?.("complete", () => sound.destroy());
        const played = sound.play(config);
        if (!played) sound.destroy();
        return played;
      };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    } });
  }
  add(key, config, source, profile) {
    const sound = this.original.add(key, config);
    if (!shared(key)) return sound;
    const id = `${this.manager.playerId}:${this.epoch}:${++this.sequence}`;
    const record = { id, key, sound, source, profile, volume: config.volume ?? 1,
      revision: 0, generation: 0, status: "stopped", dirty: false };
    this.local.set(id, record);
    const bridge = this;
    record.proxy = new Proxy(sound, {
      get(target, property) {
        if (property === "volume") return record.volume;
        if (property === "play") return (...args) => {
          if (bridge.disposed || WORLD.has(key) && !bridge.host) return false;
          const options = typeof args[0] === "string" ? args[1] ?? {} : args[0] ?? {};
          record.volume = options.volume ?? record.volume;
          record.generation++;
          const p = source?.() ?? bridge.scene.player;
          const localOptions = { ...options, volume: record.volume * bridge.gain({
            x: p?.x ?? 0, y: p?.y ?? 0, profile }) };
          const result = typeof args[0] === "string" ? target.play(args[0], localOptions) : target.play(localOptions);
          if (result) { record.status = "playing"; bridge.changed(record, true); bridge.renderLocal(record); }
          return result;
        };
        if (property === "setVolume") return value => {
          record.volume = value; bridge.changed(record); bridge.renderLocal(record); return record.proxy;
        };
        if (property === "destroy") return (...args) => {
          if (record.status !== "stopped") { record.status = "stopped"; bridge.changed(record, true); }
          bridge.local.delete(id);
          return target.destroy(...args);
        };
        if (["stop", "pause", "resume"].includes(property)) return (...args) => {
          const result = target[property](...args);
          const previousStatus = record.status;
          record.status = property === "pause" ? "paused" : property === "resume" ? "playing" : "stopped";
          if (previousStatus !== record.status) bridge.changed(record, true);
          return result;
        };
        const value = Reflect.get(target, property);
        return typeof value === "function" ? value.bind(target) : value;
      },
      set(target, property, value) {
        if (property === "volume") { record.volume = value; bridge.changed(record); bridge.renderLocal(record); return true; }
        return Reflect.set(target, property, value);
      },
    });
    return record.proxy;
  }
  changed(record, immediate = false) {
    if (this.disposed) return;
    if (WORLD.has(record.key) && !this.host) return;
    record.dirty = true;
    if (immediate) this.send([record]);
  }
  state(record) {
    const s = record.sound, marker = s.currentMarker;
    const p = record.source?.() ?? this.scene.player;
    const state = { id: record.id, key: record.key, revision: ++record.revision,
      generation: record.generation, status: record.status, at: this.hostTime(),
      position: s.seek || 0, marker: marker && { name: marker.name, start: marker.start, duration: marker.duration },
      duration: marker?.duration ?? s.totalDuration, loop: !!(s.loop || s.currentConfig?.loop),
      volume: record.volume, rate: s.rate || 1, detune: s.detune || 0,
      x: p?.x ?? 0, y: p?.y ?? 0, profile: record.profile };
    record.dirty = false;
    return state;
  }
  send(records) {
    if (!records.length || !this.scene.coopRuntime || this.disposed) return;
    const payload = { mapKey: this.mapKey, owner: this.manager.playerId,
      clockSynced: this.host || Number.isFinite(this.scene.coopRuntime?.music?.hostOffset), sounds: records.map(r => this.state(r)) };
    this.manager.sendCoopAction("audio", payload, { authority: this.host });
  }
  receive(action) {
    const p = action.payload;
    if (!p || p.mapKey !== this.mapKey || !Array.isArray(p.sounds) || p.sounds.length > 64) return;
    const owner = action.authority ? p.owner : action.playerId;
    if (typeof owner !== "string" || !this.manager.room?.players.some(player => player.id === owner)) return;
    const states = p.sounds.filter(s => this.valid(s, owner, action.authority)).map(s =>
      !action.authority && !p.clockSynced ? { ...s, at: Date.now() } : s);
    if (this.host && !action.authority && states.length) {
      this.manager.sendCoopAction("audio", { mapKey: this.mapKey, owner, sounds: states }, { authority: true });
    }
    if (owner === this.manager.playerId) return;
    for (const state of states) {
      if (state.revision <= (this.received.get(state.id) ?? -1)) continue;
      this.received.set(state.id, state.revision);
      if (this.received.size > 2048) this.received.delete(this.received.keys().next().value);
      if (state.status === "stopped") { this.remove(state.id); continue; }
      const entry = this.remote.get(state.id) ?? { sound: null };
      entry.state = state; entry.owner = owner; entry.receivedAt = time(); this.remote.set(state.id, entry);
    }
    this.renderRemote();
  }
  valid(s, owner, authority) {
    return s && typeof s.id === "string" && s.id.startsWith(`${owner}:`) && s.id.length < 180 &&
      shared(s.key) && (!WORLD.has(s.key) || owner === this.manager.room.hostId) &&
      (authority || PLAYER.has(s.key)) && Number.isSafeInteger(s.revision) && s.revision > 0 &&
      Number.isSafeInteger(s.generation) && s.generation > 0 &&
      ["playing", "paused", "stopped"].includes(s.status) &&
      [s.at, s.position, s.duration, s.volume, s.rate, s.detune, s.x, s.y].every(Number.isFinite) &&
      s.duration > 0 && s.duration < 3600 && s.volume >= 0 && s.volume <= 1 &&
      s.rate > 0 && s.rate <= 32 && Math.abs(s.detune) <= 4800 &&
      Math.abs(s.x) < 100000 && Math.abs(s.y) < 100000 &&
      (!s.marker || typeof s.marker.name === "string" && [s.marker.start, s.marker.duration].every(Number.isFinite) &&
        s.marker.start >= 0 && s.marker.duration > 0);
  }
  gain(state) {
    const listener = this.scene.cenaEntradaBossAtiva && this.scene.cameras?.main?.midPoint ||
      this.scene.player?.body?.center || this.scene.player;
    const profile = state.profile ?? {}, distance = Math.hypot(state.x - (listener?.x ?? state.x), state.y - (listener?.y ?? state.y));
    const range = Number.isFinite(profile.range) ? clamp(profile.range, 1, 3000) : 800;
    if (profile.curve === "nearfield") {
      const near = clamp(profile.near ?? 0, 0, range - 1);
      return Math.max(0, 1 - Math.max(0, distance - near) / (range - near)) ** 2;
    }
    if (profile.curve === "rational") return 1 / (1 + (distance / range) ** 2);
    if (profile.curve === "hatch") return Math.max(0, 1 - distance / 1400) / (1 + (distance / 340) ** 2);
    return Math.max(0, 1 - distance / range) ** 2;
  }
  renderLocal(record) {
    const p = record.source?.() ?? this.scene.player;
    record.sound.setVolume(record.volume * this.gain({ x: p?.x ?? 0, y: p?.y ?? 0, profile: record.profile }));
    record.sound.setPan?.(clamp(((p?.x ?? 0) - (this.scene.player?.x ?? p?.x ?? 0)) / 550, -.65, .65));
  }
  renderRemote() {
    const manager = this.original;
    if (manager.locked || manager.context && manager.context.state !== "running") return;
    for (const [id, entry] of this.remote) {
      if (!this.manager.room?.players.some(p => p.id === entry.owner)) { this.remove(id); continue; }
      const s = entry.state;
      if (!this.scene.cache?.audio?.exists(s.key)) continue;
      const age = this.host || Number.isFinite(this.scene.coopRuntime?.music?.hostOffset)
        ? Math.max(0, this.hostTime() - s.at) : Math.max(0, time() - entry.receivedAt);
      let position = s.position + (s.status === "paused" ? 0 : age / 1000 * s.rate * 2 ** (s.detune / 1200));
      if (s.loop) position = ((position % s.duration) + s.duration) % s.duration;
      else if (position >= s.duration) { this.remove(id); continue; }
      if (!entry.sound) {
        entry.sound = manager.add(s.key);
        if (s.marker) entry.sound.addMarker({ ...s.marker, config: { loop: s.loop } });
      }
      const sound = entry.sound;
      let drift = Math.abs((sound.seek || 0) - position);
      if (s.loop) drift = Math.min(drift, Math.abs(s.duration - drift));
      if (entry.generation !== s.generation || !sound.isPlaying && !sound.isPaused ||
          s.status === "playing" && sound.isPaused || drift > .15) {
        const config = { seek: position, loop: s.loop, volume: s.volume * this.gain(s), rate: s.rate, detune: s.detune };
        const played = s.marker ? sound.play(s.marker.name, config) : sound.play(config);
        if (played !== false) entry.generation = s.generation;
      }
      sound.setVolume(s.volume * this.gain(s));
      const listener = this.scene.player;
      sound.setPan?.(clamp((s.x - (listener?.x ?? s.x)) / 550, -.65, .65));
      if (s.status === "paused" && sound.isPlaying) sound.pause();
    }
  }
  update() {
    if (this.disposed) return;
    const active = [];
    for (const r of this.local.values()) {
      if (r.status !== "stopped") {
        if (!r.sound.isPlaying && !r.sound.isPaused && !this.original.locked) {
          r.status = "stopped"; this.changed(r, true);
        } else { this.renderLocal(r); active.push(r); }
      }
    }
    if (time() - this.lastSend >= 100) {
      this.lastSend = time();
      const pending = active.filter(r => r.dirty || r.sound.loop || r.sound.currentConfig?.loop);
      for (let i = 0; i < pending.length; i += 64) this.send(pending.slice(i, i + 64));
    }
    this.renderRemote();
  }
  remove(id) { const entry = this.remote.get(id); entry?.sound?.stop(); entry?.sound?.destroy(); this.remote.delete(id); }
  destroy() {
    if (this.disposed) return;
    // Comunica encerramento de loops antes de remover a cena.
    for (const r of this.local.values()) if (r.status !== "stopped") { r.status = "stopped"; this.changed(r, true); }
    this.disposed = true;
    for (const id of [...this.remote.keys()]) this.remove(id);
    this.local.clear(); this.received.clear();
    if (this.scene.sound === this.proxy) this.scene.sound = this.original;
    this.scene.events.off("shutdown", this.cleanup);
    if (this.scene.coopAudio === this) this.scene.coopAudio = null;
  }
}
