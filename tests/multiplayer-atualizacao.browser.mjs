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
if (process.env.COOP_BROWSER_DEBUG) process.env.DEBUG = "pw:browser";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browserOptions = { executablePath: process.env.CHROMIUM_PATH,
  headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-unsafe-swiftshader",
    "--disable-gpu-watchdog", "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows", "--disable-renderer-backgrounding"] };
const browser = await chromium.launch(browserOptions);
// As páginas compartilham o cache de imagens, mas cada uma executa seu próprio
// jogo e cliente MQTT. Isso evita decodificar duas vezes todos os sprites no CI.
const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
const artifacts = process.env.ARTIFACT_DIR || "/tmp/multiplayer-atualizacao";
const phase = process.env.COOP_TEST_PHASE || "all";
assert.ok(["all", "world", "abilities", "boss", "parity", "music"].includes(phase), "COOP_TEST_PHASE inválida");
mkdirSync(artifacts, { recursive: true });
const errors = [], report = { checks: [], passed: false };
const pages = [];
function check(name, value) { assert.ok(value, name); report.checks.push(name); console.log("OK", name); }
async function pageBoot(name) {
  const page = await context.newPage(); pages.push(page); page.setDefaultTimeout(25000);
  page.on("request", request => {
    if (/BOSS_FINAL|\/bossFinal\/|\/BossFinal\.js|\/bossRaio\.js|EnergiaBoss\.png|raio_boss\.mp3|soco_boss_[12]\.mp3/i.test(decodeURIComponent(request.url()))) {
      errors.push(`${name}: carregou recurso do boss antigo: ${request.url()}`);
    }
  });
  page.on("pageerror", e => { errors.push(`${name}: ${e.stack}`); console.error(name, e.stack); });
  page.on("crash", () => { errors.push(`${name}: navegador encerrou inesperadamente`); console.error(`CRASH: navegador ${name}`); });
  await page.route("**/js/core/game.js*", async route => {
    const response = await route.fetch();
    const source = await response.text();
    await route.fulfill({ response, body: source.replace("const game = new Game(jogoRapido);",
      "const game = window.__game = new Game(jogoRapido);") + "\nwindow.__coopBootReady = true;\n" });
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8765/", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__coopBootReady);
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
  if (process.env.COOP_BROWSER_DEBUG)
    console.log("MAP", map, character, await page.evaluate(() => performance.memory?.usedJSHeapSize));
  await page.evaluate(({ map, x, y, character }) => {
    const active = window.__game.scene.getScenes(true).find(s => ["Level1", "Level1Parte2"].includes(s.sys.settings.key));
    window.__runtimeBeforeRestart = active.coopRuntime;
    const data = { multiplayer: true, personagem: character, spawnX: x, spawnY: y,
      novoBossConfig: { ...window.__bossTestConfig } };
    if (!window.__bossTestConfig) delete data.novoBossConfig;
    if (active.sys.settings.key === map) active.scene.restart(data); else active.scene.start(map, data);
  }, { map, x, y, character });
  await page.waitForFunction(map => {
    const s = window.__game.scene.getScene(map);
    return s.scene.isActive() && s.coopRuntime && s.coopRuntime !== window.__runtimeBeforeRestart && !s.cameras.main.fadeEffect.isRunning;
  }, map, { timeout: 60000 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.detach();
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
  await get(host, async () => {
    const s = window.__game.scene.getScene("Level1");
    s.enemySpawnManager?.destroy(); s.enemySpawnManager = null;
    const { limparGrupoRobos } = await import("/js/enemies/EnemyTest.js"); limparGrupoRobos(s);
  });
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
  if (phase === "music") {
    for (const page of pages) {
      await page.keyboard.press("g");
      await get(page, () => window.__game.sound.context.resume());
    }
    async function assertMusic(key) {
      await client.waitForFunction(key => {
        const s = window.__game.scene.getScenes(true).find(s => s.coopRuntime), music = s?.coopRuntime.music;
        if (!music?.replica?.isPlaying || music.replica.key !== key || !Number.isFinite(music.hostOffset)) return false;
        const p = music.replica, state = music.state;
        const elapsed = Math.max(0, (performance.now() + music.hostOffset - state.at) / 1000);
        let expected = state.position + elapsed * state.rate;
        if (expected >= state.end) expected = state.start + (expected - state.start) % (state.end - state.start);
        const actual = (p.currentMarker?.start || 0) + p.seek;
        let error = Math.abs(actual - expected);
        if (actual >= state.start && expected >= state.start) error = Math.min(error, Math.abs(state.end - state.start - error));
        return error < 0.2;
      }, key);
      const reference = await get(host, () => {
        const s = window.__game.scene.getScenes(true).find(s => s.coopRuntime);
        return s.coopRuntime.music.snapshot();
      });
      const sample = await get(client, reference => {
        const r = window.__game.scene.getScenes(true).find(s => s.coopRuntime).coopRuntime;
        const p = r.music.replica;
        let expected = reference.position + Math.max(0, (performance.now() + r.music.hostOffset - reference.at) / 1000) * reference.rate;
        if (expected >= reference.end) expected = reference.start + (expected - reference.start) % (reference.end - reference.start);
        const actual = (p.currentMarker?.start || 0) + p.seek;
        let error = Math.abs(actual - expected);
        if (actual >= reference.start && expected >= reference.start) error = Math.min(error, Math.abs(reference.end - reference.start - error));
        return { key: p.key, actual, expected, error, volume: p.volume, corrections: r.music.corrections,
          active: r.music.sounds().filter(s => s.isPlaying).length };
      }, reference);
      report.musicSamples ||= []; report.musicSamples.push(sample);
      check(`${key}: faixa única acompanha a posição real do host (erro < 250 ms)`,
        reference.key === key && sample.key === key && sample.error < 0.25 && sample.active === 1);
      check(`${key}: entrada gradual respeita o volume da trilha`,
        sample.volume >= 0 && sample.volume <= (key === "musica-novo-boss" ? 0.100001 : 0.060001));
      return sample;
    }
    await assertMusic("musica-cidade");
    const corrections = await get(client, () => {
      const m = window.__game.scene.getScene("Level1").coopRuntime.music, sound = m.replica;
      sound.play(sound.currentMarker.name, { seek: -sound.currentMarker.start, volume: sound.volume });
      return m.corrections;
    });
    await client.waitForFunction(before => window.__game.scene.getScene("Level1").coopRuntime.music.corrections > before, corrections);
    await assertMusic("musica-cidade");
    check("cliente corrige uma reprodução atrasada sem reiniciar a faixa do host", true);
    await get(host, () => {
      const sound = window.__game.sound.getAll("musica-cidade").find(s => s.isPlaying);
      sound.play(sound.currentMarker.name, { seek: sound.currentMarker.duration - 0.05, volume: 0.06 });
    });
    await client.waitForFunction(() => {
      const m = window.__game.scene.getScene("Level1").coopRuntime.music;
      return m.state?.position >= 43.2 && m.state?.position < 50;
    });
    await assertMusic("musica-cidade");
    check("volta do loop da cidade mantém a introdução fora das repetições", true);
    await get(client, () => window.__game.sound.context.suspend());
    await host.waitForFunction(() => window.__game.sound.getAll("musica-cidade").some(s => s.isPlaying));
    await client.waitForTimeout(1000);
    await get(client, () => window.__game.sound.context.resume());
    await assertMusic("musica-cidade");
    check("retomar áudio suspenso recupera o ponto atual da música", true);
    await get(client, () => window.__game.scene.getScene("Level1").coopRuntime.teleport(72, -2130));
    await host.waitForFunction(() => {
      const c = window.__game.scene.getScene("Level1").coopRuntime.players.contexts()[0];
      return c && Math.hypot(c.player.x - 72, c.player.y + 2184) < 140;
    });
    await get(client, () => window.__game.scene.getScene("Level1").coopRuntime.world.requestMap("Level1Parte2"));
    for (const page of pages) await page.waitForFunction(() => {
      const s = window.__game.scene.getScene("Level1Parte2");
      return s?.scene.isActive() && s.coopRuntime && !s.cameras.main.fadeEffect.isRunning;
    }, null, { timeout: 60000 });
    await assertMusic("musica-fabrica");
    check("troca de mapa encerra cidade e sincroniza a entrada da fábrica", await get(client, () =>
      !window.__game.sound.getAll("musica-cidade").some(s => s.isPlaying)));
    await get(client, () => window.__game.scene.getScene("Level1Parte2").coopRuntime.teleport(-1093, -5520));
    await assertMusic("musica-novo-boss");
    check("cliente recebe música da cutscene e combate mesmo com host fora da arena", await get(host, () => {
      const r = window.__game.scene.getScene("Level1Parte2").coopRuntime;
      return !r.inArena(r.scene.player);
    }));
    await get(host, () => {
      const s = window.__game.scene.getScene("Level1Parte2");
      s.events.emit("novo-boss:derrotada", { encontro: s.novoBoss });
    });
    await assertMusic("musica-fabrica");
    check("fim da música do boss restaura a fábrica para os dois", true);
  }
  if (phase === "all" || phase === "parity") {
    await client.keyboard.down("1");
    await host.waitForFunction(() => window.__game.scene.getScene("Level1").inimigos.length === 1);
    await client.keyboard.up("1");
    await host.keyboard.down("2");
    await client.waitForFunction(() => window.__game.scene.getScene("Level1").inimigos.length === 3);
    await host.keyboard.up("2");
    check("teclas de spawn funcionam no host e no cliente", true);
    const bars = await get(host, () => {
      const s = window.__game.scene.getScene("Level1"), e = s.inimigos[0];
      window.__parityEnemy = e; e.vida = e.vidaMaxima / 2;
      for (const enemy of s.inimigos) {
        enemy.distanciaDeteccao = 0; enemy.distanciaAtaque = 0; enemy.tempoEntreTiros = Infinity;
      }
      return { red: s.coopRuntime.sender.id(e.barraVida), border: s.coopRuntime.sender.id(e.bordaVida) };
    });
    await client.waitForFunction(({ red, border }) => {
      const receiver = window.__game.scene.getScene("Level1").coopRuntime.receiver;
      const bar = receiver.get(red), outline = receiver.get(border);
      return bar?.isFilled && bar.fillColor === 0xe52b2b && bar.width === 30 &&
        outline?.isStroked && !outline.isFilled;
    }, bars);
    check("barra de vida vermelha reflete metade da vida e mantém a borda vazia", true);
    await client.screenshot({ path: `${artifacts}/barras-cliente.png` });
    for (const page of pages) await get(page, () => {
      const s = window.__game.scene.getScene("Level1"), shake = s.cameras.main.shake.bind(s.cameras.main);
      s.player.invulneravel = false;
      s.cameras.main.shake = (...args) => {
        window.__lastImpact = { args, vx: s.player.body.velocity.x, vy: s.player.body.velocity.y,
          dash: s.estadoDash.ativo, until: s.combatHitStopUntil, now: s.time.now };
        return shake(...args);
      };
    });
    await get(host, async () => {
      const s = window.__game.scene.getScene("Level1");
      const { causarDanoPlayer } = await import("/js/enemies/EnemyLaser.js");
      for (const laser of s.lasersInimigo?.getChildren() || []) laser.destroy();
      causarDanoPlayer(s, 10, { x: s.player.x - 80, y: s.player.y });
      const c = s.coopRuntime.players.contexts()[0];
      const entry = [...s.coopRuntime.players.remotes.values()][0];
      entry.invulnerableUntil = 0; entry.data.coop.invulnerable = false;
      s.coopRuntime.damage(c, 10, { x: c.player.x - 80, y: c.player.y });
    });
    for (const page of pages) await page.waitForFunction(() => window.__lastImpact);
    const impacts = await Promise.all(pages.map(p => get(p, () => window.__lastImpact)));
    report.impacts = impacts;
    check("host e cliente recebem o mesmo recuo, tremor e pausa de impacto do solo", impacts.every(i =>
      Math.abs(Math.hypot(i.vx, i.vy) - 35) < 0.001 && !i.dash && i.args[0] === 55 &&
      i.args[1] === 0.001 && Math.abs(i.until - i.now - 40) < 0.001));
    await get(client, () => {
      window.__manager.on("coopAction", a => {
        if (a.kind === "combatHit") window.__enemyImpact = a.payload;
      });
    });
    await get(host, async () => {
      const { causarDanoInimigo } = await import("/js/enemies/EnemyHealth.js");
      causarDanoInimigo(window.__game.scene.getScene("Level1"), window.__parityEnemy, 5);
    });
    await client.waitForFunction(() => window.__enemyImpact?.damage === 5);
    check("impacto de inimigo é transmitido mesmo quando dura menos que um snapshot", true);
    await get(client, () => window.__game.scene.getScene("Level1").botaoDesenvolvedor.emit("pointerdown"));
    await host.waitForFunction(() => window.__game.scene.getScene("Level1").coopRuntime.players.contexts()[0]?.developerMode);
    check("DEV do cliente é independente do host", await get(host, () => !window.__game.scene.getScene("Level1").developerMode));
    await client.keyboard.press("o");
    for (const page of pages) await page.waitForFunction(() => {
      const s = window.__game.scene.getScene("Level1Parte2");
      return s?.scene.isActive() && s.coopRuntime && !s.cameras.main.fadeEffect.isRunning;
    }, null, { timeout: 60000 });
    check("O do cliente leva os dois à entrada do boss e preserva DEV individual", await get(client, () => {
      const s = window.__game.scene.getScene("Level1Parte2");
      return s.developerMode && Math.abs(s.player.y + 5169) < 50;
    }));
    await get(host, () => window.__game.scene.getScene("Level1Parte2").coopRuntime.teleport(-1140, -5169));
    await get(client, () => window.__game.scene.getScene("Level1Parte2").coopRuntime.teleport(-1030, -5169));
    for (const page of pages) await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").lanternasAliadas?.size === 1);
    await client.keyboard.down("d");
    await host.waitForFunction(() => {
      const lamp = [...window.__game.scene.getScene("Level1Parte2").lanternasAliadas.values()][0];
      return lamp && Math.abs(lamp.pose.angulo) < 0.001;
    });
    await client.keyboard.up("d");
    check("lanternas dos aliados aparecem nos dois lados e usam a mira do dono", true);
    await get(host, () => window.__game.scene.getScene("Level1Parte2").falaCombustivel.mostrar("Host: precisamos de combustível."));
    await get(client, () => window.__game.scene.getScene("Level1Parte2").falaCombustivel.mostrar("Cliente: vou buscar o galão."));
    for (const page of pages) await page.waitForFunction(() => {
      const r = window.__game.scene.getScene("Level1Parte2").coopRuntime;
      return [...r.players.remotes.values()].some(e => [...e.speeches.values()]
        .some(b => b.texto.visible && b.texto.text.endsWith(".")));
    });
    await host.screenshot({ path: `${artifacts}/dialogos-lanternas-host.png` });
    await client.screenshot({ path: `${artifacts}/dialogos-lanternas-cliente.png` });
    check("diálogos completos dos dois jogadores aparecem para o aliado", true);
    await get(client, () => window.__game.scene.getScene("Level1Parte2").falaCombustivel.ocultar());
    await host.waitForFunction(() => [...window.__game.scene.getScene("Level1Parte2").coopRuntime.players.remotes.values()]
      .every(e => [...e.speeches.values()].every(b => !b.texto.visible)));
    check("ocultar a fala também a remove na tela do aliado", true);
    await get(client, () => window.__game.scene.getScene("Level1Parte2").botaoLuzFabrica.emit("pointerdown"));
    for (const page of pages) await page.waitForFunction(() => {
      const s = window.__game.scene.getScene("Level1Parte2");
      return s.luzFabricaAcesa && s.iluminacaoFabrica.energia && s.lanternasAliadas.size === 0;
    });
    await get(client, () => window.__game.scene.getScene("Level1Parte2").botaoLuzFabrica.emit("pointerdown"));
    for (const page of pages) await page.waitForFunction(() => {
      const s = window.__game.scene.getScene("Level1Parte2");
      return !s.luzFabricaAcesa && !s.iluminacaoFabrica.energia && s.lanternasAliadas.size === 1;
    });
    check("DEV do cliente liga e desliga luz para ambos com host fora de DEV", true);
    if (phase === "all") {
      await get(client, () => window.__game.scene.getScene("Level1Parte2").coopRuntime.world.requestMap("Level1"));
      for (const page of pages) await page.waitForFunction(() => {
        const s = window.__game.scene.getScene("Level1");
        return s?.scene.isActive() && s.coopRuntime && !s.cameras.main.fadeEffect.isRunning;
      }, null, { timeout: 60000 });
    }
  }
  if (phase === "all" || phase === "world") {
  await get(client, () => {
    const s = window.__game.scene.getScene("Level1"); s.vida = 40; s.events.emit("player:especial");
  });
  await host.waitForFunction(() => window.__game.scene.getScene("Level1").coopRuntime.players.contexts()[0]?.estadoEspecial?.auraNyx);
  await client.waitForFunction(() => [...window.__game.scene.getScene("Level1").coopRuntime.receiver.entries.values()]
    .some(e => e.state.anchor?.id === window.__manager.playerId));
  check("aura da Nyx segue o movimento local no mesmo quadro", await get(client, () => {
    const s = window.__game.scene.getScene("Level1"), r = s.coopRuntime;
    const entry = [...r.receiver.entries.values()].find(e => e.state.anchor?.id === window.__manager.playerId);
    r.teleport(s.player.x + 40, s.player.y);
    r.receiver.update(16);
    return Math.abs(entry.object.x - (entry.state.x + s.player.x - entry.state.anchor.x)) < 0.01;
  }));
  await client.waitForFunction(() => window.__game.scene.getScene("Level1").vida > 40);
  check("cura da Nyx chega ao cliente pela autoridade do host", await get(client, () => window.__game.scene.getScene("Level1").vida > 40));
  const kaiStarted = await get(host, async () => {
    const s = window.__game.scene.getScene("Level1"); s.events.emit("player:especial");
    const { criarRoboBola } = await import("/js/enemies/RoboBola.js");
    criarRoboBola(s, { x: -1200, y: 475 });
    return s.estadoEspecial?.parryAte > s.time.now && !!s.estadoEspecial.parryEfeito?.sprite.active;
  });
  check("habilidade do Kai no host continua ativa após preparar o aliado", kaiStarted);
  await client.waitForFunction(() => window.__game.scene.getScene("Level1").inimigos.some(e => e.tipoRobo === "bola"));
  check("Robô Bola preserva tipo, sprite e alvo remoto", await get(client, () => {
    const e = window.__game.scene.getScene("Level1").inimigos.find(e => e.tipoRobo === "bola");
    return e.remoteOnly && e.texture.key === "robo-bola" && e.hitboxDano;
  }));
  await client.screenshot({ path: `${artifacts}/cidade-coop.png` });
  check("sem erros JavaScript até a integração inicial", errors.length === 0);
  await get(host, async () => {
    const s = window.__game.scene.getScene("Level1");
    const { criarInimigoTeste } = await import("/js/enemies/EnemyTest.js");
    const { tentarDispararLaser } = await import("/js/enemies/EnemyLaser.js");
    const enemy = criarInimigoTeste(s, { x: s.player.x + 210, y: s.player.y, tempoEntreTiros: 500 });
    window.__shotEnemy = enemy;
    tentarDispararLaser(s, s.time.now + 1000, enemy);
  });
  await client.waitForFunction(() => [...window.__game.scene.getScene("Level1").coopRuntime.receiver.entries.values()]
    .some(e => e.state.k === "municao-vermelha-metralhadora-robo" && e.object.active && e.object.visible));
  check("munição vermelha do robô padrão é visível no cliente", true);
  await get(host, async () => {
    const { limparGrupoRobos } = await import("/js/enemies/EnemyTest.js");
    const s = window.__game.scene.getScene("Level1");
    s.enemySpawnManager = null; limparGrupoRobos(s);
  });
  await client.waitForFunction(() => {
    const s = window.__game.scene.getScene("Level1");
    return s.inimigos.length === 0 && ![...s.coopRuntime.receiver.entries.values()]
      .some(e => e.state.k === "municao-vermelha-metralhadora-robo");
  });
  check("remoção de inimigos e tiros não deixa imagens congeladas", true);
  // Perde um quadro de propósito: o próximo keyframe precisa reconstruir a réplica.
  await get(client, () => {
    const m = window.__manager, original = m.receiveCoopFrame.bind(m);
    m.receiveCoopFrame = packet => { m.receiveCoopFrame = original; window.__droppedFrame = packet.sequence; };
  });
  await client.waitForFunction(() => {
    const r = window.__game.scene.getScene("Level1").coopRuntime;
    return window.__droppedFrame && r.receivedSequence > window.__droppedFrame + 1 && !r.awaitingKeyframe;
  });
  check("cliente recupera o mundo após perda de snapshot", true);
  await get(client, () => window.__game.scene.getScene("Level1").coopRuntime.teleport(72, -2130));
  await host.waitForFunction(() => {
    const c = window.__game.scene.getScene("Level1").coopRuntime.players.contexts()[0];
    return c && Math.hypot(c.player.x - 72, c.player.y + 2184) < 140;
  });
  await get(client, () => window.__game.scene.getScene("Level1").coopRuntime.world.requestMap("Level1Parte2"));
  for (const page of pages) await page.waitForFunction(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    return s?.scene.isActive() && s.coopRuntime && !s.cameras.main.fadeEffect.isRunning;
  }, null, { timeout: 60000 });
  check("cliente conduz todos à fábrica pela transição cooperativa", true);
  await get(client, () => window.__game.scene.getScene("Level1Parte2").acenderLuzFabrica());
  await host.waitForFunction(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    return s.luzFabricaAcesa && s.iluminacaoFabrica.energia && s.coopRuntime.manager.room.coopProgress.flags.factoryGeneratorPowered;
  });
  await client.waitForFunction(() => window.__manager.room.coopProgress.flags.factoryGeneratorPowered);
  await client.waitForFunction(start => window.__manager.room.coopProgress.generatorStartedAt === start,
    await get(host, () => window.__manager.room.coopProgress.generatorStartedAt));
  const starts = await Promise.all(pages.map(page => get(page, () => window.__manager.room.coopProgress.generatorStartedAt)));
  if (process.env.COOP_BROWSER_DEBUG) console.log("GENERATOR STARTS", starts);
  check("gerador acionado pelo cliente compartilha energia e relógio de partida", starts[0] === starts[1]);
  if (phase === "world") {
    await get(client, () => window.__game.scene.getScene("Level1Parte2").botaoDesenvolvedor.emit("pointerdown"));
    await host.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").coopRuntime.players.contexts()[0]?.developerMode);
    await get(client, () => window.__game.scene.getScene("Level1Parte2").botaoLuzFabrica.emit("pointerdown"));
    for (const page of pages) await page.waitForFunction(() => {
      const s = window.__game.scene.getScene("Level1Parte2");
      return !s.luzFabricaAcesa && !s.iluminacaoFabrica.energia;
    });
    check("DEV do cliente apaga a luz mesmo com progresso do gerador confirmado", true);
    await get(client, () => window.__game.scene.getScene("Level1Parte2").acenderLuzFabrica());
    for (const page of pages) await page.waitForFunction(() => {
      const s = window.__game.scene.getScene("Level1Parte2");
      return s.luzFabricaAcesa && s.iluminacaoFabrica.energia && window.__manager.room.coopDevLighting == null;
    });
    check("acionar o gerador restaura a energia após teste de luz DEV", true);
  }
  await get(host, () => window.__game.scene.getScene("Level1Parte2").coopRuntime.world.requestMap("Level1"));
  for (const page of pages) await page.waitForFunction(() => {
    const s = window.__game.scene.getScene("Level1");
    return s.scene.isActive() && s.coopRuntime && !s.movimentoBloqueado && !s.cameras.main.fadeEffect.isRunning;
  }, null, { timeout: 60000 });
  check("retorno à cidade restaura movimento nos dois participantes", true);
  }
  for (const page of pages) await page.evaluate(async () => {
    const { novoBossConfig: config } = await import("/js/enemies/novoBoss/NovoBossConfig.js");
    window.__bossTestConfig = { ...config,
      cenaEntrada: { ...config.cenaEntrada, ativo: false },
      geradores: { ...config.geradores, ativo: false },
      prologo: { ...config.prologo, ativo: false },
      ataques: { ...config.ataques, ativo: false },
      movimento: { ...config.movimento, ativo: false },
      ilusoes: { ...config.ilusoes, ativo: false },
      clones: { ...config.clones, ativo: false },
      fase2: { ...config.fase2, ativo: false },
    };
  });
  if (phase === "all") {
  await Promise.all([
    gotoMap(host, "Level1Parte2", -1093, -5520, "kai-mercer"),
    gotoMap(client, "Level1Parte2", -1040, -5520, "nyx"),
  ]);
  for (const page of pages) await page.waitForFunction(() => {
    const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
    return boss?.active && boss.sprite?.active && boss.vida === 1000;
  });
  check("boss principal aparece no host e na réplica do cliente", await get(client, () =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.sprite.texture.key === "novo-boss-idle"));
  await get(client, () => window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(25));
  for (const page of pages) await page.waitForFunction(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.vida === 975);
  check("dano do cliente ao boss principal é autorizado pelo host e replicado", true);
  }
  async function characters(hostCharacter, clientCharacter) {
    await get(host, ({ hostCharacter, clientCharacter }) => {
      const m = window.__manager;
      for (const p of m.room.players) p.character = p.id === m.playerId ? hostCharacter : clientCharacter;
      m.publishState();
    }, { hostCharacter, clientCharacter });
    await client.waitForFunction(character => window.__manager.room.players
      .find(p => p.id === window.__manager.playerId).character === character, clientCharacter);
    await Promise.all([gotoMap(host, "Level1", -1405, 475, hostCharacter), gotoMap(client, "Level1", -1330, 475, clientCharacter)]);
    await host.waitForFunction(character => window.__game.scene.getScene("Level1").coopRuntime
      .players.contexts().some(c => c.personagemSelecionada === character), clientCharacter);
  }
  if (phase === "all" || phase === "abilities") {
  await characters("magnus-force", "kai-mercer");
  await get(client, () => window.__game.scene.getScene("Level1").events.emit("player:especial"));
  await host.waitForFunction(() => {
    const s = window.__game.scene.getScene("Level1"), c = s.coopRuntime.players.contexts()[0];
    return c?.estadoEspecial?.parryAte > s.time.now && c.tentarBloquearDanoEspecial();
  });
  await client.waitForFunction(() => {
    const s = window.__game.scene.getScene("Level1");
    return s.coopParryUntil > s.time.now && [...s.coopRuntime.receiver.entries.values()]
      .some(e => e.state.anchor?.id === window.__manager.playerId);
  });
  check("Kai cliente ativa domo visível e proteção autorizada no host", true);
  await get(host, () => window.__game.scene.getScene("Level1").events.emit("player:especial"));
  check("Magnus mantém habilidade independente do Kai remoto", await get(host, () => !!window.__game.scene.getScene("Level1").estadoEspecial?.onda));
  await characters("kai-mercer", "aria-kade");
  await get(client, () => window.__game.scene.getScene("Level1").events.emit("player:especial"));
  await host.waitForFunction(() => window.__game.scene.getScene("Level1").coopRuntime.players.contexts()[0]?.estadoEspecial?.holograma?.active);
  await client.waitForFunction(() => window.__game.scene.getScene("Level1").coopHologram);
  await client.waitForTimeout(400);
  const ariaBefore = await get(client, () => {
    const s = window.__game.scene.getScene("Level1");
    const before = { x: s.player.x, y: s.player.y }; s.events.emit("player:especial"); return before;
  });
  await host.waitForFunction(() => !window.__game.scene.getScene("Level1").coopRuntime.players.contexts()[0]?.estadoEspecial?.holograma);
  await client.waitForFunction(before => {
    const s = window.__game.scene.getScene("Level1");
    return Math.hypot(s.player.x - before.x, s.player.y - before.y) > 20 && !s.coopHologram;
  }, ariaBefore);
  check("Aria cliente invoca e troca com o holograma durante a recarga", true);
  }
  if (phase === "all" || phase === "boss") {
  if (phase === "boss") await get(host, () => {
    const m = window.__manager;
    for (const p of m.room.players) p.character = p.id === m.playerId ? "kai-mercer" : "aria-kade";
    m.publishState();
  });
  for (const page of pages) await page.evaluate(async () => {
    const { novoBossConfig: config } = await import("/js/enemies/novoBoss/NovoBossConfig.js");
    window.__bossTestConfig = { ...window.__bossTestConfig,
      cenaEntrada: { ...config.cenaEntrada, ativo: true, idaMs: 500, pausaMs: 300,
        viagemTorreMs: 80, enquadramentoMs: 100, cargaEscudoMs: 200, dissipacaoRaiosMs: 100,
        voltaMs: 300, velocidadeTorres: 10 }, geradores: { ...config.geradores, ativo: true } };
  });
  await Promise.all([gotoMap(host, "Level1Parte2", -1093, -5000, "kai-mercer"),
    gotoMap(client, "Level1Parte2", -1093, -5520, "aria-kade")]);
  await client.waitForFunction(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    return s.coopRuntime.world.introLock && !s.input.enabled && s.cenaEntradaBossAtiva;
  });
  check("entrada do cliente na arena inicia cutscene e bloqueia controles", true);
  await client.screenshot({ path: `${artifacts}/boss-cutscene-cliente.png` });
  await client.waitForFunction(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    return s.novoBoss?.introducao?.snapshot()?.concluida && !s.coopRuntime.world.introLock &&
      !s.cenaEntradaBossAtiva && !s.movimentoBloqueado && s.input.enabled && s.input.keyboard.enabled;
  }, null, { timeout: 60000 });
  check("cutscene do cliente termina com HUD, câmera e comandos restaurados", await get(client, () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    return s.cameras.main._follow === s.player && s.hudStatus?.elemento.style.visibility !== "hidden";
  }));
  check("introdução replica o estado das luzes da arena", await get(client, () =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.introducao.iluminacao.ativa === false));
  check("sala permanece revelada no cliente após as portas do boss fecharem", await get(client, () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const zones = s.zonasLuzApagada.zonas.filter(z => ["porta02", "porta03"].includes(z.porta?.nome));
    return zones.length > 0 && zones.every(z => z.liberada && z.opacidade === 0);
  }));
  await client.screenshot({ path: `${artifacts}/boss-apos-cutscene-cliente.png` });
  }
  check("integração termina sem erros JavaScript ou recursos do boss antigo", errors.length === 0);
  report.passed = true;
  writeFileSync(`${artifacts}/relatorio-${phase}.json`, JSON.stringify({ ...report, phase, errors }, null, 2));
  console.log("PASSOU integração inicial", artifacts);
} catch (error) {
  report.failure = String(error);
  report.states = await Promise.all(pages.map(p => p.evaluate(() => {
    const s = window.__game?.scene.getScenes(true).find(s => s.coopRuntime);
    return s && { map: s.sys.settings.key, host: s.isMultiplayerHost, input: s.input.enabled,
      keyboard: s.input.keyboard.enabled, enemies: s.inimigos.length,
      key1: { down: s.teclaSpawnRobo1?.isDown, justDown: s.teclaSpawnRobo1?._justDown },
      lock: s.movimentoBloqueado, dead: s.morteEmAndamento, hp: s.vida };
  }).catch(() => null)));
  throw error;
} finally {
  writeFileSync(`${artifacts}/relatorio-${phase}.json`, JSON.stringify({ ...report, phase, errors }, null, 2));
  await Promise.all(pages.map(p => p.evaluate(() => {
    window.__game?.loop.stop();
    window.__manager?.leaveRoom(false);
    window.__manager?.destroy();
  }).catch(() => {})));
  await browser.close();
  for (const socket of broker.clients) socket.terminate();
  await new Promise(resolve => broker.close(resolve));
  await new Promise(resolve => aedes.close(resolve));
}
