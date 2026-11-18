/** Fluxo real Phaser: só deslocamentos longos, energia e combate são acelerados. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { iniciarJogoHacking, entrarFabricaHacking, resolverBreach, tocarInteracaoHacking } from './hacking-browser-helpers.mjs';
import { sceneState, dispensarTutorial, posicionarNullnet, resolverBruteforce, resolverMemoria, capturarHost, verificarLayoutNullnet, verificarPosicaoBotaoNullnet } from './nullnet-browser-helpers.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 740 }, hasTouch: true }); page.setDefaultTimeout(20000);
const errors = [], dir = process.env.ARTIFACT_DIR ?? '/tmp/nullnet-campaign'; mkdirSync(dir, { recursive: true });
page.on('pageerror', e => { errors.push(e.stack); console.error(e.stack); });
try {
  await iniciarJogoHacking(page); await entrarFabricaHacking(page);
  console.log('BOOT: fábrica carregada');
  for (const [width, height] of [[568, 320], [390, 844], [1100, 740]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(100);
    await verificarPosicaoBotaoNullnet(page);
  }
  await page.setViewportSize({ width: 1100, height: 740 });
  await page.getByRole('button', { name: 'NULLNET · ARQUIVOS', exact: true }).click();
  await page.getByRole('dialog', { name: 'NULLNET // INTELLIGENCE DATABASE', exact: true }).waitFor();
  const locked = await page.locator('.axiom-record-overlay').innerText();
  assert.ok(locked.includes('ACESSO BLOQUEADO') && locked.includes('CRIPTOGRAFADO'));
  assert.ok(!locked.includes('Elias Voss') && !locked.includes('EV041_ESCAPE_PROTOCOL.DAT'));
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const s = window.__game.scene.getScene('Level1Parte2'); s.acenderLuzFabrica(); s.player.invulneravel = true; });
  await tocarInteracaoHacking(page); await page.locator('.hacking-overlay').waitFor(); await dispensarTutorial(page);
  const path = resolverBreach((await sceneState(page)).model); assert.ok(path);
  for (const cell of path) await page.locator(`[data-cell="${cell}"]`).click();
  await page.locator('.hacking-overlay').waitFor({ state: 'detached' });
  assert.ok(await page.evaluate(() => window.__game.registry.get('factoryHackingComplete')));
  await page.getByRole('button', { name: 'NULLNET · ARQUIVOS', exact: true }).click();
  await page.getByRole('dialog', { name: 'NULLNET // INTELLIGENCE DATABASE', exact: true }).waitFor();
  assert.ok((await page.locator('.axiom-record-overlay').innerText()).includes('Elias Voss'));
  const firstFiles = await page.locator('.axiom-record-overlay').innerText();
  assert.ok(!firstFiles.includes('EV041_ESCAPE_PROTOCOL.DAT'));
  assert.ok(firstFiles.includes('ACESSO BLOQUEADO · TERMINAL 02'));
  await page.keyboard.press('Escape'); console.log('BREACH: consequências e arquivo recuperado');
  const computer = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('Level1Parte2');
    if (s.children.getByName('EV041-maintenance-computer')) throw new Error('Visual extra de computador não deve existir');
    const { TERMINAIS_HACKING } = await import('/js/puzzles/HackingConfig.js');
    const { x, y } = TERMINAIS_HACKING.bruteforce; return { x, y };
  }); assert.deepEqual(computer, { x: -378, y: -2996 });
  await posicionarNullnet(page, -378, -2938); await tocarInteracaoHacking(page);
  await page.getByRole('dialog', { name: 'AXIOM // BRUTEFORCE', exact: true }).waitFor();
  await dispensarTutorial(page);
  await verificarLayoutNullnet(page); await page.screenshot({ path: `${dir}/bruteforce.png` });
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.__game.registry.get('factoryBruteforceComplete')), undefined);
  await page.getByRole('button', { name: 'NULLNET · ARQUIVOS', exact: true }).click();
  await page.getByRole('button', { name: 'REGISTROS', exact: true }).click();
  const afterCancel = await page.locator('.axiom-record-overlay').innerText();
  assert.ok(afterCancel.includes('ACESSO BLOQUEADO · TERMINAL 02'));
  assert.ok(!afterCancel.includes('EV041_ESCAPE_PROTOCOL.DAT'));
  await page.keyboard.press('Escape');
  await posicionarNullnet(page, -378, -2938); await tocarInteracaoHacking(page); await resolverBruteforce(page);
  await page.getByRole('button', { name: 'NULLNET · ARQUIVOS', exact: true }).click();
  await page.getByRole('button', { name: 'REGISTROS', exact: true }).click();
  assert.ok((await page.locator('.axiom-record-overlay').innerText()).includes('EV041_ESCAPE_PROTOCOL.DAT'));
  await page.keyboard.press('Escape');
  console.log('BRUTEFORCE: cancelamento seguro e recuperação completa');
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2'), a = s.leitorCartaoFabrica.area;
    s.inventory.addItem('card', 1); s.player.body.reset(a.x + a.width / 2, a.y + a.height + 25); s.player.body.updateFromGameObject();
  }); await page.waitForTimeout(350); await tocarInteracaoHacking(page);
  await page.waitForFunction(() => window.__game.registry.get('bossAccessCardAuthenticated') === true, null, { timeout: 25000 });
  await page.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').portasFabrica.filter(p => ['porta02', 'porta03'].includes(p.nome)).every(p => p.estado === 'aberta' && !p.colisao));
  console.log('SENTINEL: cartão e autorização removeram as colisões');
  await page.evaluate(() => { window.__game.scene.getScene('Level1Parte2').novoBoss.morto = true; });
  await posicionarNullnet(page, -300, -5835); await tocarInteracaoHacking(page); await page.locator('.memory-decryption').waitFor();
  await dispensarTutorial(page);
  const config = await page.evaluate(() => window.__game.registry.get('nullnetMission').config);
  await page.getByRole('button', { name: 'CONSULTAR REGISTROS', exact: true }).click();
  await page.getByRole('button', { name: 'AUTENTICAÇÃO', exact: true }).click();
  assert.ok((await page.locator('.axiom-record-overlay').innerText()).includes(config.host));
  await page.keyboard.press('Escape'); assert.equal((await sceneState(page)).model.etapaTipo, 'memory');
  for (const [width, height] of [[568, 320], [390, 844], [1100, 740]]) {
    await page.setViewportSize({ width, height }); await verificarLayoutNullnet(page); await page.screenshot({ path: `${dir}/memory-${width}.png` });
  }
  await resolverMemoria(page, config, 1);
  await page.keyboard.press('Escape'); await page.locator('.nullnet-overlay').waitFor({ state: 'detached' });
  await posicionarNullnet(page, -300, -5835); await tocarInteracaoHacking(page); await page.locator('.memory-decryption').waitFor();
  assert.equal((await sceneState(page)).model.recuperados, 1); console.log('CHECKPOINT: módulo recuperado preservado ao reabrir');
  await resolverMemoria(page, config);
  await page.setViewportSize({ width: 568, height: 320 }); await verificarLayoutNullnet(page);
  await page.screenshot({ path: `${dir}/host-mobile.png` }); await capturarHost(page, config, 1, true);
  await page.locator('.hacking-victory').waitFor({ timeout: 20000 });
  await page.screenshot({ path: `${dir}/final.png` });
  assert.ok((await page.locator('.hacking-victory').innerText()).includes('SUPORTE À VIDA PRESERVADO'));
  assert.equal(await page.evaluate(() => window.__game.registry.get('hostConnectionComplete')), true);
  assert.equal(await page.evaluate(() => window.__game.registry.get('matrixZeroComplete')), true);
  assert.deepEqual(errors, []); writeFileSync(`${dir}/report.json`, JSON.stringify({ status: 'PASS', computer, errors }, null, 2));
  console.log('PASS: campanha, arquivos, coordenadas, cartão, memória, HOST, checkpoints, layouts e Vírus Zero.');
} catch (e) { await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {}); console.error(await sceneState(page).catch(() => null)); throw e; }
finally { await browser.close(); }
