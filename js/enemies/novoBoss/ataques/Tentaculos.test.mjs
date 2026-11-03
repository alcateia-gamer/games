import assert from "node:assert/strict";
import test from "node:test";
import { criarTentaculos } from "./Tentaculos.js";

function preparar(config = {}, extras = {}) {
  const avisos = [];
  const capturas = [];
  const liberacoes = [];
  const danos = [];
  const encontro = { x: 0, y: 0, config: {
    arena: { xMin: -500, xMax: 500, yMin: -500, yMax: 500 },
  } };
  const scene = { player: { x: 40, y: 20 } };
  let semente = 12345;
  const servicos = {
    rng() { semente = (semente * 1664525 + 1013904223) >>> 0; return semente / 4294967296; },
    criarAviso(x, y, raio) {
      const aviso = { x, y, raio, destruicoes: 0,
        atualizar(progresso) { this.progresso = progresso; },
        destruir() { this.destruicoes++; },
      };
      avisos.push(aviso);
      return aviso;
    },
    pontoLivre: () => true,
    jogadorAtingeCirculo: (x, y, raio) => Math.hypot(x - scene.player.x, y - scene.player.y) <= raio,
    capturarJogador(id, duracao) { capturas.push({ id, duracao }); return true; },
    liberarJogador(id) { liberacoes.push(id); },
    danoJogador(...args) { danos.push(args); },
    ...extras,
  };
  const ataque = criarTentaculos(scene, encontro, config, servicos);
  return { ataque, scene, encontro, avisos, capturas, liberacoes, danos };
}

test("tentáculos criam três marcas livres separadas e congelam a marca direcionada", () => {
  const c = preparar();
  const antes = c.ataque.snapshot().armadilhas;
  assert.equal(antes.length, 3);
  assert.equal(c.avisos.length, 3);
  assert.deepEqual({ x: antes[0].x, y: antes[0].y }, { x: 40, y: 20 });
  c.scene.player.x = 400;
  c.scene.player.y = 400;
  c.ataque.atualizar(500);
  assert.deepEqual(c.ataque.snapshot().armadilhas.map(({ x, y }) => ({ x, y })), antes.map(({ x, y }) => ({ x, y })));
  for (let i = 0; i < antes.length; i++) {
    assert.ok(antes[i].x >= -482 && antes[i].x <= 482);
    assert.ok(antes[i].y >= -482 && antes[i].y <= 482);
    for (let j = i + 1; j < antes.length; j++) {
      assert.ok(Math.hypot(antes[i].x - antes[j].x, antes[i].y - antes[j].y) >= 48);
    }
  }
});

test("durante o aviso não captura nem causa dano", () => {
  const c = preparar();
  assert.equal(c.ataque.atualizar(999), false);
  assert.equal(c.capturas.length, 0);
  assert.ok(c.ataque.snapshot().armadilhas.every((a) => !a.ativa));
  assert.ok(c.avisos.every((a) => a.destruicoes === 0));
  c.ataque.atualizar(1);
  assert.equal(c.capturas.length, 1);
  assert.equal(c.capturas[0].duracao, 2500);
  assert.ok(c.avisos.every((a) => a.destruicoes === 1));
  assert.deepEqual(c.danos, []);
});

test("libera o agarrão em 2,5 segundos e a mesma armadilha não recaptura", () => {
  const c = preparar();
  c.ataque.atualizar(1000);
  const id = c.capturas[0].id;
  c.ataque.atualizar(2499);
  assert.deepEqual(c.liberacoes, []);
  c.ataque.atualizar(1);
  assert.deepEqual(c.liberacoes, [id]);
  c.ataque.atualizar(500);
  assert.equal(c.capturas.length, 1);
  assert.deepEqual(c.danos, []);
});

test("captura no fim da janela ativa mantém os 2,5 segundos completos", () => {
  const c = preparar();
  const alvo = { ...c.scene.player };
  c.scene.player.x = 490;
  c.scene.player.y = 490;
  c.ataque.atualizar(4400);
  assert.equal(c.capturas.length, 0);
  Object.assign(c.scene.player, alvo);
  c.ataque.atualizar(50);
  assert.equal(c.capturas.length, 1);
  assert.equal(c.ataque.atualizar(50), false);
  c.ataque.atualizar(2449);
  assert.equal(c.liberacoes.length, 0);
  assert.equal(c.ataque.atualizar(1), true);
  assert.equal(c.liberacoes.length, 1);
});

test("sair, morrer, mudar de fase ou cancelar libera somente fontes próprias e é idempotente", () => {
  const c = preparar();
  c.ataque.atualizar(1000);
  const id = c.capturas[0].id;
  c.ataque.destruir();
  c.ataque.destruir();
  assert.deepEqual(c.liberacoes, [id]);
  assert.equal(c.ataque.atualizar(9999), true);
  assert.deepEqual(c.liberacoes, [id]);
  assert.ok(c.avisos.every((a) => a.destruicoes === 1));
});

test("IDs de agarrão não colidem entre execuções independentes", () => {
  const c = preparar();
  const d = preparar();
  c.ataque.atualizar(1000);
  d.ataque.atualizar(1000);
  assert.notEqual(c.capturas[0].id, d.capturas[0].id);
});

test("cancelar antes da captura remove todos os avisos sem liberar outros controles", () => {
  const c = preparar();
  c.ataque.destruir();
  assert.equal(c.capturas.length, 0);
  assert.equal(c.liberacoes.length, 0);
  assert.ok(c.avisos.every((a) => a.destruicoes === 1));
});

test("sem locais livres não cria tentáculos em paredes nem fica preso no sorteio", () => {
  const c = preparar({}, { pontoLivre: () => false });
  assert.equal(c.avisos.length, 0);
  assert.equal(c.ataque.snapshot().armadilhas.length, 0);
  assert.equal(c.ataque.atualizar(10000), true);
  assert.equal(c.capturas.length, 0);
});

test("nenhum perigo é aplicado retroativamente depois de expirar num delta longo", () => {
  const c = preparar();
  assert.equal(c.ataque.atualizar(10000), true);
  assert.equal(c.capturas.length, 0);
  assert.equal(c.danos.length, 0);
});

test("não consome a armadilha quando o serviço de captura recusa um alvo imune", () => {
  let imune = true;
  const capturas = [];
  const c = preparar({}, {
    capturarJogador(id, duracao) {
      if (imune) return false;
      capturas.push({ id, duracao });
      return true;
    },
  });
  c.ataque.atualizar(1000);
  assert.equal(c.ataque.snapshot().armadilhas[0].capturou, false);
  imune = false;
  c.ataque.atualizar(16);
  assert.equal(capturas.length, 1);
});
