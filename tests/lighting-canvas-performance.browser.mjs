/** Compara backends de Canvas somente no servidor de teste, sem trocar a produção. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
if (process.env.LIGHTING_CANVAS_EXPERIMENT !== "1") throw new Error("Use LIGHTING_CANVAS_EXPERIMENT=1");
const session = await abrirSessaoNovoBoss({ ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
}, { spawnX: -1100, spawnY: -4800 }, { viewport: { width: 960, height: 540 }, hasTouch: true, isMobile: true,
  userAgent: "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36" }, { waitForBoss: false });
try {
  const cdp = await session.context.newCDPSession(session.page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const reports = [];
  for (let batch = 0; batch < 4; batch++) {
    const cpu = batch % 2 === 1;
    await session.page.evaluate(cpu => { window.__lightingCanvasCPU = cpu; }, cpu);
    await session.reiniciar();
    const report = await session.page.evaluate(async () => {
      const game = window.__game, scene = game.scene.getScene("Level1Parte2"), c = scene.cameras.main;
      const { installPerformanceProbe } = await import("/debug/PerformanceProbe.js");
      const probe = installPerformanceProbe(game, { observeLongTasks: false });
      probe.watchScene(scene);
      const texture = scene.textures.get("level1-parte2-escuridao");
      const images = [], times = [];
      c.stopFollow().setZoom(1);
      scene.definirIluminacaoFabrica(false);
      for (const z of scene.zonasLuzApagada.zonas) { z.liberada = z.restaurada = true; z.opacidade = 0; }
      try {
        for (let i = 0; i < 40; i++) {
          scene.time.now = 1000 + i*1000/30;
          scene.player.setPosition(-1100+i*2,-5200).setTexture("walk", i%4);
          c.centerOn(scene.player.x,scene.player.y);
          if (i === 10) probe.reset();
          const start = performance.now(); game.step(1000+i*1000/30, 1000/30);
          if (i >= 10) times.push(performance.now()-start);
          if (i === 39) images.push(texture.getSourceImage().toDataURL());
        }
        times.sort((a,b) => a-b);
        const { metrics, counters } = probe.snapshot();
        return { cpu: texture.context.getContextAttributes().willReadFrequently, frames: times.length,
          mean: times.reduce((a,b) => a+b,0)/times.length, median: times[14], p95: times[28], max: times[29],
          metrics, counters, images, listeners: game.renderer.listenerCount("render") };
      } finally { probe.stop(); }
    });
    assert.equal(report.cpu, cpu);
    reports.push(report);
  }
  const identical = reports.every(r => JSON.stringify(r.images) === JSON.stringify(reports[0].images));
  for (const r of reports) delete r.images;
  writeFileSync("/tmp/nullborns-stage3-canvas.json", JSON.stringify({ identical, reports, errors: session.errors },null,2));
  console.log(JSON.stringify({ identical, reports }));
  assert.equal(identical, true, "a troca de backend não pode alterar os pixels");
  assert.deepEqual(session.errors, []);
} finally { await session.fechar(); }
