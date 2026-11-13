import test from 'node:test';
import assert from 'node:assert/strict';
import { tocarSomRicocheteKai } from './kaiEspecial.js';

test('ricochete pula silêncio inicial sem mudar volume ou velocidade', () => {
  const amostras = new Float32Array(1000);
  amostras[200] = .8;
  let leituras = 0;
  const buffer = {length:1000,sampleRate:1000,numberOfChannels:1,
    getChannelData() { leituras++; return amostras; }};
  const sons = [];
  const scene = { cache:{audio:{exists:()=>true,get:()=>buffer}},
    sound:{play:(key,config)=>sons.push({key,...config})} };
  tocarSomRicocheteKai(scene,{x:50,y:20});
  tocarSomRicocheteKai(scene,{x:50,y:20});
  assert.deepEqual(sons[0],{key:'kai-ricochete',volume:.4,loop:false,seek:.197});
  assert.equal(sons.length,2);
  assert.equal(leituras,1,'analisa o áudio somente uma vez');
});
