import test from 'node:test';
import assert from 'node:assert/strict';
import { HOLLOW_AGENTS, buildHollowDialogue, hollowTimeline, CONNECTION } from './HollowDialogue.js';
const ids = Object.keys(HOLLOW_AGENTS);
for (const id of ids) test(`solo ${id}: seis respostas oficiais e suporte exclusivo`, () => {
  const lines = buildHollowDialogue([id], true);
  assert.deepEqual(lines.filter(l => l.character).map(l => l.text), HOLLOW_AGENTS[id].responses);
  assert.ok(lines.filter(l => l.name === 'N.O.V.A // SUPORTE').length === 3);
  assert.ok(lines.filter(l => l.character).every(l => l.character === id));
});
for (let mask = 1; mask < 16; mask++) {
  const cast = ids.filter((_, i) => mask & (1 << i));
  if (cast.length < 2) continue;
  test(`coop ${cast.join(' + ')}: elenco, ordem e distribuição`, () => {
    const lines = buildHollowDialogue(cast);
    assert.deepEqual(lines, buildHollowDialogue([...cast]));
    const replies = lines.filter(l => l.character);
    assert.deepEqual([...new Set(replies.map(l => l.character))], cast);
    assert.ok(!lines.some(l => l.name.includes('N.O.V.A')));
    for (let i = 1; i < replies.length; i++) assert.notEqual(replies[i].character, replies[i - 1].character);
    assert.ok(replies.every(l => cast.includes(l.character)));
  });
}
test('narrativa preserva objetivos, conexão, pausas e oculta o chefe final', () => {
  const { lines, duration } = hollowTimeline(ids, false);
  assert.deepEqual(lines.filter(l => l.connection).map(l => l.text), CONNECTION);
  assert.equal(lines.find(l => l.text === 'E cumpriu a promessa.').pause, 2000);
  for (const word of ['EDEN', 'AXIOM', 'RECOVER BATTERY', 'RECOVER FUEL', 'LIFE SUPPORT: PRESERVE', 'VIRUS_ZERO'])
    assert.ok(lines.some(l => l.text.includes(word)), word);
  assert.ok(!JSON.stringify(lines).includes('SENTINEL'));
  assert.ok(lines.find(l => l.purge));
  assert.equal(lines.at(-1).text, 'INICIANDO OPERAÇÃO: PROTOCOLO ZERO.');
  for (let i = 1; i < lines.length; i++) assert.equal(lines[i].start, lines[i-1].start + lines[i-1].duration);
  assert.equal(duration, lines.at(-1).start + lines.at(-1).duration);
});
test('personagem inválido não inventa um agente nem duplica o elenco', () => {
  assert.equal(buildHollowDialogue(['desconhecido']).filter(l => l.character).length, 0);
  assert.equal(buildHollowDialogue(['nyx', 'nyx']).filter(l => l.character).length, 6);
});
