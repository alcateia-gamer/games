/** Validação visual da abertura por cliente com os tweens reais e snapshots a 12 Hz. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_PATH,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling'] });
const page = await browser.newPage({ viewport: { width: 940, height: 420 } });
const errors = [], pasta = process.env.ARTIFACT_DIR ?? '/tmp/portas-coop'; mkdirSync(pasta, { recursive: true });
page.on('pageerror', e => { errors.push(e.stack); console.error(e.stack); });
page.setDefaultTimeout(15000);
try {
  await page.goto(process.env.BASE_URL ?? 'http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    document.querySelector('#game-container').remove();
    document.body.style.cssText = 'display:block;background:#161b23;overflow:auto;margin:0';
    const { criarFixturePortas } = await import('/tests/portas-coop-fixture.mjs');
    window.__portas = await Promise.race([criarFixturePortas(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Fixture de portas não iniciou em 10 s')), 10000))]);
  });
  const estado = () => page.evaluate(() => window.__portas.estado());
  assert.ok((await estado()).every(p => p.estado === 'fechada' && p.colisao));
  await page.screenshot({ path: `${pasta}/01-fechadas.png` });
  await page.locator('#abrir-porta-cliente').click();
  await page.waitForFunction(() => window.__portas.estado().every(p => p.estado === 'abrindo' && p.progresso > .25));
  const durante = await estado();
  assert.ok(durante.every(p => p.colisao && p.visivel && p.progresso < .95));
  assert.ok(Math.abs(durante[0].progresso - durante[1].progresso) < .15);
  await page.screenshot({ path: `${pasta}/02-abrindo-cliente.png` });
  await page.waitForFunction(() => window.__portas.estado().every(p =>
    p.estado === 'aberta' && !p.colisao && p.aberta));
  const depois = await estado();
  assert.ok(depois.every(p => !p.visivel && p.aberta));
  await page.screenshot({ path: `${pasta}/03-abertas.png` });
  assert.deepEqual(errors, []);
  writeFileSync(`${pasta}/relatorio.json`, JSON.stringify({ durante, depois, errors }, null, 2));
  console.log('PASS: cliente abre; host e cliente animam a persiana; colisão só sai ao concluir; sem erros JS.');
} catch(error) {
  await page.screenshot({path:`${pasta}/falha.png`}).catch(()=>{});
  throw error;
} finally {
  await page.evaluate(() => window.__portas?.destroy()).catch(() => {});
  await browser.close();
}
