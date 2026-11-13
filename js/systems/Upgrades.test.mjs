import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { createEconomy, economyFor, accountFor, playerAccount, purchase, modifiers, modifiersFor,
  applyUpgrades, basicDamage, specialCooldown, localPlayerId } from './UpgradeSystem.js';
import { rollScrap, SCRAP_BALANCE, UPGRADE_NPC } from './UpgradeBalance.js';
import { upgradeDefinitions, CHARACTER_NAMES } from './UpgradeDefinitions.js';
import { ScrapSystem, claimScrap, canUseShop } from './ScrapSystem.js';
import { UpgradeShopUI } from '../ui/UpgradeShopUI.js';
import { createUpgradeNPC } from '../interactions/UpgradeNPC.js';
import { dispararProjetil } from '../player/PlayerProjectiles.js';
import { tomarDano } from '../player/PlayerStatus.js';
import { criarSistemaEspeciais, atualizarSistemaEspeciais } from '../combat/PlayerSpecialAbilities.js';
import { mergePendingFrame } from '../multiplayer/CoopVisuals.js';
import { soloContext } from '../multiplayer/CoopContext.js';

globalThis.Phaser = { Math: { Clamp: (v,a,b) => Math.max(a,Math.min(b,v)) },
  Scenes: { Events: { SHUTDOWN: 'shutdown' } } };
function visual(x = 0, y = 0, key = '', frame = 0) {
  const o = new EventEmitter();
  Object.assign(o, { x, y, key, frame, active: true, style: {},
    body: { setAllowGravity(){}, setImmovable(){}, setSize(){}, setOffset(){}, setVelocity(){} } });
  for (const k of ['setDisplaySize','setOrigin','setDepth','setScrollFactor','setName','setStrokeStyle','setRotation','setInteractive','setScale','setTint','setAlpha','setVisible'])
    o[k] = (...args) => { o[k.slice(3)] = args; return o; };
  o.setText = text => { o.text = text; return o; };
  o.setVelocity = (x,y) => { o.velocity = {x,y}; return o; };
  o.destroy = () => { o.active = false; o.destroyed = true; };
  return o;
}
function scene(character = 'kai-mercer', registry = new Map()) {
  const s = { personagemSelecionada: character, game: { registry }, sys: { settings: { key: 'Level1' } },
    events: new EventEmitter(), player: visual(UPGRADE_NPC.x, UPGRADE_NPC.y),
    vida: 50, vidaMaxima: 100, speed: 200, time: { now: 0 },
    input: { enabled: true, keyboard: Object.assign(new EventEmitter(), { enabled: true, resetKeys(){} }) },
    add: { text: visual, image: visual, rectangle: visual, sprite: visual, circle: visual },
    textures: { get: () => ({ has: () => true }) },
    tweens: { add(){}, killTweensOf(){} },
  };
  return s;
}
function grant(s, scrap = 300) { const a = accountFor(s); a.scrap = scrap; return a; }

