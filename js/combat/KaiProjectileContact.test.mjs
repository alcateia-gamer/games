import test from 'node:test';
import assert from 'node:assert/strict';
import { contatoProjetilDomo } from './KaiProjectileContact.js';

const contato = laser => contatoProjetilDomo(laser, 10, 20, 50, 57.5, 32.5);

test('reflete quando a ponta toca a barreira, antes de o centro entrar', () => {
  const laser = { x:117, y:20, comprimentoFeixe:112, larguraFeixe:6 };
  assert.equal(contato(laser), null);
  laser.x = 116;
  assert.deepEqual(contato(laser), {x:60,y:20});
});

test('respeita a altura e a base do domo ancorado nos pés', () => {
  assert.equal(contato({x:10,y:-38}), null);
  assert.ok(contato({x:10,y:-37}));
  assert.equal(contato({x:10,y:53}), null);
  assert.ok(contato({x:10,y:52}));
  assert.equal(contatoProjetilDomo({x:10,y:20},10,20,0,0,0),null);
});

test('usa a orientação real do feixe, sem os cantos vazios da caixa externa', () => {
  const laser = { x:80,y:-50,comprimentoFeixe:112,larguraFeixe:6,rotation:Math.PI/4 };
  assert.equal(contato(laser),null);
  laser.rotation = -Math.PI/4;
  assert.ok(contato(laser));
});
