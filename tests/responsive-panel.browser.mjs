import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
try {
  await page.route('**/js/core/game.js*', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
  await page.goto(process.env.BASE_URL ?? 'http://127.0.0.1:8765/');
  await page.evaluate(async () => {
    document.body.replaceChildren();
    document.body.style.cssText = 'margin:0;background:#03130e';
    const [{ criarPainelHacking }, { BreachPuzzle }] = await Promise.all([
      import('/js/ui/HackingPanel.js'),
      import('/js/puzzles/BreachPuzzle.js'),
    ]);
    window.__responsiveClicks = [];
    window.__responsiveModel = new BreachPuzzle(1234);
    window.__responsivePanel = criarPainelHacking(command => window.__responsiveClicks.push(command));
    window.__responsivePanel.atualizar({ ...window.__responsiveModel.snapshot(), tutorial: false });
  });

  const sizes = [
    [320, 568], [390, 844], [568, 320], [640, 360], [720, 1280], [768, 1024],
    [844, 390], [960, 540], [1024, 768], [1366, 768], [1920, 1080],
  ];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(100);
    const layout = await page.evaluate(() => {
      const root = document.querySelector('.hacking-overlay');
      const panel = root.querySelector('.hacking-panel');
      const rect = panel.getBoundingClientRect();
      const style = getComputedStyle(root);
      const availableWidth = root.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const availableHeight = root.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      return {
        viewport: [innerWidth, innerHeight],
        bounds: [rect.left, rect.top, rect.right, rect.bottom],
        scale: rect.width / panel.offsetWidth,
        expectedScale: Math.min(1, availableWidth / panel.offsetWidth, availableHeight / panel.offsetHeight),
        columns: getComputedStyle(panel.querySelector('.hacking-columns')).gridTemplateColumns.split(' ').length,
      };
    });
    assert.ok(Math.abs(layout.scale - layout.expectedScale) < 0.015, `Wrong scale at ${width}x${height}`);
    assert.ok(layout.bounds[0] >= -1 && layout.bounds[1] >= -1, `Panel starts outside ${width}x${height}`);
    assert.ok(layout.bounds[2] <= width + 1 && layout.bounds[3] <= height + 1, `Panel ends outside ${width}x${height}`);
    assert.equal(layout.columns, 2, `Desktop composition changed at ${width}x${height}`);
  }

  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(100);
  const cell = await page.evaluate(() =>
    [...Array(25).keys()].find(index => window.__responsiveModel.podeSelecionar(index)));
  await page.locator(`[data-cell="${cell}"]`).click();
  assert.deepEqual(await page.evaluate(() => window.__responsiveClicks.at(-1)), { op: 'selecionar', valor: cell });
  console.log('PASS: 11 resolutions preserve uniform scaling, centered bounds, two-column layout, and selection.');
} finally {
  await browser.close();
}
