import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/nullborns-playwright/package/index.mjs');
const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/snap/brave/current/opt/brave.com/brave/brave',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:844,height:390}});
 const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.route('**/js/core/game.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('const game = new Game(jogoRapido);','const game = window.__game = new Game(jogoRapido);')});});
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8765');await page.keyboard.press('k');
 await page.locator('.cutscene-skip').waitFor();
 assert.equal(await page.locator('.scrap-tutorial').count(),0);
 await page.locator('.cutscene-skip').click();
 await page.locator('.scrap-tutorial').waitFor({timeout:120000});
 assert.equal(await page.locator('.cutscene-loading').count(),0);
 assert.ok(await page.evaluate(()=>{const s=__game.scene.getScene('Level1');return s.player.active && s.movimentoBloqueado && !s.input.enabled;}));
 await page.screenshot({path:'/tmp/scrap-tutorial-game.png'});
 await page.getByRole('button',{name:'ENTENDI',exact:true}).click();
 await page.evaluate(async()=>{
  const s=__game.scene.getScene('Level1'),{economyFor}=await import('/js/systems/UpgradeSystem.js');
  window.e=economyFor(s); window.s=s;
  s.cameras.main.stopFollow().centerOn(s.player.x,s.player.y);
  e.drops.test={id:'test',mapKey:'Level1',x:s.player.x+120,y:s.player.y,quantity:2};e.revision++;
 });
 await page.waitForFunction(()=>s.scrapSystem.indicators.get('test')?.arrow.visible);
 const y=await page.evaluate(()=>s.scrapSystem.indicators.get('test').arrow.y);
 await page.waitForTimeout(220);
 assert.notEqual(await page.evaluate(()=>s.scrapSystem.indicators.get('test').arrow.y),y);
 await page.evaluate(()=>{const d=e.drops.test;s.player.body.reset(d.x,d.y);});
 await page.waitForFunction(()=>!e.drops.test && !s.scrapSystem.indicators.has('test'));
 assert.deepEqual(errors,[]);
 console.log('PASS jogo real: introdução antes do tutorial, controles, assets, seta animada e coleta automática com remoção');
} finally {await browser.close();}
