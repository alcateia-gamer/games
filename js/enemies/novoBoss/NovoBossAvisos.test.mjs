import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {criarAvisoNovoBoss} from './NovoBossAvisos.js';
import {assetsNovoBoss} from './NovoBossAssets.js';

test('109 quadros preservam fonte e tempos; aviso acompanha prazo, raio e limpeza',()=>{
  const base=new URL('../../../assets/PERSONAGENS/INIMIGOS PRINCIPAIS/BossPrincipal/',import.meta.url);
  const m=JSON.parse(readFileSync(new URL('derivados/area-ataque/area-ataque.json',base)));
  assert.equal(createHash('sha256').update(readFileSync(new URL(m.fonte,base))).digest('hex'),m.sha256Original);
  assert.equal(m.quadros,109);assert.deepEqual(m.duracoesMs,assetsNovoBoss.areaAtaque.duracoesMs);
  const sprite={setName(){return this;},setOrigin(){return this;},setScale(x,y){this.escala={x,y};return this;},
    setDepth(){return this;},setTint(){return this;},setFrame(f){this.frame=f;return this;},setAlpha(){return this;},destroy(){this.destruido=true;}};
  const grafico={setDepth(){return this;},setName(){return this;},clear(){return this;},fillStyle(){return this;},fillCircle(){return this;},lineStyle(){return this;},strokeCircle(){return this;},destroy(){this.destruido=true;}};
  const scene={textures:{exists:()=>true},add:{sprite:()=>sprite,graphics:()=>grafico}};
  const a=criarAvisoNovoBoss(scene,10,20,96);
  assert.equal(sprite.frame,0);assert.ok(Math.abs(sprite.escala.x*188-192)<1e-9);assert.ok(Math.abs(sprite.escala.y*123-192)<1e-9);
  a.atualizar(0.5);assert.ok(sprite.frame>=53&&sprite.frame<=55);
  a.atualizar(1);assert.equal(sprite.frame,108);
  a.destruir();a.destruir();assert.ok(sprite.destruido&&grafico.destruido);
});

test('GIF de área substitui a geometria adicional sem perder aviso ou transparência',()=>{
  let desenhos=0;
  const v={};
  for(const metodo of ['setDepth','setName','clear','destroy','setOrigin','setScale','setTint','setFrame','setAlpha'])v[metodo]=()=>v;
  for(const metodo of ['fillStyle','fillCircle','lineStyle','strokeCircle'])v[metodo]=()=>{desenhos++;return v;};
  const a=criarAvisoNovoBoss({textures:{exists:()=>true},add:{graphics:()=>v,sprite:()=>v}},0,0,96);
  for(const p of [0,.5,1])a.atualizar(p);
  assert.equal(desenhos,0);
  a.destruir();
  const b=criarAvisoNovoBoss({textures:{exists:()=>false},add:{graphics:()=>v}},0,0,96);
  assert.ok(desenhos>0,'sem o recurso, o aviso de perigo permanece visível');
  b.destruir();
});
