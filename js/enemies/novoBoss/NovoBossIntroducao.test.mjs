import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { prepararIntroducaoNovoBoss } from "./NovoBossIntroducao.js";
import { novoBossConfig } from "./NovoBossConfig.js";

// A câmera é a implementação real do Phaser usada pelo jogo.
const bundle = readFileSync(new URL("../../libs/phaser.min.js", import.meta.url), "utf8");
const contexto = { module: { exports: {} }, exports: {}, importScripts() {}, window: {}, navigator: {} };
vm.runInNewContext(bundle.replace("i(85454)})());", "i})());"), contexto);
const Camera = contexto.module.exports(38058);

function fixture() {
  const player = { active: true, x: -1080, y: -5500,
    body: { x: -1090, y: -5530, width: 20, height: 50 },
    setVelocity(x, y) { this.velocidade = { x, y }; },
    anims: { isPaused: false, pause() { this.isPaused = true; }, resume() { this.isPaused = false; } } };
  const c = new Camera(0, 0, 800, 450);
  c.setZoom(1.2).startFollow(player, false, 0.3, 0.4, 10, -20);
  const chamadas = [];
  const portas = ["porta02", "porta03", "porta05"].map((nome, i) => ({ nome, estado: "aberta",
    area: { x: -1248 + i * 192, y: -5328, width: 144, height: 96 },
    fecharParaBoss() { chamadas.push(`fechar:${nome}`); this.estado = "fechando"; },
    liberarAposBoss() { chamadas.push(`liberar:${nome}`); this.estado = "aberta"; } }));
  const scene = { player, portasFabrica: portas, cameras: { main: c }, vida: 100,
    events: new EventEmitter(), movimentoBloqueado: false,
    input: { enabled: true, keyboard: { enabled: true, resetKeys() {} } } };
  c.scene = scene;
  const encontro = { config: novoBossConfig, jogadorNaArena: true,
    sprite: { active: true, x: -1080, y: -5810 } };
  return { scene, encontro, c, portas, chamadas, sistema: prepararIntroducaoNovoBoss(scene, encontro) };
}
const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`);
const centro = c => ({ x: c.scrollX + c.width / 2, y: c.scrollY + c.height / 2 });

test("câmera real vai ao boss, retorna ao jogador e só então fecha as duas persianas", () => {
  const { scene, encontro, c, portas, chamadas, sistema } = fixture();
  const inicio = centro(c);
  assert.equal(sistema.atualizar(0), true);
  assert.equal(scene.movimentoBloqueado, true);
  assert.equal(scene.input.enabled, false);
  assert.equal(scene.input.keyboard.enabled, false);
  assert.equal(scene.player.anims.isPaused, true);
  assert.equal(c._follow, null);
  assert.deepEqual(scene.player.velocidade, { x: 0, y: 0 });
  sistema.atualizar(450);
  perto(centro(c).x, (inicio.x + encontro.sprite.x) / 2);
  perto(centro(c).y, (inicio.y + encontro.sprite.y) / 2);
  sistema.atualizar(450);
  assert.equal(sistema.snapshot().etapa, "mostrando");
  perto(centro(c).x, encontro.sprite.x);
  perto(centro(c).y, encontro.sprite.y);
  assert.deepEqual(chamadas, []);
  sistema.atualizar(650);
  assert.equal(sistema.snapshot().etapa, "voltando");
  sistema.atualizar(900);
  assert.equal(sistema.snapshot().etapa, "fechando");
  perto(centro(c).x, scene.player.x - 10);
  perto(centro(c).y, scene.player.y + 20);
  assert.deepEqual(chamadas, ["fechar:porta02", "fechar:porta03"]);
  assert.equal(portas[2].estado, "aberta");
  sistema.atualizar(850);
  assert.equal(sistema.snapshot().concluida, false, "espera as animações reais das portas terminarem");
  portas[0].estado = portas[1].estado = "fechada";
  assert.equal(sistema.atualizar(16), true);
  assert.equal(sistema.snapshot().concluida, true);
  assert.equal(scene.movimentoBloqueado, false);
  assert.equal(scene.cenaEntradaBossAtiva, undefined);
  assert.equal(scene.input.enabled, true);
  assert.equal(scene.input.keyboard.enabled, true);
  assert.equal(scene.player.anims.isPaused, false);
  assert.equal(c._follow, scene.player);
  perto(c.lerp.x, 0.3); perto(c.lerp.y, 0.4);
  perto(c.followOffset.x, 10); perto(c.followOffset.y, -20);
  perto(c.zoom, 1.2);
  assert.equal(sistema.atualizar(10000), false, "não repete a cena ao continuar na sala");
  scene.events.emit("novo-boss:derrotada", { encontro: {} });
  assert.equal(chamadas.length, 2);
  scene.events.emit("novo-boss:derrotada", { encontro });
  assert.deepEqual(chamadas.slice(2), ["liberar:porta02", "liberar:porta03"]);
  sistema.destruir(); sistema.destruir();
  assert.equal(chamadas.length, 4);
  assert.equal(scene.events.listenerCount("novo-boss:derrotada"), 0);
});

test("a entrada espera o corpo passar pelas portas, menus e animações de abertura", () => {
  const { scene, portas, sistema } = fixture();
  Object.assign(scene.player.body, { x: -1200, y: -5350, height: 50 });
  sistema.atualizar(1000);
  assert.equal(sistema.snapshot().etapa, "aguardando");
  assert.equal(scene.movimentoBloqueado, false, "permite terminar a passagem");
  scene.player.body.y = -5500;
  portas[0].estado = "abrindo";
  sistema.atualizar(1000);
  assert.equal(sistema.snapshot().etapa, "aguardando");
  portas[0].estado = "aberta";
  scene.generatorMenuOpen = true;
  sistema.atualizar(1000);
  assert.equal(sistema.snapshot().etapa, "aguardando");
  scene.generatorMenuOpen = false;
  sistema.atualizar(0);
  assert.equal(sistema.snapshot().etapa, "indo");
  sistema.destruir();
});

test("interrupção restaura câmera e controles e libera portas, inclusive no meio do fechamento", () => {
  for (const fechar of [false, true]) {
    for (const interromper of [f => { f.scene.morteEmAndamento = true; },
      f => { f.encontro.jogadorNaArena = false; }, f => { f.scene.multiplayer = true; },
      f => { f.scene.cameras.main = {}; }, f => f.sistema.destruir()]) {
      const f = fixture();
      f.scene.input.enabled = false;
      f.sistema.atualizar(0);
      if (fechar) f.sistema.atualizar(2450);
      interromper(f);
      f.sistema.atualizar(16);
      assert.equal(f.scene.movimentoBloqueado, false);
      assert.equal(f.scene.cenaEntradaBossAtiva, undefined);
      assert.equal(f.scene.input.enabled, false, "preserva o bloqueio de entrada anterior");
      assert.equal(f.scene.input.keyboard.enabled, true);
      assert.equal(f.c._follow, f.scene.player);
      assert.ok(f.portas.every(porta => porta.estado === "aberta"));
      f.sistema.destruir();
    }
  }
});

test("movimento da câmera independe do FPS e cenas sem suporte ou com opção desativada não são bloqueadas", () => {
  const a = fixture(), b = fixture();
  a.sistema.atualizar(0); b.sistema.atualizar(0);
  a.sistema.atualizar(1000);
  for (let i = 0; i < 50; i++) b.sistema.atualizar(20);
  perto(centro(a.c).x, centro(b.c).x); perto(centro(a.c).y, centro(b.c).y);
  assert.equal(a.sistema.snapshot().etapa, b.sistema.snapshot().etapa);
  a.sistema.destruir(); b.sistema.destruir();
  assert.equal(prepararIntroducaoNovoBoss({}, { config: novoBossConfig }), null);
  assert.equal(prepararIntroducaoNovoBoss(a.scene, { config: { cenaEntrada: { ativo: false } } }), null);
});
