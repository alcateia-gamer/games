import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { FACTORY_DOOR_STATE_KEY, criarInteracaoPortaFabrica } from "./FactoryDoor.js";
import { criarSistemaInventario } from "../inventory/ItemPickup.js";
import { criarInteracaoGeradorFabrica, findGeneratorInteraction } from "./FactoryGenerator.js";

globalThis.Phaser = {
  Scenes: { Events: { PRE_RENDER: "prerender", SHUTDOWN: "shutdown" } },
  Input: { Keyboard: {
    KeyCodes: { E: 69, ESC: 27 },
    JustDown(key) {
      const pressed = key.pressed;
      key.pressed = false;
      return pressed;
    },
  } },
  Math: {
    Distance: { Between: (x, y, a, b) => Math.hypot(x - a, y - b) },
    Vector2: class {
      constructor(x = 0, y = 0) { this.x = x; this.y = y; }
      copy(other) { this.x = other.x; this.y = other.y; return this; }
    },
  },
};

class DisplayObject extends EventEmitter {
  constructor(x, y) { super(); this.x = x; this.y = y; this.visible = true; }
  setOrigin() { return this; }
  setScrollFactor() { return this; }
  setScale() { return this; }
  setAlpha() { return this; }
  setStrokeStyle() { return this; }
  setText() { return this; }
  setColor() { return this; }
  setSize() { return this; }
  removeAll() { return this; }
  add() { return this; }
  setInteractive() { return this; }
  disableInteractive() { return this; }
  refreshBody() { this.body = { width: this.width, height: this.height }; return this; }
  setDisplaySize(w, h) { this.width = w; this.height = h; return this; }
  setVisible(value) { this.visible = value; return this; }
  setDepth(value) { this.depth = value; return this; }
  setY(value) { this.y = value; return this; }
  setPosition(x, y) { this.x = x; this.y = y; return this; }
  setCrop(...rect) { this.crop = rect; return this; }
  destroy() { this.destroyed = true; this.emit("destroy"); }
}

function createScene(registry = new Map()) {
  const raw = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const doorLayer = raw.layers.find((layer) => layer.name === "Portas");
  const atlas = raw.tilesets.find((tileset) => tileset.name === "A5_SciFi_Industrial_Rasak");
  const texture = { key: "industrialA5", has: () => false,
    add(...args) { this.frame = args; } };
  const tileset = { image: texture, getTileTextureCoordinates(gid) {
    const index = gid - atlas.firstgid;
    return { x: index % atlas.columns * 48, y: Math.floor(index / atlas.columns) * 48 };
  } };
  const tiles = [];
  for (const chunk of doorLayer.chunks) {
    const data = Buffer.from(chunk.data, "base64");
    for (let i = 0; i < chunk.width * chunk.height; i++) {
      const x = (chunk.x + i % chunk.width) * 48;
      const y = (chunk.y + Math.floor(i / chunk.width)) * 48;
      if (x >= -1152 && x < -1008 && y >= -1584 && y < -1488) {
        tiles.push({ x, y, index: data.readUInt32LE(i * 4), tileset, alpha: 1 });
      }
    }
  }
  const layer = { depth: 13, getTilesWithinWorldXY: () => tiles,
    getTileAtWorldXY: (x, y) => tiles.find((tile) => tile.x === x && tile.y === y) };
  const bodies = new Set();
  const scene = {
    events: new EventEmitter(), game: { registry },
    scene: { key: "Level1Parte2" },
    player: {
      active: true, x: -1076, y: -1445,
      getCenter(out) { return out.copy(this); },
      setVelocity() {},
    },
    map: { objects: raw.layers, getLayer: () => ({ tilemapLayer: layer }),
      getObjectLayer: (name) => raw.layers.find((item) => item.name === name) },
    add: Object.fromEntries(["image", "text", "container", "rectangle"].map((type) =>
      [type, (x, y) => new DisplayObject(x, y)])),
    textures: { exists: () => true },
    cameras: { main: { width: 800, height: 450, zoom: 1, originX: 0.5, originY: 0.5 } },
    input: Object.assign(new EventEmitter(), {
      keyboard: { addKey: () => Object.assign(new DisplayObject(), { pressed: false }) },
    }),
    time: { delayedCall(delay, callback) {
      scene.finishActivation = callback;
      return { remove() {} };
    } },
    acenderLuzFabrica() { this.luzFabricaAcesa = true; },
    collisionGroup: { create(x, y) {
      const body = new DisplayObject(x, y);
      bodies.add(body);
      body.on("destroy", () => bodies.delete(body));
      return body;
    } },
    tweens: { add(config) { scene.animation = config; return { stop() {} }; } },
  };
  criarSistemaInventario(scene);
  criarInteracaoGeradorFabrica(scene);
  criarInteracaoPortaFabrica(scene);
  return { scene, bodies, tiles, texture, layer };
}

