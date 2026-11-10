import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { assetsNovoBoss } from "./NovoBossAssets.js";
import { criarVisualTentaculo } from "./NovoBossTentaculoVisual.js";
import { criarTentaculos } from "./ataques/Tentaculos.js";

function cena() {
  const sprites = [];
  const scene = { player: { x: 40, y: 20 }, textures: { exists: () => true }, add: {
    sprite(x, y, key, frame) {
      const s = { x, y, texture: { key }, frame: { name: frame }, active: true,
        setName(name) { this.name = name; return this; },
        setOrigin(x, y) { this.originX = x; this.originY = y; return this; },
        setScale(scale) { this.scale = scale; return this; }, setDepth(depth) { this.depth = depth; return this; },
        setVisible(visible) { this.visible = visible; return this; },
        setTexture(key, frame) { this.texture = { key }; this.frame = { name: frame }; return this; },
        setFrame(frame) { this.frame = { name: frame }; return this; },
        setPosition(x, y) { this.x = x; this.y = y; return this; },
        destroy() { this.active = false; this.destruicoes = (this.destruicoes ?? 0) + 1; },
      };
      sprites.push(s); return s;
    },
  } };
  return { scene, sprites };
}

test("fonte, 140 tempos e atlas conservam dimensões lógicas e agarrão separado", () => {
  const base = new URL("../../../assets/PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/", import.meta.url);
  const meta = JSON.parse(readFileSync(new URL("derivados/tentaculo/tentaculo.json", base)));
  assert.equal(createHash("sha256").update(readFileSync(new URL(meta.fonte, base))).digest("hex"), meta.sha256Original);
  assert.equal(meta.quadros, 140); assert.equal(meta.duracaoMs, 5600); assert.equal(meta.loop, 0);
  assert.equal(meta.duracoesMs.length, 140); assert.ok(meta.duracoesMs.every(ms => ms === 40));
  assert.equal(meta.agarrao.quadros, 20);
  for (const [asset, quantidade] of [[assetsNovoBoss.tentaculo, 140], [assetsNovoBoss.tentaculoAgarrao, 20]]) {
    const atlas = JSON.parse(readFileSync(new URL(`../../../assets/${asset.dados}`, import.meta.url)));
    assert.equal(Object.keys(atlas.frames).length, quantidade);
    assert.ok(atlas.meta.size.w <= 4096 && atlas.meta.size.h <= 4096);
    assert.ok(Object.values(atlas.frames).every(f => f.sourceSize.w === 800 && f.sourceSize.h === 600));
  }
});

test("animação-base visita 140 quadros por 40 ms sem mudar origem ou física", () => {
  const { scene } = cena(); const v = criarVisualTentaculo(scene, 10, 20, 18);
  assert.equal(v.sprite.visible, false); assert.equal(v.sprite.body, undefined);
  for (let i = 0; i <= 140; i++) {
    v.atualizar({ idade: i * 40, visivel: true, x: 10, y: 20 });
    assert.equal(v.sprite.frame.name, `tentaculo-${String(i % 140).padStart(3, "0")}`);
    v.atualizar({ idade: i * 40 + 39, visivel: true, x: 10, y: 20 });
    assert.equal(v.sprite.novoBossQuadroTentaculo, i % 140);
  }
  assert.equal(v.sprite.originY, 495 / 600);
  assert.equal(v.sprite.scale * 120, 36);
  assert.deepEqual([v.sprite.x, v.sprite.y], [10, 20]);
});

test("agarrão fecha em oito quadros e sustenta poses próprias sem alterar a base", () => {
  const { scene } = cena(); const v = criarVisualTentaculo(scene, 0, 0, 18);
  for (let i = 0; i < 8; i++) {
    v.atualizar({ idade: 1000 + i * 40, segurando: true, idadeCaptura: i * 40,
      visivel: true, x: 40, y: 20 });
    assert.equal(v.sprite.frame.name, `agarrao-${String(i).padStart(3, "0")}`);
    assert.equal(v.sprite.texture.key, assetsNovoBoss.tentaculoAgarrao.chave);
  }
  for (let t = 320; t < 2500; t += 40) {
    v.atualizar({ idade: 1000 + t, segurando: true, idadeCaptura: t, visivel: true, x: 40, y: 20 });
    assert.ok(v.sprite.novoBossQuadroTentaculo >= 8 && v.sprite.novoBossQuadroTentaculo <= 11);
  }
  assert.equal(v.sprite.originY, 499 / 600);
  assert.ok(Math.abs(v.sprite.scale * 352 - 46 * 1.35) < 0.001);
  v.atualizar({ idade: 80, segurando: false, visivel: true, x: 0, y: 0 });
  assert.equal(v.sprite.texture.key, assetsNovoBoss.tentaculo.chave);
  assert.equal(v.sprite.frame.name, "tentaculo-002");
});

