import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { criarEscudoEnergia, criarExplosaoEnergia } from "./NovoBossEfeitosEnergia.js";
import { prepararApresentacaoNovoBoss } from "./NovoBossApresentacao.js";
import { criarServicosAtaques } from "./NovoBossServicosAtaques.js";
import { criarPulsoRepulsao } from "./ataques/PulsoRepulsao.js";
import { novoBossConfig } from "./NovoBossConfig.js";
import { assetsNovoBoss } from "./NovoBossAssets.js";

function cena() {
  const sprites = [];
  const scene = { events: new EventEmitter(), vida: 100,
    textures: { exists: chave => [assetsNovoBoss.escudoEnergia.chave, assetsNovoBoss.explosao.chave].includes(chave) },
    anims: { exists: () => false }, add: { sprite(x, y, texture, frame) {
      const sprite = { x, y, texture, frame, active: true, visible: true, alpha: 1,
        setName(name) { this.name = name; return this; },
        setOrigin(x, y) { this.originX = x; this.originY = y; return this; },
        setScale(scale) { this.scale = scale; return this; },
        setDepth(depth) { this.depth = depth; return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; },
        setVisible(visible) { this.visible = visible; return this; },
        setAlpha(alpha) { this.alpha = alpha; return this; },
        setFrame(frame) { this.frame = frame; return this; },
        destroy() { this.active = false; this.destruicoes = (this.destruicoes ?? 0) + 1; },
      };
      sprites.push(sprite); return sprite;
    } },
  };
  return { scene, sprites };
}

test("folhas derivadas preservam fontes, dimensões, quantidade e duração dos quadros", () => {
  const base = new URL("../../../assets/PERSONAGENS/INIMIGOS PRINCIPAIS/Boss-test/", import.meta.url);
  const manifest = JSON.parse(readFileSync(new URL("derivados/gifs-originais.json", base)));
  assert.deepEqual(Object.keys(manifest), ["escudo-energia.gif", "ataque-explosão.gif"]);
  for (const [fonte, asset] of [["escudo-energia.gif", assetsNovoBoss.escudoEnergia], ["ataque-explosão.gif", assetsNovoBoss.explosao]]) {
    const meta = manifest[fonte];
    assert.equal(createHash("sha256").update(readFileSync(new URL(fonte, base))).digest("hex"), meta.sha256);
    assert.equal(meta.quadros, asset.ultimoFrame + 1);
    assert.ok(meta.duracoesMs.every(ms => ms === asset.frameMs));
    const png = readFileSync(new URL(`derivados/${meta.folha}`, base));
    assert.equal(png.readUInt32BE(16), meta.colunas * asset.larguraFrame);
    assert.equal(png.readUInt32BE(20), Math.ceil(meta.quadros / meta.colunas) * asset.alturaFrame);
  }
});

test("escudo repete os cinco quadros, centraliza o círculo e acompanha a proteção", () => {
  const { scene } = cena();
  const escudo = criarEscudoEnergia(scene, 95);
  escudo.atualizar(400, 100, 200, true, 1);
  assert.equal(escudo.sprite.frame, 4);
  assert.equal(escudo.sprite.scale * 640, 190);
  assert.equal(escudo.sprite.originX, 390 / 800);
  assert.equal(escudo.sprite.originY, 0.5);
  escudo.atualizar(100, 350, 250, true, 0.5);
  assert.equal(escudo.sprite.frame, 0);
  assert.deepEqual([escudo.sprite.x, escudo.sprite.y], [350, 250]);
  assert.equal(escudo.sprite.alpha, 0.35);
  escudo.atualizar(200, 350, 250, false);
  assert.equal(escudo.sprite.visible, false);
  assert.equal(escudo.sprite.frame, 0);
  escudo.destruir(); escudo.destruir();
  assert.equal(escudo.sprite.destruicoes, 1);
});

