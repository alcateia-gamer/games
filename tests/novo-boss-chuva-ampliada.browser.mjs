/** Item 7: Heavens Fury ampliado, quinze raios e fuga com controles reais. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = { ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, automatico: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar } = sessao;
const snapshot = () => page.evaluate(() => {
  const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
  return { vida: scene.vida, estado: b.estado, ataque: b.ataqueAtual?.snapshot() ?? null,
    raios: scene.children.list.filter(o => o.active && o.texture?.key === "novo-boss-heavens-fury")
      .map(o => ({ x: o.x, y: o.y, frame: o.frame.name, escala: o.scaleX,
        origemX: o.originX, origemY: o.originY, profundidade: o.depth })),
    avisos: scene.children.list.filter(o => o.active && o.name === "novo-boss-aviso").length };
});
async function iniciar() {
  assert.ok(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.executarAtaque("chuva")));
  await avancar(0);
}

try {
  const distribuicao = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
    const { criarChuvaRaios } = await import("/js/enemies/novoBoss/ataques/ChuvaRaios.js");
    const { criarServicosAtaques } = await import("/js/enemies/novoBoss/NovoBossServicosAtaques.js");
    const servicos = criarServicosAtaques(scene, b);
    const casos = [];
    for (let i = -2; i < 32; i++) {
      let estado = i;
      const rng = i < 0 ? () => i === -2 ? 0 : 1 :
        () => ((estado = (Math.imul(estado, 1664525) + 1013904223) >>> 0) / 2 ** 32);
      const a = criarChuvaRaios(scene, b, { ...b.config.ataques.chuvaRaios, mirarJogador: false }, { ...servicos, rng });
      const s = a.snapshot();
      if (s.marcas.length !== 15) throw new Error(`Semente ${i}: apenas ${s.marcas.length} raios.`);
      for (const [j, m] of s.marcas.entries()) {
        if (!servicos.pontoLivre(m.x, m.y, s.raio)) throw new Error("Raio sobre parede ou gerador.");
        if (m.inicio !== j * 400) throw new Error("Cadência incorreta.");
        for (const n of s.marcas.slice(0, j)) {
          if (m.inicio < n.impactoEm + b.config.ataques.chuvaRaios.perigoMs &&
              Math.hypot(m.x - n.x, m.y - n.y) < s.raio * 2 + 24) {
            throw new Error("Dois avisos/perigos sobrepostos.");
          }
        }
      }
      casos.push(s.marcas.length);
      a.destruir();
    }
    return { casos, geradores: b.geradores.filter(g => !g.desativado).length };
  });
  assert.equal(distribuicao.geradores, 4);
  assert.equal(distribuicao.casos.length, 34);
  console.log("PASS: 34 distribuições, incluindo RNG constante, entregam quinze círculos válidos e espaçados no mapa com os quatro geradores.");

  await posicionar(-1080, -5710);
  await iniciar();
  let s = await snapshot();
  const marca = s.ataque.marcas[0];
  assert.equal(s.ataque.marcas.length, 15);
  assert.equal(s.ataque.raio, 96);
  assert.equal(s.ataque.duracao, 7900);
  const ponto = await page.evaluate(marca => {
    const scene = window.__game.scene.getScene("Level1Parte2"), area = scene.hitboxDanoPlayer;
    return { x: marca.x + 90 - (area.centerX - scene.player.x),
      y: marca.y - (area.centerY - scene.player.y) };
  }, marca);
  await posicionar(ponto.x, ponto.y);
  await avancar(1399);
  assert.equal((await snapshot()).vida, 100);
  await avancar(1);
  s = await snapshot();
  assert.equal(s.vida, 84, "A nova área deve atingir o jogador a 90 px, além do antigo raio de 48.");
  const visual = s.raios.find(r => r.x === marca.x && r.y === marca.y);
  assert.equal(visual.frame, 4);
  assert.equal(visual.escala, 1.28);
  assert.equal(visual.origemX, 198 / 384);
  assert.equal(visual.origemY, 0.75);
  assert.equal(visual.profundidade, 52);
  const largura = await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const objeto = scene.children.list.find(o => o.active && o.texture?.key === "novo-boss-heavens-fury" && o.frame.name === 4);
    const imagem = objeto.texture.getSourceImage(), frame = objeto.frame;
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 384;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imagem, frame.cutX, frame.cutY, 384, 384, 0, 0, 384, 384);
    const dados = ctx.getImageData(0, 285, 384, 1).data;
    let min = 384, max = -1;
    for (let x = 0; x < 384; x++) if (dados[x * 4 + 3] > 32) { min = Math.min(min, x); max = x; }
    return { mundo: (max - min + 1) * objeto.scaleX,
      centro: ((min + max + 1) / 2 - objeto.originX * 384) * objeto.scaleX };
  });
  assert.equal(largura.mundo, 192);
  assert.ok(Math.abs(largura.centro) <= 1);
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").cameras.main
      .stopFollow().setZoom(0.65).centerOn(-1080, -5810);
  });
  await page.screenshot({ path: "/tmp/novo-boss-parte7/heavens-fury.png" });
  await avancar(149);
  assert.equal((await snapshot()).vida, 84);
  console.log("PASS: raio 96 causa um impacto real a 90 px somente no quadro 4; o PNG mede 192 px no chão e permanece centrado no aviso.");

  await sessao.reiniciar();
  await posicionar(-1080, -5710);
  await iniciar();
  const fuga = await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
    const m = b.ataqueAtual.snapshot().marcas[0];
    scene.speed = 200;
    window.__fugaChuva = null;
    scene.events.on("postupdate", window.__observarFugaChuva = () => {
      const area = scene.hitboxDanoPlayer;
      const x = Math.max(area.x, Math.min(m.x, area.right)), y = Math.max(area.y, Math.min(m.y, area.bottom));
      if (Math.hypot(x - m.x, y - m.y) <= 100) return;
      window.__fugaChuva = { tempo: b.tempoAtaque, vida: scene.vida, naArena: b.jogadorNaArena };
      scene.player.setVelocity(0, 0);
      scene.events.off("postupdate", window.__observarFugaChuva);
      scene.scene.pause();
    });
    return { x: m.x, y: m.y };
  });
  await sessao.retomar();
  await page.keyboard.down("d");
  await page.waitForFunction(() => window.__fugaChuva !== null, null, { timeout: 6000 });
  await page.keyboard.up("d");
  await sessao.pausar();
  const fugiu = await page.evaluate(() => window.__fugaChuva);
  assert.equal(fugiu.vida, 100);
  assert.equal(fugiu.naArena, true);
  assert.ok(fugiu.tempo < 1400);
  await avancar(1550 - fugiu.tempo);
  assert.equal((await snapshot()).vida, 100);
  console.log(`PASS: tecla D real permite escapar andando a 200 px/s, antes do impacto, sem dash ou dano (${fugiu.tempo} ms; alvo ${fuga.x},${fuga.y}).`);

  await sessao.reiniciar();
  await posicionar(-1080, -5710);
  await iniciar();
  const sequencia = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    const quadros = new Map(), objetos = new Set();
    const anunciadas = new Map();
    for (let t = 0; t <= 7900; t += 20) {
      atualizarNovoBoss(scene, scene.time.now, t ? 20 : 0);
      for (const objeto of scene.children.list) {
        if (objeto.active && objeto.texture?.key === "novo-boss-heavens-fury") {
          objetos.add(objeto);
          if (!quadros.has(objeto)) quadros.set(objeto, new Set());
          quadros.get(objeto).add(Number(objeto.frame.name));
        }
      }
      for (const [i, m] of (b.ataqueAtual?.snapshot().marcas ?? []).entries()) {
        if (!m.iniciou) continue;
        const posicao = JSON.stringify([m.x, m.y]);
        if (anunciadas.has(i) && anunciadas.get(i) !== posicao) throw new Error("Um alvo anunciado mudou de posição.");
        anunciadas.set(i, posicao);
      }
    }
    return { quantidades: [...quadros.values()].map(frames => frames.size),
      limpou: [...objetos].every(o => !o.active), estado: b.estado,
      recursos: scene.children.list.filter(o => o.active && (o.name === "novo-boss-aviso" ||
        o.texture?.key === "novo-boss-heavens-fury")).length };
  });
  assert.equal(sequencia.quantidades.length, 15);
  assert.ok(sequencia.quantidades.every(n => n === 13));
  assert.ok(sequencia.limpou);
  assert.equal(sequencia.recursos, 0);
  assert.equal(sequencia.estado, "vulneravel");
  console.log("PASS: os quinze raios percorrem os treze quadros do PNG, mantêm alvos fixos e terminam sem efeitos residuais, na abertura normal.");

  for (const motivo of ["cancelar", "sair", "morrer", "reiniciar"]) {
    await sessao.reiniciar();
    await iniciar();
    await avancar(1800);
    const objetos = await page.evaluate(() => {
      const scene = window.__game.scene.getScene("Level1Parte2");
      window.__efeitosChuva = scene.children.list.filter(o => o.active &&
        (o.name === "novo-boss-aviso" || o.texture?.key === "novo-boss-heavens-fury"));
      return window.__efeitosChuva.length;
    });
    assert.ok(objetos > 0);
    if (motivo === "reiniciar") await sessao.reiniciar();
    else {
      await page.evaluate(motivo => {
        const scene = window.__game.scene.getScene("Level1Parte2");
        if (motivo === "cancelar") scene.novoBoss.cancelarAtaque();
        if (motivo === "sair") scene.player.setPosition(-1093, -5350);
        if (motivo === "morrer") scene.morteEmAndamento = true;
      }, motivo);
      await avancar(9000);
    }
    assert.ok(await page.evaluate(() => window.__efeitosChuva.every(o => !o.active)));
  }
  console.log("PASS: cancelamento, saída, morte e reinício limpam a chuva sem impactos ou animações tardios.");
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
  assert.deepEqual(sessao.consoleErrors, []);
} finally { await sessao.fechar(); }
