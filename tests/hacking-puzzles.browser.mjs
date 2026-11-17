import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { iniciarJogoHacking, entrarFabricaHacking, resolverBreach, tocarInteracaoHacking } from './hacking-browser-helpers.mjs';
import { MATRIX_NODES as N } from '../js/puzzles/HackingConfig.js';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 }, hasTouch: true });
const errors = [], report = {}, pasta = process.env.ARTIFACT_DIR ?? '/tmp/hacking-puzzles'; mkdirSync(pasta, { recursive: true });
page.on('pageerror', e => { errors.push(e.stack); console.error(e.stack); });
page.on('console', m => { if (m.type() === 'error' && m.text().startsWith('MATRIX:')) console.error(m.text()); });
page.setDefaultTimeout(20000);
const estado = () => page.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal());
async function moverMundo(x, y) {
  await page.evaluate(({ x, y }) => {
    const s = window.__game.scene.getScene('Level1Parte2');
    s.player.body.reset(x, y); s.player.body.updateFromGameObject(); s.player.setVelocity(0, 0); s.player.invulneravel = true;
  }, { x, y }); await page.waitForTimeout(100);
}
async function andar(no) {
  const dest = N[no], pressed = new Set();
  try {
    for (let i = 0; i < 140; i++) {
      const avatar = (await estado()).model.avatar, dx = dest.x - avatar.x, dy = dest.y - avatar.y;
      if (Math.hypot(dx, dy) < 8) return;
      const desired = new Set();
      if (Math.abs(dx) > 5) desired.add(dx > 0 ? 'd' : 'a');
      if (Math.abs(dy) > 5) desired.add(dy > 0 ? 's' : 'w');
      for (const key of [...pressed]) if (!desired.has(key)) { await page.keyboard.up(key); pressed.delete(key); }
      for (const key of desired) if (!pressed.has(key)) { await page.keyboard.down(key); pressed.add(key); }
      await page.waitForTimeout(70);
    }
    throw new Error(`Não alcançou ${no}: ${JSON.stringify((await estado()).model.avatar)}`);
  } finally { for (const key of pressed) await page.keyboard.up(key); await page.waitForTimeout(60); }
}
async function interagir() { await page.locator('.matrix-action').click(); await page.waitForTimeout(100); }
try {
  console.log('BOOT: puzzles no jogo real.'); await iniciarJogoHacking(page); await entrarFabricaHacking(page);
  assert.ok(await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    return !s.hackingTerminals.permitePortas() && s.portasFabrica.every(p => !p.abrirPelaRede());
  }));
  await tocarInteracaoHacking(page); await page.waitForTimeout(200); assert.equal(await estado(), null);
  await page.evaluate(() => window.__game.scene.getScene('Level1Parte2').acenderLuzFabrica());
  await tocarInteracaoHacking(page); await page.waitForTimeout(350);
  await page.screenshot({ path: `${pasta}/00-pet-no-terminal.png` });
  await page.locator('.hacking-overlay').waitFor();
  report.dock = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2'); return { player: { x: s.player.x, y: s.player.y },
      pet: { x: s.companionPet.x, y: s.companionPet.y, emHack: s.companionPet.emHack }, pause: s.physics.world.isPaused };
  });
  assert.ok(report.dock.pet.emHack && report.dock.pause); assert.equal(report.dock.pet.x, 1032);
  assert.ok(Math.hypot(report.dock.player.x - 1000, report.dock.player.y + 1896) > 5);
  await page.screenshot({ path: `${pasta}/01-breach.png` });
  // Headless Shell aceita o fullscreen por toque; o CDP exige sair dele para
  // emular outra orientação, como fazemos nas próximas verificações de layout.
  await page.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
  for (const [width, height] of [[568, 320], [390, 844]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.locator('.hacking-grid button').evaluateAll(c => c.every(b => b.getBoundingClientRect().height >= 44 && b.getBoundingClientRect().width >= 44)));
    assert.ok((await page.locator('.hacking-panel h2').boundingBox()).y >= 0);
    const grid = await page.locator('.hacking-grid').boundingBox(); assert.ok(grid.y + grid.height <= height);
    await page.screenshot({ path: `${pasta}/breach-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.locator('.hacking-close').click();
  assert.ok(await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    return !s.generatorMenuOpen && !s.movimentoBloqueado && s.input.keyboard.enabled && !s.physics.world.isPaused && !s.companionPet.emHack;
  }));
  await moverMundo(1000, -1896); await tocarInteracaoHacking(page); await page.locator('.hacking-overlay').waitFor();
  await page.locator('[data-cell="0"]').click();
  // Emula a passagem do tempo pelo mesmo update público, sem esperar 90 s reais.
  await page.evaluate(() => { const s = window.__game.scene.getScene('Level1Parte2'); for (let i = 0; i < 901; i++) s.hackingTerminals.atualizar(s.time.now, 100); });
  await page.locator('.hacking-retry').waitFor({ state: 'visible' });
  await page.screenshot({ path: `${pasta}/02-falha.png` }); await page.locator('.hacking-retry').click();
  await page.evaluate(async () => {
    const s = window.__game.scene.getScene('Level1Parte2');
    const { causarDanoPlayer } = await import('/js/enemies/EnemyLaser.js');
    s.vida = 1; s.player.invulneravel = false; causarDanoPlayer(s, 10000);
  });
  await page.locator('.hacking-overlay').waitFor({ state: 'detached' });
  await page.waitForFunction(() => {
    const s = window.__game.scene.getScene('Level1Parte2'); return s.vida > 0 && !s.morteEmAndamento;
  });
  assert.ok(await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    return s.input.enabled && s.input.keyboard.enabled && !s.movimentoBloqueado && !s.generatorMenuOpen && !s.physics.world.isPaused;
  }));
  report.morteCancelaEReanima = true;
  await moverMundo(1000, -1896); await tocarInteracaoHacking(page); await page.locator('.hacking-overlay').waitFor();
  const path = resolverBreach((await estado()).model); assert.ok(path);
  for (const cell of path) await page.locator(`[data-cell="${cell}"]`).tap();
  await page.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.permitePortas());
  await page.locator('.hacking-overlay').waitFor({ state: 'detached' });
  report.fabrica = await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2'); return s.hackingTerminals.snapshot().progress;
  }); assert.ok(report.fabrica.fabrica && report.fabrica.robos && report.fabrica.registro);
  await tocarInteracaoHacking(page); await page.locator('.axiom-record-overlay').waitFor();
  const textoRegistro = await page.locator('.axiom-record-body').innerText();
  for (const trecho of ['Reset', 'EDEN', 'The Hollow', '04 segundos', 'VISUAL', 'REDE', 'suporte à vida']) assert.ok(textoRegistro.includes(trecho));
  assert.ok(await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    return s.generatorMenuOpen && s.movimentoBloqueado && !s.input.enabled && s.physics.world.isPaused && !s.hackingTerminals.temSessao();
  }));
  for (const [width, height] of [[568, 320], [390, 844]]) {
    await page.setViewportSize({ width, height });
    const fechar = await page.locator('.axiom-record-close').boundingBox(), voltar = await page.locator('.axiom-record-return').boundingBox();
    assert.ok(fechar.height >= 44 && fechar.y >= 0 && voltar.y + voltar.height <= height);
    await page.screenshot({ path: `${pasta}/registro-inicio-${width}x${height}.png` });
    await page.locator('.axiom-record-clue').scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${pasta}/registro-${width}x${height}.png` });
  }
  await page.keyboard.press('Escape'); await page.locator('.axiom-record-overlay').waitFor({ state: 'detached' });
  await page.setViewportSize({ width: 1100, height: 700 });
  await tocarInteracaoHacking(page); await page.locator('.axiom-record-overlay').waitFor();
  await page.locator('.axiom-record-return').click();
  assert.deepEqual(await page.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.snapshot().progress), report.fabrica);
  assert.ok(await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    return s.input.enabled && s.input.keyboard.enabled && !s.generatorMenuOpen && !s.movimentoBloqueado && !s.physics.world.isPaused && s.player.body.moves;
  }));
  await tocarInteracaoHacking(page); await page.locator('.axiom-record-overlay').waitFor();
  await page.evaluate(async () => {
    const s = window.__game.scene.getScene('Level1Parte2'), { causarDanoPlayer } = await import('/js/enemies/EnemyLaser.js');
    s.vida = 1; s.player.invulneravel = false; causarDanoPlayer(s, 10000);
  });
  await page.locator('.axiom-record-overlay').waitFor({ state: 'detached' });
  await page.waitForFunction(() => { const s = window.__game.scene.getScene('Level1Parte2'); return s.vida > 0 && !s.morteEmAndamento; });
  assert.ok(await page.evaluate(() => {
    const s = window.__game.scene.getScene('Level1Parte2');
    return s.input.enabled && s.input.keyboard.enabled && !s.generatorMenuOpen && !s.movimentoBloqueado && !s.physics.world.isPaused;
  }));
  report.registroConsultavel = { releitura: true, mobile: true, progressoPreservado: true, morteLiberaControles: true };
  await moverMundo(312, -1788); await tocarInteracaoHacking(page);
  await page.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').portasFabrica.find(p => p.nome === 'porta04').estado === 'aberta');
  await page.screenshot({ path: `${pasta}/03-porta-liberada.png` }); console.log('PASS: fábrica, cancelamento, falha, bônus, portas e layouts mobile.');
  if (process.env.HACKING_PHASE !== 'factory') {
    await moverMundo(-240, -5830);
    assert.equal(await page.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.enviar({ op: 'abrir', tipo: 'matrix' })), false);
    await moverMundo(-1093, -5520); await page.waitForTimeout(300);
    await page.evaluate(() => { const s = window.__game.scene.getScene('Level1Parte2'); s.novoBoss.receberDano(100000); });
    await page.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').novoBoss.morto);
    await moverMundo(-240, -5830); await tocarInteracaoHacking(page); await page.locator('.matrix-ui').waitFor();
    await page.setViewportSize({ width: 568, height: 320 });
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate(() => window.__game.domContainer.style.display), 'none');
    assert.equal(await page.evaluate(() => window.__game.scene.getScene('Level1Parte2').sys.settings.visible), false);
    await page.screenshot({ path: `${pasta}/04-matrix.png` });
    await andar('memoria');
    await page.locator('.matrix-memory input').fill('4'); await page.locator('.examinar').click();
    await page.locator('[data-layer="rede"]').click(); await page.locator('.examinar').click();
    assert.ok((await estado()).model.anomalia); await page.screenshot({ path: `${pasta}/05-memoria.png` });
    await andar('anomalia'); await interagir(); await andar('roteador'); await interagir(); await interagir();
    assert.equal((await estado()).model.rota, 'desvio');
    await andar('vidaA'); await interagir(); await andar('vidaB'); await interagir();
    await andar('comunicacao'); await interagir(); await page.screenshot({ path: `${pasta}/06-suporte-protegido.png` });
    await andar('desvio'); await andar('abrigo'); await interagir(); await andar('entrada'); await interagir();
    await page.waitForFunction(() => {
      const s = window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model;
      return s?.estado === 'executando' && s.conclusao > .4;
    }, null, { timeout: 60000 });
    await page.screenshot({ path: `${pasta}/07-execucao.png` });
    await page.waitForFunction(() => document.querySelector('.hacking-victory'), null, { timeout: 10000 });
    await page.screenshot({ path: `${pasta}/07-conclusao.png` });
    report.final = await page.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.snapshot());
    assert.ok(report.final.progress.final); assert.ok(report.final.session.model.vida.preservada);
    assert.equal(report.final.dock, null);
    assert.equal(await page.evaluate(() => window.__game.scene.getScene('Level1Parte2').companionPet.emHack), false);
    console.log('PASS: MATRIX jogável, memória, anomalia, rotas, ICE, proteção vital e conclusão integrada.');
  }
  if (process.env.HACKING_PHASE === 'factory') {
    await moverMundo(1000, -1896); await tocarInteracaoHacking(page); await page.locator('.axiom-record-overlay').waitFor();
    await page.evaluate(() => { window.__game.scene.getScene('Level1Parte2').scene.stop(); });
    await page.locator('.axiom-record-overlay').waitFor({ state: 'detached' });
    report.registroConsultavel.trocaCenaFecha = true;
  }
  assert.deepEqual(errors, []); writeFileSync(`${pasta}/relatorio.json`, JSON.stringify({ ...report, errors }, null, 2));
} catch (error) {
  report.diagnostico = await page.evaluate(() => {
    const s = window.__game?.scene.getScene('Level1Parte2');
    return s && { x: s.player?.x, y: s.player?.y, vida: s.vida, luz: s.luzFabricaAcesa,
      menu: s.generatorMenuOpen, devMenu: s.devItemMenuOpen, upgrade: s.upgradeMenuOpen,
      atacando: s.atacando, dash: s.estadoDash?.ativo, intro: s.cenaEntradaBossAtiva,
      key: s.input.keyboard.enabled, sessao: s.hackingTerminals?.snapshot() };
  }).catch(() => null); console.error('DIAG', JSON.stringify(report.diagnostico));
  await page.screenshot({ path: `${pasta}/falha.png` }).catch(() => {});
  writeFileSync(`${pasta}/parcial.json`, JSON.stringify({ ...report, errors }, null, 2)); throw error;
} finally { await browser.close(); }
