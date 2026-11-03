/** Aberturas e mobilidade final no Phaser real, com os valores de produção. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

// Só desliga os geradores e a seleção automática para isolar cada comportamento.
// A luta completa com geradores e ataques automáticos é coberta pelo roteiro etapa8.
const config = { ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, automatico: false },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar } = sessao;

try {
  await posicionar(-1080, -5520);
  assert.ok(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.executarAtaque("pulso")));
  await avancar(1950);
  const abertura = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    const { atacar, atualizarHitboxDanoPlayer } = await import("/js/player/Player.js");
    const origem = { x: b.x, y: b.y }, vidaAntes = b.vida;
    const passo = delta => {
      scene.time.preUpdate(); scene.time.update(scene.time.now + delta, delta);
      scene.player.preUpdate(scene.time.now, delta);
      atualizarNovoBoss(scene, scene.time.now, delta);
    };
    // Reserva tempo para chegar perto depois de esquivar da explosão de raio 310.
    for (let t = 0; t < 2200; t += 20) passo(20);
    if (b.estado !== "vulneravel" || b.x !== origem.x || b.y !== origem.y) throw new Error("Perdeu abertura de aproximação.");
    const x = b.hitboxDano.centerX, y = b.hitboxDano.bottom + 10;
    scene.player.setPosition(x, y); scene.player.body.reset(x, y);
    scene.player.body.updateFromGameObject(); atualizarHitboxDanoPlayer(scene);
    scene.direcaoAtual = "up";
    const golpes = [];
    for (let i = 0; i < 3; i++) {
      if (!atacar(scene)) throw new Error(`Katana recusou golpe ${i + 1}.`);
      for (let t = 0; t < 400; t += 20) passo(20);
      golpes.push({ vida: b.vida, estado: b.estado, x: b.x, y: b.y });
    }
    return { origem, vidaAntes, golpes, estamina: scene.estamina };
  });
  assert.deepEqual(abertura.golpes.map(g => g.vida), [975, 950, 925]);
  assert.ok(abertura.golpes.slice(0, 2).every(g => g.estado === "vulneravel" &&
    g.x === abertura.origem.x && g.y === abertura.origem.y));
  assert.ok(abertura.estamina < 100, "Os golpes usam a estamina real.");
  console.log("PASS: após 2,2 s para aproximação, três golpes reais da katana causam 75 de dano na mesma abertura, sem dano duplicado por golpe.");

  // Acesso à fase pelo contrato de dano, sem alterar vida diretamente.
  await posicionar(-1080, -5520);
  await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    for (let t = 0; b.estado !== "vulneravel" && t < 10000; t += 20) atualizarNovoBoss(scene, scene.time.now, 20);
    if (!b.receberDano(501)) throw new Error("Não abriu fase 2 pelo contrato.");
    for (let t = 0; !b.sistemaClones.ativo && t < 15000; t += 20) atualizarNovoBoss(scene, scene.time.now, 20);
    if (!b.sistemaClones.ativo) throw new Error("Não criou onda central.");
  });
  const movimento = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    const { destinoValidoNovoBoss } = await import("/js/enemies/novoBoss/NovoBossTeleporte.js");
    const registro = { passosRapidos: 0, passosSemClones: 0, aberturas: 0, pressao: 0, ondas: [], protegido: false };
    const aoClonar = () => registro.ondas.push({ x: b.x, y: b.y, protecao: b.invulneravelClonesAte - b.relogioCombate });
    const aoTeleportar = ({ motivo }) => { if (motivo === "pressao-fase2") registro.pressao++; };
    scene.events.on("novo-boss:clones-iniciados", aoClonar);
    scene.events.on("novo-boss:teleporte-iniciado", aoTeleportar);
    try {
      const ate = b.invulneravelClonesAte;
      while (b.relogioCombate < ate - 1) atualizarNovoBoss(scene, scene.time.now, Math.min(20, ate - 1 - b.relogioCombate));
      registro.protegido = !b.receberDano(25);
      for (let t = 0; t < 60000; t += 20) {
        const antes = { x: b.x, y: b.y, estado: b.estado, teleporte: Boolean(b.teleporte), clones: b.sistemaClones.ativo };
        atualizarNovoBoss(scene, scene.time.now, 20);
        if (!b.teleporte && b.body.enable) {
          if (!destinoValidoNovoBoss(scene, b, b.sprite)) throw new Error("Movimento atravessou obstáculo ou jogador.");
          for (const chave of ["x", "y", "width", "height"]) {
            if (Math.abs(b.body[chave] - b.hitboxDano[chave]) > 0.001) throw new Error(`Corpo dessincronizado: ${chave}.`);
          }
        }
        const distancia = Math.hypot(b.x - antes.x, b.y - antes.y);
        if (!antes.teleporte && !b.teleporte && distancia > 0) {
          if (distancia > 5.001) throw new Error(`Deslocamento acima de 250 px/s: ${distancia}.`);
          if (distancia > 4) registro.passosRapidos++;
          if (!antes.clones && !b.sistemaClones.ativo) registro.passosSemClones++;
        }
        if (antes.estado === "vulneravel" && b.estado === "vulneravel") {
          registro.aberturas++;
          if (distancia > 0) throw new Error("Boss escapou caminhando durante a abertura.");
        }
      }
    } finally {
      scene.events.off("novo-boss:clones-iniciados", aoClonar);
      scene.events.off("novo-boss:teleporte-iniciado", aoTeleportar);
    }
    return registro;
  });
  assert.ok(movimento.protegido);
  assert.ok(movimento.passosRapidos > 100 && movimento.passosSemClones > 10);
  assert.ok(movimento.aberturas > 100 && movimento.pressao >= 2);
  assert.ok(movimento.ondas.length >= 1 && movimento.ondas.every(o =>
    o.x === -1080 && o.y === -5810 && o.protecao === 2000));
  console.log(`PASS: 60 s de fase 2, ${movimento.passosRapidos} passos rápidos, ${movimento.pressao} teleportes de pressão; corpo seguro, aberturas paradas e ondas centrais protegidas.`);

  for (const tipo of ["pulso", "lasers"]) {
    const resultado = await page.evaluate(async tipo => {
      const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
      const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
      for (let t = 0; (b.teleporte || b.teleportePendente) && t < 10000; t += 20) atualizarNovoBoss(scene, scene.time.now, 20);
      if (!b.executarAtaque(tipo)) throw new Error(`Não iniciou ${tipo}.`);
      for (let t = 0; b.ataquePendente && t < 2000; t += 20) atualizarNovoBoss(scene, scene.time.now, 20);
      let amostras = 0;
      while (b.ataqueAtual && amostras < 1000) {
        if (b.x !== -1080 || b.y !== -5810) throw new Error(`Origem ${tipo} saiu do centro.`);
        atualizarNovoBoss(scene, scene.time.now, 20); amostras++;
      }
      return { amostras, estado: b.estado };
    }, tipo);
    assert.ok(resultado.amostras > 20);
    assert.equal(resultado.estado, "vulneravel");
  }
  console.log("PASS: movimento rápido preserva a origem central durante toda a explosão e a espiral de dez segundos.");
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
} catch (error) {
  console.error("Estado:", await page.evaluate(() => {
    const b = window.__game.scene.getScene("Level1Parte2").novoBoss;
    return { estado: b.estado, vida: b.vida, x: b.x, y: b.y, tempo: b.tempoEstado,
      teleporte: b.teleporte?.motivo, pendente: b.teleportePendente, clones: b.sistemaClones.ativo };
  }).catch(() => null));
  throw error;
} finally {
  await sessao.fechar();
}
