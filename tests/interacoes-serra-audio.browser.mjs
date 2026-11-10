/** Verifica MP3 decodificados, coleta e ataque com sprites/animações/som reais do Phaser. */
import assert from "node:assert/strict";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

const session = await abrirSessaoNovoBoss({ ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
});
const { page } = session;
try {
  const pickup = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    for (const key of ["colocando-item", "robo-serra-ataque"]) {
      if (!s.cache.audio.exists(key)) throw new Error(`Áudio não carregado: ${key}`);
    }
    const item = s.itensColetaveis[0];
    return item ? { x: item.x, y: item.y } : null;
  });
  assert.ok(pickup, "item disponível no chão");
  await session.posicionar(pickup.x, pickup.y);
  const collected = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.atualizarColetaItens();
    const ok = s.coletarItemProximo();
    return { ok, playing: s.sound.get("colocando-item")?.isPlaying,
      duplicate: s.coletarItemProximo() };
  });
  assert.deepEqual(collected, { ok: true, playing: true, duplicate: false });
  await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { criarInimigoTeste } = await import("/js/enemies/EnemyTest.js");
    window.__serraAudio = criarInimigoTeste(s, { x: s.player.x + 20, y: s.player.y,
      tipoRobo: "serra", remoteOnly: true, direcaoAtual: "left" });
    window.__amostrasSerra = [];
    s.events.on("postupdate", () => {
      const som = s.sound.get("robo-serra-ataque");
      if (som?.isPlaying) window.__amostrasSerra.push({ volume: som.volume,
        frame: window.__serraAudio.frame.name, anim: window.__serraAudio.anims.currentAnim?.key });
    });
  });
  await session.retomar();
  await page.evaluate(async () => {
    const { tocarAnimacaoAtaqueInimigo } = await import("/js/enemies/EnemyAnimations.js");
    tocarAnimacaoAtaqueInimigo(window.__serraAudio);
  });
  await page.waitForFunction(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    return !window.__serraAudio.anims.isPlaying && !s.sound.get("robo-serra-ataque")?.isPlaying;
  });
  const result = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2"), som = s.sound.get("robo-serra-ataque");
    return { samples: window.__amostrasSerra, playing: som?.isPlaying, duration: som?.totalDuration, rate: som?.rate, loop: som?.loop };
  });
  assert.ok(result.duration > 1.4);
  assert.equal(result.rate, 1);
  assert.equal(result.loop, false);
  assert.equal(result.playing, false, "MP3 termina naturalmente");
  assert.ok(result.samples.some(s => s.volume > 0.2), JSON.stringify(result));
  assert.ok(result.samples.every(s => s.anim === "robo-serra-ataque-left"));
  assert.ok(new Set(result.samples.map(s => s.frame)).size >= 3, `som acompanha os quadros do ataque: ${JSON.stringify(result)}`);
  await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { tocarAnimacaoAtaqueInimigo } = await import("/js/enemies/EnemyAnimations.js");
    tocarAnimacaoAtaqueInimigo(window.__serraAudio);
    window.__serraAudio.anims.stop();
    if (s.sound.get("robo-serra-ataque").isPlaying) throw new Error("Som continuou após interromper a animação");
    window.__serraAudio.destroy();
  });
  assert.deepEqual(session.errors, []);
  console.log("PASS: coleta confirmada e som da serra sincronizado com o ataque real, incluindo interrupção.");
} finally {
  await session.fechar();
}
