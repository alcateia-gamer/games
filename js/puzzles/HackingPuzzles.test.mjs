import test from 'node:test';
import assert from 'node:assert/strict';
import { BreachPuzzle, BREACH } from './BreachPuzzle.js';
import { MatrixPuzzle } from './MatrixPuzzle.js';
import { HackingSession } from './HackingSession.js';
import { MATRIX_NODES as N } from './HackingConfig.js';

function solucao(puzzle) {
  const sequence = puzzle.alvos.flatMap(a => a.codigo);
  const walk = (path = [], eixo = 'linha', faixa = 0) => {
    if (path.length === sequence.length) return path;
    for (let i = 0; i < 25; i++) {
      if (path.includes(i) || puzzle.grade[i] !== sequence[path.length] ||
          (eixo === 'linha' ? Math.floor(i / 5) !== faixa : i % 5 !== faixa)) continue;
      const found = walk([...path, i], eixo === 'linha' ? 'coluna' : 'linha', eixo === 'linha' ? i % 5 : Math.floor(i / 5));
      if (found) return found;
    }
    return null;
  };
  return walk();
}
test('100 matrizes têm solução para acesso e os dois bônus sem reutilizar células', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const b = new BreachPuzzle(seed), path = solucao(b); assert.ok(path, `seed ${seed}`);
    for (const cell of path) assert.ok(b.selecionar(cell));
    assert.equal(b.estado, 'sucesso'); assert.equal(b.concluidos.length, 3);
    assert.equal(new Set(b.selecoes).size, 10);
  }
});
test('linha inicial, alternância, limites e células usadas são validados', () => {
  const b = new BreachPuzzle(19);
  for (const i of [-1, 25, 5, NaN, undefined, 1.5]) assert.equal(b.selecionar(i), false);
  assert.ok(b.selecionar(2)); assert.equal(b.eixo, 'coluna'); assert.equal(b.faixa, 2);
  assert.equal(b.selecionar(3), false); assert.equal(b.selecionar(2), false);
  assert.ok(b.selecionar(7)); assert.equal(b.eixo, 'linha'); assert.equal(b.faixa, 1);
});
test('acesso pode ser confirmado cedo, relógio começa na seleção e falhas permitem nova tentativa', () => {
  const b = new BreachPuzzle(3), path = solucao(b);
  b.atualizar(100); assert.equal(b.tempo, 0);
  path.slice(0, 4).forEach(i => b.selecionar(i)); b.finalizar(); assert.equal(b.estado, 'sucesso');
  const f = new BreachPuzzle(9); f.selecionar(0);
  for (let i = 0; i < BREACH.tempoMs / 100; i++) f.atualizar(100);
  assert.equal(f.estado, 'falha'); assert.equal(f.selecionar(5), false);
});
test('sessão só aceita seu operador, ID e ordem; conclusão não duplica recompensas', () => {
  const rewards = [], s = new HackingSession((...r) => rewards.push(r));
  assert.ok(s.abrir('fabrica', 'a')); assert.equal(s.abrir('matrix', 'b'), false);
  const id = s.atual.id, path = solucao(s.atual.model);
  assert.ok(s.comando('a', { id, seq: 1, op: 'tutorial', valor: false }));
  assert.equal(s.comando('b', { id, seq: 1, op: 'selecionar', valor: path[0] }), false);
  assert.equal(s.comando('a', { id: 'velho', seq: 1, op: 'cancelar' }), false);
  for (const [i, valor] of path.entries()) assert.ok(s.comando('a', { id, seq: i + 2, op: 'selecionar', valor }));
  s.atualizar(50); s.atualizar(50); assert.equal(rewards.length, 1);
  assert.equal(s.comando('a', { id, seq: 1, op: 'cancelar' }), false);
  for (let i = 0; i < 20; i++) s.atualizar(100);
  assert.equal(s.snapshot(), null);
});
function andar(m, destino) {
  const target = N[destino];
  for (let i = 0; i < 400; i++) {
    if (Math.hypot(m.avatar.x - target.x, m.avatar.y - target.y) < 3) return;
    const dx = target.x - m.avatar.x, dy = target.y - m.avatar.y, d = Math.hypot(dx, dy);
    m.mover(dx / d, dy / d); m.atualizar(25);
  }
  assert.fail(`não alcançou ${destino}: ${JSON.stringify(m.avatar)}`);
}
function investigar(m) {
  andar(m, 'memoria'); m.acao('instante', 4); m.acao('examinar');
  m.acao('camada', 'rede'); m.acao('examinar');
  assert.ok(m.anomalia);
}
test('memória exige duas camadas no evento anômalo e não permite ações à distância', () => {
  const m = new MatrixPuzzle(); assert.equal(m.acao('examinar'), false); assert.equal(m.acao('interagir'), false);
  andar(m, 'memoria'); m.acao('instante', 2); m.acao('examinar'); assert.equal(m.memoria.visual, false);
  m.acao('instante', 4); m.acao('examinar'); assert.equal(m.anomalia, false);
  m.acao('camada', 'rede'); m.acao('examinar'); assert.ok(m.anomalia);
});
test('percurso completo: exploração, anomalia, isoladores, rota alternativa, vírus e execução final', () => {
  const m = new MatrixPuzzle(true); investigar(m);
  andar(m, 'anomalia'); assert.ok(m.acao('interagir'));
  andar(m, 'roteador'); m.acao('interagir'); m.acao('interagir'); assert.equal(m.rota, 'desvio');
  andar(m, 'vidaA'); m.acao('interagir'); andar(m, 'vidaB'); m.acao('interagir');
  andar(m, 'comunicacao'); m.acao('interagir');
  andar(m, 'desvio'); andar(m, 'abrigo'); m.acao('interagir'); andar(m, 'entrada'); m.acao('interagir');
  assert.ok(m.virus.liberado);
  for (let i = 0; i < 600 && !['sucesso', 'falha'].includes(m.estado); i++) m.atualizar(50);
  assert.equal(m.estado, 'sucesso', m.mensagem); assert.equal(m.virus.no, 'nucleo');
  assert.deepEqual(m.vida, { A: true, B: true, preservada: true });
});
test('rota vital errada é contida sem dano humano; núcleo exige isolar os dois circuitos e comunicação', () => {
  const m = new MatrixPuzzle(); m.virus.no = 'roteador'; m.virus.liberado = true;
  m.atualizar(50); assert.equal(m.estado, 'falha'); assert.ok(m.vida.preservada);
  const a = new MatrixPuzzle();
  assert.equal(a.estadoLigacao('comunicacao', 'nucleo', 'nucleo'), 'bloqueada');
  a.vida.A = a.vida.B = true; assert.equal(a.estadoLigacao('comunicacao', 'nucleo', 'nucleo'), 'bloqueada');
  a.comunicacao = true; assert.equal(a.estadoLigacao('comunicacao', 'nucleo', 'nucleo'), 'livre');
});
test('anomalia influencia o chão e ICE tem aviso, bloqueio, interceptação e condição de falha', () => {
  const m = new MatrixPuzzle(); m.anomalia = true; m.tempo = 4000; m.avatar = { x: 324, y: 180 };
  m.atualizar(25); assert.equal(m.avatar.x, N.memoria.x); assert.ok(m.rastro > 0);
  m.estavelAte = m.tempo + 10000; assert.equal(m.estadoLigacao('anomalia', 'roteador', 'anomalia'), 'livre');
  m.tempo = 4500; assert.equal(m.estadoLigacao('', '', 'ice'), 'alerta');
  m.tempo = 6000; assert.equal(m.estadoLigacao('', '', 'ice'), 'bloqueada');
  m.virus.liberado = true; m.virus.no = 'memoria'; m.virus.x = N.memoria.x; m.virus.y = N.memoria.y;
  m.ice.x = m.avatar.x; m.ice.y = m.avatar.y;
  const rastro = m.rastro; m.atualizar(25); assert.ok(m.rastro >= rastro + 20);
  m.rastro = 100; m.atualizar(25); assert.equal(m.estado, 'falha'); assert.ok(m.vida.preservada);
});
test('comandos inválidos, frame longo e snapshots não permitem teleporte ou alteração da vida', () => {
  const m = new MatrixPuzzle();
  assert.equal(m.mover(Infinity, 1), false); assert.equal(m.acao('instante', 4), false);
  m.mover(100000, 0); m.atualizar(100000); assert.ok(m.avatar.x < N.entrada.x + 14);
  const snapshot = m.snapshot(); snapshot.vida.preservada = false; assert.ok(m.vida.preservada);
});

test('cancelar, desconectar ou reiniciar não conclui puzzles nem aceita comandos da sessão antiga', () => {
  let rewards = 0; const session = new HackingSession(() => rewards++);
  session.abrir('matrix', 'a'); const old = session.snapshot(); session.cancelar('a');
  assert.equal(session.snapshot(), null); assert.equal(rewards, 0);
  session.abrir('fabrica', 'b'); const state = session.snapshot();
  assert.equal(session.comando('a', { id: old.id, seq: 100, op: 'confirmar' }), false);
  assert.ok(session.comando('b', { id: state.id, seq: 1, op: 'tutorial', valor: false }));
  session.atual.model.estado = 'falha';
  assert.ok(session.comando('b', { id: state.id, seq: 2, op: 'reiniciar' }));
  assert.equal(session.snapshot().model.estado, 'ativo'); assert.equal(rewards, 0);
});
