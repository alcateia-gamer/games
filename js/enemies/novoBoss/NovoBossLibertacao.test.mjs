import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {prepararLibertacaoNovoBoss} from './NovoBossLibertacao.js';
import {capturarJogadorNovoBoss,jogadorPresoNovoBoss} from '../../player/PlayerControlEffects.js';

test('botão e mouse contam um aperto por soltura; movimento, trocar arma e botão direito não contam',()=>{
  const scene={input:new EventEmitter(),events:new EventEmitter(),game:{events:new EventEmitter()},
    player:{active:true,setVelocity(){}},vida:100,botaoAtaque:{},iconeAtaque:{},time:{now:1000}};
  const encontro={jogadorNaArena:true};scene.novoBoss=encontro;
  const s=prepararLibertacaoNovoBoss(scene,encontro);
  capturarJogadorNovoBoss(scene,'a',2500,null,{apertos:8});
  const mouse={id:1,leftButtonDown:()=>true};
  scene.input.emit('pointerdown',mouse,[]);scene.input.emit('pointerdown',mouse,[]);
  assert.equal(scene.restricaoControleNovoBoss.apertos,1);
  scene.input.emit('pointerup',mouse);
  scene.input.emit('pointerdown',{id:2,wasTouch:true},[]);
  scene.input.emit('pointerdown',{id:3,wasTouch:true},[{}]);
  scene.input.emit('pointerdown',{id:4,leftButtonDown:()=>false},[]);
  assert.equal(scene.restricaoControleNovoBoss.apertos,1);
  for(let i=0;i<7;i++){
    scene.input.emit('pointerdown',mouse,[scene.botaoAtaque]);scene.input.emit('pointerup',mouse);
  }
  assert.equal(jogadorPresoNovoBoss(scene),false);
  s.destruir();assert.equal(scene.input.listenerCount('pointerdown'),0);
  assert.equal(scene.events.listenerCount('pause'),0);
});
