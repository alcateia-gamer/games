import test from "node:test";
import assert from "node:assert/strict";
import { assetsNovoBoss } from "./NovoBossAssets.js";
import { criarTeleporteVisualNovoBoss, quadroTeleporteNovoBoss } from "./NovoBossTeleporteVisual.js";

function fixture() {
  const criados = [];
  const scene = { textures: { exists: () => true }, add: { sprite() {
    const s = { active: true };
    for (const [nome, campo] of [["setName", "name"], ["setDepth", "depth"],
      ["setScale", "scale"], ["setFlipX", "flipX"], ["setVisible", "visible"]]) {
      s[nome] = function (v) { this[campo] = v; return this; };
    }
    s.setTexture = function (key, frame) { Object.assign(this, { key, frame }); return this; };
    s.setPosition = function (x, y) { Object.assign(this, { x, y }); return this; };
    s.setOrigin = function (x, y) { Object.assign(this, { originX: x, originY: y }); return this; };
    s.destroy = function () { this.active = false; };
    criados.push(s); return s;
  } } };
  const encontro = { config: { visual: { escala: 0.55 },
    teleporte: { desaparecerMs: 250, reaparecerMs: 250 } },
    sprite: { active: true, alpha: 1, setAlpha(a) { this.alpha = a; } },
    teleporte: { origem: { x: 100, y: 150 }, destino: { x: 300, y: 350 },
      etapa: "desaparecendo", decorrido: 0 } };
  return { scene, encontro, criados, visual: criarTeleporteVisualNovoBoss(scene, encontro) };
}

test("amostragem respeita todos os tempos úteis, inclusive fronteiras e último quadro", () => {
  for (const asset of [assetsNovoBoss.teleporteSaida, assetsNovoBoss.teleporteEntrada]) {
    const total = asset.duracoesMs.reduce((a, b) => a + b, 0);
    let inicio = 0;
    asset.duracoesMs.forEach((ms, i) => {
      assert.equal(quadroTeleporteNovoBoss(asset, (inicio + ms / 2) / total), i);
      inicio += ms;
    });
    assert.equal(quadroTeleporteNovoBoss(asset, -1), 0);
    assert.equal(quadroTeleporteNovoBoss(asset, 1), asset.ultimoFrame);
    assert.equal(quadroTeleporteNovoBoss(asset, 2), asset.ultimoFrame);
  }
});

test("mesmo sprite visual troca saída/entrada, espelha e preserva corpo, relógio e destinos", () => {
  const { encontro: e, visual: v, criados } = fixture();
  const original = JSON.stringify(e.teleporte);
  assert.equal(v.atualizar(true), true);
  const s = criados[0];
  assert.equal(e.sprite.alpha, 0);
  assert.equal(s.key, assetsNovoBoss.teleporteSaida.chave);
  assert.deepEqual([s.x, s.y, s.frame], [100, 150, 0]);
  assert.equal(JSON.stringify(e.teleporte), original);
  e.teleporte.etapa = "reaparecendo"; e.teleporte.decorrido = 125;
  e.sprite.flipX = true;
  v.atualizar(true);
  assert.equal(criados.length, 1);
  assert.deepEqual([s.x, s.y, s.flipX, s.scale], [300, 350, true, 0.55]);
  assert.equal(s.key, assetsNovoBoss.teleporteEntrada.chave);
  assert.equal(s.body, undefined);
  e.teleporte = null;
  assert.equal(v.atualizar(true), false);
  assert.equal(s.visible, false); assert.equal(e.sprite.alpha, 1);
  v.destruir(); v.destruir(); assert.equal(s.active, false);
});

test("espera segura, morte, saída da arena e recurso ausente não deixam imagem duplicada", () => {
  const { scene, encontro: e, visual: v, criados } = fixture();
  v.atualizar(true);
  e.teleporte.etapa = "aguardando-destino";
  v.atualizar(true);
  assert.equal(criados[0].visible, false); assert.equal(e.sprite.alpha, 0.35);
  e.teleporte.etapa = "reaparecendo";
  v.atualizar(true);
  e.morto = true; e.sprite.alpha = 1;
  v.atualizar(false);
  assert.equal(e.sprite.alpha, 1, "não apaga a pose de morte");
  assert.equal(criados[0].visible, false);
  scene.textures.exists = () => false;
  assert.equal(v.atualizar(true), false);
  v.destruir();
});
