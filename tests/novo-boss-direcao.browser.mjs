/** Item 1 do refinamento: direção, pivô e hitboxes no Phaser real. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = {
  ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, automatico: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, posicionar, avancar } = sessao;
const snapshot = () => page.evaluate(() => {
  const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
  const rect = area => ({ x: area.x, y: area.y, width: area.width, height: area.height });
  const alvo = entidade => ({ x: entidade.x, y: entidade.y, flipX: entidade.sprite.flipX,
    origemX: entidade.sprite.displayOriginX, largura: entidade.sprite.width,
    frame: entidade.sprite.frame.name, animacao: entidade.sprite.anims.currentAnim?.key,
    hitbox: rect(entidade.hitboxDano), body: rect(entidade.body),
    nucleo: entidade === boss ? boss.sistemaIlusoes.snapshot().core : null });
  return { real: alvo(boss), falsos: boss.alvosIlusorios.filter(a => a.active).map(alvo) };
});

function alinhado(alvo, esquerda, ataque = false) {
  assert.equal(alvo.flipX, esquerda);
  assert.ok(Math.abs(alvo.origemX - (ataque ? (esquerda ? 174 : 162) : 144)) < 0.001);
  assert.ok(Math.abs(alvo.hitbox.x - (alvo.x - 30.8)) < 0.001);
  assert.ok(Math.abs(alvo.hitbox.y - (alvo.y - 37.4)) < 0.001);
  for (const key of ["x", "y", "width", "height"]) {
    assert.ok(Math.abs(alvo.hitbox[key] - alvo.body[key]) < 0.001, `Corpo desalinhado em ${key}`);
  }
  if (alvo.nucleo?.visible) {
    assert.ok(Math.abs(alvo.nucleo.x - (alvo.x + (esquerda ? -3.3 : 3.3))) < 0.001);
    assert.ok(Math.abs(alvo.nucleo.y - (alvo.y - 13.2)) < 0.001);
  }
}

try {
  const inicial = (await snapshot()).real;
  for (const esquerda of [false, true, false]) {
    await posicionar(esquerda ? -1560 : -590, -5520);
    await avancar(0);
    const { real } = await snapshot();
    alinhado(real, esquerda);
    assert.deepEqual(real.hitbox, inicial.hitbox);
  }
  console.log("PASS: boss segue o jogador nos dois lados, sem deslocar corpo, hitbox ou núcleo.");

  assert.ok(await page.evaluate(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.executarAtaque("chuva")));
  await avancar(0);
  await sessao.retomar();
  await page.waitForTimeout(200);
  await sessao.pausar();
  const antes = (await snapshot()).real;
  assert.ok(Number(antes.frame) > 0);
  for (const esquerda of [true, false, true]) {
    await posicionar(esquerda ? -1560 : -590, -5520);
    await avancar(0);
    const { real } = await snapshot();
    alinhado(real, esquerda, true);
    assert.equal(real.frame, antes.frame, "Virar não pode reiniciar o quadro da animação.");
    assert.equal(real.animacao, "novo-boss-ataque-anim");
    assert.deepEqual(real.hitbox, inicial.hitbox);
  }
  await page.screenshot({ path: "/tmp/novo-boss-parte1/direcao-esquerda.png" });
  console.log("PASS: vira durante o ataque sem reiniciar a animação nem deslocar o pivô.");

  await page.evaluate(() => {
    const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
    boss.cancelarAtaque();
    if (!boss.iniciarIlusoes()) throw new Error("Não criou as quatro aparições.");
  });
  for (const esquerda of [true, false]) {
    await posicionar(esquerda ? -1560 : -590, -5520);
    await avancar(0);
    const { real, falsos } = await snapshot();
    assert.equal(falsos.length, 3);
    for (const alvo of [real, ...falsos]) alinhado(alvo, esquerda);
  }
  console.log("PASS: as quatro aparições olham para o jogador, mantendo suas hitboxes.");

  await page.evaluate(() => {
    const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
    boss.sistemaIlusoes.encerrarQuatro();
    if (!boss.iniciarClones()) throw new Error("Não criou os clones móveis.");
  });
  await avancar(1200);
  for (const esquerda of [true, false]) {
    await posicionar(esquerda ? -1560 : -590, -5520);
    await avancar(0);
    const { real, falsos } = await snapshot();
    assert.equal(falsos.length, 9);
    for (const alvo of [real, ...falsos]) alinhado(alvo, esquerda);
  }
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
  assert.deepEqual(sessao.consoleErrors, []);
  console.log("PASS: nove clones móveis também acompanham a direção; nenhum erro de JS, console ou assets.");
} finally {
  await sessao.fechar();
}
