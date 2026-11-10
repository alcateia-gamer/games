import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import EnemySpawnManager, { SPAWN_CONFIG } from "./EnemySpawnManager.js";

// Usa o parser das camadas e a geometria da mesma biblioteca carregada pelo jogo.
const bundle = readFileSync(new URL("../libs/phaser.min.js", import.meta.url), "utf8");
const context = { module: { exports: {} }, exports: {} };
assert.ok(bundle.includes("i(85454)})());"));
vm.runInNewContext(bundle.replace("i(85454)})());", "i})());"), context);
const load = context.module.exports;
const Rectangle = load(93232);

globalThis.Phaser = {
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
  Geom: { Rectangle, Intersects: { RectangleToRectangle: load(59996) } },
};

const raw = JSON.parse(readFileSync(new URL("../../assets/map/InicioFase1 (1).json", import.meta.url)));
const spawnLayer = raw.layers.find(layer => ["SpawnRobo", "SpawnRobos"].includes(layer.name));
const parsedLayers = load(22611)(structuredClone(raw));
const map = {
  getObjectLayer: name => parsedLayers.find(layer => layer.name === name),
  data: raw, tileWidth: raw.tilewidth, tileHeight: raw.tileheight,
};

function scene() {
  return { events: { once() {} }, inimigos: [], player: { active: true, x: -1405, y: 475 },
    collisionGroup: { getChildren: () => map.getObjectLayer("Collision").objects
      .filter(o => !o.polyline && !o.point && !o.text && o.width > 0 && o.height > 0)
      .map(o => ({ body: { x: o.x, y: o.y, width: o.width, height: o.height } })) } };
}

function seededRandom(t) {
  let seed = 34751;
  t.mock.method(Math, "random", () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 2 ** 32;
  });
}

function corpo(p, tipo) {
  return tipo === "serra"
    ? new Rectangle(p.x - 48.2, p.y - 5, 96.4, 64)
    : new Rectangle(p.x - 34.815, p.y - 0.315, 69.4, 53.3);
}

test("as sete zonas reais substituem os pontos fixos sem alterar a configuração", () => {
  assert.ok(spawnLayer, "o mapa precisa conter as zonas desenhadas no Tiled");
  const manager = new EnemySpawnManager(scene(), map);
  assert.equal(manager.regions.length, 7);
  assert.deepEqual(manager.config, SPAWN_CONFIG);
  for (const [i, region] of manager.regions.entries()) {
    const object = spawnLayer.objects[i];
    assert.equal(region.id, object.id);
    assert.deepEqual(region.center, { x: object.x + object.width / 2, y: object.y + object.height / 2 });
    assert.equal(region.area.width, object.width);
    assert.equal(region.area.height, object.height);
  }
});

test("cada zona real acomoda os sprites inteiros de atirador e serra, sem colidir", t => {
  seededRandom(t);
  const manager = new EnemySpawnManager(scene(), map);
  for (let rodada = 0; rodada < 30; rodada++) {
    for (const region of manager.regions) {
      const escolhidas = [];
      for (const tipo of ["padrao", "serra"]) {
        const p = manager.findPosition(region, tipo, escolhidas);
        assert.ok(p, `zona ${region.id}: posição para ${tipo}`);
        const rect = corpo(p, tipo), area = region.area;
        assert.ok(rect.left >= area.x && rect.right <= area.x + area.width);
        assert.ok(rect.top >= area.y && rect.bottom <= area.y + area.height);
        const width = tipo === "serra" ? 278 * 0.36 : 311 * 0.23;
        const height = tipo === "serra" ? 270 * 0.36 : 421 * 0.23;
        assert.ok(p.x - width / 2 >= area.x && p.x + width / 2 <= area.x + area.width);
        assert.ok(p.y - height / 2 >= area.y && p.y + height / 2 <= area.y + area.height);
        assert.equal(manager.isValidPosition(p, tipo, escolhidas), true);
        escolhidas.push(p);
      }
    }
  }
});

test("a hitbox inteira precisa caber na zona mesmo quando o ponto sorteado está dentro", t => {
  t.mock.method(Math, "random", () => 0.99);
  const manager = new EnemySpawnManager(scene(), map);
  const region = manager.regions[0];
  assert.equal(manager.findPosition(region, "serra", []), null);
  assert.ok(region.rejected.length > 0);
  assert.ok(region.rejected.every(p => p.x < region.area.x + region.area.width));
});