test("explosão executa os oito quadros em 640 ms centrada no corpo e com raio coerente", () => {
  const { scene } = cena();
  const explosao = criarExplosaoEnergia(scene, { x: 20, y: 30 }, 145);
  assert.deepEqual([explosao.sprite.x, explosao.sprite.y], [20, 30]);
  assert.equal(explosao.sprite.originY, 0.5);
  assert.equal(explosao.sprite.scale * 576, 290);
  for (let i = 0; i < 8; i++) {
    assert.equal(explosao.atualizarIdade(i * 80), false);
    assert.equal(explosao.sprite.frame, i);
  }
  assert.equal(explosao.atualizarIdade(639), false);
  assert.equal(explosao.atualizarIdade(640), true);
  explosao.destruir();
  assert.equal(explosao.sprite.destruicoes, 1);
});

test("assets ausentes e efeito já expirado não criam sprites nem novos perigos", () => {
  const { scene, sprites } = cena();
  assert.equal(criarExplosaoEnergia(scene, { x: 0, y: 0 }, 145, 640), null);
  scene.textures.exists = () => false;
  assert.equal(criarEscudoEnergia(scene, 95), null);
  assert.equal(criarExplosaoEnergia(scene, { x: 0, y: 0 }, 145), null);
  assert.equal(sprites.length, 0);
});

function encontro(scene) {
  const boss = { config: novoBossConfig, sprite: { active: true, x: 0, y: 0 },
    jogadorNaArena: true, relogioCombate: 0, estado: "preparando" };
  boss.apresentacao = prepararApresentacaoNovoBoss(scene, boss);
  return boss;
}

test("explosão visual sobrevive ao fim do dano, sem estender a duração do pulso", () => {
  const { scene, sprites } = cena();
  const boss = encontro(scene);
  const servicos = criarServicosAtaques(scene, boss);
  servicos.criarAviso = () => null;
  let acertos = 0;
  servicos.jogadorAtingeCirculo = () => true;
  servicos.danoJogador = () => { acertos++; return true; };
  const pulso = criarPulsoRepulsao(scene, boss, {}, servicos);
  assert.equal(pulso.duracao, 1150);
  assert.equal(pulso.atualizar(900), false);
  boss.relogioCombate = 900;
  boss.apresentacao.atualizar(900);
  assert.equal(sprites[0].frame, 0);
  assert.equal(pulso.atualizar(250), true);
  boss.relogioCombate = 1150;
  boss.apresentacao.atualizar(250);
  assert.equal(acertos, 1);
  assert.equal(sprites[0].frame, 3);
  assert.equal(sprites[0].active, true);
  boss.relogioCombate = 1460;
  boss.apresentacao.atualizar(310);
  assert.equal(sprites[0].frame, 7);
  boss.relogioCombate = 1540;
  boss.apresentacao.atualizar(80);
  assert.equal(sprites[0].active, false);
  assert.equal(acertos, 1);
  assert.equal(boss.apresentacao.snapshot().explosoesPulso, 0);
});

test("frame longo não deixa uma explosão antiga aparecer depois do ataque", () => {
  const { scene, sprites } = cena();
  const boss = encontro(scene);
  const servicos = { ...criarServicosAtaques(scene, boss), criarAviso: () => null };
  const pulso = criarPulsoRepulsao(scene, boss, {}, servicos);
  pulso.atualizar(1150);
  boss.relogioCombate = 10000;
  boss.apresentacao.atualizar(10000);
  assert.equal(sprites[0].active, false);
  assert.equal(boss.apresentacao.snapshot().explosoesPulso, 0);
});

test("saída, morte, multiplayer e encerramento limpam somente efeitos próprios", () => {
  for (const motivo of ["saida", "morte", "multi", "encerrar"]) {
    const { scene, sprites } = cena();
    const boss = encontro(scene);
    assert.equal(boss.apresentacao.criarExplosaoPulso({ x: 5, y: 6 }, 145), true);
    if (motivo === "saida") boss.jogadorNaArena = false;
    if (motivo === "morte") { boss.morto = true; scene.events.emit("novo-boss:derrotada", { encontro: boss }); }
    if (motivo === "multi") scene.multiplayer = true;
    if (motivo === "encerrar") boss.apresentacao.destruir();
    else boss.apresentacao.atualizar(0);
    assert.equal(sprites[0].active, false, motivo);
  }
});
