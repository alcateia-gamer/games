import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"] });
try {
  for (const enabled of [false, true]) {
    const page = await browser.newPage();
    const requests = [], errors = [];
    page.on("request", r => { if (r.url().includes("PerformanceProbe.js")) requests.push(r.url()); });
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/js/core/game.js*", async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()).replace("const game = new Game(jogoRapido);",
        "const game = window.__game = new Game(jogoRapido);") });
    });
    await page.goto(`${process.env.BASE_URL || "http://127.0.0.1:8765/"}${enabled ? "?perf=1" : ""}`);
    await page.locator("#start-game").click();
    await page.waitForFunction(() => window.__game?.loop?.frame > 2);
    if (enabled) console.log("ADAPTER", await page.evaluate(() => {
      const gl = window.__game.renderer.gl, ext = gl.getExtension("WEBGL_debug_renderer_info");
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    }));
    if (enabled) {
      await page.waitForFunction(() => window.nullbornsPerformance?.snapshot().metrics["frame.cpu"]?.calls > 0);
      const result = await page.evaluate(async () => {
        const probe = window.nullbornsPerformance;
        await probe.enableRendererCounters();
        probe.reset();
        await new Promise(r => setTimeout(r, 300));
        const active = probe.snapshot().metrics["frame.cpu"].calls;
        const counters = probe.snapshot().rendererCounters;
        probe.stop();
        const before = JSON.stringify(probe.snapshot().metrics);
        await new Promise(r => setTimeout(r, 200));
        return { active, counters, stopped: before === JSON.stringify(probe.snapshot().metrics) };
      });
      assert.ok(result.active > 0); assert.ok(result.counters.drawCalls > 0); assert.equal(result.stopped, true);
      assert.equal(requests.length, 1);
    } else {
      assert.equal(await page.evaluate(() => window.nullbornsPerformance === undefined), true);
      assert.equal(requests.length, 0);
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("OK diagnóstico opt-in, reset, stop e ausência de importação quando desligado");
} finally { await browser.close(); }
