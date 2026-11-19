import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {iniciarJogoHacking,entrarFabricaHacking} from './hacking-browser-helpers.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE ?? '/tmp/nullborns-playwright/package/index.mjs');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:900,height:600},hasTouch:true}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
mkdirSync('/tmp/factory-lighting-solo',{recursive:true});
try{
 await iniciarJogoHacking(page);await entrarFabricaHacking(page,false);
 await page.evaluate(()=>{__game.scene.getScene("Level1Parte2").player.invulneravel=true;});
 const initial=await page.evaluate(()=>{const s=__game.scene.getScene('Level1Parte2');window.oldFlashlight=s.recursosLanterna;return {flashlight:!!s.recursosLanterna,individualLights:'lampadas' in s.iluminacaoFabrica};});
 assert.deepEqual(initial,{flashlight:true,individualLights:false});
 await page.screenshot({path:'/tmp/factory-lighting-solo/antes.png'});
 await page.evaluate(()=>{const s=__game.scene.getScene('Level1Parte2');s.developerMode=true;s.acenderLuzFabrica();});
 await page.waitForFunction(()=>!__game.scene.getScene('Level1Parte2').recursosLanterna);
 const freed=await page.evaluate(()=>({mask:oldFlashlight.canvas.width,occlusion:oldFlashlight.oclusao.width,walls:oldFlashlight.paredes.scene}));assert.deepEqual(freed,{mask:0,occlusion:0,walls:null});
 await page.waitForTimeout(5500);
 await page.screenshot({path:'/tmp/factory-lighting-solo/depois.png'});
 const performanceReport=await page.evaluate(()=>{
  const s=__game.scene.getScene('Level1Parte2'),c=s.cameras.main;s.scene.pause();s.player.setVelocity(0,0);c.stopFollow();c.preRender();
  const texture=s.textures.get('level1-parte2-escuridao'),refresh=texture.refresh;let uploads=0;
  texture.refresh=function(...a){uploads++;return refresh.apply(this,a);};
  s.game.renderer.emit('render',s,c);uploads=0;const start=performance.now();
  for(let i=0;i<300;i++)s.game.renderer.emit('render',s,c);
  texture.refresh=refresh;return {frames:300,uploads,elapsedMs:performance.now()-start};
 });assert.equal(performanceReport.uploads,0);
 await page.evaluate(()=>{const s=__game.scene.getScene('Level1Parte2');s.apagarLuzFabrica();s.scene.resume();});
 await page.waitForFunction(()=>__game.scene.getScene('Level1Parte2').scene.isActive());
 await page.evaluate(()=>{window.__oldLight=__game.scene.getScene('Level1Parte2').iluminacaoFabrica;});
 await entrarFabricaHacking(page,false);
 await page.waitForFunction(()=>{const s=__game.scene.getScene('Level1Parte2');return s.scene.isActive() && s.iluminacaoFabrica && s.iluminacaoFabrica!==window.__oldLight;});
 assert.equal(await page.evaluate(()=>!!__game.scene.getScene('Level1Parte2').recursosLanterna),false);
 // Nova partida: os mesmos estados que BootPartida limpa são restaurados antes de iniciar outra visita.
 await page.evaluate(()=>{__game.registry.remove('factoryFlashlightRetired');__game.registry.remove('factoryGeneratorPowered');});
 await page.evaluate(()=>{window.__oldLight=__game.scene.getScene('Level1Parte2').iluminacaoFabrica;});
 await entrarFabricaHacking(page,false);
 await page.waitForFunction(()=>{const s=__game.scene.getScene('Level1Parte2');return s.scene.isActive() && s.iluminacaoFabrica && s.iluminacaoFabrica!==window.__oldLight;});
 assert.equal(await page.evaluate(()=>!!__game.scene.getScene('Level1Parte2').recursosLanterna),true);
 assert.deepEqual(errors,[]);writeFileSync('/tmp/factory-lighting-solo/report.json',JSON.stringify({initial,freed,performanceReport,devAndReturnDoNotReactivate:true,newRunRestores:true},null,2));
 console.log('PASS: iluminação sem pontos, lanterna descarregada, DEV, retorno, nova partida, cache.',performanceReport);
}finally{await browser.close();}
