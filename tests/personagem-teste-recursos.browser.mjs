/** Verifica a reversão do pacote de recursos sem apagar os arquivos preservados. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
const config = { ...novoBossConfig, cenaEntrada: { ...novoBossConfig.cenaEntrada, ativo: false }, ataques: { ...novoBossConfig.ataques, automatico: false },
  geradores: { ...novoBossConfig.geradores, ativo: false }, fase2: { ...novoBossConfig.fase2, ativo: false },
  teleporte: { ...novoBossConfig.teleporte, preventivoMs: 600000 } };
const sessao = await abrirSessaoNovoBoss(config, { personagem: "personagem-teste" });
const { page } = sessao;
try {
  await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").hudStatus?.active);
  const inicial = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2"), c = s.cameras.main;
    const { atualizarStatusPlayer } = await import("/js/player/PlayerStatus.js");
    const { atacar } = await import("/js/player/Player.js");
    const { iniciarDash } = await import("/js/controls/PlayerDashControls.js");
    const ox = c.width * c.originX, oy = c.height * c.originY;
    const interfaceAntiga = { botoes: Boolean(s.botoesRecuperacaoTeste), custo: Boolean(s.textoCustoArmaTeste),
      numeros: s.hudStatus.ultimoDesenho.numeros,
      devX: ox + (s.botaoDesenvolvedor.x - ox) * c.zoomX,
      devY: oy + (s.botaoDesenvolvedor.y - oy) * c.zoomY,
      esperadoX: c.width - 40, esperadoY: s.minimap.devScreenY };
    s.vida = 50; s.estamina = 40; s.tempoSemDano = 4000;
    atualizarStatusPlayer(s, 1000);
    const regeneracao = { vida: s.vida, stamina: s.estamina };
    s.estamina = 2;
    const ataque = { iniciou: atacar(s), stamina: s.estamina };
    const semSaldo = iniciarDash(s);
    s.estamina = 100;
    const dash = { iniciou: iniciarDash(s), stamina: s.estamina };
    return { interfaceAntiga, regeneracao, ataque, semSaldo, dash,
      toxinas: s.inventory.getQuantity("toxina-de-cura"),
      comprimidos: s.inventory.getQuantity("comprimidos-de-desempenho") };
  });
  assert.equal(inicial.interfaceAntiga.botoes, false); assert.equal(inicial.interfaceAntiga.custo, false);
  assert.ok(!inicial.interfaceAntiga.numeros);
  assert.ok(Math.abs(inicial.interfaceAntiga.devX - inicial.interfaceAntiga.esperadoX) < 0.01);
  assert.ok(Math.abs(inicial.interfaceAntiga.devY - inicial.interfaceAntiga.esperadoY) < 0.01);
  assert.deepEqual(inicial.regeneracao, { vida: 54, stamina: 58 });
  assert.deepEqual(inicial.ataque, { iniciou: true, stamina: 2 });
  assert.equal(inicial.semSaldo, false); assert.deepEqual(inicial.dash, { iniciou: true, stamina: 75 });
  assert.equal(inicial.toxinas, 0); assert.equal(inicial.comprimidos, 0);
  console.log("PASS: regeneração, armas e interface anteriores restauradas; dash custa 25 e itens não são concedidos.");

  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.inventory.addItem("sucata", 2);
    s.inventory.markCollected("regressao-recursos-revertidos");
    // Simula os estoques deixados por uma sessão da versão anterior, sem renderizá-los.
    s.inventory.state.slots.push({ itemId: "toxina-de-cura", quantity: 1 },
      { itemId: "comprimidos-de-desempenho", quantity: 3 });
    s.game.registry.set("personagem-teste-recursos", { vida: 10, estamina: 0 });
  });
  await sessao.reiniciar();
  const migracao = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    return { sucata: s.inventory.getQuantity("sucata"), toxina: s.inventory.getQuantity("toxina-de-cura"),
      comprimidos: s.inventory.getQuantity("comprimidos-de-desempenho"),
      coleta: s.inventory.hasCollected("regressao-recursos-revertidos"), vida: s.vida, stamina: s.estamina };
  });
  assert.deepEqual(migracao, { sucata: 2, toxina: 0, comprimidos: 0, coleta: true, vida: 100, stamina: 100 });
  console.log("PASS: estoque legado dos dois itens removido sem afetar sucata/histórico; estado de recursos do pacote é ignorado.");
  await mkdir("/tmp/pacote-recursos-revertido", { recursive: true });
  await page.screenshot({ path: "/tmp/pacote-recursos-revertido/hud.png" });
  assert.deepEqual(sessao.errors, []); assert.deepEqual(sessao.assetErrors, []); assert.deepEqual(sessao.consoleErrors, []);
  console.log("PASS: reinício sem erros JavaScript, assets ou console.");
} finally { await sessao.fechar(); }
