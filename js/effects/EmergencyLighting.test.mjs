import test from 'node:test';
import assert from 'node:assert/strict';
import {calcularPerfilNeon} from './EmergencyLighting.js';
test("perfil do neon preserva faixa emissiva, halo e limite suave", () => {
  assert.equal(calcularPerfilNeon(0, 0), 1);
  assert.ok(calcularPerfilNeon(0.05, 0) > calcularPerfilNeon(0, 0.05));
  assert.ok(calcularPerfilNeon(0.4, 0) > calcularPerfilNeon(0.8, 0));
  assert.equal(calcularPerfilNeon(1, 0), 0);
  assert.ok(calcularPerfilNeon(0.2, 0) > calcularPerfilNeon(0.2, 0, true));
});
