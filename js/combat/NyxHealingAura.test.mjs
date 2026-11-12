import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { criarSistemaEspeciais, atualizarSistemaEspeciais } from './PlayerSpecialAbilities.js';

globalThis.Phaser = { Scene:class {}, Events:{EventEmitter}, Scenes:{Events:{SHUTDOWN:'shutdown'}},
  Math:{Clamp:(v,a,b)=>Math.max(a,Math.min(b,v))} };
const {default:Manager} = await import('../multiplayer/multiplayerManager.js');
const {CoopRuntime} = await import('../multiplayer/CoopRuntime.js');
import { carregarSomAuraNyx, tocarSomAuraNyx } from '../sounds/SOUNDS_PERSONAGENS.js/sounds_Nyx,.js';
import { existsSync } from 'node:fs';

function audio(s,duracao=8) {
  const plays=[],sons=[];
  s.cache={...s.cache,audio:{exists:()=>true}};
  s.sound={add(key) {
    const som={isPlaying:false,totalDuration:duracao,
      play(config){this.isPlaying=true;plays.push({key,...config});return true;},
      stop(){this.isPlaying=false;},destroy(){this.destruido=true;}};
    sons.push(som);return som;
  }};
  return {plays,sons};
}

test('invocação termina no GIF e inicia um segundo loop a 15% pelos dez segundos de cura',()=>{
  const arquivos=[];
  carregarSomAuraNyx({audio(key,path){
    arquivos.push([key,path]);
    assert.ok(existsSync(new URL(`../../assets/${path}`,import.meta.url)));
  }});
  assert.deepEqual(arquivos,[
    ['nyx-aura-invocacao','sounds.mp3/SONS PARA BOTAR AINDA/AURA.mp3'],
    ['nyx-aura-cura','sounds.mp3/SONS PARA BOTAR AINDA/AURA_NYX.mp3'],
  ]);
  const s=scene('nyx'),a=audio(s);
  criarSistemaEspeciais(s);
  s.events.emit('player:especial');
  s.events.emit('player:especial');
  assert.deepEqual(a.plays,[{key:'nyx-aura-invocacao',volume:0.35,loop:true,rate:1,detune:0,seek:0}]);
  s.time.now=1199;atualizarSistemaEspeciais(s);
  assert.equal(a.sons.at(-1).isPlaying,true);
  for(const tempo of [1200,2200,3200]){s.time.now=tempo;atualizarSistemaEspeciais(s);}
  assert.equal(a.sons.at(-1).isPlaying,true,'a cura continua depois da invocação');
  assert.equal(a.plays.length,2,'a segunda etapa inicia uma vez; os pulsos não reiniciam o áudio');
  assert.equal(a.plays[1].key,'nyx-aura-cura');
  assert.equal(a.sons[0].destruido,true,'a invocação para antes do loop de cura');
  assert.equal(a.plays[1].loop,true);
  assert.equal(a.plays[1].rate,1);
  assert.equal(a.plays[1].volume,0.15);
  s.time.now=11199;atualizarSistemaEspeciais(s);
  assert.equal(a.sons.at(-1).isPlaying,true);
  s.time.now=11200;atualizarSistemaEspeciais(s);
  assert.equal(a.sons.at(-1).isPlaying,false,'fim da cura encerra o segundo loop');
  s.time.now=20000;s.events.emit('player:especial');
  assert.equal(a.plays.length,3);
  assert.equal(a.sons.length,3);
  s.events.emit('shutdown');
  assert.ok(a.sons.at(-1).destruido);
});

test('áudio atrasado acompanha a fase do loop e para no tempo restante da animação',()=>{
  const s=scene('kai-mercer'),a=audio(s,0.3);
  const parar=tocarSomAuraNyx(s,{id:'atrasado',duracaoMs:1200,idadeMs:500});
  assert.ok(Math.abs(a.plays[0].seek-0.2)<1e-9);
  assert.equal(a.plays[0].loop,true);
  s.time.now=699;s.events.emit('preupdate');
  assert.equal(a.sons.at(-1).isPlaying,true);
  s.time.now=700;s.events.emit('preupdate');
  assert.equal(a.sons.at(-1).isPlaying,false,'o loop encerra mesmo sem receber o pacote de parada');
  parar();assert.equal(a.sons.at(-1).isPlaying,false);
  tocarSomAuraNyx(s,{id:'antigo',duracaoMs:1200,idadeMs:1200});
  assert.equal(a.plays.length,1);
  s.events.emit('shutdown');
});

