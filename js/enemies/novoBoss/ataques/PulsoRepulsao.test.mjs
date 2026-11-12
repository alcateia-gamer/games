import assert from "node:assert/strict";
import test from "node:test";
import { criarPulsoRepulsao } from "./PulsoRepulsao.js";
import { novoBossConfig } from "../NovoBossConfig.js";

function preparar({ distancia = 100, danoAceito = true, config = {} } = {}) {
  const eventos = [];
  const graficos = [];
  const avisos = [];
  const scene = { player: { x: distancia, y: 0 }, add: { graphics() {
    const grafico = { destruidos: 0, raios: [],
      setDepth(depth) { this.depth = depth; },
      clear() {}, lineStyle() {},
      strokeCircle(x, y, raio) { this.raios.push({ x, y, raio }); },
      destroy() { this.destruidos++; },
    };
    graficos.push(grafico);
    return grafico;
  } } };
  const encontro = { sprite: { x: 0, y: 0 } };
  const servicos = {
    criarAviso(x, y, raio, duracao) {
      const aviso = { x, y, raio, duracao, destruidos: 0,
        atualizar() {}, destruir() { this.destruidos++; },
      };
      avisos.push(aviso);
      eventos.push("aviso");
      return aviso;
    },
    jogadorAtingeCirculo: (x, y, raio) => Math.hypot(scene.player.x - x, scene.player.y - y) <= raio,
    danoJogador(dano, origem, opcoes) {
      eventos.push({ dano, origem, opcoes, aceito: danoAceito });
      return danoAceito;
    },
  };
  const ataque = criarPulsoRepulsao(scene, encontro, config, servicos);
  return { ataque, scene, encontro, eventos, graficos, avisos };
}

test("pulso de produção causa 30 de dano e permite sair até o fim do aviso", () => {
  const config = novoBossConfig.ataques.pulsoRepulsao;
  const parado = preparar({ config });
  parado.ataque.atualizar(1499);
  assert.deepEqual(parado.eventos, ["aviso"]);
  parado.ataque.atualizar(1);
  assert.equal(parado.eventos[1].dano, 30);
  const esquivando = preparar({ config });
  esquivando.ataque.atualizar(1499);
  esquivando.scene.player.x = 311;
  esquivando.ataque.atualizar(1);
  assert.deepEqual(esquivando.eventos, ["aviso"]);
});

test("pulso resolve todo o raio no zero do aviso, antes da cauda visual", () => {
  for (const distancia of [0, 72, 100, 144, 145]) {
    const { ataque, eventos, avisos, graficos } = preparar({ distancia });
    assert.equal(ataque.duracao, 1150);
    assert.equal(avisos[0].raio, 145);
    assert.equal(avisos[0].duracao, 900);
    ataque.atualizar(899);
    assert.equal(graficos.length, 0);
    assert.deepEqual(eventos, ["aviso"]);
    ataque.atualizar(1);
    assert.equal(avisos[0].destruidos, 1);
    assert.equal(graficos[0].depth, 52);
    assert.equal(ataque.snapshot().raio, 145);
    assert.equal(ataque.snapshot().impactoEm, 900);
    assert.deepEqual(eventos[1], { dano: 14, origem: { x: 0, y: 0 },
      opcoes: { empurrao: 230, duracaoEmpurrao: 180 }, aceito: true });
    assert.equal(ataque.snapshot().atingiu, true);
    ataque.atualizar(250);
    assert.equal(eventos.length, 2);
  }
});

test("ficar fora do alcance permite esquivar sem dano ou repulsão", () => {
  const { ataque, eventos } = preparar({ distancia: 146 });
  assert.equal(ataque.atualizar(1150), true);
  assert.deepEqual(eventos, ["aviso"]);
});

test("quem entra depois do zero não recebe dano durante a animação", () => {
  const { ataque, scene, eventos } = preparar({ distancia: 200 });
  ataque.atualizar(1025);
  scene.player.x = 20;
  ataque.atualizar(25);
  assert.deepEqual(eventos, ["aviso"]);
});

test("invulnerabilidade não é registrada como acerto nem repete a tentativa", () => {
  const { ataque, eventos } = preparar({ distancia: 20, danoAceito: false });
  ataque.atualizar(950);
  assert.equal(eventos.length, 2);
  assert.equal(ataque.snapshot().atingiu, false);
  assert.equal(ataque.snapshot().tentouAcertar, true);
  ataque.atualizar(50);
  assert.equal(eventos.length, 2);
});

test("ponto do pulso não persegue entidade reposicionada após aviso", () => {
  const { ataque, encontro, eventos } = preparar({ distancia: 20 });
  encontro.sprite.x = 500;
  ataque.atualizar(950);
  assert.deepEqual(ataque.snapshot().origem, { x: 0, y: 0 });
  assert.deepEqual(eventos[1].origem, { x: 0, y: 0 });
});

test("delta longo preserva frente atravessada e encerra sem efeitos órfãos", () => {
  const { ataque, avisos, graficos, eventos } = preparar();
  assert.equal(ataque.atualizar(10000), true);
  assert.equal(eventos.length, 2);
  assert.equal(avisos[0].destruidos, 1);
  assert.equal(graficos[0].destruidos, 1);
  ataque.destruir();
  ataque.atualizar(5000);
  assert.equal(eventos.length, 2);
  assert.equal(graficos[0].destruidos, 1);
});

test("cancelar no aviso ou onda é idempotente e impede acerto tardio", () => {
  for (const tempo of [0, 899]) {
    const { ataque, avisos, graficos, eventos } = preparar();
    ataque.atualizar(tempo);
    ataque.destruir();
    ataque.destruir();
    ataque.atualizar(10000);
    assert.deepEqual(eventos, ["aviso"]);
    assert.equal(avisos[0].destruidos, 1);
    assert.ok(graficos.every((grafico) => grafico.destruidos === 1));
  }
});

test("parâmetros alteram o alcance, a velocidade da onda e a repulsão", () => {
  const eventos = [];
  const ataque = criarPulsoRepulsao({}, { x: 10, y: 20 }, {
    raio: 200, avisoMs: 200, expansaoMs: 100, dano: 3, empurrao: 80, duracaoEmpurrao: 90,
  }, { jogadorAtingeCirculo: (_x, _y, raio) => raio >= 180,
    danoJogador: (...args) => { eventos.push(args); return true; } });
  assert.equal(ataque.duracao, 300);
  ataque.atualizar(290);
  assert.deepEqual(eventos, [[3, { x: 10, y: 20 }, { empurrao: 80, duracaoEmpurrao: 90 }]]);
});

test("sair no último milissegundo evita o pulso, mas sair após o zero não desfaz o impacto", () => {
  const antes=preparar();
  antes.ataque.atualizar(899);
  antes.scene.player.x=146;
  antes.ataque.atualizar(1);
  assert.deepEqual(antes.eventos,["aviso"]);
  assert.equal(antes.ataque.snapshot().tentouAcertar,true);
  const depois=preparar({distancia:144});
  depois.ataque.atualizar(900);
  assert.equal(depois.eventos.length,2);
  depois.scene.player.x=300;
  depois.ataque.atualizar(10);
  assert.equal(depois.ataque.snapshot().atingiu,true);
  assert.equal(depois.eventos.length,2);
});