test('compras são atômicas, preços são por nível e reenvio não compra o próximo nível', () => {
  const e = createEconomy(), a = playerAccount(e,'p','kai-mercer'); a.scrap = 44;
  for (const [level,cost] of [8,14,22].entries()) {
    const before = a.scrap;
    assert.equal(purchase(e,'p','kai-mercer','muscle',level).cost,cost);
    assert.equal(a.scrap,before-cost);
    assert.equal(purchase(e,'p','kai-mercer','muscle',level).ok,false);
  }
  assert.equal(a.scrap,0);
  assert.equal(purchase(e,'p','kai-mercer','muscle',3).ok,false);
  assert.equal(purchase(e,'p','kai-mercer','health',0).ok,false);
  assert.equal(purchase(e,'p','kai-mercer','invalid',0).ok,false);
  assert.equal(e.revision,3);
});
for (const character of Object.keys(CHARACTER_NAMES)) test(`${character}: níveis acumulados, vida proporcional, isolamento e dano real`, () => {
  const s = scene(character), a = grant(s, 1000);
  for (const d of upgradeDefinitions(character)) for (let level=0;level<3;level++) {
    assert.equal(purchase(economyFor(s),'solo',character,d.id,level).ok,true);
  }
  const m = modifiersFor(s);
  assert.equal(m.melee,character === 'aria-kade' ? undefined : .15); assert.equal(m.armor,.09); assert.equal(m.speed,.09);
  applyUpgrades(s);
  const hp = s.vida, max = s.vidaMaxima;
  for (let i=0;i<20;i++) applyUpgrades(s);
  assert.equal(s.vida,hp); assert.equal(s.vidaMaxima,max);
  assert.ok(Math.abs(s.vida / max - .5) < 1e-10);
  const damage = basicDamage(s,25,character === 'aria-kade');
  assert.ok(damage <= 33.25 + 1e-9 && damage >= 28.75 - 1e-9);
  const next = scene(character,s.game.registry); applyUpgrades(next);
  assert.equal(next.vidaMaxima,max); assert.equal(accountFor(next),a);
  assert.equal(s.speed,200, 'não acumula multiplicadores na velocidade original');
});

test('cada jogador tem saldo próprio e níveis por personagem', () => {
  const e = createEconomy(); playerAccount(e,'a','kai-mercer').scrap=100;
  purchase(e,'a','kai-mercer','weapon',0);
  assert.equal(playerAccount(e,'b','kai-mercer').scrap,0);
  assert.deepEqual(playerAccount(e,'a','nyx').characters.nyx,{});
  assert.equal(playerAccount(e,'a','nyx').scrap,90);
});

test('contextos cooperativos usam a economia do host e o ID correto mesmo com multiplayer=false', () => {
  const s=scene(); s.multiplayer=true; s.multiplayerManager={playerId:'host',room:{}}; s.coopRuntime={host:true};
  grant(s); accountFor(s).characters['kai-mercer'].weapon=3;
  const local=soloContext(s), remote=soloContext(s,{coopRemotePlayerId:'guest',personagemSelecionada:'nyx'},true);
  assert.equal(local.multiplayer,false); assert.equal(localPlayerId(local),'host');
  assert.equal(modifiersFor(local).weapon,.18); assert.equal(modifiersFor(remote).healing,0);
});

test('cooldowns respeitam piso e Kai mantém intervalo sem domo', () => {
  for (const c of Object.keys(CHARACTER_NAMES)) {
    const s=scene(c),a=grant(s);a.characters[c]={processor:3,special:3};
    const base=c==='nyx'?20000:c==='aria-kade'?9600:8000;
    assert.ok(specialCooldown(s,base)>= (c==='kai-mercer'?6800:3000));
    assert.ok(specialCooldown(s,base)<base);
  }
});

test('blindagem entra uma vez no cálculo real de dano', () => {
  const s=scene();grant(s).characters['kai-mercer'].armor=3;
  s.player=null; s.vida=100;
  tomarDano(s,10);
  assert.equal(s.vida,90.9);
});

test('flecha original da Aria recebe bônus, conserva dano base para validação do host', () => {
  const s=scene('aria-kade');grant(s).characters['aria-kade']={weapon:3,muscle:3};
  s.direcaoAtual='down'; s.player.depth=10; s.player.displayOriginX=32;s.player.displayOriginY=32;
  s.projeteisPlayer={active:true,children:{entries:[]},add(){}};
  s.physics={add:{sprite:visual}};s.networkAttackId=1;
  const arrow=dispararProjetil(s,{damage:50});
  assert.equal(arrow.key,'aria-arrow');assert.equal(arrow.dano,59);assert.equal(arrow.ataqueBasico.danoAria,50);
});

