/** Marcadores da cidade: uso real do posto, entrada da fábrica e retorno ao mapa. */
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 932, height: 430 },
    isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/js/core/game.js*", async route => {
    const response = await route.fetch();
    const source = await response.text();
    const body = source.replace("const game = new Game(jogoRapido);", "const game = window.__game = new Game(jogoRapido);");
    assert.notEqual(source, body);
    await route.fulfill({ response, body });
  });
  await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:8765/", { waitUntil: "networkidle" });
  await page.keyboard.press("k");
  await page.waitForFunction(() => window.__game?.scene.getScene("Level1")?.inventory,
    null, { timeout: 60000 });
  const markers = () => page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1");
    return { fuel: !!s.children.getByName("fuel-tank-marker"),
      factory: !!s.children.getByName("factory-entrance-marker"),
      fuelIcon: s.minimap.fuelPositions.length };
  });
  assert.deepEqual(await markers(), { fuel: true, factory: true, fuelIcon: 1 });
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1");
    s.developerMode = true;
    const point = s.minimap.fuelPositions[0], p = s.player;
    const dx = p.body.center.x - p.x, dy = p.body.center.y - p.y;
    p.body.reset(point.x - dx, point.y + 45 - dy);p.body.updateFromGameObject();
  });
  await page.waitForFunction(() => !!window.__game.scene.getScene("Level1").interacaoCombustivelProxima);
  await page.evaluate(() => window.__game.scene.getScene("Level1").interacaoCombustivelProxima.interact());
  assert.equal((await markers()).fuel, true, "sem galão o aviso continua orientando o jogador");
  const radar = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1"), map = s.minimap;
    let rects = 0;
    const graphics = map.itemMarkers;
    const fillRect = graphics.fillRect;
    graphics.fillRect = function (...args) { rects++;return fillRect.apply(this, args); };
    map.updateFuelMarkers();
    graphics.fillRect = fillRect;
    return { rects, native: !!map.nativeView };
  });
  assert.equal(radar.rects, 5, "o ícone vetorial é desenhado no local do posto");
  assert.equal(radar.native, true, "a HUD mobile usa o desenho nítido em canvas");
  await page.screenshot({ path: "/tmp/fuel-tank-guidance.png" });
  await page.evaluate(() => window.__game.scene.getScene("Level1").inventory.addItem("gasolina", 1));
  await page.keyboard.down("e");
  try {
    await page.waitForFunction(() => window.__game.registry.get("tanqueCombustivelUsado") === true);
  } finally { await page.keyboard.up("e"); }
  assert.deepEqual(await markers(), { fuel: false, factory: true, fuelIcon: 1 });
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1"), p = s.player;
    const target = s.entradaFabrica.body.center;
    const dx = p.body.center.x - p.x, dy = p.body.center.y - p.y;
    p.body.reset(target.x - dx, target.y - dy);p.body.updateFromGameObject();
  });
  await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2")?.player?.active &&
    window.__game.scene.getScene("Level1Parte2").scene.isActive(), null, { timeout: 20000 });
  assert.equal(await page.evaluate(() => window.__game.registry.get("fabricaVisitada")), true);
  await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").scene.start("Level1", {
    personagem: "kai-mercer", spawnX: 72, spawnY: -2040,
  }));
  await page.waitForFunction(() => window.__game.scene.getScene("Level1").scene.isActive() &&
    window.__game.scene.getScene("Level1").inventory && window.__game.scene.getScene("Level1").minimap);
  assert.deepEqual(await markers(), { fuel: false, factory: false, fuelIcon: 1 });
  assert.deepEqual(errors, []);
  console.log("PASS: bomba no minimapa mobile, avisos independentes, abastecimento, entrada real na fábrica e persistência ao voltar.");
} finally { await browser.close(); }
