/** Quadro completo no Phaser real; ferramentas e saída ficam fora da produção. */
import { writeFileSync } from "node:fs";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

const label = process.argv[2] || "current";
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error("label inválido");
const scenarios = (process.env.PERF_SCENARIOS || "factory-idle,factory-moving,city-idle").split(",");
if (scenarios.some(s => !["factory-idle", "factory-moving", "factory-portrait", "city-idle"].includes(s))) {
  throw new Error("PERF_SCENARIOS inválido");
}
const session = await abrirSessaoNovoBoss(novoBossConfig, {}, {
  viewport: { width: 960, height: 540 }, hasTouch: true, isMobile: true,
  userAgent: "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
});
const { page } = session;
try {
  const cdp = await session.context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.CPU_RATE || 4) });
  const reports = [];
  for (const scenario of scenarios) {
    if (scenario === "city-idle") {
      await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").scene.start("Level1", { personagem: "kai-mercer" }));
      await page.waitForFunction(() => window.__game.scene.getScene("Level1").player?.active &&
        window.__game.scene.getScene("Level1").scene.isActive());
    } else await session.retomar();
    if (scenario === "factory-portrait") {
      await page.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    await page.waitForTimeout(2000);
    await page.evaluate(async () => {
      const { installPerformanceProbe } = await import("/debug/PerformanceProbe.js");
      window.__perfProbe = installPerformanceProbe(window.__game);
    });
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.start");
    if (scenario === "factory-moving") await page.keyboard.down("d");
    await page.waitForTimeout(Number(process.env.PERF_MS || 10000));
    if (scenario === "factory-moving") await page.keyboard.up("d");
    const snapshot = await page.evaluate(() => {
      const result = window.__perfProbe.snapshot();
      window.__perfProbe.stop(); delete window.__perfProbe;
      const gl = window.__game.renderer.gl;
      return { ...result, device: { userAgent: navigator.userAgent, dpr: devicePixelRatio,
        renderer: gl.getParameter(gl.RENDERER), maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) },
        heap: performance.memory ? { used: performance.memory.usedJSHeapSize, total: performance.memory.totalJSHeapSize } : null,
        lightingReasons: window.__lightReasons || null,
        mask: (() => { const t = window.__game.textures.list["level1-parte2-escuridao"];
          return t ? { width: t.width, height: t.height } : null; })() };
    });
    const { profile } = await cdp.send("Profiler.stop");
    writeFileSync(`/tmp/game-perf-${label}-${scenario}.cpuprofile`, JSON.stringify(profile));
    reports.push({ scenario, ...snapshot });
    console.log(JSON.stringify({ scenario, metrics: snapshot.metrics, scenes: snapshot.scenes, canvas: snapshot.canvas }));
  }
  writeFileSync(`/tmp/game-perf-${label}.json`, JSON.stringify({ cpuRate: Number(process.env.CPU_RATE || 4),
    requestedDurationMs: Number(process.env.PERF_MS || 10000), reports, errors: session.errors,
    assetErrors: session.assetErrors, consoleErrors: session.consoleErrors }, null, 2));
} finally { await session.fechar(); }
