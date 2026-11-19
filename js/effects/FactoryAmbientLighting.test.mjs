import test from 'node:test';import assert from 'node:assert/strict';
import criar from './FactoryAmbientLighting.js';
import {lightingFixture} from '../../tests/lighting-fixture.mjs';
import {alphaOscilacaoFabrica} from './FactoryAmbientOscillation.js';
test('ambiente usa apenas um compositor e preserva transição do gerador',t=>{
 const {scene,metrics,render}=lightingFixture(t);const cleanup=criar(scene);t.after(cleanup);
 assert.equal(scene.game.renderer.listenerCount('render'),1);
 let p=0;scene.definirIluminacaoFabrica(true,()=>p);render();assert.equal(scene.iluminacaoFabrica.progressoPartida,0);
 assert.equal(alphaOscilacaoFabrica(0,true),.75);
 p=.5;render();assert.equal(scene.iluminacaoFabrica.progressoPartida,.5);
 p=1;render();render();const before=metrics.uploads;for(let i=0;i<100;i++)render();assert.equal(metrics.uploads,before);
 assert.equal(alphaOscilacaoFabrica(1,false),.4);
});
