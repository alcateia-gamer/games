import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { protegerDashNoMapa } from './PlayerMapCollision.js';

function preparar(obstaculos = [{ x: 100, y: -100, width: 2, height: 250 }]) {
  const world = new EventEmitter(), player = Object.assign(new EventEmitter(), { active: true });
  const scene = { player, events: new EventEmitter(), physics: { world },
    estadoDash: { ativo: true }, colliderPlayerMapa: { active: true },
    collisionGroup: { getChildren: () => obstaculos.map(body => ({ body })) } };
  player.body = { x: 200, y: 0, width: 30, height: 15, enable: true,
    prev: { x: 0, y: 0 }, velocity: { x: 760, y: 0 },
    updateCenter() {}, setVelocity(x, y) { Object.assign(this.velocity, { x, y }); } };
  protegerDashNoMapa(scene);
  return { scene, player, world };
}

test('dash varre o corpo completo contra paredes e grades finas em todos os sentidos', () => {
  for (const horizontal of [true, false]) for (const sentido of [-1, 1]) {
    const parede = horizontal ? { x: 100, y: -100, width: 2, height: 250 }
      : { x: -100, y: 100, width: 250, height: 2 };
    const { scene, player, world } = preparar([parede]); const b = player.body;
    b.prev = horizontal ? { x: sentido > 0 ? 0 : 200, y: 0 } : { x: 0, y: sentido > 0 ? 0 : 200 };
    Object.assign(b, horizontal ? { x: sentido > 0 ? 200 : 0, y: 0 } : { x: 0, y: sentido > 0 ? 200 : 0 });
    world.emit('worldstep');
    const eixo = horizontal ? 'x' : 'y', tamanho = horizontal ? b.width : b.height;
    assert.ok(sentido > 0 ? b[eixo] + tamanho <= 100 : b[eixo] >= 102);
    assert.equal(scene.estadoDash.ativo, false);
    assert.deepEqual(b.velocity, { x: 0, y: 0 });
  }
});

test('dash diagonal não corta a quina; afastar-se da parede continua permitido', () => {
  const { scene, player, world } = preparar([{ x: 100, y: 100, width: 5, height: 100 }]);
  const b = player.body; b.y = 200;
  world.emit('worldstep');
  assert.ok(b.x + b.width <= 100 || b.y + b.height <= 100);
  Object.assign(b, { x: 0, y: 0, prev: { x: 70, y: 100 } });
  scene.estadoDash.ativo = true; world.emit('worldstep');
  assert.equal(b.x, 0); assert.equal(b.y, 0); assert.equal(scene.estadoDash.ativo, true);
});

test('grade aberta, caminhada e noclip DEV mantêm seus comportamentos', () => {
  for (const liberar of [s => s.estadoDash.ativo = false,
    s => s.colliderPlayerMapa.active = false,
    s => { s.developerMode = true; s.teclaEspaco = { isDown: true }; },
    s => s.collisionGroup = { getChildren: () => [{ body: { x: 100, y: -100, width: 2, height: 250, enable: false } }] },
  ]) {
    const { scene, player, world } = preparar(); liberar(scene); world.emit('worldstep');
    assert.equal(player.body.x, 200);
  }
});

test('reiniciar ou destruir o jogador remove a proteção antiga sem acumular listeners', () => {
  const { scene, player, world } = preparar();
  protegerDashNoMapa(scene); assert.equal(world.listenerCount('worldstep'), 1);
  player.emit('destroy'); assert.equal(world.listenerCount('worldstep'), 0);
  assert.equal(scene.events.listenerCount('shutdown'), 0);
  protegerDashNoMapa(scene); scene.events.emit('shutdown');
  assert.equal(world.listenerCount('worldstep'), 0);
  assert.equal(player.listenerCount('destroy'), 0);
});
