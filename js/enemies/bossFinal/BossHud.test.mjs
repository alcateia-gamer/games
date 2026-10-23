import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { BOSS_HUD_BARS, criarHudBoss, esvaziarBarras, larguraPreenchida,
  larguraEstamina } from "./BossHud.js";

test("vazio remove cor e brilho sem tocar na moldura nem na transparência", () => {
  const pixels = new Uint8ClampedArray(724 * 241 * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels.set([255, 180, 10, 127], i);
  esvaziarBarras(pixels, 724);
  for (let y = 0; y < 241; y++) for (let x = 0; x < 724; x++) {
    const pixel = [...pixels.slice((y * 724 + x) * 4, (y * 724 + x + 1) * 4)];
    const inside = Object.values(BOSS_HUD_BARS).some(b =>
      x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height);
    if (inside) {
      assert.equal(pixel[0], pixel[1]);
      assert.equal(pixel[1], pixel[2]);
      assert.ok(pixel[0] <= 46);
      assert.equal(pixel[3], 127);
    } else assert.deepEqual(pixel, [255, 180, 10, 127]);
  }
});

test("preenchimentos limitados cobrem zero, metade, cheio e valores inválidos", () => {
  for (const bar of Object.values(BOSS_HUD_BARS)) {
    assert.equal(larguraPreenchida(0, 100, bar.width), 0);
    assert.equal(larguraPreenchida(50, 100, bar.width), bar.width / 2);
    assert.equal(larguraPreenchida(100, 100, bar.width), bar.width);
    assert.equal(larguraPreenchida(200, 100, bar.width), bar.width);
    assert.equal(larguraPreenchida(-1, 100, bar.width), 0);
    assert.equal(larguraPreenchida(1, 0, bar.width), 0);
    assert.equal(larguraPreenchida(NaN, 100, bar.width), 0);
  }
});

test("HUD acompanha dano e recuperação, fica fixa no zoom e libera seus recursos", t => {
  const previousDocument = globalThis.document, previousPhaser = globalThis.Phaser;
  t.after(() => { globalThis.document = previousDocument; globalThis.Phaser = previousPhaser; });
  globalThis.Phaser = { Textures: { FilterMode: { LINEAR: 1 } } };
  const calls = [];
  const context = {
    clearRect() {}, drawImage(...args) { calls.push(args); },
    getImageData: () => ({ data: new Uint8ClampedArray(724 * 241 * 4) }), putImageData() {},
  };
  globalThis.document = { createElement: () => ({ getContext: () => context }) };
  const source = { width: 724, height: 241 };
  let removed = 0;
  const scene = {
    events: new EventEmitter(), cameras: { main: {
      width: 800, height: 450, originX: 0.5, originY: 0.5, zoom: 1,
    } },
    textures: { get: () => ({ getSourceImage: () => source }),
      createCanvas: () => ({ setFilter() {}, getContext: () => context, refresh() {} }),
      remove() { removed++; } },
    add: { image() {
      const object = { scene, setPosition(x, y) { Object.assign(this, { x, y }); return this; },
        setScale(x, y) { this.scaleX = x; this.scaleY = y; return this; },
        setVisible(visible) { this.visible = visible; return this; }, destroy() {} };
      for (const method of ["setOrigin", "setScrollFactor", "setDepth"]) object[method] = () => object;
      return object;
    } },
  };
  const boss = { active: true, visible: true, dentroArena: true,
    vida: 100, vidaMaxima: 100, estamina: 100, estaminaMaxima: 100 };
  criarHudBoss(scene, boss);
  const hud = boss.hudVida;
  const before = { x: hud.x, y: hud.y, scale: hud.scaleX };
  for (const zoom of [0.97, 0.9, 0.8, 1]) {
    scene.cameras.main.zoom = zoom;
    scene.events.emit("prerender");
    assert.ok(Math.abs(400 + (hud.x - 400) * zoom - before.x) < 1e-8);
    assert.ok(Math.abs(225 + (hud.y - 225) * zoom - before.y) < 1e-8);
    assert.ok(Math.abs(hud.scaleX * zoom - before.scale) < 1e-8);
  }
  calls.length = 0;
  boss.vida = 50; boss.estamina = 0;
  boss.atualizarHudVida();
  assert.equal(calls.length, 2); // Fundo vazio + vida; nenhuma camada amarela.
  assert.deepEqual(calls[1].slice(1), [71, 130, 289, 27, 71, 130, 289, 27]);
  calls.length = 0;
  boss.estamina = 100;
  scene.events.emit("prerender");
  assert.equal(calls.length, 3);
  boss.dentroArena = false;
  scene.events.emit("prerender");
  assert.equal(hud.visible, false);
  scene.events.emit("shutdown");
  boss.limparHudVida();
  assert.equal(removed, 1);
  assert.equal(scene.events.listenerCount("prerender"), 0);
  assert.equal(boss.hudVida, null);
});

test("cinco ataques esvaziam exatamente as cinco seções desenhadas no PNG novo", () => {
  const expected = [[100, 380], [80, 305], [60, 228], [40, 151], [20, 75], [0, 0]];
  for (const [stamina, width] of expected) assert.equal(larguraEstamina(stamina, 100), width);
  assert.equal(larguraEstamina(200, 100), 380);
  assert.equal(larguraEstamina(-20, 100), 0);
  assert.equal(larguraEstamina(NaN, 100), 0);
  assert.equal(larguraEstamina(20, 0), 0);
  let previous = 0;
  for (let stamina = 0; stamina <= 100; stamina += 0.25) {
    const width = larguraEstamina(stamina, 100);
    assert.ok(width >= previous && width - previous <= 1, "recuperação gradual sem saltos entre seções");
    previous = width;
  }
});
