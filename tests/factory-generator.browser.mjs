/** Arraste nativo de mouse/toque no jogo real. Requer HTTP e Playwright (ver outros browser.mjs). */
import assert from "node:assert/strict";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

const session = await abrirSessaoNovoBoss({
  ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
}, {}, { hasTouch: true, deviceScaleFactor: 2 });
const { page } = session;
const sceneState = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("Level1Parte2");
  const root = s.children.getByName("generator-modal");
  const panel = root.list[1];
  return { open: s.generatorMenuOpen, blocked: s.movimentoBloqueado,
    powered: !!s.luzFabricaAcesa, battery: s.inventory.getQuantity("bateria"),
    fuel: s.inventory.getQuantity("gasolina"), ready: panel.getByName("generator-power").getData("ready"),
    dragging: panel.getByName("generator-drag").visible };
});
let bounds;
const coords = (x, y) => ({ x: bounds.x + x * bounds.width / 800, y: bounds.y + y * bounds.height / 450 });
async function click(x, y) { const p = coords(x, y); await page.mouse.click(p.x, p.y); await frame(); }
async function drag(x, y, targetX, targetY) {
  const from = coords(x, y), to = coords(targetX, targetY);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await frame();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
  await frame();
}
const frame = () => page.waitForTimeout(100);

