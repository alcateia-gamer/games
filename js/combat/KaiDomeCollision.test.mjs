import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { criarColisaoDomoKai } from './KaiDomeCollision.js';

function contexto() {
  const objeto={x:0,y:0,radius:1,active:true,setVisible(){return this;},
    setPosition(x,y){Object.assign(this,{x,y});return this;},
    setRadius(radius){this.radius=radius;return this;},destroy(){this.active=false;}};
  const collider={active:true,destroy(){this.active=false;}};
  const scene={player:{x:10,y:20,active:true},personagemSelecionada:'kai-mercer',
    time:{now:350},events:new EventEmitter(),inimigos:[],add:{circle:()=>objeto},
    physics:{add:{existing(o){o.body={enable:true,setCircle(r){this.radius=r;},updateFromGameObject(){}};},
      collider(a,b,callback,process){Object.assign(collider,{object1:a,callback,process});return collider;}}}};
  const estado={parryAte:5800,parryEfeito:{escala:1,meta:{limitesEfeito:[0,0,144,94]}}};
  return {scene,estado,objeto,collider};
}
function robo(x=100,y=20) {
  return {active:true,vida:100,body:{enable:true,x,y,width:20,height:20,
    setVelocity(x,y){this.velocity={x,y};}}};
}

test('corpo acompanha a área do domo, sua abertura e inimigos criados depois',()=>{
  const {scene,estado,objeto,collider}=contexto();
  const domo=criarColisaoDomoKai(scene,estado,72,5800);
  scene.time.now=175;domo.atualizar(10,46);
  assert.equal(domo.corpo.radius,36);assert.equal(domo.corpo.enable,true);
  scene.inimigos=[robo()];scene.time.now=350;domo.atualizar(50,80);
  assert.equal(objeto.x,50);assert.equal(objeto.y,80);assert.equal(domo.corpo.radius,72);
  assert.equal(collider.object1,scene.inimigos);
  domo.destruir();assert.equal(objeto.active,false);assert.equal(collider.active,false);
  assert.equal(scene.events.listenerCount('preupdate'),0);
});

test('contato repele sem dano, conserva outros stuns e não reaplica a cada frame',()=>{
  const {scene,estado,collider}=contexto(),inimigo=robo();
  const domo=criarColisaoDomoKai(scene,estado,72,5800);domo.atualizar(10,30);
  inimigo.especialAtordoadoAte=2000;
  assert.equal(collider.process(inimigo),true);collider.callback(inimigo);
  assert.deepEqual(inimigo.body.velocity,{x:280,y:0});assert.equal(inimigo.vida,100);
  assert.equal(inimigo.especialEmpurraoAte,530);assert.equal(inimigo.especialAtordoadoAte,2000);
  scene.time.now=400;collider.callback(inimigo);assert.equal(inimigo.especialEmpurraoAte,530);
  scene.time.now=540;collider.callback(inimigo);assert.equal(inimigo.especialEmpurraoAte,720);
  for(const alteracao of [{morto:true},{remoteOnly:true},{active:false},{body:{enable:false}}]) {
    assert.equal(Boolean(collider.process({...robo(),...alteracao})),false);
  }
  domo.destruir();
});

test('expiração, morte e multiplayer removem colisão e listener',()=>{
  for(const encerrar of [s=>s.time.now=5800,s=>s.morteEmAndamento=true,s=>s.multiplayer=true]) {
    const {scene,estado,objeto,collider}=contexto();
    const domo=criarColisaoDomoKai(scene,estado,72,5800);
    encerrar(scene);scene.events.emit('preupdate');
    assert.equal(objeto.active,false);assert.equal(collider.active,false);
    assert.equal(scene.events.listenerCount('preupdate'),0);
    domo.destruir();
  }
});

test('inimigo já no centro é colocado fora da borda e repelido sem dano',()=>{
  const {scene,estado,collider}=contexto(),inimigo=robo(0,20);
  const domo=criarColisaoDomoKai(scene,estado,72,5800);domo.atualizar(10,30);
  assert.equal(collider.process(inimigo),false,'A separação interna já foi resolvida.');
  assert.ok(inimigo.body.x>=82);assert.equal(inimigo.body.velocity.x,280);
  assert.equal(inimigo.vida,100);domo.destruir();
});
