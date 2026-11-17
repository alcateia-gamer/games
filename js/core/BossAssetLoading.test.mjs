import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { criarPreparacaoBoss, bossNecessarioNaEntrada } from "./BossAssetLoading.js";
import { ASSETS_BOSS, ASSETS_FABRICA, ASSETS_FABRICA_BASE, assetsFabricaProntos,
  enfileirarAssetsFabrica } from "./FactoryAssetPack.js";

function fixture() {
  const cache = () => {
    const data = new Map();
    return { exists: key => data.has(key), get: key => data.get(key), add: (key, value) => data.set(key, value) };
  };
  const load = new EventEmitter(), calls = [], texts = [];
  let loading = false;
  load.maxParallelDownloads = 2;
  load.isLoading = () => loading;
  load.start = () => { loading = true; load.starts = (load.starts ?? 0) + 1; };
  load.setPath = () => load;
  for (const tipo of ["image", "spritesheet", "atlas", "audio", "tilemapTiledJSON"])
    load[tipo] = chave => { calls.push({ tipo, chave }); return load; };
  const scene = { load, events: new EventEmitter(), calls, texts,
    textures: cache(), cache: { audio: cache(), tilemap: cache() },
    inventory: { getQuantity: () => scene.cartao ?? 0 }, game: { registry: new Map() },
    movimentoBloqueado: false, generatorMenuOpen: false,
    player: { active: true, x: -1080, y: -4700, setVelocity(x, y) { this.velocity = { x, y }; } },
    portasFabrica: ["porta02", "porta03"].map((nome, i) => ({ nome,
      area: { x: -1248 + i * 192, y: -5328, width: 144, height: 96 } })),
    cameras: { main: { width: 800, height: 450, originX: 0.5, originY: 0.5, zoom: 1 } },
    add: { text(x, y, text) {
      const obj = new EventEmitter();
      for (const method of ["setOrigin", "setScrollFactor", "setDepth", "setInteractive", "setPosition", "setScale"])
        obj[method] = () => obj;
      obj.setText = text => { obj.text = text; return obj; };
      obj.setVisible = value => { obj.visible = value; return obj; };
      obj.destroy = () => { obj.destroyed = true; obj.removeAllListeners(); };
      obj.text = text; texts.push(obj); return obj;
    } },
  };
  scene.concluir = (faltantes = []) => {
    for (const arquivo of calls) {
      if (faltantes.includes(arquivo.chave)) continue;
      const destino = arquivo.tipo === "audio" ? scene.cache.audio : arquivo.tipo === "tilemapTiledJSON" ? scene.cache.tilemap : scene.textures;
      destino.add(arquivo.chave, {});
    }
    calls.length = 0;
    loading = false;
    load.emit("complete");
  };
  return scene;
}

test("fábrica básica prepara 35 recursos e catálogo completo conserva as 18 texturas e 10 sons do boss", () => {
  assert.equal(ASSETS_FABRICA_BASE.length, 35);
  assert.equal(ASSETS_BOSS.filter(a => a.tipo !== "audio").length, 18);
  assert.equal(ASSETS_BOSS.filter(a => a.tipo === "audio").length, 10);
  const s = fixture();
  enfileirarAssetsFabrica(s, { incluirBoss: false });
  assert.equal(s.calls.length, 35);
  assert.ok(s.calls.some(a => a.chave === "luz-fabrica-oscilando"));
  assert.ok(!s.calls.some(a => ASSETS_BOSS.some(b => b.chave === a.chave)));
  s.concluir();
  assert.ok(assetsFabricaProntos(s, { incluirBoss: false }));
  assert.ok(!assetsFabricaProntos(s));
  const mp = fixture(); mp.multiplayer = true;
  const controle = criarPreparacaoBoss(mp);
  mp.cartao = 1; controle.atualizar();
  assert.equal(mp.calls.length, 0, "coop nunca inicia por proximidade com cartão");
  enfileirarAssetsFabrica(mp);
  assert.equal(mp.calls.length, ASSETS_FABRICA.length);
  mp.concluir();
});

test("cartão e proximidade iniciam uma fila por visita, sem cancelar ao se afastar ou bloquear exploração", () => {
  const s = fixture(), c = criarPreparacaoBoss(s);
  c.atualizar(); assert.equal(s.calls.length, 0);
  s.cartao = 1; s.player.y = -2000;
  c.atualizar(); assert.equal(s.calls.length, 0);
  s.player.y = -4700;
  c.atualizar();
  assert.equal(c.estado, "carregando");
  assert.equal(s.calls.length, 28);
  assert.equal(s.load.maxParallelDownloads, 1);
  assert.equal(s.movimentoBloqueado, false);
  assert.equal(s.generatorMenuOpen, false);
  assert.equal(s.texts.length, 0);
  s.player.y = -2000;
  for (let i = 0; i < 100; i++) c.atualizar();
  assert.equal(s.load.starts, 1);
  s.concluir();
  assert.ok(c.pronto);
  assert.equal(s.load.maxParallelDownloads, 2);
  s.player.y = -4700; c.atualizar();
  assert.equal(s.calls.length, 0);
  s.events.emit("shutdown");
});

