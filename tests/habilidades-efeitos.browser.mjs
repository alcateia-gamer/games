/** Phaser/WebGL real: efeitos, parry, impacto e cura. Use servidor HTTP na raiz. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { novoBossConfig } from '../js/enemies/novoBoss/NovoBossConfig.js';
import { abrirSessaoNovoBoss } from './novo-boss-browser-helpers.mjs';
const config = {...novoBossConfig,cenaEntrada:{...novoBossConfig.cenaEntrada,ativo:false},
  ataques:{...novoBossConfig.ataques,automatico:false},geradores:{...novoBossConfig.geradores,ativo:false},
  fase2:{...novoBossConfig.fase2,ativo:false},teleporte:{...novoBossConfig.teleporte,preventivoMs:600000}};
const sessao=await abrirSessaoNovoBoss(config);
const {page}=sessao;
await mkdir('/tmp/habilidades-efeitos',{recursive:true});
try {
  for (const [personagem,nome] of [['kai-mercer','kai'],['magnus-force','magnus'],['nyx','nyx']]) {
    if (nome!=='kai') await sessao.reiniciar({personagem});
    const resultado=await page.evaluate(async nome=>{
      const s=window.__game.scene.getScene('Level1Parte2');
      const {atualizarSistemaEspeciais}=await import('/js/combat/PlayerSpecialAbilities.js');
      const {atualizarHitboxDanoPlayer}=await import('/js/player/Player.js');
      let alvo=null;
      if(nome==='magnus') {
        const {criarInimigoTeste}=await import('/js/enemies/EnemyTest.js');
        alvo=criarInimigoTeste(s,{x:s.player.x+60,y:s.player.y});
      }
      if(alvo) {
        alvo.setPosition(s.player.x+60,s.player.y);alvo.body.reset(alvo.x,alvo.y);
        alvo.hitboxDano.setTo(alvo.x-10,alvo.y-10,20,20);
        alvo.vida=alvo.vidaMaxima;
      }
      const vidaRobo=alvo?.vida;
      const stamina=s.estamina;
      s.player.body.updateFromGameObject();
      const fisicaAntes={x:s.player.body.x,y:s.player.body.y,w:s.player.body.width,h:s.player.body.height};
      const c=s.cameras.main;c.stopFollow();c.setZoom(1.3);c.centerOn(s.player.x,s.player.y);
      s.player.body.setVelocity(0,0);s.vida=10;
      s.botaoEspecial.emit('pointerdown');
      const inicio=s.time.now;
      const estado=s.estadoEspecial;
      const efeito=nome==='kai'?estado.parryEfeito:nome==='magnus'?estado.impactoMagnus:estado.auraNyx?.efeito;
      if (!efeito) throw Error(`Efeito ${nome} não foi carregado/ativado`);
      const fases=[];
      let impacto=null;
      let animacaoMs=0;
      for(const t of [100,250,400]) {
        if(nome==='magnus') while(animacaoMs<t) {
          const delta=Math.min(20,t-animacaoMs);animacaoMs+=delta;
          s.player.anims.update(inicio+animacaoMs,delta);
        }
        s.time.now=inicio+t;atualizarSistemaEspeciais(s,20);
        fases.push({frame:efeito.sprite.frame.name,escala:efeito.sprite.scaleX,
          x:efeito.sprite.x,y:efeito.sprite.y});
        if(alvo&&t===100&&alvo.vida!==vidaRobo) throw Error('Dano antes do impacto do GIF.');
        if(alvo&&t===400) impacto={dano:vidaRobo-alvo.vida,velocidade:Math.hypot(alvo.body.velocity.x,alvo.body.velocity.y),
          stun:alvo.especialAtordoadoAte-s.time.now,empurrao:alvo.especialEmpurraoAte-s.time.now};
      }
      if(alvo) {
        const {atualizarIAInimigo}=await import('/js/enemies/EnemyAI.js');
        atualizarIAInimigo(s,inicio+570,alvo);
        impacto.preservouImpulso=Math.hypot(alvo.body.velocity.x,alvo.body.velocity.y)>0;
        atualizarIAInimigo(s,inicio+581,alvo);
        impacto.parouDuranteStun=Math.hypot(alvo.body.velocity.x,alvo.body.velocity.y)===0;
      }
      const parry=nome==='kai'?s.time.now<estado.parryAte:null;
      if(nome==='nyx') {
        s.time.now=inicio+500;atualizarSistemaEspeciais(s,20);
        s.player.x+=30;s.player.y+=10;atualizarHitboxDanoPlayer(s);atualizarSistemaEspeciais(s,20);
      }
      const offset=s.hitboxDanoPlayer.bottom-s.player.y;
      s.player.body.updateFromGameObject();
      const fisicaDepois={x:s.player.body.x,y:s.player.body.y,w:s.player.body.width,h:s.player.body.height};
      s.children.depthSort();
      return {fases,parry,vida:s.vida,frame:efeito.sprite.frame.name,
        textura:efeito.sprite.texture.key,player:{x:s.player.x,y:s.player.y},
        efeito:{x:efeito.sprite.x,y:efeito.sprite.y},cooldown:estado.proximoUso-inicio,
        tamanho:{w:efeito.sprite.displayWidth,h:efeito.sprite.displayHeight},
        impacto,offset,staminaAntes:stamina,staminaDepois:s.estamina,fisicaAntes,fisicaDepois,
        animacao:s.player.anims.currentAnim?.key,texturaPlayer:s.player.texture.key,
        depth:efeito.sprite.depth,playerDepth:s.player.depth};
    },nome);
    assert.equal(resultado.textura,`especial-${nome}`);
    assert.ok(new Set(resultado.fases.map(f=>f.frame)).size>1,'O GIF deve avançar quadros.');
    assert.ok(resultado.depth<resultado.playerDepth,'Efeito no chão fica sob o personagem.');
    if(nome==='kai') {assert.equal(resultado.parry,true);assert.equal(resultado.cooldown,8000);
      assert.ok(resultado.fases[0].escala<resultado.fases[2].escala);}
    if(nome==='magnus') {
      assert.deepEqual(resultado.impacto,{dano:90,velocidade:200,stun:1200,empurrao:180,
        preservouImpulso:true,parouDuranteStun:true});
      assert.equal(resultado.texturaPlayer,'magnus-especial-marreta');
      assert.ok(resultado.animacao.startsWith('attack-marreta-'));
      assert.equal(resultado.staminaAntes,resultado.staminaDepois);
      assert.deepEqual(resultado.fisicaAntes,resultado.fisicaDepois);
    }
    if(nome==='nyx') {assert.equal(resultado.vida,10);assert.equal(resultado.cooldown,20000);
      assert.equal(resultado.efeito.x,resultado.player.x);
      assert.equal(resultado.efeito.y,resultado.player.y+resultado.offset);}
    await page.waitForTimeout(120);
    await page.screenshot({path:`/tmp/habilidades-efeitos/${nome}.png`});
    if(nome==='magnus') {
      const fim=await page.evaluate(()=>{
        const s=window.__game.scene.getScene('Level1Parte2');
        for(let i=0;i<8;i++)s.player.anims.update(s.time.now+i*20,20);
        return {atacando:s.atacando,textura:s.player.texture.key};
      });
      assert.deepEqual(fim,{atacando:false,textura:'personagem2-walk'});
    }
    if(nome==='nyx') {
      const visualCura=await page.evaluate(async()=>{
        const s=window.__game.scene.getScene('Level1Parte2');
        const {atualizarSistemaEspeciais}=await import('/js/combat/PlayerSpecialAbilities.js');
        const aura=s.estadoEspecial.auraNyx,inicio=aura.inicio,frames=[];
        const aliado=s.add.sprite(s.player.x+50,s.player.y,'walk',18).setDepth(s.player.depth);
        aliado.vida=40;aliado.vidaMaxima=100;s.aliados=[aliado];
        const sprite=aura.efeito.sprite;
        for(const t of [700,1000,1199]) {
          s.time.now=inicio+t;atualizarSistemaEspeciais(s);
          frames.push(sprite.frame.name);
        }
        s.time.now=inicio+1200;atualizarSistemaEspeciais(s);
        const desapareceu=!sprite.active&&s.estadoEspecial.auraNyx===null;
        const cura=s.estadoEspecial.curasNyx.values().next().value;
        const visuais=[...cura.visuais.values()];
        if(visuais.length!==2 || visuais.some(v=>!v.animacao)) throw Error('Nyx e aliado precisam usar o GIF Heal.');
        const efeito=cura.visuais.get(aliado);
        s.time.now=inicio+1450;atualizarSistemaEspeciais(s);const primeiro=efeito.grafico.frame.name;
        s.time.now=inicio+1750;atualizarSistemaEspeciais(s);const segundo=efeito.grafico.frame.name;
        const antes={x:efeito.grafico.x,y:efeito.grafico.y};
        aliado.x+=35;aliado.y+=10;s.events.emit('postupdate');
        window.__nyxCuraTeste={inicio,aliado,visuais};
        return {frames,desapareceu,particulas:visuais.length,quadrosCura:[primeiro,segundo],
          texturaCura:efeito.grafico.texture.key,
          acompanhou:efeito.grafico.x-antes.x===35&&efeito.grafico.y-antes.y===10};
      });
      assert.deepEqual(visualCura,{frames:[7,10,11],desapareceu:true,particulas:2,
        quadrosCura:[2,5],texturaCura:'especial-nyx-cura',acompanhou:true});
      await page.waitForTimeout(120);
      await page.screenshot({path:'/tmp/habilidades-efeitos/nyx-cura.png'});
      const cura=await page.evaluate(async()=>{
        const s=window.__game.scene.getScene('Level1Parte2');
        const {atualizarSistemaEspeciais}=await import('/js/combat/PlayerSpecialAbilities.js');
        const {inicio,aliado,visuais}=window.__nyxCuraTeste;
        s.player.x+=500;
        for(let i=1;i<=10;i++) {
          s.time.now=inicio+1200+i*1000;atualizarSistemaEspeciais(s);
          atualizarSistemaEspeciais(s);
        }
        const resultado={vida:s.vida,aliado:aliado.vida,curas:s.estadoEspecial.curasNyx.size,
          efeitosLimpos:visuais.every(v=>!v.grafico.active)};
        aliado.destroy();s.aliados=[];return resultado;
      });
      assert.deepEqual(cura,{vida:60,aliado:90,curas:0,efeitosLimpos:true});
    }
    console.log(`PASS ${nome}:`,JSON.stringify(resultado));
  }
  // Protocolo real com transporte em memória: nenhum pacote vai a um broker público.
  await page.evaluate(async()=>{
    const {default:Manager}=await import('/js/multiplayer/multiplayerManager.js');
    const peers=[];
    class MQTT extends Phaser.Events.EventEmitter {
      constructor(id){super();this.clientId=id;peers.push(this);}
      connect(){} subscribe(){} unsubscribe(){}
      publish(topic,data){for(const peer of peers)peer.emit('message',topic,structuredClone(data));}
    }
    const host=window.__auraHost=new Manager(new MQTT('nyx-host'));
    const aliado=new Manager(new MQTT('kai-aliado'));
    host.roomTopic=aliado.roomTopic='room/TEST';
    host.room={roomCode:'TEST',hostId:host.playerId,status:'PLAYING',players:[
      host.normalizePlayer({id:host.playerId,character:'nyx',x:-1093,y:-5520}),
      host.normalizePlayer({id:aliado.playerId,character:'kai-mercer',x:-1093,y:-5520})],enemies:[]};
    host.publishState();window.__game.registry.set('multiplayer',aliado);
    // Este trecho cobre o fallback legado; o runtime atual é validado em
    // multiplayer-atualizacao.browser.mjs com dois navegadores e broker real.
    window.__salaAuraLegada = aliado.room;
    aliado.room = null;
  });
  await sessao.reiniciar({personagem:'kai-mercer',multiplayer:true});
  const coop=await page.evaluate(async()=>{
    const s=window.__game.scene.getScene('Level1Parte2');
    const {atualizarSistemaEspeciais}=await import('/js/combat/PlayerSpecialAbilities.js');
    const host=window.__auraHost;
    s.multiplayerManager.room = window.__salaAuraLegada;
    host.publishAction({type:'nyx_aura',playerId:host.playerId,id:'browser-nyx',mapKey:'Level1Parte2'});
    const aura=s.estadoEspecial.aurasRemotas.get(host.playerId),inicio=s.time.now;
    if(!aura?.efeito)throw Error('Aura remota não foi criada com o asset real.');
    s.vida=10;s.time.now=inicio+1000;atualizarSistemaEspeciais(s);
    const visual={x:aura.efeito.sprite.x,y:aura.efeito.sprite.y,textura:aura.efeito.sprite.texture.key};
    s.time.now=inicio+1200;atualizarSistemaEspeciais(s);
    const particulas=s.estadoEspecial.curasNyx.values().next().value.visuais.size;
    const gifs=[...s.estadoEspecial.curasNyx.values().next().value.visuais.values()]
      .every(v=>v.grafico.texture.key==='especial-nyx-cura');
    s.time.now=inicio+2200;atualizarSistemaEspeciais(s);
    const dentro=s.vida;
    host.publishState();atualizarSistemaEspeciais(s);const duplicado=s.vida;
    s.player.x+=250;s.time.now=inicio+3200;atualizarSistemaEspeciais(s);const fora=s.vida;
    host.publishAction({type:'nyx_aura',playerId:host.playerId,id:'browser-nyx',stop:true});
    s.time.now=inicio+4200;atualizarSistemaEspeciais(s);
    return {dentro,duplicado,fora,depois:s.vida,auras:s.estadoEspecial.aurasRemotas.size,visual,particulas,gifs};
  });
  assert.equal(coop.dentro,15);assert.equal(coop.duplicado,15);assert.equal(coop.fora,20);
  assert.equal(coop.depois,25);assert.equal(coop.auras,0);assert.equal(coop.visual.textura,'especial-nyx');
  assert.equal(coop.particulas,2,'Cura deve aparecer no jogador local e na Nyx remota.');
  assert.equal(coop.gifs,true,'Ambos os beneficiários precisam usar a animação Heal.');
  console.log('PASS: Nyx remota anima uma vez e concede cura persistente ao aliado selecionado.');
  assert.deepEqual(sessao.errors,[]);assert.deepEqual(sessao.consoleErrors,[]);
  console.log('PASS: efeitos carregados sem erros JavaScript/console.');
} finally {await sessao.fechar();}
