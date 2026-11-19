/** Queda, dois resgates entre mapas, terceira morte e quatro operadores no Phaser real. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { novoBossConfig } from '../js/enemies/novoBoss/NovoBossConfig.js';
import { SOLO_PET_REVIVALS_KEY } from '../js/player/SoloRunState.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const launchOptions={ executablePath:process.env.CHROMIUM_PATH,headless:true,
  args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--disable-gpu-watchdog'] };
let browser,context,page;
const errors=[], assets=[];
const pasta=process.env.ARTIFACT_DIR ?? '/tmp/solo-pet-revival';mkdirSync(pasta,{recursive:true});
const relatorio={resgates:[],personagens:[]};
const apenasNovaPartida=process.env.SOLO_TEST_CASE==='nova-partida';
async function abrirNavegador({seed=false}={}){
browser=await chromium.launch(launchOptions);
context=await browser.newContext({viewport:{width:1000,height:650},hasTouch:true});
page=await context.newPage();
page.on('pageerror',e=>{errors.push(e.stack);console.error(e.stack);});
page.on('response',r=>{if(r.status()>=400&&/DEAD|dead|robo-pet/.test(r.url()))assets.push(r.url());});
await page.route('**/js/core/game.js*',async route=>{
  const response=await route.fetch(),source=await response.text();
  let body=source.replace('const game = new Game(jogoRapido);',
    'const game = window.__game = new Game(jogoRapido);');
  if(seed)body=body.replace('this.scene.start("Start",',
    `this.registry.set(${JSON.stringify(SOLO_PET_REVIVALS_KEY)},2);this.scene.start("Start",`);
  await route.fulfill({response,body});
});
page.setDefaultTimeout(20000);
}
await abrirNavegador();
async function esperarCena(key){
  await page.waitForFunction(key=>{
    const s=window.__game?.scene.getScene(key);
    return s?.scene.isActive()&&s.player?.active&&s.reanimacaoSolo&&!s.cameras.main.fadeEffect?.isRunning;
  },key,{timeout:90000});
  await page.waitForTimeout(120);
}
async function estado(key){return page.evaluate(key=>{
  const s=window.__game.scene.getScene(key),p=s.player;
  return {vida:s.vida,max:s.vidaMaxima,morto:p.morto,morte:s.morteEmAndamento,tela:!!s.telaMorteMostrada,
    resgate:s.reanimacaoSolo.snapshot(),x:p.x,y:p.y,body:p.body.enable,physics:s.physics.world.isPaused,
    input:s.input.enabled,keyboard:s.input.keyboard.enabled,anim:p.anims.currentAnim?.key,
    textura:p.texture.key,frame:Number(p.frame.name),invulneravel:p.invulneravel,
    pet:{x:s.companionPet.x,y:s.companionPet.y},inventario:s.inventory.getSlots(),
    frames:s.__quadrosQueda??[]};
},key);}
async function matar(key){
  return page.evaluate(async key=>{
    const s=window.__game.scene.getScene(key);
    s.__quadrosQueda=[];
    if(s.__capturaQueda!==s.player){
      s.player.on('animationupdate',(anim,frame)=>{
        if(anim.key.startsWith('coop-down-'))s.__quadrosQueda.push(Number(frame.textureFrame));
      });s.__capturaQueda=s.player;
    }
    s.player.invulneravel=false;s.developerMode=false;s.vida=1;
    if(key==='Level1Parte2')window.__bossAntesPet={b:s.novoBoss,vida:s.novoBoss.vida,ataque:s.novoBoss.ataqueAtual};
    const {causarDanoPlayer}=await import('/js/enemies/EnemyLaser.js');
    causarDanoPlayer(s,1000,{x:s.player.x-10,y:s.player.y});
    // Repetição do mesmo caminho de dano não cria outro resgate.
    const {default:morrer}=await import('/js/scenes/DeathScreen.js');morrer(s);
    return {x:s.player.x,y:s.player.y,restantes:s.reanimacaoSolo.restantes};
  },key);
}
async function esperarResgate(key){
  await page.waitForFunction(key=>{
    const s=window.__game.scene.getScene(key);
    return s.reanimacaoSolo.snapshot().fase==='pronto'&&s.vida>0;
  },key,{timeout:12000,polling:30});
  return estado(key);
}
try{
  if(!apenasNovaPartida){
  console.log('BOOT solo');
  await page.goto(process.env.BASE_URL??'http://127.0.0.1:8765/',{waitUntil:'networkidle',timeout:60000});
  await page.keyboard.press('k');
  await page.locator('.cutscene-skip').waitFor({state:'visible',timeout:45000});
  await page.locator('.cutscene-skip').click();
  await esperarCena('Level1');
  assert.equal((await estado('Level1')).resgate.restantes,2);
  await page.evaluate(()=>{
    const s=window.__game.scene.getScene('Level1');
    s.inventory.addItem('gasolina',1,{fuel:.6});
    window.__inventarioAntesResgate=s.inventory.getSlots();
    if (!s.inimigos.some(r => r.active && !r.morto)) {
      const gerente = s.enemySpawnManager;
      const zona = gerente.regions.find(z => gerente.spawnRegion(z) > 0);
      if (!zona) throw new Error('Nenhum robô de teste na cidade');
    }
  });
  const origem1=await matar('Level1');
  let s=await estado('Level1');
  assert.equal(s.resgate.fase,'caindo');assert.equal(s.tela,false);assert.equal(s.body,false);
  assert.equal(s.physics,false);assert.equal(s.textura,'coop-down-kai-mercer');
  const mundo = await page.evaluate(async () => {
    const { tempoPartida } = await import('/js/core/RelogioPartida.js');
    const s = window.__game.scene.getScene('Level1');
    window.__mundoAntesPet = {
      robos: s.inimigos.filter(r => r.active && !r.morto).map(r => [r, r.x, r.y]),
      tempo: tempoPartida(s),
    };
    return window.__mundoAntesPet.robos.length;
  });
  assert.ok(mundo > 0);
  await page.waitForFunction(() => window.__game.scene.getScene('Level1').reanimacaoSolo.resgatando &&
    window.__mundoAntesPet.robos.some(([r, x, y]) => r.active && Math.hypot(r.x - x, r.y - y) > 5));
  assert.ok(await page.evaluate(async () => {
    const { causarDanoPlayer } = await import('/js/enemies/EnemyLaser.js');
    const { tempoPartida } = await import('/js/core/RelogioPartida.js');
    const s = window.__game.scene.getScene('Level1');
    causarDanoPlayer(s, 10);
    return s.reanimacaoSolo.resgatando && s.vida === 0 && s.player.invulneravel &&
      tempoPartida(s) > window.__mundoAntesPet.tempo;
  }));
  await page.screenshot({path:`${pasta}/01-kai-caindo.png`});
  await page.waitForFunction(()=>window.__game.scene.getScene('Level1').reanimacaoSolo.snapshot().fase==='reanimando');
  await page.screenshot({path:`${pasta}/02-pet-reanimando.png`});
  s=await esperarResgate('Level1');
  assert.equal(s.resgate.restantes,1);assert.equal(s.vida,s.max);assert.equal(s.morte,false);
  assert.ok(s.body&&s.input&&s.keyboard&&!s.physics&&s.invulneravel);
  assert.ok(Math.hypot(s.x-origem1.x,s.y-origem1.y)<1);
  assert.ok(s.frames.includes(5));
  assert.deepEqual(s.inventario,await page.evaluate(()=>window.__inventarioAntesResgate));
  relatorio.resgates.push({mapa:'Level1',...s});
  await page.keyboard.down('d');await page.waitForTimeout(200);await page.keyboard.up('d');
  assert.ok((await estado('Level1')).x>origem1.x+5,'WASD funciona após o socorro');
  console.log('PASS: primeira queda e resgate na cidade');
  const config={...novoBossConfig,cenaEntrada:{...novoBossConfig.cenaEntrada,ativo:false},
    prologo:{...novoBossConfig.prologo,ativo:false},geradores:{...novoBossConfig.geradores,ativo:false},
    movimento:{...novoBossConfig.movimento,ativo:false},fase2:{...novoBossConfig.fase2,ativo:false},
    ataques:{...novoBossConfig.ataques,automatico:false}};
  await page.evaluate(config=>window.__game.scene.getScene('Level1').scene.start('Level1Parte2',{
    personagem:'kai-mercer',spawnX:-1093,spawnY:-5520,novoBossConfig:config}),config);
  await esperarCena('Level1Parte2');
  assert.equal((await estado('Level1Parte2')).resgate.restantes,1);
  await page.evaluate(()=>{
    const s=window.__game.scene.getScene('Level1Parte2'),b=s.novoBoss;
    b.receberDano(123);b.executarAtaque('lasers');
    window.__bossAntesPet={b,vida:b.vida,ataque:b.ataqueAtual};
  });
  await page.waitForFunction(()=>window.__game.scene.getScene('Level1Parte2').novoBoss.ataqueAtual?.tipo==='lasers');
  const origem2=await matar('Level1Parte2');
  const antesAtaque=await page.evaluate(()=>window.__game.scene.getScene('Level1Parte2').novoBoss.tempoAtaque);
  await page.waitForTimeout(1200);
  const durante = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    return { tempoAtaque: s.novoBoss.tempoAtaque, visivel: s.novoBoss.sprite.visible,
      resgatando: s.reanimacaoSolo.resgatando, physics: s.physics.world.isPaused };
  });
  assert.ok(durante.resgatando && durante.visivel && !durante.physics && durante.tempoAtaque > antesAtaque);
  s=await esperarResgate('Level1Parte2');
  assert.equal(s.resgate.restantes,0);assert.equal(s.vida,s.max);assert.equal(s.tela,false);
  assert.ok(Math.hypot(s.x-origem2.x,s.y-origem2.y)<1);
  const boss=await page.evaluate(()=>{
    const s=window.__game.scene.getScene('Level1Parte2'),ant=window.__bossAntesPet;
    return {mesmo:s.novoBoss===ant.b,vida:s.novoBoss.vida,suspenso:s.novoBoss.suspenso,
      antes:ant.vida};
  });
  assert.ok(boss.mesmo&&!boss.suspenso,JSON.stringify(boss));assert.equal(boss.vida,boss.antes);
  relatorio.resgates.push({mapa:'Level1Parte2',...s,boss});
  console.log('PASS: segundo resgate mantém luta e contador entre mapas');
  await page.waitForFunction(() => !window.__game.scene.getScene('Level1Parte2').player.invulneravel);
  await matar('Level1Parte2');
  assert.equal((await estado('Level1Parte2')).tela,false);
  await page.waitForFunction(()=>window.__game.scene.getScene('Level1Parte2').telaMorteMostrada===true);
  const derrota = await estado('Level1Parte2');
  assert.equal(derrota.resgate.restantes,0);
  assert.equal(derrota.physics,true);
  await page.waitForFunction(()=>window.__game.scene.getScene('Level1Parte2').children.list.some(o=>
    o.type==='Container'&&o.list.some(i=>i.text==='GAME OVER')),{},{timeout:12000});
  await page.screenshot({path:`${pasta}/03-game-over-terceira-morte.png`});
  console.log('PASS: terceira morte mostra GAME OVER depois da queda');
  for(const personagem of ['magnus-force','aria-kade','nyx']){
    await page.evaluate(async personagem=>{
      const s=window.__game.scene.getScenes(true).find(s=>['Level1','Level1Parte2'].includes(s.sys.settings.key));
      const {reiniciarResgatesSolo}=await import('/js/player/SoloRunState.js');
      reiniciarResgatesSolo(s.registry);
      if(s.sys.settings.key==='Level1')s.scene.restart({personagem});
      else s.scene.start('Level1',{personagem});
    },personagem);
    await esperarCena('Level1');
    if(personagem==='aria-kade')await page.evaluate(async()=>{
      const s=window.__game.scene.getScene('Level1');
      const {atacar}=await import('/js/player/Player.js');atacar(s);
    });
    await matar('Level1');await page.waitForTimeout(420);
    await page.screenshot({path:`${pasta}/queda-${personagem}.png`});
    s=await esperarResgate('Level1');
    assert.equal(s.resgate.restantes,1);assert.equal(s.vida,s.max);assert.ok(s.frames.includes(5));
    assert.ok(s.body&&s.input&&!s.physics);
    if(personagem==='aria-kade')assert.ok(await page.evaluate(()=>{
      const s=window.__game.scene.getScene('Level1');
      return !s.ariaAtaqueCarregando&&!s.eventoTensaoAria;
    }));
    relatorio.personagens.push({personagem,...s});
    console.log(`PASS: queda e resgate de ${personagem}`);

  }
  }
  // Outra inicialização em processo limpo evita acumular texturas dos quatro operadores
  // e dos dois mapas no Chromium com renderização por software do ambiente de testes.
  await context.close();await browser.close();await abrirNavegador({seed:true});
  await page.goto(process.env.BASE_URL??'http://127.0.0.1:8765/',{waitUntil:'networkidle',timeout:60000});
  await page.keyboard.press('k');
  await page.locator('.cutscene-skip').waitFor({state:'visible'});
  await page.locator('.cutscene-skip').click();
  await esperarCena('Level1');
  assert.equal((await estado('Level1')).resgate.restantes,2);
  console.log('PASS: nova partida devolve os dois resgates');
  assert.deepEqual(errors,[]);assert.deepEqual(assets,[]);
  relatorio.novaPartida={restantes:2};
  writeFileSync(`${pasta}/${apenasNovaPartida?'nova-partida':'relatorio'}.json`,JSON.stringify({...relatorio,errors,assets},null,2));
  console.log(apenasNovaPartida?'PASS: nova partida verificada pelo menu e BootPartida':'PASS: solo completo, quatro personagens, inventário, movimentação, troca de mapa e boss preservados');
}catch(error){
  await page.screenshot({path:`${pasta}/falha.png`}).catch(()=>{});
  writeFileSync(`${pasta}/parcial.json`,JSON.stringify({...relatorio,errors,assets},null,2));throw error;
}finally{await context.close();await browser.close();}
