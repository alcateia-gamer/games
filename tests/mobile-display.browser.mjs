/** Tela cheia no primeiro toque, preenchimento em proporções distintas e entrada por toque. */
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"] });
const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:8765";
try {
  const context = await browser.newContext({ viewport: { width: 915, height: 412 },
    screen: { width: 915, height: 412 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/js/core/game.js*", async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace("const game = new Game(jogoRapido);",
      "const game = window.__game = new Game(jogoRapido);");
    await route.fulfill({ response, body });
  });
  await page.goto(baseURL);
  await page.waitForTimeout(200);
  await page.tap("#start-game");
  await page.waitForFunction(() => document.fullscreenElement === document.documentElement);
  await page.waitForFunction(() => window.__game?.scene.getScene("Start")?.mode === "menu",
    null, { timeout: 30000 });
  await page.waitForFunction(() => window.__game.scene.getScene("Start").menuLayer.alpha > 0.99);

  async function verificarPreenchimento() {
    await page.waitForFunction(() => {
      const c = window.__game.canvas.getBoundingClientRect();
      return Math.abs(c.width - innerWidth) < 1 && Math.abs(c.height - innerHeight) < 1;
    });
    const sizes = await page.evaluate(() => {
      const game = window.__game, canvas = game.canvas.getBoundingClientRect();
      return { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height,
        viewport: [innerWidth, innerHeight], logical: [game.scale.width, game.scale.height],
        factor: [canvas.width / game.scale.width, canvas.height / game.scale.height] };
    });
    assert.ok(Math.abs(sizes.x) < 1 && Math.abs(sizes.y) < 1, "canvas começa na borda da tela");
    assert.ok(Math.abs(sizes.factor[0] - sizes.factor[1]) < 0.005, "pixels mantêm a proporção");
    assert.ok(sizes.logical[0] >= 800 && sizes.logical[1] >= 450);
    return sizes;
  }

  const sizes = [await verificarPreenchimento()];
  // A janela headless precisa sair do fullscreen para simular mudanças de orientação.
  await page.evaluate(() => document.exitFullscreen());
  await page.setViewportSize({ width: 844, height: 390 });
  await verificarPreenchimento();
  await page.waitForTimeout(150);
  await page.screenshot({ path: "/tmp/mobile-display-menu.png" });
  // Toca o fundo interativo que fica atrás do texto HTML do menu.
  const solo = await page.getByText("SOLO", { exact: true }).boundingBox();
  assert.ok(solo);
  await page.touchscreen.tap(solo.x + solo.width / 2, solo.y + solo.height / 2);
  await page.waitForFunction(() => !!window.__game.scene.getScene("Start").soloLayer);
  console.log("PASS: toque no menu SOLO.");
  await page.evaluate(() => window.__game.scene.getScene("Start").startSoloGame());
  await page.waitForFunction(() => window.__game.scene.getScene("Level1")?.player?.active,
    null, { timeout: 90000 });
  for (const viewport of [{ width: 1024, height: 768 }, { width: 412, height: 915 },
    { width: 932, height: 430 }, { width: 844, height: 320 }]) {
    await page.setViewportSize(viewport);
    sizes.push(await verificarPreenchimento());
    await page.waitForTimeout(150);
    const target = await page.evaluate(() => {
      const s = window.__game.scene.getScene("Level1");
      const camera = s.cameras.main;
      const x = 100, y = camera.height - 100;
      window.__touchHit = false;
      s.joystick.base.once("pointerdown", () => { window.__touchHit = true; });
      const bounds = s.game.canvas.getBoundingClientRect();
      return { x: bounds.x + x * bounds.width / s.scale.width,
        y: bounds.y + y * bounds.height / s.scale.height };
    });
    await page.touchscreen.tap(target.x, target.y);
    await page.waitForFunction(() => window.__touchHit);
    const attack = await page.evaluate(() => {
      const s = window.__game.scene.getScene("Level1"), camera = s.cameras.main;
      const x = camera.width / 2 + (s.botaoAtaque.x - camera.width / 2) * camera.zoomX;
      const y = camera.height / 2 + (s.botaoAtaque.y - camera.height / 2) * camera.zoomY;
      window.__attackHit = false;
      s.botaoAtaque.once("pointerdown", () => { window.__attackHit = true; });
      s.iconeAtaque?.once("pointerdown", () => { window.__attackHit = true; });
      const rect = s.game.canvas.getBoundingClientRect();
      return { marginX: camera.width - x, marginY: camera.height - y,
        x: rect.x + x * rect.width / s.scale.width, y: rect.y + y * rect.height / s.scale.height };
    });
    assert.ok(Math.abs(attack.marginX - 80) < 0.01 && Math.abs(attack.marginY - 100) < 0.01,
      "ataque acompanha as bordas direita e inferior");
    await page.touchscreen.tap(attack.x, attack.y);
    await page.waitForFunction(() => window.__attackHit);
    console.log("PASS: joystick e ataque após resize", viewport);
  }
  await page.screenshot({ path: "/tmp/mobile-display-game.png" });
  assert.deepEqual(errors, []);
  console.log("PASS: fullscreen no botão inicial; canvas sem faixas em cinco proporções; menu e toque nas bordas funcionam.");
  console.log(JSON.stringify(sizes));
  await page.evaluate(() => {
    const game = window.__game;
    if (typeof game._viewportCleanup !== "function") throw new Error("Limpeza do viewport não foi integrada.");
    game.destroy(true);
    if (game._viewportCleanup !== null || game._audioUnlockEvents !== null) {
      throw new Error("Os eventos de tela e áudio não foram liberados.");
    }
  });
  await page.waitForFunction(() => !document.querySelector("#game-container > canvas:not([aria-hidden])"));
  await page.setViewportSize({ width: 932, height: 430 });
  assert.deepEqual(errors, []);
  console.log("PASS: destruir o jogo remove o canvas e libera os eventos de viewport e áudio.");
  await context.close();

  // Recusa da API não bloqueia o início nem o preenchimento da janela do celular.
  const fallback = await browser.newContext({ viewport: { width: 844, height: 390 },
    isMobile: true, hasTouch: true });
  const fallbackPage = await fallback.newPage();
  const fallbackErrors = [];
  fallbackPage.on("pageerror", error => fallbackErrors.push(error.message));
  await fallbackPage.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error("NotAllowedError"));
  });
  await fallbackPage.goto(baseURL);
  await fallbackPage.waitForTimeout(200);
  await fallbackPage.tap("#start-game");
  await fallbackPage.waitForFunction(() => {
    const canvas = document.querySelector("#game-container > canvas:not([aria-hidden])");
    const rect = canvas?.getBoundingClientRect();
    return rect && Math.abs(rect.width - innerWidth) < 1 && Math.abs(rect.height - innerHeight) < 1;
  });
  assert.deepEqual(fallbackErrors, []);
  assert.equal(await fallbackPage.evaluate(() => document.fullscreenElement), null);
  await fallback.close();

  // Desktop conserva o ajuste original à janela e não pede tela cheia automaticamente.
  const desktop = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const desktopPage = await desktop.newPage();
  await desktopPage.goto(baseURL);
  await desktopPage.waitForTimeout(200);
  await desktopPage.click("#start-game");
  await desktopPage.waitForFunction(() => !!document.querySelector("#game-container > canvas"));
  assert.equal(await desktopPage.evaluate(() => document.fullscreenElement), null);
  await desktop.close();
} finally {
  await browser.close();
}
