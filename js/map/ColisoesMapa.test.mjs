import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { criarColisoesCidade, criarColisoesFabrica } from "./ColisoesMapa.js";

// Usa o parser e o StaticBody reais da biblioteca instalada, sem abrir um navegador.
const bundle = readFileSync(new URL("../libs/phaser.min.js", import.meta.url), "utf8");
const context = { module: { exports: {} }, exports: {} };
assert.ok(bundle.includes("i(85454)})());"));
vm.runInNewContext(bundle.replace("i(85454)})());", "i})());"), context);
const load = context.module.exports;
const StaticBody = load(72624);
const parseObject = load(52205);

function fixture(objects, layerName = "Collision") {
  const bodies = new Set();
  const world = { defaults: {}, staticTree: {
    insert(body) { bodies.add(body); }, remove(body) { bodies.delete(body); },
  } };
  const children = [];
  const group = { getChildren: () => children, create(x, y) {
    const values = new Map();
    const visual = { x, y, originX: 0.5, originY: 0.5,
      displayWidth: 32, displayHeight: 32, frame: { realWidth: 32, realHeight: 32 },
      getTopLeft(point) { return point.set(this.x - this.displayWidth / 2, this.y - this.displayHeight / 2); },
      getCenter() { return { x: this.x, y: this.y }; },
      setSize(w, h) { this.body.setSize(w, h); return this; },
      setDisplaySize(w, h) { this.displayWidth = w; this.displayHeight = h; return this; },
      setVisible(value) { this.visible = value; return this; },
      refreshBody() { this.body.updateFromGameObject(); return this; },
      setData(key, value) { values.set(key, value); return this; },
      getData: key => values.get(key),
    };
    visual.body = new StaticBody(world, visual);
    bodies.add(visual.body);
    children.push(visual);
    return visual;
  } };
  const scene = {
    physics: { add: { staticGroup: () => group } },
    cache: { tilemap: { get: () => ({ data: { layers: [{ objects }] } }) } },
  };
  const map = { getObjectLayer: name => name === layerName
    ? { name, objects: objects.map(object => parseObject(object)) } : null };
  return { scene, map, children, bodies };
}

function realObjects(filename, layerName) {
  const data = JSON.parse(readFileSync(new URL(`../../assets/map/${filename}`, import.meta.url)));
  return data.layers.find(layer => layer.name === layerName).objects;
}

function contains(body, x, y) {
  return x >= body.x && x <= body.x + body.width &&
    y >= body.y && y <= body.y + body.height;
}

function inPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j], b = points[i];
    const cross = (x - a.x) * (b.y - a.y) - (y - a.y) * (b.x - a.x);
    if (Math.abs(cross) < 1e-6 && x >= Math.min(a.x, b.x) - 1e-8 &&
        x <= Math.max(a.x, b.x) + 1e-8 && y >= Math.min(a.y, b.y) - 1e-8 &&
        y <= Math.max(a.y, b.y) + 1e-8) return true;
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

test("zero-area objects do not become invisible default-size obstacles", () => {
  for (const [name, create] of [["Collision", criarColisoesCidade], ["collision", criarColisoesFabrica]]) {
    const { scene, map, children } = fixture([
      { id: 25, x: -563.333, y: 950.667, width: 0, height: 0, ellipse: true },
      { id: 221, x: -678.5, y: 616, width: 0.5, height: 0 },
      { id: 3, x: -1405, y: 475, width: 0, height: 0, point: true },
      { id: 4, x: 0, y: 0, width: 20, height: 20, polyline: [{ x: 0, y: 0 }, { x: 20, y: 20 }] },
    ], name);
    create(scene, map);
    assert.equal(children.length, 0);
  }
});

test("rectangles near the city spawn keep the exact Tiled bounds, including fractions", () => {
  const objects = realObjects("InicioFase1 (1).json", "Collision")
    .filter(object => [2, 3, 8, 9, 14].includes(object.id));
  const { scene, map, children, bodies } = fixture(objects);
  criarColisoesCidade(scene, map);
  assert.equal(children.length, objects.length);
  for (let i = 0; i < objects.length; i++) {
    const body = children[i].body, object = objects[i];
    for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(body[key] - object[key]) < 1e-9, `${object.id}: ${key}`);
    assert.equal(children[i].getData("tiledObjectId"), object.id);
    assert.equal(children[i].visible, false);
    assert.ok(bodies.has(body), "corpo deve permanecer no índice estático");
  }
});

test("the ellipse beside the spawn does not block its empty bounding-box corners", () => {
  const object = realObjects("InicioFase1 (1).json", "Collision").find(object => object.id === 195);
  const { scene, map, children } = fixture([object]);
  criarColisoesCidade(scene, map);
  assert.ok(children.length > 0);
  assert.equal(children.some(({ body }) => contains(body, object.x + 1, object.y + 1)), false);
  assert.ok(children.some(({ body }) => contains(body, object.x + object.width / 2, object.y + object.height / 2)));
});

test("the capsule near the spawn survives the Phaser parser's unsupported shape", () => {
  const object = realObjects("InicioFase1 (1).json", "Collision").find(object => object.id === 7);
  const { scene, map, children } = fixture([object]);
  assert.equal(map.getObjectLayer("Collision").objects[0].capsule, undefined);
  criarColisoesCidade(scene, map);
  assert.ok(children.length > 0);
  assert.equal(children.some(({ body }) => contains(body, object.x + 0.5, object.y + 0.5)), false);
  assert.ok(children.some(({ body }) => contains(body, object.x + object.width / 2, object.y + object.height / 2)));
});

test("real polygons in both maps only produce bodies inside their Tiled contours", () => {
  for (const [file, name, create] of [
    ["InicioFase1 (1).json", "Collision", criarColisoesCidade],
    ["parte2-fase1.json", "collision", criarColisoesFabrica],
  ]) {
    for (const object of realObjects(file, name).filter(object => object.polygon)) {
      const { scene, map, children } = fixture([object], name);
      create(scene, map);
      assert.ok(children.length > 0, `polígono ${object.id} deve continuar sólido`);
      const points = object.polygon.map(point => ({ x: object.x + point.x, y: object.y + point.y }));
      for (const { body } of children) {
        for (const dx of [0, 0.5, 1]) for (const dy of [0, 0.5, 1]) {
          assert.ok(inPolygon(body.x + dx * body.width, body.y + dy * body.height, points), `${file}, objeto ${object.id}: corpo fora do polígono`);
        }
      }
    }
  }
});
