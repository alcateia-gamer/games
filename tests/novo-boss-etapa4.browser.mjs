/**
 * Geradores e barreira no mapa, física, teclado e ponteiro reais do Phaser.
 * Execute serialmente com os outros roteiros de navegador para limitar memória.
 * PLAYWRIGHT_MODULE, PLAYWRIGHT_BROWSERS_PATH e BASE_URL seguem a etapa 3.
 */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = {
  ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  ilusoes: { ...novoBossConfig.ilusoes, ativo: false },
  clones: { ...novoBossConfig.clones, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar, retomar, pausar, reiniciar } = sessao;

const snapshot = () => page.evaluate(() => {
  const scene = window.__game.scene.getScene("Level1Parte2");
  const boss = scene.novoBoss;
  const barreira = scene.children.getByName("novo-boss-barreira");
  const escudo = scene.children.getByName("novo-boss-escudo-energia");
  return {
    estado: boss?.estado, vida: boss?.vida,
    barreiraAtiva: boss?.barreiraAtiva,
    sistema: boss?.sistemaGeradores?.snapshot() ?? null,
    geradores: (boss?.geradores ?? []).map(g => ({
      id: g.id, x: g.x, y: g.y, ligado: g.ligado,
      visible: g.visual.visible, bodyEnabled: g.body.enable,
      label: { visible: g.label.visible, text: g.label.text,
        interactive: g.label.input?.enabled },
    })),
    barreira: barreira ? { visible: barreira.visible, comandos: [...barreira.commandBuffer] } : null,
    escudo: escudo ? { visible: escudo.visible, texture: escudo.texture.key } : null,
    hud: boss?.hud?.textoEstado.text,
    listenersE: scene.input.keyboard.listenerCount("keydown-E"),
    player: { x: scene.player.x, y: scene.player.y,
      centroX: scene.player.body.center.x, centroY: scene.player.body.center.y,
      movimentoBloqueado: scene.movimentoBloqueado },
    factory: {
      luz: scene.luzFabricaAcesa,
      energiaPersistida: scene.game.registry.get("factoryGeneratorPowered"),
      menu: scene.generatorMenuOpen,
      inventario: scene.inventory.getSlots(),
      coletados: [...scene.inventory.state.collectedItemIds],
    },
    antigos: Boolean(scene.bossFinal),
    multiplayer: scene.multiplayer,
  };
});

async function estadoVulneravel() {
  const result = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    for (let i = 0; i < 1000; i++) {
      if (scene.novoBoss.estado === "vulneravel") return true;
      atualizarNovoBoss(scene, scene.time.now, 20);
    }
    return false;
  });
  assert.ok(result, "A janela de dano precisa ocorrer no controlador real.");
}

async function pressionarE() {
  await retomar();
  await page.keyboard.press("e");
  await page.waitForTimeout(100);
  await pausar();
  await avancar(0);
}

async function aproximarGerador(gerador) {
  const ponto = await page.evaluate(({ x, y }) => {
    const player = window.__game.scene.getScene("Level1Parte2").player;
    return { x: x - (player.body.center.x - player.x),
      y: y - 55 - (player.body.center.y - player.y) };
  }, gerador);
  await posicionar(ponto.x, ponto.y);
  await avancar(0);
}

