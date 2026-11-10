/** Ilusões e clones com recursos, mapa e flechas reais do Phaser. Executar serialmente. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = {
  ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, ativo: true, automatico: false },
  ilusoes: { ...novoBossConfig.ilusoes, ativo: true, duracaoMs: 10000 },
  clones: { ...novoBossConfig.clones, ativo: true, quantidade: 9, duracaoMs: 18000 },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar, reiniciar } = sessao;

const snapshot = () => page.evaluate(async () => {
  const scene = window.__game.scene.getScene("Level1Parte2");
  const boss = scene.novoBoss;
  const { alvosAdicionaisCombate } = await import("/js/combat/CombatTargets.js");
  return {
    estado: boss?.estado, vida: boss?.vida, vidaPlayer: scene.vida,
    x: boss?.x, y: boss?.y,
    ilusoes: boss?.sistemaIlusoes?.snapshot() ?? null,
    clones: boss?.sistemaClones?.snapshot() ?? null,
    alvos: (boss?.alvosIlusorios ?? []).map(alvo => ({
      id: alvo.id, tipo: alvo.tipo, active: alvo.active, visible: alvo.visible,
      morto: alvo.morto, vida: alvo.vida, x: alvo.x, y: alvo.y,
      area: alvo.hitboxDano ? { x: alvo.hitboxDano.x, y: alvo.hitboxDano.y,
        width: alvo.hitboxDano.width, height: alvo.hitboxDano.height } : null,
    })),
    alvosCombate: alvosAdicionaisCombate(scene).map(alvo =>
      alvo === boss ? "verdadeira" : alvo.id),
    captura: Boolean(scene.restricaoControleNovoBoss),
    lasers: boss?.projeteisBoss?.filter(visual => visual.active).length ?? 0,
    sprites: scene.children.list.filter(child => child.active &&
      child.texture?.key === "novo-boss-idle").map(child => ({
      x: child.x, y: child.y, visible: child.visible, name: child.name,
    })),
    oldBoss: Boolean(scene.bossFinal),
  };
});

async function abrirJanela() {
  assert.ok(await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { atualizarBoss } = await import("/js/enemies/BossPrincipal.js");
    for (let i = 0; i < 1000; i++) {
      if (scene.novoBoss.estado === "vulneravel") return true;
      atualizarBoss(scene, scene.time.now, 20);
    }
    return false;
  }), "A boss precisa oferecer uma janela normal de dano.");
}

async function iniciarIlusoes(rng = 0.25) {
  assert.ok(await page.evaluate(rng => {
    const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
    boss.rng = () => rng;
    return boss.iniciarIlusoes();
  }, rng), "O comando real precisa iniciar as quatro aparições.");
  await avancar(0);
  return snapshot();
}

async function atingirComFlecha(id = "verdadeira") {
  return page.evaluate(async id => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const boss = scene.novoBoss;
    const alvo = id === "verdadeira" ? boss :
      boss.alvosIlusorios.find(item => item.id === id);
    if (!alvo?.hitboxDano) return { encontrado: false };
    const area = alvo.hitboxDano;
    const x = area.x + area.width / 2 - 29 + scene.player.displayOriginX;
    const y = area.y + area.height / 2 + 150;
    scene.player.setPosition(x, y);
    scene.player.body.reset(x, y);
    scene.player.body.updateFromGameObject();
    scene.player.body.setVelocity(0, 0);
    const { atualizarHitboxDanoPlayer } = await import("/js/player/Player.js");
    atualizarHitboxDanoPlayer(scene);
    scene.direcaoAtual = "up";
    scene.direcaoAtaque = "up";
    const hpBoss = boss.vida;
    const hpPlayer = scene.vida;
    const robos = (scene.inimigos ?? []).map(robo => [robo, robo.vida]);
    const { dispararProjetil, atualizarProjeteis } = await import("/js/player/PlayerProjectiles.js");
    const flecha = dispararProjetil(scene);
    const criada = Boolean(flecha?.active && flecha.projetilPlayer);
    atualizarProjeteis(scene, 400);
    return {
      encontrado: true, criada, consumida: !flecha?.active,
      alvoRemovido: !alvo.active, reducaoBoss: hpBoss - boss.vida,
      playerPreservado: scene.vida === hpPlayer,
      robosPreservados: robos.every(([robo, vida]) => robo.vida === vida),
    };
  }, id);
}

async function iniciarClones() {
  assert.ok(await page.evaluate(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.iniciarClones()),
  "O comando real precisa iniciar o grupo de clones.");
  await avancar(0);
  return snapshot();
}

try {
  const posicaoAntesIlusoes = await snapshot();
  let state = await iniciarIlusoes(0);
  assert.notDeepEqual({ x: state.x, y: state.y },
    { x: posicaoAntesIlusoes.x, y: posicaoAntesIlusoes.y },
    "A primeira execução também deve tirar a verdadeira da posição inicial.");
  assert.ok(state.alvos.some(alvo => alvo.x === posicaoAntesIlusoes.x &&
    alvo.y === posicaoAntesIlusoes.y), "Uma falsa deve ocupar o lugar anterior.");
  assert.equal(state.ilusoes.ativo, true);
  assert.equal(state.alvos.filter(alvo => alvo.active && alvo.tipo === "ilusao").length, 3);
  assert.equal(state.sprites.filter(sprite => sprite.visible).length, 4,
    "As quatro aparições devem incluir exatamente uma entidade verdadeira.");
  assert.equal(state.alvosCombate.filter(id => id === "verdadeira").length, 1);
  assert.equal(state.alvosCombate.length, 4);
  assert.ok(state.ilusoes.core.visible);
  const primeiraPosicao = { x: state.x, y: state.y };
  const alphaInicial = state.ilusoes.core.alpha;
  await avancar(160);
  state = await snapshot();
  assert.ok(Math.abs(state.ilusoes.core.alpha - alphaInicial) > 0.02,
    "A pista da verdadeira precisa pulsar visualmente.");
  assert.ok(Math.abs(state.ilusoes.core.x - state.x) < 60 &&
    Math.abs(state.ilusoes.core.y - state.y) < 100,
  "O núcleo deve acompanhar a verdadeira.");
  console.log("PASS: quatro aparições, uma verdadeira e núcleo pulsante identificável.");

  await page.evaluate(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.sistemaIlusoes.encerrarQuatro());
  state = await iniciarIlusoes(0.99);
  assert.notDeepEqual({ x: state.x, y: state.y }, primeiraPosicao,
    "O sorteio deve permitir outra posição verdadeira em uma nova execução.");
  assert.equal(new Set(state.sprites.filter(sprite => sprite.visible)
    .map(sprite => `${sprite.x},${sprite.y}`)).size, 4);
  console.log("PASS: a verdadeira muda de posição conforme o sorteio; aparições não se duplicam.");

  const trocasRepetidas = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const boss = scene.novoBoss;
    const { atualizarBoss } = await import("/js/enemies/BossPrincipal.js");
    const { destinoValidoNovoBoss } = await import("/js/enemies/novoBoss/NovoBossTeleporte.js");
    const sprite = boss.sprite;
    const hitbox = boss.hitboxDano;
    const vida = boss.vida;
    const vidaPlayer = scene.vida;
    boss.rng = () => 0;
    const trocas = [];
    for (let indice = 0; indice < 12; indice++) {
      boss.cancelarAtaque();
      boss.sistemaIlusoes.encerrarQuatro();
      const anterior = { x: boss.x, y: boss.y };
      if (!boss.executarAtaque("ilusoes")) throw new Error("O ataque de ilusões não iniciou.");
      atualizarBoss(scene, scene.time.now, 0);
      const falsoNoLugar = boss.alvosIlusorios.some(alvo =>
        alvo.x === anterior.x && alvo.y === anterior.y);
      const locais = new Set([`${boss.x},${boss.y}`,
        ...boss.alvosIlusorios.map(alvo => `${alvo.x},${alvo.y}`)]);
      const corpoAlinhado = ["x", "y", "width", "height"].every(chave =>
        Math.abs(boss.body[chave] - hitbox[chave]) < 0.001);
      const core = boss.sistemaIlusoes.core;
      trocas.push({ mudou: Math.hypot(boss.x - anterior.x, boss.y - anterior.y) > 1,
        falsoNoLugar, locais: locais.size, corpoAlinhado,
        destinoSeguro: destinoValidoNovoBoss(scene, boss, boss.sprite),
        nucleoAlinhado: Math.abs(core.x - (boss.x + (boss.sprite.flipX ? -3.3 : 3.3))) < 0.001,
        mesmaEntidade: boss.sprite === sprite && boss.hitboxDano === hitbox,
        vidasPreservadas: boss.vida === vida && scene.vida === vidaPlayer });
    }
    boss.cancelarAtaque();
    return trocas;
  });
  assert.equal(trocasRepetidas.length, 12);
  assert.ok(trocasRepetidas.every(troca => troca.mudou && troca.falsoNoLugar &&
    troca.locais === 4 && troca.corpoAlinhado && troca.destinoSeguro &&
    troca.nucleoAlinhado && troca.mesmaEntidade && troca.vidasPreservadas),
  JSON.stringify(trocasRepetidas));
  state = await snapshot();
  console.log("PASS: 12 ataques de ilusões consecutivos mudam a verdadeira, mesmo com sorteio repetido; posição anterior vira cópia, corpo e núcleo ficam alinhados.");

  const falsa = state.alvos.find(alvo => alvo.active && alvo.tipo === "ilusao");
  const acertouFalsa = await atingirComFlecha(falsa.id);
  assert.ok(acertouFalsa.encontrado && acertouFalsa.criada && acertouFalsa.consumida);
  assert.ok(acertouFalsa.alvoRemovido && acertouFalsa.playerPreservado && acertouFalsa.robosPreservados);
  assert.equal(acertouFalsa.reducaoBoss, 0);
  state = await snapshot();
  assert.equal(state.alvosCombate.length, 3);
  console.log("PASS: flecha real dissipa uma falsa no primeiro acerto sem reduzir a vida principal.");

  await posicionar(state.x, state.y + 150);
  await abrirJanela();
  const acertouVerdadeira = await atingirComFlecha();
  assert.ok(acertouVerdadeira.criada && acertouVerdadeira.consumida);
  assert.equal(acertouVerdadeira.reducaoBoss, 25);
  assert.ok(acertouVerdadeira.playerPreservado && acertouVerdadeira.robosPreservados);
  console.log("PASS: a mesma arma real reduz somente a vida da verdadeira durante a abertura.");

  await reiniciar();
  state = await iniciarClones();
  assert.equal(state.clones.ativo, true);
  assert.equal(state.alvos.filter(alvo => alvo.active && alvo.tipo === "clone").length, 9);
  assert.equal(state.sprites.filter(sprite => sprite.visible).length, 10);
  const inicio = state.alvos.filter(alvo => alvo.tipo === "clone");
  assert.ok(inicio.every(alvo => Math.hypot(alvo.x - state.x, alvo.y - state.y) < 3),
    "Os clones precisam partir do corpo da boss.");
  await avancar(1000);
  state = await snapshot();
  assert.ok(state.alvos.filter(alvo => alvo.tipo === "clone").every(alvo => {
    const anterior = inicio.find(item => item.id === alvo.id);
    return anterior && Math.hypot(alvo.x - anterior.x, alvo.y - anterior.y) > 1;
  }), "Os nove clones precisam se movimentar após a saída.");
  const validos = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { retanguloLivreDoMapa } = await import("/js/enemies/EnemyPathfinding.js");
    const arena = scene.novoBoss.config.arena;
    return scene.novoBoss.alvosIlusorios.filter(alvo => alvo.active).every(alvo => {
      const area = alvo.hitboxDano;
      return area.x >= arena.xMin && area.y >= arena.yMin &&
        area.x + area.width <= arena.xMax && area.y + area.height <= arena.yMax &&
        retanguloLivreDoMapa(scene, area);
    });
  });
  assert.ok(validos, "Os clones devem permanecer na arena e fora das colisões reais do mapa.");
  console.log("PASS: nove clones saem do corpo, movem-se e respeitam o mapa real.");

  for (const tipo of ["pulso", "chuva", "lasers", "tentaculos"]) {
    const antes = await snapshot();
    await page.evaluate(tipo => {
      window.__game.scene.getScene("Level1Parte2").novoBoss.sistemaClones.imitarAtaque(tipo);
    }, tipo);
    await avancar(100);
    const durante = await snapshot();
    assert.ok(durante.clones.alvos.some(alvo => alvo.active && alvo.imitacao === tipo));
    assert.equal(durante.vidaPlayer, antes.vidaPlayer);
    assert.equal(durante.captura, false);
    assert.equal(durante.lasers, 0);
    await avancar(600);
    const depois = await snapshot();
    assert.equal(depois.vidaPlayer, antes.vidaPlayer);
    assert.equal(depois.captura, false);
    assert.equal(depois.lasers, 0);
  }
  console.log("PASS: clones imitam os quatro ataques sem dano, contenção ou lasers ofensivos registrados.");

  state = await snapshot();
  const clone = state.alvos.find(alvo => alvo.active && alvo.tipo === "clone");
  const acertouClone = await atingirComFlecha(clone.id);
  assert.ok(acertouClone.criada && acertouClone.consumida && acertouClone.alvoRemovido);
  assert.equal(acertouClone.reducaoBoss, 0);
  assert.ok(acertouClone.playerPreservado && acertouClone.robosPreservados);
  assert.equal((await snapshot()).alvos.filter(alvo => alvo.active && alvo.tipo === "clone").length, 8);
  console.log("PASS: um clone dissipa com o primeiro acerto da flecha real e preserva os demais alvos.");

  await page.screenshot({ path: process.env.NOVO_BOSS_SCREENSHOT ?? "/tmp/novo-boss-etapa5.png" });
  await posicionar(-1093, -5350);
  await avancar(0);
  state = await snapshot();
  assert.equal(state.alvos.filter(alvo => alvo.active).length, 0);
  assert.equal(state.clones.ativo, false);
  assert.equal(state.ilusoes.ativo, false);
  await posicionar(-1093, -5520);
  await avancar(0);
  await iniciarIlusoes();
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").morteEmAndamento = true;
  });
  await avancar(0);
  state = await snapshot();
  assert.equal(state.alvos.filter(alvo => alvo.active).length, 0);
  assert.equal(state.ilusoes.ativo, false);
  console.log("PASS: saída e morte removem ilusões/clones e suas interações.");

  await reiniciar();
  await iniciarClones();
  await page.evaluate(() => {
    window.__spritesClonesAntesReinicioEtapa5 =
      window.__game.scene.getScene("Level1Parte2").novoBoss.alvosIlusorios.map(alvo => alvo.sprite);
  });
  await reiniciar();
  state = await snapshot();
  assert.ok(await page.evaluate(() =>
    window.__spritesClonesAntesReinicioEtapa5.every(sprite => !sprite.active && !sprite.scene)));
  assert.equal(state.alvos.filter(alvo => alvo.active).length, 0);
  assert.equal(state.alvosCombate.length, 1);
  assert.equal(state.sprites.filter(sprite => sprite.visible).length, 1);
  assert.equal(state.oldBoss, false);
  console.log("PASS: reinício destrói sprites anteriores e deixa somente a verdadeira.");

  await reiniciar({ novoBossConfig: { ...config, geradores: novoBossConfig.geradores } });
  await iniciarClones();
  const colisaoGeradores = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { atualizarBoss } = await import("/js/enemies/BossPrincipal.js");
    const { areasSobrepostasNovoBoss } = await import("/js/enemies/novoBoss/NovoBossTeleporte.js");
    const { retanguloLivreDoMapa } = await import("/js/enemies/EnemyPathfinding.js");
    for (let i = 0; i < 120; i++) {
      atualizarBoss(scene, scene.time.now, 100);
      for (const alvo of scene.novoBoss.alvosIlusorios.filter(alvo => alvo.active)) {
        if (!retanguloLivreDoMapa(scene, alvo.hitboxDano) || scene.novoBoss.geradores.some(g =>
          areasSobrepostasNovoBoss(alvo.hitboxDano, g.body))) {
          return { valido: false, alvo: { id: alvo.id, x: alvo.x, y: alvo.y } };
        }
      }
    }
    scene.children.depthSort();
    return { valido: true, geradores: scene.novoBoss.geradores.length,
      clones: scene.novoBoss.alvosIlusorios.filter(alvo => alvo.active).length };
  });
  assert.ok(colisaoGeradores.valido, JSON.stringify(colisaoGeradores));
  assert.equal(colisaoGeradores.geradores, 4);
  assert.equal(colisaoGeradores.clones, 9);
  console.log("PASS: clones também respeitam os quatro geradores reais durante 12 segundos de movimentação.");
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
} catch (error) {
  console.error("Estado na falha:", await snapshot().catch(() => null));
  console.error("Erros JavaScript:", sessao.errors, "Falhas de recursos:", sessao.assetErrors);
  await page.screenshot({ path: "/tmp/novo-boss-etapa5-falha.png" }).catch(() => {});
  throw error;
} finally {
  await sessao.fechar();
}
