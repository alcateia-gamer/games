/** Regressão real do spawn da cidade, corpos Arcade, contorno, recuo e limpeza. */
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || '/tmp/nullborns-test-tools/node_modules/playwright/index.mjs');
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
const artifacts=process.env.ARTIFACT_DIR || '/tmp/city-robots';mkdirSync(artifacts,{recursive:true});
const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
page.on('pageerror',e=>errors.push(e.stack));
try {
 await page.route('**/js/core/game.js*',async r=>{const response=await r.fetch();await r.fulfill({response,body:(await response.text()).replace('const game = new Game(jogoRapido);','const game = window.__game = new Game(jogoRapido);')});});
 await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8765');await page.keyboard.press('k');
 await page.locator('.cutscene-skip').waitFor();await page.locator('.cutscene-skip').click();
 await page.waitForFunction(()=>__game.scene.getScene('Level1')?.player?.active,null,{timeout:120000});
 const report=await page.evaluate(async()=>{
  const s=__game.scene.getScene('Level1'),m=s.enemySpawnManager;s.scene.pause();
  const {areaContemCorpo}=await import('/js/enemies/EnemySpawnArea.js');
  const {retanguloLivreDoMapa,invalidarCacheNavegacao}=await import('/js/enemies/EnemyPathfinding.js');
  const {criarInimigoTeste,criarRobos}=await import('/js/enemies/EnemyTest.js');
  const {atualizarDepthAtores,calcularDepthAtor}=await import('/js/map/ProfundidadeMapa.js');
  const {causarDanoInimigo}=await import("/js/enemies/EnemyHealth.js");
  const {applyKnockback}=await import('/js/combat/CombatEffects.js');
  const checks=[];const check=(condition,label)=>{if(!condition)throw Error(label);checks.push(label);};
  const clear=()=>{for(const e of [...s.inimigos])m.removerInimigoInvalido(e);};clear();
  const zones=[];
  for(const z of m.regions){
   s.player.body.reset(z.center.x,z.center.y+450);s.player.body.updateFromGameObject();
   let count=0;
   for(let cycle=0;cycle<10 && !count;cycle++) {
    count=m.spawnRegion(z);
    if(!count)check(s.inimigos.length===0,`zona ${z.id}: falha de tentativa não cria fallback`);
   }
   check(count>=2 && count<=m.config.maxEnemies,`zona ${z.id}: grupo dentro dos limites (${count})`);
   check(['padrao','serra'].every(t=>z.enemies.some(e=>e.tipoRobo===t)),`zona ${z.id}: dois tipos`);
   for(const e of z.enemies){
    const b=e.body,rect=new Phaser.Geom.Rectangle(b.x,b.y,b.width,b.height);
    check(areaContemCorpo(z.area,rect),`zona ${z.id}: corpo real ${e.tipoRobo} contido`);
    check(m.playableArea.contem(b) && retanguloLivreDoMapa(s,b),`zona ${z.id}: corpo livre e no mapa`);
    const expected=e.tipoRobo==='serra'?[68.4,36]:[41.4,25.3];
    check(Math.abs(b.width-expected[0])<.001 && Math.abs(b.height-expected[1])<.001,`corpo ${e.tipoRobo} coincide com perfil`);
    check(!m.isValidPosition(e,e.tipoRobo,[]),'posição ocupada não aceita outro robô');
   }
   zones.push({id:z.id,count,types:z.enemies.map(e=>e.tipoRobo)});clear();
  }
  check(criarInimigoTeste(s,{x:s.player.x,y:s.player.y})===null,'construtor rejeita criação sem zona');
  check(criarInimigoTeste(s,{})===null,'construtor não usa respawn como fallback');
  const z=m.regions[0];s.player.body.reset(z.center.x,z.center.y+450);s.player.body.updateFromGameObject();
  const bloco=s.collisionGroup.create(z.center.x,z.center.y);bloco.body.setSize(z.area.width,z.area.height);bloco.body.reset(z.center.x,z.center.y);
  invalidarCacheNavegacao(s);check(m.spawnRegion(z)===0,'retângulo totalmente bloqueado não cria robô');
  bloco.destroy();invalidarCacheNavegacao(s);
  const oldWidth=z.area.width;z.area.width=20;check(m.spawnRegion(z)===0,'retângulo pequeno não tem fallback');z.area.width=oldWidth;
  m.spawnRegion(z);const e=z.enemies.find(e=>e.tipoRobo==='serra');check(!!e,'robô real para física e recuo');
  for(const outro of [...s.inimigos])if(outro!==e)m.removerInimigoInvalido(outro);
  s.cameras.main.stopFollow().centerOn(z.center.x,z.center.y);
  const target=e.body.bottom;s.player.body.reset(e.x,e.y-50);s.player.body.updateFromGameObject();atualizarDepthAtores(s);
  check(e.depth===calcularDepthAtor(s,target,e),'depth usa os pés reais');
  check(e.depth>s.player.depth,'robô à frente do personagem');
  s.player.body.reset(e.x,e.y+100);s.player.body.updateFromGameObject();atualizarDepthAtores(s);
  check(e.depth<s.player.depth,'robô atrás do personagem');
  // Uma parede de dois pixels testa o passo inteiro, além da separação discreta do Arcade.
  const wall=s.collisionGroup.create(e.body.x+e.body.width+15,e.body.center.y);
  wall.body.setSize(2,180);wall.body.reset(e.body.x+e.body.width+15,e.body.center.y);invalidarCacheNavegacao(s);
  const start={x:e.x,y:e.y};
  for(let i=0;i<15;i++){
   applyKnockback(s,{x:e.x-100,y:e.y},e,10000,10000);
   s.physics.world.update(s.time.now+i*34,34);s.physics.world.postUpdate();
   check(e.body.right<=wall.body.x+.01,'impactos consecutivos param na parede fina');
   check(m.playableArea.contem(e.body),'impactos mantêm corpo no mapa');
  }
  check(e.x>start.x,'impacto preserva deslocamento visível');
  wall.destroy();invalidarCacheNavegacao(s);
  // Encontra uma borda externa real em linha reta a partir da zona.
  e.setVelocity(0,0);e.body.reset(start.x,start.y);e.body.updateFromGameObject();
  for(let i=0;i<250;i++){
   applyKnockback(s,{x:e.x+100,y:e.y},e,320,250);
   s.physics.world.update(s.time.now+1000+i*34,34);s.physics.world.postUpdate();
   check(m.playableArea.contem(e.body),'corpo não atravessa contorno após recuos repetidos');
  }
  e.setVelocity(0,0);const before=e.x;m.limparForaDoMapa();check(e.active && e.x===before,'limpeza mantém robô na borda válida');
  const worldListeners=s.physics.world.listenerCount('worldstep'),sceneListeners=s.events.listenerCount('shutdown');
  let deaths=0;const death=s.scrapSystem.onRobotDeath;s.scrapSystem.onRobotDeath=()=>deaths++;
  e.body.reset(1e5,1e5);e.body.updateFromGameObject();m.limparForaDoMapa();
  check(!e.active && !e.scene && !s.inimigos.includes(e) && !z.enemies.includes(e),'remoção descarta corpo, sprite e referências');
  check(deaths===0,'remoção não chama morte nem drop');
  check(s.physics.world.listenerCount('worldstep')===worldListeners-1,'remoção desliga listener físico');
  check(s.events.listenerCount('shutdown')===sceneListeners-2,'remoção desliga listeners de física e áudio');
  s.scrapSystem.onRobotDeath=death;
  const initial=m.config.spawnOnce;m.config.spawnOnce=false;z.nextAttempt=0;z.activated=true;
  s.player.body.reset(z.center.x,z.center.y+450);s.player.body.updateFromGameObject();m.checkSpawnZones(s.time.now+10000);
  check(z.enemies.length>=2,'modo de respawn repõe zona sem sair dos retângulos');m.config.spawnOnce=initial;
  for(const enemy of z.enemies)check(areaContemCorpo(z.area,new Phaser.Geom.Rectangle(enemy.body.x,enemy.body.y,enemy.body.width,enemy.body.height)),'respawn fica na zona');
  m.config.spawnOnce=false;
  const derrotado=z.enemies.find(enemy=>enemy.tipoRobo==='serra');let drops=0;
  const onDeath=s.scrapSystem.onRobotDeath.bind(s.scrapSystem);s.scrapSystem.onRobotDeath=enemy=>{drops++;onDeath(enemy);};
  causarDanoInimigo(s,derrotado,99999,{attacker:s.player,particles:0});
  check(derrotado.morto && !derrotado.body.enable && drops===1,'derrota normal preserva drop e desativa corpo');
  z.nextAttempt=0;m.checkSpawnZones(s.time.now+15000);
  check(z.enemies.some(enemy=>enemy.tipoRobo==='serra' && enemy!==derrotado),'respawn após eliminação repõe o tipo derrotado');
  for(const enemy of z.enemies)check(areaContemCorpo(z.area,new Phaser.Geom.Rectangle(enemy.body.x,enemy.body.y,enemy.body.width,enemy.body.height)),'reposição após morte continua no retângulo');
  s.scrapSystem.onRobotDeath=onDeath;m.config.spawnOnce=initial;
  const replica=criarInimigoTeste(s,{remoteOnly:true,tipoRobo:'serra',x:z.center.x,y:z.center.y});
  const auxiliares=[replica.debugHitboxDano,replica.fundoVida,replica.barraVida,replica.bordaVida];
  replica.destroy();s.inimigos=s.inimigos.filter(enemy=>enemy!==replica);
  check(auxiliares.every(obj=>!obj.scene),'descarte de réplica também limpa visuais auxiliares');
  const total=s.inimigos.length;s.multiplayer=true;s.isMultiplayerHost=false;
  check(criarRobos(s,3).length===0 && m.spawnRegion(z)===0 && s.inimigos.length===total,'cliente não cria inimigos adicionais');s.multiplayer=false;
  return {checks:checks.length,zones,bounds:m.playableArea.bounds};
 });
 assert.deepEqual(errors,[]);console.log(JSON.stringify(report,null,2));
 await page.screenshot({path:`${artifacts}/spawn-zona.png`});writeFileSync(`${artifacts}/solo.json`,JSON.stringify(report,null,2));
 console.log('PASSOU: robôs da cidade no Phaser real.');
} finally{await browser.close();}
