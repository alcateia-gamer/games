import test from 'node:test';
import assert from 'node:assert/strict';
import {calcularPerfilLuzParede,calcularEmissorLuzParede} from './BossWallLighting.js';
test("perfil forma uma faixa estreita com halo difuso e não emite atrás da parede", () => {
  assert.ok(calcularEmissorLuzParede(0, 0) > 0.99);
  assert.ok(calcularEmissorLuzParede(0.03, 0) < 0.01);
  assert.ok(calcularEmissorLuzParede(0.005, 0.05) > 0.8);
  assert.equal(calcularEmissorLuzParede(0.005, 0.1), 0);
  assert.ok(calcularPerfilLuzParede(0.2, 0) > calcularPerfilLuzParede(0.6, 0));
  assert.ok(calcularPerfilLuzParede(0.4, 0.2) > 0.1, "a luz se espalha suavemente pela sala");
  for (const y of [-0.5, 0, 0.5]) {
    assert.equal(calcularPerfilLuzParede(-0.01, y), 0);
    assert.equal(calcularEmissorLuzParede(-0.01, y), 0);
  }
  assert.equal(calcularPerfilLuzParede(1, 0), 0);
});
