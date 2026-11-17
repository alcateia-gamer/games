import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { installPerformanceProbe } from "./PerformanceProbe.js";

test("probe preserva this, retorno, exceções, limites e restaura ao encerrar", () => {
  let time = 0;
  const scene = { sys: { settings: { key: "test" }, sceneUpdate() { time += 2; return this; } },
    children: { list: [] } };
  const game = { events: new EventEmitter(), scene: { getScenes: () => [scene] },
    loop: { callback(value) { assert.equal(this, game.loop); time += 3; return value; } } };
  const original = game.loop.callback, originalUpdate = scene.sys.sceneUpdate;
  const probe = installPerformanceProbe(game, { capacity: 2, clock: () => time, observeLongTasks: false });
  assert.equal(installPerformanceProbe(game), probe, "não instala wrappers duplicados");
  for (let i = 0; i < 5; i++) {
    assert.equal(game.loop.callback(i), i);
    assert.equal(scene.sys.sceneUpdate.call(scene), scene);
    time += 30;
  }
  const snapshot = probe.snapshot();
  assert.equal(snapshot.metrics["frame.cpu"].calls, 5);
  assert.equal(snapshot.metrics["frame.cpu"].mean, 3);
  assert.equal(snapshot.metrics["frame.cpu"].samples, 2);
  assert.equal(snapshot.metrics["frame.cpu"].overBudget, 0);
  assert.equal(snapshot.metrics["test.update"].p99, 2);
  probe.reset();
  assert.deepEqual(probe.snapshot().metrics, {});
  game.events.emit("destroy");
  assert.equal(game.loop.callback, original);
  assert.equal(scene.sys.sceneUpdate, originalUpdate);
  assert.equal(game.events.listenerCount("destroy"), 0);
  probe.stop();
  const error = new Error("expected");
  game.loop.callback = () => { throw error; };
  const failing = installPerformanceProbe(game, { clock: () => time, observeLongTasks: false });
  assert.throws(() => game.loop.callback(), e => e === error);
  assert.equal(failing.snapshot().metrics["frame.cpu"].calls, 1);
  failing.stop();
});

test("probe mantém ordem dos listeners e remove apenas seus wrappers", () => {
  const renderer = new EventEmitter(), order = [];
  renderer.on("render", () => order.push(1));
  renderer.on("render", () => order.push(2));
  const game = { events: new EventEmitter(), renderer, loop: { callback() {} },
    scene: { getScenes: () => [] } };
  const probe = installPerformanceProbe(game, { observeLongTasks: false });
  assert.equal(renderer.emit("render"), true);
  assert.deepEqual(order, [1, 2]);
  assert.equal(probe.snapshot().metrics["renderer.renderListeners"].calls, 1);
  const replacement = () => 7;
  game.loop.callback = replacement;
  probe.stop();
  assert.equal(game.loop.callback, replacement);
  assert.equal(Object.hasOwn(renderer, "emit"), false);
});

test("mede refresh e pixels e limpa referências ao encerrar/recriar a cena", () => {
  let time = 0;
  const texture = { width: 400, height: 225, refresh() { time += 3; return this; } };
  const original = texture.refresh;
  const scene = { sys: { settings: { key: "Level1Parte2" }, sceneUpdate() {} },
    events: new EventEmitter(), textures: { list: { "level1-parte2-escuridao": texture } } };
  const renderer = new EventEmitter();
  renderer.on("render", () => { scene.textures.list["level1-parte2-escuridao"].refresh(); time += 4; });
  const game = { events: new EventEmitter(), renderer, scene: { getScenes: () => [scene] },
    loop: { callback() { renderer.emit("render"); } } };
  const probe = installPerformanceProbe(game, { clock: () => time, observeLongTasks: false });
  game.loop.callback();
  let snapshot = probe.snapshot();
  assert.equal(snapshot.metrics["Level1Parte2.lighting.refreshCPU"].mean, 3);
  assert.equal(snapshot.metrics["renderer.renderListeners.excludingLightingRefresh"].mean, 4);
  assert.deepEqual(snapshot.counters, { lightingRefreshes: 1, lightingSubmittedPixels: 90000 });
  scene.events.emit("shutdown");
  assert.equal(texture.refresh, original);
  assert.equal(scene.events.listenerCount("shutdown"), 0);
  const replacement = { width: 400, height: 866, refresh() { time += 2; } };
  scene.textures.list["level1-parte2-escuridao"] = replacement;
  const replacementOriginal = replacement.refresh;
  game.loop.callback();
  snapshot = probe.snapshot();
  assert.deepEqual(snapshot.counters, { lightingRefreshes: 2, lightingSubmittedPixels: 436400 });
  probe.reset();
  assert.deepEqual(probe.snapshot().counters, { lightingRefreshes: 0, lightingSubmittedPixels: 0 });
  probe.stop();
  assert.equal(replacement.refresh, replacementOriginal);
  assert.equal(scene.events.listenerCount("shutdown"), 0);
});

test("conta quadros acima de 33,33 ms mesmo quando o buffer circular já girou", () => {
  let time=0;
  const game={events:new EventEmitter(),scene:{getScenes:()=>[]},loop:{callback(){time+=40;}}};
  const probe=installPerformanceProbe(game,{capacity:2,clock:()=>time,observeLongTasks:false});
  for(let i=0;i<3;i++)game.loop.callback();
  const metric=probe.snapshot().metrics["frame.cpu"];
  assert.equal(metric.samples,2);assert.equal(metric.calls,3);assert.equal(metric.overBudget,3);
  probe.stop();
});

test("contadores WebGL preservam retorno/this e stop remove wrappers nas duas camadas", async () => {
  let time=0;
  const gl={TRIANGLES:4,drawArrays(...args){assert.equal(this,gl);return args[2];},texImage2D(){time+=2;}};
  const originalDraw=gl.drawArrays,originalUpload=gl.texImage2D;
  const game={events:new EventEmitter(),renderer:{gl},scene:{getScenes:()=>[]},loop:{callback(){}}};
  const probe=installPerformanceProbe(game,{clock:()=>time,observeLongTasks:false});
  await probe.enableRendererCounters();
  assert.equal(gl.drawArrays(4,0,6),6);gl.texImage2D();
  assert.equal(probe.snapshot().rendererCounters.drawCalls,1);
  assert.equal(probe.snapshot().rendererCounters.submittedTriangles,2);
  probe.reset();assert.deepEqual(probe.snapshot().rendererCounters,{});
  probe.stop();assert.equal(gl.drawArrays,originalDraw);assert.equal(gl.texImage2D,originalUpload);
  assert.equal(await probe.enableRendererCounters(),null);
});
