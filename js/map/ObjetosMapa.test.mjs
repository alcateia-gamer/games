import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { criarObjetosCidade, criarObjetosFabrica } from "./ObjetosMapa.js";

test("cria todos os objetos da camada TanqueCombustivel com o tileset registrado", () => {
  const mapData = JSON.parse(
    readFileSync(
      new URL("../../assets/map/InicioFase1 (1).json", import.meta.url),
      "utf8",
    ),
  );
  const layer = mapData.layers.find(({ name }) => name === "TanqueCombustivel");
  assert.ok(layer);

  const textureFrames = {};
  const texture = {
    source: [{ width: 300 }],
    frames: textureFrames,
    add(name, sourceIndex, x, y, width, height) {
      textureFrames[name] = { sourceIndex, x, y, width, height };
    },
  };
  const rendered = [];
  const map = {
    tileWidth: mapData.tilewidth,
    tileHeight: mapData.tileheight,
    tilesets: mapData.tilesets.map((tileset) => ({
      ...tileset,
      tileWidth: tileset.tilewidth,
      tileHeight: tileset.tileheight,
    })),
    getObjectLayer(name) {
      return name === layer.name ? layer : { objects: [] };
    },
  };
  const scene = {
    textures: { get: () => texture },
    add: {
      image(...args) {
        const visual = {
          args,
          angle: 0,
          setOrigin() { return this; },
          setVertexRoundMode() { return this; },
          setScale() { return this; },
          setDepth(depth) { this.depth = depth; return this; },
          setFlipX() { return this; },
          setFlipY() { return this; },
          setVisible() { return this; },
          setAlpha() { return this; },
          setAngle(angle) { this.angle = angle; return this; },
          setData() { return this; },
        };
        rendered.push(visual);
        return visual;
      },
    },
  };
  const textureKeyByTilesetName = new Map([
    ["tanque_pixel_art_300x150_transparente", "tanqueCombustivel"],
  ]);

  criarObjetosCidade(scene, map, textureKeyByTilesetName);

  assert.equal(scene.tanqueCombustivelObjects.length, layer.objects.length);
  assert.equal(rendered.length, layer.objects.length);
  assert.ok(rendered.every(({ args }) => args[2] === "tanqueCombustivel"));
  assert.equal(
    Object.keys(textureFrames).length,
    layer.objects.length,
    "cada GID da camada deve recortar seu próprio tile",
  );
});

function fabricaComObjetos(t, objects) {
  const anterior = globalThis.Phaser;
  globalThis.Phaser = { Math: { DegToRad: value => value * Math.PI / 180 } };
  t.after(() => { globalThis.Phaser = anterior; });
  const tileset = { name: "teste", firstgid: 1, tilewidth: 48, tileheight: 48, columns: 4 };
  const layer = { name: "ObjetosRobos", objects };
  const map = { tileWidth: 48, tileHeight: 48, layers: [layer], objects: [layer], tilesets: [tileset] };
  const texture = { source: [{ width: 192 }], frames: {},
    add(name, sourceIndex, x, y, width, height) { this.frames[name] = { sourceIndex, x, y, width, height }; } };
  const scene = { textures: { exists: () => true, get: () => texture },
    add: { image(x, y, key, frame) {
      return { x, y, key, frame, data: new Map(),
        setOrigin(x, y) { this.originX = x; this.originY = y; return this; },
        setVertexRoundMode() { return this; },
        setScale(x, y) { this.scaleX = x; this.scaleY = y; return this; },
        setDepth(depth) { this.depth = depth; return this; },
        setRotation(rotation) { this.rotation = rotation; return this; },
        setFlipX(value) { this.flipX = value; return this; },
        setFlipY(value) { this.flipY = value; return this; },
        setAlpha(value) { this.alpha = value; return this; },
        setData(name, value) { this.data.set(name, value); return this; },
        getData(name) { return this.data.get(name); },
      };
    } } };
  return criarObjetosFabrica(scene, map, new Map([[tileset.name, "teste"]]));
}

function cantosVisual(visual) {
  const cos = Math.cos(visual.rotation), sin = Math.sin(visual.rotation);
  return [[0, 0], [48, 0], [48, 48], [0, 48]].map(([x, y]) => {
    x = (x - visual.originX * 48) * visual.scaleX;
    y = (y - visual.originY * 48) * visual.scaleY;
    return { x: visual.x + x * cos - y * sin, y: visual.y + x * sin + y * cos };
  });
}

test("ObjetosRobos rotacionados em -90° conservam os limites exatos do mapa 2", t => {
  const raw = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const objects = raw.layers.find(layer => layer.name === "ObjetosRobos").objects;
  const antes = JSON.stringify(objects);
  const visuais = fabricaComObjetos(t, objects);
  assert.equal(visuais.length, objects.length);
  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i], visual = visuais[i];
    assert.equal(obj.rotation, -90);
    const cantos = cantosVisual(visual);
    const proximos = (atual, esperado) => assert.ok(Math.abs(atual - esperado) < 1e-9,
      `objeto ${obj.id}: ${atual} deve coincidir com ${esperado}`);
    proximos(Math.min(...cantos.map(p => p.x)), obj.x - obj.height);
    proximos(Math.max(...cantos.map(p => p.x)), obj.x);
    proximos(Math.min(...cantos.map(p => p.y)), obj.y - obj.width);
    proximos(Math.max(...cantos.map(p => p.y)), obj.y);
    assert.equal(visual.getData("worldY"), obj.y, "a referência de profundidade é mantida");
    assert.equal(visual.getData("objectLayerName"), "ObjetosRobos");
    assert.equal(visual.getData("tiledObjectId"), obj.id, "preserva o ID usado pelas regras de profundidade");
  }
  assert.equal(JSON.stringify(objects), antes, "a correção não modifica o JSON do mapa");
});

test("objetos sem rotação e objetos escalados giram pela base esquerda como no Tiled", t => {
  const objetos = [0, 90, 180, 37.5].map((rotation, id) => ({
    id, gid: 7, x: -320.5, y: -1500.25, width: 96, height: 72, rotation,
  }));
  const visuais = fabricaComObjetos(t, objetos);
  for (let i = 0; i < objetos.length; i++) {
    const objeto = objetos[i], cantos = cantosVisual(visuais[i]);
    const r = objeto.rotation * Math.PI / 180;
    const locais = [[0, -objeto.height], [objeto.width, -objeto.height], [objeto.width, 0], [0, 0]];
    for (let j = 0; j < locais.length; j++) {
      const [x, y] = locais[j];
      assert.ok(Math.abs(cantos[j].x - (objeto.x + Math.cos(r)*x - Math.sin(r)*y)) < 1e-9);
      assert.ok(Math.abs(cantos[j].y - (objeto.y + Math.sin(r)*x + Math.cos(r)*y)) < 1e-9);
    }
  }
});
