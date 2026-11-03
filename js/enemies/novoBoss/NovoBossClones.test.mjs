import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { novoBossConfig, areaCorpoNovoBoss } from "./NovoBossConfig.js";
import { prepararClonesNovoBoss } from "./NovoBossClones.js";
import { prepararIlusoesNovoBoss, destinoIlusorioValido } from "./NovoBossIlusoes.js";

function preparar(opcoes = {}) {
  const objetos = [];
  const blocos = [];
  function visual(x = 0, y = 0) {
    const objeto = { x, y, active: true, visible: true, alpha: 1, depth: 16.5, destruidos: 0,
      setOrigin() { return this; }, setScale() { return this; },
      setName(name) { this.name = name; return this; },
      setDepth(depth) { this.depth = depth; return this; },
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      setVisible(visible) { this.visible = visible; return this; },
      setAlpha(alpha) { this.alpha = alpha; return this; },
      play() { return this; }, clear() { return this; }, lineStyle() { return this; },
      strokeCircle() { return this; }, lineBetween() { return this; },
      destroy() { this.destruidos++; this.active = false; },
    };
    objetos.push(objeto);
    return objeto;
  }
  const scene = { player: { active: true, x: -1093, y: -5520 }, vida: 100,
    events: new EventEmitter(), collisionGroup: { getChildren: () => blocos },
    add: { sprite: visual, circle: visual, graphics: visual },
  };
  const config = { ...novoBossConfig, clones: { ativo: true, ...opcoes } };
  const sprite = visual(-1080, -5810);
  const encontro = { config, sprite, vida: 1000, vidaMaxima: 1000,
    jogadorNaArena: true, obstaculosTeleporte: [], rng: () => 0,
    hitboxDano: { ...areaCorpoNovoBoss(config) }, projeteisBoss: [],
  };
  Object.defineProperties(encontro, { x: { get: () => sprite.x }, y: { get: () => sprite.y } });
  const sistema = encontro.sistemaClones = prepararClonesNovoBoss(scene, encontro);
  return { scene, encontro, sistema, objetos, blocos };
}

test("9 clones saem do corpo original; quantidade fica sempre entre 8 e 10", () => {
  for (const [quantidade, esperado] of [[undefined, 9], [0, 8], [1, 8], [8, 8], [9, 9], [10, 10], [80, 10]]) {
    const { encontro, sistema } = preparar({ quantidade });
    assert.equal(sistema.iniciar(), true);
    assert.equal(sistema.alvos.length, esperado);
    assert.ok(sistema.alvos.every(alvo => alvo.x === encontro.x && alvo.y === encontro.y));
    assert.ok(sistema.alvos.every(alvo => alvo.tipo === "clone" && alvo.vida === 1));
    assert.equal(encontro.vida, 1000);
    assert.equal(encontro.fase, undefined, "o módulo não inicia a segunda fase sozinho");
    assert.equal(sistema.iniciar(), false);
  }
});

test("movimento abre os clones a partir do corpo e atualiza cada hitbox", () => {
  const { scene, encontro, sistema } = preparar();
  sistema.iniciar();
  sistema.atualizar(1000);
  const alvos = sistema.alvos;
  assert.equal(sistema.snapshot().velocidade, 55);
  for (const alvo of alvos) {
    assert.ok(Math.abs(Math.hypot(alvo.x - encontro.x, alvo.y - encontro.y) - 55) < 0.001);
    const area = areaCorpoNovoBoss(encontro.config, alvo);
    assert.deepEqual({ x: alvo.hitboxDano.x, y: alvo.hitboxDano.y,
      width: alvo.hitboxDano.width, height: alvo.hitboxDano.height }, area);
    assert.equal(alvo.hitboxDano.left, area.x);
    assert.equal(alvo.hitboxDano.bottom, area.y + area.height);
    assert.equal(destinoIlusorioValido(scene, encontro, alvo), true);
  }
  assert.equal(new Set(alvos.map(alvo => `${alvo.x},${alvo.y}`)).size, 9);
});

