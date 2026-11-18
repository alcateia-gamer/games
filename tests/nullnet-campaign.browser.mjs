/** Fluxo real Phaser: só deslocamentos longos, energia e combate são acelerados. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { assumirControleHacking, iniciarJogoHacking, entrarFabricaHacking, resolverBreach, tocarInteracaoHacking } from './hacking-browser-helpers.mjs';
import { sceneState, dispensarTutorial, posicionarNullnet, resolverBruteforce, resolverMemoria, capturarHost, verificarLayoutNullnet, verificarPosicaoBotaoNullnet, lerRelogio, observarConfirmacaoFinal, simularCredito, verificarConclusao } from './nullnet-browser-helpers.mjs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 740 }, hasTouch: true }); page.setDefaultTimeout(20000);
const errors = [], dir = process.env.ARTIFACT_DIR ?? '/tmp/nullnet-campaign'; mkdirSync(dir, { recursive: true });
page.on('pageerror', e => { errors.push(e.stack); console.error(e.stack); });
try {
  const { chamadas, autorizacao } = await simularCredito(page, 'conta-solo');
  await iniciarJogoHacking(page);
  await page.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
  await page.waitForFunction(() => document.querySelector('.run-timer')?.textContent !== '00:00' && document.querySelector('.run-timer'));
  const cidade = await lerRelogio(page);
  await entrarFabricaHacking(page);
  assert.ok((await lerRelogio(page)).ms > cidade.ms);
  console.log('BOOT: fábrica carregada');
  for (const [width, height] of [[568, 320], [390, 844], [1100, 740]]) {
    await page.setViewportSize({ width, height });
    await verificarPosicaoBotaoNullnet(page);
    const hud = await page.evaluate(() => {
      const s = window.__game.scene.getScene('Level1Parte2'), { elemento, cronometro } = s.hudStatus;
      const barra = elemento.getBoundingClientRect(), tempo = cronometro.getBoundingClientRect();
      return { centro: tempo.left + tempo.width / 2, topo: tempo.top, largura: tempo.width,
        fonte: parseFloat(getComputedStyle(cronometro).fontSize),
        sobreposicao: tempo.bottom > barra.top && tempo.top < barra.bottom && tempo.left < barra.right };
    });
    assert.ok(Math.abs(hud.centro - width / 2) <= 1 && hud.topo <= 8);
    assert.ok(hud.largura >= 110 && hud.fonte >= 18);
    assert.equal(hud.sobreposicao, false);
    await page.screenshot({ path: `${dir}/cronometro-${width}.png` });
  }
  await page.setViewportSize({ width: 1100, height: 740 });
  await page.getByRole('button', { name: 'NULLNET · ARQUIVOS', exact: true }).click();
  await page.getByRole('dialog', { name: 'NULLNET // INTELLIGENCE DATABASE', exact: true }).waitFor();
  const locked = await page.locator('.axiom-record-overlay').innerText();
  assert.ok(locked.includes('ACESSO BLOQUEADO') && locked.includes('CRIPTOGRAFADO'));
  assert.ok(!locked.includes('Elias Voss') && !locked.includes('EV041_ESCAPE_PROTOCOL.DAT'));
  const pausado = await lerRelogio(page);
  await page.waitForTimeout(1100);
  assert.deepEqual(await lerRelogio(page), pausado);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
  assert.ok((await lerRelogio(page)).ms > pausado.ms);
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
  await observarConfirmacaoFinal(page);
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
  const antesDoErro = await lerRelogio(page);
  await page.locator(`[data-server="${config.seguranca[0]}"]`).tap();
  assert.equal((await sceneState(page)).model.erros[0], 1);
  await page.waitForTimeout(150);
  const depoisDoErro = await lerRelogio(page);
  assert.equal(depoisDoErro.resultado, null);
  assert.ok(depoisDoErro.ms > antesDoErro.ms);
  assert.equal(await page.locator('.hacking-victory').count(), 0);
  await resolverMemoria(page, config, 1);
  const antesDeCancelar = await lerRelogio(page);
  await page.keyboard.press('Escape'); await page.locator('.nullnet-overlay').waitFor({ state: 'detached' });
  assert.equal(await page.locator('.hacking-victory').count(), 0);
  await posicionarNullnet(page, -300, -5835); await tocarInteracaoHacking(page); await page.locator('.memory-decryption').waitFor();
  const reaberto = await lerRelogio(page);
  assert.equal(reaberto.resultado, null);
  assert.ok(reaberto.ms > antesDeCancelar.ms);
  assert.equal((await sceneState(page)).model.recuperados, 1); console.log('CHECKPOINT: módulo recuperado preservado ao reabrir');
  await resolverMemoria(page, config);
  await page.setViewportSize({ width: 568, height: 320 }); await verificarLayoutNullnet(page);
  await page.screenshot({ path: `${dir}/host-mobile.png` }); await capturarHost(page, config, 1, true);
  const transmitindo = await lerRelogio(page);
  assert.equal(transmitindo.resultado, null);
  assert.equal(await page.locator('.hacking-victory').count(), 0);
  assert.equal(chamadas.length, 0);
  await page.waitForTimeout(1000);
  assert.ok((await lerRelogio(page)).ms > transmitindo.ms);
  const resultado = await verificarConclusao(page, true, 'Você recebeu 550 tijolinhos');
  assert.deepEqual(chamadas, [{ corpo: { product: 85, value: 550 }, autorizacao }]);
  assert.deepEqual(await page.evaluate(() => window.__confirmacoes), [{ resultado, ms: resultado.tempoMs }]);
  await page.screenshot({ path: `${dir}/final.png` });
  assert.equal(await page.evaluate(() => window.__game.registry.get('hostConnectionComplete')), true);
  assert.equal(await page.evaluate(() => window.__game.registry.get('matrixZeroComplete')), true);
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Jogar novamente', exact: true }).tap(),
  ]);
  await assumirControleHacking(page);
  assert.equal(await page.locator('.run-timer').textContent(), '00:00');
  assert.equal((await lerRelogio(page)).resultado, null);
  assert.equal(await page.locator('.hacking-victory').count(), 0);
  assert.deepEqual(errors, []); writeFileSync(`${dir}/report.json`, JSON.stringify({ status: 'PASS', computer, errors }, null, 2));
  console.log('PASS: campanha, arquivos, coordenadas, cartão, memória, HOST, checkpoints, layouts e Vírus Zero.');
} catch (e) { await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {}); console.error(await sceneState(page).catch(() => null)); throw e; }
finally { await browser.close(); }
