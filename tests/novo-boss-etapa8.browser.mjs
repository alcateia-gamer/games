/** Luta solo completa: configuração de produção, armas reais e ciclo real do Phaser. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

// Nenhum valor de vida, dano, recarga, preparação, velocidade ou duração é reduzido.
const sessao = await abrirSessaoNovoBoss(novoBossConfig, { personagem: "aria-kade" });
const { page, posicionar, avancar, retomar, pausar, reiniciar } = sessao;
const consoleBoot = [...sessao.consoleErrors];

const snapshot = () => page.evaluate(() => {
  const scene = window.__game.scene.getScene("Level1Parte2");
  const boss = scene.novoBoss;
  return {
    estado: boss?.estado, vida: boss?.vida, vidaMaxima: boss?.vidaMaxima, fase: boss?.fase,
    morto: boss?.morto, playerVida: scene.vida, playerVidaMaxima: scene.vidaMaxima,
    developerMode: scene.developerMode, captura: scene.restricaoControleNovoBoss,
    player: { x: scene.player?.x, y: scene.player?.y,
      invulneravel: scene.player?.invulneravel, bloqueado: Boolean(scene.movimentoBloqueado) },
    barreira: boss?.barreiraAtiva, geradores: boss?.sistemaGeradores?.snapshot() ?? null,
    clones: boss?.sistemaClones?.snapshot() ?? null,
    ilusoes: boss?.sistemaIlusoes?.snapshot() ?? null,
    ataque: boss?.ataqueAtual?.snapshot() ?? null,
    tentaculos: boss?.tentaculosAtivos?.snapshot() ?? null,
    lasers: boss?.projeteisBoss?.filter(obj => obj.active).length ?? 0,
    alvos: boss?.alvosIlusorios?.filter(alvo => alvo.active).length ?? 0,
    hud: boss?.hud ? { vida: boss.hud.textoVida.text, estado: boss.hud.textoEstado.text,
      largura: boss.hud.preenchimento.width, visible: boss.hud.container.visible } : null,
    corpo: Boolean(boss?.body?.enable), spriteVisible: boss?.sprite?.visible,
    eventos: window.__eventosEtapa8, driver: window.__driverEtapa8?.snapshot(),
    factory: {
      luz: scene.luzFabricaAcesa,
      energia: scene.game.registry.get("factoryGeneratorPowered"),
      inventario: scene.inventory.getSlots(),
      coletados: [...scene.inventory.state.collectedItemIds],
    },
    oldBoss: Boolean(scene.bossFinal),
  };
});

async function instalarDriver() {
  await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const boss = scene.novoBoss;
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    const { dispararProjetil, atualizarProjeteis } = await import("/js/player/PlayerProjectiles.js");
    const { atualizarHitboxDanoPlayer } = await import("/js/player/Player.js");
    const { retanguloLivreDoMapa } = await import("/js/enemies/EnemyPathfinding.js");
    const { areasSobrepostasNovoBoss } = await import("/js/enemies/novoBoss/NovoBossTeleporte.js");
    const arena = boss.config.arena;
    let tempo = 0;
    let tiros = 0;
    let desvios = 0;
    let tiro = null;
    let vidaAntesTiro = null;
    let maxLasers = 0;
    let maxClones = 0;
    let origemClones = null;
    let verdadeiraMoveu = false;
    let nucleoVisivel = false;
    let fantasmaMorreu = 0;
    let tentativasBloqueadas = 0;
    let posicaoAnterior = { x: scene.player.x, y: scene.player.y };
    const areasRelativas = {
      body: { x: scene.player.body.x - scene.player.x, y: scene.player.body.y - scene.player.y,
        width: scene.player.body.width, height: scene.player.body.height },
      dano: { x: scene.hitboxDanoPlayer.x - scene.player.x, y: scene.hitboxDanoPlayer.y - scene.player.y,
        width: scene.hitboxDanoPlayer.width, height: scene.hitboxDanoPlayer.height },
    };
    const areaNoPonto = (ponto, area) => ({ ...area, x: ponto.x + area.x, y: ponto.y + area.y });
    const valido = ponto => {
      const area = areaNoPonto(ponto, areasRelativas.body);
      return ponto.x >= arena.xMin && ponto.x <= arena.xMax &&
        ponto.y >= arena.yMin && ponto.y <= arena.entradaY &&
        area.x >= arena.xMin + 3 && area.y >= arena.yMin + 3 &&
        area.x + area.width <= arena.xMax - 3 &&
        area.y + area.height <= Math.min(arena.yMax, arena.entradaY) - 3 &&
        retanguloLivreDoMapa(scene, area) &&
        !boss.geradores.some(g => areasSobrepostasNovoBoss(area, g.body));
    };
    const pontos = [];
    for (let y = arena.yMin + 75; y <= arena.entradaY - 75; y += 75) {
      for (let x = arena.xMin + 75; x <= arena.xMax - 75; x += 75) {
        const ponto = { x, y };
        if (valido(ponto)) pontos.push(ponto);
      }
    }
    if (pontos.length < 20) throw new Error(`A arena deveria oferecer vários pontos livres: ${pontos.length}`);
    const eventos = window.__eventosEtapa8 = {
      ataques: [], vidas: [], fases: [], teleportes: [], geradores: [],
      barreiras: 0, ilusoes: [], clones: [], origensOndas: [], derrotas: 0,
    };
    scene.events.on("novo-boss:ataque-iniciado", ({ tipo }) => eventos.ataques.push(tipo));
    scene.events.on("novo-boss:vida", ({ anterior, vida }) => eventos.vidas.push({ anterior, vida }));
    scene.events.on("novo-boss:fase-alterada", ({ fase }) => eventos.fases.push(fase));
    scene.events.on("novo-boss:teleporte-iniciado", ({ motivo }) => eventos.teleportes.push(motivo));
    scene.events.on("novo-boss:gerador-desativado", ({ gerador }) => eventos.geradores.push(gerador.id));
    scene.events.on("novo-boss:barreira-desativada", () => eventos.barreiras++);
    scene.events.on("novo-boss:ilusoes-iniciadas", () => eventos.ilusoes.push({
      falsas: boss.sistemaIlusoes.alvos.filter(alvo => alvo.active).length,
      x: boss.x, y: boss.y,
    }));
    scene.events.on("novo-boss:clones-iniciados", ({ quantidade }) => {
      eventos.clones.push(quantidade);
      eventos.origensOndas.push({ x: boss.x, y: boss.y,
        protecaoMs: Math.max(0, boss.invulneravelClonesAte - boss.relogioCombate) });
      origemClones = { x: boss.x, y: boss.y };
    });
    scene.events.on("novo-boss:ilusao-dissipada", () => fantasmaMorreu++);
    scene.events.on("novo-boss:derrotada", () => eventos.derrotas++);

    function posicionar(ponto) {
      if (!scene.player.active || Boolean(scene.restricaoControleNovoBoss)) return false;
      scene.player.setPosition(ponto.x, ponto.y);
      scene.player.body.reset(ponto.x, ponto.y);
      scene.player.body.updateFromGameObject();
      scene.player.body.setVelocity(0, 0);
      atualizarHitboxDanoPlayer(scene);
      posicaoAnterior = { ...ponto };
      return true;
    }

    function margemCirculo(ponto, x, y, raio) {
      const area = areaNoPonto(ponto, areasRelativas.dano);
      const pertoX = Math.max(area.x, Math.min(x, area.x + area.width));
      const pertoY = Math.max(area.y, Math.min(y, area.y + area.height));
      return Math.hypot(pertoX - x, pertoY - y) - raio;
    }

    function seguranca(ponto) {
      let margem = Math.hypot(ponto.x - boss.x, ponto.y - boss.y) - 200;
      const ataque = boss.ataqueAtual?.snapshot();
      if (ataque?.tipo === "chuvaRaios") {
        for (const marca of ataque.marcas) {
          if (!marca.concluida && ataque.tempo >= marca.inicio &&
              ataque.tempo <= marca.impactoEm + boss.config.ataques.chuvaRaios.perigoMs) {
            margem = Math.min(margem, margemCirculo(ponto, marca.x, marca.y,
              boss.config.ataques.chuvaRaios.raio + 32));
          }
        }
      } else if (ataque?.tipo === "pulsoRepulsao") {
        margem = Math.min(margem, margemCirculo(ponto, ataque.origem.x, ataque.origem.y,
          boss.config.ataques.pulsoRepulsao.raio + 40));
      }
      for (const armadilha of boss.tentaculosAtivos?.snapshot().armadilhas ?? []) {
        if (armadilha.ativa) margem = Math.min(margem,
          margemCirculo(ponto, armadilha.x, armadilha.y, 60));
      }
      for (const laser of boss.projeteisBoss) {
        if (!laser.active || laser.especialRefletido) continue;
        margem = Math.min(margem, margemCirculo(ponto,
          laser.x + (laser.body?.velocity?.x ?? 0) * 0.05,
          laser.y + (laser.body?.velocity?.y ?? 0) * 0.05, 60));
      }
      return margem;
    }

    function esquivar() {
      if (!scene.player.active || scene.morteEmAndamento || scene.restricaoControleNovoBoss) return;
      const atual = { x: scene.player.x, y: scene.player.y };
      if (valido(atual) && seguranca(atual) > 30) return;
      let escolhido = null;
      let melhor = -Infinity;
      for (const ponto of pontos) {
        const score = Math.min(180, seguranca(ponto)) - Math.hypot(ponto.x - atual.x, ponto.y - atual.y) * 0.015;
        if (score > melhor) { melhor = score; escolhido = ponto; }
      }
      if (escolhido && posicionar(escolhido)) desvios++;
    }

    function observar() {
      maxLasers = Math.max(maxLasers, boss.projeteisBoss.filter(obj => obj.active).length);
      maxClones = Math.max(maxClones, boss.sistemaClones.alvos.filter(alvo => alvo.active).length);
      if (boss.sistemaClones.ativo && origemClones) {
        verdadeiraMoveu ||= Math.hypot(boss.x - origemClones.x, boss.y - origemClones.y) > 1;
        nucleoVisivel ||= Boolean(boss.sistemaIlusoes.core?.visible);
      }
    }

    function passo(delta = 20, desviar = true) {
      if (scene.morteEmAndamento || scene.vida <= 0) throw new Error("O piloto perdeu a vida; não é permitido curar ou alterar a invulnerabilidade.");
      if (scene.restricaoControleNovoBoss?.apertosNecessarios && tempo % 120 === 0) {
        const pointer={id:99,isDown:true,leftButtonDown:()=>true};
        scene.input.emit("pointerdown",pointer,[]);scene.input.emit("pointerup",pointer);
      }
      if (desviar && !tiro?.active) esquivar();
      // A cena está pausada para determinismo, mas os timers reais continuam
      // avançando: inclusive os 500 ms de invulnerabilidade após dano normal.
      scene.time.preUpdate();
      scene.time.update(scene.time.now + delta, delta);
      atualizarNovoBoss(scene, scene.time.now, delta);
      atualizarProjeteis(scene, delta);
      tempo += delta;
      observar();
      if (tiro && !tiro.active) {
        const reducao = vidaAntesTiro - boss.vida;
        if (reducao !== 0 && reducao !== 25) throw new Error(`Dano inesperado da flecha: ${reducao}`);
        tiro = null;
        vidaAntesTiro = null;
      }
    }

    function atirar() {
      if (tiro?.active || boss.estado !== "vulneravel") return false;
      const area = boss.hitboxDano;
      const origemX = scene.player.displayOriginX;
      const origemY = scene.player.displayOriginY;
      // A flecha nasce 120 px abaixo do centro, fora da hitbox. A alternativa
      // cardinal só é usada se a margem da arena impedir o disparo pelo sul.
      const candidatos = [
        ...[120, 100, 140, 160, 90].map(distancia => ({
          x: area.centerX - 29 + origemX, y: area.centerY + distancia + origemY, direcao: "up",
        })),
        { x: area.centerX - 29 + origemX, y: area.centerY - 120 - 60 + origemY, direcao: "down" },
        { x: area.centerX - 120 - 52 + origemX, y: area.centerY - 28 + origemY, direcao: "right" },
        { x: area.centerX + 120 - 12 + origemX, y: area.centerY - 28 + origemY, direcao: "left" },
      ];
      const ponto = candidatos.find(valido);
      if (!ponto || !posicionar(ponto)) { tentativasBloqueadas++; return false; }
      scene.direcaoAtual = ponto.direcao;
      scene.direcaoAtaque = ponto.direcao;
      vidaAntesTiro = boss.vida;
      tiro = dispararProjetil(scene);
      if (!tiro?.active || tiro.dano !== 25 || tiro.velocidade !== 420) throw new Error("A luta precisa usar a flecha real com os valores padrão.");
      tiros++;
      return true;
    }

    window.__driverEtapa8 = {
      passo, esquivar, observar, atirar, valido,
      rodar(ms, { atirar: autoAtirar = false, pararClones = false, pararVida = null,
        pararVulneravel = false } = {}) {
        const inicio = tempo;
        while (tempo - inicio < ms && !boss.morto) {
          if (pararClones && boss.sistemaClones.ativo) break;
          if (pararVida !== null && boss.vida <= pararVida) break;
          if (pararVulneravel && boss.estado === "vulneravel") break;
          if (autoAtirar && boss.estado === "vulneravel" && !tiro?.active) atirar();
          passo(20);
        }
        scene.children.depthSort();
        return this.snapshot();
      },
      snapshot() {
        return { tempo, tiros, desvios, maxLasers, maxClones, verdadeiraMoveu, nucleoVisivel,
          fantasmaMorreu, tentativasBloqueadas, pontosLivres: pontos.length,
          flechaAtiva: Boolean(tiro?.active), posicaoAnterior,
          vida: boss.vida, fase: boss.fase, vidaPlayer: scene.vida,
          clones: boss.sistemaClones.ativo, morto: boss.morto };
      },
    };
  });
}

async function rodar(ms, opcoes = {}) {
  return page.evaluate(({ ms, opcoes }) => window.__driverEtapa8.rodar(ms, opcoes), { ms, opcoes });
}

async function aproximarGerador(gerador) {
  const ponto = await page.evaluate(({ x, y }) => {
    const player = window.__game.scene.getScene("Level1Parte2").player;
    return { x: x - (player.body.center.x - player.x),
      y: y - 55 - (player.body.center.y - player.y) };
  }, gerador);
  await posicionar(ponto.x, ponto.y);
  await avancar(0);
}

async function medirDesempenhoClones() {
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const driver = window.__driverEtapa8;
    driver.esquivar();
    const dados = window.__perfEtapa8 = { tempos: [], maxClones: 0, maxLasers: 0,
      avisos: false, inicio: performance.now(), ultimo: null };
    const observar = () => {
      const agora = performance.now();
      if (dados.ultimo !== null) dados.tempos.push(agora - dados.ultimo);
      dados.ultimo = agora;
      dados.maxClones = Math.max(dados.maxClones,
        scene.novoBoss.sistemaClones.alvos.filter(alvo => alvo.active).length);
      dados.maxLasers = Math.max(dados.maxLasers, scene.novoBoss.projeteisBoss.length);
      dados.avisos ||= scene.children.list.some(child => child.active && child.visible &&
        child.name === "novo-boss-aviso");
      driver.observar();
    };
    scene.events.on("postupdate", observar);
    dados.observar = observar;
    dados.intervalo = setInterval(() => driver.esquivar(), 40);
  });
  await retomar();
  await page.waitForTimeout(10000);
  await pausar();
  const perf = await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const dados = window.__perfEtapa8;
    clearInterval(dados.intervalo);
    scene.events.off("postupdate", dados.observar);
    const tempos = [...dados.tempos].sort((a, b) => a - b);
    const total = dados.tempos.reduce((sum, valor) => sum + valor, 0);
    return {
      duracaoMs: performance.now() - dados.inicio,
      frames: tempos.length, fpsMedio: tempos.length / (total / 1000),
      p95Ms: tempos[Math.floor(tempos.length * 0.95)],
      maxClones: dados.maxClones, maxLasers: dados.maxLasers, avisos: dados.avisos,
      vidaPlayer: scene.vida, invulneravel: scene.player.invulneravel,
    };
  });
  assert.ok(perf.duracaoMs >= 10000);
  assert.ok(perf.frames > 0 && Number.isFinite(perf.fpsMedio),
    "O perfil deve observar o ciclo real em execução; a especificação não impõe um orçamento de FPS para renderização por software.");
  assert.equal(perf.maxClones, 9);
  assert.ok(perf.avisos, "O perfil precisa incluir ataques com marcações e nove clones no ciclo real.");
  assert.ok(perf.vidaPlayer > 0);
  assert.ok(perf.maxLasers <= novoBossConfig.ataques.lasersEspiral.quantidade);
  console.log("PERF desktop Chromium/SwiftShader (não representa hardware físico):", JSON.stringify(perf));
  return perf;
}

try {
  await instalarDriver();
  let state = await snapshot();
  assert.equal(state.vida, 1000);
  assert.equal(state.vidaMaxima, 1000);
  assert.equal(state.developerMode, false);
  assert.equal(state.playerVida, state.playerVidaMaxima);
  assert.ok(state.barreira && state.geradores.restantes === 4);
  const factoryInicial = state.factory;
  await rodar(30000, { pararVulneravel: true });
  assert.ok(await page.evaluate(() => window.__driverEtapa8.atirar()));
  await rodar(400);
  state = await snapshot();
  assert.equal(state.vida, 1000, "A flecha real deve ser consumida sem atravessar a barreira.");
  assert.equal(state.eventos.vidas.length, 0);
  console.log("PASS: combate padrão inicia com quatro geradores; a barreira nega a flecha real durante a abertura.");

  const geradores = state.geradores.geradores;
  for (let indice = 0; indice < 3; indice++) {
    await aproximarGerador(geradores[indice]);
    await retomar();
    await page.keyboard.press("e");
    await page.waitForTimeout(100);
    await pausar();
    await avancar(0);
    state = await snapshot();
    assert.equal(state.geradores.restantes, 3 - indice);
    assert.ok(state.barreira);
    assert.deepEqual(state.factory, factoryInicial);
  }
  await aproximarGerador(geradores[3]);
  await retomar();
  const ponto = await page.evaluate(id => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const label = scene.novoBoss.geradores.find(g => g.id === id).label;
    const bounds = label.getBounds();
    const camera = scene.cameras.main;
    const canvas = scene.game.canvas;
    const rect = canvas.getBoundingClientRect();
    return {
      visible: label.visible,
      x: rect.left + (camera.x + (bounds.centerX - camera.scrollX * label.scrollFactorX) * camera.zoomX +
        camera.width * camera.originX * (1 - camera.zoomX)) * rect.width / canvas.width,
      y: rect.top + (camera.y + (bounds.centerY - camera.scrollY * label.scrollFactorY) * camera.zoomY +
        camera.height * camera.originY * (1 - camera.zoomY)) * rect.height / canvas.height,
    };
  }, geradores[3].id);
  assert.ok(ponto.visible && ponto.x >= 0 && ponto.x <= 1280 && ponto.y >= 0 && ponto.y <= 720);
  await page.mouse.click(ponto.x, ponto.y);
  await page.waitForFunction(() => !window.__game.scene.getScene("Level1Parte2").novoBoss.barreiraAtiva);
  await pausar();
  await avancar(0);
  state = await snapshot();
  assert.equal(state.geradores.restantes, 0);
  assert.equal(new Set(state.eventos.geradores).size, 4);
  assert.equal(state.eventos.barreiras, 1);
  assert.deepEqual(state.factory, factoryInicial);
  console.log("PASS: três teclas E reais e um clique real desligam os quatro geradores sem consumir itens ou alterar a energia da fábrica.");

  // Primeiro deixa a luta demonstrar teletransporte preventivo sem causar dano.
  for (let i = 0; i < 6 && !state.eventos.teleportes.includes("preventivo"); i++) {
    await rodar(10000);
    state = await snapshot();
  }
  assert.ok(state.eventos.teleportes.includes("preventivo"));
  assert.equal(state.vida, 1000);
  assert.ok(state.playerVida > 0);
  console.log("PASS: o piloto pode esquivar sem curar; afastamento prolongado provoca o teletransporte preventivo normal.");

  for (let trecho = 0; trecho < 100 && state.vida > 500; trecho++) {
    await rodar(10000, { atirar: true, pararVida: 500 });
    state = await snapshot();
    if (trecho % 5 === 0) console.log("COMBATE fase 1:", JSON.stringify(state.driver));
  }
  assert.equal(state.vida, 500);
  assert.equal(state.fase, 1);
  assert.deepEqual(state.eventos.fases, []);
  assert.equal(state.eventos.vidas.length, 20);
  await rodar(30000, { atirar: true, pararVida: 475 });
  state = await snapshot();
  assert.equal(state.vida, 475);
  assert.equal(state.fase, 2);
  assert.deepEqual(state.eventos.fases, [2]);
  assert.equal(state.eventos.vidas.length, 21);
  await rodar(30000, { pararClones: true });
  state = await snapshot();
  assert.ok(state.clones.ativo);
  assert.equal(state.clones.alvos.filter(alvo => alvo.active).length, 9);
  assert.deepEqual(state.eventos.clones, [9]);
  console.log("PASS: vinte flechas de 25 deixam exatamente 50% na fase 1; a 21ª muda uma vez para fase 2 e nove clones saem da verdadeira.");

  await medirDesempenhoClones();
  state = await snapshot();
  assert.ok(state.driver.verdadeiraMoveu);
  assert.equal(state.driver.nucleoVisivel, false, "O núcleo não deve denunciar a verdadeira entre clones móveis.");
  assert.equal(state.vida, 475);
  assert.equal(state.driver.maxClones, 9);
  await page.screenshot({ path: "/tmp/novo-boss-etapa8-clones.png" });

  for (let trecho = 0; trecho < 100 && !state.morto; trecho++) {
    await rodar(10000, { atirar: true });
    state = await snapshot();
    if (trecho % 5 === 0) console.log("COMBATE fase 2:", JSON.stringify(state.driver));
  }
  assert.equal(state.vida, 0);
  assert.equal(state.estado, "derrotada");
  assert.ok(state.morto);
  assert.equal(state.eventos.vidas.length, 40);
  assert.ok(state.eventos.vidas.every(({ anterior, vida }) => anterior - vida === 25));
  assert.ok(state.driver.tiros >= 41,
    "A luta inclui quarenta impactos aceitos, além da flecha bloqueada pela barreira.");
  for (const tipo of ["pulso", "chuva", "lasers", "tentaculos"]) {
    assert.ok(state.eventos.ataques.includes(tipo), `O combate automático deve executar ${tipo}.`);
  }
  assert.ok(state.eventos.ilusoes.length > 0 && state.eventos.ilusoes.every(evento => evento.falsas === 3));
  assert.ok(state.eventos.teleportes.includes("reativo"));
  assert.equal(state.eventos.derrotas, 1);
  assert.deepEqual(state.eventos.fases, [2]);
  assert.ok(state.playerVida > 0 && state.playerVida <= state.playerVidaMaxima);
  assert.ok(state.eventos.clones.length >= 2, "A segunda fase precisa repetir as ondas no combate automático.");
  assert.ok(state.eventos.origensOndas.every(p => p.x === novoBossConfig.posicaoInicial.x &&
    p.y === novoBossConfig.posicaoInicial.y && p.protecaoMs === 0));
  console.log(`PASS: ${state.eventos.clones.length} ondas automáticas nasceram no centro sem invulnerabilidade adicional.`);
  assert.equal(state.developerMode, false);
  assert.equal(state.ataque, null);
  assert.equal(state.tentaculos, null);
  assert.equal(state.alvos, 0);
  assert.equal(state.lasers, 0);
  assert.equal(state.captura, null);
  assert.equal(state.geradores, null, "A derrota deve destruir o sistema de geradores e seus colisores.");
  assert.equal(state.corpo, false);
  assert.equal(state.hud.vida, "0 / 1000");
  assert.equal(state.hud.largura, 0);
  assert.ok(state.hud.estado.includes("DERROTADA"));
  await avancar(1000);
  assert.equal((await snapshot()).spriteVisible, true);
  console.log("PASS: luta completa 1000→0 com quarenta impactos reais de 25, todos os ataques, ilusões, clones e teleportes; derrota limpa ameaças e HUD.");

  await posicionar(-1080, -5700);
  await retomar();
  const antesMovimento = await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").player.x);
  await page.keyboard.down("d");
  await page.waitForTimeout(350);
  await page.keyboard.up("d");
  await pausar();
  state = await snapshot();
  assert.ok(state.player.x > antesMovimento + 10);
  assert.equal(state.player.bloqueado, false);
  assert.equal(state.captura, null);
  await posicionar(-1093, -5350);
  await avancar(1000);
  await posicionar(-1093, -5520);
  await avancar(1000);
  state = await snapshot();
  assert.equal(state.vida, 0);
  assert.equal(state.eventos.derrotas, 1);
  assert.equal(state.oldBoss, false);
  console.log("PASS: movimento WASD continua após a vitória e sair/voltar à arena não ressuscita a boss.");

  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    window.__encontroVencidoEtapa8 = scene.novoBoss;
    window.__geradoresVencidosEtapa8 = scene.novoBoss.geradores.map(g => g.visual);
  });
  await reiniciar();
  state = await snapshot();
  assert.equal(state.vida, 1000);
  assert.equal(state.fase, 1);
  assert.equal(state.geradores.restantes, 4);
  assert.ok(await page.evaluate(() => window.__encontroVencidoEtapa8.encerrado &&
    window.__geradoresVencidosEtapa8.every(obj => !obj.active && !obj.scene)));
  console.log("PASS: reiniciar recria vida, fase, quatro geradores e destrói os recursos da luta anterior.");

  // Usa o overlap de saída que já pertence ao jogo, sem chamar scene.start().
  const saida = await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const player = scene.player;
    const portal = scene.teleporteRetornoParte1.body.center;
    return { x: portal.x - (player.body.center.x - player.x),
      y: portal.y - (player.body.center.y - player.y) };
  });
  await posicionar(saida.x, saida.y);
  await retomar();
  await page.waitForFunction(() => window.__game.scene.getScene("Level1").scene.isActive() &&
    window.__game.scene.getScene("Level1").player?.active, null, { timeout: 15000 });
  assert.ok(await page.evaluate(() => {
    const factory = window.__game.scene.getScene("Level1Parte2");
    return !factory.scene.isActive() && factory.novoBoss === null;
  }));
  console.log("PASS: o portal de retorno existente continua levando à cidade e limpa o encontro ao sair da cena.");
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
  assert.deepEqual(sessao.consoleErrors, consoleBoot,
    "A luta completa não pode acrescentar erros ao console do navegador.");
  console.log("CONSOLE de inicialização:", JSON.stringify(consoleBoot));
} catch (error) {
  console.error("Estado na falha:", await snapshot().catch(() => null));
  console.error("Erros JavaScript:", sessao.errors, "Falhas de recursos:", sessao.assetErrors,
    "Console:", sessao.consoleErrors);
  await page.screenshot({ path: "/tmp/novo-boss-etapa8-falha.png" }).catch(() => {});
  throw error;
} finally {
  await sessao.fechar();
}