test("delta longo não atravessa uma parede fina, os geradores ou o jogador", () => {
  const { scene, encontro, sistema, blocos } = preparar();
  // A barreira atravessa toda a arena: não há uma volta possível em um só passo.
  const parede = { body: { x: -1000, y: -6144, width: 2, height: 750, enable: true } };
  blocos.push(parede);
  encontro.obstaculosTeleporte.push({ body: {
    x: -1220, y: -5940, width: 36, height: 36, enable: true,
  } });
  scene.player.x = -1260;
  scene.player.y = -5740;
  sistema.iniciar();
  sistema.atualizar(8000);
  assert.equal(sistema.ativo, true);
  for (const alvo of sistema.alvos) {
    assert.ok(alvo.hitboxDano.right <= parede.body.x, "não deve saltar para o outro lado da parede");
    assert.equal(destinoIlusorioValido(scene, encontro, alvo), true);
  }
});

test("acertar um clone o dispersa uma vez sem dano compartilhado", () => {
  const { encontro, sistema } = preparar();
  sistema.iniciar();
  const alvo = sistema.alvos[3];
  assert.equal(alvo.receberDano(1), true);
  assert.equal(alvo.receberDano(1), false);
  assert.equal(alvo.sprite.destruidos, 1);
  assert.equal(alvo.body.enable, false);
  sistema.atualizar(1000);
  assert.equal(encontro.vida, 1000);
  assert.equal(sistema.alvos.filter(item => item.active).length, 8);
});

test("imitações dos quatro ataques não causam dano, captura ou projéteis reais", () => {
  const { scene, encontro, sistema, objetos } = preparar();
  sistema.iniciar();
  for (const tipo of ["pulso", "chuva", "lasers", "tentaculos"]) {
    assert.equal(sistema.imitarAtaque(tipo), true);
    sistema.atualizar(100);
    assert.ok(sistema.alvos.every(alvo => alvo.snapshot().imitacao === tipo));
    assert.equal(sistema.snapshot().imitacaoAtual, tipo);
    assert.equal(scene.vida, 100);
    assert.equal(scene.restricaoControleNovoBoss, undefined);
    assert.deepEqual(encontro.projeteisBoss, []);
    sistema.atualizar(700);
    assert.ok(sistema.alvos.every(alvo => alvo.snapshot().imitacao === null));
  }
  assert.equal(sistema.imitarAtaque("ataque-inexistente"), false);
  sistema.cancelar();
  assert.ok(objetos.slice(1).every(objeto => objeto.destruidos === 1));
});

test("novo ataque real aciona imitação, sem repetição em cada atualização", () => {
  const { encontro, sistema } = preparar();
  sistema.iniciar();
  encontro.ataqueAtual = { tipo: "chuvaRaios" };
  sistema.atualizar(100);
  assert.ok(sistema.alvos.every(alvo => alvo.snapshot().imitacao === "chuva"));
  sistema.atualizar(700);
  assert.ok(sistema.alvos.every(alvo => alvo.snapshot().imitacao === null));
  encontro.ataqueAtual = { tipo: "chuvaRaios" };
  sistema.atualizar(0);
  assert.ok(sistema.alvos.every(alvo => alvo.snapshot().imitacao === "chuva"));
});

test("API da fase 2 move a verdadeira com sua única hitbox e respeita teletransporte", () => {
  const { scene, encontro, sistema } = preparar();
  const hitbox = encontro.hitboxDano;
  sistema.iniciar();
  assert.equal(sistema.moverVerdadeira(1000), true);
  assert.ok(Math.abs(encontro.x + 1135) < 0.001);
  assert.equal(encontro.hitboxDano, hitbox);
  assert.deepEqual({ x: hitbox.x, y: hitbox.y, width: hitbox.width, height: hitbox.height },
    areaCorpoNovoBoss(encontro.config, encontro.sprite));
  assert.equal(destinoIlusorioValido(scene, encontro, encontro.sprite), true);
  encontro.teleporte = {};
  assert.equal(sistema.moverVerdadeira(1000), false);
});

test("iniciar clones encerra as quatro aparições sem apagar o núcleo verdadeiro", () => {
  const { scene, encontro, sistema } = preparar();
  const ilusoes = encontro.sistemaIlusoes = prepararIlusoesNovoBoss(scene, encontro);
  ilusoes.iniciarQuatro();
  const falsos = [...ilusoes.alvos];
  const core = ilusoes.core;
  assert.equal(sistema.iniciar(), true);
  assert.equal(ilusoes.ativo, false);
  assert.equal(ilusoes.alvos.length, 0);
  assert.ok(falsos.every(alvo => alvo.sprite.destruidos === 1));
  assert.equal(core.active, true);
  assert.equal(sistema.alvos.length, 9);
});

