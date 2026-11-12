import test from "node:test";
import assert from "node:assert/strict";
import { iniciarDash, atualizarDash, CONFIG_DASH } from "./PlayerDashControls.js";
import { playerVisualObjects } from "../multiplayer/CoopPlayers.js";

class Vector2 {
  constructor(x = 0, y = 0) { Object.assign(this, { x, y }); }
  copy(v) { Object.assign(this, v); return this; }
  clone() { return new Vector2(this.x, this.y); }
}
globalThis.Phaser = { Math: { Vector2, Distance: { Between: (x, y, a, b) => Math.hypot(x - a, y - b) } } };

function fixture(mobile) {
  const live = new Set(), tweens = new Set(), criadas = [];
  const visual = (type, x, y) => {
    const obj = { type, x, y, active: true, destroy() { this.active = false; live.delete(this); } };
    for (const name of ["setDepth", "setOrigin", "setDisplaySize", "setFlip", "setAngle", "setTint", "setStrokeStyle"])
      obj[name] = () => obj;
    obj.setAlpha = alpha => { obj.alpha = alpha; return obj; };
    obj.setBlendMode = () => assert.fail("rastro não deve alternar para o lote aditivo");
    live.add(obj); criadas.push(obj); return obj;
  };
  const scene = {
    sys: { game: { device: { os: { desktop: !mobile }, input: { touch: mobile } } } },
    personagemSelecionada: "kai-mercer", estamina: 100, estaminaMaxima: 100,
    time: { now: 0 }, ultimaDirecaoDash: new Vector2(1, 0),
    player: { active: true, x: 0, y: 0, depth: 16.5, texture: { key: "walk" }, frame: { name: 27 },
      body: { velocity: { x: 0, y: 0 } }, setVelocity(x, y) { this.body.velocity = { x, y }; } },
    estadoDash: { ativo: false, proximoDash: 0, direcao: new Vector2(), rastros: new Set(), efeitos: new Set() },
    add: { image: (x, y) => visual("Image", x, y), circle: (x, y) => visual("Arc", x, y),
      container: () => assert.fail("uma sombra não precisa de container nem imagens duplicadas") },
    tweens: { add(config) { tweens.add({ ...config, fim: scene.time.now + config.duration }); } },
  };
  const tick = delta => {
    scene.time.now += delta;
    for (const tween of tweens) if (scene.time.now >= tween.fim) {
      tween.onComplete(); tweens.delete(tween);
    }
    const dash = atualizarDash(scene);
    scene.player.x += (dash ? scene.player.body.velocity.x : 200) * delta / 1000;
    return dash;
  };
  return { scene, tick, live, criadas };
}

test("rastro tem custo limitado no final do dash, inclusive no celular e com FPS alto", () => {
  for (const mobile of [true, false]) {
    for (const fps of [15, 30, 60, 120]) {
      const { scene, tick, live, criadas } = fixture(mobile);
      assert.equal(iniciarDash(scene), true);
      assert.equal(scene.player.body.velocity.x, 650);
      assert.equal(scene.estadoDash.fim, 180);
      assert.equal(scene.estadoDash.proximoDash, 750);
      assert.equal(scene.estamina, 75);
      let pico = 0;
      for (let t = 0; t < 1100; t += 1000 / fps) {
        tick(1000 / fps);
        pico = Math.max(pico, live.size);
        assert.ok(scene.estadoDash.rastros.size <= (mobile ? 4 : 8));
        assert.ok(playerVisualObjects(scene).length <= (mobile ? 5 : 9), "mesmo orçamento ao replicar para aliados");
      }
      assert.ok(pico <= (mobile ? 5 : 9));
      assert.equal(live.size, 0, "o efeito termina completamente sem cópias acumuladas");
      assert.ok(criadas.some(o => o.type === "Image"));
      assert.equal(scene.estadoDash.ativo, false);
      assert.equal(scene.estadoDash.rastros.size, 0);
      assert.equal(scene.estadoDash.efeitos.size, 0);
    }
  }
});

test("dashes repetidos no celular não acumulam objetos nem prolongam o rastro após a parada", () => {
  const { scene, tick, live } = fixture(true);
  for (let dash = 0; dash < 20; dash++) {
    scene.estamina = 100;
    assert.equal(iniciarDash(scene), true);
    for (let i = 0; i < 30; i++) tick(1000 / 30);
    assert.equal(live.size, 0);
    assert.equal(scene.estadoDash.rastros.size, 0);
  }
  assert.equal(CONFIG_DASH.duracao, 180);
});
