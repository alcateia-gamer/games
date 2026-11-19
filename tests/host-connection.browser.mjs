/** Painel real: 32 posições, relógio determinístico, mouse e toque. */
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'] });
try {
  for (const input of ['mouse', 'touch']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/js/core/game.js*', route => route.fulfill({ body: '', contentType: 'text/javascript' }));
    await page.goto(process.env.BASE_URL ?? 'http://127.0.0.1:8765/');
    await page.evaluate(async () => {
      document.body.replaceChildren();
      // Controla apenas o relógio/RAF; painel, comandos e puzzle são os de produção.
      let now = 0, id = 0;
      const frames = new Map();
      Object.defineProperty(performance, 'now', { value: () => now, configurable: true });
      window.requestAnimationFrame = callback => { frames.set(++id, callback); return id; };
      window.cancelAnimationFrame = key => frames.delete(key);
      const { HostConnection } = await import('/js/puzzles/HostConnection.js');
      const { gerarMissao } = await import('/js/puzzles/MissionIntelligence.js');
      const { criarHackConnectPanel } = await import('/js/ui/HackConnectPanel.js');
      const model = new HostConnection(gerarMissao(74)), commands = [];
      const panel = criarHackConnectPanel(document.body, (op, value) => {
        commands.push(value); model.acao(op, value); panel.atualizar(model.snapshot());
      });
      window.__host = { model, commands, panel, render(time) {
        now = time; model.tempo = time; panel.atualizar(model.snapshot());
        const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(now));
      } };
      window.__host.render(0);
      window.__host.cells = [...document.querySelectorAll('.hack-cell')];
    });
    // Todos os números devem ocupar cada posição em ordem, sem trocar o DOM.
    for (let step = 0; step <= 32; step++) {
      const mismatch = await page.evaluate(step => {
        window.__host.render(step * 1000);
        const matrix = document.querySelector('.hack-matrix').getBoundingClientRect();
        return [...document.querySelectorAll('.hack-cell')].flatMap((cell, origin) => {
          const position = (origin + step) % 32, row = Math.floor(position / 8), col = position % 8;
          const rect = cell.getBoundingClientRect();
          const correct = cell === window.__host.cells[origin] &&
            cell.style.transform === `translate(${col * 100}%, ${row * 100}%)` &&
            Math.abs(rect.left - (matrix.left + 1 + col * rect.width)) < 1 &&
            Math.abs(rect.top - (matrix.top + 1 + row * rect.height)) < 1 &&
            cell.getAttribute('aria-label') === `Linha ${row + 1}, coluna ${col + 1}: ${cell.textContent}`;
          return correct ? [] : [{ origin, step, row, col, transform: cell.style.transform, rect: {x: rect.x, y: rect.y, width: rect.width, height: rect.height}, matrix: {x: matrix.x, y: matrix.y}, label: cell.getAttribute('aria-label') }];
        });
      }, step);
      assert.deepEqual(mismatch, []);
    }
    const click = async locator => {
      if (input === 'mouse') await locator.click(); else await locator.tap();
    };
    // Seleciona uma origem que cruza de linha e verifica a identidade enviada.
    await page.evaluate(() => window.__host.render(1000));
    const boundary = page.locator('.hack-cell[data-linha="0"][data-inicio="7"]');
    await click(boundary);
    assert.equal(await page.locator('.hack-cell.marked').count(), 4);
    assert.equal(await page.locator('.hack-selection').innerText().then(t => t.startsWith('LINHA 2:')), true);
    await click(page.locator('.hack-confirm'));
    const wrong = await page.evaluate(() => ({ command: window.__host.commands.at(-1), errors: window.__host.model.erros }));
    assert.deepEqual(wrong.command, { linha: 0, inicio: 7, tempo: 1000 });
    assert.equal(wrong.errors, 1);
    // O grupo correto deve continuar válido após percorrer a matriz inteira.
    const candidate = await page.evaluate(async () => {
      const { sequenciaLinha } = await import('/js/puzzles/HostConnection.js');
      const { model } = window.__host;
      for (let row = 0; row < 4; row++) for (let col = 0; col <= 4; col++) {
        if (sequenciaLinha(model.linhas, row, col).join('.') === model.alvo.join('.')) {
          window.__host.render((32 + (8 - col) % 8) * 1000);
          return { row, col };
        }
      }
    });
    assert.ok(candidate);
    await click(page.locator(`.hack-cell[data-linha="${candidate.row}"][data-inicio="${candidate.col}"]`));
    await click(page.locator('.hack-confirm'));
    assert.equal(await page.evaluate(() => window.__host.model.estado), 'executando');
    assert.equal(await page.evaluate(() => window.__host.model.passo), 1);
    await page.evaluate(() => window.__host.panel.destruir());
    assert.equal(await page.locator('.hack-cell').count(), 0);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS: 32 posições e retorno, DOM/ARIA sincronizados, erro e autenticação por ${input}.`);
  }
} finally { await browser.close(); }
