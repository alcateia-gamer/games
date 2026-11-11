/** Replica a trilha do host; efeitos espaciais e volume geral continuam locais. */
import { iniciarMusicaCidade } from "../sounds/musicaCidade.js";
import { iniciarMusicaFabrica } from "../sounds/musicaFabrica.js";

const KEYS = ["musica-novo-boss", "musica-fabrica", "musica-cidade"];
const DRIFT_SECONDS = 0.08;
const now = () => performance.now();

export function musicPosition(state, elapsed = 0) {
  let position = state.position + (state.paused ? 0 : Math.max(0, elapsed) * state.rate);
  if (state.end > state.start && position >= state.end)
    position = state.start + (position - state.start) % (state.end - state.start);
  return position;
}

export class CoopMusic {
  constructor(runtime) {
    this.r = runtime; this.scene = runtime.scene;
    this.ids = new WeakMap(); this.sequence = 0;
    this.lastPing = -Infinity; this.bestRtt = Infinity;
    this.replica = null; this.state = null;
  }
  sounds() {
    const manager = this.scene.sound;
    return KEYS.flatMap(key => manager?.getAll?.(key) || (manager?.sounds || []).filter(s => s.key === key))
      .filter(s => !s.pendingRemove);
  }
  snapshot() {
    const sound = this.sounds().find(s => s.isPlaying || s.isPaused);
    if (!sound) return null;
    if (!this.ids.has(sound)) this.ids.set(sound, ++this.sequence);
    const marker = sound.currentMarker;
    const start = marker?.start || 0, end = marker ? start + marker.duration : sound.totalDuration;
    return { id: this.ids.get(sound), key: sound.key, at: Date.now(),
      position: musicPosition({ position: start + sound.seek, start, end, paused: true }),
      start, end, marker: marker?.name || null,
      paused: !!sound.isPaused || this.scene.sound.locked === true ||
        !!(this.scene.sound.context && this.scene.sound.context.state !== "running"),
      // AudioParam.value pode refletir o ganho padrão antes do primeiro bloco
      // de áudio. Os controladores fornecem o volume da entrada já agendada.
      volume: sound.coopMusicVolume?.() ?? sound.volumeNode?.gain?.value ?? sound.volume,
      rate: sound.totalRate || sound.rate || 1 };
  }
  receive(state, stream) {
    if (this.r.host) return;
    if (!state) { this.state = null; this.stopReplica(); return; }
    if (!KEYS.includes(state.key) || ![state.position, state.at, state.start, state.end, state.volume, state.rate]
      .every(Number.isFinite) || state.end <= state.start || state.rate <= 0) return;
    this.state = { ...state, identity: `${stream}:${state.id}:${state.key}:${state.marker ?? ""}:${state.start}:${state.end}` };
    // Encerra a faixa anterior mesmo se o áudio estiver suspenso ou a nova ainda carregar.
    if (this.replica && this.identity !== this.state.identity) this.stopReplica();
    this.receivedAt = now();
    this.update();
  }
  receiveClock(action) {
    const p = action.payload || {};
    if (!Number.isFinite(p.sentAt)) return;
    if (!action.authority && this.r.host) {
      this.r.manager.sendCoopAction("musicClock", { sentAt: p.sentAt, hostTime: Date.now() },
        { authority: true, targetId: action.playerId });
    } else if (action.authority && !this.r.host && Number.isFinite(p.hostTime)) {
      const received = now(), rtt = received - p.sentAt;
      if (rtt >= 0 && rtt <= this.bestRtt) {
        this.bestRtt = rtt;
        this.hostOffset = p.hostTime - (p.sentAt + received) / 2;
      }
    }
  }
  update() {
    if (this.r.host) return;
    const instant = now();
    if (instant - this.lastPing > 10000) {
      this.lastPing = instant;
      this.r.manager.sendCoopAction("musicClock", { sentAt: instant });
    }
    const s = this.state, manager = this.scene.sound;
    if (!s || !manager || manager.locked || manager.context && manager.context.state !== "running") return;
    if (!this.scene.cache.audio.exists(s.key)) return;
    const elapsed = Number.isFinite(this.hostOffset) ? (instant + this.hostOffset - s.at) / 1000 :
      (instant - this.receivedAt) / 1000;
    const position = musicPosition(s, elapsed);
    if (!this.replica || this.identity !== s.identity || this.replica.pendingRemove) {
      this.stopReplica();
      this.replica = manager.add(s.key, { loop: true, volume: s.volume });
      this.identity = s.identity;
      if (s.marker) this.replica.addMarker({ name: s.marker, start: s.start,
        duration: s.end - s.start, config: { loop: true } });
      this.play(position);
    } else {
      const sound = this.replica, current = (sound.currentMarker?.start || 0) + sound.seek;
      let drift = Math.abs(current - position);
      if (current >= s.start && position >= s.start) drift = Math.min(drift, Math.abs(s.end - s.start - drift));
      // Recomeçar o marcador aceita o seek negativo da introdução; setSeek o limita a zero.
      if ((!sound.isPlaying && !sound.isPaused) || !s.paused && sound.isPaused || drift > DRIFT_SECONDS)
        this.play(position);
    }
    this.replica.setVolume(s.volume);
    if (s.paused && this.replica.isPlaying) this.replica.pause();
  }
  play(position) {
    const s = this.state, config = { loop: true, volume: s.volume, rate: s.rate, seek: position - s.start };
    if (s.marker) this.replica.play(s.marker, config);
    else this.replica.play(config);
    this.corrections = (this.corrections || 0) + 1;
  }
  stopReplica() {
    this.replica?.stop(); this.replica?.destroy();
    this.replica = null; this.identity = null;
  }
  changeAuthority(host) {
    this.state = null; this.hostOffset = undefined; this.bestRtt = Infinity; this.lastPing = -Infinity;
    this.stopReplica();
    if (host) {
      if (this.r.mapKey === "Level1") iniciarMusicaCidade(this.scene);
      else iniciarMusicaFabrica(this.scene);
    } else {
      for (const sound of this.sounds()) {
        if (sound.coopMusicControl) sound.coopMusicControl.destruir();
        else if (sound.coopMusicStop) sound.coopMusicStop();
        else { sound.stop(); sound.destroy(); }
      }
    }
  }
  destroy() { this.state = null; this.stopReplica(); }
}
