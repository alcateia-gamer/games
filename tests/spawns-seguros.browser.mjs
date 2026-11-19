/** Os dois mapas, sprites e corpos Arcade reais; spawns controlados com a IA pausada. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { novoBossConfig } from '../js/enemies/novoBoss/NovoBossConfig.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errors = [], pasta = process.env.ARTIFACT_DIR ?? '/tmp/spawns-seguros'; mkdirSync(pasta, { recursive: true });
page.on('pageerror', e => { errors.push(e.stack); console.error(e.stack); });
await page.route('**/js/core/game.js*', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: (await response.text()).replace('const game = new Game(jogoRapido);',
    'const game = window.__game = new Game(jogoRapido);') + '\nwindow.__spawnBootReady=true;' });
});
const report = {};
try {
  await page.goto(process.env.BASE_URL ?? 'http://127.0.0.1:8765/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__spawnBootReady);
  await page.keyboard.press('k'); await page.locator('.cutscene-skip').waitFor({ state: 'visible', timeout: 45000 });
  await page.locator('.cutscene-skip').click();
  await page.waitForFunction(() => window.__game?.scene.getScene('Level1')?.enemySpawnManager, null, { timeout: 90000 });
  console.log('CIDADE: verificando todas as zonas com sprites e corpos reais.');
  report.cidade = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('Level1'), m = s.enemySpawnManager;
    const { retanguloSpawnLivre, ampliarAreaNascimento, separacaoSpawnRobos } = await import('/js/enemies/EnemySpawnValidation.js');
    const { areaContemCorpo } = await import('/js/enemies/EnemySpawnArea.js');
    s.scene.pause();
    const limpar = () => { for (const r of [...s.inimigos]) m.removerInimigoInvalido(r); };
    const zonas = [];
    for (const region of m.regions) {
      region.targetCount = m.config.maxEnemies; // Inclui a zona estreita 639 com alvo de cinco.
      let total = 0;
      for (let rodada = 0; rodada < 4; rodada++) {
        limpar();
        // A onda já possui retentativa no jogo: uma primeira posição pode não
        // deixar espaço para o par obrigatório em regiões estreitas.
        for (let tentativa = 0; tentativa < 8 && new Set(region.enemies.map(r => r.tipoRobo)).size < 2; tentativa++)
          m.spawnRegion(region);
        const qtd = region.enemies.length;
        if (new Set(region.enemies.map(r => r.tipoRobo)).size < 2)
          throw new Error(`Zona ${region.id} sem par após retentativas: ${JSON.stringify(region.enemies.map(r => ({ tipo:r.tipoRobo,x:r.x,y:r.y })))}`);
        for (const r of region.enemies) {
          const visual = new Phaser.Geom.Rectangle(r.x - r.displayWidth / 2, r.y - r.displayHeight / 2, r.displayWidth, r.displayHeight);
          const area = region.area, margem = m.config.wallMargin;
          const buffer = { x: Math.min(visual.x, r.body.x) - margem, y: Math.min(visual.y, r.body.y) - margem,
            width: Math.max(visual.right, r.body.right) - Math.min(visual.x, r.body.x) + margem * 2,
            height: Math.max(visual.bottom, r.body.bottom) - Math.min(visual.y, r.body.y) + margem * 2 };
          if (!areaContemCorpo(area, r.body) ||
              !retanguloSpawnLivre(s, buffer) || !separacaoSpawnRobos({ inimigos: s.inimigos.filter(o => o !== r) }, r, visual))
            throw new Error(`Spawn inválido ${region.id}/${r.tipoRobo}: ${r.x},${r.y}`);
        }
        total += qtd;
      }
      zonas.push({ id: region.id, total, seguros: true });
    }
    const r = m.regions[0];
    s.cameras.main.stopFollow().setZoom(1).centerOn(r.center.x, r.center.y);
    limpar(); m.spawnRegion(r); s.children.depthSort();
    return zonas;
  });
  assert.equal(report.cidade.length, 7); await page.screenshot({ path: `${pasta}/01-cidade.png` });
  const config = { ...novoBossConfig, cenaEntrada: { ...novoBossConfig.cenaEntrada, ativo: false },
    prologo: { ...novoBossConfig.prologo, ativo: false }, ataques: { ...novoBossConfig.ataques, automatico: false } };
  await page.evaluate(config => {
    const s = window.__game.scene.getScene('Level1');
    s.scene.resume(); s.scene.start('Level1Parte2', { personagem: 'kai-mercer', spawnX: -1093, spawnY: -5520, novoBossConfig: config });
  }, config);
  await page.waitForFunction(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    return s?.scene.isActive() && s.spawnAreasRoboBola && s.player?.active && !s.cameras.main.fadeEffect.isRunning;
  }, null, { timeout: 90000 });
  console.log('FÁBRICA: verificando as 18 áreas e os portais.');
  report.fabrica = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('Level1Parte2'); s.scene.pause();
    const { criarRoboBola } = await import('/js/enemies/RoboBola.js');
    const { retanguloSpawnLivre, ampliarAreaNascimento, separacaoSpawnRobos } = await import('/js/enemies/EnemySpawnValidation.js');
    const { areaContemCorpo } = await import('/js/enemies/EnemySpawnArea.js');
    const { criarRoboOlhao } = await import('/js/enemies/RoboOlhao.js');
    const portais = [];
    for (const p of s.novoBoss.config.prologo.portais) {
      const r = criarRoboBola(s, p);
      if (!r || !retanguloSpawnLivre(s, r.body)) throw new Error('Portal sem spawn seguro');
      portais.push({ x: r.x, y: r.y, seguro: true }); r.destroy(); s.inimigos = s.inimigos.filter(r => r.active);
    }
    if (criarRoboBola(s, { x: 1e5, y: 1e5 }) || criarRoboOlhao(s, { x: 1e5, y: 1e5 }))
      throw new Error('Criação direta fora do mapa foi permitida');
    const areas = s.spawnAreasRoboBola.snapshot();
    const anteriores = new Set(s.inimigos); s.luzFabricaAcesa = true;
    const origens = [];
    for (const area of areas) {
      s.player.body.reset(area.x - 120, area.y + area.height / 2); s.player.body.updateFromGameObject();
      for (let i = 0; i < 25; i++) {
        s.spawnAreasRoboBola.atualizar(450);
        for (const r of s.inimigos) {
          if (anteriores.has(r)) continue;
          const a = areas.find(a => a.id === r.spawnAreaRoboBolaId);
          const buffer = new Phaser.Geom.Rectangle(r.body.x - 20, r.body.y - 20, r.body.width + 40, r.body.height + 40);
          const checks = { area: a && areaContemCorpo(ampliarAreaNascimento(a), buffer),
            colisao: retanguloSpawnLivre(s, buffer),
            separado: separacaoSpawnRobos({ inimigos: s.inimigos.filter(o => o !== r) }, r, r.getBounds()) };
          if (!checks.area || !checks.colisao || !checks.separado)
            throw new Error(`Spawn fábrica inválido: ${JSON.stringify({ id: r.spawnAreaRoboBolaId, x: r.x, y: r.y, buffer, checks, visual: r.getBounds() })}`);
          origens.push({ id: a.id, x: r.x, y: r.y }); anteriores.add(r);
        }
      }
    }
    s.cameras.main.stopFollow().setZoom(1).centerOn(-1020, -2810); s.children.depthSort();
    return { portais, areas: s.spawnAreasRoboBola.snapshot(), origens };
  });
  assert.equal(report.fabrica.areas.length, 18);
  assert.ok(report.fabrica.areas.every(a => a.invocados > 0 && a.invocados <= a.total && a.total <= 7), JSON.stringify(report.fabrica.areas));
  assert.equal(report.fabrica.areas.filter(a => [1625, 1629, 1630].includes(a.id)).reduce((s, a) => s + a.invocados, 0), 7);
  // Avança a IA e o Arcade reais sem reativar iluminação e interface de toda a
  // fábrica no headless. Valida também os primeiros passos e a flutuação.
  report.fabrica.aposFisica = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('Level1Parte2');
    const { retanguloSpawnLivre } = await import('/js/enemies/EnemySpawnValidation.js');
    const { atualizarRoboBola } = await import('/js/enemies/RoboBola.js');
    for (let i = 0; i < 15; i++) {
      s.time.now += 1000 / 60;
      atualizarRoboBola(s, s.time.now, 1000 / 60);
      s.physics.world.update(s.time.now, 1000 / 60); s.physics.world.postUpdate();
    }
    s.children.depthSort();
    return s.inimigos.filter(r => r.active && !r.morto).every(r => retanguloSpawnLivre(s, r.body));
  });
  assert.ok(report.fabrica.aposFisica);
  await page.screenshot({ path: `${pasta}/02-fabrica.png` });
  assert.deepEqual(errors, []);
  writeFileSync(`${pasta}/relatorio.json`, JSON.stringify({ ...report, errors }, null, 2));
  console.log(`PASS: 7 zonas da cidade, 18 áreas da fábrica, portais e rejeição de spawns fora do mapa. ${pasta}`);
} catch (error) {
  await page.screenshot({ path: `${pasta}/falha.png` }).catch(() => {});
  writeFileSync(`${pasta}/parcial.json`, JSON.stringify({ ...report, errors }, null, 2)); throw error;
} finally { await browser.close(); }