test("the requested door blocks passage until its opening animation finishes", () => {
  const { scene, bodies, tiles, texture } = createScene();
  assert.equal(tiles.length, 6);
  assert.deepEqual(texture.frame.slice(2), [240, 288, 144, 96]);
  assert.equal(scene.portaFabrica.estado, "fechada");
  assert.deepEqual(scene.portaFabrica.colisao.body, { width: 144, height: 96 });
  assert.equal(bodies.size, 1);

  scene.atualizarColetaItens();
  assert.equal(scene.botaoColetarItem.visible, true);
  scene.botaoColetarItem.emit("pointerdown");
  assert.equal(scene.portaFabrica.estado, "abrindo");
  assert.equal(bodies.size, 1);
  assert.equal(scene.botaoColetarItem.visible, false);
  scene.portaFabrica.progresso = 0.5;
  scene.animation.onUpdate();
  assert.equal(scene.portaFabrica.visual.y, -1632);
  assert.deepEqual(scene.portaFabrica.visual.crop, [0, 48, 144, 48]);
  scene.portaFabrica.progresso = 1;
  scene.animation.onUpdate();
  scene.animation.onComplete();
  assert.equal(scene.portaFabrica.estado, "aberta");
  assert.equal(scene.portaFabrica.visual.visible, false);
  assert.equal(bodies.size, 0);
  assert.equal(scene.game.registry.get(FACTORY_DOOR_STATE_KEY), true);
  scene.events.emit("shutdown");
  assert.ok(tiles.every((tile) => tile.alpha === 1));
});

test("E opens the door, while out-of-range interaction and generator menus cannot", () => {
  const { scene } = createScene();
  const interact = scene.interacaoMundoProxima.interact;
  scene.player.y = -1200;
  assert.equal(interact(), false);
  scene.player.y = -1445;
  scene.generatorMenuOpen = true;
  assert.equal(interact(), false);
  scene.generatorMenuOpen = false;
  scene.teclaColetarItem.pressed = true;
  scene.atualizarColetaItens();
  assert.equal(scene.portaFabrica.estado, "abrindo");
  assert.equal(interact(), false);
  scene.events.emit("shutdown");
});

test("nearby collectibles keep priority and opened doors stay open after returning", () => {
  const { scene } = createScene();
  scene.itensColetaveis.push({ uniqueId: "test:gasolina", itemId: "gasolina", quantity: 1,
    x: scene.player.x, y: scene.player.y, range: 64, image: new DisplayObject() });
  scene.atualizarColetaItens();
  scene.botaoColetarItem.emit("pointerdown");
  assert.equal(scene.inventory.getQuantity("gasolina"), 1);
  assert.equal(scene.portaFabrica.estado, "fechada");
  scene.atualizarColetaItens();
  scene.botaoColetarItem.emit("pointerdown");
  scene.portaFabrica.progresso = 1;
  scene.animation.onUpdate();
  scene.animation.onComplete();
  const registry = scene.game.registry;
  scene.events.emit("shutdown");
  const returned = createScene(registry);
  assert.equal(returned.scene.portaFabrica.estado, "aberta");
  assert.equal(returned.bodies.size, 0);
  assert.equal(returned.scene.interacaoMundoProxima, null);
  returned.scene.events.emit("shutdown");
});

function approachGenerator(scene) {
  const { object: area } = findGeneratorInteraction(scene.map);
  scene.player.x = area.x + area.width / 2;
  scene.player.y = area.y + area.height + 20;
  scene.atualizarInteracaoGeradorFabrica();
  scene.atualizarInteracaoPortaFabrica();
}

test("E opens the generator menu in the current map and activation consumes its resources", () => {
  const { scene } = createScene();
  approachGenerator(scene);
  scene.teclaColetarItem.pressed = true;
  scene.atualizarColetaItens();
  assert.equal(scene.generatorMenuOpen, true);
  assert.equal(scene.movimentoBloqueado, true);

  const activate = () => scene.input.emit("pointerdown", { x: 305, y: 344 });
  activate();
  assert.notEqual(scene.luzFabricaAcesa, true);
  scene.inventory.addItem("gasolina", 2);
  scene.inventory.addItem("bateria", 1);
  activate();
  assert.equal(scene.luzFabricaAcesa, true);
  assert.equal(scene.inventory.getQuantity("gasolina"), 1);
  assert.equal(scene.inventory.getQuantity("bateria"), 0);
  scene.finishActivation();
  assert.equal(scene.generatorMenuOpen, false);
  assert.equal(scene.movimentoBloqueado, false);
  scene.events.emit("shutdown");
});

test("the shared touch button opens the generator and an open menu blocks collection", () => {
  const { scene } = createScene();
  approachGenerator(scene);
  scene.atualizarColetaItens();
  assert.equal(scene.botaoColetarItem.visible, true);
  scene.botaoColetarItem.emit("pointerdown");
  assert.equal(scene.generatorMenuOpen, true);
  assert.equal(scene.coletarItemProximo(), false);
  scene.events.emit("shutdown");
});

test("collecting an item keeps priority over the nearby generator", () => {
  const { scene } = createScene();
  approachGenerator(scene);
  scene.itensColetaveis.push({
    uniqueId: "test:generator-gasolina", itemId: "gasolina", quantity: 1,
    x: scene.player.x, y: scene.player.y, range: 64, image: new DisplayObject(),
  });
  scene.teclaColetarItem.pressed = true;
  scene.atualizarColetaItens();
  assert.equal(scene.inventory.getQuantity("gasolina"), 1);
  assert.notEqual(scene.generatorMenuOpen, true);
  scene.teclaColetarItem.pressed = true;
  scene.atualizarColetaItens();
  assert.equal(scene.generatorMenuOpen, true);
  scene.events.emit("shutdown");
});
