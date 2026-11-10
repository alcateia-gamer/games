import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createInteractionMarker } from "./CollectibleMarker.js";

function fixture() {
  const registry = new Map();registry.events = new EventEmitter();
  const set = registry.set.bind(registry);
  registry.set = (key, value) => { set(key, value);registry.events.emit("changedata", registry, key, value); };
  const scene = { registry, events: new EventEmitter(),
    tweens: { add() {}, killTweensOf(marker) { marker.tweenStopped = true; } },
    add: { graphics() {
      const marker = new EventEmitter();
      for (const method of ["setPosition", "setDepth", "setName", "fillStyle", "fillRect"]) {
        marker[method] = () => marker;
      }
      marker.destroy = () => { marker.destroyed = true;marker.emit("destroy"); };
      return marker;
    } } };
  return scene;
}

test("cada interação esconde somente seu aviso, preserva o estado e remove os listeners", () => {
  const scene = fixture();
  const options = stateKey => ({ x: 0, y: 0, name: stateKey, stateKey });
  const tanque = createInteractionMarker(scene, options("tanque"));
  const porta = createInteractionMarker(scene, options("porta"));
  scene.registry.set("tanque", true);
  assert.ok(tanque.destroyed && tanque.tweenStopped);
  assert.equal(porta.destroyed, undefined);
  assert.equal(createInteractionMarker(scene, options("tanque")), null);
  assert.equal(scene.registry.events.listenerCount("changedata"), 1);
  scene.events.emit("shutdown");
  assert.ok(porta.destroyed && porta.tweenStopped);
  assert.equal(scene.registry.events.listenerCount("changedata"), 0);
  assert.equal(scene.registry.get("porta"), undefined, "sair do mapa não conta como interação");
});
