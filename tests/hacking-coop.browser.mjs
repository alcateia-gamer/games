/** Duas instâncias completas e MQTT/WebSocket local: sessão única e operador cliente. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { iniciarJogoHacking, entrarFabricaHacking, resolverBreach, tocarInteracaoHacking } from './hacking-browser-helpers.mjs';
import { MATRIX_NODES as N } from '../js/puzzles/HackingConfig.js';
const tools = process.env.HACKING_TEST_TOOLS ?? '/tmp/hacking-browser-tools', require = createRequire(import.meta.url);
const broker = require(`${tools}/node_modules/aedes`)();
const { WebSocketServer, createWebSocketStream } = require(`${tools}/node_modules/ws`);
const ws = new WebSocketServer({ host: '127.0.0.1', port: 18884 });
ws.on('connection', socket => broker.handle(createWebSocketStream(socket)));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? `${tools}/node_modules/playwright-core/index.mjs`);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'] });
const context = await browser.newContext({ viewport: { width: 960, height: 600 } });
const pages = [], errors = [], report = {}, pasta = process.env.ARTIFACT_DIR ?? '/tmp/hacking-coop'; mkdirSync(pasta, { recursive: true });
async function boot() {
  const page = await context.newPage(); pages.push(page); page.setDefaultTimeout(25000);
  page.on('pageerror', e => { errors.push(e.stack); console.error(e.stack); });
  await iniciarJogoHacking(page); await page.addScriptTag({ path: `${tools}/node_modules/mqtt/dist/mqtt.min.js` });
  await page.evaluate(async () => {
    const { default: Client } = await import('/js/mqttClient.js');
    const { default: Manager } = await import('/js/multiplayer/multiplayerManager.js');
    const mqtt = new Client({ brokerUrl: 'ws://127.0.0.1:18884', topicPrefix: 'hacking-test' });
    window.__manager = new Manager(mqtt); window.__game.registry.set('multiplayer', window.__manager);
  });
  await page.waitForFunction(() => window.__manager.mqtt.connected); console.log(`BOOT: instância ${pages.length} pronta.`); return page;
}
async function posicionar(page, x, y) {
  await page.evaluate(({ x, y }) => {
    const s = window.__game.scene.getScene('Level1Parte2'); s.player.body.reset(x, y); s.player.body.updateFromGameObject();
    s.player.invulneravel = true; s.player.setVelocity(0, 0);
  }, { x, y }); await page.waitForTimeout(250);
}
async function concluirMatrix(page, host) {
  const estado = () => page.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model);
  const autoridade = () => host.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.snapshot().session);
  // Teclado real já foi verificado acima e o percurso solo usa teclas. Aqui, pulsos
  // pelo mesmo controlador de entrada permitem verificar toda a rede sem deixar
  // teclas pressionadas enquanto o teste espera uma réplica do outro navegador.
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('MatrixHacking');
    s.lastInput = Infinity; s.ultimaDirecao = '0:0';
    s.controller.enviar({ op: 'mover', x: 0, y: 0 });
  });
  await page.waitForTimeout(500);
  async function andar(no) {
    const dest = N[no];
    for (let i = 0; i < 120; i++) {
      const { model } = await autoridade(), { avatar } = model;
      const dx = dest.x - avatar.x, dy = dest.y - avatar.y;
      if (Math.hypot(dx, dy) < 30 && model.proximo === no) {
        await page.waitForFunction(no => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model.proximo === no, no);
        console.log(`MATRIX: ${no}.`); return;
      }
      await page.evaluate(({ x, y }) => window.__game.scene.getScene('MatrixHacking').controller.enviar({ op: 'mover', x, y }),
        { x: Math.abs(dx) > 16 ? Math.sign(dx) : 0, y: Math.abs(dy) > 16 ? Math.sign(dy) : 0 });
      await host.waitForFunction(p => {
        const a = window.__game.scene.getScene('Level1Parte2').hackingTerminals.snapshot().session.model.avatar;
        return Math.hypot(a.x - p.x, a.y - p.y) > 5;
      }, avatar);
      const movimento = (await autoridade()).seq;
      await page.evaluate(() => window.__game.scene.getScene('MatrixHacking').controller.enviar({ op: 'mover', x: 0, y: 0 }));
      await host.waitForFunction(seq => window.__game.scene.getScene('Level1Parte2').hackingTerminals.snapshot().session.seq > seq, movimento);
      const parada = (await autoridade()).seq;
      await page.waitForFunction(seq => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.seq >= seq, parada);
    }
    throw new Error(`MATRIX cooperativa não alcançou ${no}: ${JSON.stringify(await estado())}`);
  }
  async function agir() { await page.locator('.matrix-action').click(); await page.waitForTimeout(250); }
  await andar('memoria'); await page.locator('.matrix-memory input').fill('4'); await page.waitForTimeout(200);
  await page.locator('.examinar').click(); await page.waitForTimeout(200);
  await page.locator('[data-layer="rede"]').click(); await page.waitForTimeout(200); await page.locator('.examinar').click();
  await page.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model.anomalia);
  await andar('anomalia'); await agir(); await andar('roteador'); await agir(); await agir();
  assert.equal((await estado()).rota, 'desvio');
  await andar('vidaA'); await agir(); await andar('vidaB'); await agir();
  await andar('comunicacao'); await agir(); await andar('desvio'); await andar('abrigo'); await agir(); await andar('entrada'); await agir();
  await page.waitForFunction(() => document.querySelector('.hacking-victory'), null, { timeout: 60000 });
}
try {
  console.log('BOOT: host e cliente para os puzzles.');
  const host = await boot(), client = await boot();
  const code = await host.evaluate(() => window.__manager.createRoom());
  await client.evaluate(code => window.__manager.joinRoom(code), code);
  await host.waitForFunction(() => window.__manager.room.players.length === 2);
  await host.evaluate(() => window.__manager.selectCharacter('kai-mercer'));
  await client.evaluate(() => window.__manager.selectCharacter('nyx'));
  for (const p of pages) { await p.waitForFunction(() => window.__manager.room.players.every(p => p.character)); await p.evaluate(() => window.__manager.setReady(true)); }
  await host.waitForFunction(() => window.__manager.canStart()); await host.evaluate(() => window.__manager.startGame());
  await client.waitForFunction(() => window.__manager.room.status === 'PLAYING');
  await Promise.all(pages.map(p => entrarFabricaHacking(p, true)));
  console.log('BOOT: ambas as instâncias na fábrica.');
  await host.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').coopRuntime.players.remotes.size === 1);
  await host.evaluate(() => window.__game.scene.getScene('Level1Parte2').acenderLuzFabrica());
  await client.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').luzFabricaAcesa);
  for (const p of pages) await posicionar(p, 1000, -1896);
  await tocarInteracaoHacking(client); await client.locator('.hacking-overlay').waitFor();
  assert.equal(await host.locator('.hacking-overlay').count(), 0);
  assert.equal(await host.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.enviar({ op: 'abrir', tipo: 'fabrica' })), false);
  report.dock = await host.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2'), session = s.hackingTerminals.snapshot().session;
    const ctx = s.coopRuntime.players.remotes.get(session.owner).context;
    return { owner: session.owner, client: session.owner !== s.coopRuntime.manager.playerId,
      pet: { x: ctx.companionPet.x, y: ctx.companionPet.y }, travado: ctx.hackingAtivo };
  }); assert.ok(report.dock.client && report.dock.travado); assert.equal(report.dock.pet.x, 1032);
  await client.screenshot({ path: `${pasta}/01-cliente-breach.png` });
  const estadoAntesDeSair = await host.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.snapshot());
  await client.locator('.hacking-close').click();
  await host.waitForFunction(() => !window.__game.scene.getScene('Level1Parte2').hackingTerminals.temSessao());
  await client.locator('.hacking-overlay').waitFor({ state: 'detached' });
  await client.evaluate(state => window.__game.scene.getScene('Level1Parte2').hackingTerminals.receberSnapshot(state), estadoAntesDeSair);
  assert.equal(await client.locator('.hacking-overlay').count(), 0, 'snapshot atrasado não reabre sessão encerrada');
  console.log('PASS: cancelamento do cliente liberou o terminal.');
  await posicionar(client, 1000, -1896); await tocarInteracaoHacking(client); await client.locator('.hacking-overlay').waitFor();
  const puzzle = await client.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal().model);
  const path = resolverBreach(puzzle); assert.ok(path);
  for (const cell of path) {
    await client.locator(`[data-cell="${cell}"]`).click({ force: true });
    await client.waitForFunction(cell => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model.selecoes.includes(cell), cell);
    console.log(`BREACH: célula ${cell}.`);
  }
  for (const p of pages) await p.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.permitePortas());
  await client.locator('.hacking-overlay').waitFor({ state: 'detached' });
  report.progressos = await Promise.all(pages.map(p => p.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.snapshot().progress)));
  assert.deepEqual(report.progressos[0], report.progressos[1]);
  console.log('PASS: cliente resolve, exclusividade, cancelamento e progresso compartilhado.');
  await tocarInteracaoHacking(client); await client.locator('.axiom-record-overlay').waitFor();
  assert.equal(await host.locator('.axiom-record-overlay').count(), 0);
  assert.ok((await client.locator('.axiom-record-body').innerText()).includes('04 segundos'));
  await tocarInteracaoHacking(host); await host.locator('.axiom-record-overlay').waitFor();
  for (const p of pages) assert.ok(await p.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    return !s.physics.world.isPaused && !s.hackingTerminals.temSessao() && s.hackingTerminals.snapshot().dock === null;
  }));
  await client.locator('.axiom-record-return').click();
  assert.equal(await host.locator('.axiom-record-overlay').count(), 1);
  await host.keyboard.press('Escape'); await host.locator('.axiom-record-overlay').waitFor({ state: 'detached' });
  const depoisLeitura = await Promise.all(pages.map(p => p.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    return { progress: s.hackingTerminals.snapshot().progress, livre: s.input.enabled && s.input.keyboard.enabled && !s.generatorMenuOpen && !s.movimentoBloqueado && s.player.body.moves };
  })));
  depoisLeitura.forEach((r, i) => { assert.ok(r.livre); assert.deepEqual(r.progress, report.progressos[i]); });
  report.registroConsultavel = { leituraIndependente: true, semPausarCoop: true, progressoPreservado: true };
  await client.screenshot({ path: `${pasta}/registro-releitura.png` });
  if (process.env.HACKING_PHASE === 'records') {
    await tocarInteracaoHacking(client); await client.locator('.axiom-record-overlay').waitFor();
    await client.screenshot({ path: `${pasta}/registro-cliente.png` });
    await client.evaluate(() => window.__manager.leaveRoom());
    await client.locator('.axiom-record-overlay').waitFor({ state: 'detached' });
    assert.ok(await client.evaluate(() => {
      const s = window.__game.scene.getScene('Level1Parte2'); return s.input.enabled && s.input.keyboard.enabled && !s.generatorMenuOpen && !s.movimentoBloqueado;
    }));
    report.registroConsultavel.desconexaoFecha = true; assert.deepEqual(errors, []);
    writeFileSync(`${pasta}/relatorio.json`, JSON.stringify({ ...report, errors }, null, 2));
    console.log('PASS: registro local simultâneo, releitura e fechamento na desconexão.');
  } else {
  await posicionar(host, -1093, -5520);
  await host.evaluate(() => window.__game.scene.getScene('Level1Parte2').novoBoss.receberDano(100000));
  for (const p of pages) await p.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').novoBoss?.morto);
  await posicionar(client, -240, -5830); await tocarInteracaoHacking(client); await client.locator('.matrix-ui').waitFor();
  assert.equal(await client.evaluate(() => window.__game.scene.getScene('Level1Parte2').sys.settings.visible), false);
  assert.equal(await host.evaluate(() => window.__game.scene.getScene('Level1Parte2').sys.settings.visible), true);
  await client.keyboard.down('w');
  await host.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.snapshot().session?.model.avatar.y < 330);
  await client.keyboard.up('w');
  await client.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model.avatar.y < 330);
  await client.screenshot({ path: `${pasta}/02-cliente-matrix.png` });
  await client.locator('.matrix-close').click();
  await host.waitForFunction(() => !window.__game.scene.getScene('Level1Parte2').hackingTerminals.temSessao());
  await client.locator('.matrix-ui').waitFor({ state: 'detached' });
  assert.ok(await client.evaluate(() => { const s = window.__game.scene.getScene('Level1Parte2'); return !s.generatorMenuOpen && !s.movimentoBloqueado && s.input.keyboard.enabled && s.sys.settings.visible; }));
  await posicionar(client, -240, -5830); await tocarInteracaoHacking(client); await client.locator('.matrix-ui').waitFor();
  if (process.env.HACKING_COOP_FINISH === '1') {
    await concluirMatrix(client, host);
    for (const p of pages) await p.locator('.hacking-victory').waitFor();
    const result = await host.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.snapshot());
    assert.ok(result.progress.final && result.session.model.vida.A && result.session.model.vida.B && result.session.model.vida.preservada);
    assert.equal(result.dock, null);
    assert.ok(await host.evaluate(() => {
      const s = window.__game.scene.getScene('Level1Parte2'), owner = s.hackingTerminals.snapshot().session.owner;
      const c = s.coopRuntime.players.remotes.get(owner).context;
      return !c.hackingAtivo && !c.companionPet;
    }));
    report.final = result; assert.deepEqual(errors, []);
    await client.screenshot({ path: `${pasta}/03-conclusao-compartilhada.png` });
    writeFileSync(`${pasta}/relatorio.json`, JSON.stringify({ ...report, errors }, null, 2));
    console.log('PASS: cliente conduziu o vírus até o núcleo, host validou e ambos receberam a conclusão.');
  } else {
  await client.evaluate(() => window.__manager.leaveRoom());
  await host.waitForFunction(() => !window.__game.scene.getScene('Level1Parte2').hackingTerminals.temSessao());
  await client.locator('.matrix-ui').waitFor({ state: 'detached' });
  assert.ok(await host.evaluate(() => !window.__game.scene.getScene('Level1Parte2').game.registry.get('matrixZeroComplete')));
  assert.deepEqual(errors, []); report.disconnect = true;
  writeFileSync(`${pasta}/relatorio.json`, JSON.stringify({ ...report, errors }, null, 2));
  console.log('PASS: MATRIX do cliente usa simulação do host; cancelamento e desconexão liberam sessão e controles.');
  }
  }
} catch (error) {
  console.error('FALHA', error);
  report.diagnostico = await Promise.all(pages.map(p => p.evaluate(() => {
    const s = window.__game?.scene.getScene('Level1Parte2');
    return { host: s?.coopRuntime?.host, vida: s?.vida, morte: s?.morteEmAndamento,
      input: s?.input.enabled, sessao: s?.hackingTerminals?.snapshot(), local: s?.hackingTerminals?.estadoLocal(),
      sequence: window.__manager?.coopReceivedSequence, room: window.__manager?.room?.status };
  }).catch(e => ({ erro: String(e) }))));
  console.error('DIAG', JSON.stringify(report.diagnostico));
  for (const [i, p] of pages.entries()) await p.screenshot({ path: `${pasta}/falha-${i}.png` }).catch(() => {});
  writeFileSync(`${pasta}/parcial.json`, JSON.stringify({ ...report, errors }, null, 2)); throw error;
} finally {
  await browser.close(); for (const socket of ws.clients) socket.terminate(); ws.close(); await new Promise(resolve => broker.close(resolve));
}
