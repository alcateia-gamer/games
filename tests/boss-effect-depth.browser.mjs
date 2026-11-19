import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/tmp/nullborns-test-tools/node_modules/playwright/index.mjs');
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; page.on('pageerror', e => errors.push(e.stack));
try {
  await page.route('**/js/core/game.js*', async r => { const response = await r.fetch(); await r.fulfill({ response,
    body: (await response.text()).replace('const game = new Game(jogoRapido);', 'const game = window.__game = new Game(jogoRapido);') }); });
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:8765'); await page.keyboard.press('k', { delay: 100 });
  await page.locator('.cutscene-skip').waitFor(); await page.locator('.cutscene-skip').click();
  await page.waitForFunction(() => __game.scene.getScene('Level1')?.player?.active, null, { timeout: 120000 });
  await page.evaluate(async () => {
    const { novoBossConfig: c } = await import('/js/enemies/novoBoss/NovoBossConfig.js');
    __game.scene.getScene('Level1').scene.start('Level1Parte2', { personagem: 'kai-mercer', spawnX: -1093, spawnY: -5520,
      novoBossConfig: { ...c, cenaEntrada: { ...c.cenaEntrada, ativo: false }, ataques: { ...c.ataques, automatico: false } } });
  });
  await page.waitForFunction(() => __game.scene.isActive('Level1Parte2') && __game.scene.getScene('Level1Parte2').novoBoss?.geradores?.some(t => t.torre), null, { timeout: 90000 });
  await page.evaluate(() => {
    const s = __game.scene.getScene('Level1Parte2'); s.scene.pause();
  });
  await page.waitForFunction(() => __game.scene.isPaused('Level1Parte2'));
  const result = await page.evaluate(async () => {
    const s = __game.scene.getScene('Level1Parte2'), tower = s.novoBoss.geradores.find(t => t.torre);
    tower.visual.setVisible(true); tower.visual.setDepth(60);
    s.cameras.main.stopFollow().centerOn(s.player.x, s.player.y);
    s.movimentoBloqueado = false; s.estadoEspecial.proximoUso = 0;
    s.events.emit('player:especial');
    const { atualizarSistemaEspeciais } = await import('/js/combat/PlayerSpecialAbilities.js');
    const inicio = s.time.now;
    return [100, 400, 1800, 3900].map((tempo, i) => {
      s.player.setDepth(i % 2 === 0 ? 16.5 : 61);
      s.time.now = inicio + tempo;
      atualizarSistemaEspeciais(s);
      const { parryEfeito, parryGrafico } = s.estadoEspecial;
      return { player: s.player.depth, base: parryEfeito.sprite.depth, dome: parryGrafico.depth,
        elevado: parryEfeito.sprite.aboveBossTowers || parryGrafico.aboveBossTowers };
    });
  });
  for (const frame of result) {
    assert.ok(frame.base < frame.dome && frame.dome < frame.player && !frame.elevado, JSON.stringify(frame));
  }
  await page.waitForFunction(() => {
    const s = __game.scene.getScene('Level1Parte2');
    return s.children.list.find(o => o.texture?.key === 'level1-parte2-escuridao')?.depth > 60;
  });
  mkdirSync('/tmp/boss-effect-depth', { recursive: true }); await page.screenshot({ path: '/tmp/boss-effect-depth/fixed.png' });
  assert.deepEqual(errors, []); console.log('PASSOU: base e cúpula atrás de Kai e iluminação acima das torres no Phaser real', result);
} finally { await browser.close(); }
