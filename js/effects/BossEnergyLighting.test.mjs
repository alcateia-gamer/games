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

test("a aura vermelha só acende quando a introdução sinaliza a reação do boss", () => {
  const { encontro, projetil, luzes } = cena();
  projetil.active = false; encontro.sprite.visible = true;
  encontro.introducao = { iluminacao: { aura: 0 } };
  assert.equal(luzes.atualizar(camera).length, 0);
  encontro.introducao.iluminacao.aura = 0.5;
  assert.equal(luzes.atualizar(camera).find(f => f.vermelha).intensidade, 0.45);
  encontro.introducao.iluminacao.aura = 1;
  assert.equal(luzes.atualizar(camera).find(f => f.vermelha).intensidade, 0.9);
});

test("halo azul aumenta junto com a formação do escudo na introdução", () => {
  const { encontro, luzes } = cena();
  encontro.barreiraAtiva = true;
  encontro.sprite.visible = true;
  for (const carga of [0.1, 0.5, 1]) {
    encontro.sistemaGeradores.cargaEscudo = carga;
    const fonte = luzes.atualizar(camera).find(f => f.escudo);
    assert.equal(fonte.intensidade, 0.85 * carga);
  }
});

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

test("aura acompanha boss e cópias, mantém o cache e atualiza o recorte ao mudar de pose", () => {
  const { encontro, projetil, luzes } = cena();
  projetil.active = false;
  encontro.sprite.visible = true;
  const copia = { ...encontro.sprite, x: 500 };
  encontro.alvosIlusorios = [{ active: true, visible: true, sprite: copia }];
  let fontes = luzes.atualizar(camera);
  assert.equal(fontes.length, 2);
  assert.ok(fontes.every(f => f.vermelha && f.emissor));
  assert.equal(fontes[0].intensidade, fontes[1].intensidade);
  const revisao = luzes.revisao;
  for (let i = 0; i < 120; i++) luzes.atualizar(camera);
  assert.equal(luzes.revisao, revisao);
  for (const mudar of [
    () => { encontro.sprite.frame = {}; },
    () => { encontro.sprite.flipX = true; },
    () => { encontro.sprite.displayOriginX = 180; },
  ]) {
    const antes = luzes.revisao;
    mudar(); luzes.atualizar(camera);
    assert.ok(luzes.revisao > antes, "mudar de pose invalida o recorte da aura");
  }
  encontro.barreiraAtiva = true;
  fontes = luzes.atualizar(camera);
  assert.equal(fontes.filter(f => f.escudo).length, 1);
  encontro.sprite.alpha = 0;
  copia.visible = false;
  assert.equal(luzes.atualizar(camera).length, 0);
  encontro.sprite.alpha = 1;
  assert.equal(luzes.atualizar(camera).length, 2, "aura e escudo usam estados separados");
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

test("o personagem não emite luz nem invalida a composição ao se movimentar na batalha", () => {
  const { scene, encontro, luzes } = cena();
  scene.player = { active: true, visible: true, x: 350, y: 225, alpha: 1 };
  const fontes = luzes.atualizar(camera);
  assert.equal(fontes.length, 1, "somente o disparo emite luz");
  encontro.active = true;
  const revisao = luzes.revisao;
  for (let i = 0; i < 120; i++) {
    scene.player.x += 1;
    scene.player.y += 0.5;
    assert.equal(luzes.atualizar(camera), fontes);
    assert.equal(fontes.length, 1, "não cria um foco no jogador durante o combate");
  }
  assert.equal(luzes.revisao, revisao, "o movimento do jogador preserva o cache das luzes do boss");
});
