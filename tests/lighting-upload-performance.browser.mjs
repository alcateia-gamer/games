/** A/B síncrono do quadro renderizado; cena pausada, câmera/animação/relógio determinísticos. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

const session = await abrirSessaoNovoBoss({ ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
}, {}, { viewport: { width: 960, height: 540 }, hasTouch: true, isMobile: true,
  userAgent: "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36" });
try {
  const cdp = await session.context.newCDPSession(session.page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const reports = [];
  for (const portrait of [false, true]) {
    if (portrait) {
      await session.page.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
      await session.page.setViewportSize({ width: 390, height: 844 });
      await session.page.waitForTimeout(500);
    }
    const report = await session.page.evaluate(async () => {
      const { experimentLightingUpload } = await import("/debug/LightingUploadExperiment.js");
      const game = window.__game, scene = game.scene.getScene("Level1Parte2"), camera = scene.cameras.main;
      const texture = scene.textures.get("level1-parte2-escuridao");
      const experiment = experimentLightingUpload(texture);
      const refresh = texture.refresh;
      let refreshMs = 0, uploads = 0, pixels = 0;
      texture.refresh = function(...args) {
        const start = performance.now();
        try { return refresh.apply(this, args); }
        finally { refreshMs += performance.now() - start; uploads++; pixels += this.width * this.height; }
      };
      const emit = game.renderer.emit;
      let lightingMs = 0;
      game.renderer.emit = function(event, ...args) {
        if (event !== "render") return emit.call(this, event, ...args);
        const start = performance.now();
        try { return emit.call(this, event, ...args); }
        finally { lightingMs += performance.now() - start; }
      };
      const summary = values => {
        const sorted = [...values].sort((a,b) => a-b);
        const p = n => sorted[Math.ceil(n * sorted.length)-1];
        return { mean: values.reduce((a,b) => a+b,0)/values.length, median: p(.5), p95: p(.95), p99: p(.99), max: sorted.at(-1) };
      };
      camera.stopFollow().setZoom(1);
      scene.player.setVelocity(0,0);
      for (const zone of scene.zonasLuzApagada.zonas) { zone.liberada = zone.restaurada = true; zone.opacidade = 0; }
      const batches = [];
      const referencePixels = new Map();
      let gpuIdentical = true;
      try {
        for (const power of [false, true]) {
          scene.definirIluminacaoFabrica(power);
          for (let batch = 0; batch < 4; batch++) {
            const optimized = batch % 2 === 1;
            experiment.enable(optimized);
            const times = [], uploadTimes = [], compositionTimes = [], images = [];
            let submittedPixels = 0, count = 0;
            for (let i = 0; i < 50; i++) {
              scene.time.now = 1000 + i * 1000/30;
              scene.player.setPosition(-1100 + i * 2, -5200).setTexture("walk", i % 4);
              camera.centerOn(scene.player.x, scene.player.y);
              refreshMs = uploads = pixels = lightingMs = 0;
              const start = performance.now();
              game.step(1000 + i * 1000/30, 1000/30);
              if (i >= 10) {
                times.push(performance.now()-start); uploadTimes.push(refreshMs);
                compositionTimes.push(lightingMs-refreshMs); count += uploads; submittedPixels += pixels;
              }
              // Validação síncrona somente depois de medir o quadro; nunca usada na partida normal.
              if ([10, 20, 30, 49].includes(i)) {
                const gl = game.renderer.gl;
                const output = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
                gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, output);
                const key = `${power}:${i}`, reference = referencePixels.get(key);
                if (!reference) referencePixels.set(key, output);
                else if (output.some((value, index) => value !== reference[index])) gpuIdentical = false;
              }
              // A imagem da máscara também é comparada, independentemente da textura GL.
              if (i === 49) images.push(texture.getSourceImage().toDataURL());
            }
            batches.push({ power, optimized, frame: summary(times), refreshCPU: summary(uploadTimes),
              renderListenersExcludingRefresh: summary(compositionTimes), uploads: count, submittedPixels, images });
          }
        }
        const identical = [false, true].every(power => {
          const group = batches.filter(b => b.power === power);
          return group.every(b => JSON.stringify(b.images) === JSON.stringify(group[0].images));
        });
        for (const batch of batches) delete batch.images;
        return { canvas: { width: game.canvas.width, height: game.canvas.height },
          mask: { width: texture.width, height: texture.height },
          device: { phaser: Phaser.VERSION, desktop: game.device.os.desktop, android: game.device.os.android,
            touch: game.device.input.touch }, identical, gpuIdentical, batches, stats: experiment.stats };
      } finally { texture.refresh = refresh; game.renderer.emit = emit; experiment.restore(); }
    });
    assert.equal(report.identical, true, "máscaras precisam ser idênticas");
    assert.equal(report.gpuIdentical, true, "quadros WebGL precisam ser idênticos");
    reports.push(report);
    writeFileSync("/tmp/nullborns-stage3-upload.json", JSON.stringify({ reports, errors: session.errors }, null, 2));
    console.log(JSON.stringify(report));
  }
  assert.deepEqual(session.errors, []);
} finally { await session.fechar(); }
