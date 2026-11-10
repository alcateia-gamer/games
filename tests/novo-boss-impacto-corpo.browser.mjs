/** Impactos no fim do aviso e corpo persistente, com geometria/dano reais do Phaser. */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { novoBossConfig } from '../js/enemies/novoBoss/NovoBossConfig.js';
import { abrirSessaoNovoBoss } from './novo-boss-browser-helpers.mjs';

const config = { ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
  ataques: { ...novoBossConfig.ataques, automatico: false,
    chuvaRaios: { ...novoBossConfig.ataques.chuvaRaios, quantidade: 1 } },
  teleporte: { ...novoBossConfig.teleporte, preventivoMs: 600000 },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, posicionar } = sessao;
const ler = () => page.evaluate(() => {
  const s=window.__game.scene.getScene('Level1Parte2'),b=s.novoBoss;
  return {vida:s.vida,ataque:b.ataqueAtual?.snapshot()??null,morto:b.morto,
    corpo:{visible:b.sprite.visible,alpha:b.sprite.alpha,fisica:b.body.enable,chave:b.sprite.texture.key}};
});
async function avancar(ms) {
  await page.evaluate(async ms=>{
    const s=window.__game.scene.getScene('Level1Parte2');
    const {atualizarBoss}=await import('/js/enemies/BossPrincipal.js');
    for(let restante=ms;restante>0;){
      const d=Math.min(20,restante);
      s.time.preUpdate();s.time.update(s.time.now+d,d);
      atualizarBoss(s,s.time.now,d);restante-=d;
    }
    s.children.depthSort();
  },ms);
}
async function iniciar(tipo) {
  await posicionar(-1250,-5700);
  return page.evaluate(tipo=>{
    const s=window.__game.scene.getScene('Level1Parte2'),b=s.novoBoss;
    b.cancelarAtaque();b.teleportePendente=null;
    if(!b.executarAtaque(tipo)||!b.ataqueAtual)throw Error('Ataque deve iniciar sem viagem: '+tipo);
    const a=b.ataqueAtual.snapshot();
    return tipo==='pulso'
      ? {x:a.origem.x,y:a.origem.y,raio:b.config.ataques.pulsoRepulsao.raio,zero:a.impactoEm,
        duracao:b.ataqueAtual.duracao,dano:b.config.ataques.pulsoRepulsao.dano}
      : {x:a.marcas[0].x,y:a.marcas[0].y,raio:a.raio,zero:a.marcas[0].impactoEm,
        duracao:b.ataqueAtual.duracao,dano:b.config.ataques.chuvaRaios.dano};
  },tipo);
}
try {
  for(const tipo of ['pulso','chuva']) {
    // A hitbox é 30×46: inclui um pixel da borda direita do círculo.
    let a=await iniciar(tipo),vida=(await ler()).vida;
    await posicionar(a.x+a.raio+14,a.y-3);
    await avancar(a.zero-1);assert.equal((await ler()).vida,vida);
    await avancar(1);assert.equal((await ler()).vida,vida-a.dano);
    await posicionar(a.x+a.raio+40,a.y-3);await avancar(1);
    assert.equal((await ler()).vida,vida-a.dano,'Sair na animação não desfaz o impacto.');
    await avancar(a.duracao-a.zero+600);

    // Esquiva até o último milissegundo; voltar depois não produz dano tardio.
    a=await iniciar(tipo);vida=(await ler()).vida;
    await posicionar(a.x+a.raio-10,a.y-3);await avancar(a.zero-1);
    await posicionar(a.x+a.raio+40,a.y-3);await avancar(1);
    assert.equal((await ler()).vida,vida);
    await posicionar(a.x,a.y-3);await avancar(50);
    assert.equal((await ler()).vida,vida,'Entrar depois do zero é apenas atravessar a cauda visual.');
    await avancar(a.duracao-a.zero+600);

    // Os cantos do quadrado envolvente não pertencem ao círculo anunciado.
    a=await iniciar(tipo);vida=(await ler()).vida;
    await posicionar(a.x+a.raio*.98,a.y+a.raio*.98-3);
    await avancar(a.zero);assert.equal((await ler()).vida,vida);
    await avancar(a.duracao-a.zero+600);
    console.log(`PASS ${tipo}: acerto na borda real no zero; saída após impacto, esquiva no último ms e cantos sem falsos positivos.`);
  }
  assert.ok((await ler()).vida>0,'Todos os cenários devem manter o jogador vivo, sem curar.');
  assert.ok(await page.evaluate(()=>window.__game.scene.getScene('Level1Parte2').novoBoss.receberDano(1000)));
  let s=await ler();assert.ok(s.morto);assert.equal(s.corpo.chave,'novo-boss-morte');
  await avancar(60000);s=await ler();
  assert.deepEqual(s.corpo,{visible:true,alpha:1,fisica:false,chave:'novo-boss-morte'});
  assert.equal(s.ataque,null);
  await posicionar(-1093,-5350);await avancar(20);
  await posicionar(-1093,-5520);await avancar(20);
  s=await ler();assert.ok(s.morto&&s.corpo.visible&&!s.corpo.fisica);
  await page.evaluate(()=>{
    const s=window.__game.scene.getScene('Level1Parte2');
    window.__corpoAntesReinicio=s.novoBoss.sprite;
    s.cameras.main.stopFollow().setZoom(2).centerOn(s.novoBoss.x,s.novoBoss.y);
    window.__frameCorpo=window.__game.loop.frame;
  });
  await page.waitForFunction(()=>window.__game.loop.frame>window.__frameCorpo+2);
  await mkdir('/tmp/boss-corpo-impactos',{recursive:true});
  await page.screenshot({path:'/tmp/boss-corpo-impactos/corpo-apos-60s.png'});
  await sessao.reiniciar();
  assert.equal(await page.evaluate(()=>window.__corpoAntesReinicio.active),false);
  assert.equal((await ler()).morto,false);
  console.log('PASS corpo: pose opaca após 60 s, sem física/ataques, saída/reentrada sem ressuscitar; reinício limpa o corpo antigo.');
  assert.deepEqual(sessao.errors,[]);assert.deepEqual(sessao.assetErrors,[]);
  assert.deepEqual(sessao.consoleErrors,[]);
} finally {await sessao.fechar();}
