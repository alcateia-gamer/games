/**
 * Etapa 1 do novo boss no jogo real, com Phaser e WebGL.
 * Execute com servidor HTTP na raiz do repositório e Playwright/Chromium disponíveis:
 * PLAYWRIGHT_MODULE=/caminho/playwright/index.mjs CHROMIUM_PATH=/caminho/chromium \
 *   node tests/novo-boss.browser.mjs
 * BASE_URL, CHROME_CDP e NOVO_BOSS_SCREENSHOT são opcionais.
 * A instância do jogo é exposta somente pela interceptação desta sessão de teste.
 */
import assert from "node:assert/strict";
import { assetsNovoBoss } from "../js/enemies/novoBoss/NovoBossAssets.js";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

// Mantém o teste de integração da entidade independente das fases posteriores.
const configIsolada = {
  ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ilusoes: { ...novoBossConfig.ilusoes, ativo: false },
  clones: { ...novoBossConfig.clones, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};

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
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
const assetErrors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("response", response => {
  if (response.status() >= 400 && /boss-test|HeavensFury|novoBoss/i.test(response.url())) {
    assetErrors.push({ status: response.status(), url: response.url() });
  }
});
await page.route("**/js/core/game.js*", async route => {
  const response = await route.fetch();
  const source = await response.text();
  const instrumented = source.replace(
    "const game = new Game(jogoRapido);",
    "const game = window.__game = new Game(jogoRapido);",
  );
  assert.notEqual(instrumented, source, "A interceptação precisa expor a instância real do jogo.");
  await route.fulfill({ response, body: `${instrumented}\nwindow.__novoBossBootReady = true;\n` });
});

const state = () => page.evaluate(async idleKey => {
  const scene = window.__game.scene.getScene("Level1Parte2");
  const boss = scene.novoBoss;
  const { localizarPecasBoss } = await import("/js/enemies/bossFinal/BossConfig.js");
  return {
    estado: boss?.estado,
    sprite: boss?.sprite ? {
      active: boss.sprite.active,
      visible: boss.sprite.visible,
      texture: boss.sprite.texture.key,
      frame: boss.sprite.frame.name,
      x: boss.sprite.x,
      y: boss.sprite.y,
      playing: boss.sprite.anims.isPlaying,
      bodyEnabled: boss.sprite.body.enable,
    } : null,
    hitbox: boss?.hitbox ? {
      x: boss.hitbox.x, y: boss.hitbox.y,
      width: boss.hitbox.width, height: boss.hitbox.height,
    } : null,
    oldBoss: !!scene.bossFinal,
    oldPieces: localizarPecasBoss(scene).map(piece => ({
      visible: piece.visible,
      enabled: piece.body?.enable ?? false,
    })),
    count: scene.children.list.filter(child =>
      child.active && child.texture?.key === idleKey).length,
  };
}, assetsNovoBoss.idle.chave);
async function placePlayer(x, y) {
  await page.evaluate(({ x, y }) => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.player.setPosition(x, y);
    scene.player.body.reset(x, y);
  }, { x, y });
  await page.waitForTimeout(150);
}

