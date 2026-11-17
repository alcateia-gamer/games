/** Leitura com controlador real em cenas Phaser pequenas; conexão/progresso são fixtures. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const errors = [], pasta = process.env.ARTIFACT_DIR ?? '/tmp/hacking-record'; mkdirSync(pasta, { recursive: true });
const context = await browser.newContext({ viewport: { width: 1100, height: 700 } });
const pages = [], report = {};
async function iniciar(mode) {
  const p = await context.newPage(); pages.push(p); p.on('pageerror', e => errors.push(e.stack));
  p.setDefaultTimeout(15000);
  await p.goto(process.env.BASE_URL ?? 'http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
  await p.evaluate(async mode => {
    document.querySelector('#game-container')?.remove();
    document.body.style.cssText = 'display:block;background:#06131d;margin:0;overflow:hidden';
    const { criarFixtureRegistro } = await import('/tests/hacking-record-fixture.mjs');
    window.__registro = await criarFixtureRegistro(mode);
  }, mode);
  assert.equal(await p.locator('.axiom-record-overlay').count(), 0);
  await p.evaluate(() => { window.__registro.concluir(); });
  await p.waitForFunction(() => window.__registro.estado().candidato);
  return p;
}
const estado = p => p.evaluate(() => window.__registro.estado());
async function abrir(p) { await p.keyboard.press('e', { delay: 100 }); await p.locator('.axiom-record-overlay').waitFor(); }
function livre(s) { assert.ok(s.input && s.teclado && !s.menu && !s.movimento && s.moves && !s.pausado); }
try {
  const solo = await iniciar('solo'), antes = (await estado(solo)).snapshot.progress;
  await abrir(solo);
  const texto = await solo.locator('.axiom-record-body').innerText();
  for (const parte of ['comboios de remédios', 'Reset', 'EDEN', 'The Hollow', '04 segundos', 'VISUAL', 'REDE', 'suporte à vida', 'NENHUMA OCORRÊNCIA REGISTRADA']) assert.ok(texto.includes(parte));
  const lendo = await estado(solo); assert.ok(lendo.pausado && !lendo.input && !lendo.teclado && !lendo.moves && lendo.menu);
  await solo.waitForTimeout(200); assert.equal((await estado(solo)).ticks, lendo.ticks);
  for (const [width, height] of [[1100, 700], [568, 320], [390, 844]]) {
    await solo.setViewportSize({ width, height });
    await solo.locator('.axiom-record-body').evaluate(el => { el.scrollTop = 0; });
    const close = await solo.locator('.axiom-record-close').boundingBox(), back = await solo.locator('.axiom-record-return').boundingBox();
    assert.ok(close.height >= 44 && close.y >= 0 && back.y + back.height <= height);
    await solo.screenshot({ path: `${pasta}/inicio-${width}x${height}.png` });
    await solo.locator('.axiom-record-clue').scrollIntoViewIfNeeded();
    await solo.screenshot({ path: `${pasta}/pista-${width}x${height}.png` });
  }
  await solo.keyboard.press('Escape'); await solo.locator('.axiom-record-overlay').waitFor({ state: 'detached' }); livre(await estado(solo));
  await abrir(solo); await solo.locator('.axiom-record-return').click(); livre(await estado(solo));
  assert.deepEqual((await estado(solo)).snapshot.progress, antes); assert.equal((await estado(solo)).snapshot.session, null);
  await abrir(solo); await solo.evaluate(() => { window.__registro.morrer(); });
  await solo.locator('.axiom-record-overlay').waitFor({ state: 'detached' }); livre(await estado(solo));
  await solo.evaluate(() => { window.__registro.recuperar(); });
  await abrir(solo); await solo.evaluate(() => { window.__registro.parar(); });
  await solo.locator('.axiom-record-overlay').waitFor({ state: 'detached' });
  await solo.waitForFunction(() => !window.__registro.estado().ativo);
  report.solo = { texto: true, layouts: true, releitura: true, progressoPreservado: true, morte: true, shutdown: true };
  await solo.close();
  const host = await iniciar('host'), client = await iniciar('client');
  await abrir(client); assert.equal(await host.locator('.axiom-record-overlay').count(), 0);
  const tick = (await estado(client)).ticks; await client.waitForTimeout(200);
  assert.ok((await estado(client)).ticks > tick && !(await estado(client)).pausado);
  await abrir(host); assert.equal(await client.locator('.axiom-record-overlay').count(), 1);
  await client.locator('.axiom-record-close').click(); livre(await estado(client));
  assert.equal(await host.locator('.axiom-record-overlay').count(), 1);
  await host.keyboard.press('Escape'); await host.locator('.axiom-record-overlay').waitFor({ state: 'detached' }); livre(await estado(host));
  await abrir(client); await client.evaluate(() => { window.__registro.desconectar(); });
  await client.locator('.axiom-record-overlay').waitFor({ state: 'detached' }); livre(await estado(client));
  assert.deepEqual((await estado(host)).snapshot.progress, antes);
  report.contextosCoop = { leituraIndependente: true, mundoContinua: true, desconexaoFecha: true };
  assert.deepEqual(errors, []); writeFileSync(`${pasta}/relatorio.json`, JSON.stringify({ ...report, errors }, null, 2));
  console.log('PASS: registro, texto, três layouts, releitura, controles, morte, shutdown e contextos cooperativos.');
} catch (error) {
  console.error(error); writeFileSync(`${pasta}/parcial.json`, JSON.stringify({ ...report, errors }, null, 2)); throw error;
} finally { await browser.close(); }
