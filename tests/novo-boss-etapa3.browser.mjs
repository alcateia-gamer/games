/**
 * Ataques da nova boss integrados ao Phaser/WebGL e ao jogador reais.
 * Inicie um servidor HTTP na raiz e execute com PLAYWRIGHT_MODULE e
 * PLAYWRIGHT_BROWSERS_PATH (ou CHROMIUM_PATH), como nos testes anteriores.
 * BASE_URL, CHROME_CDP e NOVO_BOSS_SCREENSHOT são opcionais.
 * A instância do jogo só é exposta pela interceptação nesta sessão de teste.
 */
import assert from "node:assert/strict";
import { assetsNovoBoss } from "../js/enemies/novoBoss/NovoBossAssets.js";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

const configAtaques = {
  ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ilusoes: { ...novoBossConfig.ilusoes, ativo: false },
  clones: { ...novoBossConfig.clones, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const configIsolada = {
  ...configAtaques,
  ataques: { ...novoBossConfig.ataques, automatico: false },
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
  if (response.status() >= 400 && /boss-test|HeavensFury|novoBoss/i.test(response.url())) {
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

const snapshot = () => page.evaluate(assets => {
  const scene = window.__game.scene.getScene("Level1Parte2");
  const boss = scene.novoBoss;
  return {
    estado: boss?.estado, vidaBoss: boss?.vida,
    posicaoBoss: boss?.sprite ? { x: boss.sprite.x, y: boss.sprite.y } : null,
    configuracao: boss?.config?.ataques,
    relogio: boss?.relogioCombate,
    ataque: typeof boss?.ataqueAtual?.snapshot === "function"
      ? boss.ataqueAtual.snapshot() : boss?.ataqueAtual?.snapshot ?? null,
    tipoAtaque: boss?.ataqueAtual?.tipo ?? null,
    vidaPlayer: scene.vida,
    player: scene.player ? {
      x: scene.player.x, y: scene.player.y,
      vx: scene.player.body.velocity.x, vy: scene.player.body.velocity.y,
    } : null,
    restricao: scene.restricaoControleNovoBoss ? {
      fonte: scene.restricaoControleNovoBoss.fonte,
      restanteMs: scene.restricaoControleNovoBoss.restanteMs,
      duracaoMs: scene.restricaoControleNovoBoss.duracaoMs,
    } : null,
    objetos: scene.children.list.filter(child => child.active).map(child => ({
      nome: child.name, tipo: child.type, x: child.x, y: child.y,
      visible: child.visible, alpha: child.alpha,
      fillColor: child.fillColor, strokeColor: child.strokeColor,
      comandos: child.type === "Graphics" ? [...(child.commandBuffer ?? [])] : undefined,
      texture: child.texture?.key, frame: child.frame?.name,
    })).filter(child => child.nome?.startsWith("novo-boss") ||
      child.texture === assets.heavensFury.chave),
    oldBoss: Boolean(scene.bossFinal),
  };
}, assetsNovoBoss);

async function placePlayer(x, y) {
  await page.evaluate(async ({ x, y }) => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.player.setPosition(x, y);
    scene.player.body.reset(x, y);
    scene.player.body.setVelocity(0, 0);
    const { atualizarHitboxDanoPlayer } = await import("/js/player/Player.js");
    atualizarHitboxDanoPlayer(scene);
  }, { x, y });
}

// A cena fica pausada para que os deltas não dependam da velocidade do CI.
// Os módulos, objetos visuais, hitboxes e serviços de dano são os de produção.
async function advance(ms, passo = 10) {
  await page.evaluate(async ({ ms, passo }) => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    let restante = ms;
    do {
      const delta = Math.min(passo, restante);
      atualizarNovoBoss(scene, scene.time.now, delta);
      restante -= delta;
    } while (restante > 0);
    scene.children.depthSort();
  }, { ms, passo });
}

async function iniciarAtaque(tipo) {
  const result = await page.evaluate(tipo => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.novoBoss.cancelarAtaque();
    // O timer compartilhado de 500 ms fica pausado com a cena. Cada caso começa
    // com o jogador vulnerável; o serviço de dano e suas defesas não são trocados.
    scene.player.invulneravel = false;
    scene.player.combatKnockbackUntil = 0;
    scene.player.clearTint();
    const aceito = scene.novoBoss.executarAtaque(tipo);
    return { aceito: Boolean(aceito), tipo: scene.novoBoss.ataqueAtual?.tipo };
  }, tipo);
  assert.ok(result.aceito, `O comando real deve iniciar ${tipo}.`);
  const nomes = { pulso: "pulsoRepulsao", chuva: "chuvaRaios" };
  assert.ok([tipo, nomes[tipo]].includes(result.tipo),
    `O comando ${tipo} deve iniciar o ataque correspondente (${result.tipo}).`);
  return snapshot();
}

async function cancelarAtaque() {
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").novoBoss.cancelarAtaque();
  });
}