test('cancelar a aura antes do fim do GIF interrompe seu áudio',()=>{
  const s=scene('nyx'),a=audio(s);
  criarSistemaEspeciais(s);s.events.emit('player:especial');
  assert.equal(a.sons.at(-1).isPlaying,true);
  s.vida=0;s.events.emit('preupdate');
  assert.equal(a.sons.at(-1).isPlaying,false);
  s.events.emit('shutdown');
});

test('cura iniciada em quadro atrasado alinha o áudio e limpeza encerra o loop',()=>{
  const s=scene('nyx'),a=audio(s);
  criarSistemaEspeciais(s);s.events.emit('player:especial');
  s.time.now=3200;atualizarSistemaEspeciais(s);
  assert.equal(a.plays.length,2);
  assert.equal(a.plays[1].seek,2,'a fase de cura começou aos 1200ms');
  s.limparSistemaEspeciais();
  assert.equal(a.sons.at(-1).isPlaying,false);
  s.events.emit('shutdown');
});

test('morte do último beneficiário encerra o segundo loop sem esperar dez segundos',()=>{
  const s=scene('nyx'),a=audio(s);
  criarSistemaEspeciais(s);s.events.emit('player:especial');
  s.time.now=1200;atualizarSistemaEspeciais(s);
  assert.equal(a.sons.at(-1).isPlaying,true);
  s.vida=0;s.events.emit('preupdate');
  assert.equal(a.sons.at(-1).isPlaying,false);
  assert.equal(s.estadoEspecial.curasNyx.size,0);
  s.events.emit('shutdown');
});
function graphic() {
  return {active:true, clear(){return this;},fillStyle(){return this;},fillRect(){return this;},fillCircle(){return this;},
    lineStyle(){return this;},strokeCircle(){return this;},setDepth(){return this;},destroy(){this.active=false;}};
}
function scene(character, manager=null) {
  return {personagemSelecionada:character, multiplayer:Boolean(manager),multiplayerManager:manager,
    sys:{settings:{key:'Level1'}},time:{now:0},events:new EventEmitter(),vida:20,vidaMaxima:100,
    player:{active:true,x:0,y:0,depth:10},add:{graphics:graphic},tweens:{killTweensOf(){}},
    inimigos:[]};
}
function rede() {
  const peers=[];
  class MQTT extends EventEmitter {
    constructor(id){super();this.clientId=id;peers.push(this);}
    connect(){} subscribe(){} unsubscribe(){}
    publish(topic,data){for(const peer of peers)peer.emit('message',topic,structuredClone(data));}
  }
  const nyx=new Manager(new MQTT('nyx-id')),kai=new Manager(new MQTT('kai-id'));
  for(const manager of [nyx,kai])manager.roomTopic='room/TEST';
  nyx.room={roomCode:'TEST',hostId:'nyx-id',status:'PLAYING',players:[
    nyx.normalizePlayer({id:'nyx-id',character:'nyx',x:0,y:0}),
    nyx.normalizePlayer({id:'kai-id',character:'kai-mercer',x:0,y:0})]};
  nyx.publishState();
  return {nyx,kai};
}

