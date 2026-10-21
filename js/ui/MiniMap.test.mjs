/**
 * @file Testes de geometria dos mapas reais, exploração com oclusão, persistência compactada,
 * limites de memória e posicionamento do minimapa durante zoom e orientação.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MINI_MAP_PROFILES, buildMiniMapGeometry, ExplorationGrid,
  createMapTransform, worldToMiniMap, miniMapLayout,
} from "./MiniMapData.js";

const profile = { label: "TESTE", floors: ["Chão"], roads: [], buildings: [],
  walls: [], doors: [], objects: [], collision: "Collision" };
/**
 * Monta um mapa pequeno com origem negativa e colisões configuráveis para os cenários de
 * teste.
 */
function simpleMap(shapes = []) {
  return { tileWidth: 48, tileHeight: 48,
    layers: [{ name: "Chão", x: -240, y: -240,
      data: Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) =>
        ({ index: 1, pixelX: x * 48, pixelY: y * 48, baseWidth: 48, baseHeight: 48 }))) }],
    objects: [{ name: "Collision", objects: shapes }] };
}

// Reproduz apenas o contrato LayerData usado pelo Phaser: origem da camada
// em pixels e coordenadas locais dos tiles após a decodificação dos chunks.
/**
 * Lê o JSON real e reproduz a origem e os tiles locais das camadas decodificadas, sem criar
 * uma cena Phaser.
 */
function loadRealMap(filename) {
  const raw = JSON.parse(readFileSync(new URL(`../../assets/map/${filename}`, import.meta.url)));
  return { tileWidth: raw.tilewidth, tileHeight: raw.tileheight,
    objects: raw.layers.filter((layer) => layer.type === "objectgroup"),
    layers: raw.layers.filter((layer) => layer.type === "tilelayer").map((layer) => {
      const data = [];
      const startX = (layer.startx ?? 0) + layer.x, startY = (layer.starty ?? 0) + layer.y;
      for (const chunk of layer.chunks) {
        const bytes = Buffer.from(chunk.data, "base64");
        for (let i = 0; i < chunk.width * chunk.height; i++) {
          const gid = bytes.readUInt32LE(i * 4) & 0x1fffffff;
          if (!gid) continue;
          const x = chunk.x + i % chunk.width - startX;
          const y = chunk.y + Math.floor(i / chunk.width) - startY;
          data[y] ??= [];
          data[y][x] = { index: gid, pixelX: x * raw.tilewidth, pixelY: y * raw.tileheight,
            baseWidth: raw.tilewidth, baseHeight: raw.tileheight };
        }
      }
      return { name: layer.name, data,
        x: startX * raw.tilewidth + (layer.offsetx ?? 0), y: startY * raw.tileheight + (layer.offsety ?? 0) };
    }) };
}

test("real Tiled chunks retain negative origins, disconnected paths and map proportions", () => {
  for (const [name, file] of [["cidade", "InicioFase1 (1).json"], ["fabrica", "parte2-fase1.json"]]) {
    const geometry = buildMiniMapGeometry(loadRealMap(file), MINI_MAP_PROFILES[name]);
    assert.ok(geometry.rects.length > 4000);
    assert.ok(geometry.bounds.x < 0 && geometry.bounds.y < 0);
    if (name === "cidade") assert.ok(geometry.bounds.y + geometry.bounds.height >= 9000);
    else assert.ok(geometry.bounds.y <= -6336);
    const transform = createMapTransform(geometry.bounds, 164, 100, -1000, -1000);
    const a = worldToMiniMap(transform, -1000, -1000);
    const b = worldToMiniMap(transform, -952, -952);
    assert.ok(Math.abs((b.x - a.x) - (b.y - a.y)) < 1e-8);
    assert.ok(geometry.columns * geometry.rows <= 262144);
    // As camadas de sombra não ampliam os limites nem ocupam a geometria.
    assert.equal(geometry.rects.some((r) => r.kind === "SombraGeral"), false);
  }
});

test("geometry is read-only, honors layer transforms, and does not fill empty tiles", () => {
  const map = simpleMap();
  map.layers[0].data[0][0] = { index: -1 };
  map.layers[0].tilemapLayer = { x: -500, y: -800, scaleX: 2, scaleY: 2 };
  const original = JSON.stringify(map);
  const geometry = buildMiniMapGeometry(map, profile);
  assert.equal(JSON.stringify(map), original);
  assert.equal(geometry.rects.length, 99);
  assert.deepEqual(geometry.bounds, { x: -500, y: -800, width: 960, height: 960 });
});

