import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { assetsNovoBoss } from "./NovoBossAssets.js";
import { criarVisualDisparoEnergia, atualizarVisualDisparoEnergia,
  configurarCorpoDisparoEnergia } from "./NovoBossDisparoEnergia.js";
import { criarLasersEspiral } from "./ataques/LasersEspiral.js";

function cena() {
  const sprites = [], registros = new Set();
  const scene = { player: { x: 1000, y: 0 }, textures: { exists: () => true }, add: {
    sprite(x, y, key, frame) {
      const objeto = { x, y, active: true, texture: { key }, frame: { name: frame },
        setOrigin(x, y) { this.originX = x; this.originY = y; return this; },
        setScale(scale) { this.scaleX = this.scaleY = scale; return this; },
        setDepth() { return this; }, setRotation(rotation) { this.rotation = rotation; return this; },
        setTint(tint) { this.tint = tint; return this; }, setAlpha(alpha) { this.alpha = alpha; return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; },
        setTexture(key, frame) { this.texture = { key }; this.frame = { name: frame }; return this; },
        setFrame(frame) { this.frame = { name: frame }; return this; },
        destroy() { this.active = false; },
      };
      sprites.push(objeto); return objeto;
    },
  } };
  return { scene, sprites, registros };
}

test("derivados mantêm a fonte, 61 quadros, 20 ms e páginas de até 4096 px", () => {
  const base = new URL("../../../assets/PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/", import.meta.url);
  const meta = JSON.parse(readFileSync(new URL("derivados/disparo-energia.json", base)));
  assert.equal(createHash("sha256").update(readFileSync(new URL(meta.original, base))).digest("hex"), meta.sha256Original);
  assert.equal(meta.quadros, assetsNovoBoss.disparoEnergia.totalQuadros);
  assert.equal(meta.duracaoTotalMs, 1220);
  assert.equal(meta.loop, 0);
  assert.equal(meta.coresVisiveis, 200);
  assert.equal(meta.duracoesMs.length, 61);
  assert.ok(meta.duracoesMs.every(ms => ms === assetsNovoBoss.disparoEnergia.frameMs));
  assert.deepEqual(meta.paginasJogo.map(p => p.quadros), [32, 29]);
  for (const pagina of meta.paginasJogo) {
    const png = readFileSync(new URL(`derivados/${pagina.arquivo}`, base));
    assert.equal(png.readUInt32BE(16), pagina.colunas * meta.larguraFrame);
    assert.equal(png.readUInt32BE(20), Math.ceil(pagina.quadros / pagina.colunas) * meta.alturaFrame);
    assert.ok(png.readUInt32BE(16) <= 4096 && png.readUInt32BE(20) <= 4096);
  }
});

test("reprodução visita os 61 quadros em ordem, por 20 ms, e repete em 1220 ms", () => {
  const { scene } = cena();
  const sprite = criarVisualDisparoEnergia(scene, 0, 0, 6, 1, 0);
  for (let ciclo = 0; ciclo < 2; ciclo++) {
    for (let quadro = 0; quadro < 61; quadro++) {
      const idade = ciclo * 1220 + quadro * 20;
      atualizarVisualDisparoEnergia(sprite, idade, 1, 0);
      assert.equal(sprite.novoBossQuadroEnergia, quadro);
      assert.equal(sprite.texture.key, quadro < 32 ? assetsNovoBoss.disparoEnergia.chave : assetsNovoBoss.disparoEnergiaFinal.chave);
      assert.equal(sprite.frame.name, quadro < 32 ? quadro : quadro - 32);
      atualizarVisualDisparoEnergia(sprite, idade + 19, 1, 0);
      assert.equal(sprite.novoBossQuadroEnergia, quadro);
    }
  }
});

