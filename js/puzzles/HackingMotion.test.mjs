import test from 'node:test';
import assert from 'node:assert/strict';
import { BruteforcePuzzle, BRUTEFORCE_WORDS, lerColuna, deslocamentoLetra } from './BruteforcePuzzle.js';
import { HostConnection, sequenciaLinha, sequenciaVisivel, posicaoNumero } from './HostConnection.js';
import { gerarMissao, documentosMissao, autenticacaoNumerica } from './MissionIntelligence.js';
import { HackingSession } from './HackingSession.js';
const match = p => {
  for (let linha = 0; linha < 4; linha++) for (let inicio = 0; inicio < 8; inicio++)
    if (sequenciaLinha(p.linhas, linha, inicio).join('.') === p.alvo.join('.')) return { linha, inicio };
};
function alinhar(p, coluna = p.ativa) {
  for (let i = 0; i < 1000; i++) {
    const c = p.colunas[coluna], l = lerColuna(c, p.tempo);
    if (l.centralizada && l.letra === c.alvo && !c.falhaAte) return;
    p.atualizar(25);
  }
  assert.fail('letra verde nunca passou pela faixa');
}
test('500 senhas com oito letras, oito colunas distintas e letra correta presente em cada tambor', () => {
  const words = new Set(); assert.ok(BRUTEFORCE_WORDS.every(w => /^[A-Z]{8}$/.test(w)));
  for (let seed = 1; seed <= 500; seed++) {
    const p = new BruteforcePuzzle(seed); words.add(p.senha); assert.equal(p.colunas.length, 8);
    p.colunas.forEach((c, i) => { assert.equal(c.letras.length, 8); assert.equal(new Set(c.letras).size, 8); assert.ok(c.letras.includes(p.senha[i])); });
    assert.ok(p.colunas[0].passoMs > p.colunas[7].passoMs);
  }
  assert.equal(words.size, BRUTEFORCE_WORDS.length);
});
test('oito colunas se movem; o instante decide a letra; erro congela brevemente e permite nova tentativa', () => {
  const p = new BruteforcePuzzle(17);
  for (const c of p.colunas) assert.notEqual(deslocamentoLetra(c, 0, 0), deslocamentoLetra(c, 0, 100));
  alinhar(p); const instante = p.tempo;
  const errado = new BruteforcePuzzle(17); errado.atualizar(instante + errado.colunas[0].passoMs);
  assert.ok(errado.acao('congelar', { coluna: 0 })); assert.equal(errado.ativa, 0); assert.equal(errado.erros, 1);
  const c = errado.colunas[0], t = errado.tempo;
  assert.equal(deslocamentoLetra(c, 0, t), deslocamentoLetra(c, 0, t + 300));
  errado.atualizar(650); alinhar(errado); errado.acao('congelar', { coluna: 0 }); assert.equal(errado.ativa, 1);
  const parado = deslocamentoLetra(errado.colunas[0], 0, errado.tempo); errado.atualizar(9000);
  assert.equal(deslocamentoLetra(errado.colunas[0], 0, errado.tempo), parado);
  assert.ok(p.acao('congelar', { coluna: 0, tempo: instante })); assert.equal(p.ativa, 1);
});
test('bruteforce rejeita coluna futura, janela errada e instante forjado sem conceder autorização', () => {
  const p = new BruteforcePuzzle(2); alinhar(p);
  assert.equal(p.acao('congelar', { coluna: 1 }), false);
  assert.equal(p.acao('congelar', { coluna: 0, tempo: p.tempo - 1000 }), false);
  assert.equal(p.acao('congelar', { coluna: 0, tempo: p.tempo + 1000 }), false);
  p.atualizar(p.colunas[0].passoMs * (.45 - lerColuna(p.colunas[0], p.tempo).deslocamento)); p.acao('congelar', { coluna: 0 });
  assert.equal(p.ativa, 0); assert.equal(p.estado, 'ativo'); assert.equal(p.erros, 1);
});
test('movimento é independente de FPS; snapshots não alteram letras nem matriz', () => {
  const a = new BruteforcePuzzle(91), b = new BruteforcePuzzle(91); a.atualizar(1000); for (let i = 0; i < 100; i++) b.atualizar(10);
  assert.deepEqual(a.snapshot(), b.snapshot()); const view = a.snapshot(); view.colunas[0].letras[0] = '?'; assert.notEqual(a.colunas[0].letras[0], '?');
  const c = gerarMissao(91), x = new HostConnection(c), y = new HostConnection(c);
  x.atualizar(1000); for (let i = 0; i < 100; i++) y.atualizar(10); assert.deepEqual(x.snapshot(), y.snapshot());
  const snap = x.snapshot(); snap.linhas[0].numeros[0] = '??'; assert.notEqual(x.linhas[0].numeros[0], '??');
});
test('200 partidas sempre contêm sequência completa; números permanecem em ordem ao se mover', () => {
  let wraps = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const p = new HostConnection(gerarMissao(seed)), found = match(p); assert.ok(found);
    if (found.linha === 0) wraps++;
    const numbers = p.linhas.map(l => [...l.numeros]), positions = p.linhas.map((l, i) => posicaoNumero(i, 0, p.tempo)); p.atualizar(530);
    assert.deepEqual(p.linhas.map(l => l.numeros), numbers);
    p.linhas.forEach((l, i) => assert.notDeepEqual(posicaoNumero(i, 0, p.tempo), positions[i]));
    assert.deepEqual(sequenciaLinha(p.linhas, found.linha, found.inicio), p.alvo); assert.ok(p.alvo.every(n => /^\d{2}$/.test(n)));
  }
  assert.ok(wraps > 0);
});
test('HackConnect só autentica sequência certa, completa e observada recentemente', () => {
  const p = new HostConnection(gerarMissao(74)), found = match(p);
  assert.equal(p.acao('selecionarSequencia', { linha: 100, inicio: 0 }), false);
  assert.equal(p.acao('selecionarSequencia', { ...found, tempo: 999999 }), false);
  for (let i = 0; i < 1000 && sequenciaVisivel(p.linhas, found.linha, found.inicio, p.tempo); i++) p.atualizar(50);
  p.acao('selecionarSequencia', found); assert.equal(p.passo, 0); assert.match(p.mensagem, /PARCIAL/);
  for (let i = 0; i < 1000 && !sequenciaVisivel(p.linhas, found.linha, found.inicio, p.tempo); i++) p.atualizar(50);
  assert.ok(p.acao('selecionarSequencia', { ...found, tempo: p.tempo })); assert.equal(p.passo, 1);
});
test('alvos numéricos correspondem aos registros da fábrica e mudam com a partida', () => {
  const hosts = new Set();
  for (let seed = 1; seed <= 100; seed++) {
    const c = gerarMissao(seed), auth = autenticacaoNumerica(c); hosts.add(auth.host.join('.'));
    const first = documentosMissao(c, { fabrica: true }).flat().join(' '), second = documentosMissao(c, { bruteforce: true }).flat().join(' ');
    assert.ok(first.includes(c.assinatura[2]));
    assert.ok(second.includes(auth.host.join('.'))); assert.ok(second.includes(c.assinatura[0])); assert.ok(second.includes(c.assinatura[1]));
  }
  assert.equal(hosts.size, 100);
});
test('sessão só concede recompensa após oito congelamentos válidos e uma vez', () => {
  let grants = 0; const s = new HackingSession(() => grants++); s.abrir('bruteforce', 'a'); const id = s.atual.id; let seq = 0;
  const cmd = (op, valor, owner = 'a') => s.comando(owner, { id, seq: ++seq, op, valor });
  cmd('tutorial', false); assert.equal(cmd('congelar', { coluna: 0 }, 'b'), false); assert.equal(grants, 0);
  for (let coluna = 0; coluna < 8; coluna++) { alinhar(s.atual.model); assert.ok(cmd('congelar', { coluna })); if (coluna < 7) { s.atualizar(20); assert.equal(grants, 0); } }
  s.atualizar(20); s.atualizar(20); assert.equal(grants, 1);
});

