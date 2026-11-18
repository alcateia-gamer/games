import assert from 'node:assert/strict';
export const sceneState = page => page.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal());
export async function dispensarTutorial(page) {
  if (!(await sceneState(page))?.model.tutorial) return;
  const tutorial = page.locator('.puzzle-tutorial-overlay');
  await tutorial.waitFor(); await tutorial.getByRole('button', { name: 'Pular tutorial', exact: true }).click();
  await tutorial.waitFor({ state: 'detached' });
}
export async function posicionarNullnet(page, x, y) {
  await page.evaluate(({ x, y }) => {
    const s = window.__game.scene.getScene('Level1Parte2');
    s.player.body.reset(x, y); s.player.body.updateFromGameObject(); s.player.setVelocity(0, 0); s.player.invulneravel = true;
  }, { x, y }); await page.waitForTimeout(350);
}
export async function resolverBruteforce(page) {
  const dialog = page.getByRole('dialog', { name: 'AXIOM // BRUTEFORCE', exact: true });
  await dialog.waitFor(); await dispensarTutorial(page);
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  const confirm = page.locator('.brute-confirm');
  await page.evaluate(async () => { window.__lerColuna = (await import('/js/puzzles/BruteforcePuzzle.js')).lerColuna; });
  for (let coluna = 0; coluna < 8; coluna++) {
    for (let tentativa = 0; tentativa < 10; tentativa++) {
      await confirm.scrollIntoViewIfNeeded();
      const box = await confirm.boundingBox(), erros = (await sceneState(page)).model.erros;
      await page.waitForFunction(coluna => {
        const s = window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model;
        if (!s || s.ativa !== coluna || s.colunas[coluna].falhaAte > s.tempo) return false;
        const el = document.querySelectorAll('.brute-column')[coluna]?.querySelector('.brute-letter.target');
        const y = Number(el?.style.transform.match(/translateY\(([-\d.]+)px\)/)?.[1]);
        const offset = (y + 27) / 54;
        return !s.tutorial && offset > -.15 && offset < .04;
      }, coluna, { timeout: 45000 });
      if (touch) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      else await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForFunction(({ coluna, erros }) => {
        const m = window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model;
        return m && (m.ativa > coluna || m.erros > erros);
      }, { coluna, erros });
      if ((await sceneState(page)).model.ativa > coluna) break;
    }
    assert.ok((await sceneState(page)).model.ativa > coluna, `coluna ${coluna + 1} não congelou`);
    console.log(`BRUTEFORCE: coluna ${coluna + 1} congelada.`);
  }
  await page.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').game.registry.get('factoryBruteforceComplete') === true);
  await dialog.waitFor({ state: 'detached' });
}
export async function resolverMemoria(page, config, ate = 3) {
  const touch = await page.evaluate(() => navigator.maxTouchPoints > 0);
  const hit = async locator => { await locator.scrollIntoViewIfNeeded(); if (touch) await locator.tap(); else await locator.click(); };
  while ((await sceneState(page)).model.recuperados < ate) {
    const step = (await sceneState(page)).model.recuperados;
    if (step === 0) await hit(page.locator(`[data-server="${config.core}"]`));
    if (step === 1) {
      for (const id of config.seguranca) {
        await hit(page.locator(`[data-server="${id}"]`));
        await page.waitForFunction(id => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model.isolamento.includes(id), id);
      }
      await hit(page.getByRole('button', { name: 'EXECUTAR ISOLAMENTO', exact: true }));
    }
    if (step === 2) {
      for (const value of config.assinatura) {
        await hit(page.locator(`[data-fragment="${value}"]`));
        await page.waitForFunction(value => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model.sequencia.includes(value), value);
      }
      await hit(page.getByRole('button', { name: 'VALIDAR AUTORIZAÇÃO', exact: true }));
    }
    await page.waitForFunction(step => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model.recuperados > step, step);
  }
  if (ate === 3) await page.waitForFunction(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model.etapaTipo === 'host');
}
export async function capturarHost(page, config, ate = 1, toque = false) {
  await page.bringToFront(); await dispensarTutorial(page);
  await page.evaluate(async () => { window.__posicaoNumero = (await import('/js/puzzles/HostConnection.js')).posicaoNumero; });
  while ((await sceneState(page)).model.passo < ate) {
    const m = (await sceneState(page)).model, passo = m.passo;
    let candidate;
    for (let linha = 0; linha < 4 && !candidate; linha++) for (let inicio = 0; inicio < 8; inicio++) {
      const values = Array.from({ length: 4 }, (_, i) => m.linhas[linha].numeros[(inicio + i) % 8]);
      if (values.join('.') === m.alvo.join('.')) { candidate = { linha, inicio }; break; }
    }
    assert.ok(candidate, 'alvo numérico ausente');
    await page.locator('.hack-matrix').scrollIntoViewIfNeeded();
    await page.waitForFunction(({ linha, inicio }) => {
      const s = window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model;
      return s?.linhas && window.__posicaoNumero(linha, inicio, s.tempo).coluna === 0 && s.tempo % 1000 < 180;
    }, candidate, { timeout: 40000 });
    const box = await page.locator(`.hack-cell[data-linha="${candidate.linha}"][data-inicio="${candidate.inicio}"]`).boundingBox();
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    if (toque) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
    const confirm = page.locator('.hack-confirm'); await confirm.scrollIntoViewIfNeeded();
    if (toque) await confirm.tap(); else await confirm.click();
    await page.waitForFunction(passo => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal()?.model.passo > passo, passo);
    console.log(`HACKCONNECT: alvo ${passo + 1} autenticado.`);
  }
}
export async function verificarLayoutNullnet(page) {
  const size = page.viewportSize();
  const layout = await page.locator('.nullnet-panel').first().evaluate(el => ({ width: el.getBoundingClientRect().width, scroll: document.documentElement.scrollWidth, client: innerWidth }));
  assert.ok(layout.width <= size.width); assert.ok(layout.scroll <= layout.client + 1);
  const close = page.getByRole('button', { name: 'Fechar terminal', exact: true }).last();
  await close.scrollIntoViewIfNeeded(); assert.ok((await close.boundingBox()).height >= 44);
}
export async function verificarPosicaoBotaoNullnet(page) {
  const layout = await page.evaluate(() => {
    const scene = window.__game.scene.getScene('Level1Parte2'), camera = scene.cameras.main;
    const canvas = scene.game.canvas.getBoundingClientRect();
    const button = document.querySelector('.nullnet-database-button'), bounds = button.getBoundingClientRect();
    const scaleX = canvas.width / camera.width, scaleY = canvas.height / camera.height;
    return { hidden: button.hidden, left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
      expectedRight: canvas.left + (camera.x + camera.width - 40) * scaleX +
        (scene.botaoDesenvolvedor?.width ?? 80) * scaleX / 2,
      centerY: bounds.top + bounds.height / 2,
      expectedY: canvas.top + (camera.y + (scene.minimap?.devScreenY ?? 24)) * scaleY +
        (scene.botaoDesenvolvedor?.height ?? 30) * scaleY / 2 + 10 + bounds.height / 2 };
  });
  assert.equal(layout.hidden, false);
  assert.ok(Math.abs(layout.right - layout.expectedRight) <= 2, JSON.stringify(layout));
  assert.ok(Math.abs(layout.centerY - layout.expectedY) <= 2, JSON.stringify(layout));
  assert.ok(layout.left >= 0 && layout.right <= page.viewportSize().width, JSON.stringify(layout));
  assert.ok(layout.top >= 0 && layout.bottom <= page.viewportSize().height, JSON.stringify(layout));
}
