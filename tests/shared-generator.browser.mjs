/** Integração real: Phaser, DOM, recortes originais e dois clientes MQTT locais. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const root = process.env.ROBOT_TEST_TOOLS || '/tmp/nullborns-test-tools';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || `${root}/node_modules/playwright/index.mjs`);
const require = createRequire(import.meta.url);
const broker = require(`${root}/node_modules/aedes`)();
const { WebSocketServer, createWebSocketStream } = require(`${root}/node_modules/ws`);
const socket = new WebSocketServer({ host: '127.0.0.1', port: 18887 });
socket.on('connection', ws => broker.handle(createWebSocketStream(ws)));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--disable-features=LocalNetworkAccessChecks'] });
const artifacts = process.env.ARTIFACT_DIR || '/tmp/shared-generator'; mkdirSync(artifacts, { recursive: true });
const pages = [], errors = [];
const log = label => console.log('OK', label);
async function page() {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); pages.push(p);
  p.on('pageerror', e => errors.push(e.stack));
  await p.route('**/js/core/game.js*', async r => { const response = await r.fetch(); await r.fulfill({ response,
    body: (await response.text()).replace('const game = new Game(jogoRapido);', 'const game = window.__game = new Game(jogoRapido);') }); });
  await p.goto(process.env.GAME_URL || 'http://127.0.0.1:8765'); return p;
}
try {
  const peers = [await page(), await page()];
  for (const p of peers) {
    await p.locator('#start-game').click(); await p.waitForFunction(() => window.__game?.scene.isActive('Start'));
    await p.addScriptTag({ path: `${root}/node_modules/mqtt/dist/mqtt.min.js` });
    await p.evaluate(async () => {
      const { default: Mqtt } = await import('/js/mqttClient.js'), { default: Manager } = await import('/js/multiplayer/multiplayerManager.js');
      window.manager = new Manager(new Mqtt({ brokerUrl: 'ws://127.0.0.1:18887', topicPrefix: 'dialogue-test' }));
      manager.on('error', console.warn); __game.registry.set('multiplayer', manager);
    }); await p.waitForFunction(() => manager.mqtt.connected);
  }
  const code = await peers[0].evaluate(() => manager.createRoom()); await peers[1].evaluate(code => manager.joinRoom(code), code);
  for (const p of peers) await p.waitForFunction(() => manager.room?.players.length === 2);
  for (let i = 0; i < 2; i++) await peers[i].evaluate(i => manager.selectCharacter(['kai-mercer', 'nyx'][i]), i);
  for (const p of peers) { await p.waitForFunction(() => manager.room.players.every(p => p.character)); await p.evaluate(() => { __game.scene.getScene('Start').scene.start('MultiplayerLobby'); manager.setReady(true); }); }
  await peers[0].waitForFunction(() => manager.canStart()); await peers[0].evaluate(() => manager.startGame());
  for (const p of peers) {
    await p.waitForFunction(() => __game.scene.getScene('preloader')?.cutscene?.gate.assetsReady, null, { timeout: 120000 });
    await p.evaluate(() => __game.scene.getScene('preloader').cutscene.video.dispatchEvent(new Event('ended')));
  }
  for (const p of peers) await p.waitForFunction(() => !!__game.scene.getScene('preloader').cutscene.transmission.timeline);
  for (const p of peers) await p.evaluate(() => { const t = __game.scene.getScene('preloader').cutscene.transmission; t.startAt = Date.now() - t.timeline.duration - 1; t.update(); });
  for (const p of peers) { await p.waitForFunction(() => __game.scene.getScene('Level1')?.coopRuntime, null, { timeout: 60000 }); }

  // Os itens ficam separados entre os inventários, como na partida real.
  for(let i=0;i<2;i++) await peers[i].evaluate(i=>{
    const s=__game.scene.getScene('Level1');
    s.inventory.addItem(i===0?'bateria':'gasolina',1,{fuel:1});
    s.player.body.reset(72,-2184);s.player.setVelocity(0,0);
  },i);
  await peers[0].waitForFunction(()=>__game.scene.getScene('Level1').coopRuntime.players.contexts().some(c=>Math.abs(c.player.y+2184)<10));
  await peers[0].evaluate(()=>__game.scene.getScene('Level1').coopRuntime.world.requestMap('Level1Parte2'));
  for(const p of peers) await p.waitForFunction(()=>__game.scene.isActive('Level1Parte2')&&!!__game.scene.getScene('Level1Parte2').coopRuntime,null,{timeout:120000});
  for(const p of peers) await p.evaluate(async()=>{
    const s=__game.scene.getScene('Level1Parte2'),{findGeneratorInteraction}=await import('/js/interactions/FactoryGenerator.js');
    const a=findGeneratorInteraction(s.map).object;
    s.player.body.reset(a.x+a.width/2,a.y+a.height+10);s.player.setVelocity(0,0);
    s.cameras.main.stopFollow().centerOn(a.x+a.width/2,a.y+a.height/2);
  });
  await peers[0].waitForFunction(async()=>{
    const s=__game.scene.getScene('Level1Parte2'),{findGeneratorInteraction,distanceToInteractionArea}=await import('/js/interactions/FactoryGenerator.js');
    const a=findGeneratorInteraction(s.map).object,p=[...s.coopRuntime.players.remotes.values()][0]?.actor;
    return !!p && distanceToInteractionArea((p.body?.center??p).x,(p.body?.center??p).y,a)<48;
  });
  const open=async p=>{
    await p.evaluate(()=>{const s=__game.scene.getScene('Level1Parte2');s.atualizarInteracaoGeradorFabrica();if(!s.interagirGerador())throw Error('gerador fora do alcance');});
    await p.waitForFunction(()=>__game.scene.getScene('Level1Parte2').generatorMenuOpen);
  };
  const coords=async(p,x,y)=>p.evaluate(({x,y})=>{
    const r=__game.canvas.getBoundingClientRect();return{x:r.x+x*r.width/800,y:r.y+y*r.height/450};
  },{x,y});
  const drag=async(p,sx,sy,tx,ty)=>{
    const from=await coords(p,sx,sy),to=await coords(p,tx,ty);
    await p.mouse.move(from.x,from.y);await p.mouse.down();await p.waitForTimeout(80);
    await p.mouse.move(to.x,to.y,{steps:12});await p.mouse.up();
  };
  for(const p of peers) await open(p);
  await drag(peers[0],133,200,318,205);
  for(const p of peers) await p.waitForFunction(()=>!!__game.scene.getScene('Level1Parte2').coopRuntime.world.generator.state.slots.bateria);
  assert.equal(await peers[0].evaluate(()=>__game.scene.getScene('Level1Parte2').inventory.getQuantity('bateria')),0);
  log('bateria de um jogador aparece conectada nos dois painéis');
  // Fechar o painel do contribuinte não cancela seu encaixe.
  await peers[0].keyboard.press('Escape',{delay:100});
  await peers[0].waitForFunction(()=>!__game.scene.getScene('Level1Parte2').generatorMenuOpen);
  await drag(peers[1],133,279,318,315);
  for(const p of peers) await p.waitForFunction(()=>__game.scene.getScene('Level1Parte2').coopRuntime.world.generator.ready());
  await open(peers[0]);
  for(const p of peers) assert.equal(await p.evaluate(()=>__game.scene.getScene('Level1Parte2').children.getByName('generator-modal').list[1].getByName('generator-power').getData('ready')),true);
  log('galão do segundo jogador completa o mesmo circuito; fechar e reabrir preserva os encaixes');
  await peers[0].screenshot({path:`${artifacts}/circuito-host.png`});
  await peers[1].screenshot({path:`${artifacts}/circuito-cliente.png`});
  // Nenhum dos dois precisa continuar carregando ambos os recursos para dar partida.
  for(const p of peers) assert.deepEqual(await p.evaluate(()=>{
    const s=__game.scene.getScene('Level1Parte2');return[s.inventory.getQuantity('bateria'),s.inventory.getQuantity('gasolina')];
  }),[0,0]);
  const power=await coords(peers[1],604,356);await peers[1].mouse.click(power.x,power.y);
  for(const p of peers) await p.waitForFunction(()=>__game.scene.getScene('Level1Parte2').luzFabricaAcesa);
  for(const p of peers) await p.waitForFunction(()=>!__game.scene.getScene('Level1Parte2').generatorMenuOpen);
  const starts=await Promise.all(peers.map(p=>p.evaluate(()=>manager.room.coopProgress.generatorStartedAt)));
  assert.equal(starts[0],starts[1]);
  for(const p of peers) assert.equal(await p.evaluate(()=>!!__game.scene.getScene('Level1Parte2').movimentoBloqueado),false);
  log('cliente liga o gerador da equipe sem possuir os dois itens; luz e fechamento sincronizados');
  assert.deepEqual(errors,[]);console.log('PASSOU: gerador compartilhado com dois clientes reais e arraste de peças');
} catch(error) {
  for(const p of pages) if(!p.isClosed())console.error('DIAG',await p.evaluate(()=>({
    scenes:__game.scene.getScenes(true).map(s=>({key:s.sys.settings.key,x:s.player?.x,y:s.player?.y,open:s.generatorMenuOpen,
      power:s.luzFabricaAcesa,slots:s.coopRuntime?.world.generator.state,inventory:s.inventory?.getSlots()}))
  })).catch(()=>null));
  console.error(errors);throw error;
} finally {
  await browser.close();for(const ws of socket.clients)ws.terminate();socket.close();await new Promise(resolve=>broker.close(resolve));
}
