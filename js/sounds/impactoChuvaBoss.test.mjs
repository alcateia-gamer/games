import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { carregarSomImpactoChuvaBoss, tocarSomImpactoChuvaBoss } from "./impactoChuvaBoss.js";

test("novo som de explosão a 40% mantém tom e velocidade originais, fase e limite de vozes",()=>{
  carregarSomImpactoChuvaBoss({audio(key,path){
    assert.equal(key,"boss-impacto-chuva");
    assert.equal(path,"sounds.mp3/SONS PARA BOTAR AINDA/EXPLOSAO_BOSS.mp3");
    assert.ok(existsSync(new URL(`../../assets/${path}`,import.meta.url)));
  }});
  const sons=[];
  const scene={events:new EventEmitter(),cache:{audio:{exists:()=>true,get:()=>({duration:2})}},
    sound:{add(key){
      const som=Object.assign(new EventEmitter(),{key,active:true,
        play(config){this.config=config;return true;},stop(){this.active=false;},
        destroy(){this.active=false;}});
      sons.push(som);return som;
    }}};
  tocarSomImpactoChuvaBoss(scene,{x:0,y:0},250);
  assert.deepEqual(sons[0].config,{volume:0.4,loop:false,rate:1,detune:0,seek:0.25});
  tocarSomImpactoChuvaBoss(scene,{x:0,y:0},2500);
  assert.equal(sons.length,1,'som já vencido não toca atrasado');
  for(let i=0;i<15;i++)tocarSomImpactoChuvaBoss(scene,{x:i*10,y:0});
  assert.equal(sons.filter(s=>s.active).length,4,'rajada não acumula quinze vozes');
  sons.at(-1).emit('complete');
  assert.equal(sons.filter(s=>s.active).length,3);
  assert.equal(scene.events.listenerCount('shutdown'),1);
  scene.events.emit('shutdown');
  assert.ok(sons.every(s=>!s.active));
});