test("entrada espera texturas E sons; falha permite retry parcial e continuação automática única", () => {
  const s = fixture(), c = criarPreparacaoBoss(s);
  let abriu = 0;
  c.aguardar(() => { assert.equal(s.generatorMenuOpen, false); abriu++; });
  c.aguardar(() => { abriu += 100; });
  assert.ok(s.movimentoBloqueado && s.generatorMenuOpen);
  assert.deepEqual(s.player.velocity, { x: 0, y: 0 });
  s.load.emit("progress", 0.5);
  assert.equal(s.texts[0].text, "CARREGANDO...");
  assert.deepEqual(s.texts.filter(t => t.visible).map(t => t.text), ["CARREGANDO..."]);
  s.concluir(["novo-boss-tentaculo", "musica-novo-boss"]);
  assert.equal(c.estado, "falhou");
  assert.equal(abriu, 0);
  assert.ok(s.texts[1].visible);
  s.texts[1].emit("pointerdown");
  assert.deepEqual(s.calls.map(a => a.chave).sort(), ["musica-novo-boss", "novo-boss-tentaculo"]);
  s.concluir(["musica-novo-boss"]);
  assert.equal(abriu, 0, "a música também é essencial antes da introdução");
  s.texts[1].emit("pointerdown");
  assert.deepEqual(s.calls.map(a => a.chave), ["musica-novo-boss"]);
  s.concluir();
  assert.equal(abriu, 1);
  assert.equal(s.movimentoBloqueado, false);
  assert.ok(s.texts.every(t => t.visible === false));
  s.load.emit("complete");
  assert.equal(abriu, 1);
  s.events.emit("shutdown");
  assert.ok(s.texts.every(t => t.destroyed));
});

test("cancelar, morrer ou encerrar durante downloads não executa a entrada pendente", () => {
  for (const acao of [s => s.texts[2].emit("pointerdown"), s => { s.morteEmAndamento = true; s.preparacaoBoss.atualizar(); },
    s => s.events.emit("shutdown")]) {
    const s = fixture(), c = criarPreparacaoBoss(s);
    let abriu = false;
    c.aguardar(() => { abriu = true; });
    acao(s);
    s.concluir();
    assert.equal(abriu, false);
    assert.equal(s.generatorMenuOpen, false);
    if (s.morteEmAndamento) assert.equal(s.movimentoBloqueado, true, "a espera não remove o bloqueio de morte");
    s.events.emit("shutdown");
    assert.equal(s.load.listenerCount("complete"), 0);
    assert.equal(s.load.listenerCount("progress"), 0);
    assert.equal(s.events.listenerCount("destroy"), 0);
  }
});

test("fila já ativa conclui antes do boss; encerrar remove a espera e caches são reaproveitados", () => {
  for (const encerrar of [false, true]) {
    const s = fixture(), c = criarPreparacaoBoss(s);
    s.load.start();
    c.iniciar(); c.iniciar();
    assert.equal(s.calls.length, 0);
    if (encerrar) s.events.emit("shutdown");
    s.concluir();
    assert.equal(s.calls.length, encerrar ? 0 : 28);
    if (!encerrar) { s.concluir(); assert.ok(c.pronto); }
    s.events.emit("shutdown");
  }
  const s = fixture();
  enfileirarAssetsFabrica(s); s.concluir();
  const c = criarPreparacaoBoss(s);
  assert.ok(c.pronto);
  let continuou = 0;
  c.aguardar(() => continuou++);
  assert.equal(continuou, 1);
  assert.equal(s.load.starts, undefined);
  assert.equal(s.texts.length, 0);
  s.events.emit("shutdown");
});

test("entrada normal adia boss; DEV, save dentro da arena e portas já abertas antecipam sem exigir cartão", () => {
  const s = fixture();
  s.cache.tilemap.add("mapaParte2", { data: JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url))) });
  Object.assign(s, { respawnX: 98, respawnY: -1040 });
  assert.equal(bossNecessarioNaEntrada(s), false);
  Object.assign(s, { respawnX: -1085, respawnY: -5169 });
  assert.equal(bossNecessarioNaEntrada(s), false, "proximidade sem cartão não antecipa carga numa entrada comum");
  s.developerMode = true;
  assert.equal(bossNecessarioNaEntrada(s), true);
  s.developerMode = false;
  Object.assign(s, { respawnX: -1093, respawnY: -5905 });
  assert.equal(bossNecessarioNaEntrada(s), true);
  Object.assign(s, { respawnX: 98, respawnY: -1040 });
  s.game.registry.set("factoryDoorOpen:porta03", true);
  assert.equal(bossNecessarioNaEntrada(s), true);
  s.game.registry.clear(); s.multiplayer = true;
  assert.equal(bossNecessarioNaEntrada(s), false);
});

test("falha de uma visita não compartilha flags ou callbacks com outra", () => {
  const a = fixture(), b = fixture();
  const ca = criarPreparacaoBoss(a), cb = criarPreparacaoBoss(b);
  let entrouA = false, entrouB = false;
  ca.aguardar(() => { entrouA = true; });
  cb.aguardar(() => { entrouB = true; });
  a.concluir(["novo-boss-tentaculo"]); b.concluir();
  assert.equal(entrouA, false); assert.equal(entrouB, true);
  assert.equal(ca.estado, "falhou"); assert.ok(cb.pronto);
  a.events.emit("shutdown"); b.events.emit("shutdown");
});
