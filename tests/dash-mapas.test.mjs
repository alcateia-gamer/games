/** Colisões reais dos dois Tiled: varredura com o StaticBody original do Phaser. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { carregarMapaSpawns } from './spawn-map-fixture.mjs';
import { protegerDashNoMapa } from '../js/player/PlayerMapCollision.js';
import { retanguloLivreDoMapa } from '../js/enemies/EnemyPathfinding.js';

for (const mapa of ['InicioFase1 (1).json', 'parte2-fase1.json']) {
  test(`dash não atravessa os obstáculos de ${mapa}`, () => {
    const { scene, corpos } = carregarMapaSpawns(mapa);
    const world = scene.physics.world;
    const events = new EventEmitter(); world.on = events.on.bind(events); world.off = events.off.bind(events);
    const player = scene.player = Object.assign(new EventEmitter(), { active: true });
    const b = player.body = { width: 30, height: 15, enable: true, prev: {},
      updateCenter() {}, setVelocity() {} };
    scene.estadoDash = { ativo: true };
    protegerDashNoMapa(scene);
    const casos = new Set(); let tentativas = 0;
    for (const parede of corpos) {
      if (!parede.enable) continue;
      for (const horizontal of [true, false]) for (const sentido of [-1, 1]) {
        const offset = 35;
        const inicio = horizontal
          ? { x: sentido > 0 ? parede.x-b.width-offset : parede.x+parede.width+offset, y: parede.y+parede.height/2-b.height/2 }
          : { x: parede.x+parede.width/2-b.width/2, y: sentido > 0 ? parede.y-b.height-offset : parede.y+parede.height+offset };
        if (!retanguloLivreDoMapa(scene, { ...inicio, width: b.width, height: b.height })) continue;
        Object.assign(b.prev, inicio);
        Object.assign(b, horizontal
          ? { x: sentido > 0 ? parede.x+parede.width+offset : parede.x-b.width-offset, y: inicio.y }
          : { x: inicio.x, y: sentido > 0 ? parede.y+parede.height+offset : parede.y-b.height-offset });
        scene.estadoDash.ativo = true; events.emit('worldstep'); tentativas++;
        assert.equal(scene.estadoDash.ativo, false, 'interrompe ao alcançar a primeira colisão do caminho');
        assert.ok(retanguloLivreDoMapa(scene, b), 'o corpo termina fora das colisões');
        casos.add(parede);
      }
    }
    assert.ok(tentativas > 100, 'audita as aproximações por todos os lados livres');
    assert.ok(casos.size > 50, 'cobre paredes, objetos e grades do mapa');
    scene.events.emit('shutdown'); assert.equal(events.listenerCount('worldstep'), 0);
    console.log(`${mapa}: ${casos.size} obstáculos, ${tentativas} trajetos verificados`);
  });
}
