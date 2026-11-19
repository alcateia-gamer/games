/** Diagnóstico isolado das luzes fixas; não mede o FPS do combate completo. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
const label = process.argv[2] ?? "after";
const session = await abrirSessaoNovoBoss({ ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false, automatico: false },
});
try {
  let fps = null;
  if (process.env.LIGHTING_MEASURE_FPS === "1") {
    const sample = () => session.page.evaluate(() => new Promise(resolve => {
      const s = window.__game.scene.getScene("Level1Parte2"), start = performance.now();
      let frames = 0;
      const count = () => { frames++; };
      s.events.on(Phaser.Scenes.Events.POST_UPDATE, count);
      setTimeout(() => {
        s.events.off(Phaser.Scenes.Events.POST_UPDATE, count);
        resolve(frames * 1000 / (performance.now() - start));
      }, 3000);
    }));
    await session.retomar();
    const opening = await sample();
    await session.page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2")
      .novoBoss.introducao.snapshot().concluida, null, { timeout: 90000 });
    const combat = await sample();
    await session.pausar();
    fps = { opening, combat, sampleMs: 3000, automaticAttacks: false };
  }
  const report = await session.page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2"), c = s.cameras.main;
    const Cache = (await import("/js/effects/FixedLightCache.js")).default;
    const update = Cache.prototype.atualizar, draw = Cache.prototype.desenhar;
    let factors = 0, cache;
    Cache.prototype.atualizar = function(now, zones, ...rest) {
      const factor = zones.fatorLuz;
      zones.fatorLuz = function(...args) { factors++; return factor.apply(this, args); };
      try { return update.call(this, now, zones, ...rest); }
      finally { zones.fatorLuz = factor; }
    };
    Cache.prototype.desenhar = function(...args) { cache = this; return draw.apply(this, args); };
    // Isola as fontes fixas: aura/ataques são validados nos roteiros de combate.
    s.iluminacaoEnergiaBoss.atualizar = () => [];
    const intro = s.novoBoss.introducao.iluminacao;
    intro.restaurar();
    s.acenderLuzFabrica();
    s.iluminacaoFabrica.partida = null;
    s.iluminacaoFabrica.progressoPartida = null;
    s.iluminacaoFabrica.atualizar = () => [];
    for (const z of s.zonasLuzApagada.zonas) { z.liberada = z.restaurada = true; z.opacidade = 0; }
    s.zonasLuzApagada.revisao++;
    c.stopFollow().setZoom(1).centerOn(-1093, -5770);
    c.preRender();
    const render = s.game.renderer.listeners("render").find(f => f.name === "atualizarIluminacao");
    if (!render) throw new Error("compositor não encontrado");
    const texture = s.textures.get("level1-parte2-escuridao");
    const refresh = texture.refresh.bind(texture);
    let uploads = 0;
    texture.refresh = () => { uploads++; return refresh(); };
    const rows = [];
    for (const moving of [false, true]) {
      const times = [];
      for (let i = 0; i < 150; i++) {
        if (i === 30) { factors = 0; uploads = 0; }
        s.time.now += 1000 / 60;
        if (moving) s.player.x += i % 2 ? 1 : -1;
        const start = performance.now(); render(s, c);
        if (i >= 30) times.push(performance.now() - start);
      }
      times.sort((a, b) => a - b);
      rows.push({ moving, frames: times.length, meanMs: times.reduce((a, b) => a + b) / times.length,
        p95Ms: times[Math.floor(times.length * .95)], factors, uploads });
    }
    const canvases = [cache.canvasMascara, cache.canvasCor, ...cache.fontes.flatMap(f => f.carimbos ?? [])];
    const memory = { sources: cache.fontes.length, atlasWidth: cache.canvasCor.width,
      atlasHeight: cache.canvasCor.height, individual: cache.individual,
      cacheRgbaBytes: canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0) };
    // Mesma máscara sem sprites para comparar a composição estática entre versões.
    s.player.visible = false; render(s, c);
    const image = texture.getSourceImage().toDataURL();
    const introImages = [];
    intro.iniciar(s.iluminacaoEmergencia.luzes);
    for (const [progress, aura] of [[0, 0], [.5, 0], [1, 0], [1, .25], [1, 1]]) {
      intro.avancar(progress); intro.perceber(aura); render(s, c);
      introImages.push(texture.getSourceImage().toDataURL());
    }
    return { rows, memory, image, introImages };
  });
  const { image, introImages, ...measurements } = report;
  const metrics = { ...measurements, fps };
  writeFileSync(`/tmp/boss-static-lighting-${label}.json`, JSON.stringify(metrics, null, 2));
  writeFileSync(`/tmp/boss-static-lighting-${label}.png`, Buffer.from(image.split(",")[1], "base64"));
  introImages.forEach((data, i) => writeFileSync(`/tmp/boss-static-intro-${label}-${i}.png`,
    Buffer.from(data.split(",")[1], "base64")));
  console.log(JSON.stringify(metrics, null, 2));
  if (label === "after") {
    assert.ok(metrics.rows.every(r => r.factors === 0), "movimento não recalcula a intensidade das fontes fixas");
    assert.equal(metrics.rows[0].uploads, 0, "sem mudança de câmera ou silhueta, reutiliza o overlay");
    assert.equal(metrics.memory.individual, false);
  }
  assert.deepEqual(session.errors, []);
  assert.deepEqual(session.assetErrors, []);
} finally { await session.fechar(); }
