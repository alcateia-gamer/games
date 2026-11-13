import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { limitarPassoInimigo, protegerColisaoInimigo } from './EnemyCollision.js';
import { criarAreaMapa } from '../map/AreaMapa.js';
import { applyKnockback } from '../combat/CombatEffects.js';

function setup() {
 const world = new EventEmitter(), scene = { events: new EventEmitter(), physics: { world },
  collisionGroup: { getChildren: () => [{body:{x:100,y:0,width:5,height:150}}] } };
 const robo = Object.assign(new EventEmitter(),{active:true,body:{width:40,height:25,enable:true,
  updateCenter(){},setVelocity(x,y){this.velocity={x,y};}}});
 return {world,scene,robo};
}
test('dois corpos varrem paredes finas, saída da borda e impactos longos',()=>{
 for(const [width,height] of [[180*.23,110*.23],[190*.36,100*.36]]) {
  const {scene,robo}=setup();Object.assign(robo.body,{width,height});
  const fim=limitarPassoInimigo(scene,robo,{x:0,y:30},{x:1000,y:30});
  assert.ok(fim.x<=100-width && fim.x>100-width-.03);
  assert.equal(limitarPassoInimigo(scene,robo,{x:100-width,y:30},{x:0,y:30}).x,0);
  robo.playableArea=criarAreaMapa({tileWidth:48,tileHeight:48,layers:[{tilemapLayer:{
   forEachTile(fn){for(let x=0;x<3;x++)for(let y=0;y<3;y++)fn({x,y,index:1});},
   tileToWorldXY(x,y){return {x:x*48,y:y*48};}}}]});
  const borda=limitarPassoInimigo(scene,robo,{x:0,y:30},{x:-1e5,y:30});assert.equal(borda.x,0);
 }
});
test('proteção usa passo físico, não aplica correção contínua e limpa listeners',()=>{
 const {scene,robo,world}=setup();protegerColisaoInimigo(scene,robo);
 Object.assign(robo.body,{x:500,y:20,prev:{x:0,y:20}});world.emit('worldstep');
 assert.ok(robo.body.x<60 && robo.body.x>59.9);
 Object.assign(robo.body.prev,{x:robo.body.x,y:20});world.emit('worldstep');
 assert.ok(robo.body.x<60 && robo.body.x>59.9);
 robo.emit('destroy');assert.equal(world.listenerCount('worldstep'),0);
 assert.equal(scene.events.listenerCount('shutdown'),0);
});
test('golpes consecutivos substituem impulso limitado; morto não recebe mais movimento',()=>{
 globalThis.Phaser={Math:{Angle:{Between:(x,y,a,b)=>Math.atan2(b-y,a-x)}}};
 for(const tipoRobo of ['padrao','serra'])for(const multiplayer of [false,true]) {
  const {scene,robo}=setup();Object.assign(scene,{multiplayer,coopRuntime:multiplayer?{}:null,time:{now:100}});
  Object.assign(robo,{tipoRobo,x:50,y:50});
  for(const attacker of [{x:0,y:50},{x:100,y:50},{x:50,y:0},{x:50,y:100}]) {
   applyKnockback(scene,attacker,robo,1e6,1e6);
   assert.ok(Math.hypot(robo.body.velocity.x,robo.body.velocity.y)<=320.000001);
   assert.equal(robo.combatKnockbackUntil,350);
  }
  robo.morto=true;const before={...robo.body.velocity};applyKnockback(scene,{x:0,y:0},robo);
  assert.deepEqual(robo.body.velocity,before);
 }
});