function assertAvisoVermelho(state) {
  const avisos = state.objetos.filter(objeto => objeto.nome?.startsWith("novo-boss-aviso"));
  assert.ok(avisos.some(aviso => aviso.visible && aviso.alpha > 0),
    "Deve existir um aviso vermelho visível antes do perigo.");
  const ehVermelho = cor => Number.isInteger(cor) && cor > 0xffff && cor <= 0xffffff &&
    (cor >> 16 & 255) >= 180 && (cor >> 16 & 255) > (cor >> 8 & 255) * 1.4 &&
    (cor >> 16 & 255) > (cor & 255) * 1.2;
  assert.ok(avisos.some(aviso => ehVermelho(aviso.fillColor) ||
    ehVermelho(aviso.strokeColor) || aviso.comandos?.some(ehVermelho)),
  "O objeto de aviso precisa efetivamente desenhar vermelho.");
}

async function restartEncounter(personagem = "kai-mercer", config = configIsolada) {
  await page.evaluate(({ personagem, config }) => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    window.__controllerAntesRestartEtapa3 = scene.novoBoss;
    window.__spriteAntesRestartEtapa3 = scene.novoBoss.sprite;
    scene.scene.resume();
    scene.scene.restart({
      personagem, spawnX: -1093, spawnY: -5520,
      novoBossConfig: config,
    });
  }, { personagem, config });
  await page.waitForFunction(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    return scene.scene.isActive() && scene.player?.active && scene.novoBoss?.sprite &&
      !scene.cameras.main.fadeEffect.isRunning &&
      scene.novoBoss !== window.__controllerAntesRestartEtapa3;
  }, null, { timeout: 60000, polling: 100 });
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").scene.pause();
  });
  await advance(0);
  assert.ok(await page.evaluate(() =>
    !window.__spriteAntesRestartEtapa3.active && !window.__spriteAntesRestartEtapa3.scene));
}

