/** Regressão integrada: recarga, portais, dispersão, raios, espiral e cadáver. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { novoBossConfig } from '../js/enemies/novoBoss/NovoBossConfig.js';
import { abrirSessaoNovoBoss } from './novo-boss-browser-helpers.mjs';
const pasta = process.env.ARTIFACT_DIR ?? '/tmp/boss-revisao-combate';
mkdirSync(pasta, { recursive: true });
const sessao = await abrirSessaoNovoBoss({ ...novoBossConfig,
  cenaEntrada: { ...novoBossConfig.cenaEntrada, ativo: false },
  ataques: { ...novoBossConfig.ataques, ativo: true, automatico: false },
});
const { page, avancar } = sessao;
const relatorio = {};
async function previa(nome) {
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    s.cameras.main.stopFollow().setZoom(.72).centerOn(-1080, -5769);
    s.children.depthSort();
  });
  await page.waitForTimeout(80);
  await page.screenshot({ path: `${pasta}/${nome}.png` });
}
try {
  await avancar(5500);
  relatorio.portais = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    return s.children.list.filter(o => /^novo-boss-portal-[12]$/.test(o.name))
      .map(o => ({ x: o.x, y: o.y, alpha: o.alpha, depth: o.depth, escala: o.scaleX, flip: o.flipX }));
  });
  assert.equal(relatorio.portais.length, 2);
  assert.ok(relatorio.portais.every(p => p.y === -5806 && p.alpha === 1 && p.depth > 50 && p.escala === .42));
  assert.ok(relatorio.portais[0].x === -1577 && relatorio.portais[1].x === -567);
  relatorio.saidaPortal = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('Level1Parte2');
    const { atualizarRoboBola } = await import('/js/enemies/RoboBola.js');
    const { atualizarDepthAtores } = await import('/js/map/ProfundidadeMapa.js');
    const r = s.inimigos.find(r => r.prologoEncontroId === s.novoBoss.prologo.id && !r.morto);
    const portal = s.children.list.find(o => o.name === `novo-boss-portal-${r.prologoPortal+1}`);
    const origem = { x:r.x,y:r.y }, passos = [];
    for(let i=0;i<4;i++) {
      s.time.now += 100; atualizarRoboBola(s,s.time.now,100);
      s.physics.world.bodies.forEach(b=>{if(b.enable)b.preUpdate(false,.1);});
      s.physics.world.step(.1);s.physics.world.postUpdate();
      atualizarDepthAtores(s);
      passos.push({x:r.x,y:r.y,depth:r.depth,alpha:r.alpha});
    }
    return {origem,portal:{x:portal.x,y:portal.y,depth:portal.depth},passos};
  });
  assert.deepEqual(relatorio.saidaPortal.origem,{x:relatorio.saidaPortal.portal.x,y:relatorio.saidaPortal.portal.y});
  assert.ok(relatorio.saidaPortal.passos.every(p=>p.depth>relatorio.saidaPortal.portal.depth));
  assert.ok(relatorio.saidaPortal.passos.every(p=>Math.abs(p.x-relatorio.saidaPortal.origem.x)<=49));
  assert.ok(relatorio.saidaPortal.passos.at(-1).alpha>0);
  await previa('01-portais');
  relatorio.recarga = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('Level1Parte2'), e = s.novoBoss;
    const { atualizarBoss } = await import('/js/enemies/BossPrincipal.js');
    const { causarDanoInimigo } = await import('/js/enemies/EnemyHealth.js');
    s.developerMode = true;
    window.__avancarBossRevisao = ms => {
      for (let restante = ms; restante > 0;) {
        const dt = Math.min(20, restante); restante -= dt; s.time.now += dt;
        atualizarBoss(s, s.time.now, dt);
      }
    };
    window.__geometriaDuranteOndas = [];
    window.__concluirOndaRevisao = () => {
      for (let t = 0; t < 30000 && e.prologo.estado !== 'GERADORES_EXPOSTOS'; t += 100) {
        for (const r of s.inimigos.filter(r => r.prologoEncontroId === e.prologo.id && !r.morto)) {
          r.prologoProtegidoAte = 0; causarDanoInimigo(s, r, r.vida + 1);
        }
        window.__avancarBossRevisao(100);
        if(e.prologo.estado==='ONDA_ROBOS') {
          const restos=s.children.list.filter(o=>o.active && (
            o.name==='novo-boss-raios-torres' || o.name==='novo-boss-prologo-direcoes' ||
            (o.name==='novo-boss-aviso' && o.commandBuffer?.length>0)));
          window.__geometriaDuranteOndas.push(...restos.map(o=>o.name));
        }
      }
      if (e.prologo.estado !== 'GERADORES_EXPOSTOS') throw Error(JSON.stringify(e.prologo.snapshot()));
    };
    window.__concluirOndaRevisao();
    e.geradores.find(g => !g.morto).receberDano(1000);
    window.__avancarBossRevisao(1800);
    if (!e.receberDano(1, null, {})) throw Error('Primeiro golpe recusado');
    window.__avancarBossRevisao(180);
    if (!e.receberDano(1, null, {})) throw Error('Segundo golpe recusado');
    window.__avancarBossRevisao(600);
    const torres = e.geradores.filter(g => !g.morto).map(g => {
      const frame = g.visual.frame.name, vida = g.vida;
      const acerto = g.receberDano(10000);
      return { estado: g.estadoGerador, pose: g.estado, frame, depois: g.visual.frame.name,
        acerto, vidaAntes: vida, vidaDepois: g.vida, morto: g.morto, active: g.active };
    });
    return { estado: e.prologo.estado, torres };
  });
  assert.equal(relatorio.recarga.estado, 'ESCUDO_RECARREGANDO');
  assert.ok(relatorio.recarga.torres.every(t => t.estado === 'emergindo' && t.pose === 'summon' &&
    t.frame > 0 && t.frame === t.depois && t.acerto && t.vidaDepois === 1 && !t.morto && t.active));
  await previa('02-subida-geradores');
  await avancar(1400);
  relatorio.feixes = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2'), e = s.novoBoss;
    const raios = s.children.list.filter(o => o.name === 'novo-boss-raios-torres' && o.active && o.visible);
    return { estado: e.prologo.estado, quantidade: raios.length,
      desenhados: raios.every(o => o.commandBuffer.length > 0) };
  });
  assert.equal(relatorio.feixes.estado, 'ESCUDO_RECARREGANDO');
  assert.equal(relatorio.feixes.quantidade, 1); assert.ok(relatorio.feixes.desenhados);
  await previa('02-recarga-feixes');
  await sessao.posicionar(-1080,-5810);
  await avancar(1200);
  relatorio.feixes.aoCompletar = await page.evaluate(() => {
    const s=window.__game.scene.getScene('Level1Parte2');
    return {estado:s.novoBoss.prologo.estado, restante:s.children.list.some(o=>o.name==='novo-boss-raios-torres'&&o.active)};
  });
  assert.equal(relatorio.feixes.aoCompletar.estado,'ESCUDO_RECARREGANDO');
  assert.equal(relatorio.feixes.aoCompletar.restante,false);
  await sessao.posicionar(-1093,-5520);
  await page.evaluate(async () => {
    const s = window.__game.scene.getScene('Level1Parte2'), e = s.novoBoss;
    window.__avancarBossRevisao(1500);
    if (s.children.list.some(o => o.name === 'novo-boss-raios-torres' && o.active)) throw Error('Feixes sobraram na onda');
    for (let ciclo = 2; ciclo <= 4; ciclo++) {
      window.__concluirOndaRevisao();
      e.geradores.find(g => !g.morto).receberDano(1000);
      window.__avancarBossRevisao(1800);
      if (ciclo < 4) {
        e.receberDano(1, null, {}); window.__avancarBossRevisao(180);
        e.receberDano(1, null, {}); window.__avancarBossRevisao(3000);
      }
    }
    if (e.prologo.bloqueiaCombatePrincipal) throw Error('Prólogo não terminou');
    const { atualizarBoss } = await import('/js/enemies/BossPrincipal.js');
    const { sincronizarCorpoNovoBoss } = await import('/js/enemies/novoBoss/NovoBossTeleporte.js');
    e.config = { ...e.config, ataques: { ...e.config.ataques, ativo:false, automatico:false } };
    e.estado='preparando';e.tempoEstado=0;e.teleportePendente=null;
    e.ultimoTeleportePontasEm=e.relogioCombate-9000;
    atualizarBoss(s,s.time.now,0);
    window.__teleportePontas = { motivo:e.teleporte?.motivo,destino:e.teleporte?.destino };
    window.__avancarBossRevisao(600);
    window.__teleportePontas.chegada={x:e.x,y:e.y};
    sincronizarCorpoNovoBoss(e,e.config.posicaoInicial);
    e.estado='preparando';e.tempoEstado=0;e.teleportePendente=null;
    e.config = { ...e.config, ataques: { ...e.config.ataques, ativo: true, automatico: true, sequencia: ['chuva'] } };
    e.rng = () => .37;
    e.receberDano(e.vida - 490);
    window.__avancarBossRevisao(20);
    window.__clonesNascimento = { x: e.x, y: e.y };
  });
  relatorio.geometriaDuranteOndas=await page.evaluate(()=>window.__geometriaDuranteOndas);
  assert.deepEqual(relatorio.geometriaDuranteOndas,[]);
  relatorio.teleportePontas=await page.evaluate(()=>window.__teleportePontas);
  assert.equal(relatorio.teleportePontas.motivo,'pontas-geradores');
  assert.equal(relatorio.teleportePontas.destino.regiao,'gerador');
  assert.ok(Math.hypot(relatorio.teleportePontas.destino.x-relatorio.teleportePontas.chegada.x,
    relatorio.teleportePontas.destino.y-relatorio.teleportePontas.chegada.y)<10);
  const maioresDeslocamentos = Array(10).fill(0);
  const percurso = { xMin:Infinity,xMax:-Infinity,yMin:Infinity,yMax:-Infinity };
  for (let passo = 0; passo < 30; passo++) {
    await avancar(100);
    const amostra = await page.evaluate(() => {
      const e = window.__game.scene.getScene('Level1Parte2').novoBoss, o = window.__clonesNascimento;
      return [e, ...e.sistemaClones.alvos].map(a => ({x:a.x,y:a.y,d:Math.hypot(a.x-o.x,a.y-o.y)}));
    });
    amostra.forEach((a,i)=>{
      maioresDeslocamentos[i]=Math.max(maioresDeslocamentos[i],a.d);
      percurso.xMin=Math.min(percurso.xMin,a.x);percurso.xMax=Math.max(percurso.xMax,a.x);
      percurso.yMin=Math.min(percurso.yMin,a.y);percurso.yMax=Math.max(percurso.yMax,a.y);
    });
  }
  relatorio.clones = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2'), e = s.novoBoss;
    const origem = window.__clonesNascimento;
    const corpos = [{ x: e.x, y: e.y }, ...e.sistemaClones.alvos.map(a => ({ x: a.x, y: a.y }))];
    return { ativo: e.sistemaClones.ativo, estado: e.estado, ataque: e.ataqueAtual?.tipo,
      corpos, deslocamentos: corpos.map(p => Math.hypot(p.x - origem.x, p.y - origem.y)),
      largura: Math.max(...corpos.map(p => p.x)) - Math.min(...corpos.map(p => p.x)),
      altura: Math.max(...corpos.map(p => p.y)) - Math.min(...corpos.map(p => p.y)) };
  });
  assert.ok(relatorio.clones.ativo);
  assert.equal(relatorio.clones.estado, 'preparando');
  relatorio.clones.percurso = percurso;
  assert.ok(percurso.xMax-percurso.xMin>650 && percurso.yMax-percurso.yMin>350);
  relatorio.clones.maioresDeslocamentos = maioresDeslocamentos;
  assert.ok(maioresDeslocamentos.every(d => d > 180));
  const real = relatorio.clones.corpos[0];
  relatorio.clones.proximos = relatorio.clones.corpos.slice(1).filter(a=>Math.hypot(a.x-real.x,a.y-real.y)<130).length;
  assert.ok(relatorio.clones.proximos>=2);
  await previa('03-clones-dispersos');
  await avancar(1200);
  relatorio.sincronia = await page.evaluate(() => {
    const e = window.__game.scene.getScene('Level1Parte2').novoBoss;
    const a = e.sprite.anims;
    return { ataque: e.ataqueAtual?.snapshot().padrao, frame: a.currentFrame.index,
      copias: e.sistemaClones.alvos.filter(a => a.active).map(c => ({
        frame: c.sprite.anims.currentFrame.index, alpha: c.sprite.alpha,
        visual: c.ataquesIlusorios.snapshot().somenteVisual,
        padrao: c.ataquesIlusorios.snapshot().execucao?.padrao })),
      geometria: window.__game.scene.getScene('Level1Parte2').children.list
        .filter(o => /novo-boss-(apresentacao|imitacao)/.test(o.name) && o.visible).map(o => o.name) };
  });
  assert.equal(relatorio.sincronia.ataque, 'perseguicao');
  assert.ok(relatorio.sincronia.copias.every(c => c.frame === relatorio.sincronia.frame && c.alpha === 1 && c.visual));
  assert.deepEqual(relatorio.sincronia.geometria, []);
  relatorio.aneis = await page.evaluate(() => {
    const e = window.__game.scene.getScene('Level1Parte2').novoBoss;
    e.cancelarAtaque();
    e.config = { ...e.config, ataques: { ...e.config.ataques, automatico: false } };
    e.executarAtaque('chuva');
    const dados = e.ataqueAtual.snapshot();
    return { ...dados, copias: e.sistemaClones.alvos.filter(a => a.active)
      .map(a => a.ataquesIlusorios.snapshot().execucao?.padrao) };
  });
  assert.equal(relatorio.aneis.padrao, 'aneis');
  assert.ok(relatorio.aneis.marcas.length > 15);
  assert.ok(relatorio.aneis.copias.every(p => p === 'aneis'));
  await avancar(1200);
  await previa('04-aneis-raios');
  relatorio.espiral = await page.evaluate(() => {
    const e = window.__game.scene.getScene('Level1Parte2').novoBoss;
    e.cancelarAtaque(); e.executarAtaque('lasers');
    // Resolve o posicionamento central respeitando o teleporte real.
    window.__avancarBossRevisao(600);
    const vidaAntes = e.vida;
    e.receberDano(20);
    const noAviso = vidaAntes - e.vida;
    window.__avancarBossRevisao(2800);
    const antesDisparo = e.vida; e.receberDano(20);
    const snapshot = e.ataqueAtual.snapshot();
    return { noAviso, noDisparo: antesDisparo - e.vida, snapshot,
      padroes: [...new Set(snapshot.projeteis.map(p => p.padrao))],
      copias: e.sistemaClones.alvos.filter(a => a.active).map(a => a.ataquesIlusorios.snapshot().execucao?.emitidos) };
  });
  assert.equal(relatorio.espiral.noAviso, 20);
  assert.equal(relatorio.espiral.noDisparo, 10);
  assert.ok(['espiral', 'circulo', 'diagonal', 'horizontal'].every(p => relatorio.espiral.padroes.includes(p)));
  assert.ok(relatorio.espiral.copias.every(n => n === relatorio.espiral.snapshot.emitidos));
  await previa('05-espiral-combinada');
  relatorio.cauda = await page.evaluate(() => {
    const e = window.__game.scene.getScene('Level1Parte2').novoBoss;
    const falta = 10700 - e.ataqueAtual.snapshot().decorrido;
    window.__avancarBossRevisao(falta);
    const antes = e.vida; e.receberDano(20);
    return { dano: antes - e.vida, disparando: e.ataqueAtual?.disparando ?? false };
  });
  assert.equal(relatorio.cauda.dano, 20); assert.equal(relatorio.cauda.disparando, false);
  relatorio.cadaver = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('Level1Parte2'), e = s.novoBoss;
    const { retanguloLivreDoMapa } = await import('/js/enemies/EnemyPathfinding.js');
    e.receberDano(10000);
    const c = e.colisaoCadaver, b = c?.body;
    if (!b) throw Error('Cadáver sem colisão');
    const atravessamentos = [];
    for (const sinal of [-1, 1]) {
      const p = s.player;
      p.body.reset(b.center.x + sinal * (b.width / 2 + 60), b.center.y - 3);
      p.body.updateFromGameObject();
      p.body.reset(p.x, p.y + b.center.y - p.body.center.y);
      p.body.updateFromGameObject();
      for (let i = 0; i < 120; i++) {
        p.setVelocity(-sinal * 200, 0);
        s.physics.world.bodies.forEach(body => { if (body.enable) body.preUpdate(false, 1/60); });
        s.physics.world.step(1/60); s.physics.world.postUpdate();
      }
      atravessamentos.push(sinal < 0 ? p.body.right <= b.x + .01 : p.body.x >= b.right - .01);
    }
    s.player.setVelocity(0, 0);
    return { morto: e.morto, alpha: e.sprite.alpha, sprite: e.sprite.texture.key,
      visible: e.sprite.visible, bloqueiaNavegacao: !retanguloLivreDoMapa(s, b), atravessamentos,
      corpo: { x: b.x, y: b.y, width: b.width, height: b.height },
      dentroGrupo: s.collisionGroup.contains(c) };
  });
  assert.ok(relatorio.cadaver.morto && relatorio.cadaver.visible && relatorio.cadaver.alpha === 1);
  assert.ok(relatorio.cadaver.bloqueiaNavegacao && relatorio.cadaver.dentroGrupo);
  assert.ok(Math.abs(relatorio.cadaver.corpo.width - 35.2) < .001);
  assert.ok(Math.abs(relatorio.cadaver.corpo.height - 15.4) < .001);
  assert.ok(relatorio.cadaver.atravessamentos.every(Boolean));
  await previa('06-cadaver-colisao');
  await page.evaluate(async () => {
    const s = window.__game.scene.getScene('Level1Parte2'), e = s.novoBoss;
    const c = e.colisaoCadaver;
    const { destruirBoss } = await import('/js/enemies/BossPrincipal.js');
    destruirBoss(s);
    if (c.active || s.collisionGroup.contains(c)) throw Error('Colisão residual após limpeza');
  });
  assert.deepEqual(sessao.errors, []); assert.deepEqual(sessao.assetErrors, []);
  writeFileSync(`${pasta}/relatorio.json`, JSON.stringify(relatorio, null, 2));
  console.log('PASS: quatro ciclos, feixes somente na recarga, portais nas coordenadas exatas, robôs acima da abertura, visita aos geradores, camuflagem em grupos, ataques sincronizados e colisão baixa do cadáver.');
} catch (error) {
  writeFileSync(`${pasta}/relatorio-parcial.json`, JSON.stringify(relatorio, null, 2));
  await previa('falha');
  throw error;
} finally { await sessao.fechar(); }
