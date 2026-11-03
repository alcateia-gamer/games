/** GIF transparente, surgimento local e fuga por entradas reais com física ativa. */
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {novoBossConfig} from '../js/enemies/novoBoss/NovoBossConfig.js';
import {abrirSessaoNovoBoss} from './novo-boss-browser-helpers.mjs';
const config={...novoBossConfig,geradores:{...novoBossConfig.geradores,ativo:false},
  fase2:{...novoBossConfig.fase2,ativo:false},ataques:{...novoBossConfig.ataques,automatico:false},
  teleporte:{...novoBossConfig.teleporte,preventivoMs:600000}};
const sessao=await abrirSessaoNovoBoss(config);
const {page,posicionar,avancar}=sessao;
const ler=()=>page.evaluate(()=>{
 const s=window.__game.scene.getScene('Level1Parte2'),b=s.novoBoss;
 return {captura:s.restricaoControleNovoBoss,ataque:b.ataqueAtual?.snapshot(),vida:s.vida,estamina:s.estamina,
  hud:b.hud.textoEstado.text,atacando:s.atacando,player:{x:s.player.x,y:s.player.y},
  tiros:s.armaPersonagemTeste?.lasers.length??s.projeteis?.getChildren?.().length??0};
});
async function clicarAtaque(){
 const p=await page.evaluate(()=>{const g=window.__game,r=g.canvas.getBoundingClientRect();return{x:r.left+720/g.scale.width*r.width,y:r.top+350/g.scale.height*r.height};});
 await page.mouse.click(p.x,p.y,{delay:30});
}
try{
 const atlas=await page.evaluate(()=>{
  const s=window.__game.scene.getScene('Level1Parte2'),t=s.textures.get('novo-boss-area-ataque');
  const imagem=t.getSourceImage(),canvas=document.createElement('canvas');canvas.width=imagem.width;canvas.height=imagem.height;
  const c=canvas.getContext('2d');c.drawImage(imagem,0,0);
  let opacos=0,fora=0;
  for(let i=0;i<109;i++){
   const x=i%16*221,y=Math.floor(i/16)*157;
   if(c.getImageData(x,y,1,1).data[3]!==0)fora++;
   if(c.getImageData(x+112,y+84,1,1).data[3]>0)opacos++;
  }
  return{fora,opacos,frames:t.frameTotal};
 });
 assert.equal(atlas.fora,0);assert.equal(atlas.opacos,109);
 for(const tipo of ['pulso','chuva','lasers','tentaculos']){
  const a=await page.evaluate(tipo=>{const b=window.__game.scene.getScene('Level1Parte2').novoBoss;
   b.cancelarAtaque();if(!b.executarAtaque(tipo))throw Error('Falhou '+tipo);return b.ataqueAtual.snapshot();},tipo);
  const avisos=await page.evaluate(()=>window.__game.scene.getScene('Level1Parte2').children.list.filter(o=>o.active&&o.texture?.key==='novo-boss-area-ataque').map(o=>({frame:o.frame.name,x:o.x,y:o.y})));
  assert.ok(avisos.length>0,tipo);assert.ok(avisos.every(o=>Number(o.frame)===0));
  await avancar(400);
  const frames=await page.evaluate(()=>window.__game.scene.getScene('Level1Parte2').children.list.filter(o=>o.active&&o.texture?.key==='novo-boss-area-ataque').map(o=>Number(o.frame.name)));
  assert.ok(frames.some(f=>f>0),tipo);
  await page.evaluate(()=>{window.__game.scene.getScene('Level1Parte2').novoBoss.cancelarAtaque();});
  assert.equal(await page.evaluate(()=>window.__game.scene.getScene('Level1Parte2').children.list.filter(o=>o.active&&o.texture?.key==='novo-boss-area-ataque').length),0);
 }
 console.log('PASS GIF: 109 quadros transparentes, quatro tipos de aviso animados e limpeza ao cancelar.');
 const ondas=await page.evaluate(async()=>{
  const s=window.__game.scene.getScene('Level1Parte2'),b=s.novoBoss;
  const {sincronizarCorpoNovoBoss}=await import('/js/enemies/novoBoss/NovoBossTeleporte.js');
  const resultados=[];
  for(const origem of b.config.teleporte.pontos)for(const n of [0,.2,.4,.6,.999]){
   b.cancelarAtaque();sincronizarCorpoNovoBoss(b,origem);b.rng=()=>n;
   if(!b.executarAtaque('tentaculos'))throw Error('Surgimento bloqueado');
   const a=b.ataqueAtual.snapshot();resultados.push({n:a.armadilhas.length,esperado:a.quantidade,
    distancias:a.armadilhas.map(p=>Math.hypot(p.x-origem.x,p.y-origem.y))});
  }
  b.cancelarAtaque();sincronizarCorpoNovoBoss(b,b.config.posicaoInicial);
  return resultados;
 });
 for(const o of ondas){assert.equal(o.n,o.esperado);assert.ok(o.n>=8&&o.n<=12);assert.ok(o.distancias.every(d=>d>=119.99&&d<=300.01));}
 console.log('PASS surgimento: 20 ondas nas quatro posições, sempre 8–12 tentáculos a 120–300px.');
 for(const personagem of ['kai-mercer','aria-kade','personagem-teste']){
  await sessao.reiniciar({personagem});
  const alvo=await page.evaluate(()=>{const b=window.__game.scene.getScene('Level1Parte2').novoBoss;b.rng=()=>.4;
   b.executarAtaque('tentaculos');return b.ataqueAtual.snapshot().armadilhas[0];});
  await posicionar(alvo.x+12,alvo.y-20);await avancar(900);
  await page.evaluate(alvo=>{
   const s=window.__game.scene.getScene('Level1Parte2');window.__trajetoTentaculo=[];
   s.events.on('postupdate',()=>{if(!s.restricaoControleNovoBoss||window.__trajetoTentaculo.length>40)return;
    window.__trajetoTentaculo.push({x:s.player.x,y:s.player.y,d:Math.hypot(s.hitboxDanoPlayer.centerX-alvo.x,s.hitboxDanoPlayer.bottom-alvo.y)});
   });
  },alvo);
  await sessao.retomar();
  await page.waitForFunction(()=>window.__game.scene.getScene('Level1Parte2').restricaoControleNovoBoss?.puxao?.restanteMs===0);
  let st=await ler();assert.equal(st.captura.apertos,0);assert.equal(st.captura.apertosNecessarios,8);
  assert.ok(Math.abs(st.player.x-alvo.x)<.01&&Math.abs(st.player.y+26-alvo.y)<.01,JSON.stringify(st));
  const trajeto=await page.evaluate(()=>window.__trajetoTentaculo);
  for(let i=1;i<trajeto.length;i++)assert.ok(trajeto[i].d<=trajeto[i-1].d+.01,JSON.stringify(trajeto));
  const estamina=st.estamina,vida=st.vida,tiros=st.tiros;
  // Segurar não vira várias tentativas; usa o botão verdadeiro com eventos nativos.
  const ponto=await page.evaluate(()=>{const g=window.__game,r=g.canvas.getBoundingClientRect();return{x:r.left+720/g.scale.width*r.width,y:r.top+350/g.scale.height*r.height};});
  await page.mouse.move(ponto.x,ponto.y);await page.mouse.down();await page.waitForTimeout(500);
  assert.equal((await ler()).captura.apertos,1);await page.mouse.up();
  for(let i=0;i<6;i++)await clicarAtaque();
  st=await ler();assert.equal(st.captura.apertos,7);assert.ok(st.hud.includes('7/8'));
  assert.equal(st.estamina,estamina);assert.equal(st.vida,vida);assert.equal(st.tiros,tiros);
  await mkdir('/tmp/boss-aviso-libertacao',{recursive:true});
  if(personagem==='kai-mercer')await page.screenshot({path:'/tmp/boss-aviso-libertacao/agarrado-7-de-8.png'});
  await clicarAtaque();assert.equal((await ler()).captura,null);
  await posicionar(-590,-5520);await page.waitForTimeout(120);
  assert.equal((await ler()).captura,null);
  await sessao.pausar();
  console.log(`PASS ${personagem}: puxão monotônico sem retorno, oito apertos reais, segurar conta uma vez, sem tiros/consumo de estamina.`);
 }
 assert.deepEqual(sessao.errors,[]);assert.deepEqual(sessao.assetErrors,[]);assert.deepEqual(sessao.consoleErrors,[]);
}finally{await sessao.fechar();}
