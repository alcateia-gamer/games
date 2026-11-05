/** Colisão e repulsão do domo com corpos e IA reais no Phaser. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { abrirSessaoNovoBoss } from './novo-boss-browser-helpers.mjs';
import { novoBossConfig } from '../js/enemies/novoBoss/NovoBossConfig.js';
const config={...novoBossConfig,cenaEntrada:{...novoBossConfig.cenaEntrada,ativo:false},
  ataques:{...novoBossConfig.ataques,automatico:false},geradores:{...novoBossConfig.geradores,ativo:false},
  fase2:{...novoBossConfig.fase2,ativo:false},teleporte:{...novoBossConfig.teleporte,preventivoMs:600000}};
const sessao=await abrirSessaoNovoBoss(config);
try {
  const resultado=await sessao.page.evaluate(async()=>{
    const s=window.__game.scene.getScene('Level1Parte2');
    const {atualizarSistemaEspeciais}=await import('/js/combat/PlayerSpecialAbilities.js');
    const {criarInimigoTeste}=await import('/js/enemies/EnemyTest.js');
    const {criarRoboBola}=await import('/js/enemies/RoboBola.js');
    const {atualizarIAInimigo}=await import('/js/enemies/EnemyAI.js');
    s.events.emit('player:especial');
    const inicio=s.time.now;
    s.time.now=inicio+400;atualizarSistemaEspeciais(s);
    const domo=s.estadoEspecial.parryColisao.corpo;
    const centro={x:domo.center.x,y:domo.center.y};
    function colocar(robo,x,y) {
      robo.body.updateFromGameObject();
      robo.body.reset(robo.x+x-robo.body.center.x,robo.y+y-robo.body.center.y);
      robo.body.updateFromGameObject();
    }
    function distanciaLivre(robo) {
      const b=robo.body;
      const x=Math.max(b.left,Math.min(b.right,domo.center.x));
      const y=Math.max(b.top,Math.min(b.bottom,domo.center.y));
      return Math.hypot(x-domo.center.x,y-domo.center.y)-domo.radius;
    }
    const casos=[];
    for(const [tipo,dx,dy,dentro=false] of [['padrao',1,0],['serra',-1,0],['padrao',0,1],['serra',0,-1],
      ['bola',1,0],['padrao',1,0,true]]) {
      const robo=tipo==='bola'?criarRoboBola(s):criarInimigoTeste(s,{x:s.player.x+300,y:s.player.y,tipoRobo:tipo});
      if(!robo)throw Error('Não foi possível criar o robô real para o teste.');
      const vidaAntes=robo.vida;
      colocar(robo,centro.x+dx*(dentro?0:domo.radius+45),centro.y+dy*(dentro?0:domo.radius+45));
      let contato=false,impulso=0,menor=Infinity;
      for(let quadro=0;quadro<70;quadro++) {
        s.time.now+=1000/60;
        s.events.emit('preupdate',s.time.now,1000/60);
        atualizarSistemaEspeciais(s,1000/60);
        if(s.time.now<(robo.especialAtordoadoAte||0)) atualizarIAInimigo(s,s.time.now,robo);
        else robo.setVelocity(-dx*130,-dy*130);
        s.physics.world.update(s.time.now,1000/60);s.events.emit('postupdate',s.time.now,1000/60);
        menor=Math.min(menor,distanciaLivre(robo));
        if(robo.especialEmpurraoAte>s.time.now) {
          contato=true;
          impulso=Math.max(impulso,dentro?Math.hypot(robo.body.velocity.x,robo.body.velocity.y)
            :robo.body.velocity.x*dx+robo.body.velocity.y*dy);
        }
      }
      casos.push({tipo,dx,dy,dentro,contato,impulso,menor,vida:robo.vida,vidaAntes});
      robo.destroy();
      for(const campo of ['fundoVida','barraVida','bordaVida','debugHitboxDano']) robo[campo]?.destroy();
      // Mantém a duração isolada por caso, sem depender da velocidade do navegador.
      s.time.now=inicio+400;
    }
    // O corpo acompanha o jogador, sem empurrá-lo nem bloquear o próprio movimento.
    const antes={x:domo.center.x,y:domo.center.y};
    s.player.body.reset(s.player.x+25,s.player.y+15);s.player.body.updateFromGameObject();
    s.events.emit('preupdate');atualizarSistemaEspeciais(s);
    const seguiu={dx:domo.center.x-antes.x,dy:domo.center.y-antes.y};
    let atraso=0;
    const inicioWalk={x:s.player.x,y:s.player.y};
    s.player.anims.play('walk-right',true);
    s.player.setVelocity(70,35);
    for(let i=0;i<45;i++) {
      s.time.now+=1000/60;s.events.emit('preupdate',s.time.now,1000/60);
      atualizarSistemaEspeciais(s,1000/60);
      s.physics.world.update(s.time.now,1000/60);s.events.emit('postupdate',s.time.now,1000/60);
      s.player.anims.update(s.time.now,1000/60);
      const e=s.estadoEspecial.parryEfeito.sprite;
      atraso=Math.max(atraso,Math.abs(e.x-s.player.x),Math.abs(e.y-s.player.y-26),
        Math.abs(domo.center.x-e.x),Math.abs(domo.center.y-e.y));
    }
    const caminhada=Math.hypot(s.player.x-inicioWalk.x,s.player.y-inicioWalk.y);
    s.player.setVelocity(0,0);
    const radius=domo.radius;
    s.cameras.main.stopFollow();s.cameras.main.setZoom(1.3).centerOn(s.player.x,s.player.y);
    s.children.depthSort();
    return {casos,seguiu,radius,atraso,caminhada};
  });
  console.log(JSON.stringify(resultado,null,2));
  for(const caso of resultado.casos) {
    assert.equal(caso.contato,true);assert.ok(caso.impulso>200);
    assert.ok(caso.menor>-.1,`Inimigo entrou no domo: ${JSON.stringify(caso)}`);
    assert.equal(caso.vida,caso.vidaAntes);
  }
  assert.deepEqual(resultado.seguiu,{dx:25,dy:15});
  assert.ok(resultado.caminhada>20);assert.ok(resultado.atraso<.001,'Área e colisão precisam seguir o walk no mesmo quadro.');
  assert.deepEqual(sessao.errors,[]);assert.deepEqual(sessao.consoleErrors,[]);
  await mkdir('/tmp/kai-domo-colisao',{recursive:true});
  await sessao.page.waitForTimeout(100);
  await sessao.page.screenshot({path:'/tmp/kai-domo-colisao/verificacao.png'});
  assert.equal(await sessao.page.evaluate(async()=>{
    const s=window.__game.scene.getScene('Level1Parte2');
    const {atualizarSistemaEspeciais}=await import('/js/combat/PlayerSpecialAbilities.js');
    s.time.now=s.estadoEspecial.parryAte;s.events.emit('preupdate');atualizarSistemaEspeciais(s);
    return s.estadoEspecial.parryColisao===null;
  }),true);
  console.log('PASS: colisão em quatro direções, repulsão sem dano, novos robôs, acompanhamento e expiração.');
} finally {await sessao.fechar();}
