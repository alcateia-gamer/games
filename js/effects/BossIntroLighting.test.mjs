import test from "node:test";
import assert from "node:assert/strict";
import BossIntroLighting from "./BossIntroLighting.js";

test("entrada apaga as luzes locais e acende fileiras de baixo para cima, sem afetar outras salas", () => {
  const sistema = new BossIntroLighting({ xMin: 0, xMax: 200, yMin: -400, yMax: 0, entradaY: 0 });
  const baixo = { x: 40, y: -32, neon: true }, meio = { x: 40, y: -160, neon: true };
  const alto = { x: 40, y: -320, neon: true }, fora = { x: 400, y: -160, neon: true };
  const anel = { x: 80, y: -160, neon: true, cor: { phaser: 0xff101c } };
  assert.deepEqual([baixo, meio, alto, fora, anel].map(l => sistema.fatorLuz(l)), [0, 0, 0, 1, 0],
    "antes de entrar, a arena já está apagada e as luzes externas continuam normais");
  assert.equal(sistema.aura, 0); assert.equal(sistema.ambiente, 0);
  sistema.iniciar([alto, baixo, meio, fora]);
  assert.deepEqual([baixo, meio, alto, fora].map(l => sistema.fatorLuz(l)), [0, 0, 0, 1]);
  assert.equal(sistema.aura, 0); assert.equal(sistema.ambiente, 0);
  assert.equal(sistema.fatorLuz(anel), 0);
  sistema.avancar(0.1);
  assert.deepEqual([baixo, meio, alto].map(l => sistema.fatorLuz(l)), [1, 0, 0]);
  sistema.avancar(0.5);
  assert.deepEqual([baixo, meio, alto].map(l => sistema.fatorLuz(l)), [1, 1, 0]);
  sistema.avancar(1);
  assert.deepEqual([baixo, meio, alto].map(l => sistema.fatorLuz(l)), [1, 1, 1]);
  assert.equal(sistema.aura, 0, "chegar ao boss ainda não antecipa sua reação");
  assert.equal(sistema.fatorLuz(anel), 0, "os LEDs vermelhos em volta do boss esperam sua reação");
  sistema.perceber(0.25); assert.equal(sistema.aura, 0.5);
  assert.equal(sistema.fatorLuz(anel), 0.5);
  const revisao = sistema.revisao;
  sistema.perceber(0.25001); assert.equal(sistema.revisao, revisao);
  sistema.perceber(1); assert.equal(sistema.aura, 1);
  sistema.restaurar();
  assert.equal(sistema.fatorLuz(alto), 1); assert.equal(sistema.ambiente, 1);
  sistema.iniciar([alto, baixo, meio]);
  assert.equal(sistema.fatorLuz(alto), 0, "uma entrada interrompida pode reiniciar sem luz residual");
});
