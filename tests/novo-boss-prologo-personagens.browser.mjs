/** Ataques reais dos quatro personagens, toque em viewport mobile e morte adiada. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const sessao = await abrirSessaoNovoBoss({ ...novoBossConfig,
  cenaEntrada: { ...novoBossConfig.cenaEntrada, ativo: false },
}, {}, { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
const { page, posicionar, avancar } = sessao;
page.on("pageerror", e => console.error(e.stack));
const relatorio = [];
async function estado() {
  return page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.prologo.estado);
}
async function expor() {
  for (let i = 0; i < 200; i++) {
    if (await estado() === "GERADORES_EXPOSTOS") return;
    await page.evaluate(async () => {
      const s = window.__game.scene.getScene("Level1Parte2");
      const { causarDanoInimigo } = await import("/js/enemies/EnemyHealth.js");
      for (const r of s.inimigos.filter(r => r.prologoEncontroId && !r.morto)) causarDanoInimigo(s, r, r.vida);
    });
    await avancar(200);
  }
  throw Error(`Exposição não alcançada: ${await estado()}`);
}
async function simularAtaque() {
  await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    const { atualizarProjeteis } = await import("/js/player/PlayerProjectiles.js");
    const { atualizarSistemaEspeciais } = await import("/js/combat/PlayerSpecialAbilities.js");
    for (let ms = 0; ms < 800; ms += 20) {
      s.time.preUpdate(); s.time.update(s.time.now + 20, 20);
      s.player.anims.update(s.time.now, 20);
      atualizarNovoBoss(s, s.time.now, 20);
      atualizarProjeteis(s, 20); atualizarSistemaEspeciais(s);
    }
  });
}
async function tocarAtaque() {
  await sessao.retomar();
  const ponto = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2"), c = s.cameras.main, b = s.botaoAtaque;
    c.preRender();
    const x = c.width * c.originX + (b.x - c.width * c.originX) * c.zoomX;
    const y = c.height * c.originY + (b.y - c.height * c.originY) * c.zoomY;
    const canvas = s.game.canvas.getBoundingClientRect();
    return { x: canvas.left + x * canvas.width / s.scale.gameSize.width,
      y: canvas.top + y * canvas.height / s.scale.gameSize.height };
  });
  await page.touchscreen.tap(ponto.x, ponto.y);
  await page.waitForTimeout(150);
  await sessao.pausar();
}
try {
  for (const personagem of ["kai-mercer", "magnus-force", "aria-kade", "nyx"]) {
    console.log("TEST personagem", personagem);
    if (personagem !== "kai-mercer") await sessao.reiniciar({ personagem });
    await expor();
    console.log("TEST torres expostas", personagem);
    const alvo = await page.evaluate(() => {
      const s = window.__game.scene.getScene("Level1Parte2"), t = s.novoBoss.geradores[0];
      s.direcaoAtual = "up";
      return { x: t.x, y: t.hitboxDano.y + t.hitboxDano.height + 15, vida: t.vida };
    });
    await posicionar(alvo.x, alvo.y);
    await tocarAtaque();
    console.log("TEST toque entregue", personagem);
    await simularAtaque();
    const depois = await page.evaluate(() => {
      const s = window.__game.scene.getScene("Level1Parte2");
      return { vida: s.novoBoss.geradores[0].vida, stamina: s.estamina, atacando: s.atacando };
    });
    assert.ok(depois.vida < alvo.vida, `${personagem} deve atingir a torre pelo botão touch real: ${JSON.stringify(depois)}`);
    // Especial de Magnus usa a mesma base, sem ser bloqueado pela colisão da própria torre.
    if (personagem === "magnus-force") {
      const antes = depois.vida;
      await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").botaoEspecial.emit("pointerdown"));
      await simularAtaque();
      assert.equal(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.geradores[0].vida), antes - 8);
    }
    await page.evaluate(() => {
      const s = window.__game.scene.getScene("Level1Parte2");
      s.novoBoss.geradores[0].receberDano(1000);
    });
    await avancar(1800);
    assert.equal(await estado(), "BOSS_VULNERAVEL");
    const boss = await page.evaluate(() => {
      const e = window.__game.scene.getScene("Level1Parte2").novoBoss;
      return { x: e.x, y: e.hitboxDano.y + e.hitboxDano.height + 15, vida: e.vida };
    });
    await posicionar(boss.x, boss.y);
    await tocarAtaque(); await simularAtaque();
    const dano = await page.evaluate(() => {
      const e = window.__game.scene.getScene("Level1Parte2").novoBoss;
      return { vida: e.vida, ...e.prologo.snapshot() };
    });
    assert.ok(dano.vida < boss.vida, `${personagem} deve atingir o boss: ${JSON.stringify(dano)}`);
    assert.equal(dano.impactos, 1, `${personagem}: um golpe não pode consumir duas oportunidades`);
    relatorio.push({ personagem, torreAntes: alvo.vida, torreDepois: depois.vida,
      vidaBossAntes: boss.vida, vidaBossDepois: dano.vida, impactos: dano.impactos });
    console.log("PASS personagem", personagem, "torre", depois.vida, "boss", dano.vida);
  }
  // O excedente de um golpe não pode matar a entidade antes do quarto gerador.
  await avancar(250);
  assert.equal(await page.evaluate(() => {
    const e = window.__game.scene.getScene("Level1Parte2").novoBoss;
    return e.receberDano(5000, null, {});
  }), true);
  assert.ok(await page.evaluate(() => {
    const e = window.__game.scene.getScene("Level1Parte2").novoBoss;
    return e.vida === 1 && !e.morto && e.danoAdiadoPrologo > 0 && e.fase === 1;
  }));
  for (let ciclo = 2; ciclo <= 4; ciclo++) {
    await posicionar(-1093, -5520); await avancar(1400); await expor();
    await page.evaluate(() => {
      const e = window.__game.scene.getScene("Level1Parte2").novoBoss;
      e.geradores.find(g => g.active).receberDano(1000);
    });
    await avancar(1800);
    if (ciclo < 4) {
      assert.equal(await estado(), "BOSS_VULNERAVEL");
      await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(1, null, {}));
      await avancar(250);
      await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(1, null, {}));
    }
  }
  assert.equal(await estado(), "COMBATE_PRINCIPAL");
  assert.ok(await page.evaluate(() => {
    const e = window.__game.scene.getScene("Level1Parte2").novoBoss;
    if (e.vida !== 1 || e.fase !== 2 || e.morto || e.danoAdiadoPrologo <= 0) return false;
    const corpos = e.geradores.flatMap(t => t.colisaoMapa.corpos);
    e.receberDano(1);
    return e.morto && e.danoAdiadoPrologo === 0 && corpos.every(b => !b.enable) && e.sprite.visible;
  }), "excedente preservado é aplicado no primeiro golpe principal, sem restaurar paredes invisíveis");
  assert.deepEqual(sessao.errors, []); assert.deepEqual(sessao.assetErrors, []);
  mkdirSync("/tmp/novo-boss-prologo", { recursive: true });
  writeFileSync("/tmp/novo-boss-prologo/personagens.json", JSON.stringify(relatorio, null, 2));
  console.log("PASS mobile e quatro personagens:", JSON.stringify(relatorio));
} finally { await sessao.fechar(); }
