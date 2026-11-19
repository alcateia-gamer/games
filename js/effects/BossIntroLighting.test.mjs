import test from 'node:test';import assert from 'node:assert/strict';
import BossIntroLighting from './BossIntroLighting.js';
test('introdução controla ambiente e aura com limites da arena sem consultar pontos',()=>{
 const l=new BossIntroLighting({yMin:-500,yMax:-100});assert.equal(l.ambiente,0);assert.equal(l.aura,0);
 l.avancar(.5);l.perceber(.25);assert.equal(l.ambiente,.5);assert.equal(l.aura,.5);
 l.restaurar();assert.equal(l.ambiente,1);assert.equal(l.ativa,false);
 l.iniciar();assert.equal(l.topo,-500);assert.equal(l.base,-100);assert.equal(l.ambiente,0);
});
test('réplica mantém revisão e restaura progresso sem fontes do Tiled',()=>{
 const l=new BossIntroLighting({yMin:0,yMax:100});const r=l.revisao;
 l.aplicarEstadoRede({ativa:true,progresso:.5,aura:.5,ambiente:.5,topo:0,base:100});
 assert.ok(l.revisao>r);const revision=l.revisao;l.aplicarEstadoRede({ativa:true,progresso:.5,aura:.5,ambiente:.5,topo:0,base:100});assert.equal(l.revisao,revision);
});
