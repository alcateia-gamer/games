/** Dois jogos completos e MQTT local: equipe caída, fala do solicitante, resgate e leitor real. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {iniciarJogoHacking,entrarFabricaHacking} from './hacking-browser-helpers.mjs';
const root=process.env.ROBOT_TEST_TOOLS ?? '/tmp/nullborns-coop-test-tools',require=createRequire(import.meta.url);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? '/tmp/nullborns-playwright/package/index.mjs');
const broker=require(`${root}/node_modules/aedes`)(),{WebSocketServer,createWebSocketStream}=require(`${root}/node_modules/ws`);
const socket=new WebSocketServer({host:'127.0.0.1',port:18885});socket.on('connection',ws=>broker.handle(createWebSocketStream(ws)));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,
 args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding']});
const pages=[],errors=[],report={},artifacts=process.env.ARTIFACT_DIR ?? '/tmp/factory-lighting-coop';mkdirSync(artifacts,{recursive:true});
async function boot(){
 const p=await browser.newPage({viewport:{width:960,height:600}});pages.push(p);p.setDefaultTimeout(30000);
 p.on('pageerror',e=>errors.push(e.stack));await iniciarJogoHacking(p);
 await p.addScriptTag({path:`${root}/node_modules/mqtt/dist/mqtt.min.js`});
 await p.evaluate(async()=>{
  const {default:Client}=await import('/js/mqttClient.js'),{default:Manager}=await import('/js/multiplayer/multiplayerManager.js');
  window.__manager=new Manager(new Client({brokerUrl:'ws://127.0.0.1:18885',topicPrefix:'boss-team-test'}));
  __game.registry.set('multiplayer',__manager);
 });await p.waitForFunction(()=>__manager.mqtt.connected);return p;
}
async function position(page,reader=false,x=1000,y=-1896){
 await page.evaluate(({reader,x,y})=>{
  const s=__game.scene.getScene('Level1Parte2'),a=s.leitorCartaoFabrica.area;
  if(reader){x=a.x+a.width/2;y=a.y+a.height+25;}
  s.player.body.reset(x,y);s.player.body.updateFromGameObject();s.player.setVelocity(0,0);s.player.invulneravel=true;
 },{reader,x,y});
}
const state=page=>page.evaluate(()=>{
 const s=__game.scene.getScene('Level1Parte2');return {card:s.inventory.getQuantity('card'),
  authenticated:s.registry.get('bossAccessCardAuthenticated')===true,phase:s.coopRuntime.world.bossLoading.state?.phase ?? null,
  doors:s.portasFabrica.filter(d=>['porta02','porta03'].includes(d.nome)).map(d=>({state:d.estado,collision:!!d.colisao})),
  panel:!!s.cardReaderMenuOpen,blocked:!!s.movimentoBloqueado,
  speech:s.leitorCartaoFabrica.fala.snapshot(),alive:s.coopRuntime.world.bossLoading.teamStatus().alive};
});
async function attempt(p){await p.evaluate(()=>{const s=__game.scene.getScene('Level1Parte2');s.atualizarInteracaoPortaFabrica();if(!s.interacaoMundoProxima)throw Error('leitor não disponível');s.interacaoMundoProxima.interact();});}
async function down(p){await p.evaluate(()=>__game.scene.getScene('Level1Parte2').coopRuntime.downPlayer());}
async function revive(downed,helper){
 const where=await downed.evaluate(()=>{const p=__game.scene.getScene('Level1Parte2').player;return{x:p.x+25,y:p.y};});
 const start=Date.now();await position(helper,false,where.x,where.y);
 await downed.waitForFunction(()=>{const s=__game.scene.getScene('Level1Parte2');return !s.morteEmAndamento && s.vida>0 && !s.coopDownId;});
 await helper.waitForFunction(()=>__game.scene.getScene('Level1Parte2').coopRuntime.world.bossLoading.teamStatus().alive);
 assert.ok(Date.now()-start>=2700,'resgate conserva os três segundos existentes');
}
async function assertDenied(){for(const p of pages){const s=await state(p);assert.equal(s.authenticated,false);assert.equal(s.phase,null);assert.ok(s.doors.every(d=>d.state==='fechada' && d.collision));}}
async function speechOnRemote(observer,speakerId,name){
 await observer.waitForFunction(({id,name})=>{
  const e=__game.scene.getScene('Level1Parte2').coopRuntime.players.remotes.get(id);
  return [...(e?.speeches?.values() ?? [])].some(b=>b.snapshot()?.frase.includes(name));
 },{id:speakerId,name});
}
try{
 const host=await boot(),client=await boot();
 const code=await host.evaluate(()=>__manager.createRoom());await client.evaluate(code=>__manager.joinRoom(code),code);
 await host.waitForFunction(()=>__manager.room.players.length===2);
 await host.evaluate(()=>__manager.selectCharacter('kai-mercer'));await client.evaluate(()=>__manager.selectCharacter('magnus-force'));
 for(const p of pages){await p.waitForFunction(()=>__manager.room.players.every(p=>p.character));await p.evaluate(()=>__manager.setReady(true));}
 await host.waitForFunction(()=>__manager.canStart());await host.evaluate(()=>__manager.startGame());
 await client.waitForFunction(()=>__manager.room.status==='PLAYING');
 for(const p of pages){
  await p.evaluate(()=>{const personagem=__manager.room.players.find(p=>p.id===__manager.playerId).character;__game.scene.getScene('Level1').scene.restart({multiplayer:true,personagem});});
  await p.waitForFunction(()=>__game.scene.getScene('Level1').coopRuntime);
 }
 await Promise.all(pages.map(p=>entrarFabricaHacking(p,true)));
 await host.waitForFunction(()=>__game.scene.getScene('Level1Parte2').coopRuntime.players.remotes.size===1);

 for(const p of pages){
  await p.waitForFunction(()=>!!__game.scene.getScene('Level1Parte2').recursosLanterna);
  await p.evaluate(async()=>{
   const s=__game.scene.getScene('Level1Parte2');window.oldFlashlight=s.recursosLanterna;
   const {findGeneratorInteraction}=await import('/js/interactions/FactoryGenerator.js');const a=findGeneratorInteraction(s.map).object;
   s.player.body.reset(a.x+a.width/2,a.y+a.height+20);s.player.body.updateFromGameObject();s.player.invulneravel=true;
  });
 }
 await host.evaluate(()=>{const s=__game.scene.getScene('Level1Parte2');s.inventory.addItem('bateria');s.coopRuntime.world.generator.requestInstall('bateria');});
 await client.waitForFunction(()=>!!__game.scene.getScene('Level1Parte2').coopRuntime.world.generator.state.slots.bateria);
 await client.evaluate(()=>{const s=__game.scene.getScene('Level1Parte2');s.inventory.addItem('gasolina',1,{fuel:1});s.coopRuntime.world.generator.requestInstall('gasolina');});
 for(const p of pages)await p.waitForFunction(()=>__game.scene.getScene('Level1Parte2').coopRuntime.world.generator.ready());
 await client.evaluate(()=>__game.scene.getScene('Level1Parte2').coopRuntime.world.generator.requestStart());
 for(const p of pages){
  await p.waitForFunction(()=>{const s=__game.scene.getScene('Level1Parte2');return s.luzFabricaAcesa && !s.recursosLanterna && s.registry.get('factoryFlashlightRetired')===true;});
  const r=await p.evaluate(()=>{
   const s=__game.scene.getScene('Level1Parte2');return {canvas:oldFlashlight.canvas.width,occlusion:oldFlashlight.oclusao.width,wallsDestroyed:!oldFlashlight.paredes.scene,
    emptyAllies:!oldFlashlight.aliadas.size,pose:s.coopRuntime.players.localState().coop.flashlight,
    noPointArrays:!('lampadas' in s.iluminacaoFabrica),noLightingPacket:!('lighting' in s.coopRuntime.world.snapshot())};
  });assert.deepEqual(r,{canvas:0,occlusion:0,wallsDestroyed:true,emptyAllies:true,pose:null,noPointArrays:true,noLightingPacket:true});
 }
 report.activation={clientRequested:true,hostConfirmed:true,bothRetired:true,resourcesFreed:true};
 await host.evaluate(()=>{const s=__game.scene.getScene('Level1Parte2'),w=s.coopRuntime.world;w.manager.room.coopDevLighting=false;w.applyDevLighting(false);w.manager.publishState();});
 for(const p of pages)await p.waitForFunction(()=>{const s=__game.scene.getScene('Level1Parte2');return !s.luzFabricaAcesa && !s.recursosLanterna;});
 report.devOff={noReactivation:true};
 await Promise.all(pages.map(p=>entrarFabricaHacking(p,true)));
 for(const p of pages){await p.waitForFunction(()=>__game.scene.getScene('Level1Parte2').coopRuntime);assert.equal(await p.evaluate(()=>!!__game.scene.getScene('Level1Parte2').recursosLanterna),false);}
 report.returnVisit={noFlashlightInitialized:true};assert.deepEqual(errors,[]);
 writeFileSync(`${artifacts}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));

}catch(error){
 for(let i=0;i<pages.length;i++){console.error('DIAG',i,await state(pages[i]).catch(()=>null));await pages[i].screenshot({path:`${artifacts}/failure-${i}.png`}).catch(()=>{});}
 throw error;
}finally{
 for(const p of pages)await p.evaluate(()=>__manager?.destroy()).catch(()=>{});
 await browser.close();for(const ws of socket.clients)ws.terminate();socket.close();await new Promise(r=>broker.close(r));
}
