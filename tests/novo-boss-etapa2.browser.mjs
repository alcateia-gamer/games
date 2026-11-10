/**
 * Etapa 2 no Phaser/WebGL real: vida, janela de dano, arma real, teletransporte,
 * suspensão, derrota, reentrada e limpeza.
 * Inicie o servidor na raiz e execute com PLAYWRIGHT_MODULE e
 * PLAYWRIGHT_BROWSERS_PATH (ou CHROMIUM_PATH) apontando para a instalação local.
 * BASE_URL, CHROME_CDP e NOVO_BOSS_SCREENSHOT são opcionais.
 * A instrumentação expõe o jogo só nesta sessão; nenhum arquivo do jogo é alterado.
 */
import assert from "node:assert/strict";
import { assetsNovoBoss } from "../js/enemies/novoBoss/NovoBossAssets.js";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

// Testa vida/estados/teletransporte, sem ataques nem alvos das etapas seguintes.
const configIsolada = {
  ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ilusoes: { ...novoBossConfig.ilusoes, ativo: false },
  clones: { ...novoBossConfig.clones, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};

console.log("BOOT: carregando Playwright e iniciando Chromium.");
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
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(60000);
const errors = [];
const assetErrors = [];
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
  assert.notEqual(body, source, "A sessão precisa expor a instância real do jogo.");
  await route.fulfill({ response, body: `${body}\nwindow.__novoBossBootReady = true;\n` });
});

const snapshot = () => page.evaluate(idleKey => {
  const scene = window.__game.scene.getScene("Level1Parte2");
  const boss = scene.novoBoss;
  const body = boss?.body;
  const hitbox = boss?.hitboxDano;
  return {
    estado: boss?.estado, vida: boss?.vida, vidaMaxima: boss?.vidaMaxima,
    morto: boss?.morto, suspenso: boss?.suspenso,
    relogio: boss?.relogioCombate, tempoEstado: boss?.tempoEstado,
    ultimoTeleporteEm: boss?.ultimoTeleporteEm,
    sprite: boss?.sprite ? {
      active: boss.sprite.active, visible: boss.sprite.visible,
      x: boss.sprite.x, y: boss.sprite.y, alpha: boss.sprite.alpha,
      bodyEnabled: body?.enable,
    } : null,
    hitbox: hitbox ? {
      x: hitbox.x, y: hitbox.y, width: hitbox.width, height: hitbox.height,
    } : null,
    body: body ? { x: body.x, y: body.y, width: body.width, height: body.height } : null,
    hud: boss?.hud ? {
      visible: boss.hud.container.visible,
      vida: boss.hud.textoVida.text,
      estado: boss.hud.textoEstado.text,
      width: boss.hud.preenchimento.width,
    } : null,
    count: scene.children.list.filter(child =>
      child.active && child.texture?.key === idleKey).length,
    oldBoss: Boolean(scene.bossFinal),
  };
}, assetsNovoBoss.idle.chave);

async function placePlayer(x, y) {
  await page.evaluate(({ x, y }) => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.player.setPosition(x, y);
    scene.player.body.reset(x, y);
    scene.player.body.setVelocity(0, 0);
  }, { x, y });
}

// Somente o encontro avança enquanto a cena está pausada. Isso verifica os mesmos
// módulos de produção sem trocar relógios, estados, configuração ou funções.
async function advance(ms) {
  await page.evaluate(async ms => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { atualizarBoss } = await import("/js/enemies/BossPrincipal.js");
    let restante = ms;
    do {
      const delta = Math.min(50, restante);
      atualizarBoss(scene, scene.time.now, delta);
      restante -= delta;
    } while (restante > 0);
  }, ms);
}

async function advanceUntil(estado, limite = 20000) {
  const result = await page.evaluate(async ({ estado, limite }) => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { atualizarBoss } = await import("/js/enemies/BossPrincipal.js");
    for (let tempo = 0; tempo <= limite; tempo += 50) {
      if (scene.novoBoss.estado === estado) return { encontrou: true, tempo };
      atualizarBoss(scene, scene.time.now, 50);
    }
    return { encontrou: false, estado: scene.novoBoss.estado };
  }, { estado, limite });
  assert.ok(result.encontrou, `Estado ${estado} não alcançado: ${JSON.stringify(result)}`);
  return snapshot();
}