test("18s, cancelamento e destruição não deixam clones ou efeitos órfãos", () => {
  const { encontro, sistema, objetos } = preparar();
  sistema.iniciar();
  sistema.imitarAtaque("pulso");
  sistema.atualizar(100);
  const alvos = [...sistema.alvos];
  sistema.atualizar(17899);
  assert.equal(sistema.ativo, true);
  sistema.atualizar(1);
  assert.equal(sistema.ativo, false);
  assert.equal(sistema.alvos.length, 0);
  sistema.cancelar();
  sistema.destruir();
  sistema.destruir();
  assert.equal(sistema.iniciar(), false);
  assert.equal(encontro.sprite.destruidos, 0);
  assert.ok(alvos.every(alvo => alvo.sprite.destruidos === 1));
  assert.ok(objetos.slice(1).every(objeto => objeto.destruidos === 1));
});

test("deltas inválidos não movem clones; suspensão e saída cancelam sem alterar vida", () => {
  const { encontro, sistema } = preparar();
  sistema.iniciar();
  for (const delta of [NaN, Infinity, -1]) sistema.atualizar(delta);
  assert.equal(sistema.snapshot().tempo, 0);
  assert.ok(sistema.alvos.every(alvo => alvo.x === encontro.x && alvo.y === encontro.y));
  encontro.jogadorNaArena = false;
  sistema.atualizar(0);
  assert.equal(sistema.ativo, false);
  assert.equal(sistema.alvos.length, 0);
  assert.equal(encontro.vida, 1000);
});

test("desativado, multiplayer ou origem bloqueada não geram clones", () => {
  const desativado = preparar({ ativo: false });
  assert.equal(desativado.sistema.iniciar(), false);
  const multiplayer = preparar();
  multiplayer.scene.multiplayer = true;
  assert.equal(multiplayer.sistema.iniciar(), false);
  const bloqueado = preparar();
  bloqueado.encontro.obstaculosTeleporte.push({ body: {
    ...areaCorpoNovoBoss(bloqueado.encontro.config), enable: true,
  } });
  assert.equal(bloqueado.sistema.iniciar(), false);
});

test("na fase 2 todos caminham a 250 px/s e param nas mesmas aberturas e ataques centrais", () => {
  const { encontro, sistema } = preparar();
  Object.assign(encontro, { fase: 2, estado: "preparando", tempoEstado: 1000,
    relogioCombate: 1000, inicioFase2Em: 0, inicioOndaClonesEm: 0, ultimoTeleporteEm: 0 });
  sistema.iniciar();
  sistema.atualizar(100);
  assert.equal(sistema.snapshot().velocidade, 250);
  assert.ok(sistema.alvos.every(a => a.sprite.alpha === 1));
  for (const alvo of sistema.alvos) {
    assert.ok(Math.abs(Math.hypot(alvo.x - encontro.x, alvo.y - encontro.y) - 25) < 0.1);
  }
  for (const bloquear of [
    () => { encontro.estado = "vulneravel"; },
    () => { encontro.estado = "atacando"; encontro.ataqueAtual = { tipo: "pulsoRepulsao" }; },
    () => { encontro.ataqueAtual = { tipo: "lasers" }; },
    () => { encontro.teleporte = {}; },
  ]) {
    const antes = sistema.alvos.map(a => [a.x,a.y]);
    bloquear(); sistema.atualizar(100);
    assert.deepEqual(sistema.alvos.map(a => [a.x,a.y]), antes);
  }
  encontro.teleporte = null; encontro.ataqueAtual = null;
  encontro.estado = "preparando"; encontro.tempoEstado = 20;
  const antes = sistema.alvos.map(a => [a.x,a.y]);
  sistema.atualizar(1000);
  for (const [i,a] of sistema.alvos.entries())
    assert.ok(Math.abs(Math.hypot(a.x-antes[i][0],a.y-antes[i][1])-5)<0.1);
});
