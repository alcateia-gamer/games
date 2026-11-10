/** Entrada real de áudio da fábrica, teto de 6%, prioridade do boss e limpeza. */
import assert from "node:assert/strict";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

const session = await abrirSessaoNovoBoss({ ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
});
const { page } = session;
try {
  const inicial = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { iniciarMusicaFabrica } = await import("/js/sounds/musicaFabrica.js");
    const ativos = key => s.sound.getAll(key).filter(som => !som.pendingRemove && som.isPlaying);
    if (ativos("musica-fabrica").length !== 1) throw new Error("Cena precisa iniciar a trilha da fábrica");
    if (ativos("musica-cidade").length) throw new Error("Trilha da cidade continuou na fábrica");
    iniciarMusicaFabrica(s).destruir();
    iniciarMusicaFabrica(s);
    window.__musicaFabricaTeste = ativos("musica-fabrica")[0];
    window.__inicioMusicaFabrica = s.sound.context.currentTime;
    const som = window.__musicaFabricaTeste;
    return { volume: som.volumeNode.gain.value, loop: som.loop, duracao: som.totalDuration };
  });
  // AudioParam só reflete os eventos agendados após o próximo bloco de áudio.
  assert.equal(inicial.loop, true); assert.ok(inicial.duracao > 10);
  const amostra = () => page.evaluate(() => {
    const som = window.__musicaFabricaTeste;
    return { volume: som.volumeNode.gain.value, tempo: som.manager.context.currentTime - window.__inicioMusicaFabrica };
  });
  await page.waitForTimeout(150);
  const silencio = await amostra();
  if (silencio.tempo < 0.5) assert.equal(silencio.volume, 0);
  await page.waitForTimeout(1400);
  const entrada = await amostra();
  assert.ok(entrada.volume > 0 && entrada.volume < 0.03, JSON.stringify(entrada));
  await page.waitForTimeout(5300);
  const teto = await amostra();
  assert.ok(Math.abs(teto.volume - 0.06) < 0.00001, JSON.stringify(teto));
  const prioridade = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const ativos = () => s.sound.getAll("musica-fabrica").filter(som => !som.pendingRemove && som.isPlaying);
    const boss = s.sound.add("musica-novo-boss", { volume: 0, loop: true });
    boss.play(); s.events.emit("update", s.time.now, 16);
    const duranteBoss = ativos().length;
    boss.stop(); boss.destroy(); s.events.emit("update", s.time.now, 16);
    const musica = ativos();
    return { duranteBoss, depois: musica.length };
  });
  assert.deepEqual(prioridade, { duranteBoss: 0, depois: 1 });
  await page.waitForTimeout(100);
  const volumeRetorno = await page.evaluate(() => window.__game.sound.getAll("musica-fabrica")
    .find(som => !som.pendingRemove && som.isPlaying)?.volumeNode.gain.value);
  assert.equal(volumeRetorno, 0);
  await session.reiniciar();
  const retorno = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    return s.sound.getAll("musica-fabrica").filter(som => !som.pendingRemove && som.isPlaying).length;
  });
  assert.equal(retorno, 1, "reentrada não acumula música");
  await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").scene.stop(); });
  await page.waitForFunction(() => !window.__game.sound.getAll("musica-fabrica")
    .some(som => !som.pendingRemove && som.isPlaying));
  assert.deepEqual(session.errors, []);
  console.log("PASS: fábrica começa em silêncio, sobe até 6%, cede à música do boss e limpa ao sair/reiniciar.");
} finally {
  await session.fechar();
}
