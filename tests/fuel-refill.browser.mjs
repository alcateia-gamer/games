/** Fluxo real: coletar vazio, abastecer por E/toque, persistir entre mapas e usar no gerador. */
import assert from "node:assert/strict";
const { chromium } = process.env.PLAYWRIGHT_MODULE
  ? await import(process.env.PLAYWRIGHT_MODULE)
  : await import("playwright").catch(() => import("playwright-core"));
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: true });
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await page.route("**/js/core/game.js*", async route => {
  const response = await route.fetch();
  const source = await response.text();
  const body = source.replace("const game = new Game(jogoRapido);", "const game = window.__game = new Game(jogoRapido);");
  assert.notEqual(body, source);
  await route.fulfill({ response, body });
});
let current = "Level1";

async function trocar(key, x, y) {
  await page.evaluate(({ from, key, x, y }) => {
    const scene = window.__game.scene.getScene(from);
    scene.scene.resume();
    scene.scene.start(key, { personagem: "kai-mercer", spawnX: x, spawnY: y });
  }, { from: current, key, x, y });
  current = key;
  await page.waitForFunction(key => {
    const s = window.__game.scene.getScene(key);
    return s.scene.isActive() && s.player?.active && s.inventory &&
      (key === "Level1" ? !!s.enemySpawnManager : !!s.portaFabrica);
  }, key);
}

async function posicionar(x, y) {
  await page.evaluate(({ key, x, y }) => {
    const s = window.__game.scene.getScene(key), p = s.player;
    p.body.reset(x, y);
    p.body.updateFromGameObject();
    p.body.reset(p.x + x - p.body.center.x, p.y + y - p.body.center.y);
    p.body.updateFromGameObject();
    p.setVelocity(0, 0);
  }, { key: current, x, y });
}

const nivel = () => page.evaluate(key => window.__game.scene.getScene(key).inventory.getSlots()
  .find(s => s.itemId === "gasolina")?.fuel, current);
