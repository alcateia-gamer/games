import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { prepararReanimacaoSolo, atualizarReanimacaoSolo, SOLO_PET_REVIVAL } from './SoloPetRevival.js';
import { reiniciarResgatesSolo, resgatesSoloUsados, SOLO_PET_REVIVALS_KEY } from './SoloRunState.js';

function fixture(personagem = 'kai-mercer', registry = new Map()) {
  if (registry instanceof Map) registry.set = Map.prototype.set.bind(registry);
  const objetos = [], timers = [], animacoes = new Map();
  function visual(x=0,y=0) {
    const v = { x,y,active:true,scaleX:1,scaleY:1,alpha:1,destruicoes:0,
      setPosition(x,y){Object.assign(this,{x,y});return this;},
      setScale(x,y=x){this.scaleX=x;this.scaleY=y;return this;},
      setOrigin(x,y){this.originX=x;this.originY=y;return this;},
      setDisplayOrigin(){return this;},
      setTexture(key,frame){this.texture={key};this.frame=frame;return this;},
      setText(text){this.text=text;return this;},setName(name){this.name=name;return this;},
      setDepth(){return this;},setRotation(){return this;},setAlpha(){return this;},clearTint(){return this;},
      setVelocity(x,y){this.body.velocity={x,y};return this;},
      clear(){return this;},lineStyle(){return this;},lineBetween(){return this;},fillStyle(){return this;},fillCircle(){return this;},
      destroy(){this.active=false;this.destruicoes++;},
    };
    v.body={enable:true,velocity:{x:0,y:0},setSize(width,height){Object.assign(this,{width,height});},
      setOffset(x,y){this.offset={x,y};},updateFromGameObject(){},reset(x,y){v.setPosition(x,y);}};
    v.anims={timeScale:1,stop(){},play(key){v.animacao=key;}};
    objetos.push(v);return v;
  }
  const scene={ registry, personagemSelecionada:personagem, player:visual(210,-320), companionPet:visual(160,-300),
    vida:0,vidaMaxima:100,estamina:31,estaminaMaxima:100,respawnX:1000,respawnY:2000,
    events:new EventEmitter(),input:{enabled:true,keyboard:{enabled:true,resetKeys(){}}},
    physics:{world:{isPaused:false},pause(){this.world.isPaused=true;},resume(){this.world.isPaused=false;}},
    tweens:{killTweensOf(){}},
    anims:{exists:key=>animacoes.has(key),create(data){animacoes.set(data.key,data);},generateFrameNumbers:()=>[0,1,2,3,4,5]},
    add:{text:(x,y,text)=>visual(x,y).setText(text),graphics:()=>visual()},
    time:{now:0,delayedCall(ms,callback){const t={ms,callback,removed:false,remove(){this.removed=true;}};timers.push(t);return t;}},
    inventory:{getSlots:()=>[{itemId:'fuel'}]},
    estadoDash:{ativo:true},restricaoControleNovoBoss:{apertosNecessarios:8},
    atacando:true,attackBufferedUntil:999,ariaAtaqueCarregando:true,
  };
  const sistema=prepararReanimacaoSolo(scene);
  let gameovers=0;
  const morrer=()=>sistema.iniciar(()=>{gameovers++;scene.telaMorteMostrada=true;scene.physics.pause();});
  const avancar=ms=>{for(let t=0;t<ms;t+=50){scene.time.now+=Math.min(50,ms-t);atualizarReanimacaoSolo(scene,Math.min(50,ms-t));}};
  return {scene,sistema,morrer,avancar,objetos,timers,animacoes,get gameovers(){return gameovers;}};
}

test('quatro personagens caem, pet se aproxima e reanima no local sem reiniciar recursos',()=>{
  for(const personagem of ['kai-mercer','magnus-force','aria-kade','nyx']){
    const f=fixture(personagem),s=f.scene;
    s.add.graphics=()=>{throw new Error('resgate não deve criar feixes ou partículas');};
    assert.ok(f.morrer());
    assert.equal(s.player.animacao,`coop-down-${personagem}`);
    assert.equal(sistemaEstado(f),'caindo');
    assert.equal(s.player.body.enable,false);assert.equal(s.physics.world.isPaused,false);
    assert.equal(s.companionPet.body.enable,false);assert.equal(f.sistema.resgatando,true);
    assert.equal(s.player.invulneravel,true);
    assert.equal(s.input.enabled,false);assert.equal(s.estadoDash.ativo,false);
    assert.equal(s.restricaoControleNovoBoss,null);
    f.avancar(700);assert.equal(f.gameovers,0);assert.equal(s.vida,0);
    f.avancar(100);assert.equal(sistemaEstado(f),'aproximando');
    f.avancar(500);assert.ok(s.companionPet.x>160);
    f.avancar(2600);
    assert.equal(sistemaEstado(f),'pronto');assert.equal(f.sistema.restantes,1);
    assert.equal(s.morteEmAndamento,false);assert.equal(s.player.morto,false);
    assert.deepEqual([s.player.x,s.player.y],[210,-320]);
    assert.equal(s.vida,100);assert.equal(s.estamina,31);
    assert.equal(s.player.body.enable,true);assert.equal(s.physics.world.isPaused,false);
    assert.equal(s.companionPet.body.enable,true);assert.equal(f.sistema.resgatando,false);
    assert.equal(s.input.enabled,true);assert.equal(s.input.keyboard.enabled,true);
    assert.equal(s.player.invulneravel,true);assert.equal(f.gameovers,0);
    assert.deepEqual(s.inventory.getSlots(),[{itemId:'fuel'}]);
    assert.ok(f.objetos.filter(v=>v.name?.startsWith('solo-pet-revive')).every(v=>v.destruicoes===1));
    assert.equal(f.timers.at(-1).ms,SOLO_PET_REVIVAL.protecaoMs);
    f.timers.at(-1).callback();assert.equal(s.player.invulneravel,false);
  }
});
function sistemaEstado(f){return f.sistema.snapshot().fase;}