test('holograma real da Aria é único, dura 5,175s e usa cooldown melhorado', () => {
  const s=scene('aria-kade');grant(s).characters['aria-kade']={processor:3,special:3};
  s.direcaoAtual='down';s.player.scaleX=s.player.scaleY=1;s.player.body=null;
  const animations=new Map();
  s.anims={exists:k=>animations.has(k),create:c=>animations.set(c.key,c),generateFrameNumbers:(key,{start,end})=>Array.from({length:end-start+1},(_,i)=>({key,frame:start+i}))};
  s.add.sprite=(...args)=>{const o=visual(...args);o.play=()=>o;return o;};
  criarSistemaEspeciais(s); s.events.emit('player:especial');
  const holo=s.estadoEspecial.holograma;
  assert.ok(holo);assert.ok(Math.abs(holo.expiraEm-5175)<1e-9);
  assert.equal(s.estadoEspecial.proximoUso,8160);
  // Segunda invocação sem posição de teleporte livre não pode criar outra cópia.
  s.events.emit('player:especial');assert.equal(s.estadoEspecial.holograma,holo);
});

test('drops têm probabilidades e intervalos definidos, sem depender de sorte no teste', () => {
  for (const [type,p] of Object.entries(SCRAP_BALANCE.profiles)) {
    assert.equal(rollScrap(type,()=>p.chance),0);
    let i=0;assert.equal(rollScrap(type,()=>[0,0][i++]),p.min);
    i=0;assert.equal(rollScrap(type,()=>[0,.999999][i++]),p.max);
    let hits=0;
    for(let n=0;n<1000;n++) { let i=0; if(rollScrap(type,()=>i++ ? .5 : n/1000)) hits++; }
    assert.equal(hits,p.chance*1000);
  }
  assert.equal(rollScrap('boss'),0);
});

test('coleta concorrente credita uma vez, valida posição e mapa', () => {
  const e=createEconomy();e.drops.a={x:0,y:0,mapKey:'Level1',quantity:3};
  assert.equal(claimScrap(e,'a','a','nyx','Level1Parte2',{x:0,y:0}),0);
  assert.equal(claimScrap(e,'a','a','nyx','Level1',{x:100,y:0}),0);
  assert.equal(claimScrap(e,'a','a','nyx','Level1',{x:0,y:0}),3);
  assert.equal(claimScrap(e,'a','b','nyx','Level1',{x:0,y:0}),0);
  assert.equal(playerAccount(e,'a','nyx').scrap,3);assert.equal(playerAccount(e,'b','nyx').scrap,0);
});

test('morte duplicada, revisita de zona e spawns dev não produzem recompensas extras', () => {
  const s=scene(),system=new ScrapSystem(s);s.scrapSystem=system;
  const enemy={tipoRobo:'olhao',upgradeZoneId:1,x:0,y:0};
  system.onRobotDeath(enemy);system.onRobotDeath(enemy);
  assert.equal(economyFor(s).rewarded,1);
  system.onRobotDeath({tipoRobo:'olhao',x:0,y:0});assert.equal(economyFor(s).rewarded,1);
  for(let i=0;i<20;i++)system.onRobotDeath({...enemy});
  assert.equal(economyFor(s).rewarded,5);
  const again=new ScrapSystem(scene('kai-mercer',s.game.registry));
  again.onRobotDeath({...enemy});assert.equal(economyFor(s).rewarded,5);
  system.destroy();again.destroy();assert.equal(s.events.listenerCount('update'),0);
});

