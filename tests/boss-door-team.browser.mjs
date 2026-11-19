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
const pages=[],errors=[],report={},artifacts=process.env.ARTIFACT_DIR ?? '/tmp/boss-door-team';mkdirSync(artifacts,{recursive:true});
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
 await host.evaluate(()=>{
  const s=__game.scene.getScene('Level1Parte2'),w=s.coopRuntime.world;
  w.manager.room.coopDevLighting=true;w.manager.room.coopProgress.flags.factoryGeneratorPowered=true;
  for(const k of ['factoryHackingComplete','factoryBruteforceComplete'])s.registry.set(k,true);
  w.applyDevLighting(true);w.manager.publishState();
 });
 for(const p of pages)await p.waitForFunction(()=>{const s=__game.scene.getScene('Level1Parte2');return s.luzFabricaAcesa && s.registry.get('factoryBruteforceComplete')===true;});
 const hostId=await host.evaluate(()=>__manager.playerId),clientId=await client.evaluate(()=>__manager.playerId);
 await host.evaluate(()=>__game.scene.getScene('Level1Parte2').inventory.addItem('card',1));
 await position(host,true);await position(client);await down(client);
 await host.waitForFunction(id=>__manager.room.players.find(p=>p.id===id)?.dead,clientId);
 await attempt(host);await host.waitForFunction(()=>__game.scene.getScene('Level1Parte2').leitorCartaoFabrica.fala.snapshot()?.frase.includes('Magnus'));
 await speechOnRemote(client,hostId,'Magnus');await assertDenied();assert.equal((await state(host)).card,1);
 report.clientDown={hostSpeech:'Magnus',replicatedOnCorrectActor:true,denied:true,cardPreserved:true};console.log('PASS: cliente morto bloqueia host; fala correta nos dois navegadores.');
 await revive(client,host);
 await position(host);await position(client,true);await client.evaluate(()=>__game.scene.getScene('Level1Parte2').inventory.addItem('card',1));
 await down(host);await client.waitForFunction(id=>__manager.room.players.find(p=>p.id===id)?.dead,hostId);
 await attempt(client);await client.waitForFunction(()=>__game.scene.getScene('Level1Parte2').leitorCartaoFabrica.fala.snapshot()?.frase.includes('Kai Mercer'));
 await speechOnRemote(host,clientId,'Kai Mercer');await assertDenied();
 // Exercita também a negativa autoritativa, sem depender do pré-check do leitor.
 await client.evaluate(()=>__game.scene.getScene('Level1Parte2').coopRuntime.world.confirmarCartao());
 await client.waitForFunction(()=>!__game.scene.getScene('Level1Parte2').coopRuntime.world.bossLoading.accessRequested);
 assert.equal((await state(client)).card,1);
 report.hostDown={clientSpeech:'Kai Mercer',replicatedOnCorrectActor:true,hostDenied:true,cardPreserved:true};console.log('PASS: host morto bloqueia cliente e negativa retorna ao solicitante.');
 await revive(host,client);await position(host);await position(client,true);
 await client.evaluate(()=>__game.scene.getScene('Level1Parte2').tweens.timeScale=0);
 await attempt(client);assert.equal((await state(client)).panel,true);
 await down(host);await client.waitForFunction(id=>__manager.room.players.find(p=>p.id===id)?.dead,hostId);
 await client.evaluate(()=>__game.scene.getScene('Level1Parte2').tweens.timeScale=1);
 await client.waitForFunction(()=>!__game.scene.getScene('Level1Parte2').cardReaderMenuOpen);
 await assertDenied();assert.equal((await state(client)).card,1);
 report.deathDuringRead={denied:true,cardPreserved:true,noPreparation:true};console.log('PASS: morte durante leitura real cancela autenticação e abertura.');
 await revive(host,client);await position(host);await position(client,true);
 await attempt(client);
 for(const p of pages)await p.waitForFunction(()=>{const s=__game.scene.getScene('Level1Parte2');return s.registry.get('bossAccessCardAuthenticated')===true && s.portasFabrica.filter(d=>['porta02','porta03'].includes(d.nome)).every(d=>d.estado==='aberta' && !d.colisao);},null,{timeout:30000});
 report.afterRevival={authenticated:true,doorsOpenOnBoth:true};
 await position(client,false,-1093,-5520);
 for(const p of pages)await p.waitForFunction(()=>{const s=__game.scene.getScene('Level1Parte2');return s.coopRuntime.world.bossLoading.canStart() && s.novoBoss?.sprite?.active;},null,{timeout:120000});
 report.boss={preparedOnBoth:true,introAuthorized:true};assert.deepEqual(errors,[]);
 await client.screenshot({path:`${artifacts}/equipe-revivida.png`});writeFileSync(`${artifacts}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}catch(error){
 for(let i=0;i<pages.length;i++){console.error('DIAG',i,await state(pages[i]).catch(()=>null));await pages[i].screenshot({path:`${artifacts}/failure-${i}.png`}).catch(()=>{});}
 throw error;
}finally{
 for(const p of pages)await p.evaluate(()=>__manager?.destroy()).catch(()=>{});
 await browser.close();for(const ws of socket.clients)ws.terminate();socket.close();await new Promise(r=>broker.close(r));
}
