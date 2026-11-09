import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { limitarPassoRoboBola, protegerColisaoRoboBola } from "./RoboBolaColisao.js";
import { limitarCorpoNaBarreira, criarColisaoBarreiraNovoBoss } from "./novoBoss/NovoBossBarreiraColisao.js";

function preparar(paredes = []) {
  const world = new EventEmitter(), scene = { events: new EventEmitter(),
    collisionGroup: { getChildren: () => paredes.map(body => ({ body })) },
    physics: { world } };
  const robo = Object.assign(new EventEmitter(), { active: true, body: {
    width: 34, height: 34, enable: true, setVelocity(x, y) { this.velocity = { x, y }; },
    updateCenter() {},
  } });
  return { scene, robo, world };
}

test("varre a hitbox em paredes finas com órbita, empurrão e frames longos", () => {
  for (const [inicio, fim, parede, eixo, limite] of [
    [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 100, y: -100, width: 5, height: 300 }, "x", 66],
    [{ x: 200, y: 0 }, { x: -500, y: 0 }, { x: 100, y: -100, width: 5, height: 300 }, "x", 105],
    [{ x: 0, y: 0 }, { x: 0, y: 500 }, { x: -100, y: 100, width: 300, height: 5 }, "y", 66],
    [{ x: 0, y: 200 }, { x: 0, y: -500 }, { x: -100, y: 100, width: 300, height: 5 }, "y", 105],
  ]) {
    const { scene, robo } = preparar([parede]);
    const resultado = limitarPassoRoboBola(scene, robo, inicio, fim);
    assert.ok(Math.abs(resultado[eixo] - limite) < 0.05);
  }
});

test("colisão permite afastar-se e ignora somente corpos desabilitados", () => {
  const parede = { x: 100, y: -100, width: 5, height: 300, enable: true };
  const { scene, robo } = preparar([parede]);
  assert.equal(limitarPassoRoboBola(scene, robo, { x: 66, y: 0 }, { x: 0, y: 0 }).x, 0);
  parede.enable = false;
  assert.equal(limitarPassoRoboBola(scene, robo, { x: 0, y: 0 }, { x: 500, y: 0 }).x, 500);
});

test("unidades do prólogo permanecem nos limites da arena mesmo com impulsos", () => {
  const { scene, robo } = preparar();
  scene.novoBoss = { config: { arena: { xMin: 0, xMax: 300, yMin: 0, yMax: 300 } } };
  robo.prologoEncontroId = "onda";
  assert.equal(limitarPassoRoboBola(scene, robo, { x: 100, y: 100 }, { x: 1000, y: 100 }).x, 266);
  assert.equal(limitarPassoRoboBola(scene, robo, { x: 100, y: 100 }, { x: -1000, y: 100 }).x, 0);
  delete robo.prologoEncontroId;
  assert.equal(limitarPassoRoboBola(scene, robo, { x: 100, y: 100 }, { x: -1000, y: 100 }).x, -1000);
});

test("correção usa o passo real da física e remove listeners em morte/shutdown", () => {
  const { scene, robo, world } = preparar([{ x: 100, y: -100, width: 5, height: 300 }]);
  protegerColisaoRoboBola(scene, robo);
  Object.assign(robo.body, { x: 500, y: 0, prev: { x: 0, y: 0 } });
  world.emit("worldstep");
  assert.ok(robo.body.x < 66 && robo.body.x > 65);
  assert.deepEqual(robo.body.velocity, { x: 0, y: 0 });
  robo.emit("destroy");
  assert.equal(world.listenerCount("worldstep"), 0);
  assert.equal(scene.events.listenerCount("shutdown"), 0);
});

test("barreira para travessia rápida em ambos os sentidos, sem bloquear trajetos externos", () => {
  const circulo = { x: 0, y: 0, radius: 95 };
  for (const sinal of [-1, 1]) {
    const body = { x: -200 * sinal, y: -10, width: 20, height: 20,
      prev: { x: 200 * sinal, y: -10 }, setVelocity() {}, updateCenter() {} };
    assert.ok(limitarCorpoNaBarreira(body, circulo));
    assert.ok(sinal > 0 ? body.x >= 95 : body.x + body.width <= -95);
  }
  const body = { x: 200, y: 200, width: 20, height: 20,
    prev: { x: -200, y: 200 } };
  assert.equal(limitarCorpoNaBarreira(body, circulo), false);
});

test("escudo acompanha listas substituídas, novos robôs e companheiro; limpeza idempotente", () => {
  const { scene, world } = preparar();
  const objeto = { body: { enable: false } };
  const collider = { destroy() { this.destruido = true; } };
  scene.physics.add = { collider(a) { collider.object1 = a; return collider; } };
  scene.player = { active: true, body: { enable: true } };
  const controle = criarColisaoBarreiraNovoBoss(scene, objeto);
  const robo = { active: true, body: { enable: true } };
  scene.inimigos = [robo]; scene.companionPet = { active: true, body: { enable: true } };
  controle.atualizar();
  assert.deepEqual(collider.object1, [scene.player, scene.companionPet, robo]);
  scene.inimigos = []; controle.atualizar();
  assert.equal(collider.object1.includes(robo), false);
  controle.destruir(); controle.destruir();
  assert.ok(collider.destruido); assert.equal(world.listenerCount("worldstep"), 0);
});
