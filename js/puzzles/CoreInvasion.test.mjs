import test from 'node:test';
import assert from 'node:assert/strict';
import { gerarMissao, documentosMissao, podeEntrarBoss, feedbackAcesso } from './MissionIntelligence.js';
import { MemoryDecryption } from './MemoryDecryption.js';
import { normalizarCheckpoint } from './HackingProgress.js';
import { HostConnection, sequenciaLinha, sequenciaVisivel } from './HostConnection.js';
import { CoreInvasion } from './CoreInvasion.js';
import { BruteforcePuzzle, lerColuna } from './BruteforcePuzzle.js';
import { HackingSession } from './HackingSession.js';
import { mergeCoopProgress } from '../multiplayer/CoopProtocol.js';
function completar(p, c = p.config) {
  p.acao('identificar', c.core);
  c.seguranca.forEach(id => p.acao('alternarIsolamento', id)); p.acao('executarIsolamento');
  c.assinatura.forEach(part => p.acao('adicionarFragmento', part)); p.acao('validarAutorizacao');
}
function capturar(p) {
  for (let tick = 0; tick < 1000; tick++) {
    for (let linha = 0; linha < 4; linha++) for (let inicio = 0; inicio < 8; inicio++) {
      if (sequenciaLinha(p.linhas, linha, inicio).join('.') === p.alvo.join('.') && sequenciaVisivel(p.linhas, linha, inicio, p.tempo))
        return p.acao('selecionarSequencia', { linha, inicio, tempo: p.tempo });
    }
    p.atualizar(50);
  }
  assert.fail('sequência correta ausente');
}
function congelar(p) {
  for (let tick = 0; tick < 400; tick++) {
    const c = p.colunas[p.ativa], l = lerColuna(c, p.tempo);
    if (l.centralizada && l.letra === c.alvo && !c.falhaAte) return p.acao('congelar', { coluna: p.ativa, tempo: p.tempo });
    p.atualizar(50);
  }
  assert.fail('letra correta ausente');
}
test('300 sementes solucionáveis, pistas coerentes e posição do CORE variável', () => {
  const positions = new Set(), hosts = new Set();
  for (let seed = 1; seed <= 300; seed++) {
    const c = gerarMissao(seed), p = new MemoryDecryption(c);
    assert.deepEqual(gerarMissao(seed), c); hosts.add(c.host); positions.add(p.identificacoes.findIndex(n => n.id === c.core));
    assert.deepEqual(p.snapshot().modulos.map(m => m.status), ['CRIPTOGRAFADO', 'BLOQUEADO', 'BLOQUEADO']);
    completar(p); assert.equal(p.estado, 'sucesso'); assert.equal(p.recuperados, 3);
    const docs = documentosMissao(c, { fabrica: true, bruteforce: true }).flat().join(' ');
    for (const value of [c.host, ...c.assinatura, c.registroFisico]) assert.ok(docs.includes(value));
    assert.equal(new Set(c.nodes.map(n => n.id)).size, 5);
  }
  assert.equal(hosts.size, 300); assert.equal(positions.size, 3);
});
test('documentos são desbloqueados por terminal; quatro estados da dupla autenticação', () => {
  const config = gerarMissao(1);
  const apenasBloqueados = documentosMissao(config);
  assert.ok(apenasBloqueados.every(d => d[1].includes('ACESSO BLOQUEADO') && d[2].includes('CRIPTOGRAFADO')));
  assert.equal(apenasBloqueados.some(d => d[2].includes(config.host) || d[2].includes(config.chave[0])), false);
  const fabrica = documentosMissao(config, { fabrica: true });
  assert.ok(!fabrica.some(d => d[1].includes('EDEN_NETWORK_ARCHIVE') || d[2].includes('Elias Voss')));
  assert.ok(fabrica.some(d => d[1].includes('ACESSO BLOQUEADO · REGISTRO DA AXIOM')));
  assert.ok(fabrica.some(d => d[2].includes(config.cauda)), 'a pista de autenticação continua disponível');
  assert.ok(fabrica.some(d => d[1].includes('ACESSO BLOQUEADO · TERMINAL 02')));
  assert.equal(fabrica.some(d => d[1].includes('ESCAPE_PROTOCOL')), false);
  const bruteforce = documentosMissao(config, { bruteforce: true });
  assert.ok(bruteforce.some(d => d[1].includes('ESCAPE_PROTOCOL')));
  assert.ok(bruteforce.some(d => d[1].includes('ACESSO BLOQUEADO · TERMINAL 01')));
  assert.equal(bruteforce.some(d => d[2].includes(config.cauda)), false);
  const ambos = documentosMissao(config, { fabrica: true, registro: true, bruteforce: true });
  assert.ok(ambos.some(d => d[1].includes('EDEN_NETWORK_ARCHIVE')));
  assert.ok(ambos.some(d => d[1].includes('ESCAPE_PROTOCOL')));
  assert.ok(!ambos.some(d => d[1].includes('ACESSO BLOQUEADO')));
  for (const card of [false, true]) for (const digital of [false, true]) {
    const r = new Map([['bossAccessCardAuthenticated', card], ['factoryBruteforceComplete', digital]]);
    assert.equal(podeEntrarBoss(r), card && digital);
    assert.ok(feedbackAcesso(r).includes(card && digital ? 'CREDENCIAIS VALIDADAS' : card || digital ? 'ACESSO NEGADO' : 'AUTENTICAÇÃO DUPLA'));
  }
});
test('erros locais, ajuda progressiva e nenhuma interferência em sistemas vitais', () => {
  const c = gerarMissao(123), p = new MemoryDecryption(c);
  assert.equal(p.acao('executarIsolamento'), false); assert.equal(p.acao('identificar', 'forjado'), false);
  for (let i = 0; i < 3; i++) { p.acao('identificar', c.vitais[0]); assert.equal(p.recuperados, 0); }
  assert.match(p.mensagem, /N.O.V.A./); assert.equal(p.erros[0], 3);
  p.acao('identificar', c.core); p.acao('alternarIsolamento', c.vitais[0]); p.acao('executarIsolamento');
  assert.equal(p.recuperados, 1); assert.equal(p.snapshot().suporteVida, 'STABLE');
  p.acao('alternarIsolamento', c.vitais[0]); c.seguranca.forEach(id => p.acao('alternarIsolamento', id)); p.acao('executarIsolamento');
  assert.equal(p.recuperados, 2); p.acao('validarAutorizacao'); assert.equal(p.recuperados, 2);
  p.acao('adicionarFragmento', c.assinatura[0]); assert.equal(p.acao('adicionarFragmento', c.assinatura[0]), false);
  p.acao('removerFragmento', 0); assert.deepEqual(p.sequencia, []);
  [...c.assinatura].reverse().forEach(v => p.acao('adicionarFragmento', v)); p.acao('validarAutorizacao'); assert.equal(p.recuperados, 2);
  p.acao('limparFragmentos'); c.assinatura.forEach(v => p.acao('adicionarFragmento', v)); p.acao('validarAutorizacao'); assert.equal(p.estado, 'sucesso');
});
test('checkpoint migra saves antigos e preserva somente módulos confirmados', () => {
  assert.deepEqual(normalizarCheckpoint({ network: true, hostPasso: 4 }), { memoryModules: 3, hostConnected: false });
  assert.deepEqual(normalizarCheckpoint({ network: true, hostPasso: 7 }), { memoryModules: 3, hostConnected: true });
  assert.deepEqual(normalizarCheckpoint({ memoryModules: 2, hostConnected: true }), { memoryModules: 2, hostConnected: false });
});
test('bruteforce congela oito colunas no momento certo e remove as operações antigas', () => {
  for (let seed = 1; seed < 50; seed++) {
    const p = new BruteforcePuzzle(seed);
    for (const op of ['simbolo', 'apagar', 'recuperar']) assert.equal(p.acao(op, 'A'), false);
    for (let i = 0; i < 8; i++) { assert.ok(congelar(p)); assert.equal(p.ativa, i + 1); }
    assert.equal(p.estado, 'sucesso'); assert.equal(p.colunas.map(c => c.confirmada).join(''), p.senha);
    assert.equal(p.acao('congelar', { coluna: 7 }), false);
  }
});
test('host tem uma busca numérica, checkpoints e transmissão única', () => {
  for (const seed of [1, 12, 97]) {
    const c = gerarMissao(seed), p = new HostConnection(c);
    assert.equal(p.acao('capturar', 'FORJADO'), false);
    assert.ok(p.acao('selecionarSequencia', { linha: 0, inicio: 0 })); assert.equal(p.passo, 0); assert.ok(p.rastro > 0);
    for (let i = 0; i < 1; i++) { assert.ok(p.alvo.every(v => /^\d{2}$/.test(v))); assert.ok(capturar(p)); assert.equal(p.passo, i + 1); }
    assert.equal(p.estado, 'executando'); p.atualizar(6500);
    assert.equal(p.estado, 'sucesso'); assert.equal(p.transmissao, 1); assert.equal(p.acao('selecionarSequencia', { linha: 0, inicio: 0 }), false);
  }
});
test('cada módulo persiste no comando e outro operador retoma sem repetir acertos', () => {
  const c = gerarMissao(10); let checkpoint = {}, done = 0;
  const s = new HackingSession(() => done++, () => ({ config: c, checkpoint }), cp => { checkpoint = cp; });
  for (let step = 0; step < 3; step++) {
    s.abrir('matrix', 'a'); let seq = 0; const id = s.atual.id, cmd = (op, valor) => s.comando('a', { id, seq: ++seq, op, valor });
    assert.equal(s.atual.model.model.recuperados, step);
    if (step === 0) cmd('identificar', c.core);
    if (step === 1) { c.seguranca.forEach(v => cmd('alternarIsolamento', v)); cmd('executarIsolamento'); }
    if (step === 2) { c.assinatura.forEach(v => cmd('adicionarFragmento', v)); cmd('validarAutorizacao'); }
    assert.equal(checkpoint.memoryModules, step + 1); s.cancelar('a'); assert.equal(done, 0);
    assert.equal(s.comando('a', { id, seq: 999, op: 'identificar', valor: c.core }), false);
  }
  s.abrir('matrix', 'b'); assert.equal(s.snapshot().model.etapaTipo, 'host');
  capturar(s.atual.model.model); s.atualizar(1); assert.equal(checkpoint.hostConnected, true);
  for (let i = 0; i < 80; i++) s.atualizar(100); assert.equal(done, 1);
});
test('transição curta libera HOST somente depois dos três arquivos', () => {
  const p = new CoreInvasion(gerarMissao(10)); completar(p); assert.equal(p.snapshot().estado, 'transicao');
  for (let i = 0; i < 8; i++) p.atualizar(100); assert.equal(p.snapshot().etapaTipo, 'memory');
  p.atualizar(100); assert.equal(p.snapshot().etapaTipo, 'host');
});
test('bruteforce tem operador único; comandos inválidos/repetidos não concedem recompensa', () => {
  let done = 0; const s = new HackingSession(() => done++); s.abrir('bruteforce', 'a'); const id = s.atual.id;
  s.comando('a', { id, seq: 1, op: 'tutorial', valor: false });
  assert.equal(s.abrir('matrix', 'b'), false); assert.equal(s.comando('b', { id, seq: 2, op: 'selecionarColuna', valor: { coluna: 0 } }), false);
  assert.ok(s.comando('a', { id, seq: 2, op: 'selecionarColuna', valor: { coluna: 0 } })); assert.equal(s.comando('a', { id, seq: 2, op: 'selecionarColuna', valor: { coluna: 0 } }), false);
  s.cancelar('a'); s.atualizar(100); assert.equal(done, 0); assert.ok(s.abrir('bruteforce', 'b'));
});
test('réplica atrasada não desfaz checkpoint nem troca a configuração da tentativa', () => {
  const config = gerarMissao(50), newer = { intelligence: { config, checkpoint: { memoryModules: 2, hostConnected: false } } };
  const m = mergeCoopProgress(newer, { intelligence: { config, checkpoint: {} } });
  assert.equal(m.intelligence.checkpoint.memoryModules, 2); assert.equal(m.intelligence.checkpoint.hostConnected, false);
  assert.equal(mergeCoopProgress(m, { intelligence: { config: gerarMissao(2), checkpoint: {} } }).intelligence.config.seed, 50);
});
test('migração de flags e checkpoints mantém um único estado monotônico', () => {
  const config = gerarMissao(3);
  const old = { flags: { networkReconstructionComplete: true }, intelligence: { config, checkpoint: { network: true, hostPasso: 7 } } };
  const merged = mergeCoopProgress(old, { intelligence: { config, checkpoint: { memoryModules: 1 } } });
  assert.equal(merged.flags.memoryDecryptionComplete, true);
  assert.equal('networkReconstructionComplete' in merged.flags, false);
  assert.deepEqual(merged.intelligence.checkpoint, { memoryModules: 3, hostConnected: true });
  assert.deepEqual(mergeCoopProgress({}, old).intelligence.checkpoint, { memoryModules: 3, hostConnected: true });
});
