/** Arte atrasada fica coberta; a abertura só revela a TV pronta e o vídeo tocando. */
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
const dir = '/tmp/cutscene-opening'; mkdirSync(dir, { recursive: true });
try {
  for (const [width, height] of [[1100, 740], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, hasTouch: width < 600 });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.route('**/js/core/game.js*', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    await page.route('**/*Industrial.png', async route => { await ready; await route.continue(); });
    await page.goto(process.env.BASE_URL ?? 'http://127.0.0.1:8765/');
    await page.evaluate(async () => {
      document.body.replaceChildren();
      const { CutsceneLoading } = await import('/js/ui/CutsceneLoading.js');
      window.__cut = new CutsceneLoading({ events: { once() {}, off() {} }, registry: new Map() });
    });
    await page.waitForTimeout(200);
    assert.equal(await page.locator('.cutscene-eye').count(), 1);
    assert.equal(await page.locator('.cutscene-eye-opening').count(), 0);
    assert.equal(await page.locator('.cutscene-eye ellipse').getAttribute('ry'), '0');
    await page.screenshot({ path: `${dir}/closed-${width}.png` });
    release();
    await page.waitForFunction(() => document.querySelector('.cutscene-eye-opening'));
    await page.evaluate(() => {
      const cut = window.__cut;
      if (!cut.television.complete || !cut.television.naturalWidth || cut.video.readyState < 2 || cut.video.hidden)
        throw new Error('Abertura iniciou antes da TV e do vídeo estarem prontos');
      cut.video.pause();
      const animation = cut.eye.querySelector('ellipse').getAnimations()[0];
      animation.pause(); animation.currentTime = 780;
    });
    const radius = await page.locator('.cutscene-eye ellipse').evaluate(el => parseFloat(getComputedStyle(el).ry));
    assert.ok(radius > 0 && radius < 850);
    await page.screenshot({ path: `${dir}/opening-${width}.png` });
    // Abre um oval, fecha totalmente na piscada e só então revela tudo.
    for (const [time, expectedRx, expectedRy] of [[0, 320, 0], [780, 460, 110], [988, 460, 110],
      [1300, 460, 0], [1456, 460, 0]]) {
      const radii = await page.evaluate(time => {
        const ellipse = window.__cut.eye.querySelector('ellipse');
        ellipse.getAnimations()[0].currentTime = time;
        const css = getComputedStyle(ellipse);
        return { rx: parseFloat(css.rx), ry: parseFloat(css.ry) };
      }, time);
      assert.ok(Math.abs(radii.rx - expectedRx) < .01, JSON.stringify({ time, radii }));
      assert.ok(Math.abs(radii.ry - expectedRy) < .01, JSON.stringify({ time, radii }));
    }
    await page.screenshot({ path: `${dir}/blink-${width}.png` });
    const reopening = await page.evaluate(() => {
      const ellipse = window.__cut.eye.querySelector('ellipse');
      ellipse.getAnimations()[0].currentTime = 2080;
      return parseFloat(getComputedStyle(ellipse).ry);
    });
    assert.ok(reopening > 110 && reopening < 850);
    await page.screenshot({ path: `${dir}/reopening-${width}.png` });
    await page.evaluate(() => window.__cut.eye.querySelector('ellipse').getAnimations()[0].finish());
    await page.locator('.cutscene-eye').waitFor({ state: 'detached' });
    await page.screenshot({ path: `${dir}/opened-${width}.png` });
    await page.evaluate(() => window.__cut.destroy());
    assert.equal(await page.locator('.cutscene-loading').count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS: TV oculta enquanto carrega, abertura de olho e limpeza em ${width}x${height}.`);
  }
  // Erro de mídia não pode deixar as ações de recuperação atrás da tela preta
  // enquanto a imagem da TV continua sem responder.
  const fallback = await browser.newPage();
  await fallback.route('**/js/core/game.js*', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
  let releaseArt;
  const blockedArt = new Promise(resolve => { releaseArt = resolve; });
  await fallback.route('**/*Industrial.png', async route => { await blockedArt; await route.abort(); });
  await fallback.route('**/cutscene-tv.mp4', route => route.abort());
  await fallback.goto(process.env.BASE_URL ?? 'http://127.0.0.1:8765/');
  await fallback.evaluate(async () => {
    document.body.replaceChildren();
    const { CutsceneLoading } = await import('/js/ui/CutsceneLoading.js');
    window.__cut = new CutsceneLoading({ events: { once() {}, off() {} }, registry: new Map() });
  });
  try {
    await fallback.waitForFunction(() => document.querySelector('.cutscene-eye-opening'), null, { timeout: 5000 });
    await fallback.locator('.cutscene-eye').waitFor({ state: 'detached', timeout: 5000 });
    assert.equal(await fallback.evaluate(() => window.__cut.television.complete), false);
    console.log('PASS: falha de vídeo libera a tela mesmo com a arte sem resposta.');
  } finally {
    await fallback.evaluate(() => window.__cut.destroy());
    releaseArt(); await fallback.close();
  }
} finally { await browser.close(); }