test('limite de drops, limpeza de animações e coleta após recriar cena', () => {
  const s=scene(),system=new ScrapSystem(s);s.scrapSystem=system;
  for(let i=0;i<70;i++)system.onRobotDeath({tipoRobo:'olhao',upgradeZoneId:i,x:s.player.x,y:s.player.y});
  assert.equal(Object.keys(economyFor(s).drops).length,48);
  system.syncVisuals();assert.equal(system.visuals.size,48);
  assert.equal(new Set([...system.visuals.values()].map(image=>image.frame)).size,12);
  assert.equal(system.counterIcon.frame,'scrap-10');
  const images=[...system.visuals.values()];system.destroy();assert.ok(images.every(i=>i.destroyed));
  const next=scene('kai-mercer',s.game.registry),recreated=new ScrapSystem(next);recreated.update();
  assert.ok(accountFor(next).scrap>=48*4);recreated.update();assert.equal(Object.keys(economyFor(next).drops).length,0);
  recreated.destroy();
});

test('host rejeita compra distante e valida níveis e saldo sem aceitar dados do cliente', () => {
  const s=scene(),r={host:true,manager:{sendCoopAction(){}},players:{remotes:new Map()}};
  s.multiplayer=true;s.multiplayerManager={playerId:'host',room:{}};s.coopRuntime=r;
  const guest=soloContext(s,{coopRemotePlayerId:'guest',personagemSelecionada:'nyx',player:visual(0,0),vida:95},true);
  r.players.remotes.set('guest',{context:guest});
  const a=playerAccount(economyFor(s),'guest','nyx');a.scrap=10;
  const sys=new ScrapSystem(s);s.scrapSystem=sys;
  const buy={kind:'upgradeBuy',playerId:'guest',payload:{id:'weapon',level:0,scrap:99999,cost:0}};
  sys.receive(buy);assert.equal(a.scrap,10);assert.deepEqual(a.characters.nyx,{});
  guest.player.x=UPGRADE_NPC.x;guest.player.y=UPGRADE_NPC.y;
  sys.receive(buy);sys.receive(buy);assert.equal(a.scrap,0);assert.equal(a.characters.nyx.weapon,1);
  assert.equal(accountFor(s).scrap,0);sys.destroy();
});

test('estado de rede não retrocede e snapshot repetido não cura', () => {
  const s=scene();s.multiplayer=true;s.multiplayerManager={playerId:'local',room:{}};
  const sys=new ScrapSystem(s);s.scrapSystem=sys;
  const e=createEconomy();e.revision=5;playerAccount(e,'local','kai-mercer').characters['kai-mercer'].health=3;
  sys.restore(e);const hp=s.vida;sys.restore(structuredClone(e));sys.restore({...e,revision:4});
  assert.equal(s.vida,hp);assert.equal(economyFor(s).revision,5);sys.destroy();
});

test('compressão de quadros preserva economia do keyframe entre deltas', () => {
  const economy={revision:3},visuals={full:true,changed:[],removed:[]};
  const merged=mergePendingFrame({streamId:'s',mapKey:'Level1',upgradeEconomy:economy,visuals},
    {streamId:'s',mapKey:'Level1',visuals:{...visuals,full:false}});
  assert.equal(merged.upgradeEconomy,economy);
});

test('NPC usa frame existente, coordenada exata e interação compartilhada por proximidade', () => {
  const s=scene(), {npc,shop}=createUpgradeNPC(s);
  assert.equal(npc.x,-410);assert.equal(npc.y,8817);assert.equal(npc.key,'upgrade-npc');assert.equal(npc.frame,180);
  assert.equal(s.physics,undefined, 'NPC não requer física nem participa do grupo de inimigos');
  s.events.emit('update');assert.equal('buttonOnly' in s.interacaoCiberneticasProxima,false);
  let opened=0;shop.open=()=>{opened++;return true;};
  assert.equal(s.interacaoCiberneticasProxima.interact(),true);assert.equal(opened,1);
  assert.equal(s.input.keyboard.listenerCount('keydown-E'),0);
  s.player.x+=91;s.events.emit('update');assert.equal(s.interacaoCiberneticasProxima,null);
  shop.open=UpgradeShopUI.prototype.open;
  assert.equal(canUseShop(s,'Level1'),false);assert.equal(shop.open(),false);
  globalThis.window={removeEventListener(){}};
  s.events.emit('shutdown');assert.equal(s.input.keyboard.listenerCount('keydown-E'),0);assert.equal(npc.destroyed,true);
  delete globalThis.window;
});

