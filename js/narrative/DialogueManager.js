import { TypewriterText } from './TypewriterText.js';
import { selectConversation } from './NPCDialogues.js';
import { DialogueUI } from '../ui/DialogueUI.js';
import { localPlayerId } from '../systems/UpgradeSystem.js';
import { canUseShop } from '../systems/ScrapSystem.js';

export class DialogueManager {
  constructor(scene, shop, config = {}) {
    this.scene = scene; this.shop = shop; this.config = { characterMs: 30, punctuationMs: 90, holdMs: 1000, ...config };
    this.update = (_time, delta) => {
      if (!this.active) return;
      if (!canUseShop(scene, scene.sys.settings.key) || scene.transicaoEmAndamento) return this.close();
      const dt = Math.min(100, Math.max(0, delta || 0));
      if (!this.writer.complete) { this.ui.setText(this.writer.update(dt)); this.hold = 0; }
      else if ((this.hold += dt) >= this.config.holdMs) this.next();
    };
    this.key = e => {
      if (!this.active) return;
      e.stopImmediatePropagation();
      if (['KeyE', 'Space', 'Enter', 'Escape'].includes(e.code)) e.preventDefault();
      if (e.type !== 'keydown' || e.repeat) return;
      if (e.code === 'Escape') this.close();
      else if (['KeyE', 'Space', 'Enter'].includes(e.code)) this.advance();
    };
    this.disconnect = connected => { if (connected === false) { this.close(); this.shop.close(true); } };
    this.roomClosed = () => { this.close(); this.shop.close(true); };
    scene.events.on('update', this.update);
    this.manager = scene.multiplayerManager;
    this.manager?.on('connectionChanged', this.disconnect); this.manager?.on('roomClosed', this.roomClosed);
    this.shutdown = () => this.destroy(); scene.events.once('shutdown', this.shutdown);
  }
  open() {
    const s = this.scene;
    if (this.active || s.upgradeMenuOpen || !canUseShop(s, s.sys.settings.key) || s.movimentoBloqueado || s.atacando || s.estadoDash?.ativo || s.generatorMenuOpen) return false;
    const registry = s.game.registry, key = `nullborns:npc-dialogue:${s.multiplayer ? 'coop' : 'solo'}:${localPlayerId(s)}`;
    let history = registry.get(key); if (!history) { history = {}; registry.set(key, history); }
    this.shop.dismissFarewell?.();
    this.lines = selectConversation(s.personagemSelecionada, history); this.index = 0;
    this.previous = { input: s.input.enabled, keyboard: s.input.keyboard.enabled, lock: s.movimentoBloqueado, focus: document.activeElement };
    this.active = true; s.upgradeDialogueOpen = true; s.movimentoBloqueado = true;
    s.player.setVelocity(0, 0); s.joystick?.reset?.(); s.input.keyboard.resetKeys();
    s.input.enabled = false; s.input.keyboard.enabled = false;
    this.ui = this.createUI();
    window.addEventListener('keydown', this.key, true); window.addEventListener('keyup', this.key, true);
    this.show(); return true;
  }
  createUI() { return new DialogueUI(this.scene, () => this.advance(), () => this.close()); }
  show() { this.hold = 0; this.writer = new TypewriterText(this.lines[this.index].text, this.config); this.ui.line(this.lines[this.index]); }
  advance() {
    if (!this.active) return;
    if (!this.writer.complete) { this.ui.setText(this.writer.reveal()); this.hold = 0; }
    else this.next();
  }
  next() {
    if (++this.index < this.lines.length) return this.show();
    this.close(); this.shop.open();
  }
  close() {
    if (!this.active) return;
    const s = this.scene; this.active = false; s.upgradeDialogueOpen = false;
    this.ui.destroy(); this.ui = this.writer = null;
    window.removeEventListener('keydown', this.key, true); window.removeEventListener('keyup', this.key, true);
    s.input.enabled = this.previous.input; s.input.keyboard.resetKeys(); s.input.keyboard.enabled = this.previous.keyboard;
    if (!s.morteEmAndamento && !s.transicaoEmAndamento && !s.cenaEntradaBossAtiva) s.movimentoBloqueado = this.previous.lock;
    this.previous.focus?.focus?.();
  }
  destroy() {
    this.close(); this.scene.events.off('update', this.update); this.scene.events.off('shutdown', this.shutdown);
    this.manager?.off('connectionChanged', this.disconnect); this.manager?.off('roomClosed', this.roomClosed);
    if (this.scene.upgradeDialogue === this) this.scene.upgradeDialogue = null;
  }
}
