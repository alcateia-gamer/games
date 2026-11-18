/** Lobby e partida reais, com sessões isoladas e broker MQTT local. */
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tools = process.env.COOP_TEST_TOOLS || "/tmp/coop-test-tools";
const aedes = require(`${tools}/node_modules/aedes`)();
const { WebSocketServer, createWebSocketStream } = require(`${tools}/node_modules/ws`);
const broker = new WebSocketServer({ host: "127.0.0.1", port: 0 });
broker.on("connection", socket => aedes.handle(createWebSocketStream(socket)));
await once(broker, "listening");
const address = `ws://127.0.0.1:${broker.address().port}`;
const actions = [];
aedes.on("publish", (packet, client) => {
  if (client && packet.topic.endsWith("/action")) actions.push(JSON.parse(packet.payload.toString()).type);
});
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ headless: true, args: [
  "--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader",
  "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
] });
const artifacts = process.env.ARTIFACT_DIR || "/tmp/lobby-selection";
mkdirSync(artifacts, { recursive: true });
const errors = [];

async function phaserClick(page, label, touch = false) {
  const text = page.getByText(label, { exact: true });
  await text.waitFor();
  const { x, y, width, height } = await text.boundingBox();
  if (touch) await page.touchscreen.tap(x + width / 2, y + height / 2);
  else await page.mouse.click(x + width / 2, y + height / 2);
}

async function openMenu(mobile = false) {
  const context = await browser.newContext(mobile
    ? { viewport: { width: 844, height: 320 }, isMobile: true, hasTouch: true }
    : { viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/js/core/game.js*", async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace("const game = new Game(jogoRapido);",
      "const game = window.__game = new Game(jogoRapido);");
    await route.fulfill({ response, body });
  });
  await page.route("**/js/core/config.js", async route => {
    const response = await route.fetch();
    const body = (await response.text()).replace(/brokerUrl: "[^"]+"/g, `brokerUrl: "${address}"`);
    await route.fulfill({ response, body });
  });
  await page.route("https://unpkg.com/mqtt@*/**", route => route.fulfill({
    path: `${tools}/node_modules/mqtt/dist/mqtt.min.js`,
    contentType: "application/javascript",
  }));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8765/");
  const play = page.locator("#start-game");
  if (mobile) await play.tap();
  else await play.click();
  await page.waitForFunction(() => window.__game?.scene.getScene("Start").menuLayer?.alpha >= .99);
  await phaserClick(page, "MULTIJOGADOR", mobile);
  await page.waitForFunction(() => window.__game.registry.get("multiplayer")?.mqtt.connected);
  return page;
}

function portrait(page, id) {
  return page.locator(`.coop-lobby [data-operator="${id}"] .operator-selection-portrait`);
}

async function slots(page, expected) {
  await page.waitForFunction(expected => {
    const rows = Array.from(document.querySelectorAll(".coop-lobby-roster li"), row => row.textContent);
    return JSON.stringify(rows) === JSON.stringify(expected);
  }, expected);
}

async function selection(page, selected, owners = {}) {
  await page.locator(".coop-lobby .operator-selection").waitFor();
  await page.waitForFunction(({ selected, owners }) => {
    const portraits = [...document.querySelectorAll(".coop-lobby .operator-selection-portrait")];
    return portraits.length === 4 && portraits.every(button => {
      const id = button.parentElement.dataset.operator;
      const active = id === selected;
      const owner = owners[id] || "";
      const image = button.querySelector(".operator-selection-crop img");
      const marker = button.querySelector(".operator-selection-owner");
      const info = button.parentElement.querySelector(".operator-selection-info img");
      return image.complete && button.getAttribute("aria-pressed") === String(active)
        && getComputedStyle(image).filter.includes("grayscale") === (!active && Boolean(selected || owner))
        && marker.textContent === owner && marker.hidden === !owner
        && getComputedStyle(marker).filter === "none"
        && getComputedStyle(info).filter === "none"
        && getComputedStyle(button.querySelector(".operator-selection-name")).filter === "none";
    });
  }, { selected, owners });
}

