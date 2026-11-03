import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {criarAvisoNovoBoss} from './NovoBossAvisos.js';
import {assetsNovoBoss} from './NovoBossAssets.js';

test('109 quadros preservam fonte e tempos; aviso acompanha prazo, raio e limpeza',()=>{
  const base=new URL('../../../assets/PERSONAGENS/INIMIGOS PRINCIPAIS/Boss-test/',import.meta.url);
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
