/** TV real, Chromium/Firefox e MQTT local. Relógio narrativo acelerado nos encerramentos. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const root = process.env.HOLLOW_TEST_TOOLS || '/tmp/nullborns-test-tools';
const { chromium, firefox } = await import(process.env.PLAYWRIGHT_MODULE || `${root}/node_modules/playwright/index.mjs`);
const broker = require(`${root}/node_modules/aedes`)();
const { WebSocketServer, createWebSocketStream } = require(`${root}/node_modules/ws`);
const socket = new WebSocketServer({host:'127.0.0.1',port:18884});
socket.on('connection', ws => broker.handle(createWebSocketStream(ws)));
const base=process.env.GAME_URL || 'http://127.0.0.1:8765';
const artifacts=process.env.ARTIFACT_DIR || '/tmp/hollow-validation';
mkdirSync(artifacts,{recursive:true});
const checks=[],errors=[];
function check(name,value) { assert.ok(value,name);checks.push(name);console.log('OK',name); }
const fixture=`<!doctype html><link rel="stylesheet" href="/style.css"><div id="game-container"></div>
<script src="/js/libs/phaser.min.js"></script><script type="module">
import {CutsceneLoading} from '/js/ui/CutsceneLoading.js';
import Manager from '/js/multiplayer/multiplayerManager.js';
import Mqtt from '/js/mqttClient.js';
window.startHollow = data => {
 const registry=new Map(); if(window.manager) registry.set('multiplayer',window.manager);
 const game={registry,events:new Phaser.Events.EventEmitter(),cache:{audio:{exists:()=>false}},sound:{locked:true}};
 window.game=game; window.completed=0; window.cancelled=0;
 window.cutscene=new CutsceneLoading(game,data);
 window.cutscene.attach({events:new Phaser.Events.EventEmitter(),scene:{start:()=>window.cancelled++}});
 if(!data.slow) window.cutscene.setAssetsReady(()=>window.completed++);
};
window.connectHollow = () => {
 window.manager=new Manager(new Mqtt({brokerUrl:'ws://127.0.0.1:18884',topicPrefix:'hollow-test'}));
 window.manager.on('error',console.warn);
};
</script>`;
const options={headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--disable-background-timer-throttling','--disable-features=LocalNetworkAccessChecks']};
async function harness(browser,data) {
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>errors.push(e.stack));
 page.on('console',m=>{if(m.type()==='warning'||m.type()==='error') console.log('BROWSER',m.text());});
 await page.route('**/__hollow',r=>r.fulfill({contentType:'text/html',body:fixture}));
 await page.goto(`${base}/__hollow`); await page.waitForFunction(()=>!!window.startHollow);
 if(data) await page.evaluate(data=>startHollow(data),data);
 return page;
}
async function endVideo(page) {
 await page.evaluate(()=>{const v=cutscene.video;v.dispatchEvent(new Event('ended'));v.dispatchEvent(new Event('ended'));});
 await page.locator('.hollow-messenger').waitFor();
}
async function jump(page,kind) {
 await page.evaluate(kind=>{
  const t=cutscene.transmission;
  const target=kind==='end'?t.timeline.duration+100:t.timeline.lines.find(l=>l[kind]).start+200;
  t.startAt=Date.now()-target;t.update();
 },kind);
}
let browser;
try {
 browser=await chromium.launch(options);
 if(!process.env.HOLLOW_COOP_ONLY) {
 for(const character of ['kai-mercer','magnus-force','aria-kade','nyx']) {
  const page=await harness(browser,{personagem:character});
  await page.waitForFunction(()=>cutscene.video.currentTime>0.1);
  check(`vídeo original reproduz: ${character}`,await page.evaluate(()=>!cutscene.video.hidden && cutscene.video.videoWidth===960));
  check(`luz amostra cores e brilho do vídeo: ${character}`,await page.evaluate(()=>{
   const l=cutscene.crtLighting,sample=l.videoLight();
   return (l.lowPower ? !l.canvas && !l.context : !l.samplingFailed && Number.isFinite(l.lastVideoTime)) && sample.color.every(Number.isFinite) && sample.emission>0;
  }));
  await endVideo(page);
  if(character==='kai-mercer') {
   check('som acompanha palavras e revelar texto permanece silencioso',await page.evaluate(()=>{
    const v=cutscene.transmission.view;let count=0;v.notify=()=>count++;
    const line={role:'hollow',name:'THE HOLLOW',text:'Um novo começo',typing:1000};
    v.show(line,999);if(count!==0)return false;
    v.progress(line,1/14);v.progress(line,2/14);v.progress(line,4/14);
    if(count!==2)return false;
    v.progress(line,1,true);if(count!==2)return false;
    v.show({...line,role:'unknown'},1000);v.progress({...line,role:'unknown'},1/14);
    return count===2;
   }));
  }
  check(`ended duplicado cria um único terminal: ${character}`,await page.locator('.hollow-messenger').count()===1);
  await page.evaluate(()=>{const t=cutscene.transmission;const l=t.timeline.lines.find(l=>l.character);t.startAt=Date.now()-l.start-100;t.update();});
  check(`resposta do agente real: ${character}`,await page.evaluate(character=>cutscene.transmission.timeline.lines.filter(l=>l.character).every(l=>l.character===character),character));
  const before=await page.locator('.hollow-message').last().innerText();
  await page.locator('.cutscene-advance').click();
  check(`completa digitação: ${character}`,(await page.locator('.hollow-message').last().innerText()).length>before.length);
  if(character==='aria-kade') {
   for(const [width,height] of [[1280,720],[844,390],[390,844],[1920,1080]]) {
    await page.setViewportSize({width,height});await page.waitForTimeout(100);
    check(`terminal contido na TV ${width}x${height}`,await page.evaluate(()=>{
     const a=document.querySelector('.hollow-messenger').getBoundingClientRect(),b=cutscene.display.getBoundingClientRect();
     return Math.abs(a.x-b.x)<1 && Math.abs(a.y-b.y)<1 && Math.abs(a.width-b.width)<2 && Math.abs(a.height-b.height)<2;
    }));
   }
   await page.setViewportSize({width:1280,height:720});
   await page.screenshot({path:`${artifacts}/hollow-chat.png`});
   await jump(page,'interference');
   check('interferência muda indicador de conexão',await page.locator('.hollow-status').innerText()==='● UNSTABLE');
   await page.evaluate(()=>{const t=cutscene.transmission,l=t.timeline.lines.find(l=>l.role==='unknown');t.startAt=Date.now()-l.start-500;t.update();});
   check('AXIOM intercepta o canal',await page.locator('.hollow-unknown').count()>0);
   check('interceptação muda a luz emitida para vermelho',await page.evaluate(()=>{
    const l=cutscene.crtLighting,target=l.target();for(let i=0;i<6;i++)l.update();
    return target.color[0]>target.color[1]*2 && l.color[0]>l.color[1]*2;
   }));
   await page.screenshot({path:`${artifacts}/hollow-crt-axiom.png`});
   await jump(page,'purge');
   check('mensagens da AXIOM desaparecem',await page.locator('.hollow-unknown').count()===0);
   check('canal recuperado volta a iluminar em verde',await page.evaluate(()=>{
    const l=cutscene.crtLighting,target=l.target();for(let i=0;i<6;i++)l.update();
    return target.color[1]>target.color[0]*2 && l.color[1]>l.color[0]*2;
   }));
   await jump(page,'operation');
   check('objetivos completos cabem na tela',await page.evaluate(()=>{const e=document.querySelector('.hollow-operation pre'),f=document.querySelector('.hollow-feed');return e.getBoundingClientRect().height<=f.clientHeight;}));
   await page.screenshot({path:`${artifacts}/hollow-objectives.png`});
  }
  check(`fim do diálogo inicia imediatamente: ${character}`,await page.evaluate(()=>{
   const t=cutscene.transmission;t.startAt=Date.now()-t.timeline.duration-1;t.update();
   return completed===1 && cutscene.destroyed && cutscene.crtLighting.destroyed && (!cutscene.crtLighting.canvas || cutscene.crtLighting.canvas.width===0);
  }));await page.waitForFunction(()=>completed===1);
  check(`fim temporal libera uma única transição: ${character}`,await page.locator('.cutscene-loading').count()===0);
  await page.close();
 }
 const slow=await harness(browser,{personagem:'kai-mercer',slow:true});
 await slow.keyboard.down('Escape');await slow.waitForTimeout(500);await slow.keyboard.up('Escape');
 check('ESC curto não pula',await slow.evaluate(()=>!cutscene.narrativeFinished));
 await slow.keyboard.down('Escape');await slow.waitForTimeout(1200);await slow.keyboard.up('Escape');
 await slow.waitForTimeout(600);
 check('segurar ESC pula mas aguarda assets',await slow.evaluate(()=>cutscene.narrativeFinished && !completed && !cutscene.destroyed));
 await slow.evaluate(()=>cutscene.setAssetsReady(()=>completed++));await slow.waitForFunction(()=>completed===1);await slow.close();
 const failure=await harness(browser);
 await failure.route('**/cutscene-tv.mp4',r=>r.abort());
 await failure.evaluate(()=>startHollow({personagem:'nyx'}));await failure.locator('.hollow-messenger').waitFor();
 check('vídeo indisponível abre briefing automaticamente',await failure.evaluate(()=>cutscene.mediaFailed));
 await failure.locator('.cutscene-skip').click();await failure.waitForFunction(()=>completed===1);await failure.close();
 }
 for(const count of [2,3,4]) {
  console.log('COOP',count);
  const pages=[];
  for(let i=0;i<count;i++) {
   const p=await harness(browser);pages.push(p);
   await p.addScriptTag({path:`${root}/node_modules/mqtt/dist/mqtt.min.js`});
   await p.evaluate(()=>connectHollow());try { await p.waitForFunction(()=>manager.mqtt.connected); } catch(e) { console.log(await p.evaluate(()=>({mqtt:typeof mqtt,connected:manager.mqtt.connected,client:manager.mqtt.client?.connected})));throw e; } console.log('connected',i);
  }
  const code=await pages[0].evaluate(()=>manager.createRoom());
  for(const p of pages.slice(1)) await p.evaluate(code=>manager.joinRoom(code),code);
  await pages[0].waitForFunction(count=>manager.room.players.length===count,count);
  const cast=['kai-mercer','magnus-force','aria-kade','nyx'].slice(0,count);
  for(let i=0;i<count;i++) await pages[i].evaluate(id=>manager.selectCharacter(id),cast[i]);
  await pages[0].waitForFunction(()=>manager.room.players.every(p=>p.character));
  for(const p of pages) await p.evaluate(()=>manager.setReady(true));
  await pages[0].waitForFunction(()=>manager.canStart());await pages[0].evaluate(()=>manager.startGame());
  for(let i=0;i<count;i++) {
   await pages[i].waitForFunction(()=>manager.room?.status==='PLAYING');
   await pages[i].evaluate(id=>startHollow({personagem:id,multiplayer:true}),cast[i]);
   if(count!==3) await endVideo(pages[i]);
  }
  if(count===3) {
   await pages[0].locator('.cutscene-skip').click();
   await pages[0].waitForTimeout(250);
   check('voto isolado durante vídeo não libera ninguém',await pages[0].evaluate(()=>!completed && !manager.room.hollow.releaseAt));
   for(const p of pages.slice(1)) await p.locator('.cutscene-skip').click();
   for(const p of pages) await p.waitForFunction(()=>completed===1);
   check('3 clientes: votação unânime pula vídeo e briefing',true);
  } else {
   for(const p of pages) await p.waitForFunction(()=>!!cutscene.transmission.timeline);
   const scripts=await Promise.all(pages.map(p=>p.evaluate(()=>JSON.stringify(cutscene.transmission.timeline.lines))));
   check(`${count} clientes recebem o mesmo roteiro`,scripts.every(s=>s===scripts[0]));
   const starts=await Promise.all(pages.map(p=>p.evaluate(()=>cutscene.transmission.startAt)));
   check(`${count} clientes iniciam com relógios alinhados`,Math.max(...starts)-Math.min(...starts)<250);
   await pages[0].locator('.cutscene-skip').click();
   check(`${count} clientes: voto isolado não muda de fase`,await pages[0].evaluate(()=>!manager.room.hollow.releaseAt));
   if(count===4) {
    await pages[0].evaluate(()=>manager.leaveRoom());
    await pages[0].waitForFunction(()=>cancelled===1);
    await pages[1].waitForFunction(()=>manager.room.players.length===3);
    check('saída do host durante briefing elege sucessor sem bloquear sessão',true);
   }
   const active=count===4?pages.slice(1):pages;
   for(const p of active) await jump(p,'end');
   for(const p of active) await p.waitForFunction(()=>completed===1);
   check(`${count} clientes: fim coordenado aguarda todos`,true);
  }
  for(const p of pages) { await p.evaluate(()=>manager.destroy());await p.close(); }
 }
 // Integração completa: BootPartida -> preloader -> Level1 com assets e cena reais.
 const real=await browser.newPage({viewport:{width:1280,height:720}});
 real.on('pageerror',e=>errors.push(e.stack));
 await real.route('**/js/core/game.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('const game = new Game(jogoRapido);','const game = window.__game = new Game(jogoRapido);')});});
 await real.goto(base);await real.keyboard.press('k');
 await real.waitForFunction(()=>__game?.scene.getScene('preloader')?.cutscene?.gate.assetsReady,null,{timeout:120000});
 await real.evaluate(()=>__game.scene.getScene('preloader').cutscene.video.dispatchEvent(new Event('ended')));
 await real.waitForFunction(()=>!!__game.scene.getScene('preloader').cutscene.transmission.timeline);
 await real.evaluate(()=>{const t=__game.scene.getScene('preloader').cutscene.transmission;t.startAt=Date.now()-t.timeline.duration-1;t.update();});
 await real.waitForFunction(()=>__game.scene.getScene('Level1')?.player?.active,null,{timeout:60000});
 check('fluxo real carrega mapa, preserva Kai e inicia fase 1',await real.evaluate(()=>__game.scene.getScene('Level1').personagemSelecionada==='kai-mercer' && !document.querySelector('.cutscene-loading')));
 await real.close();
 // Duas instâncias completas usam o lobby real e entram na mesma partida.
 const full=[];
 for(let i=0;i<2;i++) {
  const p=await browser.newPage({viewport:{width:960,height:540}});full.push(p);
  p.on('pageerror',e=>errors.push(e.stack));
  await p.route('**/js/core/game.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('const game = new Game(jogoRapido);','const game = window.__game = new Game(jogoRapido);')});});
  await p.goto(base);await p.locator('#start-game').click();
  await p.waitForFunction(()=>window.__game?.scene.isActive('Start'));
  await p.addScriptTag({path:`${root}/node_modules/mqtt/dist/mqtt.min.js`});
  await p.evaluate(async()=>{
   const {default:Mqtt}=await import('/js/mqttClient.js');const {default:Manager}=await import('/js/multiplayer/multiplayerManager.js');
   window.manager=new Manager(new Mqtt({brokerUrl:'ws://127.0.0.1:18884',topicPrefix:'hollow-full'}));
   manager.on('error',console.warn);__game.registry.set('multiplayer',manager);
  });
  await p.waitForFunction(()=>manager.mqtt.connected);
 }
 const fullCode=await full[0].evaluate(()=>manager.createRoom());
 await full[1].evaluate(code=>manager.joinRoom(code),fullCode);
 for(const p of full) await p.waitForFunction(()=>manager.room?.players.length===2);
 await full[0].evaluate(()=>manager.selectCharacter('magnus-force'));await full[1].evaluate(()=>manager.selectCharacter('nyx'));
 for(const p of full) {
  await p.waitForFunction(()=>manager.room.players.every(p=>p.character));
  await p.evaluate(()=>{__game.scene.getScene('Start').scene.start('MultiplayerLobby');manager.setReady(true);});
 }
 await full[0].waitForFunction(()=>manager.canStart());await full[0].evaluate(()=>manager.startGame());
 for(const p of full) {
  await p.waitForFunction(()=>__game.scene.getScene('preloader')?.cutscene?.gate.assetsReady,null,{timeout:120000});
  await p.evaluate(()=>__game.scene.getScene('preloader').cutscene.video.dispatchEvent(new Event('ended')));
 }
 for(const p of full) await p.waitForFunction(()=>!!__game.scene.getScene('preloader').cutscene.transmission.timeline);
 for(const p of full) await p.evaluate(()=>{const t=__game.scene.getScene('preloader').cutscene.transmission;t.startAt=Date.now()-t.timeline.duration-1;t.update();});
 for(const p of full) await p.waitForFunction(()=>__game.scene.getScene('Level1')?.player?.active,null,{timeout:60000});
 check('lobby real leva Magnus e Nyx à mesma partida cooperativa',
  await full[0].evaluate(()=>__game.scene.getScene('Level1').multiplayer && __game.scene.getScene('Level1').personagemSelecionada==='magnus-force') &&
  await full[1].evaluate(code=>__game.scene.getScene('Level1').multiplayer && __game.scene.getScene('Level1').personagemSelecionada==='nyx' && manager.room.roomCode===code,fullCode));
 for(const p of full) {await p.evaluate(()=>manager.destroy());await p.close();}
 await browser.close();
 browser=await firefox.launch({headless:true});
 const ff=await harness(browser,{personagem:'aria-kade'});await endVideo(ff);
 await ff.waitForFunction(()=>cutscene.transmission.index>=0);
 check('Firefox renderiza conexão na mesma TV',await ff.locator('.hollow-messenger').count()===1);
 await ff.locator('.cutscene-skip').click();await ff.waitForFunction(()=>completed===1);
 check('Firefox limpa interface e conclui transição',await ff.locator('.hollow-messenger').count()===0);
 await ff.close();
 assert.deepEqual(errors,[]);
 writeFileSync(`${artifacts}/report.json`,JSON.stringify({checks,errors},null,2));
 console.log(`PASSOU: ${checks.length} verificações`);
} catch(error) { console.error(error);throw error; } finally { await browser?.close();for(const ws of socket.clients) ws.terminate();socket.close();await new Promise(r=>broker.close(r)); }
