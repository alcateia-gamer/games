import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { carregarSomTeleporteBoss } from "./teleporteBoss.js";
import { iniciarTeleporteNovoBoss } from "../enemies/novoBoss/NovoBossTeleporte.js";
import { novoBossConfig } from "../enemies/novoBoss/NovoBossConfig.js";

test("teleporte inicia um som a 15% junto à viagem e usa só os primeiros 1,7s",()=>{
  carregarSomTeleporteBoss({audio(key,path){
    assert.equal(key,"boss-teleporte");
    assert.ok(existsSync(new URL(`../../assets/${path}`,import.meta.url)));
  }});
  const sons=[],ordem=[];
  const scene={player:{x:0,y:0},events:new EventEmitter(),
    cache:{audio:{exists:()=>true}},sound:{add(key){
      const som=Object.assign(new EventEmitter(),{key,
        addMarker(marker){this.marker=marker;},
        play(marker,config){this.tocado=marker;this.config=config;ordem.push("audio");return true;},
        stop(){this.parado=true;},destroy(){this.destruido=true;}});
      sons.push(som);return som;
    }}};
  scene.events.on("novo-boss:teleporte-iniciado",()=>ordem.push("teleporte"));
  const encontro={config:novoBossConfig,sprite:{x:-1080,y:-5810,body:{enable:true},setAlpha(){}}};
  assert.equal(iniciarTeleporteNovoBoss(scene,encontro,"teste",{destino:{x:-1400,y:-5810}}),true);
  assert.deepEqual(ordem,["audio","teleporte"]);
  assert.equal(sons.length,1);
  assert.deepEqual(sons[0].marker,{name:"inicio-teleporte",start:0,duration:1.7});
  assert.deepEqual(sons[0].config,{volume:0.15,loop:false,rate:1,detune:0,seek:0});
  assert.equal(iniciarTeleporteNovoBoss(scene,encontro,"duplicado"),false);
  assert.equal(sons.length,1);
  sons[0].emit("complete");
  assert.equal(sons[0].destruido,true);
  assert.equal(scene.events.listenerCount("shutdown"),0);
  encontro.teleporte=null;
  assert.equal(iniciarTeleporteNovoBoss(scene,encontro,"invalido",{destino:{x:0,y:0}}),false);
  assert.equal(sons.length,1,"destino recusado não toca som");
});
