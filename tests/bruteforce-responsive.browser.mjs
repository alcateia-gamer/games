import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/nullborns-playwright/package/index.mjs');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/snap/brave/current/opt/brave.com/brave/brave',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const dir=process.env.ARTIFACT_DIR || '/tmp/bruteforce-responsive';mkdirSync(dir,{recursive:true});
try {
 const page=await browser.newPage({hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.route('**/js/core/game.js*',r=>r.fulfill({body:'',contentType:'text/javascript'}));
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8765');
 await page.evaluate(async()=>{
  document.body.replaceChildren();
  const {criarPainelBruteforce}=await import('/js/ui/BruteforcePanel.js');
  const {BruteforcePuzzle,lerColuna,BRUTEFORCE_WINDOW}=await import('/js/puzzles/BruteforcePuzzle.js');
  window.model=new BruteforcePuzzle(41);window.ler=lerColuna;window.validWindow=BRUTEFORCE_WINDOW;
  window.commands=[];window.panel=criarPainelBruteforce(cmd=>commands.push(cmd));
  window.state=model.snapshot();state.tempo=0;
  // Fixar as colunas mantém a geometria estável sem substituir o relógio do browser.
  for(const c of state.colunas){c.fixada=true;c.congeladaEm=0;c.fase=-c.letras.indexOf(c.alvo);}
  panel.atualizar(state);
 });
 for(const [width,height] of [[1920,1080],[1600,900],[1366,768],[1280,720],[960,540],[932,430],[844,390],[740,360],[667,375],[1024,768],[800,600],[390,844],[568,320]]) {
  await page.setViewportSize({width,height});await page.waitForTimeout(100);
  const geometry=await page.evaluate(()=>{
   const p=document.querySelector('.bruteforce-overlay .nullnet-panel'),r=p.getBoundingClientRect();
   const reels=document.querySelector('.brute-reels').getBoundingClientRect();
   const band=document.querySelector('.brute-band').getBoundingClientRect();
   const letter=document.querySelector('.brute-letter.target').getBoundingClientRect();
   const essential=[...document.querySelectorAll('.brute-confirm,header>button,.brute-password,.brute-progress,.nullnet-message')].map(el=>{const b=el.getBoundingClientRect();return b.left>=r.left-1 && b.right<=r.right+1 && b.top>=r.top-1 && b.bottom<=r.bottom+1;});
   return {fits:r.left>=0 && r.right<=innerWidth+.1 && r.top>=0 && r.bottom<=innerHeight+.1,overflow:p.scrollWidth>p.clientWidth || p.scrollHeight>p.clientHeight,letterSize:parseFloat(getComputedStyle(document.querySelector('.brute-letter')).fontSize)*r.width/p.offsetWidth,band:band.height,centerError:Math.abs(letter.y+letter.height/2-(band.y+band.height/2)),button:document.querySelector('.brute-confirm').getBoundingClientRect().height,reels:reels.width,panelWidth:r.width,essential};
  });
  assert.ok(geometry.fits && !geometry.overflow && geometry.essential.every(Boolean),JSON.stringify({width,height,...geometry}));
  assert.ok(geometry.letterSize>=28,JSON.stringify({width,height,...geometry}));
  assert.ok(geometry.centerError<1,JSON.stringify(geometry));assert.ok(geometry.band>30);assert.ok(geometry.button>=43);
  if(width>height && height<=600)assert.ok(geometry.reels>=geometry.panelWidth*.59,JSON.stringify(geometry));
  await page.evaluate(()=>{const live=structuredClone(state);live.colunas.forEach(c=>c.fixada=false);panel.atualizar(live);});
  await page.waitForTimeout(80);
  await page.screenshot({path:`${dir}/${width}x${height}.png`});
  await page.evaluate(()=>panel.atualizar(state));
  // A borda da faixa é exatamente o limite lógico em todas as escalas.
  for(const phase of [-.34,.34,.35]) {
   await page.evaluate(phase=>{const c=state.colunas[0];c.fase=-c.letras.indexOf(c.alvo)+phase;panel.atualizar(state);},phase);
   await page.waitForTimeout(30);
   const aligned=await page.evaluate(()=>{
    const c=state.colunas[0],el=document.querySelector('.brute-column .target'),r=el.getBoundingClientRect(),b=document.querySelector('.brute-band').getBoundingClientRect();
    return {distance:Math.abs(r.y+r.height/2-b.y-b.height/2),limit:b.height/2,valid:ler(c,0).centralizada};
   });
   assert.equal(aligned.valid,Math.abs(phase)<=.34);assert.ok(Math.abs(aligned.distance-Math.abs(phase)*aligned.limit/.34)<.2,JSON.stringify({width,height,phase,...aligned}));
  }
  await page.evaluate(()=>{const c=state.colunas[0];c.fase=-c.letras.indexOf(c.alvo);panel.atualizar(state);});
  for(const message of ['FORA DA FAIXA CENTRAL · aguarde a letra verde atravessar a linha. Tente novamente esta coluna.','PASSWORD ACCEPTED\nEMPLOYEE ID: EV-041\nSECURITY CLEARANCE: RESTORED\nRECOVERING ARCHIVED DATA...']) {
   await page.evaluate(message=>panel.atualizar({...state,mensagem:message}),message);await page.waitForTimeout(40);
   assert.ok(await page.locator('.bruteforce-overlay .nullnet-panel').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight+.1 && el.scrollHeight<=el.clientHeight && el.scrollWidth<=el.clientWidth;}));
  }
  await page.evaluate(()=>panel.atualizar(state));
  console.log(`PASS ${width}×${height}`);
 }
 await page.setViewportSize({width:844,height:390});
 await page.evaluate(()=>{
  document.querySelector('.brute-reels').style.setProperty('--brute-step','72px');
  const c=state.colunas[0];c.fase=-c.letras.indexOf(c.alvo)+.2;panel.atualizar(state);
 });
 await page.waitForTimeout(60);
 const resized=await page.evaluate(()=>{const l=document.querySelector('.brute-column .target').getBoundingClientRect(),b=document.querySelector('.brute-band').getBoundingClientRect();return {height:l.height,distance:l.y+l.height/2-b.y-b.height/2,band:b.height};});
 assert.ok(Math.abs(resized.height-72)<.1 && Math.abs(resized.distance-14.4)<.1 && Math.abs(resized.band-72*.68)<.1,JSON.stringify(resized));
 await page.evaluate(()=>{state.colunas.forEach(c=>c.fixada=false);panel.atualizar(state);});
 await page.locator('.brute-confirm').tap();assert.equal(await page.evaluate(()=>commands.at(-1).op),'congelar');
 await page.getByRole('button',{name:'Como jogar',exact:true}).click();assert.equal(await page.evaluate(()=>commands.at(-1).op),'tutorial');
 await page.getByRole('button',{name:'Fechar terminal',exact:true}).click();assert.equal(await page.evaluate(()=>commands.at(-1).op),'cancelar');
 await page.evaluate(()=>panel.destruir());assert.equal(await page.locator('.bruteforce-overlay').count(),0);assert.deepEqual(errors,[]);
} finally {await browser.close();}
