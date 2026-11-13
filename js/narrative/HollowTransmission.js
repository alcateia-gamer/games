import { HollowDialogueAudio } from '../sounds/HollowDialogueAudio.js';
import { validHollowSession } from '../multiplayer/HollowSession.js';
import { hollowTimeline, validCast } from './HollowDialogue.js';
import { HollowMessenger } from '../ui/HollowMessenger.js';

/** Sequência local, coordenada pela barreira de prontidão já armazenada na sala. */
export class HollowTransmission {
  constructor({ screen, game, character, multiplayer, onComplete, onCancel, onSkipVideo, onStatus }) {
    Object.assign(this, { screen, game, character, multiplayer, onComplete, onCancel, onSkipVideo, onStatus });
    this.audio = new HollowDialogueAudio(game);
    this.manager = multiplayer ? game.registry.get('multiplayer') : null;
    this.onRoom = () => this.sync();
    this.onClosed = () => { if (!this.destroyed) this.onCancel(); };
    this.manager?.on('roomUpdated', this.onRoom);
    this.manager?.on('roomClosed', this.onClosed);
    this.timer = window.setInterval(() => this.update(), 40);
  }

  prepare() {
    if (this.prepared || this.destroyed) return;
    this.prepared = true;
    try { this.view = new HollowMessenger(this.screen, () => this.audio.word()); }
    catch (error) { console.warn('Interface The Hollow indisponível:', error); }
    this.view?.wait('ESTABELECENDO CONEXÃO…');
    if (!this.multiplayer) this.begin(validCast([this.character]), true, Date.now());
    else this.sync();
  }

  send(type) {
    const m = this.manager, state = m?.room?.hollow;
    if (!state) return;
    const action = { type, playerId: m.playerId, sessionId: state.id };
    if (m.room.hostId === m.playerId) m.receiveAction(action);
    else m.publishAction(action, { qos: 1, retain: false });
  }

  ready() { this.assetsReady = true; this.sync(); }

  sync() {
    if (this.destroyed || !this.multiplayer) return;
    const m = this.manager, room = m?.room, state = room?.hollow;
    if (!room || !validHollowSession(state) || !room.players.some(p => p.id === m.playerId)) { this.onClosed(); return; }
    const offset = room.hostId === m.playerId ? 0 : (m.hollowClockOffset || 0);
    this.releaseLocalAt = state.releaseAt ? state.releaseAt - offset : null;
    this.onStatus?.(`PULAR TRANSMISSÃO · ${room.players.filter(p => state.skipped.includes(p.id)).length}/${room.players.length} VOTOS`);
    if (state.skipApproved && !this.prepared) this.onSkipVideo();
    if (this.prepared && this.assetsReady && !state.ready.includes(m.playerId) && Date.now() >= (this.nextReady || 0)) {
      this.nextReady = Date.now() + 2500;
      this.send('hollow_ready');
    }
    if (this.voteRequested && !state.skipped.includes(m.playerId) && Date.now() >= (this.nextVote || 0)) {
      this.nextVote = Date.now() + 2500;
      this.send('hollow_skip');
    }
    if (this.sentDone && !state.done.includes(m.playerId) && Date.now() >= (this.nextDone || 0)) {
      this.nextDone = Date.now() + 2500;
      this.send('hollow_done');
    }
    if (this.prepared && state.startAt && !this.timeline) this.begin(state.cast, false, state.startAt - offset);
    else if (this.prepared && !state.startAt) this.view?.wait('AGUARDANDO ASSINATURAS DOS AGENTES…');
  }

  begin(cast, solo, startAt) {
    this.timeline = hollowTimeline(cast, solo);
    this.startAt = startAt;
    this.index = -1;
    this.jump = 0;
  }

  update() {
    if (this.destroyed || this.completed) return;
    if (this.multiplayer && !this.manager?.room) { this.onClosed(); return; }
    if (this.releaseLocalAt && Date.now() >= this.releaseLocalAt) { this.complete(); return; }
    if (this.multiplayer && Date.now() >= (this.nextSync || 0)) {
      this.nextSync = Date.now() + 1000;
      this.sync();
      if (this.destroyed) return;
    }
    if (!this.timeline) return;
    try { this.tick(); }
    catch (error) {
      // Um efeito visual defeituoso não bloqueia o relógio nem a barreira final.
      console.warn('Efeito The Hollow desativado:', error);
      this.view?.destroy(); this.view = null;
    }
  }

  tick() {
    const elapsed = Date.now() - this.startAt + this.jump;
    const { lines, duration } = this.timeline;
    if (elapsed >= duration) {
      if (this.multiplayer) {
        this.view?.wait('MISSÃO CONFIRMADA · AGUARDANDO EQUIPE…');
        if (!this.sentDone) { this.sentDone = true; this.nextDone = Date.now() + 2500; this.send('hollow_done'); }
      } else this.complete();
      return;
    }
    const next = lines.findIndex(line => elapsed >= line.start && elapsed < line.start + line.duration);
    if (next < 0) return;
    // Aba suspensa alcança o relógio compartilhado sem reproduzir notificações em lote.
    for (let i = this.index + 1; i <= next; i++) {
      if (i > 0) this.view?.progress(lines[i - 1], 1, true);
      this.view?.show(lines[i], i, i < next);
    }
    this.index = next;
    const line = lines[next];
    this.view?.progress(line, this.revealed === next || !line.typing ? 1 : Math.min(1, (elapsed - line.start) / line.typing), this.revealed === next);
  }

  advance() {
    if (!this.timeline || this.index < 0 || this.destroyed || this.sentDone) return;
    const line = this.timeline.lines[this.index];
    const elapsed = Date.now() - this.startAt + this.jump;
    if (this.revealed !== this.index && elapsed < line.start + line.typing) this.revealed = this.index;
    else if (!this.multiplayer) this.jump += Math.max(0, line.start + line.duration - elapsed);
    this.update();
  }

  skip() {
    if (this.multiplayer) { this.voteRequested = true; this.sync(); }
    else this.complete();
  }

  complete() {
    if (this.completed || this.destroyed) return;
    this.completed = true;
    window.clearInterval(this.timer);
    this.onComplete();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    window.clearInterval(this.timer);
    this.manager?.off('roomUpdated', this.onRoom);
    this.manager?.off('roomClosed', this.onClosed);
    this.audio?.destroy();
    this.view?.destroy();
  }
}
