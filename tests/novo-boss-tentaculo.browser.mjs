/** Tentáculo RGBA e agarrão separado no Phaser real, mantendo a contenção atual. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = { ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, automatico: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar } = sessao;
const snapshot = () => page.evaluate(() => {
  const scene = window.__game.scene.getScene("Level1Parte2");
  return { vida: scene.vida, restricao: scene.restricaoControleNovoBoss ?? null,
    ataque: scene.novoBoss.ataqueAtual?.snapshot() ?? null,
    visuais: scene.children.list.filter(o => o.active && o.novoBossTentaculoVisual).map(o => ({
      visivel: o.visible, chave: o.texture.key, frame: o.frame.name,
      segurando: o.novoBossTentaculoSegurando, corpo: Boolean(o.body),
      ilusorio: Boolean(o.novoBossAtaqueIlusorio), alpha: o.alpha,
    })) };
});
const iniciar = () => page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.executarAtaque("tentaculos"));

try {
  const validacao = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { criarVisualTentaculo } = await import("/js/enemies/novoBoss/NovoBossTentaculoVisual.js");
    const v = criarVisualTentaculo(scene, -1200, -5800, 18);
    if (!v) throw new Error("Atlas não carregado.");
    let frames = 0;
    for (let i = 0; i <= 140; i++) {
      v.atualizar({ idade: i * 40, visivel: true, x: -1200, y: -5800 });
      if (v.sprite.frame.name !== `tentaculo-${String(i % 140).padStart(3, "0")}`) throw new Error("Ordem de quadros mudou.");
      if (v.sprite.width !== 800 || v.sprite.height !== 600) throw new Error("Atlas alterou a resolução lógica.");
      if (Math.abs(v.sprite.displayOriginX - 400) > 0.001 || Math.abs(v.sprite.displayOriginY - 495) > 0.001) throw new Error("A base mudou de origem.");
      if (v.sprite.body) throw new Error("O visual não deve ter física.");
      frames++;
    }
    v.destruir();
    const texture = scene.textures.get("novo-boss-tentaculo"), frame = texture.get("tentaculo-025");
    const canvas = document.createElement("canvas"); canvas.width = frame.cutWidth; canvas.height = frame.cutHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(texture.getSourceImage(), frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight, 0, 0, frame.cutWidth, frame.cutHeight);
    const dados = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let parciais = 0, residuais = 0;
    for (let i = 0; i < dados.length; i += 4) {
      if (dados[i + 3] > 0 && dados[i + 3] < 255) parciais++;
      if (dados[i + 3] > 10 && (dados[i] < dados[i + 1] || dados[i] < dados[i + 2])) residuais++;
    }
    return { frames, parciais, residuais };
  });
  assert.equal(validacao.frames, 141); assert.ok(validacao.parciais > 0); assert.equal(validacao.residuais, 0);
  console.log("PASS: 140 poses, 40 ms por quadro, loop, resolução lógica 800×600 e base fixa; atlas preserva alfa parcial e não contém verde/roxo residual.");

  await posicionar(-1093, -5520); assert.ok(await iniciar());
  await avancar(999); let s = await snapshot();
  assert.equal(s.restricao, null); assert.ok(s.visuais.length > 0 && s.visuais.every(v => !v.visivel));
  const vidaAntes = s.vida;
  await avancar(1); s = await snapshot();
  assert.equal(s.restricao?.restanteMs, 2500);
  assert.ok(s.visuais.some(v => v.visivel && v.segurando && v.chave === "novo-boss-tentaculo-agarrao"));
  await avancar(400); s = await snapshot();
  assert.equal(s.restricao?.restanteMs, 2100); assert.equal(s.vida, vidaAntes);
  assert.ok(s.visuais.some(v => v.segurando && Number(v.frame.slice(-3)) >= 8));
  assert.ok(await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const grip = scene.children.list.find(o => o.active && o.novoBossTentaculoVisual && o.novoBossTentaculoSegurando);
    return grip && Math.abs(grip.y - scene.hitboxDanoPlayer.centerY) < 0.001 &&
      Math.abs(grip.x - scene.hitboxDanoPlayer.centerX) < 0.001 &&
      Math.abs(grip.scaleY * 352 - scene.hitboxDanoPlayer.height * 1.35) < 0.001;
  }), "O agarrão envolve o corpo do jogador, sem flutuar acima dele.");
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.cameras.main.stopFollow().setZoom(1.5).centerOn(scene.player.x, scene.player.y - 30);
  });
  await page.screenshot({ path: "/tmp/novo-boss-tentaculo/agarrao-no-jogo.png" });
  await avancar(2099); assert.ok((await snapshot()).restricao);
  await avancar(1); s = await snapshot();
  assert.equal(s.restricao, null); assert.equal(s.vida, vidaAntes);
  assert.ok(s.visuais.filter(v => v.segurando).every(v => !v.visivel));
  await avancar(1000); assert.equal((await snapshot()).visuais.length, 0);
  console.log("PASS: aviso não captura; agarrão fecha e sustenta o jogador por 2500 ms, sem dano, e libera/limpa os sprites.");

  await sessao.reiniciar(); await posicionar(-1093, -5520); assert.ok(await iniciar());
  await posicionar(-590, -5520); await avancar(1400); s = await snapshot();
  assert.equal(s.restricao, null);
  assert.ok(s.visuais.some(v => v.visivel && v.chave === "novo-boss-tentaculo"));
  assert.ok(s.visuais.every(v => !v.corpo && !v.segurando));
  await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").novoBoss.cancelarAtaque(); });
  assert.equal((await snapshot()).visuais.length, 0);
  console.log("PASS: esquivar mantém o movimento original do tentáculo; cancelar remove os visuais sem capturar.");

  await sessao.reiniciar(); await posicionar(-1093, -5520);
  assert.ok(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.iniciarClones()));
  assert.ok(await iniciar()); await posicionar(-590, -5520); await avancar(1400);
  s = await snapshot(); const falsos = s.visuais.filter(v => v.ilusorio);
  assert.ok(falsos.length > 0 && falsos.every(v => !v.corpo && !v.segurando && v.alpha === 0.32));
  assert.equal(s.restricao, null);
  await posicionar(-1093, -5350); await avancar(0);
  assert.equal((await snapshot()).visuais.length, 0);
  console.log("PASS: cópias animadas sem física ou contenção; saída da arena remove os efeitos próprios.");
  assert.deepEqual(sessao.errors, []); assert.deepEqual(sessao.assetErrors, []); assert.deepEqual(sessao.consoleErrors, []);
} catch (error) {
  console.error("Estado:", await snapshot().catch(() => null));
  throw error;
} finally { await sessao.fechar(); }
