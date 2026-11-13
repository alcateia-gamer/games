/** 2/3/4 jogos completos em Chromium e broker MQTT local: autoridade, dano, remoção e respawn. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
const root=process.env.ROBOT_TEST_TOOLS || '/tmp/nullborns-test-tools',require=createRequire(import.meta.url);
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || `${root}/node_modules/playwright/index.mjs`);
const broker=require(`${root}/node_modules/aedes`)(),{WebSocketServer,createWebSocketStream}=require(`${root}/node_modules/ws`);
const socket=new WebSocketServer({host:'127.0.0.1',port:18884});socket.on('connection',ws=>broker.handle(createWebSocketStream(ws)));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--disable-features=LocalNetworkAccessChecks']});
const errors=[],report=[];const artifacts=process.env.ARTIFACT_DIR || '/tmp/city-robots';mkdirSync(artifacts,{recursive:true});
try{
 for(const count of [2,3,4]){
  console.log('INICIANDO',count,'jogadores');const pages=[];
  try{
   for(let i=0;i<count;i++){
    const p=await browser.newPage({viewport:{width:960,height:540}});pages.push(p);p.on('pageerror',e=>errors.push(e.stack));
    await p.route('**/js/core/game.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('const game = new Game(jogoRapido);','const game = window.__game = new Game(jogoRapido);')});});
    await p.goto(process.env.GAME_URL || 'http://127.0.0.1:8765');await p.locator('#start-game').click();
    await p.waitForFunction(()=>window.__game?.scene.isActive('Start'));
    await p.addScriptTag({path:`${root}/node_modules/mqtt/dist/mqtt.min.js`});
    await p.evaluate(async count=>{
     const {default:Mqtt}=await import('/js/mqttClient.js'),{default:Manager}=await import('/js/multiplayer/multiplayerManager.js');
     window.manager=new Manager(new Mqtt({brokerUrl:'ws://127.0.0.1:18884',topicPrefix:`robots-${count}`}));
     manager.on('error',console.warn);__game.registry.set('multiplayer',manager);
    },count);await p.waitForFunction(()=>manager.mqtt.connected);
   }
   const code=await pages[0].evaluate(()=>manager.createRoom());
   for(const p of pages.slice(1))await p.evaluate(code=>manager.joinRoom(code),code);
   for(const p of pages)await p.waitForFunction(count=>manager.room?.players.length===count,count);
   for(let i=0;i<count;i++)await pages[i].evaluate(i=>manager.selectCharacter(['kai-mercer','magnus-force','aria-kade','nyx'][i]),i);
   for(const p of pages){await p.waitForFunction(()=>manager.room.players.every(p=>p.character));await p.evaluate(()=>{__game.scene.getScene('Start').scene.start('MultiplayerLobby');manager.setReady(true);});}
   await pages[0].waitForFunction(()=>manager.canStart());await pages[0].evaluate(()=>manager.startGame());
   for(const p of pages){await p.waitForFunction(()=>__game.scene.getScene('preloader')?.cutscene?.gate.assetsReady,null,{timeout:120000});await p.evaluate(()=>__game.scene.getScene('preloader').cutscene.video.dispatchEvent(new Event('ended')));}
   for(const p of pages)await p.waitForFunction(()=>!!__game.scene.getScene('preloader').cutscene.transmission.timeline);
   for(const p of pages)await p.evaluate(()=>{const t=__game.scene.getScene('preloader').cutscene.transmission;t.startAt=Date.now()-t.timeline.duration-1;t.update();});
   for(const p of pages)await p.waitForFunction(()=>__game.scene.getScene('Level1')?.coopRuntime,null,{timeout:60000});
   console.log('MAPAS CARREGADOS',count);
   for(let i=0;i<count;i++)await pages[i].evaluate(i=>{
    const s=__game.scene.getScene('Level1'),z=s.enemySpawnManager.regions[0];s.player.body.reset(z.center.x+80*i,z.center.y+350);s.player.body.updateFromGameObject();s.player.setVelocity(0,0);
   },i);
   // Deixa o input de cada cliente chegar à autoridade antes de congelar a simulação.
   await pages[0].waitForFunction(count=>__game.scene.getScene('Level1').coopRuntime.playerContexts().filter(c=>c.player.y>1300).length===count,count);
   const spawn=await pages[0].evaluate(async()=>{
    const s=__game.scene.getScene('Level1'),m=s.enemySpawnManager;s.scene.pause();
    for(const e of [...s.inimigos])m.removerInimigoInvalido(e);
    const z=m.regions[0];z.activated=false;z.nextAttempt=0;m.checkSpawnZones(s.time.now+10000);
    const {areaContemCorpo}=await import('/js/enemies/EnemySpawnArea.js');
    if(!z.enemies.length || z.enemies.some(e=>!areaContemCorpo(z.area,new Phaser.Geom.Rectangle(e.body.x,e.body.y,e.body.width,e.body.height))))throw Error('spawn host inválido');
    window.testClock=s.time.now+10000;s.coopRuntime.forceKeyframe=true;s.coopRuntime.update(testClock,16);
    const e=z.enemies.find(e=>e.tipoRobo==='serra');return {ids:s.inimigos.map(e=>e.networkId).sort(),target:e.networkId,vida:e.vida};
   });
   const publish=()=>pages[0].evaluate(()=>{const s=__game.scene.getScene('Level1');testClock+=100;s.coopRuntime.update(testClock,16);});
   for(const p of pages.slice(1))await p.waitForFunction(ids=>JSON.stringify(__game.scene.getScene('Level1').inimigos.map(e=>e.networkId).sort())===JSON.stringify(ids),spawn.ids);
   for(const p of pages.slice(1)){
    const result=await p.evaluate(()=>{const s=__game.scene.getScene('Level1'),before=s.inimigos.length;return {spawn:s.enemySpawnManager.solicitarSpawn('padrao',3).length,before,after:s.inimigos.length,remote:s.inimigos.every(e=>e.remoteOnly)};});
    assert.deepEqual(result,{spawn:0,before:spawn.ids.length,after:spawn.ids.length,remote:true});
   }
   console.log('SPAWN COMPARTILHADO',count,spawn.ids.length);
   for(const p of pages)await p.evaluate(id=>__game.scene.getScene('Level1').coopRuntime.requestDamage(id,1),spawn.target);
   await pages[0].waitForFunction(({id,vida,count})=>__game.scene.getScene('Level1').inimigos.find(e=>e.networkId===id)?.vida===vida-count,{id:spawn.target,vida:spawn.vida,count});
   await publish();
   for(const p of pages.slice(1))await p.waitForFunction(({id,vida})=>__game.scene.getScene('Level1').inimigos.find(e=>e.networkId===id)?.vida===vida,{id:spawn.target,vida:spawn.vida-count});
   console.log('DANO DOS',count,'PERSONAGENS SINCRONIZADO');
   const cleanup=await pages[0].evaluate(()=>{
    const s=__game.scene.getScene('Level1');let rewards=0;window.oldDeath=s.scrapSystem.onRobotDeath;s.scrapSystem.onRobotDeath=()=>rewards++;
    for(const e of s.inimigos){e.body.reset(1e5,1e5);e.body.updateFromGameObject();}
    s.enemySpawnManager.limparForaDoMapa();testClock+=100;s.coopRuntime.update(testClock,16);
    return {count:s.inimigos.length,rewards};
   });assert.deepEqual(cleanup,{count:0,rewards:0});
   for(const p of pages.slice(1))await p.waitForFunction(()=>__game.scene.getScene('Level1').inimigos.length===0);
   const replacement=await pages[0].evaluate(()=>{
    const s=__game.scene.getScene('Level1'),m=s.enemySpawnManager,z=m.regions[0];s.scrapSystem.onRobotDeath=oldDeath;
    m.config.spawnOnce=false;z.nextAttempt=0;testClock+=3000;m.checkSpawnZones(testClock);s.coopRuntime.update(testClock,16);
    return s.inimigos.map(e=>e.networkId).sort();
   });assert.ok(replacement.length>=2 && replacement.every(id=>!spawn.ids.includes(id)));
   for(const p of pages.slice(1))await p.waitForFunction(ids=>JSON.stringify(__game.scene.getScene('Level1').inimigos.map(e=>e.networkId).sort())===JSON.stringify(ids),replacement);
   await publish();
   for(const p of pages.slice(1))assert.ok(await p.evaluate(ids=>__game.scene.getScene('Level1').inimigos.every(e=>!ids.includes(e.networkId)),spawn.ids));
   report.push({players:count,spawn:spawn.ids.length,damageFromPlayers:count,removedWithoutRewards:true,respawn:replacement.length,duplicateIds:false});console.log('PASSOU',count,'jogadores');
  }catch(e){for(let i=0;i<pages.length;i++)console.error('DIAG',count,i,await pages[i].evaluate(()=>({room:manager.room?.status,active:__game.scene.getScenes(true).map(s=>s.sys.settings.key),enemies:__game.scene.getScene('Level1')?.inimigos?.map(e=>({id:e.networkId,vida:e.vida})),contexts:__game.scene.getScene('Level1')?.coopRuntime?.playerContexts().map(c=>({x:c.player.x,y:c.player.y}))})).catch(()=>null));throw e;}
  finally{await Promise.allSettled(pages.map(async p=>{await p.evaluate(()=>manager.destroy());await p.close();}));}
 }
 assert.deepEqual(errors,[]);writeFileSync(`${artifacts}/multiplayer.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser.close();for(const ws of socket.clients)ws.terminate();socket.close();await new Promise(r=>broker.close(r));}
