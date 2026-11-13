/** Oficina compartilhada entre mapas e recursos ocultos durante o boss. */
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/tmp/nullborns-test-tools/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
const artifacts=process.env.ARTIFACT_DIR || '/tmp/upgrade-factory';mkdirSync(artifacts,{recursive:true});
let page;const errors=[];
const check=(label,result)=>{assert.ok(result,label);console.log('OK',label);};
try {
 page=await browser.newPage({viewport:{width:1280,height:720}});page.on('pageerror',e=>errors.push(e.stack));
 await page.route('**/js/core/game.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('const game = new Game(jogoRapido);','const game = window.__game = new Game(jogoRapido);')});});
 await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8765');await page.keyboard.press('k');
 await page.locator('.cutscene-skip').waitFor();await page.locator('.cutscene-skip').click();
 await page.waitForFunction(()=>__game.scene.getScene('Level1')?.player?.active,null,{timeout:120000});
 await page.evaluate(async()=>{
  const s=__game.scene.getScene('Level1'),{accountFor,economyFor}=await import('/js/systems/UpgradeSystem.js');
  accountFor(s).scrap=100;economyFor(s).revision++;s.scrapSystem.changed();
  s.player.body.reset(-410,8872);s.player.setVelocity(0,0);s.cameras.main.stopFollow().centerOn(-410,8850);
 });
 await page.waitForFunction(()=>!!__game.scene.getScene('Level1').interacaoCiberneticasProxima);
 await page.keyboard.press('e',{delay:100});await page.locator('.upgrade-terminal:not([hidden])').waitFor();
 await page.locator('[data-upgrade="health"]').click();await page.locator('[data-install]').click();
 await page.waitForFunction(()=>__game.scene.getScene('Level1').upgradeShop.level('health')===1);
 check('cidade instala nível 1', (await page.locator('[data-stats]').innerText()).includes('1 / 3'));
 await page.locator('[data-close]').click();
 await page.evaluate(async()=>{
  const {novoBossConfig}=await import('/js/enemies/novoBoss/NovoBossConfig.js');
  __game.scene.getScene('Level1').scene.start('Level1Parte2',{personagem:'kai-mercer',spawnX:-1253,spawnY:-1873,
   novoBossConfig:{...novoBossConfig,cenaEntrada:{...novoBossConfig.cenaEntrada,ativo:false},ataques:{...novoBossConfig.ataques,ativo:false},geradores:{...novoBossConfig.geradores,ativo:false}}});
 });
 await page.waitForFunction(()=>__game.scene.getScene('Level1Parte2')?.upgradeShop && __game.scene.getScene('Level1Parte2').player?.active,null,{timeout:60000});
 await page.waitForFunction(()=>!!__game.scene.getScene('Level1Parte2').interacaoCiberneticasProxima);
 check('NPC da fábrica em -1253, -1928',await page.evaluate(()=>{
  const n=__game.scene.getScene('Level1Parte2').children.getByName('upgrade-merchant');return n.x===-1253 && n.y===-1928 && n.visible && n.depth>16;
 }));
 await page.screenshot({path:`${artifacts}/npc-fabrica.png`});
 await page.keyboard.press('e',{delay:100});await page.locator('.upgrade-terminal:not([hidden])').waitFor();await page.locator('[data-upgrade="health"]').click();
 check('fábrica recebe nível e saldo da cidade',(await page.locator('[data-stats]').innerText()).includes('1 / 3') && (await page.locator('[data-balance]').innerText()).includes('92'));
 await page.screenshot({path:`${artifacts}/menu-compartilhado.png`});
 await page.locator('[data-install]').click();await page.waitForFunction(()=>__game.scene.getScene('Level1Parte2').upgradeShop.level('health')===2);
 await page.locator('[data-close]').click();
 await page.evaluate(()=>{
  const s=__game.scene.getScene('Level1Parte2');s.inventory.addItem('bateria');s.inventory.addItem('gasolina',1,{fuel:1});s.inventoryUI.updateCameraLayout();s.scrapSystem.update();window.beforeBossItems=s.inventory.getSlots();
 });
 check('recursos visíveis antes da arena',await page.evaluate(()=>{const s=__game.scene.getScene('Level1Parte2');return s.inventoryUI.container.visible && s.scrapSystem.counter.visible;}));
 await page.evaluate(async()=>{
  const s=__game.scene.getScene('Level1Parte2');s.scene.pause();const a=s.novoBoss.config.arena;
  s.player.body.reset((a.xMin+a.xMax)/2,a.yMax-130);s.player.setVelocity(0,0);
  const {atualizarBoss}=await import('/js/enemies/BossPrincipal.js');atualizarBoss(s,s.time.now,0);s.inventoryUI.updateCameraLayout();s.scrapSystem.update();
 });
 check('inventário e sucatas ocultos durante boss',await page.evaluate(()=>{
  const s=__game.scene.getScene('Level1Parte2');return s.novoBoss.jogadorNaArena && !s.inventoryUI.container.visible && s.inventoryUI.fuelVisuals.every(v=>!v.nativeLabel || !v.nativeLabel.visible) && !s.scrapSystem.counter.visible && !s.scrapSystem.counterIcon.visible && (!s.scrapSystem.counterIconView || !s.scrapSystem.counterIconView.object.visible);
 }));
 check('itens e saldo preservados',await page.evaluate(async()=>{const {accountFor}=await import('/js/systems/UpgradeSystem.js');const s=__game.scene.getScene('Level1Parte2');return JSON.stringify(s.inventory.getSlots())===JSON.stringify(beforeBossItems) && accountFor(s).scrap===78;}));
 await page.evaluate(()=>{const s=__game.scene.getScene('Level1Parte2');s.inventory.addItem('card');s.inventoryUI.updateCameraLayout();});
 check('reconstrução dos slots não os reexibe na luta',await page.evaluate(()=>!__game.scene.getScene('Level1Parte2').inventoryUI.container.visible));
 await page.screenshot({path:`${artifacts}/boss-sem-recursos.png`});
 await page.evaluate(()=>{const s=__game.scene.getScene('Level1Parte2');s.novoBoss.morto=true;s.inventoryUI.updateCameraLayout();s.scrapSystem.update();});
 check('HUD retorna após derrota do boss',await page.evaluate(()=>{const s=__game.scene.getScene('Level1Parte2');return s.inventoryUI.container.visible && s.scrapSystem.counter.visible && s.inventory.getQuantity('bateria')===1;}));
 await page.evaluate(()=>__game.scene.getScene('Level1Parte2').scene.start('Level1',{personagem:'kai-mercer',spawnX:-410,spawnY:8872,transicao:true}));
 await page.waitForFunction(()=>__game.scene.getScene('Level1')?.scene.isActive() && __game.scene.getScene('Level1').upgradeShop,null,{timeout:60000});
 await page.waitForFunction(()=>!!__game.scene.getScene('Level1').interacaoCiberneticasProxima);
 await page.keyboard.press('e',{delay:100});await page.locator('.upgrade-terminal:not([hidden])').waitFor();await page.locator('[data-upgrade="health"]').click();
 check('cidade recebe compra da fábrica, sem duplicar menu',(await page.locator('[data-stats]').innerText()).includes('2 / 3') && (await page.locator('[data-balance]').innerText()).includes('78') && await page.locator('.upgrade-terminal').count()===1);
 assert.deepEqual(errors,[]);console.log('PASSOU: oficina compartilhada e HUD de recursos durante o boss.');
} catch(error) {
 if(page && !page.isClosed()) {
  console.error('DIAGNÓSTICO',await page.evaluate(()=>__game.scene.getScenes(true).map(s=>({key:s.sys.settings.key,player:[s.player?.x,s.player?.y],shop:!!s.upgradeShop,near:!!s.interacaoCiberneticasProxima,lock:s.movimentoBloqueado,open:s.upgradeMenuOpen,input:s.input.enabled,keyboard:s.input.keyboard.enabled,attack:s.atacando,dash:s.estadoDash?.ativo,generator:s.generatorMenuOpen,dev:s.devItemMenuOpen}))));await page.screenshot({path:`${artifacts}/falha.png`});
 }
 throw error;
} finally {await browser.close();}