async function tecla() {
  await page.keyboard.down("e");
  try {
    // O renderizador por software pode levar mais de 70 ms para apresentar um quadro.
    await page.waitForFunction(key => !window.__game.scene.getScene(key).teclaColetarItem._justDown, current);
  } finally { await page.keyboard.up("e"); }
}
async function pausa() {
  await page.evaluate(key => { window.__game.scene.getScene(key).scene.pause(); }, current);
}
async function retomar() {
  await page.evaluate(key => { window.__game.scene.getScene(key).scene.resume(); }, current);
  await page.waitForFunction(key => window.__game.scene.getScene(key).scene.isActive(), current);
}
async function tela(x, y) {
  return page.evaluate(({ x, y }) => {
    const game = window.__game, bounds = game.canvas.getBoundingClientRect();
    return { x: bounds.left + x * bounds.width / game.scale.gameSize.width,
      y: bounds.top + y * bounds.height / game.scale.gameSize.height };
  }, { x, y });
}
async function drag(x, y, toX, toY) {
  const a = await tela(x, y), b = await tela(toX, toY);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.waitForTimeout(100);
  await page.mouse.move(b.x, b.y, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}

try {
  await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:8765/", { waitUntil: "networkidle" });
  await page.keyboard.press("k");
  await page.waitForFunction(() => window.__game?.scene.getScene("Level1")?.inventory,
    null, { timeout: 60000 });
  const pickup = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1");
    const item = s.itensColetaveis.find(i => i.itemId === "gasolina");
    return { x: item.x, y: item.y };
  });
  // A coleta usa o centro do sprite; o posto usa o contato dos pés com o chão.
  await page.evaluate(({ x, y }) => {
    const s = window.__game.scene.getScene("Level1");
    s.player.body.reset(x, y);
    s.player.body.updateFromGameObject();
  }, pickup);
  await page.waitForFunction(() => window.__game.scene.getScene("Level1").itemColetavelProximo?.itemId === "gasolina");
  await tecla();
  await page.waitForFunction(() => window.__game.scene.getScene("Level1").inventory.getQuantity("gasolina") === 1);
  assert.equal(await nivel(), 0);
  assert.equal(await page.locator("[data-inventory-fuel-label]").textContent(), "0%");
  assert.match(await page.evaluate(() => window.__game.scene.getScene("Level1")
    .children.getByName("fuel-speech-bubble").text), /galão está vazio.*enchê-lo/);
  await tecla();
  await page.waitForFunction(() => window.__game.scene.getScene("Level1").inventory.getQuantity("bateria") === 1);

  const area = await page.evaluate(async () => {
    const { lerAreasGasolina } = await import("/js/interactions/FuelRefill.js");
    return lerAreasGasolina(window.__game.scene.getScene("Level1").map)[0];
  });
  const pump = { x: area.x + area.width / 2, y: area.y + area.height + 24 };
  await posicionar(pump.x, pump.y);
  await page.waitForFunction(() => !!window.__game.scene.getScene("Level1").interacaoCombustivelProxima);
  const labelNitido = page.locator("[data-fuel-fill-label]");
  await labelNitido.waitFor({ state: "visible" });
  assert.equal(await labelNitido.textContent(), "E / TOQUE · ENCHER GALÃO");
  assert.equal(await labelNitido.evaluate(node => getComputedStyle(node).pointerEvents), "none");
  await page.screenshot({ path: "/tmp/fuel-refill-prompt.png" });
  await tecla();
  await page.waitForFunction(() => window.__game.scene.getScene("Level1").inventory.getSlots()
    .find(s => s.itemId === "gasolina").fuel >= 0.2);
  assert.match(await labelNitido.textContent(), /ENCHENDO GALÃO · \d+%/);
  await page.screenshot({ path: "/tmp/fuel-refill-progress.png" });
  await pausa();
  await labelNitido.waitFor({ state: "hidden" });
  const partial = await nivel();
  assert.ok(partial >= 0.2 && partial < 1);
  assert.equal(await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1");
    return s.inventoryUI.container.getByName("inventory-fuel-bar:0").getData("fuel");
  }), partial);
  await page.screenshot({ path: "/tmp/fuel-refill-partial.png" });
  await posicionar(pump.x + 450, pump.y);
  await retomar();
  // Aguarda quadros reais fora do alcance; o combustível parcial não pode aumentar.
  await page.waitForTimeout(250);
  assert.equal(await nivel(), partial);

  await posicionar(pump.x, pump.y);
  assert.equal(await nivel(), partial);
  await page.waitForFunction(() => !!window.__game.scene.getScene("Level1").interacaoCombustivelProxima);
  const hand = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1"), b = s.botaoColetarItem, c = s.cameras.main;
    return { x: c.width * c.originX + (b.x - c.width * c.originX) * c.zoom,
      y: c.height * c.originY + (b.y - c.height * c.originY) * c.zoom };
  });
  const touch = await tela(hand.x, hand.y);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart",
    touchPoints: [{ id: 1, x: touch.x, y: touch.y, radiusX: 2, radiusY: 2, force: 1 }] });
  try {
    await page.waitForFunction(partial => window.__game.scene.getScene("Level1").inventory.getSlots()
      .find(s => s.itemId === "gasolina").fuel > partial, partial);
  } finally {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await page.waitForFunction(() => window.__game.scene.getScene("Level1").inventory.getQuantity("gasolina", { minFuel: 1 }) === 1);
  assert.equal(await nivel(), 1);
  assert.equal(await page.locator("[data-inventory-fuel-label]").textContent(), "100%");
  await page.screenshot({ path: "/tmp/fuel-refill-full.png" });

  await trocar("Level1Parte2", -520, -1410);
  // A troca de mapa remove o rótulo anterior, sem deixar textos HTML duplicados.
  assert.equal(await labelNitido.count(), 1);
  assert.equal(await nivel(), 1);
  await posicionar(-520, -1410);
  await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").geradorInteracaoDisponivel);
  await tecla();
  await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").generatorMenuOpen);
  await drag(133, 200, 318, 205);
  await drag(133, 279, 318, 315);
  const power = await tela(604, 356);
  await page.mouse.click(power.x, power.y, { delay: 100 });
  await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").luzFabricaAcesa);
  assert.deepEqual(await page.evaluate(() => {
    const i = window.__game.scene.getScene("Level1Parte2").inventory;
    return [i.getQuantity("gasolina"), i.getQuantity("bateria")];
  }), [0, 0]);
  assert.equal(await page.locator("[data-inventory-fuel-label]").count(), 0);
  assert.deepEqual(errors, []);
  console.log("PASS: coleta vazia com fala, barra parcial, E/toque no posto real, persistência e gerador exigindo galão cheio.");
} catch (error) {
  console.error("Estado ao falhar:", await page.evaluate(key => {
    const s = window.__game.scene.getScene(key);
    return { slots: s.inventory?.getSlots(), player: { x: s.player?.x, y: s.player?.y },
      pickup: s.itemColetavelProximo?.itemId, pump: s.interacaoCombustivelProxima,
      blocked: s.movimentoBloqueado, death: s.morteEmAndamento,
      button: { x:s.botaoColetarItem?.x, y:s.botaoColetarItem?.y, visible:s.botaoColetarItem?.visible,
        enabled:s.botaoColetarItem?.input?.enabled }, pointer:{x:s.input.activePointer.x,y:s.input.activePointer.y} };
  }, current).catch(() => null));
  throw error;
} finally {
  await context.close();
  await browser.close();
}
