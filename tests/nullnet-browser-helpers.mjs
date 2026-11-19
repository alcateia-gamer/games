import assert from 'node:assert/strict';
export const sceneState = page => page.evaluate(() => window.__game.scene.getScene('Level1Parte2').hackingTerminals.estadoLocal());

export const lerRelogio = page => page.evaluate(async () => {
  const { tempoPartida, resultadoPartida } = await import('/js/core/RelogioPartida.js');
  const scene = window.__game.scene.getScenes(true).find(s => ['Level1', 'Level1Parte2'].includes(s.sys.settings.key));
  return { ms: tempoPartida(scene), resultado: resultadoPartida(scene) ?? null };
});

export async function observarConfirmacaoFinal(page) {
  await page.evaluate(async () => {
    const { tempoPartida, resultadoPartida } = await import('/js/core/RelogioPartida.js');
    const scene = window.__game.scene.getScene('Level1Parte2');
    window.__confirmacoes = [];
    scene.events.on('hacking:matrix-concluida', () => {
      window.__confirmacoes.push({ ms: tempoPartida(scene), resultado: resultadoPartida(scene) });
    });
  });
}

export async function simularCredito(page, conta) {
  const credencial = `header.${Buffer.from(JSON.stringify({ sub: conta })).toString('base64url')}.signature`;
  const chamadas = [];
  await page.addInitScript(credential => {
    globalThis.google = { accounts: { id: {
      initialize({ callback }) { this.responder = callback; },
      renderButton() {},
      prompt() { this.responder({ credential }); },
    } } };
  }, credencial);
  await page.route('https://feira-de-jogos.dev.br/api/v2/credit', route => {
    const request = route.request();
    const headers = {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'OPTIONS, POST',
      'access-control-allow-headers': 'authorization, content-type',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    chamadas.push({ corpo: request.postDataJSON(), autorizacao: request.headers().authorization });
    return route.fulfill({ status: 201, headers, json: { operation: chamadas.length } });
  });
  return { chamadas, autorizacao: `Bearer ${credencial}` };
}

const formulario = 'https://docs.google.com/forms/d/e/1FAIpQLSeeleFRJ3PbTeX9nmxFtfqF_3VMD6bBGixNGFODEtqjbHGK9A/viewform?entry.52413313=NULLBORNS';
export async function verificarConclusao(page, toque, pagamento) {
  const tela = page.locator('.hacking-victory');
  await tela.waitFor({ timeout: 20000 });
  assert.equal(await tela.getByRole('heading').textContent(), 'Parabéns! Você concluiu NULLBORNS!');
  assert.equal(await tela.getByText('Hack final concluído com sucesso.').count(), 1);
  await tela.getByText(pagamento, { exact: true }).waitFor();
  const { ms, resultado } = await lerRelogio(page);
  assert.ok(ms > 0);
  assert.equal(resultado.tempoMs, ms);
  assert.ok(resultado.recompensa.partida);
  assert.equal(await tela.locator('.run-completion-time').textContent(), await page.locator('.run-timer').textContent());
  const link = tela.getByRole('link', { name: 'Avaliar NULLBORNS', exact: true });
  assert.equal(await link.getAttribute('href'), formulario);
  const contexto = page.context(), abas = contexto.pages().length;
  await contexto.route(formulario, route => route.fulfill({ status: 200, body: 'Formulário de teste' }));
  const [popup] = await Promise.all([page.waitForEvent('popup'), toque ? link.tap() : link.click()]);
  await popup.waitForURL(formulario);
  assert.equal(contexto.pages().length, abas + 1);
  await popup.close();
  await contexto.unroute(formulario);
  await page.bringToFront();
  assert.equal(await tela.isVisible(), true);
  assert.deepEqual(await lerRelogio(page), { ms, resultado });
  return resultado;
}
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
        const letter = el?.getBoundingClientRect();
        const band = document.querySelector('.brute-band')?.getBoundingClientRect();
        if (!letter?.height || !band) return false;
        const offset = (letter.y + letter.height / 2 - band.y - band.height / 2) / letter.height;
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
  const posicao = await page.waitForFunction(({ width, height }) => {
    const scene = window.__game.scene.getScene('Level1Parte2'), camera = scene.cameras.main;
    const canvas = scene.game.canvas.getBoundingClientRect();
    if (Math.abs(canvas.width - width) > 1 || Math.abs(canvas.height - height) > 1) return;
    const button = document.querySelector('.nullnet-database-button'), bounds = button.getBoundingClientRect();
    const scaleX = canvas.width / camera.width, scaleY = canvas.height / camera.height;
    const layout = { hidden: button.hidden, left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom,
      expectedRight: canvas.left + (camera.x + camera.width - 40) * scaleX +
        (scene.botaoDesenvolvedor?.width ?? 80) * scaleX / 2,
      centerY: bounds.top + bounds.height / 2,
      expectedY: canvas.top + (camera.y + (scene.minimap?.devScreenY ?? 24)) * scaleY +
        ((scene.botaoDesenvolvedor?.height ?? 30) / 2 + (scene.espacoAtalhosDev?.() ?? 0)) * scaleY + 10 + bounds.height / 2 };
    if (Math.abs(layout.right - layout.expectedRight) <= 2 && Math.abs(layout.centerY - layout.expectedY) <= 2) return layout;
  }, page.viewportSize());
  const layout = await posicao.jsonValue();
  assert.equal(layout.hidden, false);
  assert.ok(layout.left >= 0 && layout.right <= page.viewportSize().width, JSON.stringify(layout));
  assert.ok(layout.top >= 0 && layout.bottom <= page.viewportSize().height, JSON.stringify(layout));
}
/** Lê todas as páginas da categoria atual, inclusive no layout compacto. */
export async function lerArquivosNullnet(page) {
  const overlay = page.locator('.axiom-record-overlay');
  const textos = [];
  const proxima = overlay.getByRole('button', { name: 'Próxima', exact: true });
  do {
    textos.push(await overlay.innerText());
    if (!await proxima.isVisible() || await proxima.isDisabled()) break;
    await proxima.click();
  } while (true);
  return textos.join('\n');
}
