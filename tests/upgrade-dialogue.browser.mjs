/** Integração real: Phaser, DOM, recortes originais e dois clientes MQTT locais. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const root = process.env.ROBOT_TEST_TOOLS || '/tmp/nullborns-test-tools';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || `${root}/node_modules/playwright/index.mjs`);
const require = createRequire(import.meta.url);
const broker = require(`${root}/node_modules/aedes`)();
const { WebSocketServer, createWebSocketStream } = require(`${root}/node_modules/ws`);
const socket = new WebSocketServer({ host: '127.0.0.1', port: 18885 });
socket.on('connection', ws => broker.handle(createWebSocketStream(ws)));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--disable-features=LocalNetworkAccessChecks'] });
const artifacts = process.env.ARTIFACT_DIR || '/tmp/upgrade-dialogue'; mkdirSync(artifacts, { recursive: true });
const pages = [], errors = [];
const log = label => console.log('OK', label);
async function page() {
  const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); pages.push(p);
  p.on('pageerror', e => errors.push(e.stack));
  await p.route('**/js/core/game.js*', async r => { const response = await r.fetch(); await r.fulfill({ response,
    body: (await response.text()).replace('const game = new Game(jogoRapido);', 'const game = window.__game = new Game(jogoRapido);') }); });
  await p.goto(process.env.GAME_URL || 'http://127.0.0.1:8765'); return p;
}
async function near(p) {
  if (await p.locator('.scrap-tutorial').count()) await p.getByRole('button', { name: 'ENTENDI', exact: true }).click();
  await p.evaluate(() => { const s = __game.scene.getScene('Level1'); s.player.body.reset(-410, 8872); s.player.setVelocity(0, 0); s.cameras.main.stopFollow().centerOn(-410, 8850); });
  await p.waitForFunction(() => !!__game.scene.getScene('Level1').interacaoCiberneticasProxima);
}
async function finish(p) {
  // Usa o mesmo caminho do clique, sem esperar todas as pausas de leitura.
  await p.evaluate(() => { const d = __game.scene.getScene('Level1').upgradeDialogue; while (d.active) d.advance(); });
  await p.locator('.upgrade-terminal:not([hidden])').waitFor();
}
try {
  const solo = await page(); await solo.keyboard.press('k');
  await solo.locator('.cutscene-skip').waitFor(); await solo.locator('.cutscene-skip').click();
  await solo.waitForFunction(() => __game.scene.getScene('Level1')?.player?.active, null, { timeout: 120000 });
  await near(solo); await solo.keyboard.press('e', { delay: 100 }); await solo.locator('.npc-dialogue').waitFor();
  assert.equal(await solo.locator('.npc-portraits img').count(), 2);
  await solo.waitForFunction(() => __game.scene.getScene('Level1').upgradeDialogue.writer.index > 0);
  await solo.locator('[data-text]').click();
  assert.equal(await solo.evaluate(() => { const d = __game.scene.getScene('Level1').upgradeDialogue; return d.writer.complete && d.index === 0; }), true);
  await solo.keyboard.press('e', { delay: 100 });
  assert.equal(await solo.evaluate(() => __game.scene.getScene('Level1').upgradeDialogue.index), 1);
  await solo.screenshot({ path: `${artifacts}/kai.png` }); log('Kai solo, dois retratos, typewriter e mouse/E sem salto duplo');
  await finish(solo); await solo.locator('[data-close]').click();
  for (const character of ['nyx', 'aria-kade', 'magnus-force']) {
    await solo.evaluate(character => { const s = __game.scene.getScene('Level1'); s.personagemSelecionada = character; s.upgradeDialogue.open(); }, character);
    assert.equal(await solo.evaluate(() => __game.scene.getScene('Level1').upgradeDialogue.lines[0].text),
      await solo.evaluate(async character => (await import('/js/narrative/NPCDialogues.js')).NPC_DIALOGUES[character].first[0].text, character));
    assert.equal(await solo.locator('.npc-portraits img').evaluateAll(images => images.every(i => i.complete && i.naturalWidth > 0)), true);
    await solo.screenshot({ path: `${artifacts}/${character}.png` });
    await solo.keyboard.press('Escape');
  }
  log('Nyx, Aria e Magnus: falas exclusivas e retratos carregados');
  await solo.evaluate(() => { const d = __game.scene.getScene('Level1').upgradeDialogue; d.config = { characterMs: 1, punctuationMs: 0, holdMs: 40 }; d.open(); });
  await solo.locator('.upgrade-terminal:not([hidden])').waitFor({ timeout: 15000 }); log('conversa inteira avança automaticamente e abre loja');
  await solo.locator('[data-close]').click();
  for (const viewport of [{ width: 390, height: 844 }, { width: 640, height: 360 }]) {
    await solo.setViewportSize(viewport);
    await solo.evaluate(() => { const d = __game.scene.getScene('Level1').upgradeDialogue; d.config.characterMs = 30; d.config.holdMs = 1000; d.open(); });
    assert.equal(await solo.locator('.npc-dialogue-box').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }), true);
    await solo.screenshot({ path: `${artifacts}/responsive-${viewport.width}.png` }); await solo.keyboard.press('Escape');
  }
  log('interface dentro da tela em retrato e paisagem');
  for (let n = 0; n < 5; n++) { await solo.evaluate(() => __game.scene.getScene('Level1').upgradeDialogue.open()); await solo.keyboard.press('Escape'); }
  assert.equal(await solo.locator('.npc-dialogue').count(), 0); log('abrir e fechar repetidamente remove DOM');
  await solo.close();

  const peers = [await page(), await page()];
  for (const p of peers) {
    await p.locator('#start-game').click(); await p.waitForFunction(() => window.__game?.scene.isActive('Start'));
    await p.addScriptTag({ path: `${root}/node_modules/mqtt/dist/mqtt.min.js` });
    await p.evaluate(async () => {
      const { default: Mqtt } = await import('/js/mqttClient.js'), { default: Manager } = await import('/js/multiplayer/multiplayerManager.js');
      window.manager = new Manager(new Mqtt({ brokerUrl: 'ws://127.0.0.1:18885', topicPrefix: 'dialogue-test' }));
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
  for (const p of peers) {
    await p.waitForFunction(() => __game.scene.getScene('Level1')?.coopRuntime, null, { timeout: 60000 });
    await p.locator('.scrap-tutorial').waitFor();
    assert.equal(await p.locator('.scrap-guide-team').count(), 1);
  }
  await peers[0].getByRole('button', {name:'ENTENDI',exact:true}).click();
  assert.equal(await peers[1].locator('.scrap-tutorial').count(), 1);
  assert.equal(await peers[1].evaluate(() => __game.scene.getScene('Level1').input.enabled), false);
  for (const p of peers) await near(p);
  await peers[0].evaluate(async () => {
    const s=__game.scene.getScene('Level1'), {economyFor}=await import('/js/systems/UpgradeSystem.js');
    const e=economyFor(s); e.drops['indicator-coop']={id:'indicator-coop',mapKey:'Level1',x:s.player.x+150,y:s.player.y,quantity:1};
    e.revision++;s.scrapSystem.changed();
  });
  for (const p of peers) await p.waitForFunction(() => __game.scene.getScene('Level1').scrapSystem.indicators.has('indicator-coop'));
  await peers[0].evaluate(async () => {
    const s=__game.scene.getScene('Level1'), {economyFor}=await import('/js/systems/UpgradeSystem.js');
    const e=economyFor(s);delete e.drops['indicator-coop'];e.revision++;s.scrapSystem.changed();
  });
  for (const p of peers) await p.waitForFunction(() => !__game.scene.getScene('Level1').scrapSystem.indicators.has('indicator-coop'));
  log('tutorial independente e indicadores criados/removidos nos dois clientes pela economia autoritativa');
  await peers[0].waitForFunction(() => __game.scene.getScene('Level1').coopRuntime.players.contexts().some(c => Math.abs(c.player.y - 8872) < 10));
  await peers[0].evaluate(async () => {
    const s = __game.scene.getScene('Level1'), { economyFor, walletFor } = await import('/js/systems/UpgradeSystem.js');
    const economy = economyFor(s);
    // Exercita a geração real de drops: Robô Olhão vale 8–14 para a dupla.
    s.scrapSystem.onRobotDeath({tipoRobo:'olhao',upgradeZoneId:'shared-balance-test',x:s.player.x+400,y:s.player.y});
    const generated=Object.values(economy.drops).find(d=>d.x===s.player.x+400);
    if(!generated || generated.quantity<8 || generated.quantity>14)throw new Error('drop da dupla fora da faixa');
    delete economy.drops[generated.id];
    // Drop de teste para exercitar coleta física e crédito compartilhado.
    economy.drops['shared-claim-test']={id:'shared-claim-test',mapKey:'Level1',x:s.player.x,y:s.player.y,quantity:100};
    economy.revision++; s.scrapSystem.changed();
  });
  for(const p of peers) await p.waitForFunction(async()=>{
    const {walletFor}=await import('/js/systems/UpgradeSystem.js');
    return walletFor(__game.scene.getScene('Level1')).scrap===100;
  });
  log('drop ampliado da dupla e coleta creditada uma única vez no caixa da equipe');
  await peers[0].keyboard.press('e', { delay: 100 }); await peers[0].locator('.npc-dialogue').waitFor();
  const before = await peers[1].evaluate(() => __game.scene.getScene('Level1').player.x);
  await peers[1].keyboard.down('d'); await peers[1].waitForTimeout(250); await peers[1].keyboard.up('d');
  assert.ok(Math.abs(await peers[1].evaluate(() => __game.scene.getScene('Level1').player.x) - before) > 5);
  await near(peers[1]); log('jogador livre continua se movimentando durante a conversa do host');
  await peers[1].keyboard.press('e', { delay: 100 }); await peers[1].locator('.npc-dialogue').waitFor();
  assert.equal(await peers[0].evaluate(() => __game.scene.getScene('Level1').personagemSelecionada), 'kai-mercer');
  assert.equal(await peers[1].evaluate(() => __game.scene.getScene('Level1').personagemSelecionada), 'nyx');
  // Mantém a conversa do host aberta durante a compra do cliente.
  await peers[0].evaluate(() => __game.scene.getScene('Level1').upgradeDialogue.config.holdMs = 60000);
  await finish(peers[1]); await peers[1].locator('[data-upgrade="health"]').click(); await peers[1].locator('[data-install]').click();
  await peers[1].waitForFunction(() => __game.scene.getScene('Level1').upgradeShop.level('health') === 1);
  assert.equal(await peers[0].locator('.npc-dialogue').count(), 1);
  assert.equal(await peers[1].evaluate(async () => (await import('/js/systems/UpgradeSystem.js')).walletFor(__game.scene.getScene('Level1')).scrap), 92);
  assert.equal(await peers[0].evaluate(async () => (await import('/js/systems/UpgradeSystem.js')).walletFor(__game.scene.getScene('Level1')).scrap), 92);
  assert.equal(await peers[0].evaluate(()=>__game.scene.getScene('Level1').upgradeShop.level('health')),0);
  assert.ok((await peers[1].locator('[data-balance]').innerText()).includes('SUCATAS DA EQUIPE: 92'));
  log('dois clientes simultâneos: cliente compra com autoridade do host, host continua no diálogo, saldo da equipe sincronizado');
  await peers[1].locator('[data-close]').click(); await peers[1].keyboard.press('e', { delay: 100 }); await peers[1].locator('.npc-dialogue').waitFor();
  await peers[1].evaluate(() => manager.mqtt.disconnect());
  await peers[1].waitForFunction(() => !__game.scene.getScene('Level1').upgradeDialogue.active);
  assert.equal(await peers[1].locator('.npc-dialogue').count(), 0); assert.equal(await peers[0].locator('.npc-dialogue').count(), 1);
  log('desconexão durante conversa remove apenas a UI do cliente');
  assert.deepEqual(errors, []); console.log('PASSOU: diálogos cinematográficos solo e multiplayer');
} catch (error) {
  for (const p of pages) if (!p.isClosed()) console.error('DIAG', await p.evaluate(() => ({
    scenes: __game.scene.getScenes(true).map(s => ({ key: s.sys.settings.key, active: s.upgradeDialogue?.active,
      near: !!s.interacaoCiberneticasProxima, input: s.input.enabled, keyboard: s.input.keyboard?.enabled,
      lock: s.movimentoBloqueado, attack: s.atacando, dash: s.estadoDash?.ativo, vida: s.vida })),
  })).catch(() => null));
  console.error('ERROS', errors); throw error;
} finally {
  for (const p of pages) if (!p.isClosed()) { await p.screenshot({ path: `${artifacts}/final-${pages.indexOf(p)}.png` }).catch(() => {}); }
  await browser.close(); for (const ws of socket.clients) ws.terminate(); socket.close(); await new Promise(resolve => broker.close(resolve));
}
