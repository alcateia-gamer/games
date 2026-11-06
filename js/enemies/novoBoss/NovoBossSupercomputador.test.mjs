import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import test from "node:test";
import { configurarZonasNovoBoss } from "./NovoBossConfig.js";
import { localizarTelasSupercomputador, prepararSupercomputadorNovoBoss } from "./NovoBossSupercomputador.js";

// Usa os tiles reais, inclusive a origem negativa das camadas infinitas do Tiled.
function criarMapa() {
  const dados = JSON.parse(readFileSync(new URL("../../../assets/map/parte2-fase1.json", import.meta.url)));
  const map = { tilesets: dados.tilesets, tileWidth: dados.tilewidth, tileHeight: dados.tileheight,
    getObjectLayer: nome => dados.layers.find(l => l.name === nome), layers: [] };
  for (const l of dados.layers.filter(l => l.type === "tilelayer")) {
    const origemX = Math.min(...l.chunks.map(c => c.x)), origemY = Math.min(...l.chunks.map(c => c.y));
    const tiles = [];
    for (const c of l.chunks) {
      const bytes = Buffer.from(c.data, "base64");
      for (let i = 0; i < c.width * c.height; i++) {
        const index = bytes.readUInt32LE(i * 4) & 0x1fffffff;
        if (index) tiles.push({ index, x: c.x + i % c.width - origemX,
          y: c.y + Math.floor(i / c.width) - origemY });
      }
    }
    map.layers.push({ tilemapLayer: { tiles, visible: l.visible, scaleX: 1, scaleY: 1,
      forEachTile: callback => tiles.forEach(callback),
      tileToWorldXY: (x, y) => ({ x: (x + origemX) * 48, y: (y + origemY) * 48 }) } });
  }
  return map;
}
function preparar() {
  const scene = { map: criarMapa(), events: new EventEmitter(), vida: 100, player: {} };
  const encontro = { config: configurarZonasNovoBoss(scene.map), jogadorNaArena: true,
    sprite: { active: true }, active: true, barreiraAtiva: true };
  const sistema = prepararSupercomputadorNovoBoss(scene, encontro);
  const emitir = (nome, dados = {}) => { scene.events.emit(`novo-boss:${nome}`, { encontro, ...dados }); sistema.atualizar(0); };
  return { scene, encontro, sistema, emitir, mensagem: () => sistema.snapshot().mensagem };
}

test("localiza somente os dois monitores completos da arena no mapa real", () => {
  const map = criarMapa(), { arena } = configurarZonasNovoBoss(map);
  const telas = localizarTelasSupercomputador(map, arena);
  assert.deepEqual(telas.map(t => [t.x, t.y]).sort(), [[-1272, -6168], [-888, -6168]].sort());
  assert.ok(telas.every(t => t.celulas.length === 9));
  assert.equal(prepararSupercomputadorNovoBoss({ map: null }, { config: { arena } }), null);
});

test("acompanha detecção, invocação das torres e carga de escudo durante a apresentação", () => {
  const { encontro, sistema, mensagem } = preparar();
  for (const [etapa, esperada] of [["indo", "calculando"], ["mostrando", "intruso"],
    ["invocando-torre", "iniciandoTorres"], ["mostrando-choque-torre", "iniciandoTorres"],
    ["carregando-escudo", "protocolo"], ["voltando", "preparando"]]) {
    encontro.introducao = { snapshot: () => ({ etapa, concluida: false }) };
    sistema.atualizar(16); assert.equal(mensagem(), esperada);
  }
  encontro.jogadorNaArena = false; sistema.atualizar(0);
  assert.equal(mensagem(), "aguardando");
  sistema.destruir();
});

test("reage à batalha, mantém prioridade da fase e ignora eventos de outros encontros", () => {
  const { scene, encontro, sistema, emitir, mensagem } = preparar();
  assert.equal(mensagem(), "preparando");
  emitir("ataque-iniciado"); assert.equal(mensagem(), "atacando");
  sistema.atualizar(701); assert.equal(mensagem(), "preparando");
  emitir("vida", { anterior: 1000, vida: 900 }); assert.equal(mensagem(), "avaria");
  emitir("barreira-desativada"); assert.equal(mensagem(), "capacidadeEsgotada");
  emitir("ataque-iniciado"); assert.equal(mensagem(), "capacidadeEsgotada");
  emitir("fase-alterada"); assert.equal(mensagem(), "protocolo");
  scene.vida -= 10; sistema.atualizar(0); assert.equal(mensagem(), "protocolo");
  sistema.atualizar(1801);
  scene.events.emit("novo-boss:vida", { encontro: {}, anterior: 20, vida: 10 });
  sistema.atualizar(0); assert.equal(mensagem(), "preparando");
  scene.vida -= 10; sistema.atualizar(0); assert.equal(mensagem(), "acerto");
  sistema.atualizar(901);
  encontro.estado = "vulneravel"; sistema.atualizar(0); assert.equal(mensagem(), "falha");
  sistema.destruir();
});

test("vitória encerra o sistema; derrota do jogador mostra GAME OVER", () => {
  const { scene, encontro, sistema, emitir, mensagem } = preparar();
  encontro.morto = true; emitir("derrotada"); assert.equal(mensagem(), "fim");
  sistema.atualizar(2200); assert.equal(mensagem(), "desligando");
  sistema.atualizar(1800); assert.equal(mensagem(), "apagado");
  scene.vida = 0; sistema.atualizar(0); assert.equal(mensagem(), "gameOver");
  sistema.destruir();
});

test("altera apenas os tiles da tela, sem reescrever quadros iguais, e libera listeners", () => {
  const map = criarMapa(), config = configurarZonasNovoBoss(map);
  const todas = map.layers.flatMap(l => l.tilemapLayer.tiles);
  const originais = todas.map(t => t.index);
  const telas = localizarTelasSupercomputador(map, config.arena);
  const monitor = new Set(telas.flatMap(t => t.celulas.map(c => c.tile)));
  let escritas = 0;
  for (const tile of monitor) {
    let index = tile.index;
    Object.defineProperty(tile, "index", { get: () => index, set: v => { index = v; escritas++; } });
  }
  const scene = { map, events: new EventEmitter(), vida: 100 };
  const sistema = prepararSupercomputadorNovoBoss(scene, { config });
  assert.equal(escritas, 18);
  sistema.atualizar(240); assert.equal(escritas, 18);
  sistema.atualizar(120); assert.equal(escritas, 36);
  // A mensagem WAITING FOR INPUT está na linha 7, grupo 9, variante 0.
  assert.equal(telas[0].celulas.find(c => c.dx === 0 && c.dy === 0).tile.index,
    telas[0].firstgid + 21 * 36 + 9 * 3);
  todas.forEach((tile, i) => { if (!monitor.has(tile)) assert.equal(tile.index, originais[i]); });
  sistema.destruir(); sistema.destruir(); sistema.atualizar(200);
  assert.equal(scene.events.eventNames().length, 0);
  assert.deepEqual(todas.map(t => t.index), originais);
});
