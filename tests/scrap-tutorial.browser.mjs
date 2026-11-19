import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/nullborns-playwright/package/index.mjs');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/snap/brave/current/opt/brave.com/brave/brave', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
 const page = await browser.newPage();
 await page.route('**/js/core/game.js*', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8765');
 await page.evaluate(async () => {
  const { showScrapTutorial, SCRAP_TUTORIAL_KEY } = await import('/js/ui/ScrapTutorial.js');
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  function scene(multiplayer, registry = new Map([[SCRAP_TUTORIAL_KEY, { seen: false }]])) {
   const handlers = new Map();
   return { registry, multiplayer, sys: { settings: { key: 'Level1' } },
    input: { enabled: true, keyboard: { enabled: true, resetKeys() {} } }, player: { setVelocity() {} },
    textures: { getFrame() { return { cutWidth:64, cutHeight:64, cutX:0, cutY:0, source:{image:canvas} }; } },
    events: { once(k,fn){ handlers.set(k,fn); }, off(k){handlers.delete(k);}, emit(k){handlers.get(k)?.();} } };
  }
  window.fixture = { scene, showScrapTutorial, SCRAP_TUTORIAL_KEY };
 });
 for (const multiplayer of [false, true]) {
  await page.evaluate(multiplayer => { window.s = fixture.scene(multiplayer); window.guide = fixture.showScrapTutorial(s); }, multiplayer);
  assert.equal(await page.locator('.scrap-guide article').count(), 3);
  assert.equal(await page.locator('.scrap-guide-team').count(), multiplayer ? 1 : 0);
  assert.ok(await page.evaluate(() => !s.input.enabled && !s.input.keyboard.enabled && s.movimentoBloqueado && s.upgradeMenuOpen));
  for (const [width,height] of [[1920,1080],[1366,768],[1280,720],[960,540],[844,390],[740,360],[667,375],[390,844]]) {
   await page.setViewportSize({width,height});
   const fits = await page.locator('.scrap-guide').evaluate(el => {
    const r=el.getBoundingClientRect(); return r.left>=0 && r.top>=0 && r.right<=innerWidth && r.bottom<=innerHeight && el.scrollHeight<=el.clientHeight && el.scrollWidth<=el.clientWidth;
   });
   assert.ok(fits, `${width}×${height}, coop=${multiplayer}`);
  }
  await page.getByRole('button',{name:'ENTENDI',exact:true}).click();
  assert.equal(await page.locator('.scrap-tutorial').count(),0);
  assert.ok(await page.evaluate(() => s.input.enabled && s.input.keyboard.enabled && !s.movimentoBloqueado && !s.upgradeMenuOpen));
  assert.ok(await page.evaluate(() => fixture.showScrapTutorial(s)===null));
  await page.evaluate(() => { const another=fixture.scene(s.multiplayer,s.registry); if(fixture.showScrapTutorial(another)!==null)throw Error('reinício'); another.sys.settings.key='Level1Parte2'; if(fixture.showScrapTutorial(another)!==null)throw Error('mapa'); });
 }
 await page.evaluate(() => {
  const a=fixture.scene(true),b=fixture.scene(true),one=fixture.showScrapTutorial(a),two=fixture.showScrapTutorial(b);
  one.close(); if(!b.scrapTutorialOpen || a.scrapTutorialOpen)throw Error('interfaces acopladas');
  b.events.emit('shutdown'); if(document.querySelector('.scrap-tutorial'))throw Error('limpeza');
  const c=fixture.scene(false); c.input.enabled=false; c.movimentoBloqueado=true;
  fixture.showScrapTutorial(c).close(); if(c.input.enabled || !c.movimentoBloqueado)throw Error('restauração');
 });
 console.log('PASS tutorial: conteúdo solo/coop, oito resoluções sem overflow, bloqueio/restauração, nova partida, reinício, mapa, independência e shutdown');
} finally { await browser.close(); }
