import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"],
});
const artifacts = process.env.ARTIFACT_DIR || "/tmp/solo-selection";
mkdirSync(artifacts, { recursive: true });
const textures = {
  "kai-mercer": "walk", "magnus-force": "personagem2-walk",
  "aria-kade": "personagem3-walk", nyx: "personagem4-walk",
};
const ids = Object.keys(textures);
const errors = [];
const requests = [];

async function openMenu(context, setup) {
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => requests.push(decodeURIComponent(request.url())));
  await page.route("**/js/core/game.js*", async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace("const game = new Game(jogoRapido);",
      "const game = window.__game = new Game(jogoRapido);");
    await route.fulfill({ response, body });
  });
  await page.route("https://unpkg.com/mqtt@*/**", route => route.fulfill({
    contentType: "application/javascript",
    body: "globalThis.mqtt = { connect() { return { on() { return this; }, subscribe() {}, publish() {}, end() {} }; } };",
  }));
  await setup?.(page);
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8765/");
  await page.locator("#start-game").click();
  await page.waitForFunction(() => window.__game?.scene.getScene("Start").menuLayer?.alpha >= .99,
    null, { timeout: 45000 });
  return page;
}

async function menuClick(page, label, touch = false) {
  const text = page.getByText(label, { exact: true });
  await text.waitFor({ state: "visible" });
  const box = await text.boundingBox();
  assert.ok(box, label);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

function portrait(page, id) {
  return page.locator(`[data-operator="${id}"] .solo-selection-portrait`);
}

async function assertSelection(page, selected = null) {
  await page.locator(".solo-selection").waitFor();
  const states = await page.locator(".solo-selection-portrait").evaluateAll(buttons =>
    buttons.map(button => [button.getAttribute("aria-pressed"), getComputedStyle(button.querySelector("img")).filter]));
  assert.deepEqual(states, ids.map(id =>
    [String(id === selected), selected && id !== selected ? "grayscale(1) brightness(1.23)" : "none"]));
  assert.equal(await page.getByRole("button", { name: "INICIAR SOLO" }).isDisabled(), !selected);
}

async function capture(page, name) {
  await page.locator(".solo-selection").evaluate(async root => {
    await Promise.all(Array.from(root.querySelectorAll("img"), image => image.decode()));
    await document.fonts.ready;
  });
  await page.screenshot({ path: `${artifacts}/${name}.png` });
}

async function swipeToLastStat(page, touch, id) {
  const panel = page.locator(`#solo-details-${id}`);
  const { x, y, width, height } = await panel.boundingBox();
  const remaining = await panel.evaluate(node => node.scrollHeight - node.clientHeight - node.scrollTop);
  const touchX = Math.round(x + width / 2);
  const from = Math.round(y + height - 15);
  for (let swipe = 0; swipe <= Math.ceil(remaining / (height - 50)); swipe++) {
    await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touchX, y: from }] });
    for (let move = 1; move <= 8; move++) {
      await touch.send("Input.dispatchTouchEvent", { type: "touchMove",
        touchPoints: [{ x: touchX, y: Math.round(from - move * (height - 30) / 8) }] });
    }
    await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await page.waitForFunction(id => {
    const node = document.querySelector(`#solo-details-${id}`);
    return node.querySelector("li:last-child").getBoundingClientRect().bottom <= node.getBoundingClientRect().bottom;
  }, id);
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1276, height: 596 } });
  const portraitResponse = Promise.withResolvers();
  const page = await openMenu(desktop, page => page.route("**/assets/solo-selection/kai.jpeg", async route => {
    await portraitResponse.promise;
    await route.continue();
  }));
  assert.ok(requests.some(path => path.endsWith("/assets/solo-selection/kai.jpeg")));
  await menuClick(page, "SOLO");
  await page.getByText("CARREGANDO OPERADORES...", { exact: true }).waitFor();
  assert.equal(await page.locator(".solo-selection").count(), 0);
  portraitResponse.resolve();
  await assertSelection(page);
  assert.equal(await page.locator(".solo-selection img").evaluateAll(images =>
    images.length === 11 && images.every(image => image.complete && image.naturalWidth > 0)), true);
  console.log("OK: artes solicitadas antes do clique; seleção só aparece com todas as imagens prontas.");
  const prompt = page.getByAltText("SELECIONE SEU OPERADOR");
  const start = page.getByRole("button", { name: "INICIAR SOLO" });
  // Exercita um toque real no botão desabilitado, inclusive o atalho de teclado.
  const box = await start.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.keyboard.press("k");
  assert.equal(await page.locator(".solo-selection").isVisible(), true);
  assert.equal(await page.locator(".cutscene-loading").count(), 0);
  await capture(page, "1-inicial");

  const info = page.getByRole("button", { name: /^Ficha de / });
  assert.equal(await info.count(), 4);
  for (let i = 0; i < ids.length; i++) await info.nth(i).click();
  assert.equal(await prompt.isVisible(), false);
  assert.equal(await page.locator(".solo-selection-details:visible").count(), 4);
  await assertSelection(page);
  await capture(page, "2-quatro-fichas");
  for (let i = 0; i < ids.length; i++) await info.nth(i).click();
  assert.equal(await prompt.isVisible(), true);

  for (const id of ids) {
    await portrait(page, id).click();
    await assertSelection(page, id);
  }
  await capture(page, "3-nyx-selecionada");
  await info.nth(1).click();
  await page.getByRole("heading", { name: "Magnus Force" }).click();
  await assertSelection(page, "nyx");
  await info.nth(1).click();
  await portrait(page, "nyx").click();
  await assertSelection(page);

  await portrait(page, "aria-kade").click();
  await info.nth(2).click();
  await page.getByRole("button", { name: "VOLTAR" }).click();
  assert.equal(await page.locator(".solo-selection").count(), 0);
  await menuClick(page, "SOLO");
  await assertSelection(page);
  assert.equal(await page.locator(".solo-selection-details:visible").count(), 0);
  assert.equal(await prompt.isVisible(), true);
  await page.getByRole("button", { name: "VOLTAR" }).click();
  await menuClick(page, "MULTIJOGADOR");
  await page.waitForFunction(() => window.__game.scene.isActive("MultiplayerMenu"));
  assert.equal(await page.locator(".solo-selection").count(), 0);
  console.log("OK: estado inicial, fichas, troca direta, desmarcação, retorno e menu multiplayer.");
  await page.close();

  for (const id of ids) {
    const game = await openMenu(desktop);
    await menuClick(game, "SOLO");
    await portrait(game, id).click();
    await game.evaluate(() => {
      const scene = window.__game.scene.getScene("Start");
      const start = scene.scene.start.bind(scene.scene);
      window.__soloStarts = [];
      scene.scene.start = (key, data) => {
        window.__soloStarts.push([key, data]);
        return start(key, data);
      };
    });
    await game.getByRole("button", { name: "INICIAR SOLO" }).dblclick();
    await game.locator(".cutscene-skip").click({ timeout: 60000 });
    await game.waitForFunction(id => {
      const level = window.__game.scene.getScene("Level1");
      return level?.scene.isActive() && level.player?.active && level.personagemSelecionada === id;
    }, id, { timeout: 120000 });
    assert.equal(await game.evaluate(() => window.__game.scene.getScene("Level1").player.texture.key), textures[id]);
    assert.deepEqual(await game.evaluate(() => window.__soloStarts),
      [["BootPartida", { personagem: id, multiplayer: false }]]);
    assert.equal(await game.locator(".solo-selection").count(), 0);
    console.log(`OK: partida iniciada uma única vez com ${id}.`);
    await game.close();
  }

  const mobile = await browser.newContext({ viewport: { width: 844, height: 320 }, hasTouch: true, isMobile: true });
  const phone = await openMenu(mobile);
  await menuClick(phone, "SOLO", true);
  await portrait(phone, "kai-mercer").tap();
  const touch = await mobile.newCDPSession(phone);
  const questions = phone.getByRole("button", { name: /^Ficha de / });
  for (let i = 0; i < ids.length; i++) {
    const question = questions.nth(i);
    assert.ok((await question.boundingBox()).height >= 44);
    await question.tap();
    await swipeToLastStat(phone, touch, ids[i]);
    await assertSelection(phone, "kai-mercer");
  }
  await capture(phone, "4-celular-paisagem");
  for (let i = 0; i < ids.length; i++) await questions.nth(i).tap();
  await phone.evaluate(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  });
  for (const [width, height] of [[667, 375], [390, 844], [360, 800]]) {
    await phone.setViewportSize({ width, height });
    await phone.waitForFunction(({ width, height }) => {
      const box = document.querySelector(".solo-selection").getBoundingClientRect();
      return box.width === width && box.height === height;
    }, { width, height });
    const controls = await phone.getByRole("button").evaluateAll(buttons => buttons.map(button => {
      const { left, top, right, bottom, width, height } = button.getBoundingClientRect();
      return { left, top, right, bottom, width, height };
    }));
    assert.equal(controls.length, 10);
    for (const control of controls) {
      assert.ok(control.width >= 44 && control.height >= 44);
      assert.ok(control.left >= 0 && control.top >= 0 && control.right <= width + 1 && control.bottom <= height);
    }
    await portrait(phone, "nyx").tap();
    await assertSelection(phone, "nyx");
    await questions.nth(3).tap();
    assert.equal(await phone.getByRole("heading", { name: "Nyx-07 — Reaper" }).isVisible(), true);
    if (height > width) await swipeToLastStat(phone, touch, "nyx");
    await assertSelection(phone, "nyx");
    await questions.nth(3).tap();
    await portrait(phone, "kai-mercer").tap();
    await capture(phone, `celular-${width}x${height}`);
  }
  assert.equal(requests.some(path => /SELEÇAO_DE_PERSONAGEM\.pdf/i.test(path)), false);
  assert.deepEqual(errors, []);
  console.log("OK: paisagem e retrato, alvos de toque, rolagem nativa das quatro fichas e seleção preservada.");
} finally {
  await browser.close();
}
