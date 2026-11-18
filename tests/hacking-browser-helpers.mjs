import { novoBossConfig } from '../js/enemies/novoBoss/NovoBossConfig.js';
export const configBossHacking = { ...novoBossConfig,
  cenaEntrada: { ...novoBossConfig.cenaEntrada, ativo: false },
  prologo: { ...novoBossConfig.prologo, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, automatico: false } };
export async function iniciarJogoHacking(page) {
  await page.route('**/js/core/game.js*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replace('const game = new Game(jogoRapido);',
      'const game = window.__game = new Game(jogoRapido);') + '\nwindow.__hackingBootReady=true;' });
  });
  await page.goto(process.env.BASE_URL ?? 'http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
  await assumirControleHacking(page);
}
export async function assumirControleHacking(page) {
  await page.waitForFunction(() => window.__hackingBootReady); await page.keyboard.press('k');
  await page.locator('.cutscene-skip').waitFor({ state: 'visible', timeout: 60000 });
  await page.locator('.cutscene-skip').click();
  await page.waitForFunction(() => window.__game.scene.getScene('Level1')?.player?.active, null, { timeout: 90000 });
}
export async function entrarFabricaHacking(page, multiplayer = false) {
  await page.evaluate(({ multiplayer, config }) => {
    const s = window.__game.scene.getScenes(true).find(s => ['Level1', 'Level1Parte2'].includes(s.sys.settings.key));
    const manager = window.__manager;
    s.scene.start('Level1Parte2', { multiplayer, personagem: multiplayer ? manager?.room?.players.find(p => p.id === manager.playerId)?.character ?? 'kai-mercer' : 'kai-mercer',
      spawnX: 1000, spawnY: -1896, novoBossConfig: config });
  }, { multiplayer, config: configBossHacking });
  await page.waitForFunction(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    return s?.scene.isActive() && s.hackingTerminals && s.player?.active && !s.cameras.main.fadeEffect.isRunning;
  }, null, { timeout: 90000 });
}
export function resolverBreach(s) {
  const sequence = s.alvos.flatMap(a => a.codigo);
  function visitar(path = [], eixo = 'linha', faixa = 0) {
    if (path.length === sequence.length) return path;
    for (let i = 0; i < 25; i++) {
      if (path.includes(i) || s.grade[i] !== sequence[path.length] ||
          (eixo === 'linha' ? Math.floor(i / 5) !== faixa : i % 5 !== faixa)) continue;
      const next = visitar([...path, i], eixo === 'linha' ? 'coluna' : 'linha', eixo === 'linha' ? i % 5 : Math.floor(i / 5));
      if (next) return next;
    }
    return null;
  }
  return visitar();
}

export async function tocarInteracaoHacking(page) {
  await page.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').botaoColetarItem.visible);
  const point = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2'), b = s.botaoColetarItem, c = s.cameras.main;
    const r = window.__game.canvas.getBoundingClientRect(), size = s.scale.gameSize;
    const x = c.width * c.originX + (b.x - c.width * c.originX) * c.zoomX;
    const y = c.height * c.originY + (b.y - c.height * c.originY) * c.zoomY;
    return { x: r.left + (c.x + x) * r.width / size.width, y: r.top + (c.y + y) * r.height / size.height };
  });
  await page.mouse.click(point.x, point.y);
}
