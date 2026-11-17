/** Utilitários para os roteiros integrados do novo encontro no Phaser real. */
import assert from "node:assert/strict";

export async function abrirSessaoNovoBoss(config, opcoes = {}, opcoesContexto = {}) {
  const { chromium } = process.env.PLAYWRIGHT_MODULE
    ? await import(process.env.PLAYWRIGHT_MODULE)
    : await import("playwright").catch(() => import("playwright-core"));
  const browser = process.env.CHROME_CDP
    ? await chromium.connectOverCDP(process.env.CHROME_CDP)
    : await chromium.launch({
      ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
    });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...opcoesContexto });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(60000);
  const errors = [];
  const assetErrors = [];
  const consoleErrors = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", error => {
    errors.push(error.message);
    console.error("PAGEERROR:", error.message);
  });
  page.on("response", response => {
    if (response.status() >= 400 && /BossPrincipal|HeavensFury|novoBoss/i.test(response.url())) {
      assetErrors.push({ status: response.status(), url: response.url() });
    }
  });
  await page.route("**/js/core/game.js*", async route => {
    const response = await route.fetch();
    const source = await response.text();
    const body = source.replace("const game = new Game(jogoRapido);",
      "const game = window.__game = new Game(jogoRapido);");
    assert.notEqual(body, source, "O teste deve expor a instância real do jogo.");
    await route.fulfill({ response, body: `${body}\nwindow.__novoBossBootReady = true;\n` });
  });

  async function avancar(ms, passo = 20) {
    await page.evaluate(async ({ ms, passo }) => {
      const scene = window.__game.scene.getScene("Level1Parte2");
      const { atualizarBoss } = await import("/js/enemies/BossPrincipal.js");
      let restante = ms;
      do {
        const delta = Math.min(passo, restante);
        atualizarBoss(scene, scene.time.now, delta);
        restante -= delta;
      } while (restante > 0);
      // A cena pausada não executa sua ordenação de profundidade de pós-update.
      scene.children.depthSort();
    }, { ms, passo });
  }

  async function posicionar(x, y) {
    await page.evaluate(async ({ x, y }) => {
      const scene = window.__game.scene.getScene("Level1Parte2");
      scene.player.setPosition(x, y);
      scene.player.body.reset(x, y);
      // reset() ainda deixa o offset do frame para a próxima etapa da física.
      // Como a cena está pausada, sincroniza explicitamente o centro físico.
      scene.player.body.updateFromGameObject();
      scene.player.body.setVelocity(0, 0);
      const { atualizarHitboxDanoPlayer } = await import("/js/player/Player.js");
      atualizarHitboxDanoPlayer(scene);
    }, { x, y });
  }

  async function pausar() {
    await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").scene.pause(); });
    await page.waitForFunction(() =>
      window.__game.scene.getScene("Level1Parte2").scene.isPaused());
  }

  async function retomar() {
    await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").scene.resume(); });
    await page.waitForFunction(() =>
      window.__game.scene.getScene("Level1Parte2").scene.isActive());
    // O teclado do Phaser precisa de um quadro ativo após a fila de retomada.
    await page.waitForTimeout(100);
  }

  async function esperarFabrica(antiga = false) {
    await page.waitForFunction(antiga => {
      const scene = window.__game.scene.getScene("Level1Parte2");
      return scene.scene.isActive() && scene.player?.active && scene.novoBoss &&
        (scene.multiplayer ? !scene.novoBoss.sprite : Boolean(scene.novoBoss.sprite)) &&
        !scene.cameras.main.fadeEffect.isRunning &&
        (!antiga || scene.novoBoss !== window.__encontroAntesReinicioBrowser);
    }, antiga, { timeout: 60000, polling: 100 });
    assert.equal(await page.evaluate(() =>
      window.__game.scene.getScene("Level1Parte2").cameras.main.fadeEffect.alpha), 0,
    "A transição de entrada precisa terminar antes de pausar ou avaliar a imagem.");
    await pausar();
    await avancar(0);
  }

  async function reiniciar(dados = {}) {
    await page.evaluate(({ config, opcoes, dados }) => {
      const scene = window.__game.scene.getScene("Level1Parte2");
      window.__encontroAntesReinicioBrowser = scene.novoBoss;
      scene.scene.resume();
      scene.scene.restart({
        personagem: "kai-mercer", spawnX: -1093, spawnY: -5520,
        ...opcoes, novoBossConfig: config, ...dados,
      });
    }, { config, opcoes, dados });
    await esperarFabrica(true);
  }

  async function fechar() {
    await context.close();
    await browser.close();
  }

  try {
    console.log("BOOT: abrindo o jogo e preparando a fábrica real.");
    await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:8765/", {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(() => window.__novoBossBootReady === true);
    await page.keyboard.press("k");
    await page.waitForFunction(() => window.__game?.scene.getScene("Level1")?.player?.active,
      null, { timeout: 60000, polling: 100 });
    await page.evaluate(({ config, opcoes }) => {
      window.__game.scene.getScene("Level1").scene.start("Level1Parte2", {
        personagem: "kai-mercer", spawnX: -1093, spawnY: -5520,
        ...opcoes, novoBossConfig: config,
      });
    }, { config, opcoes });
    await esperarFabrica();
    return { page, browser, context, errors, assetErrors, consoleErrors,
      avancar, posicionar, pausar, retomar, reiniciar, fechar };
  } catch (error) {
    await fechar().catch(() => {});
    throw error;
  }
}
