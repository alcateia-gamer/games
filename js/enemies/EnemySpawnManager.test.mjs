import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { areaContemCorpo } from "./EnemySpawnArea.js";
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
  const p = manager.findPosition(region, "serra", []);
  assert.ok(p);
  assert.ok(areaContemCorpo(region.area, corpo(p, "serra")));
  region.area.width = 20;
  assert.equal(manager.findPosition(region, "serra", []), null);
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
  const sorteado = manager.findPosition(region, "padrao", []);
  assert.ok(sorteado.y - 421 * .23 / 2 >= area.y,
    "o sorteio agora já desconta a imagem e a margem antes de escolher o ponto");
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
  const p = manager.findPosition(region, "padrao", []);
  assert.ok(p && areaContemCorpo(region.area, corpo(p, "padrao")));
});

test("camada vazia ou ausente nunca ativa o spawn antigo", () => {
  assert.equal(new EnemySpawnManager(scene(), { getObjectLayer: () => ({ objects: [] }) }).regions.length, 0);
  for (const missingMap of [null, {}, { getObjectLayer: () => null }]) {
    const manager = new EnemySpawnManager(scene(), missingMap);
    assert.deepEqual(manager.regions, []);
    assert.equal(manager.findPosition({ center: { x: -316, y: 1304 } }, "padrao", []), null);
  }
});

test("zonas bloqueadas não têm fallback e autoridade impede criação no cliente", t => {
  seededRandom(t);
  const sc = scene(), manager = new EnemySpawnManager(sc, map);
  const region = manager.regions[0];
  sc.collisionGroup = { getChildren: () => [{ body: { ...region.area, enable: true } }] };
  assert.equal(manager.findPosition(region, "padrao", []), null);
  assert.equal(manager.findPosition(region, "serra", []), null);
  sc.multiplayer = true; sc.isMultiplayerHost = false;
  assert.equal(manager.spawnRegion(region), 0);
  assert.deepEqual(manager.solicitarSpawn("padrao", 3), []);
  assert.equal(manager.autorizarCriacao({ x: 0, y: 0 }), false);
});

test("limpeza mantém robô distante válido, remove fora do mapa sem morte nem recompensas", () => {
  const sc = scene(), manager = new EnemySpawnManager(sc, map);
  manager.playableArea = { intersecta: b => b.x < 200 };
  const valido = { active: true, tipoRobo: "padrao", body: { x: 10, y: 10, width: 20, height: 20 }, x: 1e5, y: 1e5 };
  let destruido = 0;
  const invalido = { active: true, tipoRobo: "serra", body: { x: 300, y: 10, width: 20, height: 20 },
    destroy() { destruido++; this.active = false; }, setVelocity() {} };
  sc.inimigos = [valido, invalido]; sc.inimigoTeste = invalido;
  sc.scrapSystem = { onRobotDeath() { assert.fail("limpeza não é morte"); } };
  manager.regions[0].enemies = [valido, invalido];
  manager.limparForaDoMapa();
  assert.equal(destruido, 1); assert.deepEqual(sc.inimigos, [valido]);
  assert.deepEqual(manager.regions[0].enemies, [valido]);
  assert.equal(sc.inimigoTeste, valido); assert.equal(invalido.body.enable, false);
  manager.limparForaDoMapa(); assert.equal(destruido, 1);
});

test("parser real aplica offsets de grupos e camadas exatamente uma vez", () => {
  const offsetMap = structuredClone(raw);
  offsetMap.layers = [{ type: "group", name: "grupo", x: 0, y: 0, offsetx: 100, offsety: -200,
    opacity: 1, visible: true, layers: [{ ...structuredClone(spawnLayer), offsetx: 20, offsety: 30 }] }];
  const layer = load(22611)(offsetMap)[0];
  const original = spawnLayer.objects[0];
  assert.equal(layer.objects[0].x, original.x + 120);
  assert.equal(layer.objects[0].y, original.y - 170);
  const manager = new EnemySpawnManager(scene(), { objects: [layer] });
  assert.equal(manager.regions[0].area.x, original.x + 120);
  assert.equal(manager.regions[0].area.y, original.y - 170);
});
