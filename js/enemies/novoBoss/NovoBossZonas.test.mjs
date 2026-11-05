import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { configurarZonasNovoBoss, jogadorNaArenaNovoBoss, novoBossConfig } from "./NovoBossConfig.js";

const jogador = (x, y) => ({ active: true, x, y });
const mapa = objects => ({ getObjectLayer: name => name === "ZonaBoss" ? { visible: false, objects } : null });

test("os três retângulos reais ativam o boss, inclusive além dos limites antigos, sem preencher os espaços entre eles", () => {
  const raw = JSON.parse(readFileSync(new URL("../../../assets/map/parte2-fase1.json", import.meta.url)));
  const layer = raw.layers.find(layer => layer.name === "ZonaBoss");
  const antes = JSON.stringify(raw);
  const config = configurarZonasNovoBoss(mapa(layer.objects));
  assert.equal(config.arena.zonas.length, 3);
  for (const rect of layer.objects) {
    for (const [x, y] of [[rect.x, rect.y], [rect.x + rect.width / 2, rect.y + rect.height / 2],
      [rect.x + rect.width, rect.y + rect.height]]) {
      assert.equal(jogadorNaArenaNovoBoss(jogador(x, y), config.arena), true, `retângulo ${rect.id}`);
    }
  }
  assert.equal(jogadorNaArenaNovoBoss(jogador(-1080, -5352)), false, "a área antiga não inclui a entrada nova");
  assert.equal(jogadorNaArenaNovoBoss(jogador(-1080, -5352), config.arena), true);
  for (const [x, y] of [[-500, -6300], [-1080, -5300], [-1700, -5800], [-500, -6000]]) {
    assert.equal(jogadorNaArenaNovoBoss(jogador(x, y), config.arena), false);
  }
  assert.deepEqual(Object.fromEntries(Object.entries(config.arena).filter(([key]) => key !== "zonas")), novoBossConfig.arena);
  assert.equal(novoBossConfig.arena.zonas, undefined, "a configuração compartilhada não é alterada");
  assert.equal(JSON.stringify(raw), antes);
});

test("ZonaBoss oculta funciona; formas inválidas, objetos desativados e jogadores mortos não ativam", () => {
  const rect = { x: -100, y: -200, width: 40, height: 60 };
  const config = configurarZonasNovoBoss(mapa([
    rect, { ...rect, point: true }, { ...rect, ellipse: true }, { ...rect, polygon: [] },
    { ...rect, polyline: [] }, { ...rect, gid: 1 }, { ...rect, text: {} },
    { ...rect, visible: false }, { ...rect, width: 0 }, { ...rect, x: NaN },
  ]));
  assert.equal(config.arena.zonas.length, 1);
  assert.equal(jogadorNaArenaNovoBoss(jogador(-80, -180), config.arena), true);
  for (const player of [null, { ...jogador(-80, -180), active: false },
    { ...jogador(-80, -180), morto: true }, jogador(NaN, -180)]) {
    assert.equal(jogadorNaArenaNovoBoss(player, config.arena), false);
  }
  const vazio = configurarZonasNovoBoss(mapa([]));
  assert.equal(jogadorNaArenaNovoBoss(jogador(-1080, -5500), vazio.arena), false);
  assert.equal(configurarZonasNovoBoss(null), novoBossConfig);
  assert.equal(configurarZonasNovoBoss({ getObjectLayer: () => null }), novoBossConfig);
});

test("retângulos ZonaBoss rotacionados usam sua forma real no mundo negativo", () => {
  const config = configurarZonasNovoBoss(mapa([{ x: -100, y: -200, width: 40, height: 60, rotation: 90 }]));
  assert.equal(jogadorNaArenaNovoBoss(jogador(-130, -180), config.arena), true);
  assert.equal(jogadorNaArenaNovoBoss(jogador(-80, -180), config.arena), false);
  assert.equal(jogadorNaArenaNovoBoss(jogador(-130, -150), config.arena), false);
});
