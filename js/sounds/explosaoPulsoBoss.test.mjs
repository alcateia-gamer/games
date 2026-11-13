import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { carregarSomExplosaoPulsoBoss, tocarSomExplosaoPulsoBoss } from "./explosaoPulsoBoss.js";
import { criarPulsoRepulsao } from "../enemies/novoBoss/ataques/PulsoRepulsao.js";

test("explosão de vento a 55% coincide com animação, sem repetir durante a cauda",()=>{
  carregarSomExplosaoPulsoBoss({audio(key,path){
    assert.equal(key,"boss-explosao-pulso");
    assert.ok(existsSync(new URL(`../../assets/${path}`,import.meta.url)));
  }});
  const sons=[],visuais=[];
  const scene={events:new EventEmitter(),cache:{audio:{exists:()=>true,get:()=>({duration:3})}},
    sound:{add(){
      const som=Object.assign(new EventEmitter(),{
        play(config){this.config=config;return true;},stop(){this.parado=true;},destroy(){this.destruido=true;}});
      sons.push(som);return som;
    }}};
  const criar=()=>criarPulsoRepulsao({}, {x:10,y:20}, {avisoMs:900}, {
    somExplosaoPulso:(origem,idade)=>tocarSomExplosaoPulsoBoss(scene,origem,idade),
    criarExplosaoPulso:(origem,raio,idade)=>visuais.push({origem,raio,idade}),
  });
  const ataque=criar();
  ataque.atualizar(899);assert.equal(sons.length,0);
  ataque.atualizar(1);
  assert.equal(visuais.length,1);
  assert.equal(visuais[0].idade,0);
  assert.deepEqual(sons[0].config,{volume:0.55,loop:false,rate:1,detune:-200,seek:0});
  ataque.atualizar(20);ataque.atualizar(20);
  assert.equal(sons.length,1);
  const atrasado=criar();atrasado.atualizar(1000);
  assert.equal(visuais[1].idade,100);
  assert.equal(sons[1].config.seek,0.1*2**(-200/1200));
  const cancelado=criar();cancelado.destruir();cancelado.atualizar(1000);
  assert.equal(sons.length,2);
  sons[0].emit("complete");assert.equal(sons[0].destruido,true);
  scene.events.emit("shutdown");assert.ok(sons.every(s=>s.destruido));
});
