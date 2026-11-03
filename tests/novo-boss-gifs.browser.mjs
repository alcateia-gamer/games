/** Os dois GIFs autorizados, integrados às mecânicas independentes no Phaser. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = { ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, automatico: false },
  ilusoes: { ...novoBossConfig.ilusoes, ativo: false },
  clones: { ...novoBossConfig.clones, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar, reiniciar } = sessao;
const snapshot = () => page.evaluate(() => {
  const scene = window.__game.scene.getScene("Level1Parte2"), boss = scene.novoBoss;
  return { x: boss.x, y: boss.y, estado: boss.estado, vida: scene.vida,
    barreira: boss.barreiraAtiva, explosoes: boss.apresentacao.snapshot().explosoesPulso,
    sprites: scene.children.list.filter(obj => obj.active &&
      ["novo-boss-escudo-energia", "novo-boss-explosao"].includes(obj.name)).map(obj => ({
      name: obj.name, frame: Number(obj.frame.name), key: obj.texture.key,
      x: obj.x, y: obj.y, originX: obj.originX, originY: obj.originY,
      scale: obj.scaleX, visible: obj.visible, alpha: obj.alpha, depth: obj.depth,
    })),
  };
});
const escudo = state => state.sprites.find(obj => obj.name === "novo-boss-escudo-energia");
const explosao = state => state.sprites.find(obj => obj.name === "novo-boss-explosao");

async function desligarGeradores() {
  assert.ok(await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { atualizarHitboxDanoPlayer } = await import("/js/player/Player.js");
    for (const g of scene.novoBoss.geradores) {
      const dx = scene.player.body.center.x - scene.player.x;
      const dy = scene.player.body.center.y - scene.player.y;
      scene.player.setPosition(g.x - dx, g.y - 55 - dy);
      scene.player.body.reset(scene.player.x, scene.player.y);
      scene.player.body.updateFromGameObject();
      atualizarHitboxDanoPlayer(scene);
      if (!scene.novoBoss.sistemaGeradores.interagir(g.id)) return false;
    }
    return true;
  }));
}

async function pertoDoPulso() {
  const ponto = await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2"), boss = scene.novoBoss;
    const area = scene.hitboxDanoPlayer;
    const centro = boss.config.teleporte.pontos.find(p => p.id === "centro");
    scene.cameras.main.stopFollow().setZoom(0.9).centerOn(centro.x, centro.y - 30);
    return { x: centro.x + 90 - (area.centerX - scene.player.x),
      y: centro.y - (area.centerY - scene.player.y) };
  });
  await posicionar(ponto.x, ponto.y);
  assert.ok(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.executarAtaque("pulso")));
  if (await page.evaluate(() => Boolean(window.__game.scene.getScene("Level1Parte2").novoBoss.ataquePendente))) {
    await avancar(500);
  }
}

try {
  let state = await snapshot();
  assert.ok(state.barreira && escudo(state).visible);
  assert.equal(escudo(state).key, "novo-boss-escudo-energia");
  assert.equal(escudo(state).x, state.x);
  assert.equal(escudo(state).y, state.y + 16);
  assert.equal(escudo(state).scale * 640, 190);
  assert.equal(escudo(state).originX, 390 / 800);
  assert.equal(escudo(state).depth, 52);
  assert.equal(state.explosoes, 0);
  const frames = new Set();
  for (let i = 0; i < 6; i++) { frames.add(escudo(await snapshot()).frame); await avancar(100); }
  assert.deepEqual([...frames].sort(), [0, 1, 2, 3, 4]);
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2"), boss = scene.novoBoss;
    scene.cameras.main.stopFollow().setZoom(1.5).centerOn(boss.x, boss.y - 30);
  });
  await avancar(0);
  await page.screenshot({ path: "/tmp/novo-boss-gif-escudo.png" });
  console.log("PASS: barreira usa os cinco quadros do escudo, escala e centro corretos; nenhum golpe é criado pela proteção.");

  assert.ok(await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { iniciarTeleporteNovoBoss } = await import("/js/enemies/novoBoss/NovoBossTeleporte.js");
    return iniciarTeleporteNovoBoss(scene, scene.novoBoss, "preventivo");
  }));
  await avancar(500);
  state = await snapshot();
  assert.equal(escudo(state).x, state.x);
  assert.equal(escudo(state).y, state.y + 16);
  assert.equal(state.sprites.filter(obj => obj.name === "novo-boss-escudo-energia").length, 1);
  await desligarGeradores();
  state = await snapshot();
  assert.equal(state.barreira, false);
  assert.equal(escudo(state).visible, false);
  console.log("PASS: escudo acompanha o teletransporte sem duplicar e desaparece quando os quatro geradores desligam.");

  await pertoDoPulso();
  const hp = (await snapshot()).vida;
  await avancar(1499);
  assert.equal((await snapshot()).explosoes, 0);
  assert.equal((await snapshot()).vida, hp);
  await avancar(1);
  state = await snapshot();
  assert.equal(explosao(state).frame, 0);
  assert.equal(explosao(state).key, "novo-boss-explosao");
  assert.equal(explosao(state).scale * 576, 620);
  assert.equal(explosao(state).originY, 0.5);
  assert.equal(escudo(state).visible, false);
  assert.equal(state.vida, hp);
  await avancar(450);
  state = await snapshot();
  assert.equal(state.estado, "vulneravel");
  assert.equal(state.vida, hp - 14);
  assert.equal(explosao(state).frame, 5);
  await avancar(30);
  assert.equal(explosao(await snapshot()).frame, 6);
  await page.screenshot({ path: "/tmp/novo-boss-gif-explosao.png" });
  await avancar(80);
  assert.equal(explosao(await snapshot()).frame, 7);
  await avancar(80);
  state = await snapshot();
  assert.equal(state.explosoes, 0);
  assert.equal(explosao(state), undefined);
  assert.equal(state.vida, hp - 14);
  console.log("PASS: explosão é outro sprite de diâmetro 620, começa após aviso de 1500 ms e percorre oito quadros, sem estender o dano de 450 ms.");

  await pertoDoPulso(); await avancar(1500);
  assert.equal((await snapshot()).explosoes, 1);
  await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.cancelarAtaque());
  assert.equal((await snapshot()).explosoes, 0);
  await pertoDoPulso(); await avancar(1500);
  await posicionar(-1093, -5350); await avancar(0);
  assert.equal((await snapshot()).explosoes, 0);
  await reiniciar();
  state = await snapshot();
  assert.ok(state.barreira && escudo(state).visible);
  assert.equal(state.sprites.length, 1);
  assert.equal(state.explosoes, 0);
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
  assert.deepEqual(sessao.consoleErrors, []);
  console.log("PASS: cancelamento, saída e reinício limpam as animações próprias; nenhum erro de JavaScript, console ou recursos.");
} catch (error) {
  console.error(await snapshot().catch(() => null));
  await page.screenshot({ path: "/tmp/novo-boss-gifs-falha.png" }).catch(() => {});
  throw error;
} finally { await sessao.fechar(); }