async function join(page, code, mobile = false) {
  await page.bringToFront();
  if (mobile) {
    await page.getByRole("textbox", { name: "Código da sala" }).fill(code);
  } else {
    await page.getByText("ENTRAR", { exact: true }).waitFor();
    const previous = await page.evaluate(() => window.__game.scene.getScene("MultiplayerMenu").code);
    for (const _ of previous) await page.keyboard.press("Backspace", { delay: 70 });
    for (const key of code.toLowerCase()) await page.keyboard.press(key, { delay: 70 });
  }
  assert.equal(await page.evaluate(() => window.__game.scene.getScene("MultiplayerMenu").code), code);
  await phaserClick(page, "ENTRAR", mobile);
  await page.waitForFunction(code => document.querySelector(".coop-lobby h1 strong")?.textContent === code, code);
}

async function scrollMobileSheet(page, panel) {
  const touch = await page.context().newCDPSession(page);
  try {
    const { x, y, width, height } = await panel.boundingBox();
    const from = Math.round(y + height - 8);
    const touchX = Math.round(x + width / 2);
    const remaining = await panel.evaluate(node => node.scrollHeight - node.clientHeight);
    assert.ok(remaining > 0);
    for (let swipe = 0; swipe < 2 + Math.ceil(remaining / (height - 30)); swipe++) {
      await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: touchX, y: from }] });
      for (let step = 1; step <= 6; step++) {
        await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [
          { x: touchX, y: Math.round(from - step * (height - 16) / 6) },
        ] });
      }
      await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    assert.equal(await panel.evaluate(node => node.querySelector("li:last-child").getBoundingClientRect().bottom
      <= node.getBoundingClientRect().bottom), true);
  } finally {
    await touch.detach();
  }
}