test('acerto do HackConnect é salvo no comando, mesmo se cancelar antes do próximo frame', async () => {
  const { CoreInvasion } = await import('./CoreInvasion.js'); const config = gerarMissao(41); let checkpoint;
  const core = new CoreInvasion(config, { network: true }, cp => { checkpoint = cp; });
  const p = core.model, found = match(p);
  while (!sequenciaVisivel(p.linhas, found.linha, found.inicio, p.tempo)) p.atualizar(50);
  assert.ok(core.acao('selecionarSequencia', { ...found, tempo: p.tempo }));
  assert.equal(checkpoint.hostConnected, true);
  const resumed = new CoreInvasion(config, checkpoint); assert.equal(resumed.model.passo, 1);
});


test('HOST fica parado entre passos de 1000 ms, sobe no fim da linha e volta pela base', () => {
  assert.deepEqual(posicaoNumero(3, 0, 0), { linha: 3, coluna: 0 });
  assert.deepEqual(posicaoNumero(3, 0, 999), { linha: 3, coluna: 0 });
  assert.deepEqual(posicaoNumero(3, 0, 1000), { linha: 3, coluna: 1 });
  assert.deepEqual(posicaoNumero(3, 7, 1000), { linha: 2, coluna: 0 });
  assert.deepEqual(posicaoNumero(0, 7, 1000), { linha: 3, coluna: 0 });
  for (let tempo = 0; tempo <= 32000; tempo += 250) {
    const occupied = new Set();
    for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) {
      const p = posicaoNumero(row, col, tempo); occupied.add(`${p.linha}:${p.coluna}`);
    }
    assert.equal(occupied.size, 32);
  }
  assert.deepEqual(posicaoNumero(3, 0, 32000), { linha: 3, coluna: 0 });
});
