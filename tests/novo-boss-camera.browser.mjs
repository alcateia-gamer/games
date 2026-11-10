/** Zoom legado no encontro atual: entrada, margem, HUD, retorno e ciclo de vida. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
await mkdir("/tmp/zoom-novo-boss", { recursive: true });
const config = { ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, automatico: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false } };
const sessao = await abrirSessaoNovoBoss(config, { personagem: "kai-mercer" });
const { page, avancar, posicionar } = sessao;
const snap = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("Level1Parte2"), c = s.cameras.main;
  s.events.emit("prerender");
  return { zoomX: c.zoomX, zoomY: c.zoomY, vida: s.novoBoss.vida, estado: s.novoBoss.estado,
    camera: s.novoBoss.cameraArena.snapshot(), oldBoss: Boolean(s.bossFinal),
    barra: s.novoBoss.hud.container.scaleX * c.zoomX * s.novoBoss.hud.preenchimento.width,
    ataque: s.botaoAtaque.displayWidth * c.zoomX,
    botaoX: c.width * c.originX + (s.botaoAtaque.x - c.width * c.originX) * c.zoomX,
    botaoY: c.height * c.originY + (s.botaoAtaque.y - c.height * c.originY) * c.zoomY };
});
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.001, `${a} ≠ ${b}`);
try {
  await posicionar(-1093, -5250); await avancar(2000);
  near((await snap()).zoomX, 1);
  await posicionar(-1093, -5520); await avancar(100);
  let s = await snap();
  assert.ok(s.zoomX > 0.8 && s.zoomX < 1);
  near(s.barra, 256); near(s.ataque, 92); near(s.botaoX, 720); near(s.botaoY, 350);
  await avancar(2000); s = await snap();
  near(s.zoomX, 0.8); near(s.zoomY, 0.8); assert.equal(s.oldBoss, false);
  const f = await page.evaluate(() => window.__game.loop.frame);
  await page.waitForFunction(f => window.__game.loop.frame > f + 2, f);
  await page.screenshot({ path: "/tmp/zoom-novo-boss/arena-zoom.png" });
  console.log("PASS: entrada suave até 0,8; boss antigo ausente; barra e botão mantêm tamanho/posição na tela durante a transição.");

  await posicionar(-1093, config.arena.entradaY + 40); await avancar(2000);
  near((await snap()).zoomX, 0.8);
  await posicionar(-1093, -5250); await avancar(100);
  s = await snap(); assert.ok(s.zoomX > 0.8 && s.zoomX < 1);
  await avancar(2000); near((await snap()).zoomX, 1);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.cameras.main.setZoom(1.25, 1.1);
  });
  await posicionar(-1093, -5520); await avancar(2000);
  s = await snap(); near(s.zoomX, 1); near(s.zoomY, 0.88);
  await posicionar(-1093, -5250); await avancar(2000);
  s = await snap(); near(s.zoomX, 1.25); near(s.zoomY, 1.1);
  console.log("PASS: margem evita oscilações na porta; sair restaura o zoom anterior, inclusive por eixo.");

  await posicionar(-1093, -5520); await avancar(2000);
  for (let i = 0; i < 40 && (await snap()).estado !== "vulneravel"; i++) await avancar(200);
  assert.ok(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(1000)));
  await avancar(2000); s = await snap(); near(s.zoomX, 1.25); near(s.zoomY, 1.1);
  console.log("PASS: vitória restaura suavemente a câmera e mantém a derrota do encontro atual.");

  await sessao.reiniciar(); await avancar(2000); near((await snap()).zoomX, 0.8);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    window.__cameraZoomAnterior = s.cameras.main;
    s.scene.stop();
  });
  await page.waitForFunction(() => !window.__game.scene.getScene("Level1Parte2").scene.isActive());
  near(await page.evaluate(() => window.__cameraZoomAnterior.zoomX), 1);
  await sessao.reiniciar({ multiplayer: true });
  await avancar(2000);
  // No multiplayer não há sprite/HUD local da boss; examina somente a câmera.
  near(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").cameras.main.zoomX), 1);
  assert.deepEqual(sessao.errors, []); assert.deepEqual(sessao.assetErrors, []);
  console.log("PASS: reinício/saída limpam o controle e multiplayer conserva o zoom normal, sem erros JS/assets.");
} finally { await sessao.fechar(); }
