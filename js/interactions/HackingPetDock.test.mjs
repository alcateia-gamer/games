import test from 'node:test';
import assert from 'node:assert/strict';
import { prepararPetNoTerminal } from './HackingPetDock.js';

function actor(x, y) {
 const actor = { x, y, active: true, anims: { stop() {}, play() {} }, setVelocity() {}, setDepth() {} };
 actor.body = { moves: true, bottom: y, reset(x,y) { actor.x=x; actor.y=y; this.bottom=y; }, updateFromGameObject() {} };
 return actor;
}
for (const criarPet of [true, false]) test(`hacking mantém operador no lugar e restaura controles (pet=${criarPet})`, () => {
 const player=actor(10,20), pet=actor(0,0);
 const context={player, companionPet:pet, movimentoBloqueado:false, generatorMenuOpen:false};
 const dock=prepararPetNoTerminal({},context,{x:120,y:80},{criarPet, destino:{x:999,y:999}});
 assert.equal(context.movimentoBloqueado,true);
 assert.equal(player.body.moves,false);
 for(let i=0;i<20;i++) {
  dock.atualizar(50);
  assert.deepEqual({x:player.x,y:player.y},{x:10,y:20});
 }
 assert.deepEqual(dock.snapshot().player,{x:10,y:20});
 assert.equal(dock.pronto,true);
 assert.deepEqual({x:pet.x,y:pet.y},criarPet?{x:120,y:104}:{x:0,y:0});
 dock.destruir();dock.destruir();
 assert.equal(player.body.moves,true);
 assert.equal(context.movimentoBloqueado,false);
 assert.equal(context.generatorMenuOpen,false);
});