test("assets ausentes não criam sprites; ocultar, deltas inválidos e destruir são seguros", () => {
  const c = cena(); c.scene.textures.exists = () => false;
  assert.equal(criarVisualTentaculo(c.scene, 0, 0, 18), null); assert.equal(c.sprites.length, 0);
  c.scene.textures.exists = () => true;
  const v = criarVisualTentaculo(c.scene, 0, 0, 18);
  for (const idade of [-1, NaN, Infinity]) v.atualizar({ idade, visivel: true, x: 10, y: 20 });
  assert.equal(v.sprite.visible, false);
  v.atualizar({ idade: 0, visivel: true, x: 10, y: 20 });
  v.atualizar({ idade: 40, visivel: false }); assert.equal(v.sprite.visible, false);
  v.destruir(); v.destruir(); assert.equal(v.sprite.destruicoes, 1);
});

test("fábrica mostra agarrão apenas após captura aceita e libera em 2500 ms sem dano", () => {
  const { scene, sprites } = cena(); const capturas = [], liberacoes = [];
  const ataque = criarTentaculos(scene, { config: { arena: { xMin: -500, xMax: 500, yMin: -500, yMax: 500 } } },
    { quantidade: 1, apertosParaLibertar: 0 }, {
      jogadorAtingeCirculo: () => true,
      capturarJogador: (id, ms) => { capturas.push({ id, ms }); return true; },
      liberarJogador: id => liberacoes.push(id),
      danoJogador: () => { throw new Error("Tentáculo não causa dano extra."); },
    });
  ataque.atualizar(999); assert.equal(sprites[0].visible, false);
  ataque.atualizar(1); assert.equal(capturas.length, 1); assert.equal(capturas[0].ms, 2500);
  assert.equal(sprites[0].texture.key, assetsNovoBoss.tentaculoAgarrao.chave);
  ataque.atualizar(2499); assert.equal(liberacoes.length, 0);
  ataque.atualizar(1); assert.deepEqual(liberacoes, [capturas[0].id]); assert.equal(sprites[0].visible, false);
  ataque.destruir(); assert.equal(sprites[0].active, false); assert.equal(liberacoes.length, 1);
});

test("captura recusada mantém o GIF-base e cancelar não deixa sprites ou liberações indevidas", () => {
  const { scene, sprites } = cena(); let liberacoes = 0;
  const ataque = criarTentaculos(scene, { config: { arena: { xMin: -500, xMax: 500, yMin: -500, yMax: 500 } } },
    { quantidade: 1, apertosParaLibertar: 0 }, { jogadorAtingeCirculo: () => true, capturarJogador: () => false,
      liberarJogador: () => liberacoes++ });
  ataque.atualizar(1000); assert.equal(sprites[0].texture.key, assetsNovoBoss.tentaculo.chave);
  assert.equal(sprites[0].visible, true);
  ataque.destruir(); ataque.destruir();
  assert.equal(sprites[0].destruicoes, 1); assert.equal(liberacoes, 0);
});

test("o agarrão permanece na armadilha e passa seu ponto fixo para a captura do jogador", () => {
  const {scene,sprites}=cena();
  scene.hitboxDanoPlayer={height:46,centerX:50,centerY:30};
  const pontos=[];
  const ataque=criarTentaculos(scene,{config:{arena:{xMin:-500,xMax:500,yMin:-500,yMax:500}}},
    {quantidade:1},{jogadorAtingeCirculo:()=>true,capturarJogador:(id,ms,ponto)=>{pontos.push(ponto);return true;}});
  scene.player.x=50;scene.player.y=30;
  ataque.atualizar(1000);
  const fixo=ataque.snapshot().armadilhas[0];
  assert.deepEqual(pontos,[{x:fixo.x,y:fixo.y}]);
  assert.deepEqual([sprites[0].x,sprites[0].y],[fixo.x,fixo.y]);
  scene.hitboxDanoPlayer.centerX=55;scene.hitboxDanoPlayer.centerY=35;
  ataque.atualizar(100);
  assert.deepEqual([sprites[0].x,sprites[0].y],[fixo.x,fixo.y]);
  ataque.destruir();
});