try {
  const [host, guest] = await Promise.all([openMenu(), openMenu(true)]);
  await phaserClick(host, "CRIAR SALA");
  const code = await host.locator(".coop-lobby h1 strong").innerText();
  assert.match(code, /^[A-Z0-9]{4}$/);
  await join(guest, code, true);
  const hostStart = host.getByRole("button", { name: "INICIAR PARTIDA" });
  assert.equal(await hostStart.isDisabled(), true);
  assert.equal(await guest.getByRole("button", { name: "INICIAR PARTIDA" }).count(), 0);
  assert.equal(await guest.getByRole("button", { name: "PRONTO", exact: true }).isDisabled(), true);
  await slots(host, ["J1 · VOCÊ · HOST · ESCOLHENDO", "J2 · ESCOLHENDO", "J3 · VAGO", "J4 · VAGO"]);
  await slots(guest, ["J1 · HOST · ESCOLHENDO", "J2 · VOCÊ · ESCOLHENDO", "J3 · VAGO", "J4 · VAGO"]);
  await Promise.all([selection(host, null), selection(guest, null)]);

  await portrait(host, "magnus-force").click();
  await slots(host, ["J1 · VOCÊ · HOST · MAGNUS", "J2 · ESCOLHENDO", "J3 · VAGO", "J4 · VAGO"]);
  await slots(guest, ["J1 · HOST · MAGNUS", "J2 · VOCÊ · ESCOLHENDO", "J3 · VAGO", "J4 · VAGO"]);
  await selection(host, "magnus-force", { "magnus-force": "J1 · VOCÊ" });
  await selection(guest, null, { "magnus-force": "J1" });
  await guest.screenshot({ path: `${artifacts}/celular-escolhendo.png` });

  await portrait(host, "kai-mercer").click();
  await selection(guest, null, { "kai-mercer": "J1" });
  await portrait(host, "magnus-force").click();
  await selection(guest, null, { "magnus-force": "J1" });

  await portrait(guest, "aria-kade").tap();
  const hostOwners = { "magnus-force": "J1 · VOCÊ", "aria-kade": "J2" };
  const guestOwners = { "magnus-force": "J1", "aria-kade": "J2 · VOCÊ" };
  await slots(host, ["J1 · VOCÊ · HOST · MAGNUS", "J2 · ARIA", "J3 · VAGO", "J4 · VAGO"]);
  await slots(guest, ["J1 · HOST · MAGNUS", "J2 · VOCÊ · ARIA", "J3 · VAGO", "J4 · VAGO"]);
  await Promise.all([selection(host, "magnus-force", hostOwners), selection(guest, "aria-kade", guestOwners)]);
  await portrait(guest, "magnus-force").tap();
  await guest.getByText("Esse personagem já foi escolhido", { exact: true }).waitFor();
  await selection(guest, "aria-kade", guestOwners);
  await host.getByRole("button", { name: "PRONTO", exact: true }).click();
  await guest.getByRole("button", { name: "PRONTO", exact: true }).tap();
  await guest.getByRole("button", { name: "CANCELAR PRONTO" }).tap();
  await slots(host, ["J1 · VOCÊ · HOST · MAGNUS · PRONTO", "J2 · ARIA", "J3 · VAGO", "J4 · VAGO"]);
  await guest.getByRole("button", { name: "PRONTO", exact: true }).tap();
  await guest.getByRole("button", { name: "CANCELAR PRONTO" }).waitFor();
  await portrait(guest, "nyx").tap();
  await slots(host, ["J1 · VOCÊ · HOST · MAGNUS · PRONTO", "J2 · NYX", "J3 · VAGO", "J4 · VAGO"]);
  await selection(host, "magnus-force", { "magnus-force": "J1 · VOCÊ", nyx: "J2" });
  await selection(guest, "nyx", { "magnus-force": "J1", nyx: "J2 · VOCÊ" });
  await portrait(guest, "aria-kade").tap();
  await selection(guest, "aria-kade", guestOwners);
  await guest.getByRole("button", { name: "PRONTO", exact: true }).tap();

  const hostReady = ["J1 · VOCÊ · HOST · MAGNUS · PRONTO", "J2 · ARIA · PRONTO"];
  const guestReady = ["J1 · HOST · MAGNUS · PRONTO", "J2 · VOCÊ · ARIA · PRONTO"];
  await slots(host, [...hostReady, "J3 · VAGO", "J4 · VAGO"]);
  await slots(guest, [...guestReady, "J3 · VAGO", "J4 · VAGO"]);
  const changesBefore = actions.filter(type => ["select_character", "player_ready"].includes(type)).length;
  const question = guest.getByRole("button", { name: "Ficha de Magnus Force" });
  await question.tap();
  const sheet = guest.locator("#coop-details-magnus-force");
  await sheet.waitFor();
  await scrollMobileSheet(guest, sheet);
  assert.deepEqual(await guest.locator(".coop-lobby").evaluate(root => {
    const gallery = root.querySelector(".operator-selection").getBoundingClientRect();
    const panel = root.querySelector("#coop-details-magnus-force").getBoundingClientRect();
    return [gallery.top <= panel.top, panel.bottom <= gallery.bottom,
      root.querySelectorAll(".operator-selection-details:not([hidden])").length];
  }), [true, true, 1]);
  assert.equal(actions.filter(type => ["select_character", "player_ready"].includes(type)).length, changesBefore);
  await slots(guest, [...guestReady, "J3 · VAGO", "J4 · VAGO"]);
  await selection(guest, "aria-kade", guestOwners);
  await guest.screenshot({ path: `${artifacts}/celular-ficha.png` });
  await question.tap();
  await guest.screenshot({ path: `${artifacts}/celular.png` });
  await host.screenshot({ path: `${artifacts}/host.png` });
  await host.setViewportSize({ width: 568, height: 320 });
  await host.waitForFunction(() => {
    const lobby = document.querySelector(".coop-lobby");
    const positions = Array.from(lobby.querySelectorAll(".coop-lobby-roster li"), row => row.getBoundingClientRect().top);
    return positions[0] === positions[1] && positions[2] === positions[3] && positions[0] < positions[2];
  });
  const buttonBoxes = await Promise.all((await host.locator(".coop-lobby-actions button").all())
    .map(button => button.boundingBox()));
  for (const [index, box] of buttonBoxes.entries()) {
    assert.ok(box && box.height >= 44 && box.x >= 0 && box.y + box.height <= 320);
    if (index) assert.ok(buttonBoxes[index - 1].x + buttonBoxes[index - 1].width < box.x);
  }
  assert.ok(buttonBoxes[0].width >= 94);
  assert.ok(buttonBoxes[2].width >= 154 && buttonBoxes[2].height >= 50 && buttonBoxes[2].x + buttonBoxes[2].width <= 568);
  await host.screenshot({ path: `${artifacts}/celular-estreito.png` });
  await host.setViewportSize({ width: 1280, height: 720 });
  console.log("OK: duas sessões, seleção individual, duplicata recusada, prontidão e ficha local com rolagem por toque.");

  const [third, fourth] = await Promise.all([openMenu(), openMenu()]);
  await join(third, code);
  await slots(third, ["J1 · HOST · MAGNUS · PRONTO", "J2 · ARIA · PRONTO", "J3 · VOCÊ · ESCOLHENDO", "J4 · VAGO"]);
  await selection(third, null, { "magnus-force": "J1", "aria-kade": "J2" });
  await join(fourth, code);
  await portrait(third, "kai-mercer").click();
  await portrait(fourth, "nyx").click();
  await slots(host, [...hostReady, "J3 · KAI", "J4 · NYX"]);
  await slots(fourth, ["J1 · HOST · MAGNUS · PRONTO", "J2 · ARIA · PRONTO", "J3 · KAI", "J4 · VOCÊ · NYX"]);
  await selection(host, "magnus-force", { ...hostOwners, "kai-mercer": "J3", nyx: "J4" });
  await selection(third, "kai-mercer", { "magnus-force": "J1", "aria-kade": "J2", "kai-mercer": "J3 · VOCÊ", nyx: "J4" });
  await host.screenshot({ path: `${artifacts}/quatro-vagas.png` });
  await third.getByRole("button", { name: "SAIR", exact: true }).click();
  await slots(guest, [...guestReady, "J3 · NYX", "J4 · VAGO"]);
  await selection(guest, "aria-kade", { ...guestOwners, nyx: "J3" });
  await fourth.getByRole("button", { name: "SAIR", exact: true }).click();
  await slots(host, [...hostReady, "J3 · VAGO", "J4 · VAGO"]);
  await selection(host, "magnus-force", hostOwners);
  console.log("OK: entrada em sala com escolhas, quatro vagas ocupadas e saídas sincronizadas.");

  // O fluxo de entrada também permite conferir a faixa após a migração do host.
  await phaserClick(third, "MULTIJOGADOR");
  await phaserClick(third, "CRIAR SALA");
  const migrationCode = await third.locator(".coop-lobby h1 strong").innerText();
  await phaserClick(fourth, "MULTIJOGADOR");
  await join(fourth, migrationCode);
  await third.getByRole("button", { name: "SAIR", exact: true }).click();
  await slots(fourth, ["J1 · VOCÊ · HOST · ESCOLHENDO", "J2 · VAGO", "J3 · VAGO", "J4 · VAGO"]);
  assert.equal(await fourth.getByRole("button", { name: "INICIAR PARTIDA" }).isVisible(), true);
  await fourth.getByRole("button", { name: "SAIR", exact: true }).click();
  await Promise.all([third.context().close(), fourth.context().close()]);
  console.log("OK: migração atualiza HOST e a ação de iniciar.");

  await hostStart.dblclick();
  await Promise.all([host, guest].map(page => page.locator(".cutscene-skip").click({ timeout: 60000 })));
  for (const [page, id, sprite] of [[host, "magnus-force", "personagem2-walk"], [guest, "aria-kade", "personagem3-walk"]]) {
    await page.waitForFunction(({ id, sprite, code }) => {
      const scene = window.__game.scene.getScene("Level1");
      return scene?.scene.isActive() && scene.multiplayer && scene.personagemSelecionada === id
        && scene.player?.active && scene.player.texture.key === sprite
        && window.__game.registry.get("multiplayer").room.roomCode === code;
    }, { id, sprite, code }, { timeout: 120000 });
    assert.equal(await page.locator(".coop-lobby").count(), 0);
  }
  assert.equal(actions.filter(type => type === "start_game").length, 1);
  assert.deepEqual(errors, []);
  console.log("OK: um pedido de início após clique duplo; Magnus e Aria na mesma primeira fase.");
} finally {
  await browser.close();
  for (const socket of broker.clients) socket.terminate();
  await Promise.all([
    new Promise(resolve => broker.close(resolve)),
    new Promise(resolve => aedes.close(resolve)),
  ]);
}
