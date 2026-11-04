import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { criarObjetosCidade } from "./ObjetosMapa.js";

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
