/** Segunda fase no Phaser real: limiar, transição, movimento, combate e encerramento. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = {
  ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, ativo: true, automatico: false },
  ilusoes: { ...novoBossConfig.ilusoes, ativo: true },
  clones: { ...novoBossConfig.clones, ativo: true, quantidade: 9, duracaoMs: 18000 },
  fase2: { ...novoBossConfig.fase2, ativo: true },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar, reiniciar } = sessao;

const snapshot = () => page.evaluate(() => {
  const scene = window.__game.scene.getScene("Level1Parte2");
  const boss = scene.novoBoss;
  return {
    fase: boss.fase, estado: boss.estado, vida: boss.vida, morto: boss.morto,
    x: boss.x, y: boss.y, relogio: boss.relogioCombate,
    ultimoTeleporteEm: boss.ultimoTeleporteEm,
    pendente: boss.teleportePendente,
    teleporte: boss.teleporte ? { motivo: boss.teleporte.motivo, etapa: boss.teleporte.etapa } : null,
    transicaoPendente: boss.transicaoFase2Pendente,
    clones: boss.sistemaClones.snapshot(),
    ilusoes: boss.sistemaIlusoes.snapshot(),
    ataque: boss.ataqueAtual?.snapshot() ?? null,
    body: { x: boss.body.x, y: boss.body.y, width: boss.body.width, height: boss.body.height },
    hitbox: { x: boss.hitboxDano.x, y: boss.hitboxDano.y,
      width: boss.hitboxDano.width, height: boss.hitboxDano.height },
    captura: Boolean(scene.restricaoControleNovoBoss),
    lasers: boss.projeteisBoss.filter(visual => visual.active).length,
    movimentoBloqueado: Boolean(scene.movimentoBloqueado),
    eventos: window.__eventosEtapa6,
    fade: scene.cameras.main.fadeEffect.alpha,
    oldBoss: Boolean(scene.bossFinal),
  };
});

async function registrarEventos() {
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.novoBoss.rng = () => 0.25;
    for (const [nome, callback] of window.__ouvintesEtapa6 ?? []) scene.events.off(nome, callback);
    window.__eventosEtapa6 = { fases: [], clones: 0, ataques: [], teleportes: [], derrotas: 0 };
    window.__ouvintesEtapa6 = [
      ["novo-boss:fase-alterada", ({ fase }) => window.__eventosEtapa6.fases.push(fase)],
      ["novo-boss:clones-iniciados", () => window.__eventosEtapa6.clones++],
      ["novo-boss:ataque-iniciado", ({ tipo }) => window.__eventosEtapa6.ataques.push(tipo)],
      ["novo-boss:teleporte-iniciado", ({ motivo }) => window.__eventosEtapa6.teleportes.push(motivo)],
      ["novo-boss:derrotada", () => window.__eventosEtapa6.derrotas++],
    ];
    for (const [nome, callback] of window.__ouvintesEtapa6) scene.events.on(nome, callback);
  });
}

async function avancarAte(condicao, limite = 30000) {
  const result = await page.evaluate(async ({ condicao, limite }) => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { atualizarBoss } = await import("/js/enemies/BossPrincipal.js");
    const atingiu = () => {
      const boss = scene.novoBoss;
      if (condicao === "vulneravel") return boss.estado === "vulneravel";
      if (condicao === "clones") return boss.sistemaClones.ativo;
      if (condicao === "ataque-com-clones") return boss.estado === "atacando" && boss.sistemaClones.ativo;
      if (condicao === "sem-clones") return !boss.sistemaClones.ativo;
      if (condicao === "retorno-clones") return window.__eventosEtapa6.teleportes.includes("retorno-clones");
      return false;
    };
    for (let tempo = 0; tempo <= limite; tempo += 20) {
      if (atingiu()) { scene.children.depthSort(); return { atingiu: true, tempo }; }
      atualizarBoss(scene, scene.time.now, 20);
    }
    return { atingiu: false, estado: scene.novoBoss.estado };
  }, { condicao, limite });
  assert.ok(result.atingiu, `${condicao}: ${JSON.stringify(result)}`);
  return snapshot();
}

async function dano(quantidade) {
  return page.evaluate(quantidade => {
    const boss = window.__game.scene.getScene("Level1Parte2").novoBoss;
    return boss.receberDano(quantidade);
  }, quantidade);
}

function assertCorpoAlinhado(state) {
  for (const campo of ["x", "y", "width", "height"]) {
    assert.ok(Math.abs(state.body[campo] - state.hitbox[campo]) < 0.01,
      `Movimento precisa manter corpo e hitbox alinhados (${campo}).`);
  }
}

try {
  await registrarEventos();
  await avancarAte("vulneravel");
  assert.ok(await dano(500));
  let state = await snapshot();
  assert.equal(state.vida, 500);
  assert.equal(state.fase, 1);
  assert.deepEqual(state.eventos.fases, []);
  assert.equal(state.clones.ativo, false);
  assert.equal(state.estado, "vulneravel");
  assert.equal(state.teleporte, null);
  await avancar(config.combate.janelaVulneravelMs);
  assert.equal((await snapshot()).teleporte?.motivo, "reativo");
  console.log("PASS: exatamente 50% mantém a primeira fase e o acerto isolado conserva a abertura antes da viagem reativa.");

  await avancar(config.teleporte.desaparecerMs + config.teleporte.reaparecerMs);
  await avancarAte("vulneravel");
  assert.ok(await dano(25));
  state = await snapshot();
  assert.equal(state.vida, 475);
  assert.equal(state.fase, 2);
  assert.deepEqual(state.eventos.fases, [2]);
  assert.equal(state.estado, "vulneravel");
  assert.equal(state.teleporte, null);
  assert.equal(state.clones.ativo, false);
  await avancar(config.combate.janelaVulneravelMs - 1);
  assert.equal((await snapshot()).clones.ativo, false,
    "A transição respeita a abertura inteira após cruzar o limiar.");
  await avancar(1);
  state = await snapshot();
  assert.equal(state.teleporte?.motivo, "reativo");
  await avancar(config.teleporte.desaparecerMs + config.teleporte.reaparecerMs);
  state = await avancarAte("clones", 2000);
  assert.equal(state.clones.ativo, true);
  assert.equal(state.clones.alvos.filter(alvo => alvo.active).length, 9);
  assert.equal(state.eventos.clones, 1);
  console.log("PASS: abaixo de 50% muda uma vez e gera nove clones após a abertura, viagem reativa e chegada ao centro.");

  const antesMovimento = state;
  await avancar(1000);
  state = await snapshot();
  assert.ok(Math.hypot(state.x - antesMovimento.x, state.y - antesMovimento.y) > 1);
  assert.ok(state.clones.alvos.filter(alvo => alvo.active).every(alvo => {
    const anterior = antesMovimento.clones.alvos.find(item => item.id === alvo.id);
    return anterior && Math.hypot(alvo.x - anterior.x, alvo.y - anterior.y) > 1;
  }));
  assertCorpoAlinhado(state);
  assert.ok(state.ilusoes.core.visible);
  console.log("PASS: a verdadeira caminha entre os clones com núcleo identificável e hitbox física sincronizada.");

  assert.ok(await page.evaluate(() =>
    window.__game.scene.getScene("Level1Parte2").novoBoss.executarAtaque("chuva")));
  await avancar(20);
  state = await snapshot();
  assert.equal(state.ataque.tipo, "chuvaRaios");
  assert.ok(state.clones.alvos.every(alvo => alvo.active && alvo.ataqueIlusorio?.ativo &&
    alvo.ataqueIlusorio.tipo === "chuva"));
  await avancarAte("vulneravel");
  const flecha = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const boss = scene.novoBoss;
    const area = boss.hitboxDano;
    // Disparo real à queima-roupa: a corda coincide com o núcleo. Isso permite
    // atingir a verdadeira entre clones que podem bloquear uma flecha distante.
    const x = area.centerX - 29 + scene.player.displayOriginX;
    const y = area.centerY - 60 + scene.player.displayOriginY;
    scene.player.setPosition(x, y);
    scene.player.body.reset(x, y);
    scene.player.body.updateFromGameObject();
    scene.direcaoAtual = "down";
    scene.direcaoAtaque = "down";
    const hp = boss.vida;
    const { dispararProjetil, atualizarProjeteis } = await import("/js/player/PlayerProjectiles.js");
    const flecha = dispararProjetil(scene);
    const criada = Boolean(flecha?.active && flecha.projetilPlayer);
    atualizarProjeteis(scene, 100);
    return { criada, consumida: !flecha?.active, dano: hp - boss.vida };
  });
  assert.ok(flecha.criada && flecha.consumida);
  assert.equal(flecha.dano, 25);
  state = await snapshot();
  assert.equal(state.fase, 2);
  assert.deepEqual(state.eventos.fases, [2]);
  console.log("PASS: chuva e imitação funcionam na segunda fase; a abertura permite flecha real na vida única da verdadeira.");

  const vidaAntesSair = state.vida;
  await posicionar(-1093, -5350);
  await avancar(0);
  state = await snapshot();
  assert.equal(state.clones.ativo, false);
  assert.equal(state.transicaoPendente, true);
  await posicionar(-1093, -5520);
  await avancar(0);
  state = await avancarAte("clones");
  assert.equal(state.vida, vidaAntesSair);
  assert.equal(state.fase, 2);
  assert.deepEqual(state.eventos.fases, [2]);
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").morteEmAndamento = true;
  });
  await avancar(0);
  assert.equal((await snapshot()).clones.ativo, false);
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").morteEmAndamento = false;
  });
  await avancar(0);
  state = await avancarAte("clones");
  assert.equal(state.vida, vidaAntesSair);
  assert.equal(state.fase, 2);
  assert.equal(state.captura, false);
  console.log("PASS: sair ou morrer interrompe os clones; retomar preserva fase e vida sem repetir a transição.");

  const ondas = state.eventos.clones;
  await avancarAte("sem-clones", config.clones.duracaoMs + 1000);
  state = await avancarAte("retorno-clones", 10000);
  assert.ok(state.eventos.teleportes.includes("retorno-clones"));
  assert.equal(state.fase, 2);
  await avancar(40000);
  state = await snapshot();
  assert.ok(state.eventos.clones > ondas && state.eventos.clones <= ondas + 2,
    "Novas ondas devem respeitar duração e intervalo, sem crescer a cada atualização.");
  assert.ok(state.clones.alvos.filter(alvo => alvo.active).length <= 9);
  assert.deepEqual(state.eventos.fases, [2]);
  console.log("PASS: a onda expira, retorna a um ponto e repete respeitando o intervalo, sem duplicar a fase ou acumular clones.");

  await reiniciar({ novoBossConfig: { ...config, ataques: { ...config.ataques, automatico: true } } });
  await registrarEventos();
  await avancarAte("vulneravel");
  assert.ok(await dano(501));
  state = await avancarAte("clones");
  assert.equal(state.vida, 499);
  assert.equal(state.fase, 2);
  state = await avancarAte("ataque-com-clones");
  assert.ok(state.eventos.ataques.length >= 2);
  assert.ok(state.ataque);
  await avancar(20);
  state = await snapshot();
  assert.ok(state.clones.alvos.some(alvo => alvo.active && alvo.ataqueIlusorio?.ativo));
  assertCorpoAlinhado(state);
  assert.equal(state.fade, 0);
  await page.screenshot({ path: process.env.NOVO_BOSS_SCREENSHOT ?? "/tmp/novo-boss-etapa6.png" });
  await avancarAte("vulneravel");
  assert.ok(await dano(state.vida + 1));
  await avancar(0);
  state = await snapshot();
  assert.equal(state.vida, 0);
  assert.equal(state.estado, "derrotada");
  assert.ok(state.morto);
  assert.equal(state.clones.ativo, false);
  assert.equal(state.clones.alvos.length, 0);
  assert.equal(state.ataque, null);
  assert.equal(state.lasers, 0);
  assert.equal(state.captura, false);
  assert.equal(state.movimentoBloqueado, false);
  assert.equal(state.eventos.derrotas, 1);
  assert.deepEqual(state.eventos.fases, [2]);
  assert.equal(await dano(1), false);
  await avancar(40000);
  assert.equal((await snapshot()).eventos.derrotas, 1);
  assert.equal((await snapshot()).clones.ativo, false);
  assert.equal(state.oldBoss, false);
  console.log("PASS: combate automático continua na segunda fase; o golpe fatal limpa ataques/clones e mantém o controle livre.");

  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
} catch (error) {
  console.error("Estado na falha:", await snapshot().catch(() => null));
  console.error("Erros JavaScript:", sessao.errors, "Falhas de recursos:", sessao.assetErrors);
  await page.screenshot({ path: "/tmp/novo-boss-etapa6-falha.png" }).catch(() => {});
  throw error;
} finally {
  await sessao.fechar();
}
