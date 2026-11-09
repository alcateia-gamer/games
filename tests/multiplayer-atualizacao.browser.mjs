/** Duas instâncias reais, MQTT/WebSocket local e a implementação do jogo sem mocks. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const toolsRoot = process.env.COOP_TEST_TOOLS || "/tmp/coop-test-tools";
const aedes = require(`${toolsRoot}/node_modules/aedes`)();
const { WebSocketServer, createWebSocketStream } = require(`${toolsRoot}/node_modules/ws`);
const broker = new WebSocketServer({ host: "127.0.0.1", port: 18884 });
broker.on("connection", socket => aedes.handle(createWebSocketStream(socket)));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH,
  headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader"] });
const artifacts = process.env.ARTIFACT_DIR || "/tmp/multiplayer-atualizacao";
mkdirSync(artifacts, { recursive: true });
const errors = [], report = { checks: [] };
const pages = [];
function check(name, value) { assert.ok(value, name); report.checks.push(name); console.log("OK", name); }
async function pageBoot(name) {
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await context.newPage(); pages.push(page); page.setDefaultTimeout(25000);
  page.on("pageerror", e => { errors.push(`${name}: ${e.stack}`); console.error(name, e.stack); });
  await page.route("**/js/core/game.js*", async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source.replace("const game = new Game(jogoRapido);", "const game = window.__game = new Game(jogoRapido);") });
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8765/", { waitUntil: "networkidle" });
  await page.keyboard.press("k");
  await page.waitForFunction(() => window.__game?.scene.getScene("Level1")?.player?.active, null, { timeout: 60000 });
  await page.addScriptTag({ path: `${toolsRoot}/node_modules/mqtt/dist/mqtt.min.js` });
  await page.evaluate(async () => {
    const { default: Client } = await import("/js/mqttClient.js");
    const { default: Manager } = await import("/js/multiplayer/multiplayerManager.js");
    const client = new Client({ brokerUrl: "ws://127.0.0.1:18884", topicPrefix: "test-coop" });
    const manager = new Manager(client); window.__manager = manager;
    window.__game.registry.set("multiplayer", manager); window.__game.registry.set("mqtt", client);
  });
  await page.waitForFunction(() => window.__manager.mqtt.connected);
  return page;
}
async function gotoMap(page, map, x, y, character) {
  await page.evaluate(({ map, x, y, character }) => {
    const active = window.__game.scene.getScenes(true).find(s => ["Level1", "Level1Parte2"].includes(s.sys.settings.key));
    const data = { multiplayer: true, personagem: character, spawnX: x, spawnY: y,
      novoBossConfig: { ...window.__bossTestConfig } };
    if (!window.__bossTestConfig) delete data.novoBossConfig;
    if (active.sys.settings.key === map) active.scene.restart(data); else active.scene.start(map, data);
  }, { map, x, y, character });
  await page.waitForFunction(map => {
    const s = window.__game.scene.getScene(map);
    return s.scene.isActive() && s.coopRuntime && !s.cameras.main.fadeEffect.isRunning;
  }, map, { timeout: 60000 });
}
async function get(page, fn, arg) { return page.evaluate(fn, arg); }
try {
  console.log("BOOT: dois navegadores e broker MQTT/WebSocket real.");
  const [host, client] = await Promise.all([pageBoot("host"), pageBoot("client")]);
  const code = await get(host, () => window.__manager.createRoom());
  await get(client, code => window.__manager.joinRoom(code), code);
  await host.waitForFunction(() => window.__manager.room.players.length === 2);
  await client.waitForFunction(() => window.__manager.room?.players.length === 2);
  await get(host, () => window.__manager.selectCharacter("kai-mercer"));
  await get(client, () => window.__manager.selectCharacter("nyx"));
  await host.waitForFunction(() => window.__manager.room.players.every(p => p.character));
  await get(host, () => window.__manager.setReady(true));
  await get(client, () => window.__manager.setReady(true));
  await host.waitForFunction(() => window.__manager.canStart());
  await get(host, () => window.__manager.startGame());
  await client.waitForFunction(() => window.__manager.room.status === "PLAYING");
  await Promise.all([gotoMap(host, "Level1", -1405, 475, "kai-mercer"), gotoMap(client, "Level1", -1330, 475, "nyx")]);
  for (const page of pages) await page.waitForFunction(() => window.__game.scene.getScene("Level1").remotePlayers.size === 1);
  check("dois personagens atuais presentes no mesmo mapa", true);
  report.contexts = await get(host, () => {
    const s = window.__game.scene.getScene("Level1"), r = s.coopRuntime;
    return { host: r.host, ownPet: !!s.companionPet?.active, localPet: !!r.localContext.companionPet?.active,
      remotes: [...r.players.remotes.values()].map(e => ({ id: e.data.id, ctx: !!e.context, pet: !!e.context?.companionPet?.active })) };
  });
  console.log("CONTEXTS", report.contexts);
  check("host mantém pet e contexto independente do aliado", await get(host, () => {
    const r = window.__game.scene.getScene("Level1").coopRuntime;
    return r.scene.companionPet?.active && r.players.contexts()[0]?.companionPet?.active;
  }));
  await get(client, () => {
    const s = window.__game.scene.getScene("Level1"); s.vida = 40; s.events.emit("player:especial");
  });
  await host.waitForFunction(() => window.__game.scene.getScene("Level1").coopRuntime.players.contexts()[0]?.estadoEspecial?.auraNyx);
  await client.waitForTimeout(2800);
  check("cura da Nyx chega ao cliente pela autoridade do host", await get(client, () => window.__game.scene.getScene("Level1").vida > 40));
  await get(host, async () => {
    const s = window.__game.scene.getScene("Level1"); s.events.emit("player:especial");
    const { criarRoboBola } = await import("/js/enemies/RoboBola.js");
    criarRoboBola(s, { x: -1200, y: 475 });
  });
  await client.waitForFunction(() => window.__game.scene.getScene("Level1").inimigos.some(e => e.tipoRobo === "bola"));
  check("Robô Bola preserva tipo, sprite e alvo remoto", await get(client, () => {
    const e = window.__game.scene.getScene("Level1").inimigos.find(e => e.tipoRobo === "bola");
    return e.remoteOnly && e.texture.key === "robo-bola" && e.hitboxDano;
  }));
  await client.screenshot({ path: `${artifacts}/cidade-coop.png` });
  check("sem erros JavaScript até a integração inicial", errors.length === 0);
  writeFileSync(`${artifacts}/relatorio.json`, JSON.stringify({ ...report, errors }, null, 2));
  console.log("PASSOU integração inicial", artifacts);
} finally {
  for (const p of pages) await p.evaluate(() => window.__manager?.destroy()).catch(() => {});
  await browser.close();
  for (const socket of broker.clients) socket.terminate();
  await new Promise(resolve => broker.close(resolve));
  await new Promise(resolve => aedes.close(resolve));
}
