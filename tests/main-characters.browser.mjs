/** Seleção e partida real com o elenco principal, sem carregar operadores removidos. */
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [], removedRequests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (/personage(?:m|ns)-?teste|WeaponSocket|PlayerTestActionControls|PlayerRecoveryControls/i.test(decodeURIComponent(request.url()))) {
      removedRequests.push(request.url());
    }
  });
  await page.route("**/js/core/game.js*", async route => {
    const response = await route.fetch();
    const source = await response.text();
    const body = source.replace("const game = new Game(jogoRapido);", "const game = window.__game = new Game(jogoRapido);");
    assert.notEqual(source, body);
    await route.fulfill({ response, body });
  });
  await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:8765/", { waitUntil: "networkidle" });
  await page.locator("#start-game").click();
  await page.waitForFunction(() => window.__game?.scene.getScene("Start")?.scene.isActive());
  await page.evaluate(() => {
    const start = window.__game.scene.getScene("Start");
    start.mode = "menu";
    if (!start.menuLayer) start.showMainMenu();
    start.selectMenuOption("SOLO");
  });
  await page.waitForFunction(() => !!window.__game.scene.getScene("Start").soloLayer);
  await page.waitForFunction(() => window.__game.scene.getScene("Start").soloLayer.alpha >= 0.99);
  const menu = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Start");
    return s.soloLayer.list.filter(o => o.type === "Image").map(o => o.texture.key);
  });
  assert.deepEqual(menu, ["start-character", "start-character-2", "start-character-3", "start-character-4"]);
  await page.screenshot({ path: "/tmp/main-character-selection.png" });
  await page.evaluate(() => window.__game.scene.getScene("Start").startSoloGame());
  await page.waitForFunction(() => window.__game.scene.getScene("Level1")?.inventory,
    null, { timeout: 60000 });
  console.log("PASS: menu com quatro operadores e carregamento sem recursos removidos.");

  for (const personagem of ["kai-mercer", "magnus-force", "aria-kade", "nyx"]) {
    await page.evaluate(personagem => {
      const s = window.__game.scene.getScene("Level1");
      window.__playerBeforeRestart = s.player;
      s.scene.restart({ personagem, spawnX: -1405, spawnY: 475, developerMode: true });
    }, personagem);
    await page.waitForFunction(personagem => {
      const s = window.__game.scene.getScene("Level1");
      return s.scene.isActive() && s.player !== window.__playerBeforeRestart && s.player?.active &&
        s.inventory && s.personagemSelecionada === personagem;
    }, personagem);
    const startX = await page.evaluate(() => window.__game.scene.getScene("Level1").player.x);
    await page.keyboard.down("d");
    try {
      await page.waitForFunction(x => window.__game.scene.getScene("Level1").player.x > x + 10, startX);
    } finally { await page.keyboard.up("d"); }
    const attack = await page.evaluate(async () => {
      const s = window.__game.scene.getScene("Level1");
      const { atacar, soltarAtaque } = await import("/js/player/Player.js");
      s.estamina = s.estaminaMaxima;
      const accepted = atacar(s);
      if (s.personagemSelecionada === "aria-kade") soltarAtaque(s);
      return { accepted, buttonRadius: s.botaoAtaque.radius,
        pickup: s.botaoColetarItem.texture.key,
        hitbox: [s.player.body.width, s.player.body.height], slots: s.inventory.getSlots().length };
    });
    assert.equal(attack.accepted, true, personagem);
    assert.equal(attack.buttonRadius, 46);
    assert.equal(attack.pickup, "hand_icon");
    assert.ok(attack.hitbox.every(value => Number.isFinite(value) && value > 0));
    await page.waitForFunction(() => !window.__game.scene.getScene("Level1").atacando);
    assert.equal(await page.evaluate(() => {
      const s = window.__game.scene.getScene("Level1");
      s.estamina = s.estaminaMaxima;
      s.events.emit("player:especial");
      return s.estadoEspecial.proximoUso > s.time.now;
    }), true, `${personagem}: habilidade especial`);
    console.log(`PASS: ${personagem} caminha, ataca e usa habilidade com inventário e controles padrão.`);
  }
  assert.deepEqual(removedRequests, []);
  assert.deepEqual(errors, []);
  console.log("PASS: nenhuma requisição de código/arte dos operadores removidos ou exceção JavaScript.");
} finally { await browser.close(); }