for (const nyxNoHost of [true,false]) {
  test(`CoopRuntime: equipe ouve uma ativação confirmada da Nyx ${nyxNoHost?'host':'cliente'}`,()=>{
    const {nyx:hostManager,kai:clienteManager}=rede();
    const host=scene(nyxNoHost?'nyx':'kai-mercer',hostManager);
    const cliente=scene(nyxNoHost?'kai-mercer':'nyx',clienteManager);
    const somHost=audio(host),somCliente=audio(cliente);
    const runtime=(s,manager,ehHost)=>Object.assign(Object.create(CoopRuntime.prototype),{
      scene:s,manager,host:ehHost,mapKey:'Level1',players:{remotes:new Map()},
      localContext:s,world:{receive(){}},
    });
    const h=runtime(host,hostManager,true),c=runtime(cliente,clienteManager,false);
    host.coopRuntime=h;host.isMultiplayerHost=true;
    cliente.coopRuntime=c;cliente.isMultiplayerHost=false;
    hostManager.on('coopAction',action=>h.receiveAction(action));
    clienteManager.on('coopAction',action=>c.receiveAction(action));
    // O host simula os especiais remotos usando o contexto do jogador cliente.
    const remoto=scene(cliente.personagemSelecionada,hostManager);
    remoto.multiplayer=false;remoto.coopRuntime=h;remoto.coopRemotePlayerId=clienteManager.playerId;
    remoto.cache=host.cache;remoto.sound=host.sound;
    h.players.remotes.set(clienteManager.playerId,{context:remoto});
    for(const s of [host,cliente,remoto])criarSistemaEspeciais(s);
    const fonte=nyxNoHost?host:cliente;
    fonte.events.emit('player:especial');
    assert.equal(somHost.plays.length,1);
    assert.equal(somCliente.plays.length,1);
    assert.equal(somHost.plays[0].volume,0.35);
    assert.equal(somCliente.plays[0].volume,0.35);
    assert.equal(somHost.plays[0].loop,true);
    assert.equal(somCliente.plays[0].loop,true);
    fonte.events.emit('player:especial');
    assert.equal(somHost.plays.length,1,'pedido na recarga não emite som');
    assert.equal(somCliente.plays.length,1);
    const simulacao=nyxNoHost?host:remoto;
    simulacao.time.now=1199;atualizarSistemaEspeciais(simulacao);
    assert.equal(somHost.sons.at(-1).isPlaying,true);
    assert.equal(somCliente.sons.at(-1).isPlaying,true);
    simulacao.time.now=1200;atualizarSistemaEspeciais(simulacao);
    assert.equal(somHost.plays.length,2);
    assert.equal(somCliente.plays.length,2);
    for(const audio of [somHost,somCliente]) {
      assert.equal(audio.plays[0].key,'nyx-aura-invocacao');
      assert.equal(audio.plays[1].key,'nyx-aura-cura');
      assert.equal(audio.plays[1].volume,0.15);
    }
    assert.equal(somHost.sons.at(-1).isPlaying,true);
    assert.equal(somCliente.sons.at(-1).isPlaying,true,'parar a invocação não interrompe o loop de cura');
    simulacao.time.now=11199;atualizarSistemaEspeciais(simulacao);
    assert.equal(somCliente.sons.at(-1).isPlaying,true);
    simulacao.time.now=11200;atualizarSistemaEspeciais(simulacao);
    assert.equal(somHost.sons.at(-1).isPlaying,false);
    assert.equal(somCliente.sons.at(-1).isPlaying,false,'fim da cura encerra o áudio da equipe');
    // O protocolo rejeita mensagens sem autoridade; outro mapa não deve ouvir.
    h.receiveAction({kind:'nyxAuraSound',playerId:clienteManager.playerId,payload:{mapKey:'Level1'}});
    c.receiveAction({kind:'nyxAuraSound',authority:true,payload:{mapKey:'Level1Parte2'}});
    assert.equal(somHost.plays.length,2);
    assert.equal(somCliente.plays.length,2);
    for(const s of [host,cliente,remoto])s.events.emit('shutdown');
  });
}

test('a aura acompanha a posição final da física no mesmo quadro sem adiantar a cura',()=>{
  const s=scene('nyx');
  s.textures={exists:()=>true};
  s.cache={json:{get:()=>({duracoesMs:[1200]})}};
  s.hitboxDanoPlayer={bottom:26};
  s.add.image=()=>({scaleX:1,active:true,
    setOrigin(){return this;},setScale(){return this;},setDepth(){return this;},setFrame(){return this;},
    setPosition(x,y){this.x=x;this.y=y;return this;},destroy(){this.active=false;}});
  criarSistemaEspeciais(s);s.events.emit('player:especial');
  s.time.now=100;atualizarSistemaEspeciais(s);
  s.player.x=40;s.player.y=30;s.events.emit('postupdate');
  assert.equal(s.estadoEspecial.auraNyx.efeito.sprite.x,40);
  assert.equal(s.estadoEspecial.auraNyx.efeito.sprite.y,56);
  assert.equal(s.vida,20);
  assert.equal(s.estadoEspecial.curasNyx.size,0);
  s.limparSistemaEspeciais();
});

