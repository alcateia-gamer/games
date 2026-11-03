import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { novoBossConfig, areaCorpoNovoBoss } from "./NovoBossConfig.js";
import { atualizarMovimentoNovoBoss } from "./NovoBossMovimento.js";
import { atualizarCombateNovoBoss, inicializarCombateNovoBoss } from "./NovoBossEstados.js";
import { destinoValidoNovoBoss } from "./NovoBossTeleporte.js";

function criar() {
  const scene = { player: { active: true, x: -1080, y: -5500 }, vida: 100,
    events: new EventEmitter(), collisionGroup: { getChildren: () => [] } };
  const sprite = { ...novoBossConfig.posicaoInicial, active: true, alpha: 1,
    setPosition(x, y) { Object.assign(this, { x, y }); }, setAlpha(alpha) { this.alpha = alpha; },
    body: { enable: true, reset(x, y) { Object.assign(sprite, { x, y }); },
      updateFromGameObject() { Object.assign(this, areaCorpoNovoBoss(novoBossConfig, sprite)); } } };
  const encontro = { config: novoBossConfig, sprite, fase: 2, inicioFase2Em: 0,
    jogadorNaArena: true, estado: "preparando", tempoEstado: 1000,
    hitboxDano: { setTo(x, y, width, height) { Object.assign(this, { x, y, width, height }); } } };
  inicializarCombateNovoBoss(scene, encontro);
  encontro.tempoEstado = 1000;
  return { scene, encontro, sprite, mover: delta => atualizarMovimentoNovoBoss(scene, encontro, delta) };
}

test("fase 2 flanqueia a 250 px/s com e sem clones e mantém corpo e hitbox", () => {
  for (const ativo of [false, true]) {
    const c = criar(), origem = { ...c.sprite }, hitbox = c.encontro.hitboxDano;
    c.encontro.sistemaClones = { ativo };
    c.encontro.inicioOndaClonesEm = 0;
    c.encontro.relogioCombate = 1000;
    assert.equal(c.mover(400), true);
    const distancia = Math.hypot(c.sprite.x - origem.x, c.sprite.y - origem.y);
    assert.ok(distancia > 90 && distancia <= 100.001, distancia);
    assert.equal(c.encontro.hitboxDano, hitbox);
    for (const key of ["x", "y", "width", "height"]) assert.equal(c.sprite.body[key], hitbox[key]);
  }
});

test("janelas, ataques centrais, quatro ilusões, viagem e interrupções seguram a verdadeira", () => {
  for (const bloquear of [
    c => { c.encontro.estado = "vulneravel"; },
    ...["pulsoRepulsao", "lasers"].map(tipo => c => { c.encontro.estado = "atacando"; c.encontro.ataqueAtual = { tipo }; }),
    c => { c.encontro.sistemaIlusoes = { ativo: true }; },
    c => { c.encontro.teleporte = {}; }, c => { c.encontro.teleportePendente = "reativo"; },
    c => { c.encontro.transicaoFase2Pendente = true; }, c => { c.encontro.fase = 1; },
    c => { c.scene.multiplayer = true; }, c => { c.scene.vida = 0; },
    c => { c.encontro.jogadorNaArena = false; }, c => { c.encontro.suspenso = true; },
    c => { c.encontro.morto = true; }, c => { c.encontro.encerrado = true; },
  ]) {
    const c = criar(); bloquear(c);
    assert.equal(c.mover(100), false);
    assert.deepEqual({ x: c.sprite.x, y: c.sprite.y }, novoBossConfig.posicaoInicial);
  }
});

test("chuva e tentáculos permitem deslocamento rápido sem reposicionar ataques centrais", () => {
  for (const tipo of ["chuva", "tentaculos"]) {
    const c = criar(); c.encontro.estado = "atacando"; c.encontro.ataqueAtual = { tipo };
    assert.equal(c.mover(500), true);
  }
});

test("subpassos evitam atravessar paredes finas, limites, jogador e geradores", () => {
  const c = criar();
  const parede = { body: { x: -1600, y: -5660, width: 1040, height: 2, enable: true } };
  c.scene.collisionGroup.getChildren = () => [parede];
  c.encontro.obstaculosTeleporte = [{ body: { x: -1000, y: -5840, width: 36, height: 36, enable: true } }];
  c.encontro.estado = "atacando"; c.encontro.ataqueAtual = { tipo: "chuva" };
  for (let i = 0; i < 100; i++) {
    c.encontro.relogioCombate += 100;
    c.mover(i === 50 ? 3000 : 100);
    assert.equal(destinoValidoNovoBoss(c.scene, c.encontro, c.sprite), true);
    assert.ok(c.sprite.body.y + c.sprite.body.height <= parede.body.y);
  }
});

test("pressão intercala teleporte com caminhada respeitando recarga e abertura inteira", () => {
  const c = criar(); c.encontro.relogioCombate = 5999;
  c.mover(10); assert.equal(c.encontro.teleportePendente, null);
  c.encontro.relogioCombate = 6000; c.encontro.estado = "vulneravel";
  assert.equal(c.mover(10), false); assert.equal(c.encontro.teleportePendente, null);
  c.encontro.estado = "preparando";
  assert.equal(c.mover(10), false);
  assert.equal(c.encontro.teleportePendente, "pressao-fase2");
  atualizarCombateNovoBoss(c.scene, c.encontro, 0);
  assert.equal(c.encontro.teleporte.motivo, "pressao-fase2");
  atualizarCombateNovoBoss(c.scene, c.encontro, 500);
  assert.equal(c.encontro.teleporte, null);
  c.encontro.relogioCombate = 11999;
  c.mover(10); assert.equal(c.encontro.teleportePendente, null);
  c.encontro.relogioCombate = 12000;
  c.mover(10); assert.equal(c.encontro.teleportePendente, "pressao-fase2");
});

test("quadro de criação e deltas inválidos não deslocam a boss", () => {
  const c = criar(); c.encontro.sistemaClones = { ativo: true };
  c.encontro.inicioOndaClonesEm = c.encontro.relogioCombate;
  assert.equal(c.mover(2000), false);
  for (const delta of [0, -1, NaN, Infinity]) assert.equal(c.mover(delta), false);
  assert.deepEqual({ x: c.sprite.x, y: c.sprite.y }, novoBossConfig.posicaoInicial);
});

test("frame que cruza abertura ou teleporte só move pelo tempo do estado novo", () => {
  for (const estado of ["preparando", "atacando"]) {
    const c = criar();
    c.encontro.estado = estado;
    c.encontro.tempoEstado = c.encontro.tempoAtaque = 20;
    c.encontro.ataqueAtual = estado === "atacando" ? { tipo: "chuva" } : null;
    assert.equal(c.mover(1000), true);
    const distancia = Math.hypot(c.sprite.x - novoBossConfig.posicaoInicial.x,
      c.sprite.y - novoBossConfig.posicaoInicial.y);
    assert.ok(distancia > 4.99 && distancia <= 5.001, distancia);
  }
});
