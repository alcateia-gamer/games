/** Spawns por partida: mapas reais, coleta, reinício e dois clientes MQTT. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const root = process.env.ROBOT_TEST_TOOLS || '/tmp/nullborns-test-tools';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || `${root}/node_modules/playwright/index.mjs`);
const require = createRequire(import.meta.url);
const broker = require(`${root}/node_modules/aedes`)();
const { WebSocketServer, createWebSocketStream } = require(`${root}/node_modules/ws`);
const socket = new WebSocketServer({ host: '127.0.0.1', port: 18886 });
socket.on('connection', ws => broker.handle(createWebSocketStream(ws)));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--disable-features=LocalNetworkAccessChecks'] });
const artifacts = process.env.ARTIFACT_DIR || '/tmp/run-item-spawns'; mkdirSync(artifacts, { recursive: true });
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
  const solo = await page(); await solo.keyboard.press('k', { delay: 100 });
  await solo.locator('.cutscene-skip').waitFor(); await solo.locator('.cutscene-skip').click();
  await solo.waitForFunction(() => __game.scene.getScene('Level1')?.player?.active, null, { timeout: 120000 });
  const snapshot = p => p.evaluate(() => {
    const s = __game.scene.getScenes(true).find(s => s.itensColetaveis);
    return s.itensColetaveis.map(i => ({ uid: i.uniqueId, id: i.itemId, x: i.x, y: i.y, active: i.image.active }));
  });
  const first = await snapshot(solo);
  assert.equal(first.filter(i => i.id === 'gasolina' && i.active).length, 1);
  assert.equal(first.filter(i => i.id === 'bateria' && i.active).length, 1);
  const seed = await solo.evaluate(() => __game.registry.get('nullborns:item-spawns:seed'));
  const battery = first.find(i => i.id === 'bateria');
  await solo.evaluate(({ x, y }) => { const s = __game.scene.getScene('Level1'); s.player.body.reset(x, y); }, battery);
  await solo.waitForFunction(() => __game.scene.getScene('Level1').itemColetavelProximo?.itemId === 'bateria');
  await solo.keyboard.press('e', { delay: 100 });
  await solo.waitForFunction(() => __game.scene.getScene('Level1').inventory.getQuantity('bateria') > 0);
  await solo.evaluate(() => __game.scene.getScene('Level1').scene.restart({ personagem: 'kai-mercer', transicao: true }));
  await solo.waitForFunction(() => __game.scene.getScene('Level1')?.player?.active && __game.scene.getScene('Level1').itensColetaveis?.length === 1);
  assert.deepEqual(await snapshot(solo), first.filter(i => i.id !== 'bateria'));
  assert.equal(await solo.evaluate(() => __game.registry.get('nullborns:item-spawns:seed')), seed);
  log('solo: um galão e uma bateria, escolha preservada e item coletado não reaparece');
  await solo.evaluate(() => __game.scene.getScene('Level1').scene.start('Level1Parte2', { personagem: 'kai-mercer', spawnX: -1253, spawnY: -1873 }));
  await solo.waitForFunction(() => __game.scene.isActive('Level1Parte2') && __game.scene.getScene('Level1Parte2').itensColetaveis?.some(i => i.itemId === 'card'), null, { timeout: 60000 });
  assert.equal((await snapshot(solo)).filter(i => i.id === 'card' && i.active).length, 1);
  log('fábrica: exatamente um cartão real criado');
  await solo.evaluate(() => __game.scene.getScene('Level1Parte2').scene.start('BootPartida', { personagem: 'kai-mercer' }));
  await solo.locator('.cutscene-skip').waitFor(); await solo.locator('.cutscene-skip').click();
  await solo.waitForFunction(() => __game.scene.isActive('Level1') && __game.scene.getScene('Level1')?.player?.active, null, { timeout: 120000 });
  assert.equal((await snapshot(solo)).length, 2);
  assert.equal(await solo.evaluate(() => __game.scene.getScene('Level1').inventory.getQuantity('bateria') > 0), false);
  assert.notEqual(await solo.evaluate(() => __game.registry.get('nullborns:item-spawns:seed')), seed);
  log('nova run sorteia novamente e recria os itens, sem histórico de coleta da run anterior');
  await solo.close();
  const peers = [await page(), await page()];
  for (const p of peers) {
    await p.locator('#start-game').click(); await p.waitForFunction(() => window.__game?.scene.isActive('Start'));
    await p.addScriptTag({ path: `${root}/node_modules/mqtt/dist/mqtt.min.js` });
    await p.evaluate(async () => {
      const { default: Mqtt } = await import('/js/mqttClient.js'), { default: Manager } = await import('/js/multiplayer/multiplayerManager.js');
      window.manager = new Manager(new Mqtt({ brokerUrl: 'ws://127.0.0.1:18886', topicPrefix: 'dialogue-test' }));
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

  const host = await snapshot(peers[0]), client = await snapshot(peers[1]);
  assert.deepEqual(client, host); assert.equal(host.length, 2);
  const seeds = await Promise.all(peers.map(p => p.evaluate(() => manager.room.itemSpawnSeed)));
  assert.equal(seeds[0], seeds[1]); assert.ok(Number.isInteger(seeds[0]));
  log('multiplayer: host sorteia a semente e dois clientes reais criam os mesmos itens nos mesmos pontos');
  assert.deepEqual(errors, []); console.log('PASSOU: spawns garantidos por run');
} finally {
  await browser.close(); for (const ws of socket.clients) ws.terminate(); socket.close(); await new Promise(resolve => broker.close(resolve));
}
