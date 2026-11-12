import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { criarBotoesTeleporteDev } from "./DeveloperTeleportButtons.js";
globalThis.Phaser = { Scenes: { Events: { PRE_RENDER: "prerender", SHUTDOWN: "shutdown" } } };
function fixture(touch = true, key = "Level1") {
  const objects = [];
  const criar = (...args) => {
    const object = new EventEmitter(); object.args = args;
    for (const method of ["setStrokeStyle", "setScrollFactor", "setDepth", "setInteractive", "setOrigin", "setScale"])
      object[method] = () => object;
    object.setVisible = value => { object.visible = value; return object; };
    object.setPosition = (x, y) => { object.x = x; object.y = y; return object; };
    objects.push(object); return object;
  };
  const requests = [];
  const scene = { sys: { settings: { key }, game: { device: { input: { touch }, os: { desktop: !touch } } } },
    add: { rectangle: criar, text: criar }, events: new EventEmitter(), developerMode: true,
    player: { active: true }, cameras: { main: { width: 800, height: 400, originX: 0.5, originY: 0.5, zoom: 1 } },
    coopRuntime: { world: { requestMap: key => requests.push(key) } }, teleportarDevBoss: () => requests.push("boss") };
  criarBotoesTeleporteDev(scene); return { scene, objects, requests };
}
test("no celular, botões DEV usam os destinos de fábrica e boss e respeitam menus", () => {
  const { scene, objects, requests } = fixture();
  assert.equal(objects.length, 4);
  objects[0].emit("pointerdown"); objects[2].emit("pointerdown");
  assert.deepEqual(requests, ["Level1Parte2", "boss"]);
  scene.generatorMenuOpen = true;
  scene.events.emit("prerender"); objects[2].emit("pointerdown");
  assert.equal(objects[2].visible, false); assert.equal(requests.length, 2);
  scene.generatorMenuOpen = false; scene.developerMode = false; scene.events.emit("prerender");
  assert.ok(objects.every(o => !o.visible));
  scene.events.emit("shutdown"); assert.equal(scene.events.listenerCount("prerender"), 0);
});
test("PC mantém os atalhos de teclado; fábrica só oferece boss", () => {
  assert.equal(fixture(false).objects.length, 0);
  const { objects } = fixture(true, "Level1Parte2");
  assert.equal(objects[0].visible, false); assert.equal(objects[2].visible, true);
});
