/**
 * Regressões da volta do ataque para caminhada quando o golpe na fila fica sem estamina.
 * Simula frames/origens do sprite para conferir a geometria; não renderiza nem resolve física.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { criarPlayer, atacar, soltarAtaque, atualizarHitboxDanoPlayer } from "./Player.js";
import { atualizarMovimento } from "../controls/PlayerMovement.js";

const PERSONAGENS = {
  "kai-mercer": { walk: "walk", attack: "attack" },
  "magnus-force": { walk: "personagem2-walk", attack: "personagem2-attack" },
  "aria-kade": { walk: "personagem3-walk", attack: "personagem3-attack" },
  nyx: { walk: "personagem4-walk", attack: "personagem4-attack" },
};
const TAMANHOS = {
  walk: 128, attack: 128,
  "personagem2-walk": 64, "personagem2-attack": 128,
  "personagem3-walk": 128, "personagem3-attack": 64,
  "personagem4-walk": 64, "personagem4-attack": 192,
  "aria-arrow": 64,
};
const MOVIMENTOS = [
  ["cima", 0, -1], ["baixo", 0, 1], ["esquerda", -1, 0], ["direita", 1, 0],
  ["diagonal superior esquerda", -1, -1], ["diagonal superior direita", 1, -1],
  ["diagonal inferior esquerda", -1, 1], ["diagonal inferior direita", 1, 1],
];

class Rectangle {
  constructor(x, y, width, height) { this.setTo(x, y, width, height); }
  setTo(x, y, width, height) { Object.assign(this, { x, y, width, height }); return this; }
}
class Vector2 {
  constructor(x, y) { Object.assign(this, { x, y }); }
  normalize() {
    const d = Math.hypot(this.x, this.y);
    if (d) { this.x /= d; this.y /= d; }
    return this;
  }
}
globalThis.Phaser = {
  BlendModes: { NORMAL: 0 }, Textures: { FilterMode: { NEAREST: 0 } },
  Geom: { Rectangle }, Math: { Vector2 },
};

function criarSprite(x, y, textura, frame, personagem) {
  const eventos = new Map();
  const sprite = {
    x, y, active: true, originX: 0.5, originY: 0.5,
    setTexture(key, name = 0) {
      this.texture = { key };
      this.width = this.height = TAMANHOS[key];
      this.frame = { name };
      return this;
    },
    setOrigin(originX, originY) { Object.assign(this, { originX, originY }); return this; },
    setDisplayOrigin(x, y) { return this.setOrigin(x / this.width, y / this.height); },
    get displayOriginX() { return this.originX * this.width; },
    get displayOriginY() { return this.originY * this.height; },
    setFrame(name) { this.frame = { name }; return this; },
    setRotation(rotation) { this.rotation = rotation; return this; },
    setDepth(depth) { this.depth = depth; return this; },
    setVertexRoundMode() { return this; },
    setAlpha() { return this; }, clearTint() { return this; }, setBlendMode() { return this; },
    setVelocity(x, y) { this.body.setVelocity(x, y); return this; },
    on(evento, callback) {
      if (!eventos.has(evento)) eventos.set(evento, []);
      eventos.get(evento).push(callback);
      return this;
    },
    emit(evento, ...args) { for (const callback of eventos.get(evento) || []) callback(...args); },
  };
  sprite.setTexture(textura, frame);
  sprite.body = {
    offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 },
    width: sprite.width, height: sprite.height,
    get x() { return sprite.x - sprite.displayOriginX + this.offset.x; },
    get y() { return sprite.y - sprite.displayOriginY + this.offset.y; },
    get bottom() { return this.y + this.height; },
    setSize(width, height) { Object.assign(this, { width, height }); return this; },
    setOffset(x, y) { Object.assign(this.offset, { x, y }); return this; },
    setVelocity(x, y) { Object.assign(this.velocity, { x, y }); return this; },
    setAllowGravity() { return this; }, setImmovable() { return this; },
  };
  sprite.anims = {
    isPlaying: false, timeScale: 1,
    play(key) {
      this.currentAnim = { key };
      this.isPlaying = true;
      const config = PERSONAGENS[personagem];
      sprite.setTexture(/^(walk|idle)-/.test(key) ? config.walk : config.attack);
      return this;
    },
    stop() { this.isPlaying = false; return this; },
  };
  return sprite;
}

function criarCena(personagem, estamina) {
  const scene = {
    personagemSelecionada: personagem, estamina, estaminaMaxima: 100, custoAtaque: 20,
    respawnX: 80, respawnY: -160, speed: 200,
    time: { now: 1000, addEvent: () => ({ remove() {} }), delayedCall() {} },
    textures: { get: () => ({ setFilter() {} }) },
    add: { graphics: () => ({ setDepth() {}, setVisible() {} }) },
    joystick: { force: 0 }, threshold: 0.1,
    teclasWASD: Object.fromEntries(
      ["cima", "baixo", "esquerda", "direita"].map(key => [key, { isDown: false }]),
    ),
    physics: { add: {
      sprite: (x, y, texture, frame) => criarSprite(x, y, texture, frame, personagem),
      group: () => ({
        active: true, children: { entries: [] },
        add(sprite) { this.children.entries.push(sprite); },
      }),
    } },
  };
  criarPlayer(scene);
  return scene;
}

function mover(scene, x, y) {
  for (const [tecla, pressionada] of Object.entries({
    cima: y < 0, baixo: y > 0, esquerda: x < 0, direita: x > 0,
  })) scene.teclasWASD[tecla].isDown = pressionada;
  atualizarMovimento(scene);
  scene.player.x += scene.player.body.velocity.x * 0.016;
  scene.player.y += scene.player.body.velocity.y * 0.016;
  atualizarHitboxDanoPlayer(scene);
}

function geometriaRelativa(scene) {
  const { player, hitboxDanoPlayer: dano } = scene;
  return [
    player.body.x - player.x, player.body.y - player.y,
    player.body.width, player.body.height,
    dano.x - player.x, dano.y - player.y, dano.width, dano.height,
  ];
}

function conferirGeometria(scene, esperada) {
  const atual = geometriaRelativa(scene);
  atual.forEach((valor, i) => assert.ok(Math.abs(valor - esperada[i]) < 1e-8,
    `Hitbox deslocada: ${JSON.stringify(atual)}; esperado ${JSON.stringify(esperada)}`));
}

function concluirAtaque(scene) {
  if (scene.ariaAtaqueCarregando) soltarAtaque(scene);
  const animacao = scene.player.anims.currentAnim;
  scene.player.anims.isPlaying = false;
  scene.player.emit("animationcomplete", animacao);
  atualizarHitboxDanoPlayer(scene);
}

for (const personagem of Object.keys(PERSONAGENS)) {
  for (const [nome, x, y] of MOVIMENTOS) {
    test(`${personagem}: hitboxes voltam ao normal sem estamina andando para ${nome}`, () => {
      for (const sobra of [0, 5, 19]) {
        const scene = criarCena(personagem, 20 + sobra);
        mover(scene, x, y);
        const geometriaWalk = geometriaRelativa(scene);
        const origemWalk = [scene.player.originX, scene.player.originY];
        atacar(scene);
        assert.equal(scene.atacando, true);
        assert.equal(scene.estamina, sobra);
        mover(scene, x, y);
        scene.time.now += 240;
        atacar(scene); // Guarda o próximo comando nos instantes finais do ataque.
        scene.time.now += 50;
        const posicaoAntes = [scene.player.x, scene.player.y];
        concluirAtaque(scene);

        conferirGeometria(scene, geometriaWalk);
        assert.equal(scene.atacando, false);
        assert.equal(scene.ariaAtaqueCarregando, false);
        assert.equal(scene.direcaoAtaque, null);
        assert.equal(scene.player.texture.key, PERSONAGENS[personagem].walk);
        assert.deepEqual([scene.player.originX, scene.player.originY], origemWalk);
        assert.deepEqual([scene.player.x, scene.player.y], posicaoAntes);
        for (let i = 0; i < 3; i++) {
          mover(scene, x, y);
          atacar(scene); // Comandos novos sem saldo não podem alterar sprite ou corpo.
          conferirGeometria(scene, geometriaWalk);
        }
      }
    });
  }

  test(`${personagem}: fila respeita a soltura da Aria e restaura a colisão ao terminar`, () => {
    const scene = criarCena(personagem, 40);
    mover(scene, 1, -1);
    const geometriaWalk = geometriaRelativa(scene);
    atacar(scene);
    scene.time.now += 240;
    atacar(scene);
    scene.time.now += 50;
    concluirAtaque(scene);
    if (personagem === "aria-kade") {
      assert.equal(scene.atacando, false); // Nunca inicia uma carga sem um novo toque.
      assert.equal(scene.estamina, 20);
      assert.equal(scene.networkAttackId, 1);
      conferirGeometria(scene, geometriaWalk);
      return;
    }
    assert.equal(scene.atacando, true);
    assert.equal(scene.estamina, 0);
    assert.equal(scene.networkAttackId, 2);
    mover(scene, -1, 1);
    concluirAtaque(scene);
    assert.equal(scene.atacando, false);
    conferirGeometria(scene, geometriaWalk);
  });
}
