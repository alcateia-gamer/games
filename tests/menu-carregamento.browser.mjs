/** Valida que o menu não baixa fases/combate e que a partida continua acessível. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const baseURL = process.env.GAME_URL || "http://127.0.0.1:8765";
const browser = await chromium.launch({ headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"] });
try {
  for (const baseline of process.env.COMPARE_BASELINE === "1" ? [true, false] : [false]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const requests = [], errors = [];
    page.on("request", request => requests.push(new URL(request.url()).pathname));
    page.on("pageerror", error => { errors.push(error.message); console.error("PAGEERROR:", error.message); });
    // A conexão externa não participa da medição do menu nem da partida solo.
    await page.route("https://unpkg.com/mqtt@*/**", route => route.fulfill({
      contentType: "application/javascript",
      body: "globalThis.mqtt = { connect() { return { on() { return this; }, subscribe() {}, publish() {}, end() {} }; } };",
    }));
    if (baseline) {
      for (const path of ["index.html", "js/scenes/start.js"]) {
        const body = execFileSync("git", ["show", `HEAD:${path}`], { encoding: "utf8" });
        await page.route(`${baseURL}/${path === "index.html" ? "" : path}`, route => route.fulfill({
          contentType: path.endsWith("html") ? "text/html" : "application/javascript", body,
        }));
      }
    }
    await page.route("**/js/core/game.js*", async route => {
      const source = baseline
        ? execFileSync("git", ["show", "HEAD:js/core/game.js"], { encoding: "utf8" })
        : await (await route.fetch()).text();
      await route.fulfill({ contentType: "application/javascript", body: source.replace(
        "const game = new Game(jogoRapido);", "const game = window.__game = new Game(jogoRapido);") });
    });
    await page.goto(baseURL);
    await page.locator("#start-game").click();
    await page.waitForFunction(() => window.__game?.scene.getScene("Start")?.mode === "menu", null, { timeout: 30000 });
    const initial = [...requests];
    console.log(JSON.stringify({ baseline, requestsBeforeMenu: initial.length,
      modulesBeforeMenu: initial.filter(p => p.startsWith("/js/")).length,
      assetsBeforeMenu: initial.filter(p => p.startsWith("/assets/")).length }));
    assert.deepEqual(errors, []);
    if (!baseline) {
      assert.equal(initial.some(p => /\/js\/(enemies|combat|controls|map)\//.test(p)), false);
      assert.equal(initial.some(p => /\/js\/scenes\/(Level1|preloader)/.test(p)), false);
      assert.equal(initial.filter(p => p.startsWith("/assets/")).length, 1, "only menu music before the menu");
      assert.equal(initial.some(p => p.includes("mqtt.min.js") || p.includes("rexvirtualjoystick")), false);
      await page.evaluate(() => window.__game.scene.getScene("Start").selectMenuOption("MULTIJOGADOR"));
      await page.waitForFunction(() => window.__game.scene.isActive("MultiplayerMenu") && !!window.__game.registry.get("multiplayer"));
      assert.equal(requests.some(p => p.includes("mqtt.min.js")), true, "network library loads only in multiplayer");
      await page.evaluate(() => window.__game.scene.getScene("MultiplayerMenu").scene.start("Start", { abrirMenu: true }));
      await page.waitForFunction(() => window.__game.scene.isActive("Start"));
      await page.evaluate(() => window.__game.scene.getScene("Start").selectMenuOption("SOLO"));
      await page.waitForFunction(() => !!window.__game.scene.getScene("Start").soloLayer);
      assert.equal(requests.some(p => p.includes("arma-test") || /\/golpes\//.test(p)), false);
      assert.equal(await page.evaluate(() => window.__game.scene.getScene("Start").retratosProntos()), true);
      await page.evaluate(() => window.__game.scene.getScene("Start").startSoloGame());
      await page.waitForFunction(() => window.__game.scene.isActive("Level1"), null, { timeout: 120000 });
      assert.deepEqual(errors, []);
      console.log("PASS: menu sem fases/combate; multiplayer carrega rede sob demanda; seleção carrega retratos; partida solo chega à cidade.");
    }
    await context.close();
  }
} finally {
  await browser.close();
}
