/** Exercita escolhas, erros e consulta usando a interface e a sessão reais, por toque. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errors = [], dir = process.env.ARTIFACT_DIR ?? '/tmp/memory-decryption'; mkdirSync(dir, { recursive: true });
page.on('pageerror', e => errors.push(e.stack));
await page.route('**/js/core/game.js*', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
const state = () => page.evaluate(() => window.__memory.estado().model);
async function tap(selector) { const el = typeof selector === 'string' ? page.locator(selector) : selector; await el.scrollIntoViewIfNeeded(); await el.tap(); }
async function records(expected, categoria) {
  const before = await state();
  await tap(page.getByRole('button', { name: 'CONSULTAR REGISTROS', exact: true }));
  const db = page.locator('.axiom-record-overlay'); await db.waitFor();
  assert.equal(await db.getByRole('button', { name: categoria, exact: true }).getAttribute('aria-pressed'), 'true');
  assert.ok((await db.innerText()).includes(expected));
  await tap(db.getByRole('button', { name: 'Voltar', exact: true })); await db.waitFor({ state: 'detached' });
  assert.deepEqual(await state(), before);
}
try {
  await page.goto(process.env.BASE_URL ?? 'http://127.0.0.1:8767/');
  await page.evaluate(async () => { document.body.replaceChildren(); document.body.style.cssText = 'margin:0;background:#03130e'; const { criarFixtureTutorial } = await import('/tests/puzzle-tutorial-fixture.mjs'); window.__memory = criarFixtureTutorial('memory-identificacao'); });
  assert.equal(await page.locator('.puzzle-tutorial-overlay').count(), 0);
  assert.deepEqual(await page.locator('.memory-module small').allTextContents(), ['STATUS: CRIPTOGRAFADO', 'STATUS: BLOQUEADO', 'STATUS: BLOQUEADO']);
  const first = await state(), core = first.identificacoes.find(n => n.tipo === 'CORE').id;
  await records('PROCESSAMENTO CENTRAL', 'PROTOCOLOS');
  for (let i = 0; i < 3; i++) {
    const wrong = (await state()).identificacoes.find(n => n.tipo !== 'CORE').id;
    const previous = (await state()).identificacoes.map(n => n.id);
    await tap(`[data-server="${wrong}"]`);
    assert.equal((await state()).recuperados, 0); assert.notDeepEqual((await state()).identificacoes.map(n => n.id), previous);
  }
  assert.ok((await page.locator('.nullnet-message').innerText()).includes('N.O.V.A.'));
  await tap(`[data-server="${core}"]`); assert.equal((await state()).recuperados, 1);
  const vital = (await state()).sistemas.find(n => n.tipo === 'LIFE').id;
  await tap(`[data-server="${vital}"]`); assert.equal(await page.locator(`[data-server="${vital}"]`).getAttribute('aria-pressed'), 'true');
  await tap(page.getByRole('button', { name: 'EXECUTAR ISOLAMENTO', exact: true }));
  assert.equal((await state()).recuperados, 1); assert.match((await state()).mensagem, /ESSENTIAL SYSTEMS/);
  await records('LIFE', 'PROTOCOLOS');
  await tap(`[data-server="${vital}"]`);
  for (const sec of (await state()).sistemas.filter(n => n.tipo === 'SEC')) await tap(`[data-server="${sec.id}"]`);
  await page.screenshot({ path: `${dir}/integridade-mobile.png` });
  await tap(page.getByRole('button', { name: 'EXECUTAR ISOLAMENTO', exact: true })); assert.equal((await state()).recuperados, 2);
  await records('ORDEM DA AUTORIZAÇÃO', 'AUTENTICAÇÃO');
  const order = await page.evaluate(async () => (await import('/js/puzzles/MissionIntelligence.js')).gerarMissao(41).assinatura);
  await tap(`[data-fragment="${order[1]}"]`); await tap('[data-slot="0"]'); assert.deepEqual((await state()).sequencia, []);
  for (const part of [...order].reverse()) await tap(`[data-fragment="${part}"]`);
  await tap(page.getByRole('button', { name: 'VALIDAR AUTORIZAÇÃO', exact: true })); assert.equal((await state()).recuperados, 2);
  await tap(page.getByRole('button', { name: 'LIMPAR SEQUÊNCIA', exact: true })); assert.deepEqual((await state()).sequencia, []);
  for (const part of order) await tap(`[data-fragment="${part}"]`);
  await page.screenshot({ path: `${dir}/autorizacao-mobile.png` });
  await tap(page.getByRole('button', { name: 'VALIDAR AUTORIZAÇÃO', exact: true }));
  await page.waitForFunction(() => window.__memory.estado().model.etapaTipo === 'host');
  assert.equal((await state()).tutorial, false); assert.equal(await page.locator('.hack-cell').count(), 32);
  await page.evaluate(() => window.__memory.destruir()); await page.waitForTimeout(150);
  assert.equal(await page.locator('.nullnet-overlay,.puzzle-tutorial-overlay').count(), 0); assert.deepEqual(errors, []);
  console.log('PASS: três arquivos, bloqueios, três erros com ajuda, alternativas reposicionadas, vitais preservados, registros sem perda, remoção/limpeza por toque e HOST.');
} catch (e) { await page.screenshot({ path: `${dir}/failure.png` }).catch(() => {}); throw e; }
finally { await browser.close(); }