test("zona 639 rejeita objeto sob a imagem mesmo quando os pés estão livres", () => {
  const currentScene = scene();
  const manager = new EnemySpawnManager(currentScene, map);
  const region = manager.regions.find(r => r.id === 639);
  const ponto = region.center;
  const bloco = { body: { x: ponto.x - 10, y: ponto.y - 40, width: 20, height: 15 } };
  assert.equal(Phaser.Geom.Intersects.RectangleToRectangle(corpo(ponto, "padrao"),
    new Rectangle(bloco.body.x, bloco.body.y, bloco.body.width, bloco.body.height)), false);
  currentScene.collisionGroup = { getChildren: () => [bloco] };
  assert.equal(manager.isValidPosition(ponto, "padrao", []), false);
  bloco.body.enable = false;
  assert.equal(manager.isValidPosition(ponto, "padrao", []), true);
});

test("rejeita um robô com pés dentro da zona e sprite atravessando a borda superior", t => {
  let i = 0;
  t.mock.method(Math, "random", () => i++ % 2 === 0 ? 0.5 : 0.05);
  const currentScene = scene();
  currentScene.collisionGroup = null;
  const manager = new EnemySpawnManager(currentScene, map);
  const region = manager.regions[0], area = region.area;
  const p = { x: area.x + area.width / 2, y: area.y + area.height * 0.05 };
  const pes = corpo(p, "padrao");
  assert.ok(pes.top >= area.y && pes.bottom <= area.y + area.height);
  assert.equal(manager.isValidPosition(p, "padrao", []), true);
  assert.equal(manager.findPosition(region, "padrao", []), null);
});

test("a ativação mantém proximidade, limite global, retentativa e spawn único", () => {
  const currentScene = scene();
  const manager = new EnemySpawnManager(currentScene, map);
  const region = manager.regions[0];
  manager.regions = [region];
  const chamadas = [];
  manager.spawnRegion = (zona, vagas) => {
    chamadas.push(vagas);
    zona.enemies.push({ active: true, tipoRobo: "padrao" }, { active: true, tipoRobo: "serra" });
    return 2;
  };
  currentScene.player.x = region.center.x + manager.config.activationRadius + 1;
  currentScene.player.y = region.center.y;
  manager.checkSpawnZones(0);
  assert.deepEqual(chamadas, []);
  currentScene.player.x = region.center.x;
  currentScene.inimigos = Array.from({ length: 9 }, () => ({ active: true }));
  manager.checkSpawnZones(0);
  assert.deepEqual(chamadas, [], "uma única vaga não comporta os dois tipos obrigatórios");
  currentScene.inimigos = [];
  manager.checkSpawnZones(1);
  assert.deepEqual(chamadas, [], "preserva o intervalo de retentativa");
  manager.checkSpawnZones(manager.config.retryDelay);
  assert.deepEqual(chamadas, [10]);
  assert.equal(region.activated, true);
  manager.checkSpawnZones(manager.config.retryDelay * 2);
  assert.deepEqual(chamadas, [10], "não repete uma zona já ativada");
});

test("aceita o nome SpawnRobos e zonas rotacionadas, inclusive em camada oculta", t => {
  t.mock.method(Math, "random", () => 0.5);
  const manager = new EnemySpawnManager(scene(), { getObjectLayer: name => name === "SpawnRobos"
    ? { visible: false, objects: [{ id: 1, x: -1000, y: -1000, width: 400, height: 200, rotation: 90 }] }
    : null });
  const region = manager.regions[0];
  assert.deepEqual(region.center, { x: -1100, y: -800 });
  assert.deepEqual(manager.findPosition(region, "padrao", []), region.center);
});

test("camada vazia ou ausente nunca ativa o spawn antigo", () => {
  assert.equal(new EnemySpawnManager(scene(), { getObjectLayer: () => ({ objects: [] }) }).regions.length, 0);
  for (const missingMap of [null, {}, { getObjectLayer: () => null }]) {
    const manager = new EnemySpawnManager(scene(), missingMap);
    assert.deepEqual(manager.regions, []);
    assert.equal(manager.findPosition({ center: { x: -316, y: 1304 } }, "padrao", []), null);
  }
});