function assertAligned(state) {
  assert.ok(state.body && state.hitbox, "Corpo e hitbox devem existir após o teletransporte.");
  for (const key of ["x", "y", "width", "height"]) {
    assert.ok(Math.abs(state.body[key] - state.hitbox[key]) < 0.01,
      `O corpo e a hitbox devem permanecer sincronizados (${key}).`);
  }
}

try {
  console.log("BOOT: abrindo o jogo no servidor HTTP.");
  await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:8765/", {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.__novoBossBootReady === true);
  console.log("BOOT: página carregada; iniciando o jogo com a tecla K.");
  await page.keyboard.press("k");
  await page.waitForFunction(() => window.__game?.scene.getScene("Level1")?.player?.active,
    null, { timeout: 60000, polling: 100 });
  console.log("BOOT: Level1 pronto; abrindo Level1Parte2 fora da arena.");
  await page.evaluate(config => {
    window.__game.scene.getScene("Level1").scene.start("Level1Parte2", {
      personagem: "kai-mercer", spawnX: -1093, spawnY: -5350,
      novoBossConfig: config,
    });
  }, configIsolada);
  await page.waitForFunction(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    return scene.scene.isActive() && scene.player?.active && scene.novoBoss;
  }, null, { timeout: 60000, polling: 100 });
  console.log("BOOT: fábrica pronta; pausando a cena para controlar os deltas do encontro.");
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.scene.pause();
    window.__newBossTeleportStarts = [];
    scene.events.on("novo-boss:teleporte-iniciado", ({ encontro, motivo }) => {
      window.__newBossTeleportStarts.push({ motivo, em: encontro.relogioCombate });
    });
  });

  let state = await snapshot();
  assert.equal(state.estado, "aguardando");
  assert.equal(state.count, 0);
  assert.equal(state.oldBoss, false);
  console.log("BOOT: encontro aguardando; posicionando o jogador na entrada da arena.");
  await placePlayer(-1093, -5520);
  await advance(0);
  state = await snapshot();
  assert.equal(state.estado, "preparando");
  assert.equal(state.vida, state.vidaMaxima);
  assert.ok(state.vidaMaxima > 0);
  assert.equal(state.count, 1);
  assert.ok(state.hud.visible);
  assert.equal(state.hud.vida, `${state.vidaMaxima} / ${state.vidaMaxima}`);
  const fullBarWidth = state.hud.width;
  const blocked = await page.evaluate(() => {
    const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
    return { aceito: boss.receberDano(25), vida: boss.vida };
  });
  assert.equal(blocked.aceito, false);
  assert.equal(blocked.vida, state.vida);
  console.log("PASS: entrar na arena inicia vida e HUD; a preparação bloqueia dano.");

  const pointChecks = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { areaCorpoNovoBoss } = await import("/js/enemies/novoBoss/NovoBossConfig.js");
    const { retanguloLivreDoMapa } = await import("/js/enemies/EnemyPathfinding.js");
    const config = scene.novoBoss.config;
    return config.teleporte.pontos.map(ponto => {
      const area = areaCorpoNovoBoss(config, ponto);
      return {
        x: ponto.x, y: ponto.y,
        livre: retanguloLivreDoMapa(scene, area),
        dentro: area.x >= config.arena.xMin && area.y >= config.arena.yMin &&
          area.x + area.width <= config.arena.xMax &&
          area.y + area.height <= config.arena.yMax,
      };
    });
  });
  assert.equal(pointChecks.length, 4);
  assert.equal(new Set(pointChecks.map(point => `${point.x},${point.y}`)).size, 4);
  assert.ok(pointChecks.every(point => point.livre && point.dentro), JSON.stringify(pointChecks));
  console.log("PASS: os quatro destinos cabem na arena e estão livres no mapa real.");

  await advanceUntil("vulneravel");
  const arrowHit = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const boss = scene.novoBoss;
    const robots = (scene.inimigos ?? []).map(robot => [robot, robot.vida]);
    const hpAntes = boss.vida;
    const centerX = boss.hitboxDano.x + boss.hitboxDano.width / 2;
    const centerY = boss.hitboxDano.y + boss.hitboxDano.height / 2;
    // No disparo para cima a corda está em X=29 do frame. Compensa a origem
    // atual do jogador para que a trajetória real passe pelo centro do alvo.
    const playerX = centerX - 29 + scene.player.displayOriginX;
    scene.player.setPosition(playerX, centerY + 120);
    scene.player.body.reset(playerX, centerY + 120);
    scene.direcaoAtual = "up";
    scene.direcaoAtaque = "up";
    const { dispararProjetil, atualizarProjeteis } = await import("/js/player/PlayerProjectiles.js");
    const flecha = dispararProjetil(scene);
    const criada = Boolean(flecha?.active && flecha.projetilPlayer);
    atualizarProjeteis(scene, 400);
    const primeiroDano = hpAntes - boss.vida;
    const segundoDanoAceito = primeiroDano === 25 ? boss.receberDano(25) : null;
    return {
      criada, primeiroDano, segundoDanoAceito,
      consumida: !flecha?.active,
      robosIntactos: robots.every(([robot, vida]) => robot.vida === vida),
    };
  });
  assert.ok(arrowHit.criada, "O teste precisa disparar uma flecha de verdade.");
  assert.equal(arrowHit.primeiroDano, 25);
  assert.equal(arrowHit.segundoDanoAceito, false, "O primeiro acerto fecha a janela.");
  assert.ok(arrowHit.consumida && arrowHit.robosIntactos);
  state = await snapshot();
  assert.equal(state.hud.vida, `${state.vida} / ${state.vidaMaxima}`);
  assert.ok(Math.abs(state.hud.width - fullBarWidth * state.vida / state.vidaMaxima) < 0.01);
  console.log("PASS: flecha real causa dano uma vez, atualiza HUD e preserva os robôs.");

  const beforeTeleport = await snapshot();
  await advanceUntil("teletransportando");
  await advance(100);
  const beforeSuspend = await snapshot();
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").morteEmAndamento = true;
  });
  await advance(5000);
  const suspended = await snapshot();
  assert.ok(suspended.suspenso);
  assert.equal(suspended.relogio, beforeSuspend.relogio);
  assert.equal(suspended.tempoEstado, beforeSuspend.tempoEstado);
  assert.equal(suspended.sprite.visible, false);
  assert.equal(suspended.sprite.bodyEnabled, false);
  assert.equal(suspended.hud.visible, false);
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").morteEmAndamento = false;
  });
  await advance(0);
  state = await advanceUntil("preparando");
  assert.notDeepEqual([state.sprite.x, state.sprite.y],
    [beforeTeleport.sprite.x, beforeTeleport.sprite.y]);
  assert.ok(pointChecks.some(point => point.x === state.sprite.x && point.y === state.sprite.y));
  assert.ok(state.sprite.visible && state.sprite.bodyEnabled && !state.suspenso);
  assertAligned(state);
  console.log("PASS: teletransporte reativo muda de ponto; morrer no meio suspende e retoma com hitbox alinhada.");

  const hpBeforeExit = state.vida;
  const clockBeforeExit = state.relogio;
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    window.__bossControllerBeforeRestart = scene.novoBoss;
    window.__bossSpriteBeforeRestart = scene.novoBoss.sprite;
    window.__bossHudBeforeRestart = scene.novoBoss.hud.container;
  });
  await placePlayer(-1093, -5350);
  await advance(5000);
  state = await snapshot();
  assert.equal(state.vida, hpBeforeExit);
  assert.equal(state.relogio, clockBeforeExit);
  assert.equal(state.hud.visible, false);
  await placePlayer(-1093, -5520);
  await advance(0);
  state = await snapshot();
  assert.equal(state.vida, hpBeforeExit);
  assert.equal(state.count, 1);
  assert.ok(state.hud.visible);
  assert.ok(await page.evaluate(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss === window.__bossControllerBeforeRestart));
  console.log("PASS: sair pausa o combate; voltar preserva vida, entidade e HUD sem duplicação.");

  // O ponto de entrada fica distante de todos os destinos nesta arena. O teste
  // avança o período de ausência de aproximação sem esperar dez segundos reais.
  const beforePreventive = state.ultimoTeleporteEm;
  await advanceUntil("teletransportando", 20000);
  state = await advanceUntil("preparando");
  assert.ok(state.ultimoTeleporteEm > beforePreventive);
  assertAligned(state);
  const teleportEvents = await page.evaluate(() => ({
    eventos: window.__newBossTeleportStarts,
    intervalo: window.__game.scene.getScene("Level1Parte2").novoBoss.config.teleporte.intervaloMinimoMs,
  }));
  assert.equal(teleportEvents.eventos[0].motivo, "reativo");
  assert.equal(teleportEvents.eventos.at(-1).motivo, "preventivo");
  for (let index = 1; index < teleportEvents.eventos.length; index++) {
    assert.ok(teleportEvents.eventos[index].em - teleportEvents.eventos[index - 1].em >=
      teleportEvents.intervalo, "Teletransportes respeitam o intervalo mínimo.");
  }
  console.log("PASS: permanecer distante aciona o teletransporte preventivo com destino válido.");

  await placePlayer(state.sprite.x, state.sprite.y + 130);
  await advanceUntil("vulneravel");
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").scene.resume();
  });
  await page.waitForTimeout(100);
  await page.screenshot({ path: process.env.NOVO_BOSS_SCREENSHOT ?? "/tmp/novo-boss-etapa2.png" });
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").scene.pause();
  });
  await advanceUntil("vulneravel");
  const defeat = await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const boss = scene.novoBoss;
    window.__newBossDefeats = 0;
    scene.events.on("novo-boss:derrotada", () => window.__newBossDefeats++);
    const aceito = boss.receberDano(boss.vidaMaxima + 1);
    return { aceito, repetido: boss.receberDano(1), eventos: window.__newBossDefeats };
  });
  assert.equal(defeat.aceito, true);
  assert.equal(defeat.repetido, false);
  assert.equal(defeat.eventos, 1);
  await advance(20000);
  await placePlayer(-1093, -5350);
  await advance(0);
  await placePlayer(-1093, -5520);
  await advance(0);
  state = await snapshot();
  assert.equal(state.estado, "derrotada");
  assert.equal(state.vida, 0);
  assert.ok(state.morto);
  assert.equal(await page.evaluate(() => window.__newBossDefeats), 1);
  console.log("PASS: derrota acontece uma vez e sair/voltar não ressuscita a boss.");

  await page.evaluate(config => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.scene.resume();
    scene.scene.restart({ personagem: "kai-mercer", spawnX: -1093, spawnY: -5350,
      novoBossConfig: config });
  }, configIsolada);
  await page.waitForFunction(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    return scene.novoBoss && scene.novoBoss !== window.__bossControllerBeforeRestart &&
      scene.novoBoss.estado === "aguardando" && scene.player?.active;
  }, null, { timeout: 60000, polling: 100 });
  assert.ok(await page.evaluate(() =>
    !window.__bossSpriteBeforeRestart.active && !window.__bossSpriteBeforeRestart.scene &&
    !window.__bossHudBeforeRestart.scene));
  state = await snapshot();
  assert.equal(state.count, 0);
  assert.equal(state.vida, state.vidaMaxima);
  assert.deepEqual(assetErrors, []);
  assert.deepEqual(errors, []);
  console.log("PASS: reiniciar destrói sprite/HUD antigos e cria novo encontro; recursos e JavaScript sem erros.");
} catch (error) {
  console.error("Estado na falha:", await snapshot().catch(() => null));
  console.error("Erros JavaScript:", errors, "Falhas de recursos:", assetErrors);
  await page.screenshot({ path: "/tmp/novo-boss-etapa2-falha.png" }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
