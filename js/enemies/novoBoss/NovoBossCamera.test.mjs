import test from "node:test";
import assert from "node:assert/strict";
import { novoBossConfig, configurarZonasNovoBoss } from "./NovoBossConfig.js";
import { prepararCameraNovoBoss } from "./NovoBossCamera.js";

const camera = (x = 1, y = x) => ({ zoomX: x, zoomY: y,
  setZoom(x, y = x) { this.zoomX = x; this.zoomY = y; return this; } });
function fixture(x = 1, y = x) {
  const c = camera(x, y);
  const scene = { cameras: { main: c }, vida: 100,
    player: { x: -1080, y: -5400, active: true } };
  const encontro = { config: novoBossConfig, sprite: { active: true } };
  return { c, scene, encontro, sistema: prepararCameraNovoBoss(scene, encontro) };
}
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`);

test("câmera acompanha os retângulos ZonaBoss sem manter o encontro ativo nos espaços entre eles", () => {
  const { c, scene, encontro, sistema } = fixture();
  encontro.config = configurarZonasNovoBoss({ getObjectLayer: () => ({ objects: [
    { x: -1200, y: -5376, width: 300, height: 48 },
    { x: -529, y: -5906, width: 49, height: 194 },
  ] }) });
  Object.assign(scene.player, { x: -1080, y: -5350 });
  sistema.atualizar(2000);
  near(c.zoomX, 0.8);
  Object.assign(scene.player, { x: -505, y: -5800 });
  sistema.atualizar(2000);
  near(c.zoomX, 0.8);
  Object.assign(scene.player, { x: -1080, y: -5377 });
  sistema.atualizar(2000);
  near(c.zoomX, 1);
  assert.equal(sistema.snapshot().controlando, false);
});

test("entrada afasta gradualmente até 80% e fora da sala não toma controle da câmera", () => {
  const { c, scene, sistema } = fixture();
  sistema.atualizar(1000); near(c.zoomX, 1);
  c.setZoom(1.5);
  scene.player.y = -5500;
  sistema.atualizar(100);
  assert.ok(c.zoomX < 1.5 && c.zoomX > 1.2);
  sistema.atualizar(2000);
  near(c.zoomX, 1.2); near(c.zoomY, 1.2);
  assert.equal(sistema.snapshot().dentroArena, true);
  near(sistema.snapshot().zoomNormal.x, 1.5);
});

test("margem de saída evita oscilar e reentrar durante a restauração não acumula zoom", () => {
  const { c, scene, sistema } = fixture();
  scene.player.y = -5500; sistema.atualizar(2000); near(c.zoomX, 0.8);
  scene.player.y = novoBossConfig.arena.entradaY + 40;
  sistema.atualizar(2000); near(c.zoomX, 0.8);
  scene.player.y = novoBossConfig.arena.entradaY + 81;
  sistema.atualizar(100); assert.ok(c.zoomX > 0.8 && c.zoomX < 1);
  scene.player.y = -5500; sistema.atualizar(2000); near(c.zoomX, 0.8);
  scene.player.y = -5300; sistema.atualizar(2000); near(c.zoomX, 1);
  assert.equal(sistema.snapshot().controlando, false);
  c.setZoom(1.3); sistema.atualizar(2000); near(c.zoomX, 1.3);
});

test("morte, derrota, suspensão, ausência do jogador e multiplayer restauram o zoom", () => {
  for (const alterar of [
    f => { f.encontro.morto = true; },
    f => { f.encontro.encerrado = true; },
    f => { f.encontro.suspenso = true; },
    f => { f.scene.multiplayer = true; },
    f => { f.scene.morteEmAndamento = true; },
    f => { f.scene.vida = 0; },
    f => { f.scene.player.active = false; },
    f => { f.scene.player.morto = true; },
    f => { f.scene.player = null; },
  ]) {
    const f = fixture();
    f.scene.player.y = -5500; f.sistema.atualizar(2000); near(f.c.zoomX, 0.8);
    alterar(f); f.sistema.atualizar(2000); near(f.c.zoomX, 1);
    assert.equal(f.sistema.snapshot().controlando, false);
  }
});

test("preserva zoom por eixo, restaura a câmera anterior e limpa imediatamente ao encerrar", () => {
  const { c, scene, sistema } = fixture(1.5, 1.25);
  scene.player.y = -5500; sistema.atualizar(2000);
  near(c.zoomX, 1.2); near(c.zoomY, 1);
  const nova = scene.cameras.main = camera(2);
  sistema.atualizar(2000);
  near(c.zoomX, 1.5); near(c.zoomY, 1.25); near(nova.zoomX, 1.6);
  sistema.destruir(); sistema.destruir();
  near(nova.zoomX, 2); near(nova.zoomY, 2);
  sistema.atualizar(2000); near(nova.zoomX, 2);
});

test("transição independe do FPS; deltas negativos não avançam e não usa timers ou listeners", () => {
  const a = fixture(), b = fixture();
  a.scene.player.y = b.scene.player.y = -5500;
  a.sistema.atualizar(-1); near(a.c.zoomX, 1);
  a.sistema.atualizar(1000);
  for (let i = 0; i < 50; i++) b.sistema.atualizar(20);
  near(a.c.zoomX, b.c.zoomX);
  b.scene.cameras = null;
  b.sistema.atualizar(NaN); near(b.c.zoomX, 1);
});

test("sem boss posicionado ou entrando pelos limites errados não aproxima a câmera", () => {
  const f = fixture(); f.encontro.sprite = null; f.scene.player.y = -5500;
  f.sistema.atualizar(2000); near(f.c.zoomX, 1);
  f.encontro.sprite = { active: true };
  for (const p of [{ x: -2000, y: -5500 }, { x: -1080, y: -6200 }, { x: -1080, y: NaN }]) {
    Object.assign(f.scene.player, p); f.sistema.atualizar(2000); near(f.c.zoomX, 1);
  }
});
