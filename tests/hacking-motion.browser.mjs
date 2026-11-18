/** Painéis e sessões reais: comprova movimento, seleção por toque e reaproveitamento do DOM. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const dir = process.env.ARTIFACT_DIR ?? '/tmp/nullnet-motion'; mkdirSync(dir, { recursive: true });
const errors = []; page.on('pageerror', e => errors.push(e.stack)); page.setDefaultTimeout(25000);
await page.route('**/js/core/game.js*', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
async function setup(tipo) {
  await page.evaluate(async tipo => { const { criarFixtureTutorial } = await import('/tests/puzzle-tutorial-fixture.mjs'); window.__motion = criarFixtureTutorial(tipo); }, tipo);
  if ((await page.evaluate(() => window.__motion.estado())).model.tutorial) await page.getByRole('button', { name: 'Pular tutorial', exact: true }).tap();
  await page.locator('.puzzle-tutorial-overlay').waitFor({ state: 'detached' });
}
async function layout(name) {
  for (const [width, height] of [[390, 844], [568, 320], [1100, 700]]) {
    await page.setViewportSize({ width, height });
    const dims = await page.locator('.nullnet-panel').first().evaluate(el => ({ w: el.getBoundingClientRect().width, page: document.documentElement.scrollWidth, inner: innerWidth }));
    assert.ok(dims.w <= width && dims.page <= dims.inner + 1, JSON.stringify(dims));
    await page.screenshot({ path: `${dir}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
}
try {
  await page.goto(process.env.BASE_URL ?? 'http://127.0.0.1:8765/');
  await page.evaluate(() => { document.body.replaceChildren(); document.body.style.cssText = 'margin:0;background:#010b05'; });
  await page.evaluate(async () => { window.__lerColuna = (await import('/js/puzzles/BruteforcePuzzle.js')).lerColuna; window.__posicaoNumero = (await import('/js/puzzles/HostConnection.js')).posicaoNumero; });
  await setup('bruteforce');
  const positions = () => page.locator('.brute-column').evaluateAll(cols => cols.map(c => c.querySelector('.brute-letter').style.transform));
  const before = await positions(); await page.waitForTimeout(220); const after = await positions();
  assert.equal(before.length, 8); assert.ok(before.every((v, i) => v !== after[i])); assert.equal(await page.locator('.brute-letter').count(), 64);
  await page.locator('.brute-column').first().focus(); await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.coluna), '1');
  await page.locator('.brute-confirm').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const m = window.__motion.estado().model, lerColuna = window.__lerColuna;
    const l = lerColuna(m.colunas[0], m.tempo); return l.letra !== m.colunas[0].alvo && Math.abs(l.deslocamento) < .08;
  }, null, { timeout: 20000 });
  await page.locator('.brute-confirm').tap(); await page.waitForFunction(() => window.__motion.estado().model.erros > 0);
  assert.equal(await page.evaluate(() => window.__motion.estado().model.ativa), 0);
  await page.screenshot({ path: `${dir}/bruteforce-erro.png` });
  await page.waitForTimeout(700); await layout('bruteforce');
  const expected = await page.evaluate(() => window.__motion.estado().model.colunas.map(c => c.alvo).join(''));
  for (let i = 0; i < 8; i++) {
    await page.locator('.brute-confirm').scrollIntoViewIfNeeded();
    await page.waitForFunction(i => {
      const m = window.__motion.estado().model, c = m.colunas[i], lerColuna = window.__lerColuna;
      const l = lerColuna(c, m.tempo); return !c.falhaAte && l.letra === c.alvo && Math.abs(l.deslocamento) < .1;
    }, i, { timeout: 25000 });
    await page.locator('.brute-confirm').tap(); await page.waitForFunction(i => window.__motion.estado()?.model.ativa === i + 1, i);
    if (i === 0) { const fixed = (await positions())[0]; await page.waitForTimeout(180); assert.equal((await positions())[0], fixed); }
  }
  assert.equal(await page.locator('.brute-password').innerText().then(t => t.replace(/\s/g, '')), expected);
  await page.screenshot({ path: `${dir}/bruteforce-sucesso.png` }); await page.evaluate(() => window.__motion.destruir());
  console.log('PASS: oito colunas em movimento, erro recuperável, teclado, congelamento e palavra completa por toque.');
  await setup('host');
  const tracksBefore = await page.locator('.hack-cell').evaluateAll(els => els.map(el => el.style.transform));
  await page.waitForTimeout(1100);
  const tracksAfter = await page.locator('.hack-cell').evaluateAll(els => els.map(el => el.style.transform));
  assert.equal(tracksBefore.length, 32); assert.ok(tracksBefore.every((v, i) => v !== tracksAfter[i]));
  assert.equal(await page.locator('.hack-cell').count(), 32);
  await page.locator('.hackconnect').focus(); await page.keyboard.press('ArrowRight');
  assert.ok((await page.locator('.hack-selection').innerText()).includes('LINHA'));
  const old = await page.evaluate(() => window.__motion.estado().model.passo);
  await page.keyboard.press('Enter', { delay: 50 }); await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__motion.estado().model.passo), old);
  assert.ok(await page.evaluate(() => window.__motion.estado().model.rastro > 0));
  await layout('hackconnect');
  const candidate = await page.evaluate(async () => {
    const m = window.__motion.estado().model, { sequenciaLinha } = await import('/js/puzzles/HostConnection.js');
    for (let linha = 0; linha < 4; linha++) for (let inicio = 0; inicio < 8; inicio++) if (sequenciaLinha(m.linhas, linha, inicio).join('.') === m.alvo.join('.')) return { linha, inicio };
  }); assert.ok(candidate);
  await page.locator('.hack-matrix').scrollIntoViewIfNeeded();
  await page.waitForFunction(({ linha, inicio }) => {
    const m = window.__motion.estado().model;
    return window.__posicaoNumero(linha, inicio, m.tempo).coluna === 0 && m.tempo % 1000 < 180;
  }, candidate, { timeout: 40000 });
  const box = await page.locator(`.hack-cell[data-linha="${candidate.linha}"][data-inicio="${candidate.inicio}"]`).boundingBox();
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.touchscreen.tap(point.x, point.y); assert.equal(await page.locator('.hack-cell.marked').count(), 4);
  await page.locator('.hack-confirm').tap(); await page.waitForFunction(old => window.__motion.estado().model.passo > old, old);
  await page.screenshot({ path: `${dir}/hackconnect-autenticado.png` });
  await page.evaluate(() => window.__motion.destruir());
  assert.equal(await page.locator('.nullnet-overlay').count(), 0);
  await page.waitForTimeout(100); assert.equal(await page.locator('.hack-cell, .brute-letter').count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: quatro linhas em passos de 1000 ms, erro rejeitado, grupo de quatro números, toque, layouts e descarte sem duplicação.');
} catch (e) { await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {}); console.error(await page.evaluate(() => window.__motion?.estado()).catch(() => null)); throw e; }
finally { await browser.close(); }
