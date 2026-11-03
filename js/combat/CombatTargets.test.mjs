import test from "node:test";
import assert from "node:assert/strict";
import { alvosAdicionaisCombate, eAlvoAdicionalCombate,
  causarDanoAlvoAdicional } from "./CombatTargets.js";

function encontro() {
  return { active: true, visible: true, morto: false, vida: 100,
    body: { enable: true }, hitboxDano: { x: 0, y: 0, width: 32, height: 32 } };
}

test("encontro usa contrato próprio sem entrar na lista dos robôs nem no boss antigo", () => {
  const novoBoss = encontro(), inimigos = [{}], bossFinal = {};
  const scene = { novoBoss, inimigos, bossFinal };
  assert.deepEqual(alvosAdicionaisCombate(scene), [novoBoss]);
  assert.equal(eAlvoAdicionalCombate(scene, novoBoss), true);
  assert.equal(eAlvoAdicionalCombate(scene, bossFinal), false);
  assert.equal(scene.inimigos, inimigos);
  assert.equal(scene.bossFinal, bossFinal);
  assert.deepEqual(alvosAdicionaisCombate({}), []);
});

test("encontro invisível, inativo, derrotado ou sem hitbox não recebe ataques", () => {
  for (const alteracao of [{ active: false }, { visible: false }, { morto: true },
    { vida: 0 }, { hitboxDano: null }, { body: { enable: false } }]) {
    const novoBoss = Object.assign(encontro(), alteracao);
    novoBoss.receberDano = () => assert.fail("alvo indisponível recebeu dano");
    const scene = { novoBoss };
    assert.deepEqual(alvosAdicionaisCombate(scene), []);
    assert.equal(causarDanoAlvoAdicional(scene, novoBoss, 25), false);
  }
});

test("dano e região de ataque chegam ao encontro e seu resultado é respeitado", () => {
  const novoBoss = encontro(), scene = { novoBoss }, regiao = {};
  novoBoss.receberDano = function (quantidade, area) {
    assert.equal(this, novoBoss);
    assert.equal(quantidade, 12);
    assert.equal(area, regiao);
    return false;
  };
  assert.equal(causarDanoAlvoAdicional(scene, novoBoss, 12, regiao), false);
  novoBoss.receberDano = (quantidade, area) => {
    assert.equal(quantidade, 25);
    assert.equal(area, null);
    return true;
  };
  assert.equal(causarDanoAlvoAdicional(scene, novoBoss, 25), true);
  assert.equal(causarDanoAlvoAdicional(scene, {}, 25), false);
});

test("apresentação local em multiplayer não intercepta ataques nem altera alvos antigos", () => {
  const novoBoss = encontro(), inimigos = [{}], bossFinal = {};
  const scene = { novoBoss, inimigos, bossFinal, multiplayer: true };
  novoBoss.receberDano = () => assert.fail("combate multiplayer ainda não implementado");
  assert.deepEqual(alvosAdicionaisCombate(scene), []);
  assert.equal(causarDanoAlvoAdicional(scene, novoBoss, 25), false);
  assert.equal(scene.inimigos, inimigos);
  assert.equal(scene.bossFinal, bossFinal);
});


test("ilusões usam o mesmo contrato e somem sem transferir dano à verdadeira", () => {
  const novoBoss = encontro(), fake = encontro(), scene = { novoBoss };
  novoBoss.alvosIlusorios = [fake];
  let acertos = 0;
  fake.receberDano = () => { fake.morto = true; fake.vida = 0; acertos++; return true; };
  assert.deepEqual(alvosAdicionaisCombate(scene), [novoBoss, fake]);
  assert.equal(eAlvoAdicionalCombate(scene, fake), true);
  assert.equal(causarDanoAlvoAdicional(scene, fake, 25), true);
  assert.equal(causarDanoAlvoAdicional(scene, fake, 25), false);
  assert.equal(acertos, 1);
  assert.equal(novoBoss.vida, 100);
  assert.deepEqual(alvosAdicionaisCombate(scene), [novoBoss]);
  fake.morto = false; fake.vida = 1;
  novoBoss.morto = true;
  assert.deepEqual(alvosAdicionaisCombate(scene), []);
});