try {
  const area = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { findGeneratorInteraction } = await import("/js/interactions/FactoryGenerator.js");
    s.developerMode = true;
    s.inventory.addItem("bateria", 1);
    s.inventory.addItem("gasolina", 2);
    return findGeneratorInteraction(s.map).object;
  });
  await session.posicionar(area.x + area.width / 2, area.y + area.height + 10);
  await session.retomar();
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.atualizarInteracaoGeradorFabrica();
    if (!s.interagirGerador()) throw new Error("O gerador precisa estar ao alcance.");
  });
  bounds = await page.evaluate(() => {
    const r = window.__game.canvas.getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  });
  await frame();
  const sharpDisplay = page.locator("canvas[data-generator-display]");
  assert.equal(await sharpDisplay.isVisible(), true);
  const checkDisplay = () => page.evaluate(() => {
    const canvas = document.querySelector("canvas[data-generator-display]");
    const bounds = canvas.getBoundingClientRect();
    const game = window.__game.canvas.getBoundingClientRect();
    return { width: canvas.width, expectedWidth: Math.round(bounds.width * devicePixelRatio),
      centerX: bounds.x + bounds.width / 2, centerY: bounds.y + bounds.height / 2,
      expectedX: game.x + game.width / 2, expectedY: game.y + game.height / 2 };
  });
  let sharp = await checkDisplay();
  assert.equal(sharp.width, sharp.expectedWidth, "painel desenha na densidade real da tela");
  assert.ok(sharp.width > 800, "textos não são ampliados do framebuffer do jogo");
  await page.setViewportSize({ width: 960, height: 720 });
  await page.waitForFunction(() => {
    const display = document.querySelector("canvas[data-generator-display]").getBoundingClientRect();
    const game = window.__game.canvas.getBoundingClientRect();
    return Math.abs(display.x + display.width / 2 - game.x - game.width / 2) < 1 &&
      Math.abs(display.y + display.height / 2 - game.y - game.height / 2) < 1;
  });
  sharp = await checkDisplay();
  assert.equal(sharp.width, sharp.expectedWidth);
  assert.ok(Math.abs(sharp.centerX - sharp.expectedX) < 1, JSON.stringify(sharp));
  assert.ok(Math.abs(sharp.centerY - sharp.expectedY) < 1, JSON.stringify(sharp));
  await page.setViewportSize({ width: 1280, height: 720 });
  await frame();
  await page.screenshot({ path: "/tmp/factory-generator-open.png" });
  await click(604, 356);
  assert.equal((await sceneState()).powered, false);
  // Trocar bateria e gasolina não fecha o circuito.
  await drag(133, 200, 318, 315);
  await drag(133, 279, 318, 205);
  assert.equal((await sceneState()).ready, false);
  await drag(133, 200, 318, 205);
  assert.equal((await sceneState()).ready, false);
  assert.equal((await sceneState()).battery, 1);
  await click(743, 54);
  assert.equal((await sceneState()).open, false);
  assert.equal(await sharpDisplay.isVisible(), false);
  assert.equal((await sceneState()).battery, 1);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.atualizarInteracaoGeradorFabrica(); s.interagirGerador();
    s.cameras.main.setZoom(2.15);
  });
  await frame();
  // Arraste mantém as coordenadas da tela mesmo com zoom da câmera.
  await drag(133, 200, 318, 205);
  const cdp = await session.context.newCDPSession(page);
  async function touch(type, x, y) {
    const p = coords(x, y);
    await cdp.send("Input.dispatchTouchEvent", { type,
      touchPoints: type === "touchEnd" ? [] : [{ id: 7, x: p.x, y: p.y, radiusX: 2, radiusY: 2, force: 1 }] });
    await frame();
  }
  await touch("touchStart", 133, 279);
  assert.equal((await sceneState()).dragging, true);
  await touch("touchMove", 318, 315);
  await touch("touchEnd", 318, 315);
  let state = await sceneState();
  assert.equal(state.ready, true);
  assert.equal(state.powered, false);
  assert.equal(state.fuel, 2);
  await page.screenshot({ path: "/tmp/factory-generator-ready.png" });
  // Esc cancela tudo sem consumir recursos nem deixar a peça presa ao cursor.
  await page.keyboard.press("Escape");
  await frame();
  state = await sceneState();
  assert.equal(state.open, false);
  assert.equal(state.blocked, false);
  assert.equal(state.fuel, 2);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.atualizarInteracaoGeradorFabrica(); s.interagirGerador();
  });
  await frame();
  await drag(133, 200, 318, 205);
  await drag(133, 279, 318, 315);
  await click(604, 356);
  await click(604, 356);
  state = await sceneState();
  assert.equal(state.powered, true);
  assert.equal(state.battery, 0);
  assert.equal(state.fuel, 1);
  await page.waitForTimeout(1300);
  state = await sceneState();
  assert.equal(state.open, false);
  assert.equal(state.blocked, false);
  const devState = () => page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    return { powered: s.luzFabricaAcesa, saved: s.game.registry.get("factoryGeneratorPowered"),
      label: s.textoBotaoLuzFabrica.text, visible: s.botaoLuzFabrica.visible,
      interactive: s.botaoLuzFabrica.input.enabled,
      motor: s.sound.get("gerador-diesel")?.isPlaying ?? false,
      battery: s.inventory.getQuantity("bateria"), fuel: s.inventory.getQuantity("gasolina") };
  });
  const toggleLight = async () => {
    const p = await page.evaluate(() => {
      const s = window.__game.scene.getScene("Level1Parte2"), c = s.cameras.main;
      const ox = c.width * c.originX, oy = c.height * c.originY;
      return { x: ox + (s.botaoLuzFabrica.x - ox) * c.zoomX,
        y: oy + (s.botaoLuzFabrica.y - oy) * c.zoomY };
    });
    await click(p.x, p.y);
  };
  assert.equal((await devState()).label, "FAB ON", "gerador normal atualiza o botão DEV");
  await toggleLight();
  let dev = await devState();
  assert.equal(dev.powered, false);
  assert.equal(dev.saved, false);
  assert.equal(dev.label, "FAB OFF");
  assert.equal(dev.motor, false);
  assert.equal(dev.interactive, true);
  await toggleLight();
  dev = await devState();
  assert.equal(dev.powered, true);
  assert.equal(dev.saved, true);
  assert.equal(dev.label, "FAB ON");
  assert.equal(dev.battery, 0, "DEV não consome itens");
  assert.equal(dev.fuel, 1);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.developerMode = false;
    s.botaoLuzFabrica.emit("pointerdown");
  });
  await frame();
  assert.equal((await devState()).powered, true, "botão só altera a luz com DEV ativo");
  assert.equal((await devState()).visible, false);
  await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").developerMode = true; });
  await frame();
  await toggleLight();
  await session.reiniciar();
  assert.equal((await devState()).powered, false, "desligamento persiste ao voltar à fábrica");
  assert.equal((await devState()).label, "FAB OFF");
  assert.equal(await sharpDisplay.count(), 1, "reentrada remove o canvas anterior do painel");
  assert.equal(await sharpDisplay.isVisible(), false);
  assert.deepEqual(session.errors, []);
  console.log("PASS: gerador com arraste e botão DEV alternando luz, som e persistência sem consumir itens.");
} catch (error) {
  await page.screenshot({ path: "/tmp/factory-generator-failure.png" }).catch(() => {});
  console.error("DISPLAY:", await page.evaluate(() => {
    const game = window.__game, display = document.querySelector("canvas[data-generator-display]");
    const camera = game.scene.getScene("Level1Parte2").cameras.main;
    return { style: display?.getAttribute("style"), game: game.canvas.getBoundingClientRect().toJSON(),
      parent: game.canvas.parentElement.getBoundingClientRect().toJSON(), size: game.scale.gameSize,
      camera: { x: camera.x, y: camera.y, width: camera.width, height: camera.height } };
  }).catch(() => null));
  throw error;
} finally {
  await session.fechar();
}