test('abrir/fechar repetidamente restaura input e não duplica listeners; soltar E não fecha', () => {
  const s=scene(),shop=new UpgradeShopUI(s);
  shop.root={hidden:true,querySelector:()=>({focus(){}})};shop.render=()=>{};shop.portrait=()=>{};
  globalThis.document={activeElement:null};
  for(let n=0;n<5;n++){
    assert.equal(shop.open(),true);assert.equal(s.input.enabled,false);assert.equal(s.movimentoBloqueado,true);
    shop.onKey({type:'keyup',code:'KeyE',stopImmediatePropagation(){}});assert.equal(s.upgradeMenuOpen,true);
    shop.close();assert.equal(s.input.enabled,true);assert.equal(s.input.keyboard.enabled,true);assert.equal(s.movimentoBloqueado,undefined);
  }
  assert.equal(s.events.listenerCount('upgradeResult'),1);assert.equal(s.events.listenerCount('upgradesChanged'),1);
  shop.root.remove=()=>{};globalThis.window={removeEventListener(){}};shop.destroy();
  assert.equal(s.events.listenerCount('upgradeResult'),0);delete globalThis.document;delete globalThis.window;
});

test('sprite NPC tem células 64px válidas e interface prevê rolagem e telas menores', () => {
  const png=readFileSync(new URL('../../assets/PERSONAGENS/NPC/NPC.png',import.meta.url));
  assert.equal(png.readUInt32BE(16),1152);assert.equal(png.readUInt32BE(20),3968);
  assert.ok(UPGRADE_NPC.frame<18*62);
  const css=readFileSync(new URL('../../style.css',import.meta.url),'utf8');
  assert.match(css,/max-width:650px/);assert.match(css,/overflow:auto/);assert.match(css,/touch-action:pan-y/);
});

test('aura real da Nyx amplifica dez pulsos e encerra sem ultrapassar a vida máxima', () => {
  const s=scene('nyx');s.player.body=null;s.player.x=s.player.y=0;s.vida=10;s.vidaMaxima=100;
  grant(s).characters.nyx={weapon:3,special:3,processor:3};
  const graphic=()=>{const g={active:true,destroy(){this.active=false;}};
    for(const k of ['clear','fillStyle','fillRect','fillCircle','lineStyle','strokeCircle','setDepth'])g[k]=()=>g;return g;};
  s.add.graphics=graphic; s.inimigos=[];
  criarSistemaEspeciais(s);s.events.emit('player:especial');
  assert.equal(s.estadoEspecial.proximoUso,15200);
  s.time.now=1200;atualizarSistemaEspeciais(s);
  for(let i=1;i<=10;i++){s.time.now=1200+i*1000;atualizarSistemaEspeciais(s);}
  assert.ok(Math.abs(s.vida-69)<1e-9,'dez pulsos de 5,9 PV');
  const hp=s.vida;s.time.now=14000;atualizarSistemaEspeciais(s);assert.equal(s.vida,hp);
  assert.equal(s.estadoEspecial.curasNyx.size,0);s.events.emit('shutdown');
});

test('onda real do Magnus aplica dano ampliado ao boss uma única vez', () => {
  const s=scene('magnus-force');grant(s).characters['magnus-force']={special:3};
  const graphic=()=>{const g={active:true,destroy(){this.active=false;}};
    for(const k of ['clear','lineStyle','strokeCircle','setDepth'])g[k]=()=>g;return g;};
  s.add.graphics=graphic;s.inimigos=[];
  Phaser.Geom={Rectangle:class { constructor(x,y,width,height){Object.assign(this,{x,y,width,height});} }};
  const boss=s.novoBoss={active:true,vida:1000,x:s.player.x,y:s.player.y,
    hitboxDano:{left:s.player.x-10,right:s.player.x+10,top:s.player.y-10,bottom:s.player.y+10},
    receberDano(amount){this.vida-=amount;return true;}};
  criarSistemaEspeciais(s);s.events.emit('player:especial');
  assert.equal(s.estadoEspecial.onda.damageMultiplier,1.15);
  s.time.now=330;atualizarSistemaEspeciais(s);assert.equal(boss.vida,897);
  s.time.now=350;atualizarSistemaEspeciais(s);assert.equal(boss.vida,897);
  s.events.emit('shutdown');
});

