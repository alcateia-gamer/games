/** Folhas originais, alinhamento e efeitos de apresentação no Phaser real. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { assetsNovoBoss } from "../js/enemies/novoBoss/NovoBossAssets.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = {
  ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, automatico: false },
  ilusoes: { ...novoBossConfig.ilusoes, ativo: true },
  clones: { ...novoBossConfig.clones, ativo: true },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar, retomar, pausar, reiniciar } = sessao;

const snapshot = () => page.evaluate(() => {
  const scene = window.__game.scene.getScene("Level1Parte2");
  const boss = scene.novoBoss;
  const rect = area => ({ x: area.x, y: area.y, width: area.width, height: area.height });
  const sprite = objeto => ({
    x: objeto.x, y: objeto.y, texture: objeto.texture.key, frame: objeto.frame.name,
    flipX: objeto.flipX,
    escala: objeto.scaleX,
    originX: objeto.originX, originY: objeto.originY, tint: objeto.tintTopLeft,
    visible: objeto.visible, alpha: objeto.alpha, depth: objeto.depth,
    animation: objeto.anims.currentAnim?.key, playing: objeto.anims.isPlaying,
    totalFrames: objeto.anims.currentAnim?.frames.length,
  });
  return {
    estado: boss.estado, vida: boss.vida, morto: boss.morto,
    body: rect(boss.body), hitbox: rect(boss.hitboxDano),
    offset: { x: boss.body.offset.x, y: boss.body.offset.y },
    sprite: sprite(boss.sprite), apresentacao: boss.apresentacao.snapshot(),
    ataque: boss.ataqueAtual?.snapshot() ?? null,
    core: boss.sistemaIlusoes.snapshot().core,
    falsos: boss.alvosIlusorios.filter(alvo => alvo.active).map(alvo => ({
      ...sprite(alvo.sprite), hitbox: rect(alvo.hitboxDano),
    })),
    avisos: scene.children.list.filter(child => child.active && child.name === "novo-boss-aviso")
      .map(child => ({ visible: child.visible, depth: child.depth, commands: child.commandBuffer?.length })),
    raios: scene.children.list.filter(child => child.active &&
      child.texture?.key === "novo-boss-heavens-fury").map(sprite),
    efeitos: scene.children.list.filter(child => child.active && child.name === "novo-boss-apresentacao")
      .map(child => ({ visible: child.visible, depth: child.depth, commands: child.commandBuffer?.length })),
    listeners: ["novo-boss:vida", "novo-boss:fase-alterada", "novo-boss:derrotada"]
      .map(nome => [nome, scene.events.listenerCount(nome)]),
  };
});

function corpoAlinhado(state) {
  for (const key of ["x", "y", "width", "height"]) {
    assert.ok(Math.abs(state.body[key] - state.hitbox[key]) < 0.001,
      `A folha precisa preservar a hitbox física (${key}).`);
  }
}

function nucleoAlinhado(state) {
  assert.ok(state.core?.visible);
  assert.ok(Math.abs(state.core.x - (state.sprite.x + (state.sprite.flipX ? -3.3 : 3.3))) < 0.001);
  assert.ok(Math.abs(state.core.y - (state.sprite.y - 13.2)) < 0.001);
}

async function esperarEstado(estado, limite = 30000) {
  const atingiu = await page.evaluate(async ({ estado, limite }) => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    for (let tempo = 0; tempo <= limite; tempo += 20) {
      if (scene.novoBoss.estado === estado) return true;
      atualizarNovoBoss(scene, scene.time.now, 20);
    }
    return false;
  }, { estado, limite });
  assert.ok(atingiu, `O encontro precisa atingir o estado ${estado}.`);
}

async function iniciarAtaque(tipo) {
  assert.ok(await page.evaluate(tipo =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.executarAtaque(tipo), tipo));
  await avancar(0);
}

try {
  let state = await snapshot();
  assert.equal(state.sprite.texture, "novo-boss-idle");
  assert.equal(state.sprite.animation, "novo-boss-idle-anim");
  assert.equal(state.sprite.totalFrames, 16);
  assert.deepEqual(state.offset, { x: 88, y: 76 });
  corpoAlinhado(state);
  nucleoAlinhado(state);
  const areaIdle = state.hitbox;
  await posicionar(state.sprite.x + 80, state.sprite.y + 180);
  await iniciarAtaque("chuva");
  state = await snapshot();
  assert.equal(state.sprite.texture, "novo-boss-ataque");
  assert.equal(state.sprite.animation, "novo-boss-ataque-anim");
  assert.equal(state.sprite.totalFrames, 48);
  assert.ok(Math.abs(state.sprite.originX - 162 / 336) < 1e-8);
  assert.ok(Math.abs(state.sprite.originY - 192 / 336) < 1e-8);
  assert.deepEqual(state.offset, { x: 106, y: 124 });
  assert.deepEqual(state.hitbox, areaIdle);
  corpoAlinhado(state);
  nucleoAlinhado(state);
  await retomar();
  await page.waitForTimeout(300);
  await pausar();
  state = await snapshot();
  assert.ok(Number(state.sprite.frame) > 0,
    "A animação real do Phaser precisa avançar enquanto a cena está ativa.");
  corpoAlinhado(state);
  nucleoAlinhado(state);
  console.log("PASS: idle de 16 quadros e ataque de 48 quadros reproduzem sem deslocar corpo, hitbox ou núcleo.");

  await avancar(Math.max(0, 1000 - state.ataque.tempo));
  state = await snapshot();
  assert.ok(state.avisos.some(aviso => aviso.visible && aviso.depth === 51 && aviso.commands > 0));
  assert.ok(state.raios.some(raio => raio.frame === 0 && raio.depth === 52));
  await avancar(400);
  state = await snapshot();
  const raioImpacto = state.raios.find(raio => raio.frame === 4);
  assert.ok(raioImpacto, "O impacto precisa usar o quadro 4 da folha Heavens Fury fornecida.");
  assert.equal(raioImpacto.originX, assetsNovoBoss.heavensFury.origemX);
  assert.equal(raioImpacto.originY, 0.75);
  assert.equal(raioImpacto.escala * assetsNovoBoss.heavensFury.diametroImpacto,
    config.ataques.chuvaRaios.raio * 2);
  assert.ok(state.ataque.marcas[0].impactoEm === 1400);
  await page.screenshot({ path: process.env.NOVO_BOSS_SCREENSHOT ?? "/tmp/novo-boss-etapa7-heavens.png" });
  await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").novoBoss.cancelarAtaque(); });
  await avancar(0);
  state = await snapshot();
  assert.equal(state.raios.length, 0);
  assert.equal(state.avisos.length, 0);
  assert.equal(state.sprite.texture, "novo-boss-idle");
  assert.deepEqual(state.hitbox, areaIdle);
  console.log("PASS: Heavens Fury usa o PNG original, impacto no quadro 4 e avisos vermelhos acima da sombra; cancelamento limpa os efeitos.");

  assert.ok(await page.evaluate(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.iniciarIlusoes()));
  await iniciarAtaque("chuva");
  await avancar(100);
  state = await snapshot();
  assert.equal(state.falsos.length, 3);
  assert.ok(state.falsos.every(falso => falso.texture === "novo-boss-ataque" &&
    falso.totalFrames === 48 && Math.abs(falso.originX - (falso.flipX ? 174 : 162) / 336) < 1e-8 &&
    Math.abs(falso.originY - 192 / 336) < 1e-8));
  for (const falso of state.falsos) {
    assert.ok(Math.abs(falso.hitbox.x - (falso.x - 30.8)) < 0.001);
    assert.ok(Math.abs(falso.hitbox.y - (falso.y - 37.4)) < 0.001);
  }
  nucleoAlinhado(state);
  await avancar(500);
  state = await snapshot();
  assert.ok(state.falsos.every(falso => falso.texture === "novo-boss-ataque" &&
    falso.frame === state.sprite.frame));
  console.log("PASS: aparições falsas conservam a pose e o mesmo quadro da verdadeira além de 500 ms; somente a verdadeira mantém o núcleo pulsante.");

  await page.evaluate(() => {
    const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
    boss.cancelarAtaque();
    boss.sistemaIlusoes.encerrarQuatro();
  });
  await esperarEstado("vulneravel");
  assert.ok(await page.evaluate(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(25)));
  state = await snapshot();
  assert.ok(state.apresentacao.flashRestante > 0);
  assert.equal(state.sprite.tint, 0xffe8cf);
  await esperarEstado("teletransportando");
  await avancar(20);
  state = await snapshot();
  assert.ok(state.efeitos.some(efeito => efeito.visible && efeito.depth === 50.5 && efeito.commands > 0));
  await avancar(600);
  state = await snapshot();
  assert.equal(state.apresentacao.flashRestante, 0);
  assert.equal(state.sprite.tint, 0xffffff);
  assert.equal(state.apresentacao.graficoVisivel, false);
  corpoAlinhado(state);
  console.log("PASS: dano produz realce temporário; o teletransporte mostra efeito violeta e o limpa ao terminar.");

  await reiniciar({ novoBossConfig: { ...config, fase2: { ...config.fase2, ativo: true } } });
  await esperarEstado("vulneravel");
  assert.ok(await page.evaluate(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(501)));
  state = await snapshot();
  assert.ok(state.apresentacao.burstRestante > 0);
  await avancar(20);
  state = await snapshot();
  assert.ok(state.apresentacao.burstRestante > 0 && state.apresentacao.graficoVisivel);
  await avancar(1000);
  assert.equal((await snapshot()).apresentacao.burstRestante, 0);
  await esperarEstado("vulneravel");
  assert.ok(await page.evaluate(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(1000)));
  state = await snapshot();
  assert.equal(state.estado, "derrotada");
  assert.equal(state.apresentacao.derrotaDecorrido, 0);
  const alphaInicial = state.sprite.alpha;
  await avancar(450);
  state = await snapshot();
  assert.ok(state.sprite.alpha < alphaInicial && state.sprite.alpha > 0);
  await avancar(450);
  state = await snapshot();
  assert.equal(state.sprite.alpha, 0);
  assert.equal(state.sprite.visible, false);
  assert.equal(state.apresentacao.graficoVisivel, false);
  console.log("PASS: a transição real de fase produz explosão visual e a derrota desaparece gradualmente sem manter efeitos ativos.");

  const listenersAntes = state.listeners;
  await page.evaluate(() => {
    const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
    window.__apresentacaoAntigaEtapa7 = boss.apresentacao;
    window.__spriteAntigoEtapa7 = boss.sprite;
  });
  await reiniciar();
  state = await snapshot();
  assert.deepEqual(state.listeners, listenersAntes,
    "Reiniciar a cena não pode acumular ouvintes de efeitos.");
  assert.ok(await page.evaluate(() => window.__apresentacaoAntigaEtapa7.snapshot().destruido));
  assert.ok(await page.evaluate(() => !window.__spriteAntigoEtapa7.active));
  assert.equal(state.efeitos.length, 0);
  assert.equal(state.apresentacao.pose, "idle");
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
  console.log("PASS: reinício destrói a apresentação antiga e preserva um único conjunto de ouvintes; nenhum erro de recurso ou JavaScript.");
} catch (error) {
  console.error("Estado na falha:", await snapshot().catch(() => null));
  console.error("Erros JavaScript:", sessao.errors, "Falhas de recursos:", sessao.assetErrors);
  await page.screenshot({ path: "/tmp/novo-boss-etapa7-falha.png" }).catch(() => {});
  throw error;
} finally {
  await sessao.fechar();
}
