import test from 'node:test';
import {atualizarHudNovoBoss} from './NovoBossHud.js';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {prepararLibertacaoNovoBoss,criarEntradaLibertacaoAtaque} from './NovoBossLibertacao.js';
import {capturarJogadorNovoBoss,jogadorPresoNovoBoss} from '../../player/PlayerControlEffects.js';

test('somente botão conta por pressionamento; cenário e outros dedos não contam',()=>{
  const scene={input:new EventEmitter(),events:new EventEmitter(),game:{events:new EventEmitter()},
    player:{active:true,setVelocity(){}},vida:100,botaoAtaque:{},iconeAtaque:{},time:{now:1000}};
  const encontro={jogadorNaArena:true};scene.novoBoss=encontro;
  const s=prepararLibertacaoNovoBoss(scene,encontro);
  const entrada=criarEntradaLibertacaoAtaque(scene);
  capturarJogadorNovoBoss(scene,'a',2500,null,{apertos:8});
  const mouse={id:1,leftButtonDown:()=>true};
  scene.input.emit('pointerdown',mouse,[]);scene.input.emit('pointerdown',mouse,[]);
  assert.equal(scene.restricaoControleNovoBoss.apertos,0);
  scene.input.emit('pointerup',mouse);
  scene.input.emit('pointerdown',{id:2,wasTouch:true},[]);
  scene.input.emit('pointerdown',{id:3,wasTouch:true},[{}]);
  scene.input.emit('pointerdown',{id:4,leftButtonDown:()=>false},[]);
  entrada.pressionar(mouse);entrada.pressionar(mouse);
  assert.equal(scene.restricaoControleNovoBoss.apertos,1);
  scene.input.emit("pointerup",mouse);
  for(let i=0;i<7;i++){
    entrada.pressionar(mouse);scene.input.emit('pointerup',mouse);
  }
  assert.equal(jogadorPresoNovoBoss(scene),false);
  entrada.destruir();s.destruir();assert.equal(scene.input.listenerCount('pointerdown'),0);
  assert.equal(scene.events.listenerCount('pause'),0);
});


test('host e cliente compartilham deduplicação e cancelamento sem cliques globais',()=>{
 for(const host of [true,false]) {
  let requests=0;
  const scene={input:new EventEmitter(),events:new EventEmitter(),game:{events:new EventEmitter()},
   vida:100,restricaoControleNovoBoss:{apertosNecessarios:8},coopRuntime:{escape(){requests++;}}};
  const e=criarEntradaLibertacaoAtaque(scene),p={id:2,wasTouch:true};
  scene.input.emit('pointerdown',p,[]);assert.equal(requests,0);
  e.pressionar(p);e.pressionar(p);e.pressionar({id:3,wasTouch:true});assert.equal(requests,1);
  scene.input.emit('pointerup',{id:3});e.pressionar(p);assert.equal(requests,1);
  scene.input.emit('pointerupoutside',p);e.pressionar(p);assert.equal(requests,2);
  scene.game.events.emit('blur');e.pressionar(p);assert.equal(requests,3);
  scene.events.emit('boss:released');scene.restricaoControleNovoBoss=null;
  scene.input.emit("pointerup",p);assert.equal(e.pressionar(p),false);e.destruir();assert.equal(scene.input.listenerCount('pointerup'),0);
 }
});


test('HUD do host usa captura local em vez da restrição vazia do contexto geral do boss',()=>{
 const visual=()=>({setPosition(){return this;},setScale(){return this;},setVisible(){return this;},
  setSize(){return this;},setFillStyle(){return this;},setText(t){this.text=t;return this;}});
 const scene={cameras:{main:{width:800,height:450,originX:.5,originY:.5}},
  restricaoControleNovoBoss:null,coopRuntime:{localContext:{restricaoControleNovoBoss:{apertos:3,apertosNecessarios:8}}}};
 const encontro={sprite:{},jogadorNaArena:true,estado:'posicionada',vida:100,vidaMaxima:100,geradores:[],
  hud:{container:visual(),preenchimento:visual(),textoVida:visual(),textoEstado:visual()}};
 atualizarHudNovoBoss(scene,encontro);assert.ok(encontro.hud.textoEstado.text.includes('3/8'));
 scene.coopRuntime.localContext.restricaoControleNovoBoss=null;
 atualizarHudNovoBoss(scene,encontro);assert.ok(!encontro.hud.textoEstado.text.includes('AGARRADO'));
});
