import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  prepararNovoBoss,
  atualizarNovoBoss,
  destruirNovoBoss,
} from "./NovoBoss.js";
import {
  novoBossConfig,
  jogadorNaArenaNovoBoss,
  areaCorpoNovoBoss,
} from "./NovoBossConfig.js";
import {
  assetsNovoBoss,
  carregarAssetsNovoBoss,
  criarAnimacoesNovoBoss,
} from "./NovoBossAssets.js";

// Estes testes verificam o contrato das etapas 1/2. As mecânicas posteriores
// possuem seus próprios testes e não devem iniciar ataques ou criar alvos aqui.
const configIsolada = {
  ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ilusoes: { ...novoBossConfig.ilusoes, ativo: false },
  clones: { ...novoBossConfig.clones, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};

// A cena simulada usa a mesma interface geométrica consumida pelo Phaser real.
globalThis.Phaser = { Geom: { Rectangle: class {
  constructor(x, y, width, height) { this.setTo(x, y, width, height); }
  setTo(x, y, width, height) { Object.assign(this, { x, y, width, height }); return this; }
  get left() { return this.x; }
  get right() { return this.x + this.width; }
  get top() { return this.y; }
  get bottom() { return this.y + this.height; }
  get centerX() { return this.x + this.width / 2; }
  get centerY() { return this.y + this.height / 2; }
} } };

function criarCena({ dentro = false, assetDisponivel = true, blocos = [] } = {}) {
  const recursos = new Set(assetDisponivel ? [assetsNovoBoss.idle.chave] : []);
  const animacoes = new Map();
  const sprites = [];
  const cargas = [];
  const scene = {
    novoBossConfig: configIsolada,
    player: {
      active: true, x: -1080, y: dentro ? -5500 : -5400,
      body: { bottom: dentro ? -5490 : -5390 },
    },
    vida: 100,
    inimigos: [{ nome: "robo-preservado" }],
    boss: { nome: "referencia-antiga-preservada" },
    collisionGroup: { getChildren: () => blocos },
    events: new EventEmitter(),
    textures: { exists: (key) => recursos.has(key) },
    load: { spritesheet: (...args) => cargas.push(args), atlas: (...args) => cargas.push(args) },
    anims: {
      exists: (key) => animacoes.has(key),
      create: (config) => animacoes.set(config.key, config),
      generateFrameNumbers: (key, range) => ({ key, ...range }),
    },
    physics: { add: { sprite(x, y, key, frame) {
      const sprite = {
        x, y, key, frame, active: true, visible: true, destruidos: 0,
        setOrigin(x, y) { this.origem = { x, y }; return this; },
        setScale(escala) { this.escala = escala; return this; },
        setDepth(profundidade) { this.profundidade = profundidade; return this; },
        setName(nome) { this.nome = nome; return this; },
        setVisible(visible) { this.visible = visible; return this; },
        setAlpha(alpha) { this.alpha = alpha; return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; },
        play(animacao) { this.animacao = animacao; return this; },
        anims: {
          isPaused: false,
          pause() { this.isPaused = true; },
          resume() { this.isPaused = false; },
        },
        destroy() { this.destruidos++; this.active = false; },
        body: {
          enable: true,
          setAllowGravity(valor) { this.allowGravity = valor; },
          setImmovable(valor) { this.immovable = valor; },
          setSize(largura, altura) { this.tamanho = { largura, altura }; },
          setOffset(x, y) { this.offset = { x, y }; },
          reset(x, y) { sprite.setPosition(x, y); this.updateFromGameObject(); },
          updateFromGameObject() {
            this.atualizado = true;
            const topoFrame = sprite.y - 288 * sprite.origem.y * sprite.escala;
            this.bottom = topoFrame + (this.offset.y + this.tamanho.altura) * sprite.escala;
          },
        },
      };
      sprites.push(sprite);
      return sprite;
    } } },
  };
  return { scene, sprites, cargas, recursos, animacoes };
}

test("limites da arena são retangulares e não acionam acima, abaixo ou pelos lados", () => {
  const arena = novoBossConfig.arena;
  for (const x of [arena.xMin, -1080, arena.xMax]) {
    for (const y of [arena.yMin, arena.entradaY]) {
      assert.equal(jogadorNaArenaNovoBoss({ active: true, x, y }), true);
    }
  }
  for (const player of [
    null,
    { active: false, x: -1080, y: -5500 },
    { active: true, morto: true, x: -1080, y: -5500 },
    { active: true, x: arena.xMin - 1, y: -5500 },
    { active: true, x: arena.xMax + 1, y: -5500 },
    { active: true, x: -1080, y: arena.yMin - 1 },
    { active: true, x: -1080, y: arena.entradaY + 1 },
    { active: true, x: NaN, y: -5500 },
  ]) assert.equal(jogadorNaArenaNovoBoss(player), false);
});

test("usa recursos separados e recortes exatos das folhas fornecidas", () => {
  const { scene, cargas } = criarCena({ assetDisponivel: false });
  carregarAssetsNovoBoss(scene);
  assert.equal(cargas.length, 12);
  assert.deepEqual(cargas[0], [
    "novo-boss-idle",
    "PERSONAGENS/INIMIGOS PRINCIPAIS/Boss-test/boss-test-idle.png",
    { frameWidth: 288, frameHeight: 288, startFrame: 0, endFrame: 15 },
  ]);
  assert.deepEqual(cargas[1][2], {
    frameWidth: 336, frameHeight: 336, startFrame: 0, endFrame: 47,
  });
  assert.deepEqual(cargas[2], [
    "novo-boss-heavens-fury",
    "../Tilesets/mechanics/HeavensFury_preview(transparente).png",
    { frameWidth: 384, frameHeight: 384, startFrame: 0, endFrame: 12 },
  ]);
  assert.deepEqual(cargas[3][2], { frameWidth: 800, frameHeight: 800, startFrame: 0, endFrame: 4 });
  assert.deepEqual(cargas[4][2], { frameWidth: 600, frameHeight: 600, startFrame: 0, endFrame: 7 });
  assert.deepEqual(cargas[5][2], { frameWidth: 660, frameHeight: 499, startFrame: 0, endFrame: 31 });
  assert.deepEqual(cargas[6][2], { frameWidth: 660, frameHeight: 499, startFrame: 0, endFrame: 28 });
  assert.equal(cargas[7][0], "novo-boss-tentaculo");
  assert.equal(cargas[8][0], "novo-boss-tentaculo-agarrao");
  assert.equal(criarAnimacoesNovoBoss(scene), false);
});

test("arquivos PNG reais comportam os frames carregados sem cortar células", () => {
  for (const asset of Object.values(assetsNovoBoss)) {
    const caminho = new URL(`../../../assets/${asset.arquivo}`, import.meta.url);
    const png = readFileSync(caminho);
    assert.equal(png.toString("hex", 0, 8), "89504e470d0a1a0a");
    const largura = png.readUInt32BE(16);
    const altura = png.readUInt32BE(20);
    if (asset.tipo === "atlas") {
      assert.ok(largura <= 4096 && altura <= 4096);
      const dados = JSON.parse(readFileSync(new URL(`../../../assets/${asset.dados}`, import.meta.url)));
      assert.equal(Object.keys(dados.frames).length, asset.ultimoFrame + 1);
      assert.ok(Object.values(dados.frames).every(f => f.sourceSize.w === asset.larguraFrame && f.sourceSize.h === asset.alturaFrame));
      continue;
    }
    assert.equal(largura % asset.larguraFrame, 0, asset.arquivo);
    assert.equal(altura % asset.alturaFrame, 0, asset.arquivo);
    assert.ok((largura / asset.larguraFrame) * (altura / asset.alturaFrame) > asset.ultimoFrame);
  }
});

test("entra na arena uma vez e preserva robôs, boss antigo e estado do jogador", () => {
  const { scene, sprites, animacoes } = criarCena();
  const inimigos = scene.inimigos;
  const bossAntigo = scene.boss;
  const playerAntes = { ...scene.player };
  const encontro = prepararNovoBoss(scene);
  assert.equal(encontro.estado, "aguardando");
  assert.equal(sprites.length, 0);
  assert.equal(prepararNovoBoss(scene), encontro);
  assert.deepEqual(scene.player, playerAntes);

  scene.player.y = -5470;
  atualizarNovoBoss(scene, 1000, 16);
  const sprite = encontro.sprite;
  assert.equal(encontro.estado, "preparando");
  assert.equal(sprite.key, assetsNovoBoss.idle.chave);
  assert.equal(sprite.x, novoBossConfig.posicaoInicial.x);
  assert.equal(sprite.y, novoBossConfig.posicaoInicial.y);
  assert.equal(sprite.body.allowGravity, false);
  assert.equal(sprite.body.immovable, true);
  assert.equal(sprite.body.moves, false);
  assert.equal(sprite.body.atualizado, true);
  assert.deepEqual({ ...encontro.hitboxDano }, areaCorpoNovoBoss());
  assert.equal(encontro.hitbox, encontro.hitboxDano);
  assert.equal(animacoes.size, 1);
  assert.equal(sprite.animacao, assetsNovoBoss.idle.animacao);
  assert.equal(animacoes.get(sprite.animacao).repeat, -1);

  scene.player.y = -5400;
  atualizarNovoBoss(scene, 2000, 16);
  scene.player.y = -5500;
  atualizarNovoBoss(scene, 3000, 16);
  assert.equal(sprites.length, 1);
  assert.equal(scene.inimigos, inimigos);
  assert.equal(scene.boss, bossAntigo);
  assert.equal(scene.player.invulneravel, undefined);
  assert.equal(scene.player.movimentoBloqueado, undefined);
  assert.equal(scene.events.listenerCount("update"), 0);
  assert.equal(scene.events.listenerCount("postupdate"), 0);
});

test("posiciona imediatamente ao preparar uma visita iniciada dentro da arena", () => {
  const { scene, sprites } = criarCena({ dentro: true });
  assert.equal(prepararNovoBoss(scene).estado, "posicionada");
  assert.equal(sprites.length, 1);
});

test("ordena pelos pés do jogador sem atravessar camadas próximas da fábrica", () => {
  const { scene } = criarCena({ dentro: true });
  scene.profundidadePersonagemParte2 = 16.5;
  const encontro = prepararNovoBoss(scene);
  const sprite = encontro.sprite;
  assert.equal(sprite.body.bottom, encontro.hitbox.y + encontro.hitbox.height);
  // O jogador começa abaixo da boss; seu corpo deve desenhar à frente dela.
  assert.ok(sprite.profundidade < 16.5);
  assert.ok(sprite.profundidade > 16.4995);
  scene.player.body.bottom = sprite.body.bottom - 200;
  atualizarNovoBoss(scene, 100, 16);
  assert.ok(sprite.profundidade > 16.5);
  assert.ok(sprite.profundidade < 16.5005);
  scene.player.body.bottom = sprite.body.bottom;
  atualizarNovoBoss(scene, 200, 16);
  assert.equal(sprite.profundidade, 16.5);
  delete scene.profundidadePersonagemParte2;
  atualizarNovoBoss(scene, 300, 16);
  assert.equal(sprite.profundidade, novoBossConfig.visual.profundidade);
});

test("não cria durante a morte mesmo que o sprite do jogador continue ativo", () => {
  for (const estado of [{ morteEmAndamento: true }, { vida: 0 }]) {
    const { scene, sprites } = criarCena({ dentro: true });
    Object.assign(scene, estado);
    prepararNovoBoss(scene);
    atualizarNovoBoss(scene, 100, 16);
    assert.equal(sprites.length, 0);
    assert.equal(scene.novoBoss.estado, "aguardando");
  }
});

test("morte oculta a entidade já posicionada, pausa animação e restaura sem duplicar", () => {
  const { scene, sprites } = criarCena({ dentro: true });
  const encontro = prepararNovoBoss(scene);
  const sprite = encontro.sprite;
  scene.morteEmAndamento = true;
  atualizarNovoBoss(scene, 100, 16);
  assert.equal(encontro.suspenso, true);
  assert.equal(sprite.visible, false);
  assert.equal(sprite.body.enable, false);
  assert.equal(sprite.anims.isPaused, true);
  atualizarNovoBoss(scene, 200, 16);
  scene.morteEmAndamento = false;
  atualizarNovoBoss(scene, 300, 16);
  assert.equal(encontro.suspenso, false);
  assert.equal(sprite.visible, true);
  assert.equal(sprite.body.enable, true);
  assert.equal(sprite.anims.isPaused, false);
  assert.equal(sprites.length, 1);
});

test("asset ausente não cria textura de erro e pode ser disponibilizado posteriormente", () => {
  const { scene, recursos, sprites } = criarCena({ dentro: true, assetDisponivel: false });
  const encontro = prepararNovoBoss(scene);
  assert.equal(encontro.pendencia, "asset-idle-ausente");
  assert.equal(sprites.length, 0);
  recursos.add(assetsNovoBoss.idle.chave);
  atualizarNovoBoss(scene, 100, 16);
  assert.equal(sprites.length, 1);
  assert.equal(encontro.pendencia, null);
});

test("não posiciona o corpo dentro de obstáculos ou fora da arena configurada", () => {
  const { x, y, width, height } = areaCorpoNovoBoss();
  const { scene, sprites } = criarCena({
    dentro: true,
    blocos: [{ body: { x, y, width, height, enable: true } }],
  });
  assert.equal(prepararNovoBoss(scene).pendencia, "posicao-inicial-bloqueada");
  assert.equal(sprites.length, 0);
  scene.collisionGroup.getChildren()[0].body.enable = false;
  atualizarNovoBoss(scene, 100, 16);
  assert.equal(sprites.length, 1);

  const outra = criarCena({ dentro: true });
  const config = { ...configIsolada, posicaoInicial: { x: -1080, y: -6200 } };
  assert.equal(prepararNovoBoss(outra.scene, config).pendencia, "posicao-inicial-bloqueada");
  assert.equal(outra.sprites.length, 0);
});

test("shutdown e destroy limpam apenas recursos próprios e permitem uma nova visita", () => {
  for (const evento of ["shutdown", "destroy"]) {
    const { scene, sprites } = criarCena({ dentro: true });
    const encontro = prepararNovoBoss(scene);
    const primeiro = encontro.sprite;
    scene.events.emit(evento);
    assert.equal(primeiro.destruidos, 1);
    assert.equal(primeiro.body.enable, false);
    assert.equal(encontro.estado, "encerrada");
    assert.equal(scene.novoBoss, null);
    assert.equal(scene.events.listenerCount("shutdown"), 0);
    assert.equal(scene.events.listenerCount("destroy"), 0);
    atualizarNovoBoss(scene, 500, 16);
    destruirNovoBoss(scene);
    scene.events.emit("shutdown");
    scene.events.emit("destroy");
    assert.equal(sprites.length, 1);
    assert.equal(primeiro.destruidos, 1);
    prepararNovoBoss(scene);
    assert.equal(sprites.length, 2);
    assert.equal(scene.novoBoss.estado, "posicionada");
  }
});

test("shutdown enquanto aguarda impede criação tardia e remove listeners", () => {
  const { scene, sprites } = criarCena();
  prepararNovoBoss(scene);
  scene.events.emit("shutdown");
  scene.player.y = -5500;
  atualizarNovoBoss(scene, 500, 16);
  assert.equal(sprites.length, 0);
  assert.equal(scene.events.listenerCount("shutdown"), 0);
  assert.equal(scene.events.listenerCount("destroy"), 0);
});

test("controlador integra dano, viagem e derrota sem recriar a entidade", () => {
  const { scene, sprites } = criarCena({ dentro: true });
  const encontro = prepararNovoBoss(scene);
  const hitbox = encontro.hitboxDano;
  const origem = { x: encontro.x, y: encontro.y };
  assert.equal(encontro.receberDano(25), false);
  atualizarNovoBoss(scene, 0, encontro.config.combate.preparacaoMs);
  assert.equal(encontro.estado, "vulneravel");
  assert.equal(encontro.receberDano(25), true);
  assert.equal(encontro.vida, encontro.vidaMaxima - 25);
  assert.equal(encontro.receberDano(25), false);
  assert.equal(encontro.body.enable, true);
  for (let i = 0; i < 2; i++) {
    atualizarNovoBoss(scene, 0, encontro.config.combate.intervaloAcertosMs);
    assert.equal(encontro.receberDano(25), true);
  }
  assert.equal(encontro.vida, encontro.vidaMaxima - 75);
  assert.equal(encontro.body.enable, false);
  atualizarNovoBoss(scene, 0,
    encontro.config.teleporte.desaparecerMs + encontro.config.teleporte.reaparecerMs);
  assert.notDeepEqual({ x: encontro.x, y: encontro.y }, origem);
  assert.equal(encontro.hitboxDano, hitbox);
  assert.equal(encontro.hitbox, hitbox);
  assert.equal(encontro.body.enable, true);

  const vida = encontro.vida;
  const relogio = encontro.relogioCombate;
  scene.player.y = -5300;
  atualizarNovoBoss(scene, 0, 10000);
  assert.equal(encontro.vida, vida);
  assert.equal(encontro.relogioCombate, relogio);
  scene.player.y = -5500;
  atualizarNovoBoss(scene, 0, encontro.config.combate.preparacaoMs);
  let derrotas = 0;
  scene.events.on("novo-boss:derrotada", () => derrotas++);
  assert.equal(encontro.receberDano(encontro.vida), true);
  assert.equal(encontro.estado, "derrotada");
  assert.equal(encontro.active, false);
  assert.equal(encontro.body.enable, false);
  assert.equal(encontro.receberDano(25), false);
  atualizarNovoBoss(scene, 0, 60000);
  assert.equal(derrotas, 1);
  assert.equal(sprites.length, 1);
  destruirNovoBoss(scene);
  assert.equal(encontro.receberDano(25), false);
});

test("multiplayer não instancia combate local e pode retornar ao solo", () => {
  const { scene, sprites } = criarCena({ dentro: true });
  scene.multiplayer = true;
  const encontro = prepararNovoBoss(scene);
  atualizarNovoBoss(scene, 0, 10000);
  assert.equal(encontro.sprite, null);
  assert.equal(encontro.relogioCombate, 0);
  assert.equal(sprites.length, 0);
  assert.equal(encontro.receberDano(25), false);
  scene.multiplayer = false;
  atualizarNovoBoss(scene, 0, 0);
  assert.equal(sprites.length, 1);
  assert.equal(encontro.visible, true);
  scene.multiplayer = true;
  atualizarNovoBoss(scene, 0, 2000);
  assert.equal(encontro.visible, false);
  assert.equal(encontro.body.enable, false);
  assert.equal(encontro.relogioCombate, 0);
  scene.multiplayer = false;
  atualizarNovoBoss(scene, 0, 0);
  assert.equal(encontro.visible, true);
  assert.equal(encontro.body.enable, true);
  assert.equal(sprites.length, 1);
});
