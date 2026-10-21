import test from "node:test";
import assert from "node:assert/strict";
import { preparePickupTexture } from "./ItemPickup.js";

function fixture(t, width, height) {
  const previous = globalThis.Phaser;
  globalThis.Phaser = { Textures: { FilterMode: { LINEAR: 0 } } };
  t.after(() => {
    if (previous === undefined) delete globalThis.Phaser;
    else globalThis.Phaser = previous;
  });
  const sourceImage = {};
  const frame = { name: "__BASE", cutX: 0, cutY: 0,
    cutWidth: width, cutHeight: height, source: { image: sourceImage } };
  const textures = new Map();
  const draws = [];
  const scene = { textures: {
    getFrame: () => frame,
    exists: key => textures.has(key),
    createCanvas(key, width, height) {
      const context = { drawImage(...args) { draws.push(args); } };
      const texture = { width, height, context, refreshes: 0,
        getContext: () => context,
        refresh() { this.refreshes++; },
        setFilter(filter) { this.filter = filter; },
      };
      textures.set(key, texture);
      return texture;
    },
  } };
  return { scene, textures, draws, sourceImage, frame };
}

test("prefilters the full gasoline image once without cropping or modifying the original", t => {
  const { scene, textures, draws, sourceImage, frame } = fixture(t, 443, 405);
  const item = { image: { key: "inventory-gasolina-icon" } };
  const originalFrame = structuredClone(frame);
  const texture = preparePickupTexture(scene, item, 36.4);
  const prepared = textures.get(texture.key);
  assert.equal(prepared.width, 73);
  assert.equal(prepared.height, 73);
  assert.equal(prepared.context.imageSmoothingEnabled, true);
  assert.equal(prepared.context.imageSmoothingQuality, "high");
  assert.equal(prepared.filter, 0);
  assert.equal(prepared.refreshes, 1);
  assert.deepEqual(draws, [[sourceImage, 0, 0, 443, 405, 0, 0, 73, 73]]);
  assert.deepEqual(frame, originalFrame);
  assert.deepEqual(item, { image: { key: "inventory-gasolina-icon" } });
  assert.deepEqual(preparePickupTexture(scene, item, 36.4), texture);
  assert.equal(draws.length, 1, "revisitar o mapa deve reutilizar a textura filtrada");
});

test("keeps small textures and their original frame untouched", t => {
  const { scene, textures, draws } = fixture(t, 24, 24);
  const item = { image: { key: "inventory-scrap-icon", frame: "scrap" } };
  assert.deepEqual(preparePickupTexture(scene, item, 28), item.image);
  assert.equal(textures.size, 0);
  assert.equal(draws.length, 0);
});

test("prefilters only the selected frame and caches each display size separately", t => {
  const { scene, frame, textures, draws, sourceImage } = fixture(t, 256, 196);
  Object.assign(frame, { name: "card", cutX: 16, cutY: 32 });
  const item = { image: { key: "items-atlas", frame: "card" } };
  const first = preparePickupTexture(scene, item, 28);
  const second = preparePickupTexture(scene, item, 36.4);
  assert.notEqual(first.key, second.key);
  assert.equal(textures.size, 2);
  assert.deepEqual(draws[0], [sourceImage, 16, 32, 256, 196, 0, 0, 56, 56]);
});