try {
  console.log("BOOT: abrindo o jogo no servidor HTTP.");
  await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:8765/", {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => window.__novoBossBootReady === true);
  await page.keyboard.press("k");
  await page.waitForFunction(() => window.__game?.scene.getScene("Level1")?.player?.active,
    null, { timeout: 60000, polling: 100 });
  await page.evaluate(config => {
    window.__game.scene.getScene("Level1").scene.start("Level1Parte2", {
      personagem: "kai-mercer", spawnX: -1093, spawnY: -5520,
      novoBossConfig: config,
    });
  }, configIsolada);
  await page.waitForFunction(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    return scene.scene.isActive() && scene.player?.active && scene.novoBoss?.sprite &&
      !scene.cameras.main.fadeEffect.isRunning;
  }, null, { timeout: 60000, polling: 100 });
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").scene.pause();
  });
  await advance(0);
  assert.equal((await snapshot()).oldBoss, false);
  console.log("BOOT: encontro e jogador reais prontos; cena pausada para deltas controlados.");

  let state = await snapshot();
  const bossPosition = state.posicaoBoss;
  await placePlayer(bossPosition.x + 80, bossPosition.y);
  state = await iniciarAtaque("pulso");
  const hpAntesPulso = state.vidaPlayer;
  assertAvisoVermelho(state);
  const configPulso = state.configuracao.pulsoRepulsao;
  await advance(configPulso.avisoMs - 1);
  state = await snapshot();
  assert.equal(state.vidaPlayer, hpAntesPulso, "O pulso não causa dano durante o aviso.");
  await advance(configPulso.expansaoMs);
  state = await snapshot();
  assert.equal(hpAntesPulso - state.vidaPlayer, configPulso.dano);
  assert.ok(Math.abs(Math.hypot(state.player.vx, state.player.vy) - configPulso.empurrao) < 0.1,
    "O impacto deve aplicar a força de repulsão real ao corpo do jogador.");
  await advance(1);
  assert.equal((await snapshot()).vidaPlayer, state.vidaPlayer,
    "Uma expansão não pode atingir o mesmo jogador duas vezes.");
  console.log("PASS: pulso anuncia em vermelho, causa dano uma vez e aplica repulsão real.");

  await cancelarAtaque();
  await placePlayer(bossPosition.x + configPulso.raio + 90, bossPosition.y);
  const pulsoFora = await iniciarAtaque("pulso");
  await advance(configPulso.avisoMs + configPulso.expansaoMs);
  assert.equal((await snapshot()).vidaPlayer, pulsoFora.vidaPlayer,
    "O pulso deve permitir esquiva para fora do alcance.");
  console.log("PASS: sair do raio anunciado evita o dano do pulso.");

  await cancelarAtaque();
  await placePlayer(-1093, -5680);
  state = await iniciarAtaque("chuva");
  assertAvisoVermelho(state);
  const configChuva = state.configuracao.chuvaRaios;
  assert.equal(state.ataque.marcas.length, configChuva.quantidade);
  const primeiraMarca = state.ataque.marcas[0];
  for (const marca of state.ataque.marcas.filter(marca => marca.iniciou)) {
    assert.ok(marca.x - configChuva.raio >= -1621 && marca.x + configChuva.raio <= -537);
    assert.ok(marca.y - configChuva.raio >= -6144 && marca.y + configChuva.raio <= -5470);
  }
  await placePlayer(primeiraMarca.x, primeiraMarca.y);
  const hpAntesChuva = state.vidaPlayer;
  await advance(configChuva.avisoMs);
  state = await snapshot();
  const raioVisual = state.objetos.find(objeto => objeto.texture === assetsNovoBoss.heavensFury.chave);
  assert.ok(raioVisual?.visible, "O raio deve usar o PNG Heavens Fury fornecido.");
  assert.equal(raioVisual.frame, 0);
  assert.equal(state.vidaPlayer, hpAntesChuva, "O início visual não antecipa o impacto.");
  const antesImpacto = configChuva.frameImpacto * configChuva.frameMs - 1;
  await advance(antesImpacto);
  state = await snapshot();
  assert.equal(state.vidaPlayer, hpAntesChuva);
  assertAvisoVermelho(state);
  await page.screenshot({ path: process.env.NOVO_BOSS_SCREENSHOT ?? "/tmp/novo-boss-etapa3.png" });
  await advance(1);
  state = await snapshot();
  assert.equal(hpAntesChuva - state.vidaPlayer, configChuva.dano);
  assert.equal(state.objetos.find(objeto => objeto.texture === assetsNovoBoss.heavensFury.chave)?.frame,
    configChuva.frameImpacto, "O dano coincide com o quadro de impacto da folha.");
  await advance(configChuva.perigoMs + 10);
  assert.equal((await snapshot()).vidaPlayer, state.vidaPlayer,
    "Um raio não pode aplicar dano repetido no mesmo impacto.");
  console.log("PASS: chuva usa Heavens Fury, marca áreas válidas e sincroniza dano com o quadro de impacto.");

  await cancelarAtaque();
  await placePlayer(bossPosition.x + 170, bossPosition.y);
  state = await iniciarAtaque("lasers");
  const configLasers = state.configuracao.lasersEspiral;
  const hpAntesLaser = state.vidaPlayer;
  assertAvisoVermelho(state);
  await advance(configLasers.avisoMs - 1);
  state = await snapshot();
  assert.equal(state.ataque.emitidos, 0);
  assert.equal(state.vidaPlayer, hpAntesLaser);
  await advance(1);
  state = await snapshot();
  assert.equal(state.ataque.emitidos, 1);
  const primeiroLaser = state.ataque.projeteis[0];
  assert.ok(primeiroLaser, "O primeiro disparo precisa existir no mapa real.");
  await advance(100);
  state = await snapshot();
  const primeiroAvancado = state.ataque.projeteis[0];
  assert.ok(Math.abs(Math.hypot(primeiroAvancado.x - primeiroLaser.x,
    primeiroAvancado.y - primeiroLaser.y) - configLasers.velocidade * 0.1) < 0.01,
  "O laser deve percorrer a distância configurada e permitir leitura da trajetória.");
  await advance(configLasers.intervaloMs - 100);
  state = await snapshot();
  assert.equal(state.ataque.emitidos, 2);
  assert.ok(state.ataque.projeteis.length >= 2);
  const [a, b] = state.ataque.projeteis;
  const angulo = Math.atan2(a.dx * b.dy - a.dy * b.dx, a.dx * b.dx + a.dy * b.dy) * 180 / Math.PI;
  assert.ok(Math.abs(angulo - configLasers.passoAngulo) < 0.001,
    "Disparos sucessivos precisam formar a espiral configurada.");
  await advance(1500);
  state = await snapshot();
  assert.equal(hpAntesLaser - state.vidaPlayer, configLasers.dano,
    "A trajetória real do laser deve atingir a hitbox do jogador.");
  console.log("PASS: lasers aguardam o aviso, percorrem lentamente a arena, formam espiral e causam dano.");

  await cancelarAtaque();
  await placePlayer(bossPosition.x + 170, bossPosition.y);
  state = await iniciarAtaque("lasers");
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").events.emit("player:especial");
  });
  assert.ok(await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    return scene.estadoEspecial.parryAte > scene.time.now && scene.estadoEspecial.parryGrafico?.active;
  }), "O teste precisa ativar o parry real do Kai.");
  await advance(configLasers.avisoMs + 1700);
  assert.equal((await snapshot()).vidaPlayer, state.vidaPlayer,
    "Os lasers da nova boss devem respeitar o parry existente.");
  console.log("PASS: os lasers preservam a defesa especial real do Kai.");

  // Reinicia a visita para que o parry do caso anterior não proteja esta captura.
  await restartEncounter();
  await placePlayer(-1093, -5680);
  state = await iniciarAtaque("tentaculos");
  const configTentaculos = state.configuracao.tentaculos;
  assertAvisoVermelho(state);
  assert.equal(state.ataque.armadilhas.length, configTentaculos.quantidade);
  const primeiraArmadilha = state.ataque.armadilhas[0];
  await placePlayer(primeiraArmadilha.x, primeiraArmadilha.y);
  const hpAntesAgarrar = state.vidaPlayer;
  await advance(configTentaculos.avisoMs - 1);
  state = await snapshot();
  assert.equal(state.restricao, null);
  assert.equal(state.vidaPlayer, hpAntesAgarrar);
  await advance(1);
  state = await snapshot();
  assert.ok(state.restricao?.fonte.startsWith("novo-boss-tentaculo-"));
  assert.ok(state.ataque.armadilhas[0].segurando);
  assert.equal(state.restricao.restanteMs, configTentaculos.agarrarMs);
  // O plugin de teclado da cena recebe eventos apenas quando está ativo.
  // Deixa o jogo processar a tecla real e então volta aos deltas controlados.
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").scene.resume();
  });
  await page.waitForFunction(() =>
    window.__game.scene.getScene("Level1Parte2").scene.isActive());
  await page.waitForTimeout(100);
  await page.keyboard.down("d");
  await page.waitForFunction(() =>
    window.__game.scene.getScene("Level1Parte2").teclasWASD.direita.isDown);
  const bloqueio = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { atualizarMovimento } = await import("/js/controls/PlayerMovement.js");
    const { iniciarDash } = await import("/js/controls/PlayerDashControls.js");
    atualizarMovimento(scene);
    return {
      tecladoPressionado: scene.teclasWASD.direita.isDown,
      velocidade: Math.hypot(scene.player.body.velocity.x, scene.player.body.velocity.y),
      dash: iniciarDash(scene),
    };
  });
  assert.ok(bloqueio.tecladoPressionado, "O teste deve fornecer entrada real de teclado.");
  assert.equal(bloqueio.velocidade, 0);
  assert.equal(bloqueio.dash, false);
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").scene.pause();
  });
  const restanteContencao = (await snapshot()).restricao.restanteMs;
  await advance(restanteContencao - 1);
  assert.ok((await snapshot()).restricao);
  await advance(2);
  state = await snapshot();
  assert.equal(state.restricao, null, "O controle deve voltar ao fim da contenção.");
  assert.equal(state.vidaPlayer, hpAntesAgarrar, "O agarrão confirmado não causa dano adicional.");
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").scene.resume();
  });
  await page.waitForFunction(() =>
    window.__game.scene.getScene("Level1Parte2").scene.isActive());
  await page.waitForTimeout(100);
  // Pausar reinicia os Key objects do Phaser; gera novamente a tecla física.
  await page.keyboard.up("d");
  await page.keyboard.down("d");
  await page.waitForFunction(() =>
    window.__game.scene.getScene("Level1Parte2").teclasWASD.direita.isDown);
  const movimentoDepois = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { atualizarMovimento } = await import("/js/controls/PlayerMovement.js");
    atualizarMovimento(scene);
    return scene.player.body.velocity.x;
  });
  assert.ok(movimentoDepois > 0, "A mesma tecla deve voltar a mover o jogador após a liberação.");
  await page.keyboard.up("d");
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").scene.pause();
  });
  console.log("PASS: tentáculos avisam, contêm por 2,5 s, bloqueiam movimento/dash e devolvem o controle sem dano extra.");

  await cancelarAtaque();
  await placePlayer(primeiraArmadilha.x, primeiraArmadilha.y);
  await iniciarAtaque("tentaculos");
  await advance(configTentaculos.avisoMs);
  assert.ok((await snapshot()).restricao);
  await cancelarAtaque();
  assert.equal((await snapshot()).restricao, null);
  await iniciarAtaque("tentaculos");
  await advance(configTentaculos.avisoMs);
  assert.ok((await snapshot()).restricao);
  await placePlayer(-1093, -5350);
  await advance(0);
  state = await snapshot();
  assert.equal(state.restricao, null);
  assert.equal(state.ataque, null);
  console.log("PASS: cancelamento e saída da arena removem contenção e ataques sem prender o jogador.");

  await placePlayer(primeiraArmadilha.x, primeiraArmadilha.y);
  await advance(0);
  await iniciarAtaque("tentaculos");
  await advance(configTentaculos.avisoMs);
  assert.ok((await snapshot()).restricao);
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").morteEmAndamento = true;
  });
  await advance(0);
  state = await snapshot();
  assert.equal(state.restricao, null);
  assert.equal(state.ataque, null);
  console.log("PASS: a morte também libera a contenção e cancela os perigos ativos.");

  await restartEncounter("aria-kade");
  await placePlayer(-1093, -5680);
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").events.emit("player:especial");
  });
  assert.ok(await page.evaluate(() =>
    window.__game.scene.getScene("Level1Parte2").especialHolograma?.active),
  "O teste precisa criar o holograma real da Aria.");
  await iniciarAtaque("tentaculos");
  await advance(configTentaculos.avisoMs);
  assert.ok((await snapshot()).restricao);
  const trocaBloqueada = await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const antes = { x: scene.player.x, y: scene.player.y };
    scene.events.emit("player:especial");
    return { antes, depois: { x: scene.player.x, y: scene.player.y },
      holograma: Boolean(scene.especialHolograma?.active) };
  });
  assert.deepEqual(trocaBloqueada.depois, trocaBloqueada.antes,
    "A troca com o holograma não deve contornar a contenção.");
  assert.ok(trocaBloqueada.holograma, "A tentativa bloqueada deve preservar o holograma.");
  console.log("PASS: a contenção respeita o holograma existente e bloqueia a troca de posição.");

  await restartEncounter();
  state = await snapshot();
  assert.equal(state.restricao, null);
  assert.equal(state.ataque, null);
  assert.equal(state.oldBoss, false);
  assert.ok(state.objetos.every(objeto => objeto.texture !== assetsNovoBoss.heavensFury.chave &&
    !objeto.nome?.startsWith("novo-boss-aviso")));
  console.log("PASS: reiniciar durante a captura limpa recursos e cria encontro único sem o boss antigo.");

  await restartEncounter("kai-mercer", configAtaques);
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    window.__ataquesAutomaticosEtapa3 = [];
    scene.events.on("novo-boss:ataque-iniciado", ({ tipo }) =>
      window.__ataquesAutomaticosEtapa3.push(tipo));
  });
  await advance(50000, 50);
  const automaticos = await page.evaluate(() => window.__ataquesAutomaticosEtapa3);
  for (const tipo of ["pulso", "chuva", "lasers", "tentaculos"]) {
    assert.ok(automaticos.includes(tipo),
      `A sequência normal de combate deve executar ${tipo}: ${automaticos.join(", ")}`);
  }
  console.log("PASS: a sequência automática do encontro executa os quatro ataques no jogo.");

  assert.deepEqual(assetErrors, []);
  assert.deepEqual(errors, []);
} catch (error) {
  console.error("Estado na falha:", await snapshot().catch(() => null));
  console.error("Erros JavaScript:", errors, "Falhas de recursos:", assetErrors);
  await page.screenshot({ path: "/tmp/novo-boss-etapa3-falha.png" }).catch(() => {});
  throw error;
} finally {
  await context.close();
  await browser.close();
}
