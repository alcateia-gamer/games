/** Diagnóstico de quadros com combate automático real; não simula celular físico. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { abrirSessaoNovoBoss } from './novo-boss-browser-helpers.mjs';
import { novoBossConfig } from '../js/enemies/novoBoss/NovoBossConfig.js';

const session = await abrirSessaoNovoBoss({ ...novoBossConfig,
  cenaEntrada: { ...novoBossConfig.cenaEntrada, ativo: false },
  prologo: { ...novoBossConfig.prologo, ativo: false },
});
try {
  await session.posicionar(-1093, -5520);
  await session.page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    s.player.invulneravel = true;
    window.__combatAttacks = [];
    s.events.on('novo-boss:ataque-iniciado', ({ tipo }) => window.__combatAttacks.push(tipo));
  });
  await session.retomar();
  await session.page.waitForTimeout(2000);
  const report = await session.page.evaluate(() => new Promise(resolve => {
    const scene = window.__game.scene.getScene('Level1Parte2');
    const start = performance.now(), intervals = [];
    let previous = start, peakProjectiles = 0;
    const sample = () => {
      const now = performance.now();
      intervals.push(now - previous); previous = now;
      peakProjectiles = Math.max(peakProjectiles, scene.novoBoss.projeteisBoss.length);
    };
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sample);
    setTimeout(() => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sample);
      const elapsedMs = performance.now() - start;
      intervals.sort((a, b) => a - b);
      resolve({ elapsedMs, frames: intervals.length, fps: intervals.length * 1000 / elapsedMs,
        p95FrameMs: intervals[Math.floor(intervals.length * .95)], peakProjectiles,
        attacks: window.__combatAttacks, viewport: { width: innerWidth, height: innerHeight },
        renderer: scene.game.renderer.type, userAgent: navigator.userAgent });
    }, 20000);
  }));
  assert.ok(report.attacks.length > 0, 'A amostra precisa incluir ataques reais.');
  assert.deepEqual(session.errors, []);
  assert.deepEqual(session.assetErrors, []);
  writeFileSync('/tmp/boss-combat-performance.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await session.fechar(); }