test('Nyx seleciona ao fim do GIF e concede dez pulsos, mesmo após os aliados saírem',()=>{
  const s=scene('nyx');
  const aliado={active:true,x:100,y:0,vida:40,vidaMaxima:200};
  const fora={...aliado,x:221};
  const morto={...aliado,vida:0};
  const foraVertical={...aliado,x:0,y:37};
  s.aliados=[aliado,fora,morto,foraVertical];
  criarSistemaEspeciais(s);s.events.emit('player:especial');
  s.time.now=1000;atualizarSistemaEspeciais(s);
  assert.equal(s.vida,20);assert.equal(aliado.vida,40);
  s.time.now=1200;atualizarSistemaEspeciais(s);
  assert.equal(s.estadoEspecial.auraNyx,null,'O GIF desaparece após uma reprodução.');
  assert.equal(s.estadoEspecial.curasNyx.size,1);
  s.player.x=1000;aliado.x=2000;fora.x=1000;
  for(let i=1;i<=10;i++) {
    s.time.now=1200+i*1000;atualizarSistemaEspeciais(s);
    atualizarSistemaEspeciais(s);
  }
  assert.equal(s.vida,70);assert.equal(aliado.vida,140);
  assert.equal(fora.vida,40);assert.equal(morto.vida,0);
  assert.equal(foraVertical.vida,40,'A cura respeita a elipse do GIF, sem círculo invisível.');
  assert.equal(s.estadoEspecial.curasNyx.size,0);
  s.limparSistemaEspeciais();assert.equal(s.events.listenerCount('preupdate'),0);
});

test('quem saiu antes do fim não recebe; cura limita HP e não ressuscita',()=>{
  const s=scene('nyx'),aliado={active:true,x:0,y:0,vida:40,vidaMaxima:100};
  s.aliados=[aliado];criarSistemaEspeciais(s);s.events.emit('player:especial');
  aliado.x=200;s.time.now=1200;atualizarSistemaEspeciais(s);
  s.vida=99;s.time.now=2200;atualizarSistemaEspeciais(s);
  assert.equal(s.vida,100);assert.equal(aliado.vida,40);
  s.vida=0;s.time.now=3200;atualizarSistemaEspeciais(s);
  assert.equal(s.vida,0);assert.equal(s.estadoEspecial.curasNyx.size,0);
  s.limparSistemaEspeciais();
});

test('cooperativo real: host sincroniza aura; cada cliente cura só seu HP e ignora duplicatas',()=>{
  const original=Date.now;let now=100000;Date.now=()=>now;
  try {
    const {nyx,kai}=rede();
    const n=scene('nyx',nyx),k=scene('kai-mercer',kai);
    const somNyx=audio(n),somKai=audio(k);
    criarSistemaEspeciais(n);criarSistemaEspeciais(k);
    n.events.emit('player:especial');
    assert.equal(somNyx.plays.length,1);
    assert.equal(somKai.plays.length,1);
    assert.equal(k.estadoEspecial.aurasRemotas.size,1);
    assert.equal(kai.room.players[0].nyxAura.startedAt,now);
    now+=1200;n.time.now=k.time.now=1200;
    atualizarSistemaEspeciais(n);atualizarSistemaEspeciais(k);
    k.player.x=221;
    now+=1000;n.time.now=k.time.now=2200;
    atualizarSistemaEspeciais(n);atualizarSistemaEspeciais(k);
    assert.equal(n.vida,25);assert.equal(k.vida,25);
    nyx.publishState();atualizarSistemaEspeciais(k);assert.equal(k.vida,25);
    assert.equal(somKai.plays.length,2,'heartbeat não repete nenhuma das duas etapas');
    now+=1000;n.time.now=k.time.now=3200;
    atualizarSistemaEspeciais(n);atualizarSistemaEspeciais(k);
    assert.equal(n.vida,30);assert.equal(k.vida,30);
    // O efeito concedido permanece mesmo após Nyx e aliado mudarem de posição.
    nyx.sendPlayerState(500,0,'right');k.player.x=500;
    now+=1000;n.time.now=k.time.now=4200;atualizarSistemaEspeciais(k);
    assert.equal(k.vida,35);
    k.events.emit('player:especial');assert.equal(k.estadoEspecial.parryAte,0);
    // Depois da concessão, sair da sala não retira a cura já recebida pelo aliado.
    n.vida=0;n.events.emit('preupdate');
    nyx.mqtt.publish('room/TEST/presence',{type:'leave_room',playerId:nyx.playerId});
    assert.equal(k.estadoEspecial.aurasRemotas.size,0);
    k.time.now=5200;atualizarSistemaEspeciais(k);assert.equal(k.vida,40);
    n.limparSistemaEspeciais();k.limparSistemaEspeciais();
    assert.equal(nyx.listenerCount('roomUpdated'),0);assert.equal(kai.listenerCount('roomUpdated'),0);
  } finally {Date.now=original;}
});

