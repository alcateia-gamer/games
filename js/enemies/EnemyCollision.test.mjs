import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { limitarPassoInimigo, protegerColisaoInimigo } from './EnemyCollision.js';
import { criarAreaMapa } from '../map/AreaMapa.js';
import { applySquash, applyKnockback } from '../combat/CombatEffects.js';

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

// Reproduz alterações anteriores ao worldstep: preUpdate e separação entre entidades.
test('varre desde o nascimento mesmo com prev dentro ou depois da parede no primeiro passo', () => {
 for (const prevX of [80, 200]) {
  const {scene, robo, world} = setup();
  Object.assign(robo.body, {x:0,y:20,prev:{x:0,y:20}});
  protegerColisaoInimigo(scene, robo);
  robo.body.prev.x = prevX; robo.body.x = 500;
  world.emit('worldstep');
  assert.ok(robo.body.x <= 60 && robo.body.x > 59.9);
  // Novo empurrão não pode tornar válida uma origem do outro lado.
  robo.body.prev.x = 300; robo.body.x = 600;
  world.emit('worldstep'); assert.ok(robo.body.x <= 60);
 }
});

test('passos diagonais longos, cantos e dois robôs empurrados preservam os pés livres', () => {
 for (const delta of [16,34,250,1000]) {
  const {scene,robo,world} = setup();
  const canto = [{body:{x:100,y:-100,width:2,height:300}},
   {body:{x:-100,y:100,width:300,height:2}}];
  scene.collisionGroup.getChildren = () => canto;
  const segundo = setup().robo;
  for (const r of [robo,segundo]) {
   Object.assign(r.body,{x:0,y:20,prev:{x:0,y:20}});
   protegerColisaoInimigo(scene,r);
  }
  for (let i=0;i<20;i++) {
   for (const r of [robo,segundo]) {
    r.body.prev = {x:r.body.x,y:r.body.y};
    r.body.x += 320 * delta/1000; r.body.y += 320 * delta/1000;
   }
   world.emit('worldstep');
   for (const r of [robo,segundo]) {
    assert.ok(r.body.x + r.body.width <= 100);
    assert.ok(r.body.y + r.body.height <= 100);
   }
  }
 }
});

test('squash durante a física preserva posição e dimensões dos pés antes de sincronizar o sprite', () => {
 let tween;
 const enemy = {active:true,x:0,y:0,scaleX:1,scaleY:1,displayOriginX:50,displayOriginY:50,
  setScale(x,y){this.scaleX=x;this.scaleY=y;},
  scene:{tweens:{killTweensOf(){},add(config){tween=config;}}}};
 enemy.body = {x:70,y:80,sourceWidth:40,sourceHeight:25,offset:{x:30,y:70},
  setSize(w,h){this.sourceWidth=w;this.sourceHeight=h;},
  setOffset(x,y){this.offset={x,y};},updateCenter(){},
  updateFromGameObject(){
   this.x=enemy.x+enemy.scaleX*(this.offset.x-enemy.displayOriginX);
   this.y=enemy.y+enemy.scaleY*(this.offset.y-enemy.displayOriginY);
   this.width=this.sourceWidth*enemy.scaleX;this.height=this.sourceHeight*enemy.scaleY;
  }};
 applySquash(enemy);
 assert.equal(enemy.body.x,70);assert.equal(enemy.body.y,80);
 assert.ok(Math.abs(enemy.body.width-40)<1e-8);assert.ok(Math.abs(enemy.body.height-25)<1e-8);
 enemy.body.x=90;enemy.body.y=95;
 enemy.setScale(1,1);tween.onUpdate();
 assert.equal(enemy.body.x,90);assert.equal(enemy.body.y,95);
 assert.equal(enemy.body.width,40);assert.equal(enemy.body.height,25);
});

test('réplica remota não recebe uma segunda simulação de colisão', () => {
 const {scene,robo,world}=setup();
 Object.assign(robo.body,{x:0,y:20,prev:{x:0,y:20}});
 protegerColisaoInimigo(scene,robo);robo.remoteOnly=true;
 robo.body.x=500;world.emit('worldstep');assert.equal(robo.body.x,500);
});


test('pares varridos não trocam de lado; fila propaga bloqueio sem prender quem se afasta', () => {
 for (const inverter of [false,true]) for(const fila of [false,true]) {
  const {scene,world}=setup();
  scene.collisionGroup.getChildren=()=>fila?[{body:{x:200,y:0,width:2,height:200}}]:[];
  const robos=(fila?[0,60,120]:[0,200]).map(x=>{
   const r=setup().robo;Object.assign(r.body,{x,y:20,width:40,height:25,prev:{x,y:20}});return r;
  });
  scene.enemySpawnManager={enemyGroup:{contains:r=>robos.includes(r)}};
  for(const r of inverter?[...robos].reverse():robos)protegerColisaoInimigo(scene,r);
  assert.equal(world.listenerCount('worldstep'),1,'uma validação compartilhada por etapa física');
  for(let passo=0;passo<5;passo++) {
   for(const [i,r] of robos.entries())r.body.x+=(fila || i===0)?320:-320;
   world.emit('worldstep');
   for(let i=1;i<robos.length;i++)assert.ok(robos[i-1].body.x+40 <= robos[i].body.x+1e-7);
   if(fila)assert.ok(robos.at(-1).body.x+40<=200);
  }
  if(fila)assert.ok(robos.at(-1).body.x>159.9,'líder alcança a parede sem ser parado pelo seguidor');
  for(const r of robos)r.emit('destroy');assert.equal(world.listenerCount('worldstep'),0);
 }
});