test('movimento real aplica atuadores sem acumular velocidade a cada quadro', async () => {
  const {atualizarMovimento}=await import('../controls/PlayerMovement.js');
  const s=scene();grant(s).characters['kai-mercer']={motor:3};
  s.teclasWASD={direita:{isDown:true}};
  s.player.anims={play(){},timeScale:1};
  for(let i=0;i<5;i++)atualizarMovimento(s);
  assert.ok(Math.abs(s.player.velocity.x-218)<1e-9);assert.equal(s.speed,200);
  s.movimentoBloqueado=true;atualizarMovimento(s);assert.deepEqual(s.player.velocity,{x:0,y:0});
});

test('normalização e entrada de rede usam vida máxima comprada no host, nunca maxHealth do cliente', async () => {
  Phaser.Events={EventEmitter};
  const {default:Manager}=await import('../multiplayer/multiplayerManager.js');
  const manager=Object.create(Manager.prototype);
  manager.room={upgradeEconomy:createEconomy()};
  const a=playerAccount(manager.room.upgradeEconomy,'p','magnus-force');a.characters['magnus-force'].health=3;
  const normalized=manager.normalizePlayer({id:'p',character:'magnus-force',health:130,maxHealth:9999});
  assert.equal(normalized.maxHealth,115*1.15);assert.equal(normalized.health,130);
  const stranger=manager.normalizePlayer({id:'q',character:'magnus-force',health:130,maxHealth:9999});
  assert.equal(stranger.maxHealth,115);assert.equal(stranger.health,115);
});

test('saldo e instalação do cliente são confirmados pelo host através das ações existentes', () => {
  const host=scene(),client=scene('nyx');
  for(const [s,id,isHost] of [[host,'host',true],[client,'client',false]]){
    s.multiplayer=true;s.multiplayerManager={playerId:id,room:{}};
    s.coopRuntime={host:isHost,manager:s.multiplayerManager,players:{remotes:new Map()}};
    s.scrapSystem=new ScrapSystem(s);
  }
  const guest=soloContext(host,{coopRemotePlayerId:'client',personagemSelecionada:'nyx',player:client.player,vida:95},true);
  host.coopRuntime.players.remotes.set('client',{context:guest});
  host.multiplayerManager.sendCoopAction=(kind,payload,options={})=>{
    client.scrapSystem.receive({kind,payload:structuredClone(payload),authority:options.authority,playerId:'host'});return true;
  };
  client.multiplayerManager.sendCoopAction=(kind,payload)=>{
    host.scrapSystem.receive({kind,payload:structuredClone(payload),playerId:'client'});return true;
  };
  const economy=economyFor(host);
  economy.drops.component={id:'component',x:UPGRADE_NPC.x,y:UPGRADE_NPC.y,mapKey:'Level1',quantity:10};economy.revision++;
  host.scrapSystem.changed();client.scrapSystem.update();
  assert.equal(accountFor(client).scrap,10);assert.equal(accountFor(host).scrap,0);
  assert.equal(client.scrapSystem.requestPurchase('weapon',0),true);
  assert.equal(accountFor(client).scrap,0);assert.equal(modifiersFor(guest).healing,.06);
  assert.equal(modifiersFor(client).healing,.06);
  host.scrapSystem.destroy();client.scrapSystem.destroy();
});
