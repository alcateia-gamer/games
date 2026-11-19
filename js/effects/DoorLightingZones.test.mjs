import test from 'node:test';import assert from 'node:assert/strict';
import DoorLightingZones from './DoorLightingZones.js';
const map={tileWidth:48,getObjectLayer:n=>({objects:n==='LuzApagada'?[{id:1,x:0,y:0,width:100,height:100},{id:2,x:300,y:0,width:100,height:100}]:[]})};
test('zonas conservam geometria e revelam somente a porta aberta sem índices de lâmpadas',()=>{
 const z=new DoorLightingZones(map),doors=[{nome:'porta05',estado:'fechada',area:{x:0,y:100,width:100,height:10}}];
 z.atualizar(0,doors,true);assert.equal(z.zonas[0].opacidade,1);assert.equal('indices' in z.zonas[0],false);
 doors[0].estado='abrindo';z.atualizar(10,doors,true);assert.equal(z.zonas[0].opacidade,1);
 doors[0].estado='aberta';z.atualizar(100,doors,true);z.atualizar(175,doors,true);
 assert.ok(z.zonas[0].opacidade>0 && z.zonas[0].opacidade<1);z.atualizar(250,doors,true);
 assert.equal(z.zonas[0].opacidade,0);assert.equal(z.zonas[1].opacidade,1);
 const replica=new DoorLightingZones(map);replica.aplicarEstadoRede(z.snapshotRede(250),1000,doors,true);
 replica.atualizar(1150,doors,true);assert.equal(replica.zonas[0].opacidade,0);z.destroy();replica.destroy();
});
test('retorno com porta aberta restaura a zona sem repetir transição',()=>{
 const z=new DoorLightingZones(map);z.atualizar(0,[{nome:'porta05',estado:'aberta',area:{x:0,y:100,width:100,height:10}}],false);
 assert.equal(z.zonas[0].opacidade,0);z.destroy();
});
