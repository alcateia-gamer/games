import assert from 'node:assert/strict';
import {abrirSessaoNovoBoss} from './novo-boss-browser-helpers.mjs';
import {novoBossConfig} from '../js/enemies/novoBoss/NovoBossConfig.js';
const config={...novoBossConfig,prologo:{...novoBossConfig.prologo,ativo:false},cenaEntrada:{...novoBossConfig.cenaEntrada,ativo:false},ataques:{...novoBossConfig.ataques,automatico:false},geradores:{...novoBossConfig.geradores,ativo:false}};
const session=await abrirSessaoNovoBoss(config,{}, {hasTouch:true});
const {page}=session;
try{
 for(const personagem of ['kai-mercer','aria-kade']){
  await session.reiniciar({personagem});await session.retomar();
  await page.evaluate(async()=>{
   const s=__game.scene.getScene('Level1Parte2');s.player.novoBossRecapturaAte=0;
   s.movimentoBloqueado=false;s.generatorMenuOpen=false;
   const {capturarJogadorNovoBoss}=await import('/js/player/PlayerControlEffects.js');
   if(!capturarJogadorNovoBoss(s,'teste',2500,null,{apertos:8}))throw Error('captura recusada');
  });
  const point=await page.evaluate(()=>{const g=__game,c=g.scene.getScene('Level1Parte2').cameras.main,r=g.canvas.getBoundingClientRect();return{x:r.left+(c.x+c.width-80)*r.width/g.scale.width,y:r.top+(c.y+c.height-100)*r.height/g.scale.height};});
  const count=()=>page.evaluate(()=>__game.scene.getScene('Level1Parte2').restricaoControleNovoBoss?.apertos ?? null);
  await page.mouse.click(20,20);await page.touchscreen.tap(30,30);assert.equal(await count(),0);
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.waitForTimeout(500);assert.equal(await count(),1);await page.mouse.up();
  for(let i=2;i<=8;i++){await page.touchscreen.tap(point.x,point.y);assert.equal(await count(),i===8?null:i);}
  await page.waitForFunction(()=>!__game.scene.getScene('Level1Parte2').novoBoss.hud.textoEstado.text.includes('AGARRADO'));
  console.log('PASS',personagem,'mouse, toque, cenário ignorado, segurar conta uma vez, fuga e HUD');
 }
 assert.deepEqual(session.errors,[]);
}finally{await session.fechar();}
