import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { TypewriterText } from './TypewriterText.js';
import { NPC_DIALOGUES, selectConversation } from './NPCDialogues.js';
import { DialogueManager } from './DialogueManager.js';
import { UPGRADE_NPC } from '../systems/UpgradeBalance.js';

for (const id of Object.keys(NPC_DIALOGUES)) test(`${id}: primeiro encontro, quatro variações e nenhuma repetição consecutiva`, () => {
  const history = {};
  assert.equal(selectConversation(id, history), NPC_DIALOGUES[id].first);
  const seen = new Set(); let previous;
  for (let n = 0; n < 100; n++) {
    const lines = selectConversation(id, history, () => (n % 10) / 10);
    assert.notEqual(lines, previous); previous = lines; seen.add(lines);
    assert.deepEqual(lines.map(l => l.speaker), ['npc', 'player', 'npc']);
  }
  assert.equal(seen.size, 4);
});
test('typewriter conserva Unicode, respeita 30ms, pausa de pontuação e revela sem avançar', () => {
  const w = new TypewriterText('É, ação… 🔧');
  assert.equal(w.update(29), ''); assert.equal(w.update(1), 'É');
  assert.equal(w.update(30), 'É,'); assert.equal(w.update(119), 'É,');
  assert.equal(w.update(1), 'É, ');
  assert.equal(w.reveal(), 'É, ação… 🔧'); assert.equal(w.complete, true);
});
function fixture(id = 'p1', registry = new Map()) {
  const scene = {
    multiplayer: true, multiplayerManager: Object.assign(new EventEmitter(), { playerId: id, room: {} }),
    personagemSelecionada: id === 'p1' ? 'kai-mercer' : 'nyx', game: { registry },
    sys: { settings: { key: 'Level1' } }, events: new EventEmitter(), vida: 100,
    player: { ...UPGRADE_NPC, active: true, setVelocity() {} },
    input: { enabled: true, keyboard: { enabled: true, resetKeys() {} } },
  };
  const shop = { count: 0, open() { this.count++; return true; }, close() {} };
  const manager = new DialogueManager(scene, shop);
  manager.createUI = () => ({ line(l) { this.current = l; }, setText(t) { this.text = t; }, destroy() { this.destroyed = true; } });
  return { scene, shop, manager };
}
const listeners = new Map();
globalThis.document = { activeElement: null };
globalThis.window = {
  addEventListener(k, f) { if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(f); },
  removeEventListener(k, f) { listeners.get(k)?.delete(f); },
};
test('sequência automática completa, abre a loja e restaura input', () => {
  const { scene, shop, manager } = fixture();
  assert.equal(manager.open(), true);
  for (let i = 0; i < 1000 && manager.active; i++) scene.events.emit('update', i * 100, 100);
  assert.equal(manager.active, false); assert.equal(shop.count, 1);
  assert.equal(scene.input.enabled, true); assert.equal(scene.movimentoBloqueado, undefined);
  assert.equal(listeners.get('keydown').size, 0); manager.destroy();
});
test('um clique revela; segundo clique avança; E repetido e keyup não avançam', () => {
  const { manager } = fixture(); manager.open();
  manager.advance(); assert.equal(manager.index, 0); assert.equal(manager.writer.complete, true);
  manager.advance(); assert.equal(manager.index, 1); assert.equal(manager.writer.index, 0);
  for (const event of [{ type: 'keyup' }, { type: 'keydown', repeat: true }]) manager.key({ ...event, code: 'KeyE', preventDefault() {}, stopImmediatePropagation() {} });
  assert.equal(manager.index, 1); assert.equal(manager.writer.index, 0); manager.destroy();
});
test('dois jogadores mantêm sequência e histórico independentes, desconexão limpa só a própria UI', () => {
  const registry = new Map(), a = fixture('p1', registry), b = fixture('p2', registry);
  a.manager.open(); b.manager.open(); const uiA = a.manager.ui, uiB = b.manager.ui;
  a.manager.advance(); a.manager.advance();
  assert.equal(a.manager.index, 1); assert.equal(b.manager.index, 0);
  assert.notEqual(a.manager.lines, b.manager.lines); assert.equal(registry.size, 2);
  a.scene.multiplayerManager.emit('connectionChanged', false);
  assert.equal(uiA.destroyed, true); assert.equal(a.manager.writer, null);
  assert.equal(b.manager.active, true); assert.equal(uiB.destroyed, undefined);
  a.manager.destroy(); b.manager.destroy(); assert.equal(listeners.get('keydown').size, 0);
});
test('abrir/fechar repetidamente, morte, distância e shutdown cancelam o avanço', () => {
  const { manager, scene, shop } = fixture();
  for (let i = 0; i < 15; i++) { assert.equal(manager.open(), true); manager.close(); }
  assert.equal(scene.events.listenerCount('update'), 1); assert.equal(listeners.get('keydown').size, 0);
  manager.open(); scene.vida = 0; scene.events.emit('update', 0, 30); assert.equal(manager.active, false);
  scene.vida = 100; manager.open(); scene.player.x += 100; scene.events.emit('update', 0, 30); assert.equal(manager.active, false);
  scene.player.x -= 100; manager.open(); const ui = manager.ui; scene.events.emit('shutdown');
  assert.equal(ui.destroyed, true); assert.equal(scene.events.listenerCount('update'), 0);
  assert.equal(scene.multiplayerManager.listenerCount('connectionChanged'), 0); assert.equal(shop.count, 0);
});
