import test from "node:test";
import assert from "node:assert/strict";
import { obterBocaMetralhadora, criarMunicaoRobo } from "./WarRobotProjectile.js";

function robo(overrides = {}) {
  return { x: 100, y: 200, width: 311, height: 421, scaleX: .23, scaleY: .23,
    direcaoAtual: "down", ultimoLadoTiro: "left", ...overrides };
}
const perto = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≈ ${b}`);

test("cada robô alterna as duas armas independentemente nos 12 quadros", () => {
  for (let name=0; name<12; name++) {
    const a=robo({frame:{name}}), b=robo({frame:{name}});
    const primeira=obterBocaMetralhadora(a), segunda=obterBocaMetralhadora(a);
    assert.notDeepEqual(primeira,segunda);
    assert.deepEqual(obterBocaMetralhadora(b),primeira);
    assert.deepEqual(obterBocaMetralhadora(a),primeira);
  }
});

test("usa o quadro renderizado mesmo quando a IA já mudou de direção", () => {
  const r=robo({ frame:{name:4}, direcaoAtual:"right" });
  const boca=obterBocaMetralhadora(r);
  perto(boca.x,100+(61-155.5)*.23);
  perto(boca.y,200+(140-210.5)*.23);
});

test("acompanha o passo, a escala, a origem e o espelhamento do sprite", () => {
  const a=robo({frame:{name:3}}), b=robo({frame:{name:4}});
  perto(obterBocaMetralhadora(a).x-obterBocaMetralhadora(b).x,2*.23);
  const r=robo({frame:{name:0},originX:0,originY:0,flipX:true,scaleX:.5,scaleY:.4});
  const boca=obterBocaMetralhadora(r);
  perto(boca.x,100+(311-23)*.5);
  perto(boca.y,200+287*.4);
});

test("projeta a arma oculta atrás do robô na vista de costas", () => {
  const r=robo({frame:{name:9},depth:12});
  const a=obterBocaMetralhadora(r), b=obterBocaMetralhadora(r);
  assert.ok(a.depth<r.depth);
  assert.ok(a.y<r.y && b.y<r.y);
  assert.ok(a.x>r.x && b.x<r.x);
});

test("a munição nasce inteira à frente do cano em todos os ângulos", () => {
  const scene={textures:{exists:()=>true},add:{image(x,y){return {x,y,
    setOrigin(v){this.originX=v;return this;},setRotation(v){this.rotation=v;return this;},
    setDepth(v){this.depth=v;return this;}};}}};
  for(let i=0;i<16;i++) {
    const angulo=i*Math.PI/8, p=criarMunicaoRobo(scene,42,85,angulo);
    perto(p.x-Math.cos(angulo)*10,42);
    perto(p.y-Math.sin(angulo)*10,85);
    assert.equal(p.originX,.5);
  }
});
