import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const dir = process.env.ARTIFACT_DIR ?? '/tmp/nullnet-tutorials'; mkdirSync(dir, { recursive: true });
const errors = []; page.on('pageerror', e => errors.push(e.stack));
await page.route('**/js/core/game.js*', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
try {
  await page.goto(process.env.BASE_URL ?? 'http://127.0.0.1:8765/');
  await page.evaluate(() => { document.body.replaceChildren(); document.body.style.cssText = 'margin:0;background:#03130e'; });
  for (const tipo of ['fabrica', 'bruteforce', 'memory-identificacao', 'memory-integridade', 'memory-autorizacao', 'host']) {
    await page.evaluate(async tipo => { const { criarFixtureTutorial } = await import('/tests/puzzle-tutorial-fixture.mjs'); window.__guide = criarFixtureTutorial(tipo); }, tipo);
    const contextual = tipo.startsWith('memory') || tipo === 'host';
    const guide = page.locator('.puzzle-tutorial-overlay');
    if (contextual) { assert.equal(await guide.count(), 0); await page.getByRole('button', { name: 'Como jogar', exact: true }).tap(); }
    await guide.waitFor();
    assert.equal(await guide.getAttribute('data-tutorial'), tipo);
    const antes = await page.evaluate(() => window.__guide.estado()); await page.waitForTimeout(350);
    assert.deepEqual(await page.evaluate(() => window.__guide.estado()), antes);
    for (const [width, height] of [[390, 844], [568, 320], [960, 640]]) {
      await page.setViewportSize({ width, height });
      const dims = await guide.evaluate(root => ({ width: root.querySelector('.nullnet-panel').getBoundingClientRect().width, scroll: root.scrollWidth, viewport: innerWidth }));
      assert.ok(dims.width <= width); assert.ok(dims.scroll <= width);
      await page.screenshot({ path: `${dir}/${tipo}-${width}.png` });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    const total = contextual ? 1 : 3;
    for (let i = 0; i < total; i++) {
      assert.equal(await guide.locator('svg[role="img"]').count(), 1);
      assert.ok(!(await guide.innerText()).match(/teclado|mouse|WASD|Espaço/));
      const btn = guide.getByRole('button', { name: i === total - 1 ? contextual ? 'Voltar ao puzzle' : 'Começar puzzle' : 'Próximo', exact: true });
      await btn.scrollIntoViewIfNeeded(); assert.ok((await btn.boundingBox()).height >= 44);
      await page.screenshot({ path: `${dir}/${tipo}-etapa-${i + 1}.png` }); await btn.tap();
    }
    await guide.waitFor({ state: 'detached' }); assert.equal((await page.evaluate(() => window.__guide.estado())).model.tutorial, false);
    await page.getByRole('button', { name: 'Como jogar', exact: true }).tap(); await guide.waitFor();
    assert.equal((await page.evaluate(() => window.__guide.estado())).model.tutorial, true);
    await guide.getByRole('button', { name: contextual ? 'Fechar ajuda' : 'Pular tutorial', exact: true }).tap(); await guide.waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Como jogar', exact: true }).tap(); await guide.waitFor();
    await page.evaluate(() => window.__guide.destruir());
    assert.equal(await page.locator('.puzzle-tutorial-overlay, .hacking-overlay, .nullnet-overlay').count(), 0);
    console.log(`PASS: ${tipo}, ajuda contextual ou abertura da fábrica, pausa, ${total} ilustrações, toque, três layouts, reabertura e descarte.`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