try {
  await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:8765/", {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.__novoBossBootReady === true);
  await page.keyboard.press("k");
  await page.waitForFunction(() => !!window.__game?.scene.getScene("Level1")?.player?.active,
    null, { timeout: 60000, polling: 100 });
  await page.evaluate(config => {
    window.__game.scene.getScene("Level1").scene.start("Level1Parte2", {
      personagem: "kai-mercer", spawnX: -1093, spawnY: -5350,
      novoBossConfig: config,
    });
  }, configIsolada);
  await page.waitForFunction(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    return scene.scene.isActive() && scene.player?.active && !!scene.novoBoss;
  }, null, { timeout: 60000, polling: 100 });

  const textures = await page.evaluate(keys => {
    const manager = window.__game.textures;
    return keys.map(key => ({
      key, loaded: manager.exists(key), frames: manager.get(key).frameTotal,
    }));
  }, Object.values(assetsNovoBoss).map(asset => asset.chave));
  assert.ok(textures.every(texture => texture.loaded && texture.frames > 1),
    `As spritesheets fornecidas precisam estar carregadas: ${JSON.stringify(textures)}`);
  let current = await state();
  assert.equal(current.estado, "aguardando");
  assert.equal(current.count, 0);
  assert.equal(current.oldBoss, false);
  assert.equal(current.oldPieces.length, 6);
  assert.ok(current.oldPieces.every(piece => !piece.visible && !piece.enabled));
  console.log("PASS: fábrica carrega as folhas novas e mantém o boss antigo desativado.");

  await placePlayer(-1093, -5520);
  await page.waitForFunction(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss?.sprite?.active);
  current = await state();
  assert.equal(current.count, 1);
  assert.ok(current.sprite.active && current.sprite.visible && current.sprite.playing);
  assert.equal(current.sprite.texture, assetsNovoBoss.idle.chave);
  assert.equal(current.sprite.x, -1080);
  assert.equal(current.sprite.y, -5810);
  assert.ok(current.hitbox?.width > 0 && current.hitbox?.height > 0);
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    window.__bossControllerBeforeRestart = scene.novoBoss;
    window.__bossSpriteBeforeRestart = scene.novoBoss.sprite;
  });
  const frames = new Set([current.sprite.frame]);
  for (let sample = 0; sample < 4; sample++) {
    await page.waitForTimeout(180);
    frames.add((await state()).sprite.frame);
  }
  assert.ok(frames.size > 1, "A animação idle precisa avançar no Phaser real.");
  console.log("PASS: entrar na arena cria uma entidade com idle animado e hitbox própria.");

  await placePlayer(-1093, -5350);
  await placePlayer(-1093, -5520);
  assert.equal((await state()).count, 1);
  assert.ok(await page.evaluate(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.sprite === window.__bossSpriteBeforeRestart));
  console.log("PASS: sair e voltar à arena preserva a entidade sem duplicá-la.");

  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").morteEmAndamento = true;
  });
  await page.waitForTimeout(150);
  const suspended = await state();
  assert.equal(suspended.sprite.visible, false);
  assert.equal(suspended.sprite.bodyEnabled, false);
  const pausedFrame = suspended.sprite.frame;
  await page.waitForTimeout(400);
  assert.equal((await state()).count, 1);
  assert.equal((await state()).sprite.frame, pausedFrame,
    "A apresentação do encontro precisa suspender durante a morte do jogador.");
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").morteEmAndamento = false;
  });
  await page.waitForTimeout(200);
  const resumed = await state();
  assert.ok(resumed.sprite.playing && resumed.sprite.visible && resumed.sprite.bodyEnabled);
  console.log("PASS: morte suspende o encontro e a liberação do estado retoma o idle.");

  await placePlayer(-1080, -5740);
  await page.screenshot({ path: process.env.NOVO_BOSS_SCREENSHOT ?? "/tmp/novo-boss-etapa1.png" });

  await page.evaluate(config => {
    window.__game.scene.getScene("Level1Parte2").scene.restart({
      personagem: "kai-mercer", spawnX: -1093, spawnY: -5350,
      novoBossConfig: config,
    });
  }, configIsolada);
  await page.waitForFunction(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    return scene.novoBoss && scene.novoBoss !== window.__bossControllerBeforeRestart &&
      scene.novoBoss.estado === "aguardando" && scene.player?.active;
  }, null, { timeout: 60000, polling: 100 });
  assert.ok(await page.evaluate(() => !window.__bossSpriteBeforeRestart.active &&
    !window.__bossSpriteBeforeRestart.scene));
  assert.equal((await state()).count, 0);
  await placePlayer(-1093, -5520);
  await page.waitForFunction(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss?.sprite?.active);
  assert.equal((await state()).count, 1);
  console.log("PASS: reiniciar limpa o sprite antigo e permite uma única criação no reencontro.");

  assert.deepEqual(assetErrors, []);
  assert.deepEqual(errors, []);
  console.log("PASS: nenhuma falha de recurso do novo boss ou exceção JavaScript.");
} finally {
  await context.close();
  await browser.close();
}
