/** Recursos, inventário e HUD com cliques reais no protótipo. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
const config = { ...novoBossConfig, ataques: { ...novoBossConfig.ataques, automatico: false },
  geradores: { ...novoBossConfig.geradores, ativo: false }, fase2: { ...novoBossConfig.fase2, ativo: false },
  teleporte: { ...novoBossConfig.teleporte, preventivoMs: 600000 } };
const sessao = await abrirSessaoNovoBoss(config, { personagem: "personagem-teste-2" });
const { page, retomar, pausar } = sessao;
const ler = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("Level1Parte2");
  return { vida: s.vida, stamina: s.estamina, vidaMax: s.vidaMaxima, staminaMax: s.estaminaMaxima,
    arma: s.armaPersonagemTeste?.config.id, custo: s.textoCustoArmaTeste?.text,
    toxinas: s.inventory.getQuantity("toxina-de-cura"), comprimidos: s.inventory.getQuantity("comprimidos-de-desempenho"),
    golpe: Boolean(s.armaPersonagemTeste?.golpeEspada || s.armaPersonagemTeste?.estocada),
    tiros: s.armaPersonagemTeste?.lasers.length, numeros: s.hudStatus?.ultimoDesenho?.numeros,
    botoes: s.botoesRecuperacaoTeste?.map(b => ({ id: b.item.id, quantidade: b.quantidade.text })) };
});
async function clicar(nome) {
  const ponto = await page.evaluate(nome => {
    const s = window.__game.scene.getScene("Level1Parte2"), c = s.cameras.main;
    const obj = nome === "ataque" ? s.botaoAtaque : nome === "troca" ? s.botaoTrocaArma
      : s.botoesRecuperacaoTeste.find(b => b.item.id === nome).botao;
    const r = s.game.canvas.getBoundingClientRect();
    const ox = c.width * c.originX, oy = c.height * c.originY;
    return { x: r.left + (ox + (obj.x - ox) * c.zoomX) * r.width / s.game.scale.width,
      y: r.top + (oy + (obj.y - oy) * c.zoomY) * r.height / s.game.scale.height };
  }, nome);
  await page.mouse.click(ponto.x, ponto.y);
  await page.waitForTimeout(70);
}
try {
  await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").hudStatus?.active);
  let s = await ler();
  assert.equal(s.vidaMax, 100); assert.equal(s.staminaMax, 100);
  assert.equal(s.vida, 100); assert.equal(s.stamina, 100);
  assert.equal(s.toxinas, 1); assert.equal(s.comprimidos, 1); assert.equal(s.custo, "1");
  assert.equal(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").inventoryUI.container.list.length), 0,
    "Atalhos substituem a exibição duplicada dos consumíveis na faixa inferior.");
  assert.equal(s.numeros, "100 / 100|100 / 100");
  await retomar();
  await clicar("toxina-de-cura"); assert.equal((await ler()).toxinas, 1, "Barra cheia não desperdiça item.");
  await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2"); s.vida = 50; s.estamina = 40;
    const { atualizarStatusPlayer } = await import("/js/player/PlayerStatus.js");
    atualizarStatusPlayer(s, 60000);
  });
  s = await ler(); assert.equal(s.vida, 50); assert.equal(s.stamina, 40);
  await clicar("toxina-de-cura"); s = await ler();
  assert.equal(s.vida, 70); assert.equal(s.stamina, 40); assert.equal(s.toxinas, 0); assert.equal(s.golpe, false);
  await clicar("toxina-de-cura"); assert.equal((await ler()).vida, 70);
  await clicar("comprimidos-de-desempenho"); s = await ler();
  assert.equal(s.stamina, 70); assert.equal(s.comprimidos, 0); assert.equal(s.golpe, false);
  assert.equal(s.numeros, "70 / 100|70 / 100");
  console.log("PASS: 100/100, sem regeneração, itens +20/+30, quantidades e proteção contra desperdício.");
  await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").estamina = 100; });
  for (const custo of [1, 1, 3, 1]) {
    const antes = await ler(); assert.equal(antes.custo, String(custo));
    await clicar("ataque"); s = await ler(); assert.equal(s.stamina, antes.stamina - custo, antes.arma);
    if (custo === 3) {
      await clicar("ataque"); assert.equal((await ler()).stamina, s.stamina, "Cadência recusa um segundo tiro sem gastar.");
    }
    await page.waitForFunction(() => {
      const a = window.__game.scene.getScene("Level1Parte2").armaPersonagemTeste;
      return !a.golpeEspada && !a.estocada;
    });
    await page.waitForTimeout(250);
    await clicar("troca");
  }
  await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").estamina = 0; });
  await clicar("ataque"); s = await ler(); assert.equal(s.stamina, 0); assert.equal(s.golpe, false);
  console.log("PASS: quatro armas cobram 1/1/3/1, indicador acompanha a troca; saldo zero bloqueia ataque.");
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2"); s.vida = 70; s.estamina = 30;
    s.inventory.addItem("toxina-de-cura", 2); s.inventory.addItem("comprimidos-de-desempenho", 3);
  });
  await page.waitForTimeout(100);
  await mkdir("/tmp/personagem-teste-recursos", { recursive: true });
  await page.screenshot({ path: "/tmp/personagem-teste-recursos/hud.png" });
  const transparencias = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    return ["toxina-de-cura", "comprimidos-de-desempenho"].map(id => {
      const imagem = s.textures.get(`inventory-${id}-icon`).getSourceImage();
      const c = document.createElement("canvas"); c.width = imagem.width; c.height = imagem.height;
      const ctx = c.getContext("2d"); ctx.drawImage(imagem, 0, 0);
      const a = ctx.getImageData(0, 0, c.width, c.height).data;
      let transparentes = 0, brancos = 0, cor = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i + 3] === 0) transparentes++;
        else { if (a[i] > 230 && a[i + 1] > 230 && a[i + 2] > 230) brancos++;
          if (Math.max(a[i], a[i + 1], a[i + 2]) - Math.min(a[i], a[i + 1], a[i + 2]) > 70) cor++; }
      }
      return { id, cantos: [0, (c.width - 1) * 4, (c.height - 1) * c.width * 4].map(i => a[i + 3]), transparentes, brancos, cor };
    });
  });
  for (const t of transparencias) {
    assert.ok(t.cantos.every(a => a === 0)); assert.ok(t.transparentes > 1000);
    assert.ok(t.brancos > 100); assert.ok(t.cor > 1000);
  }
  console.log("PASS: PNGs com transparência real, interiores brancos e cores preservados.");
  await pausar(); await sessao.reiniciar(); s = await ler();
  assert.equal(s.vida, 70); assert.equal(s.stamina, 30); assert.equal(s.toxinas, 2); assert.equal(s.comprimidos, 3);
  console.log("PASS: reiniciar/trocar de sala não recarrega barras nem duplica itens iniciais.");
  await sessao.reiniciar({ personagem: "kai-mercer" });
  const original = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2"); s.vida = 50; s.estamina = 40;
    const { atualizarStatusPlayer } = await import("/js/player/PlayerStatus.js"); atualizarStatusPlayer(s, 60000);
    return { vida: s.vida, estamina: s.estamina, botoes: s.botoesRecuperacaoTeste,
      custo: s.textoCustoArmaTeste, numeros: s.hudStatus.ultimoDesenho.numeros };
  });
  assert.equal(original.vida, 100); assert.equal(original.estamina, 100);
  assert.ok(!original.botoes); assert.ok(!original.custo); assert.equal(original.numeros, "");
  assert.deepEqual(sessao.errors, []); assert.deepEqual(sessao.assetErrors, []); assert.deepEqual(sessao.consoleErrors, []);
  console.log("PASS: personagem original mantém regeneração e HUD anteriores; nenhum erro no navegador.");
} catch (error) { console.error("Estado:", await ler().catch(() => null)); throw error; }
finally { await sessao.fechar(); }
