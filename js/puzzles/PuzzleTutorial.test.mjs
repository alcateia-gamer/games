import test from 'node:test';
import assert from 'node:assert/strict';
import { HackingSession } from './HackingSession.js';
import { gerarMissao } from './MissionIntelligence.js';
const missao = checkpoint => () => ({ config: gerarMissao(41), checkpoint });

test('puzzles da fábrica iniciam no guia; leitura não avança relógio, rastro ou captura', () => {
  for (const [tipo, checkpoint] of [['fabrica', {}], ['bruteforce', {}]]) {
    const s = new HackingSession(() => {}, missao(checkpoint)); s.abrir(tipo, 'operador');
    const antes = s.snapshot(); assert.equal(antes.model.tutorial, true);
    for (let i = 0; i < 100; i++) s.atualizar(100);
    assert.deepEqual(s.snapshot(), antes);
    assert.equal(s.comando('operador', { id: antes.id, seq: 1, op: tipo === 'fabrica' ? 'selecionar' : 'capturar', valor: 0 }), false);
  }
});

test('somente operador com sessão e sequência válidas fecha o guia', () => {
  const s = new HackingSession(); s.abrir('bruteforce', 'a'); const id = s.atual.id;
  assert.equal(s.comando('b', { id, seq: 1, op: 'tutorial', valor: false }), false);
  assert.equal(s.comando('a', { id: 'antigo', seq: 1, op: 'tutorial', valor: false }), false);
  assert.equal(s.comando('a', { id, seq: 1, op: 'tutorial', valor: 'false' }), false);
  assert.equal(s.snapshot().model.tutorial, true);
  assert.ok(s.comando('a', { id, seq: 2, op: 'tutorial', valor: false }));
  assert.equal(s.comando('a', { id, seq: 2, op: 'tutorial', valor: true }), false);
  assert.ok(s.comando('a', { id, seq: 3, op: 'selecionarColuna', valor: { coluna: 0 } }));
});

test('reabrir ajuda pausa Breach já iniciado e preserva seleção e tempo restante', () => {
  const s = new HackingSession(); s.abrir('fabrica', 'a'); const id = s.atual.id;
  const cmd = (seq, op, valor) => s.comando('a', { id, seq, op, valor });
  cmd(1, 'tutorial', false); cmd(2, 'selecionar', 0); s.atualizar(100);
  const antes = s.snapshot().model; assert.ok(antes.restante < 90000);
  cmd(3, 'tutorial', true); for (let i = 0; i < 100; i++) s.atualizar(100);
  assert.equal(s.snapshot().model.restante, antes.restante);
  assert.deepEqual(s.snapshot().model.selecoes, antes.selecoes);
  cmd(4, 'tutorial', false); s.atualizar(100);
  assert.equal(s.snapshot().model.restante, antes.restante - 100);
});

test('final inicia diretamente; ajuda opcional pausa somente a etapa atual', () => {
  const config = gerarMissao(5), s = new HackingSession(() => {}, () => ({ config, checkpoint: {} }));
  s.abrir('matrix', 'a'); const id = s.atual.id; let seq = 0;
  const cmd = (op, valor) => s.comando('a', { id, seq: ++seq, op, valor });
  assert.equal(s.snapshot().model.tutorial, false); cmd('identificar', config.core);
  assert.equal(s.atual.tutorialTipo, 'memory-integridade'); cmd('tutorial', true); s.atualizar(100);
  assert.equal(s.snapshot().model.tutorial, true); assert.equal(s.snapshot().model.recuperados, 1);
  cmd('tutorial', false); config.seguranca.forEach(v => cmd('alternarIsolamento', v)); cmd('executarIsolamento');
  config.assinatura.forEach(v => cmd('adicionarFragmento', v)); cmd('validarAutorizacao');
  for (let i = 0; i < 10; i++) s.atualizar(100);
  assert.equal(s.snapshot().model.etapaTipo, 'host'); assert.equal(s.snapshot().model.tutorial, false);
  cmd('tutorial', true); const tempo = s.snapshot().model.tempo; s.atualizar(100); assert.equal(s.snapshot().model.tempo, tempo);
});

test('cancelar durante o guia libera a sessão sem recompensa nem comando atrasado', () => {
  let rewards = 0; const s = new HackingSession(() => rewards++); s.abrir('matrix', 'a'); const old = s.atual.id;
  assert.ok(s.comando('a', { id: old, seq: 1, op: 'cancelar' })); s.atualizar(100);
  assert.equal(s.snapshot(), null); assert.equal(rewards, 0);
  s.abrir('bruteforce', 'b'); assert.equal(s.comando('a', { id: old, seq: 2, op: 'tutorial', valor: false }), false);
  assert.equal(s.snapshot().model.tutorial, true);
});

test('guia automático só aparece na primeira abertura por operador e tipo', () => {
  const s = new HackingSession();
  s.abrir('fabrica', 'a');
  assert.equal(s.snapshot().model.tutorial, true);
  const { id } = s.snapshot();
  s.comando('a', { id, seq: 1, op: 'tutorial', valor: false });
  s.atual.model.estado = 'falha';
  assert.ok(s.comando('a', { id, seq: 2, op: 'reiniciar' }));
  assert.equal(s.snapshot().model.tutorial, false);
  s.cancelar('a');
  s.abrir('fabrica', 'a');
  assert.equal(s.snapshot().model.tutorial, false);
  s.cancelar('a');
  s.abrir('bruteforce', 'a');
  assert.equal(s.snapshot().model.tutorial, true);
  s.cancelar('a');
  s.abrir('fabrica', 'b');
  assert.equal(s.snapshot().model.tutorial, true);
});
