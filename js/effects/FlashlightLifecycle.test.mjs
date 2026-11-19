import test from 'node:test';import assert from 'node:assert/strict';
import {lanternaDesativada,desativarLanternaDefinitivamente,FLASHLIGHT_RETIRED_KEY} from './FlashlightLifecycle.js';
test('desativação idempotente e progresso do host sobrevivem a DEV, reconexão e migração',()=>{
 const registry=new Map(),room={coopProgress:{flags:{factoryGeneratorPowered:true}}};
 const scene={multiplayer:true,game:{registry},multiplayerManager:{room}};
 assert.equal(lanternaDesativada(scene),true);
 desativarLanternaDefinitivamente(scene);desativarLanternaDefinitivamente(scene);
 registry.set('factoryGeneratorPowered',false);assert.equal(lanternaDesativada(scene),true);
 const reconectado={multiplayer:true,game:{registry:new Map()},multiplayerManager:{room}};
 assert.equal(lanternaDesativada(reconectado),true);
 reconectado.coopRuntime={host:true,manager:{room}};assert.equal(lanternaDesativada(reconectado),true);
 registry.delete(FLASHLIGHT_RETIRED_KEY);registry.delete('factoryGeneratorPowered');scene.multiplayer=false;
 assert.equal(lanternaDesativada(scene),false,'nova partida solo ignora a sala multiplayer antiga');
});
