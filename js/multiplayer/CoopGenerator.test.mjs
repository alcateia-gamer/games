import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Inventory } from '../inventory/Inventory.js';
import { CoopGenerator } from './CoopGenerator.js';
import { mergeCoopProgress } from './CoopProtocol.js';
function fixture() {
  const queue=[],peers=[];
  for(const [id,host] of [['host',true],['guest',false]]) {
    const scene={game:{registry:new Map()},events:new EventEmitter(),vida:100,
      inventory:new Inventory({slots:[],collectedItemIds:[]}),
      player:{active:true,x:20,y:20},
      map:{objects:[{name:'Interacoes',objects:[{name:'gerador01',x:0,y:0,width:40,height:40}]}]}};
    const manager={playerId:id,room:{coopProgress:{flags:{},collected:{}}},publishState(){},
      sendCoopAction(kind,payload={},options={}) { queue.push(structuredClone({playerId:id,kind,payload,...options}));return true; }};
    const world={scene,manager,r:{host,mapKey:'Level1Parte2',players:{remotes:new Map()}},
      applyFlags(flags){scene.luzFabricaAcesa=!!flags.factoryGeneratorPowered;}};
    peers.push({world,scene,manager,generator:new CoopGenerator(world)});
  }
  peers[0].world.r.players.remotes.set('guest',{actor:peers[1].scene.player,health:100,data:{dead:false}});
  const pump=()=>{for(let n=0;queue.length;n++){
    assert.ok(n<50,'sem eco de rede');const action=queue.shift();
    if(action.authority)for(const peer of peers){
      if(action.targetId && action.targetId!==peer.manager.playerId)continue;
      if(action.kind==='progressState'){
        peer.manager.room.coopProgress=mergeCoopProgress(peer.manager.room.coopProgress,structuredClone(action.payload.progress));
        peer.generator.restore();peer.world.applyFlags(peer.manager.room.coopProgress.flags);
      }else peer.generator.receive(action);
    }else peers[0].generator.receive(action);
  }};
  return {host:peers[0],guest:peers[1],queue,pump};
}
test('jogadores contribuem peças separadas e qualquer um liga sem consumo repetido',()=>{
  const {host,guest,pump}=fixture();
  host.scene.inventory.addItem('bateria');guest.scene.inventory.addItem('gasolina',1,{fuel:1});
  assert.equal(host.generator.requestInstall('bateria'),true);pump();
  assert.ok(guest.generator.state.slots.bateria);assert.equal(guest.generator.ready(),false);
  assert.equal(guest.generator.requestInstall('gasolina'),true);pump();
  for(const peer of [host,guest])assert.equal(peer.generator.ready(),true);
  assert.equal(host.scene.inventory.getQuantity('bateria'),0);assert.equal(guest.scene.inventory.getQuantity('gasolina'),0);
  assert.equal(guest.generator.requestStart(),true);pump();
  assert.equal(host.scene.luzFabricaAcesa,true);assert.equal(guest.scene.luzFabricaAcesa,true);
  const start=host.manager.room.coopProgress.generatorStartedAt;
  guest.generator.requestStart();pump();assert.equal(host.manager.room.coopProgress.generatorStartedAt,start);
});
test('galão vazio e item inexistente não são depositados; ligar incompleto não funciona',()=>{
  const {host,guest,pump}=fixture();guest.scene.inventory.addItem('gasolina');
  assert.equal(guest.generator.requestInstall('gasolina'),false);
  assert.equal(guest.generator.requestInstall('bateria'),false);assert.equal(guest.generator.requestInstall('card'),false);
  assert.equal(guest.generator.requestStart(),false);
  host.generator.receive({kind:'generatorStart',playerId:'guest'});pump();assert.equal(host.scene.luzFabricaAcesa,undefined);
});
test('disputa pelo mesmo encaixe devolve a peça do perdedor e snapshots antigos não apagam encaixes',()=>{
  const {host,guest,pump}=fixture();for(const p of [host,guest])p.scene.inventory.addItem('bateria');
  host.generator.requestInstall('bateria');guest.generator.requestInstall('bateria');pump();
  assert.equal(host.scene.inventory.getQuantity('bateria'),0);assert.equal(guest.scene.inventory.getQuantity('bateria'),1);
  assert.equal(guest.generator.pending,undefined);assert.equal(host.generator.state.slots.bateria.playerId,'host');
  const merged=mergeCoopProgress(host.manager.room.coopProgress,{generator:{revision:0,slots:{}}});
  assert.equal(merged.generator.slots.bateria.playerId,'host');
});
test('depósito distante rejeitado no host reembolsa o inventário do dono',()=>{
  const {guest,pump}=fixture();guest.scene.player.x=1000;guest.scene.inventory.addItem('bateria');
  guest.generator.requestInstall('bateria');pump();
  assert.equal(guest.scene.inventory.getQuantity('bateria'),1);assert.equal(guest.generator.pending,undefined);
});
test('falha de envio devolve a reserva; confirmação perdida é recuperada sem duplicação',()=>{
  const f=fixture();f.guest.scene.inventory.addItem('bateria');
  const send=f.guest.manager.sendCoopAction;f.guest.manager.sendCoopAction=()=>false;
  f.guest.generator.requestInstall('bateria');assert.equal(f.guest.scene.inventory.getQuantity('bateria'),1);
  f.guest.manager.sendCoopAction=send;f.guest.generator.requestInstall('bateria');
  f.host.generator.receive(f.queue.shift());f.queue.length=0; // host aceitou, mas perdeu-se a confirmação
  const restored=new CoopGenerator(f.guest.world);f.guest.generator=restored;restored.update();f.pump();
  assert.equal(f.guest.scene.inventory.getQuantity('bateria'),0);assert.equal(restored.pending,undefined);
  assert.equal(f.host.generator.state.revision,1);
});
test('contribuição permanece depois que o dono sai e outro jogador completa o circuito',()=>{
  const {host,guest,pump}=fixture();guest.scene.inventory.addItem('bateria');guest.generator.requestInstall('bateria');pump();
  host.world.r.players.remotes.delete('guest');host.scene.inventory.addItem('gasolina',1,{fuel:1});
  host.generator.requestInstall('gasolina');pump();assert.equal(host.generator.ready(),true);
  host.generator.requestStart();pump();assert.equal(host.scene.luzFabricaAcesa,true);
});
test('reembolso aguarda espaço no inventário sem descartar a peça reservada',()=>{
  const {host,guest,pump}=fixture();
  for(const p of [host,guest])p.scene.inventory.addItem('bateria');
  host.generator.requestInstall('bateria');guest.generator.requestInstall('bateria');
  guest.scene.inventory.addItem('sucata',1980);pump();
  assert.equal(guest.scene.inventory.getQuantity('bateria'),0);assert.equal(guest.generator.pending.refund,true);
  guest.scene.inventory.removeItem('sucata',99);guest.generator.restore();
  assert.equal(guest.scene.inventory.getQuantity('bateria'),1);assert.equal(guest.generator.pending,undefined);
});
