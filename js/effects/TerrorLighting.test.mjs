import test from 'node:test';
import assert from 'node:assert/strict';
import criar from './TerrorLighting.js';
import {lightingFixture} from '../../tests/lighting-fixture.mjs';
import {FLASHLIGHT_RETIRED_KEY} from './FlashlightLifecycle.js';

test('sem fontes do Tiled: lanterna com oclusão, cache e liberação definitiva dos recursos',t=>{
 const {scene,metrics,render}=lightingFixture(t);const cleanup=criar(scene);t.after(cleanup);
 render();assert.ok(metrics.clips>0);assert.ok(scene.recursosLanterna);
 assert.ok(!metrics.queries.some(n=>['LuzesFabrica','Luzedeemergencia','IluminaçãoBoss'].includes(n)));
 const quiet=metrics.uploads;render();assert.equal(metrics.uploads,quiet);
 scene.player.x+=10;render();assert.equal(metrics.uploads,quiet+1);
 const {canvas,oclusao,paredes}=scene.recursosLanterna;
 scene.definirIluminacaoFabrica(true);render();
 assert.equal(scene.registry.get(FLASHLIGHT_RETIRED_KEY),true);assert.equal(scene.recursosLanterna,null);
 assert.equal(canvas.width,0);assert.equal(oclusao.width,0);assert.equal(paredes.scene,null);
 const allocated=metrics.canvases.length;scene.definirIluminacaoFabrica(false);render();const n=metrics.uploads;
 for(let i=0;i<10;i++){scene.player.x++;render();}
 assert.equal(metrics.uploads,n);assert.equal(metrics.canvases.length,allocated);
 scene.definirIluminacaoFabrica(true);scene.definirIluminacaoFabrica(false);assert.equal(scene.recursosLanterna,null);
 cleanup();assert.equal(scene.game.renderer.listenerCount('render'),0);
});
test('retomada ligada não inicializa recursos de lanterna; DEV e nova visita preservam aposentadoria',t=>{
 const registry=new Map([['factoryGeneratorPowered',true]]);
 const {scene,metrics}=lightingFixture(t,{powered:true,registry});let cleanup=criar(scene);
 assert.equal(scene.recursosLanterna,null);assert.equal(metrics.canvases.length,0);
 registry.set('factoryGeneratorPowered',false);scene.definirIluminacaoFabrica(false);cleanup();
 cleanup=criar(scene);assert.equal(scene.recursosLanterna,null);cleanup();
 registry.clear();scene.luzFabricaAcesa=false;cleanup=criar(scene);assert.ok(scene.recursosLanterna);cleanup();
});
