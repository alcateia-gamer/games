import test from "node:test";
import assert from "node:assert/strict";
import {capturePerformance} from "./CapturePerformance.js";
test("coleta manual preserva metadados, rejeita sobreposição e limpa listeners", async t=>{
  const keys=["window","document","navigator","innerWidth","innerHeight","devicePixelRatio","setTimeout"];
  const descriptors=keys.map(key=>Object.getOwnPropertyDescriptor(globalThis,key));
  t.after(()=>keys.forEach((key,i)=>{if(descriptors[i])Object.defineProperty(globalThis,key,descriptors[i]);else delete globalThis[key];}));
  const listeners=new Set();let resets=0;
  const values={window:{nullbornsPerformance:{reset(){resets++;},snapshot(){return {metrics:{sample:1}};}}},
    document:{visibilityState:"visible",addEventListener(_key,fn){listeners.add(fn);},removeEventListener(_key,fn){listeners.delete(fn);}},
    navigator:{userAgent:"test"},innerWidth:390,innerHeight:844,devicePixelRatio:2,
    setTimeout(fn){queueMicrotask(fn);return 0;}};
  for(const key of keys)Object.defineProperty(globalThis,key,{value:values[key],writable:true,configurable:true});
  const pending=capturePerformance({label:"factory",revision:"before",seconds:5});
  await assert.rejects(capturePerformance({seconds:5}),/andamento/);
  const result=await pending;
  assert.equal(result.label,"factory");assert.equal(result.revision,"before");assert.equal(result.before.dpr,2);
  assert.deepEqual(result.metrics,{sample:1});assert.equal(resets,1);assert.equal(listeners.size,0);
  await assert.rejects(capturePerformance({seconds:0}),RangeError);
});
