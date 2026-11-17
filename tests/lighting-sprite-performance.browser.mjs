/** Quadro completo com aliados visuais fora da câmera: efeito sobre invalidações, não sobre sua lógica. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
if (process.env.LIGHTING_SPRITE_EXPERIMENT !== "1") throw new Error("Use LIGHTING_SPRITE_EXPERIMENT=1");
const session = await abrirSessaoNovoBoss(novoBossConfig, { spawnX: -1100, spawnY: -4800 }, {
  viewport: { width: 960, height: 540 }, hasTouch: true, isMobile: true,
  userAgent: "Mozilla/5.0 (Linux; Android 12; Mobile) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
}, { waitForBoss: false });
try {
  const cdp = await session.context.newCDPSession(session.page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const validationOnly = process.env.LIGHTING_SPRITE_VALIDATE_ONLY === "1";
  const visible = process.env.LIGHTING_SPRITE_ONSCREEN === "1";
  const report = await session.page.evaluate(async ({ validationOnly, visible }) => {
    const game = window.__game, scene = game.scene.getScene("Level1Parte2"), c = scene.cameras.main;
    const texture = scene.textures.get("level1-parte2-escuridao");
    const { installPerformanceProbe } = await import("/debug/PerformanceProbe.js");
    const probe = installPerformanceProbe(game, { observeLongTasks: false });
    probe.watchScene(scene);
    const remotes = Array.from({ length: 3 }, (_,i) => scene.add.sprite(10000+i*100, -4800, "walk", 0));
    for (let i = 0; i < remotes.length; i++) scene.remotePlayers.set(`experiment-${i}`, remotes[i]);
    c.stopFollow().setZoom(1).centerOn(-1100,-4800);
    scene.player.setVelocity(0,0).setTexture("walk",0);
    scene.definirIluminacaoFabrica(true);
    for (const z of scene.zonasLuzApagada.zonas) { z.liberada = z.restaurada = true; z.opacidade = 0; }
    const batches = [], references = new Map();
    let identical = true;
    try {
      for (let batch = 0; batch < (validationOnly ? 0 : 4); batch++) {
        const optimized = batch % 2 === 1;
        window.__lightingSpriteCull = optimized;
        const times = [];
        for (let i = 0; i < 60; i++) {
          scene.time.now = 1000+i*1000/30;
          for (let j = 0; j < remotes.length; j++) remotes[j].setPosition(visible ? -1100+j*20+i*2 : 10000+j*100+i*2,-4800).setFrame(i%4);
          if (i === 10) probe.reset();
          const start = performance.now(); game.step(1000+i*1000/30,1000/30);
          if (i >= 10) times.push(performance.now()-start);
          if ([10,30,59].includes(i)) {
            const image = texture.getSourceImage().toDataURL();
            if (!references.has(i)) references.set(i,image);
            else if (image !== references.get(i)) identical = false;
          }
        }
        times.sort((a,b) => a-b);
        const { metrics, counters } = probe.snapshot();
        batches.push({ optimized, mean: times.reduce((a,b)=>a+b,0)/times.length, median: times[24],
          p95: times[47], p99: times[49], max: times[49], metrics, counters });
      }
      const sequences = new Map();
      let sequenceCases = 0;
      if (!visible) for (const rotated of [false,true]) for (const optimized of [false,true]) {
        window.__lightingSpriteCull = optimized;
        scene.definirIluminacaoFabrica(true);
        c.setRotation(rotated ? .17 : 0).setZoom(rotated ? 1.35 : 1);
        c.setViewport(0,0,rotated ? 801 : 800,rotated ? 451 : 450);
        for (let i=0;i<20;i++) {
          scene.time.now=1000+i*1000/30;
          const sprite=remotes[0];
          sprite.setPosition(-1650+i*50,-4800).setFrame(i%4).setRotation(i*.05)
            .setScale(i%2 ? -.5 : .5,.7).setFlip(i%3===0,i%4===0)
            .setVisible(i%5!==0).setActive(i%7!==0).setAlpha(i%2 ? .6 : 1);
          for (let j=1;j<remotes.length;j++) remotes[j].setPosition(10000+j*100,-4800).setFrame(i%4);
          game.step(1000+i*1000/30,1000/30);
          const key=`${rotated}:${i}`, image=texture.getSourceImage().toDataURL();
          if (!sequences.has(key)) sequences.set(key,image);
          else { sequenceCases++; if (image!==sequences.get(key)) identical=false; }
        }
      }
      return { identical, batches, sequenceCases, visible };
    } finally {
      probe.stop();
      for (let i = 0; i < remotes.length; i++) { scene.remotePlayers.delete(`experiment-${i}`); remotes[i].destroy(); }
    }
  }, { validationOnly, visible });
  writeFileSync(`/tmp/nullborns-stage3-${visible ? "sprite-visible-control" : validationOnly ? "sprite-validation" : "sprite"}.json`, JSON.stringify({ ...report, errors: session.errors },null,2));
  console.log(JSON.stringify(report));
  assert.equal(report.identical,true); assert.deepEqual(session.errors,[]);
} finally { await session.fechar(); }
