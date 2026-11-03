/** Regressões visuais e físicas dos seis ajustes de combate, no Phaser real. */
import assert from 'node:assert/strict';
import { novoBossConfig } from '../js/enemies/novoBoss/NovoBossConfig.js';
import { abrirSessaoNovoBoss } from './novo-boss-browser-helpers.mjs';
const limite = Number(process.env.BOSS_ETAPA ?? 6);
const config = { ...novoBossConfig, ataques: { ...novoBossConfig.ataques, automatico: false } };
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar } = sessao;
try {
  const alinhamento = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2'), b = s.novoBoss;
    if (!b.iniciarIlusoes()) throw Error('As quatro aparições devem iniciar.');
    return [b.sprite, ...b.alvosIlusorios.map(a => a.sprite)].map(o => ({ x: o.x, y: o.y }));
  });
  assert.equal(alinhamento.length, 4);
  assert.ok(alinhamento.filter(p => [-1400,-1080,-760].includes(p.x) && p.y !== -6020).every(p => p.y === -5810));
  console.log('PASS 1: aparições laterais alinhadas ao centro no mapa real.');
  if (limite >= 2) {
    await sessao.reiniciar();
    const colisao = await page.evaluate(async () => {
      const s = window.__game.scene.getScene('Level1Parte2'), b = s.novoBoss;
      const o = s.children.getByName('novo-boss-barreira-colisao');
      if (!o?.body?.isCircle || !o.body.enable) throw Error('Escudo circular inativo.');
      const { atualizarHitboxDanoPlayer } = await import('/js/player/Player.js');
      const resultados = [];
      for (const a of [0, Math.PI/2, Math.PI, -Math.PI/2, Math.PI/4]) {
        // Coloca a base física a 90px do centro: há interseção com raio95.
        const x=o.x+Math.cos(a)*120, y=o.y+Math.sin(a)*120;
        s.player.setPosition(x,y-18.5); s.player.body.reset(x,y-18.5);
        s.player.body.updateFromGameObject(); s.player.body.setVelocity(-Math.cos(a)*300,-Math.sin(a)*300);
        s.player.body.preUpdate(true, 0.1);
        const antes = Math.hypot(s.player.body.center.x-o.x,s.player.body.center.y-o.y);
        const tocou = s.physics.world.collide(s.player,o);
        atualizarHitboxDanoPlayer(s);
        resultados.push({tocou,antes,depois:Math.hypot(s.player.body.center.x-o.x,s.player.body.center.y-o.y)});
      }
      b.teleporte={}; b.sistemaGeradores.atualizar(0);
      const escondido=!o.body.enable;
      b.teleporte=null; b.sistemaGeradores.atualizar(0);
      const retornou=o.body.enable;
      for(const g of b.geradores){
        s.player.setPosition(g.x,g.y-60);s.player.body.reset(g.x,g.y-60);s.player.body.updateFromGameObject();
        if(!b.sistemaGeradores.interagir(g.id)) throw Error('Interação de gerador falhou.');
      }
      return {resultados,escondido,retornou,desligado:!o.body.enable,raio:o.body.radius};
    });
    assert.equal(colisao.raio,95); assert.ok(colisao.escondido&&colisao.retornou&&colisao.desligado);
    assert.ok(colisao.resultados.every(r=>r.tocou && r.depois>r.antes), JSON.stringify(colisao));
    console.log('PASS 2: colisão circular separa o jogador em cinco direções; desliga no teleporte e após quatro geradores.');
  }
  if (limite >= 3) {
    const estado = await page.evaluate(() => {
      const s=window.__game.scene.getScene('Level1Parte2'), b=s.novoBoss;
      b.cancelarAtaque(); b.estado='vulneravel'; b.invulneravelClonesAte=b.relogioCombate+2000;
      if(!b.iniciarClones()) throw Error('Clones não iniciaram.');
      b.apresentacao.atualizar(0);b.sistemaIlusoes.atualizar(0);
      return {grafico:b.apresentacao.snapshot().graficoVisivel, core:b.sistemaIlusoes.core?.visible??false};
    });
    assert.equal(estado.grafico,false);assert.equal(estado.core,false);
    console.log('PASS 3: vulnerabilidade/proteção e núcleo não marcam a verdadeira durante clones móveis.');
  }
  if (limite >= 4) {
    for(const [tipo,chave,tempo] of [
      ['chuva','novo-boss-heavens-fury',1400], ['lasers','novo-boss-disparo-energia',1000],
      ['pulso','novo-boss-explosao',1580],['tentaculos','novo-boss-tentaculo',1100],
    ]) {
      await posicionar(-1093,-5520);
      const iniciou=await page.evaluate(tipo=>{
        const b=window.__game.scene.getScene('Level1Parte2').novoBoss;
        b.cancelarAtaque();b.teleportePendente=null;
        return b.executarAtaque(tipo);
      },tipo);
      assert.ok(iniciou, tipo);
      await avancar(tempo);
      const visuais=await page.evaluate(chave=>{
        const s=window.__game.scene.getScene('Level1Parte2');
        return s.children.list.filter(o=>o.active&&o.visible&&o.texture?.key===chave).map(o=>({
          falso:!!o.novoBossAtaqueIlusorio,alpha:o.alpha,tint:o.tintTopLeft,depth:o.depth,
          frame:o.frame.name,corpo:!!o.body,
        }));
      },chave);
      const real=visuais.find(v=>!v.falso),falsos=visuais.filter(v=>v.falso);
      assert.ok(real&&falsos.length>0,JSON.stringify({tipo,visuais}));
      for(const falso of falsos){
        assert.equal(falso.alpha,real.alpha,tipo);assert.equal(falso.tint,real.tint,tipo);
        assert.equal(falso.depth,real.depth,tipo);assert.equal(falso.corpo,false,tipo);
      }
    }
    console.log('PASS 4: quatro efeitos reais/falsos com cores, alfa e camadas iguais; cópias sem corpos ofensivos.');
  }
  if(limite>=5){
    const antes=await page.evaluate(async()=>{
      const s=window.__game.scene.getScene('Level1Parte2'),b=s.novoBoss;
      const {sincronizarCorpoNovoBoss}=await import('/js/enemies/novoBoss/NovoBossTeleporte.js');
      b.cancelarAtaque();b.sistemaClones.cancelar();b.teleporte=null;b.teleportePendente=null;
      sincronizarCorpoNovoBoss(b,b.config.posicaoInicial);
      Object.assign(b,{fase:2,estado:'preparando',tempoEstado:500,vida:400,
        inicioFase2Em:b.relogioCombate,ultimoTeleporteEm:b.relogioCombate,
        transicaoFase2Pendente:false,proximaOndaClonesEm:Infinity});
      if(!b.iniciarClones())throw Error('Onda não iniciou.');
      b.inicioOndaClonesEm=b.relogioCombate-500;
      return [b.sprite,...b.sistemaClones.alvos.map(a=>a.sprite)].map(o=>({x:o.x,y:o.y}));
    });
    await avancar(100);
    const depois=await page.evaluate(()=>{
      const b=window.__game.scene.getScene('Level1Parte2').novoBoss;
      return [b.sprite,...b.sistemaClones.alvos.map(a=>a.sprite)].map(o=>({x:o.x,y:o.y,alpha:o.alpha}));
    });
    assert.equal(depois.length,10);
    for(const [i,o] of depois.entries()){
      const distancia=Math.hypot(o.x-antes[i].x,o.y-antes[i].y);
      assert.ok(distancia>24&&distancia<=25.001,JSON.stringify({i,distancia}));assert.equal(o.alpha,1);
    }
    console.log('PASS 5: verdadeira e nove clones caminham 25px em 100ms na fase 2.');
  }
  if(limite>=6){
    await sessao.reiniciar();await posicionar(-1200,-5650);
    const armadilha=await page.evaluate(()=>{
      const b=window.__game.scene.getScene('Level1Parte2').novoBoss;
      if(!b.executarAtaque('tentaculos'))throw Error('Tentáculos não iniciaram.');
      return b.ataqueAtual.snapshot().armadilhas[0];
    });
    await posicionar(armadilha.x+12,armadilha.y-20);await avancar(999);
    const ler=()=>page.evaluate(()=>{
      const s=window.__game.scene.getScene('Level1Parte2'),b=s.novoBoss;
      const v=s.children.list.find(o=>o.active&&o.novoBossTentaculoVisual&&o.novoBossTentaculoSegurando);
      return {player:{x:s.player.x,y:s.player.y,footX:s.hitboxDanoPlayer.centerX,footY:s.hitboxDanoPlayer.bottom},
        vida:s.vida,preso:!!s.restricaoControleNovoBoss,
        tentaculo:v?{x:v.x,y:v.y,originY:v.originY}:null,
        bases:s.children.list.filter(o=>o.active&&o.visible&&o.novoBossTentaculoBase).length,
        avisos:s.children.list.filter(o=>o.active&&o.name==='novo-boss-aviso').length};
    });
    const antes=await ler();assert.equal(antes.preso,false);
    await avancar(1);const capturado=await ler();assert.ok(capturado.preso);
    assert.equal(capturado.tentaculo.x,armadilha.x);assert.equal(capturado.tentaculo.y,armadilha.y);
    await avancar(180);const puxado=await ler();
    assert.equal(puxado.player.footX,armadilha.x);assert.equal(puxado.player.footY,armadilha.y);
    assert.equal(puxado.tentaculo.y,armadilha.y);assert.equal(puxado.vida,antes.vida);
    assert.equal(puxado.avisos,0);assert.ok(puxado.bases>=2);
    await page.evaluate(()=>{
      const s=window.__game.scene.getScene('Level1Parte2');
      s.cameras.main.stopFollow().setZoom(2.5).centerOn(s.player.x,s.player.y-20);
      window.__quadroRevisao=window.__game.loop.frame;
    });
    await page.waitForFunction(()=>window.__game.loop.frame>window.__quadroRevisao+2);
    await page.screenshot({path:'/tmp/boss-seis-ajustes/tentaculo-no-chao.png'});
    await page.evaluate(()=>{
      const s=window.__game.scene.getScene('Level1Parte2');
      for(let i=0;i<8;i++){
        const p={id:99,isDown:true,leftButtonDown:()=>true};
        s.input.emit('pointerdown',p,[]);s.input.emit('pointerup',p);
      }
    });
    await avancar(2320);assert.equal((await ler()).preso,false);
    console.log('PASS 6: tentáculo fixo, jogador puxado até os pés, aviso removido, abertura no chão e soltura sem dano.');
  }
  assert.deepEqual(sessao.errors,[]); assert.deepEqual(sessao.assetErrors,[]);
} finally { await sessao.fechar(); }