test('host recusa aura de outro personagem, repetição na recarga e mapa inválido; aceita cliente Nyx',()=>{
  const {nyx:host,kai:cliente}=rede();
  host.room.players[0].character='kai-mercer';host.room.players[1].character='nyx';host.publishState();
  host.receiveAction({type:'nyx_aura',playerId:host.playerId,id:'ilegal',mapKey:'Level1'});
  assert.equal(host.room.players[0].nyxAura,null);
  cliente.publishAction({type:'nyx_aura',playerId:cliente.playerId,id:'mapa',mapKey:'outro'});
  assert.equal(host.room.players[1].nyxAura,null);
  cliente.publishAction({type:'nyx_aura',playerId:cliente.playerId,id:'certo',mapKey:'Level1'});
  assert.equal(host.room.players[1].nyxAura.id,'certo');
  cliente.publishAction({type:'nyx_aura',playerId:cliente.playerId,id:'duplicado',mapKey:'Level1'});
  assert.equal(host.room.players[1].nyxAura.id,'certo');
  const k=scene('kai-mercer',host);k.sys.settings.key='Level1Parte2';criarSistemaEspeciais(k);
  assert.equal(k.estadoEspecial.aurasRemotas.size,0);k.limparSistemaEspeciais();
});

test('cancelar antes da seleção e receber pacote antigo não concedem cura',()=>{
  const {nyx,kai}=rede(),n=scene('nyx',nyx),k=scene('kai-mercer',kai);
  criarSistemaEspeciais(n);criarSistemaEspeciais(k);n.events.emit('player:especial');
  n.vida=0;n.events.emit('preupdate');
  k.time.now=2200;atualizarSistemaEspeciais(k);
  assert.equal(k.vida,20);assert.equal(k.estadoEspecial.curasNyx.size,0);
  n.limparSistemaEspeciais();k.limparSistemaEspeciais();
  nyx.room.players[0].nyxAura={id:'pacote-antigo',mapKey:'Level1',startedAt:Date.now()-5000};
  nyx.publishState();const atrasado=scene('kai-mercer',kai);criarSistemaEspeciais(atrasado);
  atrasado.time.now=2200;atualizarSistemaEspeciais(atrasado);
  assert.equal(atrasado.vida,20);assert.equal(atrasado.estadoEspecial.curasNyx.size,0);
  atrasado.limparSistemaEspeciais();
});

test('partículas existem só nos beneficiários e são limpas na morte e ao sair da cena',()=>{
  const s=scene('nyx'),aliado={active:true,x:50,y:0,vida:40,vidaMaxima:100};
  s.aliados=[aliado];criarSistemaEspeciais(s);s.events.emit('player:especial');
  assert.equal(s.estadoEspecial.curasNyx.size,0);
  s.time.now=1200;atualizarSistemaEspeciais(s);
  const cura=s.estadoEspecial.curasNyx.values().next().value;
  assert.equal(cura.visuais.size,2);
  const pessoal=cura.visuais.get(s.player).grafico,outro=cura.visuais.get(aliado).grafico;
  s.vida=0;s.events.emit('preupdate');
  assert.equal(pessoal.active,false);assert.equal(outro.active,true);
  s.limparSistemaEspeciais();assert.equal(outro.active,false);
  assert.equal(s.events.listenerCount('postupdate'),0);
});
