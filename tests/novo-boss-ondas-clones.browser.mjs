/** Item 9: ondas recorrentes no centro e proteção real por dois segundos. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = { ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, automatico: false },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar } = sessao;
const centro = novoBossConfig.posicaoInicial;
const snapshot = () => page.evaluate(() => {
  const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
  return { fase: b.fase, vida: b.vida, estado: b.estado, x: b.x, y: b.y,
    relogio: b.relogioCombate, ate: b.invulneravelClonesAte,
    inicio: b.inicioOndaClonesEm, ondas: b.ondasClonesFase2, proxima: b.proximaOndaClonesEm,
    teleporte: b.teleporte?.motivo ?? null, ataque: b.ataqueAtual?.tipo ?? null,
    corpo: b.body.enable, alpha: b.sprite.alpha, texto: b.hud.textoEstado.text,
    clones: b.sistemaClones.snapshot(), eventos: window.__ondasClonesBrowser };
});
async function esperar(condicao, limite = 40000) {
  assert.ok(await page.evaluate(async ({ condicao, limite }) => {
    const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    for (let t = 0; t <= limite; t += 20) {
      if (condicao === "abertura" && b.estado === "vulneravel") return true;
      if (condicao === "fim-onda" && !b.sistemaClones.ativo) return true;
      if (condicao === "viagem-central" && b.teleporte?.motivo === "clones-centro") return true;
      if (typeof condicao === "number" && b.ondasClonesFase2 >= condicao && b.sistemaClones.ativo) return true;
      atualizarNovoBoss(scene, scene.time.now, 20);
    }
    return false;
  }, { condicao, limite }), `Não atingiu ${condicao}.`);
}
async function prepararFase2(aguardar = true) {
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    if (window.__faseOndaBrowser) scene.events.off("novo-boss:fase-alterada", window.__faseOndaBrowser);
    if (window.__clonesOndaBrowser) scene.events.off("novo-boss:clones-iniciados", window.__clonesOndaBrowser);
    window.__ondasClonesBrowser = { fases: 0, ondas: [] };
    window.__faseOndaBrowser = () => window.__ondasClonesBrowser.fases++;
    window.__clonesOndaBrowser = ({ encontro: b }) => {
      window.__ondasClonesBrowser.ondas.push({ x: b.x, y: b.y, relogio: b.relogioCombate,
        ate: b.invulneravelClonesAte, onda: b.ondasClonesFase2,
        origens: b.sistemaClones.alvos.map(a => ({ x: a.x, y: a.y })) });
    };
    scene.events.on("novo-boss:fase-alterada", window.__faseOndaBrowser);
    scene.events.on("novo-boss:clones-iniciados", window.__clonesOndaBrowser);
  });
  await esperar("abertura");
  assert.ok(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(501)));
  if (aguardar) await esperar(1);
}
function conferirNascimento(s, numero) {
  assert.equal(s.ondas, numero);
  assert.equal(s.eventos.fases, 1);
  assert.equal(s.eventos.ondas.length, numero);
  const desdeInicio = s.relogio - s.inicio;
  assert.ok(desdeInicio >= 0 && desdeInicio < 20.001);
  assert.ok(Math.abs(s.clones.tempo - desdeInicio) < 0.001, "Somente o excedente posterior à chegada envelhece a onda.");
  assert.ok(Math.hypot(s.x - centro.x, s.y - centro.y) <= config.fase2.movimento.velocidade * desdeInicio / 1000 + 0.001);
  assert.ok(Math.abs(s.ate - s.inicio - 2000) < 0.001);
  assert.equal(s.clones.alvos.length, 9);
  const evento = s.eventos.ondas.at(-1);
  assert.deepEqual({ x: evento.x, y: evento.y }, centro);
  assert.ok(Math.abs(evento.ate - evento.relogio - 2000) < 0.001);
  assert.ok(evento.origens.every(p => p.x === centro.x && p.y === centro.y));
  assert.match(s.texto, /PROTEGIDA/);
}
async function verificarAtaque(tipo) {
  return page.evaluate(async tipo => {
    const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    if (!b.executarAtaque(tipo)) throw new Error(`Não iniciou ${tipo}.`);
    for (let t = 0; b.ataquePendente && t < 2000; t += 20) atualizarNovoBoss(scene, scene.time.now, 20);
    if (!b.ataqueAtual) throw new Error("Ataque não iniciou após posicionar.");
    let amostras = 0;
    while (b.ataqueAtual && amostras < 1000) {
      b.sprite.preUpdate(scene.time.now, 20);
      for (const a of b.alvosIlusorios) a.sprite.preUpdate(scene.time.now, 20);
      atualizarNovoBoss(scene, scene.time.now, 20);
      if (b.alvosIlusorios.length !== 9) throw new Error("Perdeu clones antes de concluir ataque da onda.");
      for (const a of b.alvosIlusorios) {
        const c = a.ataquesIlusorios.snapshot();
        if (a.sprite.frame.name !== b.sprite.frame.name) throw new Error("Frame dessincronizado.");
        if (b.ataqueAtual && (!c.ativo || c.tempo !== b.tempoAtaque)) throw new Error(
          `Relógio dessincronizado: ${tipo}, real=${b.tempoAtaque}, copia=${c.tempo}, ativa=${c.ativo}, onda=${b.ondasClonesFase2}, idade=${b.sistemaClones.snapshot().tempo}.`);
        if (tipo === "chuva" && c.execucao && b.ataqueAtual) {
          const marcas = b.ataqueAtual.snapshot().marcas;
          if (c.execucao.marcas.some((m, i) => m.x !== marcas[i].x || m.y !== marcas[i].y)) throw new Error("Mira diferente.");
        }
      }
      amostras++;
    }
    if (b.ataqueAtual) throw new Error("Ataque não terminou.");
    return amostras;
  }, tipo);
}

try {
  await prepararFase2();
  conferirNascimento(await snapshot(), 1);
  await avancar(1999);
  let s = await snapshot();
  assert.equal(s.estado, "vulneravel");
  assert.match(s.texto, /PROTEGIDA/);
  assert.equal(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(25)), false);
  assert.equal((await snapshot()).vida, 499);
  await avancar(1);
  assert.match((await snapshot()).texto, /VULNERÁVEL/);
  assert.equal(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(25)), true);
  await avancar(500);
  console.log("PASS: primeira onda nasce no centro após a viagem reativa, nove clones com idade zero; proteção visível recusa dano até 1999 ms e libera em 2000 ms.");

  await posicionar(-590, -5520);
  for (const tipo of ["chuva", "tentaculos"]) assert.ok(await verificarAtaque(tipo) > 20);
  await esperar("fim-onda");
  s = await snapshot();
  assert.ok(Math.abs(s.proxima - s.relogio - 10000) < 0.001);
  assert.equal(s.ate, 0);
  await avancar(9999);
  assert.equal((await snapshot()).ondas, 1);
  await esperar(2, 7000);
  conferirNascimento(await snapshot(), 2);
  console.log("PASS: chuva e tentáculos completos sincronizados; onda expira, respeita dez segundos de intervalo e gera uma segunda onda no centro sem repetir a fase.");

  for (const tipo of ["pulso", "lasers"]) assert.ok(await verificarAtaque(tipo) > 20);
  await esperar(3, 40000);
  s = await snapshot();
  conferirNascimento(s, 3);
  assert.equal(s.vida, 474);
  assert.ok(await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    const antes = JSON.stringify(b.sistemaClones.snapshot());
    for (const delta of [NaN, Infinity, -1]) atualizarNovoBoss(scene, scene.time.now, delta);
    return JSON.stringify(b.sistemaClones.snapshot()) === antes;
  }), "Deltas inválidos não envelhecem ou movem a onda.");
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").cameras.main
      .stopFollow().setZoom(0.65).centerOn(-1080, -5810);
  });
  await page.screenshot({ path: "/tmp/novo-boss-parte9/onda-clones.png" });
  await avancar(2001);
  assert.ok(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(474)));
  await avancar(60000);
  s = await snapshot();
  assert.equal(s.vida, 0); assert.equal(s.ondas, 3); assert.equal(s.clones.alvos.length, 0);
  assert.equal(s.ate, 0);
  console.log("PASS: segunda onda reproduz pulso e espiral completos; terceira onda renova a proteção e o golpe fatal limpa os clones e impede futuras ondas.");

  for (const durante of [false, true]) {
    await sessao.reiniciar();
    await prepararFase2(false);
    if (durante) { await esperar("viagem-central"); await avancar(300); }
    await posicionar(centro.x, centro.y);
    await avancar(1500);
    s = await snapshot();
    assert.equal(s.ondas, 0); assert.equal(s.clones.ativo, false);
    assert.equal(s.ate, 0); assert.equal(s.alpha, 1); assert.equal(s.corpo, true);
    await posicionar(-590, -5520);
    await esperar(1, 7000);
    conferirNascimento(await snapshot(), 1);
  }
  console.log("PASS: ocupar o centro antes ou durante a viagem não cria clones em outro ponto; ao liberar, a onda nasce no centro sem duplicar a transição.");

  for (const motivo of ["sair", "morrer", "multiplayer", "reiniciar"]) {
    await sessao.reiniciar(); await prepararFase2();
    await page.evaluate(() => {
      const b = window.__game.scene.getScene("Level1Parte2").novoBoss;
      window.__ondaAnteriorBrowser = b;
      window.__clonesAnterioresBrowser = [...b.sistemaClones.alvos];
    });
    if (motivo === "reiniciar") await sessao.reiniciar();
    else {
      await page.evaluate(motivo => {
        const scene = window.__game.scene.getScene("Level1Parte2");
        if (motivo === "sair") scene.player.setPosition(-1093, -5350);
        if (motivo === "morrer") scene.morteEmAndamento = true;
        if (motivo === "multiplayer") scene.multiplayer = true;
      }, motivo);
      await avancar(60000);
    }
    assert.ok(await page.evaluate(() => window.__ondaAnteriorBrowser.invulneravelClonesAte === 0 &&
      window.__clonesAnterioresBrowser.every(a => !a.active)));
    if (motivo !== "reiniciar") {
      assert.equal((await snapshot()).ondas, 1);
      await page.evaluate(() => {
        const scene = window.__game.scene.getScene("Level1Parte2");
        scene.morteEmAndamento = false; scene.multiplayer = false;
      });
      await posicionar(-590, -5520);
      await esperar(2, 7000);
      conferirNascimento(await snapshot(), 2);
    } else {
      s = await snapshot(); assert.equal(s.fase, 1); assert.equal(s.ondas, 0); assert.equal(s.vida, 1000);
    }
  }
  console.log("PASS: saída, morte e multiplayer removem clones/proteção e retomam uma onda única; reinício destrói os recursos antigos e restaura a fase 1.");
  assert.deepEqual(sessao.errors, []); assert.deepEqual(sessao.assetErrors, []); assert.deepEqual(sessao.consoleErrors, []);
} finally { await sessao.fechar(); }