test("fog starts unknown, respects thin walls and polygons, and remembers visited cells", () => {
  const wall = { x: 0, y: -240, width: 4, height: 480 };
  const grid = new ExplorationGrid(buildMiniMapGeometry(simpleMap([wall]), profile));
  assert.equal(grid.cells.some(Boolean), false);
  assert.equal(grid.visible(-50, 0, 50, 0), false);
  assert.equal(grid.visible(-50, 0, -20, 0), true);
  grid.reveal(-50, 0);
  const remembered = grid.cells.slice();
  grid.reveal(100, 100);
  assert.ok(grid.current.length > 0 && grid.current.length <= 169);
  remembered.forEach((value, i) => { if (value) assert.equal(grid.cells[i], 1); });
  const polygon = new ExplorationGrid(buildMiniMapGeometry(simpleMap([{
    x: 0, y: 0, polygon: [{ x: 0, y: -100 }, { x: 10, y: -100 }, { x: 10, y: 100 }, { x: 0, y: 100 }],
  }]), profile));
  assert.equal(polygon.visible(-50, 0, 50, 0), false);
  // Uma porta dinâmica bloqueia a descoberta até ser removida.
  assert.equal(polygon.visible(-100, -150, 100, -150, [{ x: 0, y: -200, width: 8, height: 100 }]), false);
  assert.equal(polygon.visible(-100, -150, 100, -150), true);
});

test("packed exploration survives reloads and rejects old/corrupt saves", () => {
  const geometry = buildMiniMapGeometry(simpleMap(), profile);
  const city = new ExplorationGrid(geometry);
  city.reveal(-100, 20);
  const saved = JSON.parse(JSON.stringify(city.serialize()));
  const reloaded = new ExplorationGrid(geometry, saved);
  assert.deepEqual(reloaded.cells, city.cells);
  const factory = new ExplorationGrid({ ...geometry, signature: "factory-map" }, saved);
  assert.equal(factory.cells.some(Boolean), false);
  assert.doesNotThrow(() => new ExplorationGrid(geometry, { signature: geometry.signature, bits: "%%%" }));
  const session = new ExplorationGrid(geometry, { signature: geometry.signature, cells: city.cells });
  assert.deepEqual(session.cells, city.cells);
});

test("HUD stays in the top-right corner with DEV below it at multiple zooms", () => {
  for (const [width, height] of [[800, 450], [450, 800], [1280, 720]]) {
    for (const zoom of [0.5, 1, 1.8, 2.5]) {
      const camera = { width, height, zoom, originX: 0.5, originY: 0.5 };
      const ox = width / 2, oy = height / 2;
      const dev = { scene: true, y: oy + (24 - oy) / zoom, displayHeight: 30 / zoom };
      const result = miniMapLayout(camera, dev);
      assert.equal(result.visible, true);
      assert.ok(Math.abs(oy + (result.y - oy) * zoom - 12) < 1e-8);
      assert.equal(result.devScreenY, 169);
      assert.equal(result.scaleX * zoom * 180, 180);
      assert.equal(result.scaleY * zoom * 130, 130);
      assert.ok(Math.abs(ox + (result.x - ox) * zoom + 180 - (width - 12)) < 1e-8);
    }
  }
  const camera = { width: 800, height: 260, zoom: 1, originX: 0.5, originY: 0.5 };
  const compact = miniMapLayout(camera, null, { scene: true, y: 160, displayHeight: 92 });
  assert.ok(compact.y + compact.scaleY * 130 <= 102);
  assert.ok(compact.devScreenY + 15 <= 102);
  const hiddenPickup = miniMapLayout({ ...camera, height: 450 }, null, null,
    { scene: true, visible: false, y: 0, displayHeight: 60 });
  assert.equal(hiddenPickup.scaleY, 1);
});

test("missing map layers give diagnostics and enormous maps have a bounded grid", () => {
  const warnings = [];
  assert.equal(buildMiniMapGeometry({ layers: [], objects: [] }, profile, (message) => warnings.push(message)), null);
  assert.ok(warnings.some((message) => message.includes("Chão")));
  const map = simpleMap();
  map.layers[0].data[0].push({ index: 1, pixelX: 1000000, pixelY: 1000000 });
  const geometry = buildMiniMapGeometry(map, profile);
  assert.ok(geometry.columns * geometry.rows <= 262144);
  const grid = new ExplorationGrid(geometry);
  grid.reveal(-239, -239);
  assert.ok(grid.cells.some(Boolean));
});
