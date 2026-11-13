/** TV e vídeo reais: encaixe, loader paralelo, salto seguro e recuperação de falhas. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"] });
const base = process.env.GAME_URL || "http://127.0.0.1:8765";
const artifacts = process.env.ARTIFACT_DIR || "/tmp/cutscene-validacao";
mkdirSync(artifacts, { recursive: true });
const report = { checks: [], layouts: [], errors: [] };
function check(label, condition) { assert.ok(condition, label); report.checks.push(label); console.log("OK", label); }

async function boot(options = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options });
  const page = await context.newPage();
  globalThis.lastTestPage = page;
  page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(60000);
  page.on("pageerror", error => { report.errors.push(error.stack); console.error(error.stack); });
  await page.route("**/js/core/game.js*", async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source.replace("const game = new Game(jogoRapido);",
      "const game = window.__game = new Game(jogoRapido);") });
  });
  return { context, page };
}
async function quickStart(page) {
  await page.goto(base, { waitUntil: "networkidle" }); await page.keyboard.press("k");
  await page.locator(".cutscene-loading").waitFor();
}
async function phase(page) {
  await page.waitForFunction(() => window.__game?.scene.getScene("Level1")?.player?.active,
    null, { timeout: 120000 });
  check("apresentação é removida ao entrar na fase", await page.locator(".cutscene-loading").count() === 0);
}
async function advanceTo(page, time) {
  // Reproduz a sequência real: também funciona em servidores sem HTTP Range.
  await page.evaluate(() => document.querySelector(".cutscene-loading video").play());
  await page.waitForFunction(time => document.querySelector(".cutscene-loading video").currentTime >= time,
    time, { timeout: 45000 });
  await page.evaluate(async () => {
    const video = document.querySelector(".cutscene-loading video");
    video.pause();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
const scenario = process.env.SCENARIO || "all";
try {
  if (scenario === "all" || scenario === "desktop") {
  // Seleção e botão reais, mantendo o fluxo normal de entrada no jogo.
  const desktop = await boot(); const { page } = desktop;
  await page.goto(base); await page.locator("#start-game").click();
  await page.waitForFunction(() => window.__game?.scene.getScene("Start")?.mode === "menu", null, { timeout: 45000 });
  check("vídeo e TV só aparecem depois de iniciar a partida", await page.locator(".cutscene-loading").count() === 0);
  await page.evaluate(() => window.__game.scene.getScene("Start").selectMenuOption("SOLO"));
  await page.waitForFunction(() => window.__game.scene.getScene("Start").soloLayer?.alpha >= 0.99);
  const click = async (x, y) => {
    const rect = await page.locator("#game-container canvas").boundingBox();
    await page.mouse.click(rect.x + rect.width * x / 800, rect.y + rect.height * y / 450, { delay: 50 });
  };
  await click(492, 205);
  await page.waitForFunction(() => window.__game.scene.getScene("Start").selectedCharacter === "aria-kade");
  await click(400, 338);
  await page.locator(".cutscene-loading").waitFor();
  await page.waitForFunction(() => document.querySelector(".cutscene-loading video")?.currentTime > 0.1);
  check("vídeo original adaptado toca dentro da TV", await page.evaluate(() => {
    const v = document.querySelector(".cutscene-loading video");
    return v.videoWidth === 960 && v.videoHeight === 720 && v.duration > 31 && v.duration < 32 &&
      getComputedStyle(v).objectFit === "cover" && !v.hidden && !v.parentElement.hidden;
  }));
  await page.evaluate(() => document.querySelector(".cutscene-loading video").pause());
  await page.waitForFunction(() => window.__game.scene.getScene("preloader")?.cutscene?.gate.assetsReady,
    null, { timeout: 120000 });
  check("assets carregam sem encerrar o vídeo", await page.evaluate(() => {
    const s = window.__game.scene.getScene("preloader");
    return s.scene.isActive() && !s.barra && !s.porcentagem && !s.cutscene.gate.videoFinished && s.personagemSelecionada === "aria-kade";
  }));
  check("TV original de 800x600 mantém a tela coberta pelo vídeo", await page.evaluate(() => {
    const renderer = window.__game.scene.getScene("preloader").cutscene.televisionRenderer;
    return renderer.duration === 2880 && renderer.image.naturalWidth === 800 &&
      renderer.image.naturalHeight === 600 && !renderer.screen.hidden &&
      getComputedStyle(renderer.screen).backgroundColor === "rgb(0, 0, 0)";
  }));
  for (const time of [2.5, 12, 17.2, 17.8, 20.4, 28]) {
    await advanceTo(page, time);
    if (time === 12) {
      check("GIF continua em loop enquanto o vídeo avança dentro da TV", await page.evaluate(async () => {
        const cutscene = window.__game.scene.getScene("preloader").cutscene;
        const renderer = cutscene.televisionRenderer;
        const before = renderer.image.currentSrc;
        const videoTime = cutscene.video.currentTime;
        await cutscene.video.play();
        await new Promise(resolve => setTimeout(resolve, 250));
        cutscene.video.pause();
        return renderer.looping && !renderer.frozen && before.endsWith("televisao.gif") &&
          before === renderer.image.currentSrc && renderer.backdrop.currentSrc === before &&
          cutscene.video.currentTime > videoTime &&
          !cutscene.gate.videoFinished;
      }));
      await page.waitForTimeout(100);
      const tv = await page.locator(".cutscene-television").boundingBox();
      const screen = await page.locator(".cutscene-television-screen").boundingBox();
      const beam = { x: tv.x + tv.width * 360 / 800, y: tv.y + tv.height * 500 / 600,
        width: tv.width * 80 / 800, height: tv.height * 50 / 600 };
      const inside = { x: screen.x + 8, y: screen.y + 8, width: screen.width - 16, height: screen.height - 16 };
      const firstBeam = await page.screenshot({ clip: beam });
      const firstScreen = await page.screenshot({ clip: inside });
      await page.waitForTimeout(160);
      const nextBeam = await page.screenshot({ clip: beam });
      const nextScreen = await page.screenshot({ clip: inside });
      check("feixe do GIF muda de quadro com o vídeo pausado", !firstBeam.equals(nextBeam));
      check("nenhuma animação do GIF aparece dentro da tela com o vídeo pausado", firstScreen.equals(nextScreen));
    }
    await page.screenshot({ path: `${artifacts}/tv-${time}s.png` });
  }
  for (const [width, height] of [[844, 390], [932, 430], [667, 375], [1280, 720], [1920, 720], [390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(100);
    const layout = await page.evaluate(() => {
      const root = document.querySelector(".cutscene-loading").getBoundingClientRect();
      const tv = document.querySelector(".cutscene-television").getBoundingClientRect();
      const screen = document.querySelector(".cutscene-television-screen").getBoundingClientRect();
      const video = document.querySelector(".cutscene-loading video").getBoundingClientRect();
      const backdrop = document.querySelector(".cutscene-backdrop").getBoundingClientRect();
      const box = r => ({ x: r.x, y: r.y, w: r.width, h: r.height });
      return { root: box(root), tv: box(tv), screen: box(screen), video: box(video), backdrop: box(backdrop) };
    });
    report.layouts.push({ width, height, ...layout });
    check(`televisão proporcional e centralizada em ${width}x${height}`,
      Math.abs(layout.tv.w / layout.tv.h - 4 / 3) < 0.001 &&
      Math.abs(layout.tv.x - (layout.root.w - layout.tv.w) / 2) < 1 &&
      Math.abs(layout.tv.y - (layout.root.h - layout.tv.h) / 2) < 1);
    check(`fundo ocupa a tela toda e GIF completo fica visível em ${width}x${height}`,
      layout.root.w === width && layout.root.h === height &&
      layout.backdrop.x <= 0 && layout.backdrop.y <= 0 &&
      layout.backdrop.x + layout.backdrop.w >= width && layout.backdrop.y + layout.backdrop.h >= height &&
      layout.tv.x >= -1 && layout.tv.x + layout.tv.w <= width + 1 &&
      layout.tv.y >= -1 && layout.tv.y + layout.tv.h <= height + 1);
    check(`vídeo permanece dentro da janela em ${width}x${height}`,
      Math.abs(layout.video.x - layout.screen.x) < 1 && Math.abs(layout.video.y - layout.screen.y) < 1 &&
      layout.video.w <= layout.screen.w + 1 && layout.video.h <= layout.screen.h + 1);
    await page.screenshot({ path: `${artifacts}/tv-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await advanceTo(page, 30.8);
  await page.evaluate(() => document.querySelector(".cutscene-loading video").play());
  await phase(page);
  check("a fase mantém a personagem escolhida", await page.evaluate(() =>
    window.__game.scene.getScene("Level1").personagemSelecionada === "aria-kade"));
  await desktop.context.close();
  }

  if (scenario === "all" || scenario === "slow") {
  const slow = await boot({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  let release;
  const held = new Promise(resolve => { release = resolve; });
  let requested = false;
  await slow.page.route("**/assets/map/parte2-fase1.json", async route => {
    requested = true; await held; await route.continue();
  });
  await quickStart(slow.page);
  await slow.page.waitForFunction(() => !!window.__game.scene.getScene("preloader")?.cutscene);
  await slow.page.waitForFunction(() => window.__game.scene.getScene("preloader").load.isLoading());
  await slow.page.locator(".cutscene-skip").click();
  check("pular inicia o desligamento antes de liberar a fase", await slow.page.evaluate(() => {
    const s = window.__game.scene.getScene("preloader");
    return s.scene.isActive() && s.cutscene.poweringOff &&
      s.cutscene.root.classList.contains("cutscene-powering-off");
  }));
  await slow.page.waitForFunction(() => document.querySelector(".cutscene-powered-off"));
  check("pular com loader incompleto mantém a TV e aguarda os recursos", await slow.page.evaluate(() => {
    const s = window.__game.scene.getScene("preloader");
    return s.scene.isActive() && s.cutscene.gate.videoFinished && !s.cutscene.gate.assetsReady &&
      !s.cutscene.destroyed && s.cutscene.video.hidden && !s.cutscene.screen.hidden;
  }));
  // A chegada tardia do mapa libera a fase; não existe um atraso artificial.
  release(); await phase(slow.page);
  check("o mapa retardado foi carregado antes da entrada", requested);
  await slow.context.close();
  }

  if (scenario === "all" || scenario === "skip") {
  const mobile = await boot({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await quickStart(mobile.page);
  await mobile.page.waitForFunction(() => document.querySelector(".cutscene-loading video")?.currentTime > 0.1);
  await mobile.page.evaluate(() => document.querySelector(".cutscene-loading video").pause());
  await mobile.page.waitForFunction(() => {
    const s = window.__game.scene.getScene("preloader");
    return s?.cutscene?.gate.assetsReady && s.cutscene.video.currentTime > 0.1;
  }, null, { timeout: 120000 });
  await mobile.page.screenshot({ path: `${artifacts}/celular-horizontal-antes-skip.png` });
  await mobile.page.locator(".cutscene-skip").tap();
  check("com assets prontos, o toque em pular aguarda a animação CRT", await mobile.page.evaluate(() => {
    const s = window.__game.scene.getScene("preloader");
    return s.scene.isActive() && s.cutscene.poweringOff && !s.cutscene.finishing &&
      s.cutscene.video.getAnimations().length > 0 && !s.cutscene.video.hidden &&
      s.cutscene.televisionRenderer.frozen && !s.cutscene.televisionRenderer.looping;
  }));
  await mobile.page.waitForTimeout(210);
  await mobile.page.screenshot({ path: `${artifacts}/celular-horizontal-desligando.png` });
  await phase(mobile.page);
  check("pular no celular horizontal conclui o desligamento e abre a fase", true);
  await mobile.context.close();
  }

  if (scenario === "all" || scenario === "video-error") {
  const fallback = await boot();
  await fallback.page.route("**/assets/efeitos/derivados/cutscene-tv.mp4", route => route.abort());
  await quickStart(fallback.page);
  await fallback.page.locator(".cutscene-action", { hasText: "Continuar" }).waitFor();
  await fallback.page.locator(".cutscene-action").click(); await phase(fallback.page);
  check("falha de vídeo permite continuar após o carregamento", true);
  await fallback.context.close();
  }

  if (scenario === "all" || scenario === "retry") {
  const retry = await boot(); let rejected = false;
  await retry.page.route("**/Tilesets/extras/Hand_icon.png", route => {
    if (!rejected) { rejected = true; return route.fulfill({ status: 503, body: "Falha temporária" }); }
    return route.continue();
  });
  await quickStart(retry.page);
  await retry.page.locator(".cutscene-action", { hasText: "Tentar novamente" }).waitFor({ timeout: 120000 });
  await retry.page.locator(".cutscene-skip").click();
  check("falha em asset bloqueia a entrada mesmo após pular", await retry.page.evaluate(() =>
    window.__game.scene.getScene("preloader").cutscene.loadFailed));
  await retry.page.locator(".cutscene-action").click(); await phase(retry.page);
  check("tentar novamente recupera o asset sem reiniciar a introdução", rejected);
  await retry.context.close();
  }
  assert.deepEqual(report.errors, []);
  writeFileSync(`${artifacts}/relatorio-${scenario}.json`, JSON.stringify(report, null, 2));
  console.log(`PASSOU: ${report.checks.length} verificações; prévias em ${artifacts}`);
} catch (error) {
  const page = globalThis.lastTestPage;
  if (page && !page.isClosed()) {
    await page.screenshot({ path: `${artifacts}/falha.png` });
    console.error("Diagnóstico:", await page.evaluate(() => {
      const video = document.querySelector(".cutscene-loading video");
      const image = document.querySelector(".cutscene-television-art");
      return { video: video && { time: video.currentTime, paused: video.paused,
        error: video.error?.message, state: video.readyState }, image: image &&
        { src: image.currentSrc, complete: image.complete, width: image.naturalWidth },
        message: document.querySelector(".cutscene-message")?.textContent };
    }));
  }
  throw error;
} finally { await browser.close(); }