test('exatamente duas revividas; a terceira queda abre game over uma única vez',()=>{
  const f=fixture();
  for(let i=0;i<2;i++){
    assert.ok(f.morrer());assert.equal(f.morrer(),false);
    f.avancar(4000);assert.equal(f.gameovers,0);assert.equal(f.sistema.restantes,1-i);
  }
  f.scene.vida=0;assert.ok(f.morrer());f.avancar(700);assert.equal(f.gameovers,0);
  assert.equal(f.sistema.resgatando,false);
  f.avancar(50);assert.equal(f.gameovers,1);assert.equal(f.sistema.snapshot().fase,'derrotado');
  assert.equal(f.scene.physics.world.isPaused,true);
  f.avancar(10000);assert.equal(f.gameovers,1);assert.equal(f.morrer(),false);
  assert.equal(resgatesSoloUsados(f.scene.registry),2);
});

test('contador atravessa troca de mapas; somente nova partida recupera os dois resgates',()=>{
  const registry=new Map(),a=fixture('kai-mercer',registry);
  a.morrer();a.avancar(4000);a.scene.events.emit('shutdown');
  const b=fixture('kai-mercer',registry);
  assert.equal(b.sistema.restantes,1);b.morrer();b.avancar(4000);assert.equal(b.sistema.restantes,0);
  assert.equal(registry.get(SOLO_PET_REVIVALS_KEY),2);
  reiniciarResgatesSolo(registry);
  const c=fixture('kai-mercer',registry);assert.equal(c.sistema.restantes,2);
});

test('encerrar durante o resgate remove efeitos e callbacks sem consumir uso ou reviver depois',()=>{
  const f=fixture();f.morrer();f.avancar(1800);
  f.scene.events.emit('shutdown');f.sistema.destruir();f.avancar(9000);
  assert.equal(f.gameovers,0);assert.equal(resgatesSoloUsados(f.scene.registry),0);
  assert.equal(f.scene.reanimacaoSolo,null);assert.equal(f.scene.input.enabled,true);
  assert.equal(f.scene.companionPet.body.enable,true);
  assert.equal(f.scene.events.listenerCount('shutdown'),0);
  assert.ok(f.objetos.filter(v=>v.name?.startsWith('solo-pet-revive')).every(v=>v.destruicoes===1));
  assert.equal(f.sistema.iniciar(()=>{}),false);
});

test('multiplayer não prepara resgate solo nem altera seu contador ou lógica de queda',()=>{
  for(const modo of [{multiplayer:true},{coopRuntime:{}}]){
    const f=fixture();f.sistema.destruir();Object.assign(f.scene,modo);
    assert.equal(prepararReanimacaoSolo(f.scene),null);
    assert.equal(atualizarReanimacaoSolo(f.scene,10000),false);
    assert.equal(f.scene.registry.has(SOLO_PET_REVIVALS_KEY),false);
  }
});

test('sem pet o personagem ainda cai antes da derrota e nenhum uso é consumido',()=>{
  const f=fixture();f.scene.companionPet.active=false;f.morrer();
  f.avancar(700);assert.equal(f.gameovers,0);f.avancar(50);assert.equal(f.gameovers,1);
  assert.equal(resgatesSoloUsados(f.scene.registry),0);
});

test('deltas inválidos e chamadas repetidas não avançam ou duplicam o resgate',()=>{
  const f=fixture();assert.equal(prepararReanimacaoSolo(f.scene),f.sistema);
  f.morrer();for(const delta of [NaN,Infinity,-1,undefined])assert.ok(f.sistema.atualizar(delta));
  assert.equal(f.sistema.snapshot().tempo,0);assert.equal(f.morrer(),false);
  f.sistema.atualizar(100000);assert.equal(f.sistema.snapshot().fase,'caindo');
  f.avancar(4000);assert.equal(f.sistema.restantes,1);
});

test('limpeza encerra a proteção temporária sem deixar invulnerabilidade permanente',()=>{
  const f=fixture();f.morrer();f.avancar(4000);
  assert.equal(f.scene.player.invulneravel,true);
  const timer=f.timers.at(-1);
  f.sistema.destruir();
  assert.equal(timer.removed,true);assert.equal(f.scene.player.invulneravel,false);
});
