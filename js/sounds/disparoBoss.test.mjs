import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { carregarSomDisparoBoss, tocarSomDisparoBoss } from "./disparoBoss.js";

test("boss usa laser comum com volume aumentado em 40%, limita vozes e mantém sincronia",()=>{
  carregarSomDisparoBoss({audio(key,path){
    assert.equal(key,"boss-disparo-laser");
    assert.equal(path,"sounds.mp3/tiro_laser.mp3");
    assert.ok(existsSync(new URL(`../../assets/${path}`,import.meta.url)));
  }});
  const sons=[],canal=new Float32Array(1000);canal[50]=1;
  const buffer={duration:1,numberOfChannels:1,length:1000,sampleRate:1000,getChannelData:()=>canal};
  const scene={time:{now:0},events:new EventEmitter(),cache:{audio:{exists:()=>true,get:()=>buffer}},
    sound:{add(){
      const som=Object.assign(new EventEmitter(),{active:true,
        addMarker(marker){this.marker=marker;},play(marker,config){this.config=config;return true;},
        stop(){this.active=false;},destroy(){this.active=false;}});
      sons.push(som);return som;
    }}};
  const origem={x:10,y:20};
  tocarSomDisparoBoss(scene,origem);
  assert.deepEqual(sons[0].marker,{name:"disparo-curto",start:0.047,duration:0.12});
  assert.deepEqual(sons[0].config,{volume:0.021,loop:false,rate:1,detune:0,seek:0});
  tocarSomDisparoBoss(scene,origem);assert.equal(sons.length,1,"anel simultâneo não multiplica volume");
  scene.time.now=100;tocarSomDisparoBoss(scene,origem,50);
  assert.equal(sons[1].config.seek,0.05);
  scene.time.now=200;tocarSomDisparoBoss(scene,origem);
  assert.equal(sons.filter(s=>s.active).length,2);
  tocarSomDisparoBoss(scene,origem,200);assert.equal(sons.length,3,"disparo vencido não toca depois");
  sons.at(-1).emit("complete");assert.equal(sons.at(-1).active,false);
  scene.events.emit("shutdown");assert.ok(sons.every(s=>!s.active));
});
