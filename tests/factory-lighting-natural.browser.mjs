/** Fábrica real: estabilidade visual e reaproveitamento da máscara, com CPU limitada. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/tmp/nullborns-test-tools/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
const baseline=process.env.FACTORY_LIGHT_BASELINE;
try {
 const page=await browser.newPage({viewport:{width:960,height:540},isMobile:true,hasTouch:true,
  userAgent:'Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/js/core/game.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('const game = new Game(jogoRapido);','const game = window.__game = new Game(jogoRapido);')});});
 if(baseline) await page.route('**/js/effects/FactoryLighting.js',route=>route.fulfill({contentType:'text/javascript',body:readFileSync(baseline,'utf8')}));
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8765');await page.keyboard.press('k');
 await page.locator('.cutscene-skip').waitFor();await page.locator('.cutscene-skip').tap();
 await page.waitForFunction(()=>__game.scene.getScene('Level1')?.player?.active,null,{timeout:120000});
 await page.evaluate(async()=>{
  const {novoBossConfig}=await import('/js/enemies/novoBoss/NovoBossConfig.js');
  __game.scene.getScene('Level1').scene.start('Level1Parte2',{personagem:'kai-mercer',spawnX:-193,spawnY:-1310,
   novoBossConfig:{...novoBossConfig,cenaEntrada:{...novoBossConfig.cenaEntrada,ativo:false},ataques:{...novoBossConfig.ataques,ativo:false}}});
 });
 await page.waitForFunction(()=>__game.scene.getScene('Level1Parte2')?.iluminacaoFabrica && __game.scene.getScene('Level1Parte2')?.player?.active,null,{timeout:60000});
 await page.evaluate(()=>{
  const s=__game.scene.getScene('Level1Parte2');s.scene.pause();s.player.setPosition(-193,-1310).setVelocity(0,0).setVisible(false);
  s.companionPet?.setVisible(false);for(const e of s.inimigos || [])e.setVisible(false);
  s.cameras.main.stopFollow().setZoom(1).centerOn(-193,-1310);s.cameras.main.preRender();
  for(const z of s.zonasLuzApagada.zonas){z.liberada=z.restaurada=true;z.opacidade=0;}
  let seed=321;s.iluminacaoFabrica.aleatorio=()=>((seed=seed*16807%2147483647)-1)/2147483646;
  s.definirIluminacaoFabrica(true);
 });
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 const report=await page.evaluate(()=>{
  const s=__game.scene.getScene('Level1Parte2'),camera=s.cameras.main;
  const draw=s.game.renderer.listeners(Phaser.Renderer.Events.RENDER).find(fn=>fn.name==='atualizarIluminacao');
  const texture=s.textures.get('level1-parte2-escuridao'),original=texture.refresh;
  let uploads=0,maxFailures=0,minFactor=1;texture.refresh=function(...args){uploads++;return original.apply(this,args);};
  const base=s.time.now;camera.preRender();draw(s,camera);
  uploads=0;const start=performance.now();
  for(let i=1;i<=600;i++) {
   s.time.now=base+i*100;camera.preRender();draw(s,camera);
   maxFailures=Math.max(maxFailures,s.iluminacaoFabrica.estados.filter(e=>e.falha).length);
   for(const state of s.iluminacaoFabrica.fontesVisiveis) {
    if(state.luz.intensidade*state.luz.cor.alpha>0)minFactor=Math.min(minFactor,state.intensidade/(state.luz.intensidade*state.luz.cor.alpha));
   }
  }
  const ms=performance.now()-start;texture.refresh=original;
  return {frames:600,uploads,maxFailures,minFactor,ms,visible:s.iluminacaoFabrica.fontesVisiveis.length,
    mask:[texture.getSourceImage().width,texture.getSourceImage().height]};
 });
 if(!baseline) {
  assert.ok(report.visible>0);assert.ok(report.maxFailures<=1);
  assert.ok(report.minFactor>=.7);assert.ok(report.uploads<60,'mais de 90% das composições são reutilizadas');
 }
 assert.deepEqual(errors,[]);
 const label=baseline?'before':'after';writeFileSync(`/tmp/factory-natural-${label}.json`,JSON.stringify(report,null,2));
 await page.screenshot({path:`/tmp/factory-natural-${label}.png`});console.log(label,JSON.stringify(report));
} finally {await browser.close();}
