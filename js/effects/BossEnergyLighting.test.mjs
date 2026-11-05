import test from "node:test";
import assert from "node:assert/strict";
import BossEnergyLighting, { calcularPerfilEnergiaBoss } from "./BossEnergyLighting.js";

const camera = { width: 800, height: 450, matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } };
function cena() {
  const projetil = { x: 400, y: 225, active: true, visible: true, alpha: 1, novoBossDisparoEnergia: true };
  const encontro = { jogadorNaArena: true, projeteisBoss: [projetil],
    sprite: { x: 400, y: 209, active: true, visible: false, alpha: 1 },
    config: { geradores: { raioBarreira: 95 } }, sistemaGeradores: { corpoBarreira: { enable: true } } };
  const scene = { novoBoss: encontro, children: { list: [projetil] } };
  return { scene, encontro, projetil, luzes: new BossEnergyLighting(scene) };
}

test("luz acompanha os disparos, sem duplicar sprites e sem denunciar cópias ilusórias", () => {
  const { scene, encontro, projetil, luzes } = cena();
  const fontes = luzes.atualizar(camera);
  assert.equal(fontes.length, 1);
  const revisao = luzes.revisao;
  luzes.atualizar(camera);
  assert.equal(luzes.revisao, revisao);
  projetil.x = 440;
  luzes.atualizar(camera);
  assert.equal(fontes[0].luz.x, 440);
  assert.ok(luzes.revisao > revisao);
  const copia = { ...projetil, x: 500, novoBossAtaqueIlusorio: true };
  scene.children.list.push(copia);
  assert.equal(luzes.atualizar(camera).length, 2);
  assert.equal(fontes[0].intensidade, fontes[1].intensidade);
  encontro.projeteisBoss.length = 0;
  projetil.active = false;
  assert.equal(luzes.atualizar(camera).length, 1);
  copia.visible = false;
  assert.equal(luzes.atualizar(camera).length, 0);
  luzes.destroy();
  assert.equal(luzes.scene, null);
  assert.equal(fontes.length, 0);
});

test("o halo do escudo acompanha a barreira, alpha e teleporte, apagando ao desativar", () => {
  const { encontro, luzes } = cena();
  encontro.projeteisBoss[0].active = false;
  encontro.barreiraAtiva = true;
  encontro.sprite.visible = true;
  let fonte = luzes.atualizar(camera).find(f => f.escudo);
  assert.equal(fonte.escudo, true);
  assert.equal(fonte.luz.y, 225);
  assert.equal(fonte.luz.raio * 1.5, 95 * 1.7);
  encontro.sprite.x = 450;
  encontro.sprite.alpha = 0.5;
  fonte = luzes.atualizar(camera).find(f => f.escudo);
  assert.equal(fonte.luz.x, 450);
  assert.equal(fonte.intensidade, 0.425);
  for (const alterar of [
    () => { encontro.teleporte = {}; },
    () => { encontro.sistemaGeradores.corpoBarreira.enable = false; },
    () => { encontro.sprite.visible = false; },
    () => { encontro.barreiraAtiva = false; },
  ]) {
    encontro.teleporte = null; encontro.sistemaGeradores.corpoBarreira.enable = true;
    encontro.sprite.visible = true; encontro.barreiraAtiva = true;
    alterar();
    assert.equal(luzes.atualizar(camera).filter(f => f.escudo).length, 0);
  }
});

test("o brilho vermelho acompanha o boss e as cópias, coexistindo com o escudo", () => {
  const { encontro, luzes } = cena();
  encontro.projeteisBoss.length = 0;
  encontro.sprite.visible = true;
  encontro.barreiraAtiva = true;
  const auras = () => luzes.atualizar(camera).filter(f => f.vermelha);
  let [aura] = auras();
  assert.equal(aura.intensidade, 0.45);
  assert.equal(aura.luz.y, 225);
  assert.ok(luzes.fontesVisiveis.some(f => f.escudo), "o escudo continua emitindo azul");
  encontro.sprite.x = 460;
  encontro.sprite.alpha = 0.5;
  [aura] = auras();
  assert.equal(aura.luz.x, 460);
  assert.equal(aura.intensidade, 0.225);
  const copia = { ...encontro.sprite, x: 500 };
  encontro.alvosIlusorios = [{ active: true, visible: true, sprite: copia }];
  assert.equal(auras().length, 2, "o brilho não revela qual boss é o verdadeiro");
  encontro.sprite.alpha = 0;
  copia.visible = false;
  assert.equal(auras().length, 0);
  encontro.sprite.alpha = 1;
  assert.equal(auras().length, 1);
  encontro.morto = true;
  assert.equal(luzes.atualizar(camera).length, 0);
});

test("suspensão, morte, saída, fim do encontro e câmera removem a luz sem rastros", () => {
  for (const alterar of [
    ({ encontro }) => { encontro.suspenso = true; },
    ({ encontro }) => { encontro.morto = true; },
    ({ encontro }) => { encontro.encerrado = true; },
    ({ encontro }) => { encontro.jogadorNaArena = false; },
    ({ scene }) => { scene.morteEmAndamento = true; },
    ({ scene }) => { scene.vida = 0; },
    ({ projetil }) => { projetil.x = -5000; },
    ({ projetil }) => { projetil.alpha = 0; },
  ]) {
    const c = cena();
    assert.equal(c.luzes.atualizar(camera).length, 1);
    alterar(c);
    assert.equal(c.luzes.atualizar(camera).length, 0);
  }
  const { projetil, luzes } = cena();
  projetil.x = -5400; projetil.y = -5225;
  assert.equal(luzes.atualizar({ ...camera, matrix: { ...camera.matrix, e: 5800, f: 5450 } }).length, 1);
});

test("perfis azuis têm queda suave e a luz do escudo alcança além do seu contorno", () => {
  assert.ok(calcularPerfilEnergiaBoss(0, 0) > calcularPerfilEnergiaBoss(0.3, 0));
  assert.ok(calcularPerfilEnergiaBoss(0.3, 0) > calcularPerfilEnergiaBoss(0.8, 0));
  assert.ok(calcularPerfilEnergiaBoss(0.65, 0, true) > 0.1);
  for (const escudo of [false, true]) {
    assert.equal(calcularPerfilEnergiaBoss(1, 0, escudo), 0);
    assert.equal(calcularPerfilEnergiaBoss(0.4, 0, escudo), calcularPerfilEnergiaBoss(0, -0.4, escudo));
  }
});
