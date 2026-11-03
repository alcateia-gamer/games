/** Integração com o jogo: andar de costas, mirar, disparar e sair/voltar de cena. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
const pasta = process.env.ARMAS_CAPTURAS ?? "/tmp/encaixe-armas/browser";
await mkdir(pasta, { recursive: true });
const config = { ...novoBossConfig, ataques: { ...novoBossConfig.ataques, automatico: false },
  geradores: { ...novoBossConfig.geradores, ativo: false }, fase2: { ...novoBossConfig.fase2, ativo: false } };
const sessao = await abrirSessaoNovoBoss(config, { personagem: "personagem-teste-2" });
const { page } = sessao;
try {
  await sessao.posicionar(-900, -5700);
  assert.equal(await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { trocarArmaPersonagemTeste } = await import("/js/player/ArmaPersonagemTeste.js");
    trocarArmaPersonagemTeste(s); trocarArmaPersonagemTeste(s);
    return s.armaPersonagemTeste.config.id;
  }), "rifle-teste");
  await sessao.retomar();
  const antes = await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").player.x);
  await page.keyboard.down("d");
  await page.waitForTimeout(350);
  const andando = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2"), e = s.armaPersonagemTeste;
    return { x: s.player.x, velocidade: s.player.body.velocity.x, esquerda: s.player.flipX,
      animacao: s.player.anims.currentAnim?.key, socket: e.pose.socket, mao: e.pose.mao,
      alvo: Boolean(e.alvo), frame: s.player.frame.name };
  });
  assert.ok(andando.x > antes); assert.ok(andando.velocidade > 0);
  assert.ok(andando.alvo); assert.equal(andando.esquerda, true);
  assert.equal(andando.animacao, "walk-right");
  assert.equal(andando.socket.animacao, "walk");
  assert.ok(andando.frame >= 0 && andando.frame < 16);
  assert.ok(Math.hypot(andando.mao.x - andando.socket.x, andando.mao.y - andando.socket.y) < 0.001);
  assert.ok(await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { dispararLaserPersonagemTeste } = await import("/js/player/ArmaPersonagemTeste.js");
    const ok = dispararLaserPersonagemTeste(s), e = s.armaPersonagemTeste;
    const l = e.lasers.at(-1);
    return ok && l && Math.hypot(l.sprite.x - e.pose.cano.x, l.sprite.y - e.pose.cano.y) < 0.001;
  }));
  await page.keyboard.up("d");
  await sessao.pausar();
  console.log("PASS: WASD move para a direita enquanto mira/espelha para a boss à esquerda; 16 quadros de walk e tiro no cano permanecem integrados.");
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.cameras.main.stopFollow().setZoom(2.5).centerOn(s.player.x, s.player.y);
    s.debugEncaixeArmas = true;
  });
  for (const id of ["rifle-teste", "dourada-teste", "espada-teste", "florete-teste"]) {
    await page.evaluate(async id => {
      const s = window.__game.scene.getScene("Level1Parte2");
      const { trocarArmaPersonagemTeste, atualizarArmaPersonagemTeste } = await import("/js/player/ArmaPersonagemTeste.js");
      while (s.armaPersonagemTeste.config.id !== id) {
        if (!trocarArmaPersonagemTeste(s)) throw new Error("Troca bloqueada.");
      }
      atualizarArmaPersonagemTeste(s, 0);
      s.children.depthSort();
    }, id);
    const f = await page.evaluate(() => window.__game.loop.frame);
    await page.waitForFunction(f => window.__game.loop.frame > f + 2, f);
    await page.screenshot({ path: `${pasta}/jogo-${id}.png` });
  }
  const objetos = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2"), e = s.armaPersonagemTeste;
    window.__armasAnteriores = [e.sprite, e.maoSobreArma, e.debugEncaixe, e.clarao];
    return window.__armasAnteriores.every(o => o?.active);
  });
  assert.ok(objetos);
  await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").debugEncaixeArmas = false; });
  await sessao.reiniciar();
  assert.ok(await page.evaluate(() => window.__armasAnteriores.every(o => !o.active)));
  assert.ok(await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    return s.armaPersonagemTeste && !s.armaPersonagemTeste.debugEncaixe;
  }));
  assert.deepEqual(sessao.errors, []); assert.deepEqual(sessao.assetErrors, []);
  console.log("PASS: quatro armas renderizam no mapa real; reinício destrói arma, palma, clarão e debug; modo normal não cria overlay de debug.");
} finally { await sessao.fechar(); }
