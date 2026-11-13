/** Regressão de desempenho: celular não lê pixels do vídeo nem compõe blur/máscaras duplicadas. */
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/tmp/nullborns-test-tools/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const base=process.env.GAME_URL || 'http://127.0.0.1:8765';
try {
 const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const cdp=await page.context().newCDPSession(page);
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.goto(base);
 await page.evaluate(async()=>{
  window.readbacks=0;
  const original=CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData=function(...args){window.readbacks++;return original.apply(this,args);};
  document.querySelector('#start-game').remove();
  const {CutsceneLoading}=await import('/js/ui/CutsceneLoading.js');
  const game={events:new Phaser.Events.EventEmitter(),registry:new Map(),sound:{locked:true}};
  window.completed=0;window.c=new CutsceneLoading(game,{personagem:'kai-mercer'});
  c.setAssetsReady(()=>completed++);
 });
 await page.waitForFunction(()=>c.video.currentTime>.2);
 await page.waitForTimeout(2000);
 assert.ok(await page.evaluate(()=>c.crtLighting.lowPower && !c.crtLighting.canvas && !c.crtLighting.context));
 assert.equal(await page.evaluate(()=>readbacks),0,'nenhuma leitura de pixels durante reprodução');
 assert.ok(await page.evaluate(()=>{
  const l=c.crtLighting;
  return getComputedStyle(l.rim).display==='none' && getComputedStyle(l.rim).filter==='none' &&
   getComputedStyle(l.spill).mixBlendMode==='normal' && getComputedStyle(c.display).clipPath==='none' &&
   getComputedStyle(c.screen).clipPath.startsWith('polygon(') && getComputedStyle(c.video).objectFit==='fill';
 }),'mantém vidro curvo e preenchimento sem filtros ou máscaras duplicadas');
 assert.equal(await page.evaluate(async()=>{
  c.crtLighting.update();let mutations=0;
  const observer=new MutationObserver(records=>mutations+=records.length);
  observer.observe(c.stage,{attributes:true,attributeFilter:['style']});
  for(let i=0;i<20;i++)c.crtLighting.update();
  await Promise.resolve();observer.disconnect();return mutations;
 }),0,'luz estável não invalida o CSS a cada consulta');
 await page.evaluate(()=>c.finishVideo());
 await page.waitForFunction(()=>c.transmission.index>=0);
 assert.ok(await page.evaluate(()=>c.transmission.view.reducedEffects));
 await page.evaluate(()=>{const t=c.transmission,l=t.timeline.lines.find(l=>l.role==='unknown');t.startAt=Date.now()-l.start-200;t.update();c.crtLighting.update();});
 assert.ok(await page.evaluate(()=>c.crtLighting.color[0]>c.crtLighting.color[1]*2),'preserva a luz vermelha da AXIOM');
 for(const viewport of [{width:390,height:844},{width:844,height:390}]) {
  await page.setViewportSize(viewport);await page.waitForTimeout(100);
  assert.ok(await page.evaluate(()=>{
   const a=c.screen.getBoundingClientRect(),b=c.display.getBoundingClientRect();
   return Math.abs(a.width-b.width)<1 && Math.abs(a.height-b.height)<1;
  }),'conteúdo continua preenchendo o vidro após mudar orientação');
 }
 await page.locator('.cutscene-skip').tap();
 assert.equal(await page.evaluate(()=>completed),1);
 assert.ok(await page.evaluate(()=>c.crtLighting.destroyed && c.destroyed && !document.querySelector('.cutscene-loading')));
 assert.deepEqual(errors,[]);
 console.log('PASSOU: celular com CPU 4× mais lenta; zero leituras de vídeo, filtros leves, estados de luz, rotação e encerramento.');
 await page.close();
 // Entrada real na fase com o mesmo perfil móvel, assets e cenas do projeto.
 const real=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 real.on('pageerror',e=>errors.push(e.message));
 await real.route('**/js/core/game.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('const game = new Game(jogoRapido);','const game = window.__game = new Game(jogoRapido);')});});
 await real.goto(base);await real.keyboard.press('k');
 await real.waitForFunction(()=>__game.scene.getScene('preloader')?.cutscene?.gate.assetsReady,null,{timeout:120000});
 assert.ok(await real.evaluate(()=>__game.scene.getScene('preloader').cutscene.crtLighting.lowPower));
 await real.locator('.cutscene-skip').tap();
 await real.waitForFunction(()=>__game.scene.getScene('Level1')?.player?.active,null,{timeout:60000});
 assert.equal(await real.locator('.cutscene-loading').count(),0);assert.deepEqual(errors,[]);
 console.log('PASSOU: celular entra na fase 1 pelo fluxo real sem erros JavaScript.');
 await real.close();
} finally {await browser.close();}
