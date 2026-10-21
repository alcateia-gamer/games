/**
 * @file Testes da geometria real, renderização do cenário e posicionamento do minimapa.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import {
  MINI_MAP_PROFILES, buildMiniMapGeometry,
  createMapTransform, worldToMiniMap, miniMapLayout,
} from "./MiniMapData.js";
import { drawMiniMapAtlas, RADAR_COLORS } from "./MiniMapAtlas.js";
import MiniMapManager from "./MiniMapManager.js";
import { connectSidewalks } from "./MiniMapConnections.js";
import { mergeMiniMapRects, connectedSidewalkBlocks, miniMapBarriers } from "./MiniMapBlocks.js";
import { connectedVehicleRects, solidVehicleBlocks, vehicleInstanceKey } from "./MiniMapVehicles.js";

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
  return { tileWidth: raw.tilewidth, tileHeight: raw.tileheight, tilesets: raw.tilesets,
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

test("city geometry keeps every vehicle tile separate from buildings and roads", () => {
  const map = loadRealMap("InicioFase1 (1).json");
  const geometry = buildMiniMapGeometry(map, MINI_MAP_PROFILES.cidade);
  const layer = map.layers.find(item => item.name === "Vehicles");
  const expected = layer.data.flat().filter(tile => tile && tile.index >= 0);
  const vehicles = geometry.rects.filter(rect => rect.kind === "vehicles");
  assert.ok(vehicles.length > 0);
  assert.ok(vehicles.length > expected.length);
  const positions = new Set(vehicles.map(rect => `${rect.x},${rect.y}`));
  for (const tile of expected) assert.ok(positions.has(`${layer.x + tile.pixelX},${layer.y + tile.pixelY}`));
  assert.ok(positions.has("-960,-2064"), "inclui o complemento conectado de ObjAcimaPerso");
  assert.equal(positions.has("-672,8976"), false, "ignora a decoração isolada da mesma camada");
});

test("vehicle attachments include whole connected groups but exclude gaps and diagonal contacts", () => {
  const rect = (x, y, width = 48, height = 48) => ({ kind: "vehicles", x, y, width, height });
  const vehicles = [rect(-96, -48)];
  const attachments = [rect(0, -48), rect(-48, -48), rect(-72, -24, 24, 24),
    rect(96, -48), rect(-144, 0)];
  const original = JSON.stringify(attachments);
  assert.deepEqual(connectedVehicleRects(vehicles, attachments), attachments.slice(0, 3));
  assert.deepEqual(connectedVehicleRects([], attachments), []);
  assert.equal(JSON.stringify(attachments), original);
});

test("each connected vehicle becomes one solid body, filling gaps between parts without joining separate cars", () => {
  const rects = [
    { kind: "vehicles", x: -96, y: -48, width: 48, height: 48 },
    { kind: "vehicles", x: -48, y: -48, width: 48, height: 48 },
    { kind: "vehicles", x: -96, y: 0, width: 48, height: 48 },
    { kind: "vehicles", x: 48, y: -48, width: 48, height: 96 },
  ];
  const original = JSON.stringify(rects);
  assert.deepEqual(solidVehicleBlocks(rects), [
    { kind: "vehicles", x: -96, y: -48, width: 96, height: 96 },
    { kind: "vehicles", x: 48, y: -48, width: 48, height: 96 },
  ]);
  assert.equal(JSON.stringify(rects), original);
  assert.deepEqual(solidVehicleBlocks([]), []);
});

test("vehicles around X -67 Y 361 stay separate at their real map coordinates", () => {
  const map = loadRealMap("InicioFase1 (1).json");
  const geometry = buildMiniMapGeometry(map, MINI_MAP_PROFILES.cidade);
  const blocks = solidVehicleBlocks(geometry.rects.filter(rect => rect.kind === "vehicles"));
  for (const [x, y, width, height] of [
    [-576, 144, 240, 192],
    [-288, 144, 240, 192],
    [-48, 288, 144, 144],
  ]) {
    assert.ok(blocks.some(block => block.x === x && block.y === y &&
      block.width === width && block.height === height), `carro em ${x}, ${y}`);
  }
  assert.equal(blocks.some(block => block.x === -288 && block.y === 144 && block.width === 384), false);
});

test("adjacent cars from the same tileset retain distinct identities and roof pieces", () => {
  const map = { tilesets: [{ firstgid: 1, total: 100, columns: 10 }] };
  const rect = (x, tileIndex) => ({ kind: "vehicles", x, y: 0, width: 48, height: 48,
    vehicleId: vehicleInstanceKey(map, { index: tileIndex }, x, 0, 48, 48) });
  const vehicles = [rect(0, 1), rect(48, 2), rect(96, 1)];
  assert.equal(vehicles[0].vehicleId, vehicles[1].vehicleId);
  assert.notEqual(vehicles[1].vehicleId, vehicles[2].vehicleId);
  const roofs = [
    { ...rect(0, 50), y: -48 },
    { ...rect(96, 50), y: -48 },
  ];
  const attached = connectedVehicleRects(vehicles, roofs, 48, true);
  assert.equal(attached[0].vehicleId, vehicles[0].vehicleId);
  assert.equal(attached[1].vehicleId, vehicles[2].vehicleId);
  assert.deepEqual(solidVehicleBlocks([...vehicles, ...attached]), [
    { kind: "vehicles", x: 0, y: -48, width: 96, height: 96 },
    { kind: "vehicles", x: 96, y: -48, width: 48, height: 96 },
  ]);
});

test("tower tiles are excluded even when touching vehicles, without removing vehicles beneath them", () => {
  const map = loadRealMap("InicioFase1 (1).json");
  const actual = buildMiniMapGeometry(map, MINI_MAP_PROFILES.cidade);
  const tower = map.tilesets.find(tileset => tileset.name === "TorreTileset");
  let removed = 0;
  for (const layer of map.layers) {
    for (const row of layer.data) {
      if (!row) continue;
      for (const tile of row) {
        if (tile && tile.index >= tower.firstgid && tile.index < tower.firstgid + tower.tilecount) {
          tile.index = -1;
          removed++;
        }
      }
    }
  }
  assert.ok(removed > 0);
  const withoutTower = buildMiniMapGeometry(map, MINI_MAP_PROFILES.cidade);
  assert.deepEqual(actual.rects, withoutTower.rects);
  const vehicles = actual.rects.filter(rect => rect.kind === "vehicles");
  assert.ok(vehicles.some(rect => rect.x === 48 && rect.y === 336));
  assert.equal(vehicles.some(rect => rect.x === 288 && rect.y === -48), false);
});

test("vehicle layers accept the ObjSobPerso name and honor each layer's world origin", () => {
  const map = simpleMap();
  const tile = pixelX => ({ index: 1, pixelX, pixelY: 0, baseWidth: 48, baseHeight: 48 });
  map.layers.push(
    { name: "vehicles", x: -240, y: -240, data: [[tile(0)]] },
    { name: "objsobperso", x: -192, y: -240, data: [[tile(0), tile(48), tile(240)]] },
  );
  const geometry = buildMiniMapGeometry(map, {
    ...profile, vehicles: ["Vehicles"], vehicleAttachments: ["ObjSobPerso"],
  });
  const vehicles = geometry.rects.filter(rect => rect.kind === "vehicles");
  assert.deepEqual(vehicles.map(rect => [rect.x, rect.y]), [[-240, -240], [-192, -240], [-144, -240]]);
});

test("city radar fills only asphalt, excluding sidewalks, indoor floors and decorative road markings", () => {
  const map = loadRealMap("InicioFase1 (1).json");
  const geometry = buildMiniMapGeometry(map, MINI_MAP_PROFILES.cidade);
  const floor = map.layers.find(layer => layer.name === "Chão");
  const tileset = map.tilesets.find(set => set.name === "A5_Street_Rasak");
  const floorRects = geometry.rects.filter(rect => rect.kind === "floors");
  const asphalt = floor.data.flat().filter(tile => tile && tile.index === 836);
  const sidewalks = floor.data.flat().filter(tile => tile && tile.index === 875);
  assert.ok(asphalt.length > 0 && sidewalks.length > 0);
  const painted = new Set(floorRects.map(rect => `${rect.x},${rect.y}`));
  for (const tile of asphalt) assert.ok(painted.has(`${floor.x + tile.pixelX},${floor.y + tile.pixelY}`));
  for (const tile of sidewalks) assert.equal(painted.has(`${floor.x + tile.pixelX},${floor.y + tile.pixelY}`), false);
  assert.equal(geometry.rects.filter(rect => rect.kind === "sidewalks").length,
    floor.data.flat().filter(tile => tile &&
      MINI_MAP_PROFILES.cidade.asphalt.excludedTiles.includes(tile.index - tileset.firstgid)).length);
  const expected = floor.data.flat().filter(tile => tile && tile.index >= tileset.firstgid &&
    tile.index < tileset.firstgid + tileset.tilecount &&
    !MINI_MAP_PROFILES.cidade.asphalt.excludedTiles.includes(tile.index - tileset.firstgid));
  assert.equal(floorRects.length, expected.length);
  assert.equal(geometry.rects.some(rect => rect.kind === "roads"), false);
  const factory = buildMiniMapGeometry(loadRealMap("parte2-fase1.json"), MINI_MAP_PROFILES.fabrica);
  assert.ok(factory.rects.some(rect => rect.kind === "floors"));
  assert.equal(factory.rects.some(rect => rect.kind === "background"), false);
});

test("the sidewalk near X -92 Y -341 connects the two asphalt regions from the screenshot", () => {
  const geometry = buildMiniMapGeometry(loadRealMap("InicioFase1 (1).json"), MINI_MAP_PROFILES.cidade);
  const xSamples = [-168, -120, -72, -24], y = -341;
  const surface = new Uint8ClampedArray(xSamples.length * 4);
  const asphalt = new Uint8ClampedArray(surface.length);
  const kinds = [];
  xSamples.forEach((x, index) => {
    const floor = geometry.rects.find(rect => ["floors", "sidewalks"].includes(rect.kind) &&
      x >= rect.x && x < rect.x + rect.width && y >= rect.y && y < rect.y + rect.height);
    assert.ok(floor);
    assert.equal(geometry.shapes.some(shape => x >= shape.x && x <= shape.x + shape.width &&
      y >= shape.y && y <= shape.y + shape.height), false);
    kinds.push(floor.kind);
    surface[index * 4 + 3] = 255;
    if (floor.kind === "floors") asphalt.set([98, 105, 112, 255], index * 4);
  });
  assert.deepEqual(kinds, ["floors", "sidewalks", "sidewalks", "floors"]);
  const result = connectSidewalks(surface, asphalt, xSamples.length, 1);
  for (let index = 0; index < xSamples.length; index++) {
    assert.deepEqual([...result.slice(index * 4, index * 4 + 4)], [98, 105, 112, 255]);
  }
});

test("sidewalk connects in asphalt gray only through open passages, including around obstacles", () => {
  const width = 5, height = 3;
  const surface = new Uint8ClampedArray(width * height * 4);
  const asphalt = new Uint8ClampedArray(surface.length);
  for (let i = 0; i < width * height; i++) surface[i * 4 + 3] = 255;
  asphalt.set([98, 105, 112, 255], 5 * 4);
  // Parede vertical inteira: a calçada do outro lado não deve aparecer.
  for (const i of [2, 7, 12]) surface[i * 4 + 3] = 0;
  const blocked = connectSidewalks(surface, asphalt, width, height);
  assert.deepEqual([...blocked.slice(5 * 4, 6 * 4)], [98, 105, 112, 255]);
  assert.deepEqual([...blocked.slice(6 * 4, 7 * 4)], [98, 105, 112, 255]);
  assert.equal(blocked[9 * 4 + 3], 0);
  // Abertura na parede conecta também o trecho de calçada depois dela.
  surface[12 * 4 + 3] = 255;
  const connected = connectSidewalks(surface, asphalt, width, height);
  assert.deepEqual([...connected.slice(9 * 4, 10 * 4)], [98, 105, 112, 255]);
  assert.equal(connected[7 * 4 + 3], 0, "a colisão continua recortada");
});

test("thin collisions and diagonal corners do not falsely connect sidewalks", () => {
  const surface = new Uint8ClampedArray(3 * 3 * 4);
  const asphalt = new Uint8ClampedArray(surface.length);
  for (let i = 0; i < 9; i++) surface[i * 4 + 3] = 255;
  for (const i of [1, 4, 7]) surface[i * 4 + 3] = 170;
  asphalt.set([98, 105, 112, 255], 3 * 4);
  assert.equal(connectSidewalks(surface, asphalt, 3, 3)[5 * 4 + 3], 0);
  surface.fill(0);
  surface[0 * 4 + 3] = 255;
  surface[4 * 4 + 3] = 255;
  asphalt.fill(0);
  asphalt.set([98, 105, 112, 255]);
  assert.equal(connectSidewalks(surface, asphalt, 3, 3)[4 * 4 + 3], 0);
});

test("asphalt and connected sidewalk share an opaque edge without an internal outline", () => {
  const surface = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
  const asphalt = new Uint8ClampedArray([98, 105, 112, 255, 98, 105, 112, 128, 0, 0, 0, 0]);
  const original = asphalt.slice();
  const result = connectSidewalks(surface, asphalt, 3, 1);
  assert.equal(result[7], 255);
  assert.deepEqual([...result.slice(8)], [98, 105, 112, 255]);
  assert.deepEqual([...result.slice(4, 8)], [98, 105, 112, 255]);
  assert.deepEqual(asphalt, original, "a origem não deve ser alterada");
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
      assert.equal(result.devScreenY, 147);
      assert.equal(result.scaleX * zoom * 90, 90);
      assert.equal(result.scaleY * zoom * 90, 90);
      assert.ok(Math.abs(ox + (result.x - ox) * zoom + 90 - (width - 12)) < 1e-8);
    }
  }
  const camera = { width: 800, height: 260, zoom: 1, originX: 0.5, originY: 0.5 };
  const compact = miniMapLayout(camera, null, { scene: true, y: 160, displayHeight: 92 });
  assert.ok(compact.y + compact.scaleY * 90 <= 102);
  assert.ok(compact.devScreenY + 15 <= 102);
  const hiddenPickup = miniMapLayout({ ...camera, height: 450 }, null, null,
    { scene: true, visible: false, y: 0, displayHeight: 60 });
  assert.equal(hiddenPickup.scaleY, 1);
});

test("missing map layers give diagnostics and distant tiles retain their world bounds", () => {
  const warnings = [];
  assert.equal(buildMiniMapGeometry({ layers: [], objects: [] }, profile, (message) => warnings.push(message)), null);
  assert.ok(warnings.some((message) => message.includes("Chão")));
  const map = simpleMap();
  map.layers[0].data[0].push({ index: 1, pixelX: 1000000, pixelY: 1000000 });
  const geometry = buildMiniMapGeometry(map, profile);
  assert.ok(geometry.bounds.width > 1000000);
  assert.ok(geometry.bounds.height > 1000000);
});

// Registra os recortes e transformações enviados ao canvas sem executar um navegador.
function recordingCanvas() {
  const calls = [];
  const stack = [];
  const context = {
    globalAlpha: 1,
    save() { stack.push(this.globalAlpha); },
    restore() { this.globalAlpha = stack.pop(); },
    scale(...args) { calls.push(["scale", ...args]); },
    translate(...args) { calls.push(["translate", ...args]); },
    rotate(...args) { calls.push(["rotate", ...args]); },
    drawImage(...args) { calls.push(["drawImage", this.globalAlpha, ...args]); },
    fillRect(...args) { calls.push(["fillRect", this.globalCompositeOperation ?? "source-over", this.fillStyle, ...args]); },
    strokeRect(...args) { calls.push(["strokeRect", this.strokeStyle, ...args]); },
    beginPath() { calls.push(["beginPath"]); },
    rect(...args) { calls.push(["rect", ...args]); },
    moveTo(...args) { calls.push(["moveTo", ...args]); },
    lineTo(...args) { calls.push(["lineTo", ...args]); },
    closePath() { calls.push(["closePath"]); },
    fill() { calls.push(["fill", this.globalCompositeOperation ?? "source-over"]); },
    clip() { assert.fail("o mapa não deve ser recortado por descoberta"); },
  };
  return { width: 0, height: 0, calls, getContext: () => context };
}

function useGlobal(t, key, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, key, previous);
    else delete globalThis[key];
  });
}

test("floor blocks merge into large rectangles without filling gaps or changing the source", () => {
  const rects = [];
  for (const y of [-48, 0]) {
    for (const x of [-96, -48, 0]) rects.push({ kind: "floors", x, y, width: 48, height: 48 });
  }
  rects.push({ kind: "floors", x: 96, y: -48, width: 48, height: 48 });
  const original = JSON.stringify(rects);
  assert.deepEqual(mergeMiniMapRects(rects), [
    { kind: "floors", x: -96, y: -48, width: 144, height: 96 },
    { kind: "floors", x: 96, y: -48, width: 48, height: 48 },
  ]);
  assert.equal(JSON.stringify(rects), original);
  const corner = mergeMiniMapRects([
    { kind: "floors", x: 0, y: 0, width: 48, height: 48 },
    { kind: "floors", x: 48, y: 0, width: 48, height: 48 },
    { kind: "floors", x: 0, y: 48, width: 48, height: 48 },
  ]);
  assert.equal(corner.length, 2);
  assert.equal(corner.reduce((area, rect) => area + rect.width * rect.height, 0), 3 * 48 * 48);
});

test("an accessible sidewalk is drawn as a whole block despite objects on top of it", () => {
  const sidewalks = [
    { kind: "sidewalks", x: -48, y: 0, width: 48, height: 12 },
    { kind: "sidewalks", x: 0, y: 0, width: 48, height: 12 },
  ];
  const pixels = new Uint8ClampedArray(8 * 4);
  pixels[1 * 4 + 3] = 255;
  const blocks = connectedSidewalkBlocks(sidewalks, pixels,
    { x: -48, y: 0 }, 1 / 12, 8, 1);
  assert.deepEqual(blocks, [sidewalks[0]]);
});

test("the fence near X 8 Y -888 separates the enclosed asphalt from the street", () => {
  const geometry = buildMiniMapGeometry(loadRealMap("InicioFase1 (1).json"), MINI_MAP_PROFILES.cidade);
  const vehicles = solidVehicleBlocks(geometry.rects.filter(rect => rect.kind === "vehicles"));
  const barriers = miniMapBarriers(geometry.shapes, vehicles, 18);
  const fence = barriers.find(shape => shape.x < -45 && shape.x + shape.width > -45 &&
    shape.y < -888 && shape.y + shape.height > -888);
  assert.ok(fence, "a cerca vertical deve abrir uma separação visível no radar");
  assert.ok(fence.width >= 18);
  assert.ok(fence.height > 600);
  assert.equal(-70 >= fence.x && -70 <= fence.x + fence.width, false);
  assert.equal(8 >= fence.x && 8 <= fence.x + fence.width, false);
  assert.equal(miniMapBarriers([{ x: 0, y: 0, width: 10, height: 10 }]).length, 0);
  assert.equal(miniMapBarriers([{ x: 0, y: 0, width: 180, height: 20 }],
    [{ x: -10, y: -10, width: 200, height: 100 }]).length, 0);
});

test("barriers cut the floor and its softened outline after whole sidewalk blocks are painted", t => {
  const canvases = [];
  useGlobal(t, "document", { createElement() {
    const canvas = recordingCanvas(); canvases.push(canvas); return canvas;
  } });
  const atlas = drawMiniMapAtlas({
    bounds: { x: -96, y: -1200, width: 144, height: 800 },
    rects: [{ kind: "floors", x: -96, y: -1200, width: 144, height: 800 }],
    shapes: [{ x: -47.9556, y: -1150.5778, width: 5.3333, height: 623.3333 }],
  });
  const cuts = canvases[1].calls.filter(call => call[0] === "fillRect" && call[1] === "destination-out");
  assert.equal(cuts.length, 1);
  assert.ok(cuts[0][5] > 5.3333, "a barreira fina precisa continuar legível no radar");
  const cover = atlas.image.calls.find(call => call[0] === "fillRect" && call[2] === RADAR_COLORS.background);
  assert.ok(cover, "o contorno suavizado não pode religar os dois lados da cerca");
  assert.deepEqual(cover.slice(3), cuts[0].slice(3));
});

test("radar merges adjacent floors without carving objects or collision shapes into the outline", t => {
  const canvases = [];
  useGlobal(t, "document", { createElement() {
    const canvas = recordingCanvas(); canvases.push(canvas); return canvas;
  } });
  const geometry = {
    bounds: { x: -240, y: -480, width: 100000, height: 200000 },
    rects: [
      { kind: "floors", x: -240, y: -480, width: 48, height: 48 },
      { kind: "floors", x: -192, y: -480, width: 48, height: 48 },
      { kind: "roads", x: 200, y: 100, width: 48, height: 48 },
      // Uma fachada sobre o piso não deve esconder uma passagem sem colisão.
      { kind: "buildings", x: -240, y: -480, width: 48, height: 48 },
    ],
    shapes: [
      { x: -220, y: -470, width: 10, height: 10 },
      { points: [{ x: -190, y: -470 }, { x: -180, y: -470 }, { x: -180, y: -460 }] },
    ],
  };
  const atlas = drawMiniMapAtlas(geometry);
  const mask = canvases[1];
  const floors = mask.calls.filter(call => call[0] === "fillRect" && call[1] === "source-over");
  assert.equal(floors.length, 2);
  assert.ok(floors.some(call => call[3] === -240 && call[5] === 96));
  assert.ok(floors.every(call => call[2] === RADAR_COLORS.paths));
  assert.deepEqual(mask.calls.find(call => call[0] === "translate"), ["translate", 240, 480]);
  assert.equal(mask.calls.some(call => call[1] === "destination-out"), false);
  assert.equal(mask.calls.some(call => call[0] === "lineTo"), false);
  assert.equal(mask.calls.some(call => call[0] === "drawImage"), false, "nenhuma textura do jogo é desenhada");
  assert.ok(atlas.image.calls.some(call => call[0] === "fillRect" && call[1] === "source-in" && call[2] === RADAR_COLORS.outline));
  assert.ok(atlas.image.calls.filter(call => call[0] === "drawImage").every(call => call[2] === mask));
  assert.ok(atlas.image.width <= 1024 && atlas.image.height <= 1024);
});

test("atlas merges connected gray sidewalks before drawing the common outline", t => {
  const canvases = [];
  useGlobal(t, "document", { createElement() {
    const canvas = recordingCanvas();
    const role = canvases.length;
    const context = canvas.getContext();
    context.getImageData = () => ({ data: role === 1
      ? new Uint8ClampedArray([98, 105, 112, 255, 0, 0, 0, 0, 0, 0, 0, 0])
      : new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255]) });
    context.putImageData = data => canvas.calls.push(["putImageData", data.data.slice()]);
    canvases.push(canvas);
    return canvas;
  } });
  const geometry = { bounds: { x: 0, y: 0, width: 36, height: 12 }, shapes: [], rects: [
    { kind: "floors", x: 0, y: 0, width: 12, height: 12 },
    { kind: "sidewalks", x: 12, y: 0, width: 24, height: 12 },
  ] };
  const atlas = drawMiniMapAtlas(geometry);
  const mergedSidewalk = canvases[1].calls.find(call => call[0] === "fillRect" && call[3] === 12);
  assert.deepEqual(mergedSidewalk.slice(3), [12, 0, 24, 12]);
  assert.equal(canvases[1].calls.some(call => call[0] === "putImageData"), false);
  assert.equal(canvases[2].calls.filter(call => call[0] === "rect").length, 2);
  assert.ok(atlas.image.calls.filter(call => call[0] === "drawImage").every(call => call[2] === canvases[1]));
});

test("vehicles draw as outlined blocks over the map without cutting holes in roads", t => {
  const canvases = [];
  useGlobal(t, "document", { createElement() {
    const canvas = recordingCanvas(); canvases.push(canvas); return canvas;
  } });
  const atlas = drawMiniMapAtlas({
    bounds: { x: 0, y: 0, width: 96, height: 96 }, shapes: [],
    rects: [
      { kind: "floors", x: 0, y: 0, width: 96, height: 96 },
      { kind: "vehicles", x: 12, y: 12, width: 12, height: 24 },
      { kind: "vehicles", x: 24, y: 12, width: 12, height: 24 },
      { kind: "vehicles", x: 12, y: 36, width: 12, height: 12 },
    ],
  });
  const body = atlas.image.calls.find(call => call[0] === "fillRect" && call[2] === RADAR_COLORS.vehicles);
  assert.deepEqual(body.slice(3), [12, 12, 24, 36]);
  assert.equal(atlas.image.calls.filter(call => call[0] === "fillRect" && call[2] === RADAR_COLORS.vehicles).length, 1);
  assert.equal(atlas.image.calls.filter(call => call[0] === "strokeRect").length, 1);
  assert.ok(atlas.image.calls.some(call => call[0] === "strokeRect" && call[1] === RADAR_COLORS.vehicleOutline));
  const road = canvases[1].calls.filter(call => call[0] === "fillRect");
  assert.equal(road.length, 1);
  assert.deepEqual(road[0].slice(3), [0, 0, 96, 96]);
  assert.equal(road[0][1], "source-over");
});

test("minimap shows unvisited tiles immediately and follows the player without saved exploration", t => {
  const canvases = [];
  useGlobal(t, "document", { createElement() {
    const image = recordingCanvas(); canvases.push(image); return image;
  } });
  useGlobal(t, "Phaser", { Scenes: { Events: { SHUTDOWN: "shutdown" } } });
  const map = simpleMap();
  map.layers[0].name = "Chão";
  map.tilesets = [{ name: "A5_Street_Rasak", firstgid: 1, total: 128 }];
  map.layers[0].data = [[0, 5000].map(pixelX => ({ index: 1,
    pixelX, pixelY: 0, baseWidth: 48, baseHeight: 48 }))];
  const display = () => new Proxy({}, { get: (target, key) => key === "then" ? undefined :
    (...args) => { target[key] = args; return display(); } });
  let refreshes = 0, removed = false;
  const scene = {
    cache: { tilemap: { get: () => null } },
    events: new EventEmitter(),
    player: { active: true, x: -200, y: -220 }, direcaoAtual: "down",
    cameras: { main: { width: 800, height: 450, zoom: 2, originX: 0.5, originY: 0.5 } },
    add: Object.fromEntries(["container", "graphics", "text", "image", "circle"].map(key => [key, display])),
    textures: {
      createCanvas() { const view = recordingCanvas(); return {
        getContext: view.getContext, refresh() { refreshes++; }, calls: view.calls,
      }; },
      remove() { removed = true; },
    },
  };
  const minimap = new MiniMapManager(scene, map, "cidade");
  assert.equal(canvases.length, 2, "atlas e máscara dos caminhos são criados uma única vez");
  const floors = canvases[1].calls.filter(call => call[0] === "fillRect" && call[1] === "source-over");
  assert.equal(floors.length, 2, "até o piso distante aparece antes de visitar a região");
  assert.ok(floors.some(call => call[3] === 4760));
  assert.equal(refreshes, 1);
  const firstTransform = { ...minimap.transform };
  minimap.update(1000);
  assert.equal(refreshes, 1);
  scene.player.x = 4700;
  minimap.update(1100);
  assert.equal(refreshes, 2);
  assert.notEqual(minimap.transform.x, firstTransform.x);
  assert.ok(minimap.texture.calls.filter(call => call[0] === "drawImage").every(call =>
    call[1] === 1 && call[2] === canvases[0]));
  scene.events.emit("shutdown");
  assert.equal(removed, true);
  assert.equal(minimap.destroyed, true);
});

function enemyRadarFixture(enemies) {
  const commands = [];
  const graphics = {
    clear() { commands.length = 0; return this; },
    fillStyle() { return this; },
    fillCircle(...args) { commands.push(["circle", ...args]); return this; },
    fillTriangle(...args) { commands.push(["triangle", ...args]); return this; },
  };
  const marker = {
    setVisible() { return this; }, setPosition() { return this; }, setRotation() { return this; },
  };
  const radar = Object.assign(Object.create(MiniMapManager.prototype), {
    scene: { player: { active: true, x: 0, y: 0 }, inimigos: enemies },
    geometry: { bounds: { x: -1000, y: -1000, width: 2000, height: 2000 } },
    transform: { scale: 0.12, x: 43, y: 43 },
    lastX: 0, lastY: 0, nextUpdate: 0, enemyMarkers: graphics, marker,
    drawView() { assert.fail("movimentar os robôs não deve redesenhar o cenário"); },
  });
  return { radar, commands };
}

test("robot markers show positions and all four look directions", () => {
  const { radar, commands } = enemyRadarFixture([
    { active: true, x: -100, y: 0, direcaoAtual: "up" },
    { active: true, x: 0, y: -100, direcaoAtual: "right", tipoRobo: "serra" },
    { active: true, x: 100, y: 0, direcaoAtual: "down", remoteOnly: true },
    { active: true, x: 0, y: 100, direcaoAtual: "left" },
  ]);
  radar.update(0);
  const arrows = commands.filter(command => command[0] === "triangle");
  assert.deepEqual(arrows.map(command => command.slice(1, 3)), [[33, 39], [51, 33], [57, 51], [39, 57]]);
  const points = commands.filter(command => command[0] === "circle" && command[3] === 1.7);
  assert.deepEqual(points.map(command => command.slice(1, 3)), [[33, 45], [45, 33], [57, 45], [45, 57]]);
});

test("robots move and turn on the radar while the player stays still, and disappear after death or removal", () => {
  const enemy = { active: true, x: 0, y: 0, direcaoAtual: "up" };
  const { radar, commands } = enemyRadarFixture([enemy]);
  radar.update(0);
  assert.deepEqual(commands[0].slice(1, 3), [45, 39]);
  enemy.x = 50;
  enemy.direcaoAtual = "right";
  radar.update(1);
  assert.deepEqual(commands[0].slice(1, 3), [57, 45]);
  enemy.morto = true;
  radar.update(2);
  assert.equal(commands.length, 0);
  enemy.morto = false;
  radar.update(3);
  assert.ok(commands.length > 0);
  radar.scene.inimigos = [];
  radar.update(4);
  assert.equal(commands.length, 0);
});

test("robot markers stay inside the viewport and ignore inactive or invalid enemies", () => {
  const { radar, commands } = enemyRadarFixture([
    { active: true, x: 350, y: 0, direcaoAtual: "right" },
    { active: true, x: -350, y: 0, direcaoAtual: "left" },
    { active: true, x: 0, y: -350, direcaoAtual: "up" },
    { active: true, x: 0, y: 350, direcaoAtual: "down" },
    { active: true, x: NaN, y: 0 },
    { active: false, x: 0, y: 0 },
    { active: true, morto: true, x: 0, y: 0 },
  ]);
  radar.update(0);
  assert.equal(commands.length, 0);
  radar.scene.inimigos.push({ active: true, x: 0, y: 0 });
  radar.update(1);
  assert.ok(commands.length > 0);
  radar.scene.player.active = false;
  radar.update(2);
  assert.equal(commands.length, 0);
});