test("animação segue direção de voo e reflexão sem trocar posição, cor ou raio", () => {
  const { scene } = cena();
  const sprite = criarVisualDisparoEnergia(scene, 23, 45, 6, 1, 0);
  assert.equal(sprite.rotation, Math.PI);
  atualizarVisualDisparoEnergia(sprite, 620, -1, 0);
  assert.equal(sprite.rotation, 2 * Math.PI);
  atualizarVisualDisparoEnergia(sprite, 700, 0, 1);
  assert.equal(sprite.rotation, Math.PI * 1.5);
  assert.deepEqual([sprite.x, sprite.y], [23, 45]);
  assert.equal(sprite.scaleX * assetsNovoBoss.disparoEnergia.raioNativo, 6);
  assert.equal(sprite.tint, undefined);
});

test("margens transparentes e mudança de página não aumentam o círculo físico", () => {
  const { scene } = cena();
  const sprite = criarVisualDisparoEnergia(scene, 0, 0, 6, 1, 0);
  let circulo;
  sprite.body = { setCircle(...args) { circulo = args; }, updateFromGameObject() {} };
  configurarCorpoDisparoEnergia(sprite);
  assert.deepEqual(circulo, [55, 105, 205]);
  atualizarVisualDisparoEnergia(sprite, 640, 1, 0);
  assert.deepEqual(circulo, [55, 105, 205]);
  assert.equal(circulo[0] * sprite.scaleX, 6);
});

test("textura incompleta não cria visual; deltas inválidos não avançam o quadro", () => {
  const c = cena();
  c.scene.textures.exists = key => key !== assetsNovoBoss.disparoEnergiaFinal.chave;
  assert.equal(criarVisualDisparoEnergia(c.scene, 0, 0, 6, 1, 0), null);
  assert.equal(c.sprites.length, 0);
  c.scene.textures.exists = () => true;
  const sprite = criarVisualDisparoEnergia(c.scene, 0, 0, 6, 1, 0);
  for (const idade of [-1, NaN, Infinity]) atualizarVisualDisparoEnergia(sprite, idade, 1, 0);
  assert.equal(sprite.novoBossQuadroEnergia, 0);
  sprite.destroy(); atualizarVisualDisparoEnergia(sprite, 600, 1, 0);
  assert.equal(sprite.novoBossQuadroEnergia, 0);
});

test("sprite aceita a API de reflexão antiga sem mudar arquivo ou criar contorno artificial", () => {
  const { scene } = cena();
  const sprite = criarVisualDisparoEnergia(scene, 0, 0, 6, 1, 0);
  assert.equal(sprite.setFillStyle(0x38bdf8, 1), sprite);
  assert.equal(sprite.setStrokeStyle(2, 0xb9f0ff, 1), sprite);
  assert.equal(sprite.tint, 0x38bdf8);
  assert.equal(sprite.alpha, 1);
  assert.equal(sprite.texture.key, assetsNovoBoss.disparoEnergia.chave);
});

test("fábrica da espiral usa sprites animados sem mudar emissão, percurso ou limpeza", () => {
  const { scene, sprites, registros } = cena();
  const ataque = criarLasersEspiral(scene, { x: 0, y: 0 },
    { avisoMs: 0, quantidade: 2, intervaloMs: 100, velocidade: 100, vidaProjetilMs: 3000 }, {
      registrarLaser: visual => registros.add(visual),
      desregistrarLaser: visual => registros.delete(visual),
      atingirJogadorComLaser: () => false,
    });
  ataque.atualizar(700);
  assert.equal(sprites.length, 2);
  assert.equal(registros.size, 2);
  const estado = ataque.snapshot();
  assert.equal(estado.emitidos, 2);
  assert.deepEqual(sprites.map(s => s.novoBossQuadroEnergia), [35, 30]);
  assert.ok(Math.abs(Math.hypot(estado.projeteis[0].x, estado.projeteis[0].y) - 70) < 0.001);
  ataque.destruir(); ataque.destruir();
  assert.ok(sprites.every(s => !s.active));
  assert.equal(registros.size, 0);
});