try {
  let state = await snapshot();
  const factoryInicial = state.factory;
  const listenersIniciais = state.listenersE;
  assert.equal(state.geradores.length, 4);
  assert.equal(state.sistema.restantes, 4);
  assert.ok(state.geradores.every(g => g.ligado && g.visible && g.bodyEnabled));
  assert.ok(state.barreiraAtiva && state.barreira.visible && state.escudo.visible);
  assert.equal(state.escudo.texture, "novo-boss-escudo-energia");
  assert.equal(state.antigos, false);
  const posicoes = state.geradores.map(({ x, y }) => [x, y]);
  assert.deepEqual(posicoes, config.geradores.pontos.map(({ x, y }) => [x, y]));
  console.log("PASS: quatro geradores físicos próprios e barreira aparecem na arena correta.");

  const destinos = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { destinoValidoNovoBoss, areasSobrepostasNovoBoss } =
      await import("/js/enemies/novoBoss/NovoBossTeleporte.js");
    const { areaCorpoNovoBoss } = await import("/js/enemies/novoBoss/NovoBossConfig.js");
    return scene.novoBoss.config.teleporte.pontos.map(ponto => ({
      ponto, livre: destinoValidoNovoBoss(scene, scene.novoBoss, ponto),
      semGerador: scene.novoBoss.geradores.every(g =>
        !areasSobrepostasNovoBoss(areaCorpoNovoBoss(scene.novoBoss.config, ponto), g.body)),
    }));
  });
  assert.equal(destinos.length, 4);
  assert.ok(destinos.every(item => item.livre && item.semGerador));
  await estadoVulneravel();
  const negado = await page.evaluate(() => {
    const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
    return { vida: boss.vida, aceito: boss.receberDano(25) };
  });
  assert.equal(negado.aceito, false);
  assert.equal((await snapshot()).vida, negado.vida);
  console.log("PASS: geradores preservam os quatro destinos e a barreira impede dano mesmo na abertura.");

  const primeiros = state.geradores.slice(0, 3);
  for (let i = 0; i < primeiros.length; i++) {
    const g = primeiros[i];
    await aproximarGerador(g);
    state = await snapshot();
    assert.equal(state.sistema.proximo, g.id);
    assert.ok(state.geradores.find(item => item.id === g.id).label.visible);
    await pressionarE();
    state = await snapshot();
    assert.equal(state.sistema.restantes, 3 - i,
      "Uma tecla E deve desligar exatamente um gerador.");
    assert.equal(state.geradores.find(item => item.id === g.id).ligado, false);
    assert.ok(state.barreiraAtiva, "A proteção precisa permanecer com qualquer gerador ligado.");
    assert.deepEqual(state.factory, factoryInicial,
      "Interagir com o encontro não deve consumir itens nem alterar o gerador da fábrica.");
  }
  console.log("PASS: E real desliga um gerador por vez e preserva iluminação, inventário e gerador industrial.");

  await posicionar(-1093, -5520);
  await avancar(0);
  await estadoVulneravel();
  assert.equal(await page.evaluate(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(25)), false,
  "O último gerador ligado ainda deve impedir dano.");
  await posicionar(-1093, -5350);
  await avancar(0);
  state = await snapshot();
  assert.ok(state.geradores.every(g => !g.visible && !g.bodyEnabled && !g.label.visible));
  assert.equal(state.barreira.visible, false);
  await posicionar(-1093, -5520);
  await avancar(0);
  state = await snapshot();
  assert.equal(state.sistema.restantes, 1);
  assert.equal(state.geradores.filter(g => !g.ligado).length, 3);
  assert.equal(state.listenersE, listenersIniciais);
  console.log("PASS: sair oculta e desabilita os objetos; voltar preserva os geradores desligados sem duplicar eventos.");

  const ultimo = state.geradores.find(g => g.ligado);
  await aproximarGerador(ultimo);
  await retomar();
  const ponto = await page.evaluate(id => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const label = scene.novoBoss.geradores.find(g => g.id === id).label;
    const bounds = label.getBounds();
    const camera = scene.cameras.main;
    const canvas = scene.game.canvas;
    const rect = canvas.getBoundingClientRect();
    return {
      visible: label.visible, interactive: label.input?.enabled,
      x: rect.left + (camera.x + (bounds.centerX - camera.scrollX * label.scrollFactorX) * camera.zoomX +
        camera.width * camera.originX * (1 - camera.zoomX)) * rect.width / canvas.width,
      y: rect.top + (camera.y + (bounds.centerY - camera.scrollY * label.scrollFactorY) * camera.zoomY +
        camera.height * camera.originY * (1 - camera.zoomY)) * rect.height / canvas.height,
    };
  }, ultimo.id);
  assert.ok(ponto.visible && ponto.interactive);
  assert.ok(ponto.x >= 0 && ponto.x <= 1280 && ponto.y >= 0 && ponto.y <= 720);
  await page.mouse.click(ponto.x, ponto.y);
  await page.waitForFunction(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.barreiraAtiva === false);
  await pausar();
  await avancar(0);
  state = await snapshot();
  assert.equal(state.sistema.restantes, 0);
  assert.equal(state.barreiraAtiva, false);
  assert.equal(state.barreira.visible, false);
  assert.deepEqual(state.factory, factoryInicial);
  console.log("PASS: clique real no aviso desliga o último gerador e derruba a barreira.");

  await estadoVulneravel();
  const dano = await page.evaluate(() => {
    const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
    const antes = boss.vida;
    const aceito = boss.receberDano(25);
    return { aceito, reducao: antes - boss.vida };
  });
  assert.ok(dano.aceito);
  assert.equal(dano.reducao, 25);
  console.log("PASS: desligar os quatro geradores libera o dano normal na janela vulnerável.");

  await reiniciar();
  state = await snapshot();
  assert.equal(state.sistema.restantes, 4);
  assert.equal(state.listenersE, listenersIniciais);
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    window.__geradoresAntesReinicioEtapa4 = scene.novoBoss.geradores.map(g => ({
      visual: g.visual, nucleo: g.nucleo, label: g.label, body: g.body,
    }));
    scene.morteEmAndamento = true;
  });
  await avancar(0);
  state = await snapshot();
  assert.ok(state.geradores.every(g => !g.visible && !g.bodyEnabled && !g.label.visible));
  assert.equal(state.barreira.visible, false);
  await reiniciar();
  state = await snapshot();
  assert.equal(state.sistema.restantes, 4);
  assert.equal(state.listenersE, listenersIniciais);
  assert.ok(await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const antigos = window.__geradoresAntesReinicioEtapa4;
    const visuais = antigos.map(g => g.visual);
    return antigos.every(g => !g.visual.scene && !g.nucleo.scene && !g.label.scene &&
      (!g.body.enable || !g.body.world)) &&
      !scene.physics.world.colliders.getActive().some(collider =>
        visuais.includes(collider.object1) || visuais.includes(collider.object2));
  }), "O reinício precisa destruir objetos, corpos e colisores da visita anterior.");
  console.log("PASS: morrer oculta a arena; reiniciar restaura quatro geradores e remove recursos/colisores anteriores.");

  await page.screenshot({ path: process.env.NOVO_BOSS_SCREENSHOT ?? "/tmp/novo-boss-etapa4.png" });
  await reiniciar({ multiplayer: true });
  state = await snapshot();
  assert.ok(state.multiplayer);
  assert.deepEqual(state.geradores, []);
  assert.equal(state.sistema, null);
  assert.equal(state.barreiraAtiva, false);
  assert.equal(state.barreira, null);
  assert.equal(state.listenersE, listenersIniciais - 1);
  const multiplayer = await page.evaluate(() => {
    const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
    return { aceito: boss.receberDano(25), vida: boss.vida, relogio: boss.relogioCombate };
  });
  await avancar(10000);
  assert.equal(multiplayer.aceito, false);
  assert.equal((await snapshot()).vida, multiplayer.vida);
  assert.equal(await page.evaluate(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.relogioCombate), multiplayer.relogio);
  console.log("PASS: o multiplayer atual não ganha geradores, barreira ou combate local não sincronizado.");

  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
} catch (error) {
  console.error("Estado na falha:", await snapshot().catch(() => null));
  console.error("Erros JavaScript:", sessao.errors, "Falhas de recursos:", sessao.assetErrors);
  await page.screenshot({ path: "/tmp/novo-boss-etapa4-falha.png" }).catch(() => {});
  throw error;
} finally {
  await sessao.fechar();
}
