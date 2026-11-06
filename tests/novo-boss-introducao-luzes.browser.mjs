import assert from "node:assert/strict";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

const config = { ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, ativo: false, automatico: false },
};
const session = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar } = session;
async function snapshot() {
  return page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2"), b = s.novoBoss, c = s.cameras.main;
    c.preRender();
    s.game.renderer.emit("render", s, c);
    const luzes = b.introducao.iluminacao;
    const piso = s.iluminacaoEmergencia.luzes.filter(l => l.neon && luzes.contem(l));
    return { ...b.introducao.snapshot(), aura: luzes.aura, ambiente: luzes.ambiente,
      piso: piso.filter(l => l.cor.phaser !== 0xff101c).map(l => ({ y: l.y, acesa: luzes.fatorLuz(l) })),
      anel: piso.filter(l => l.cor.phaser === 0xff101c).map(l => luzes.fatorLuz(l)),
      sombras: s.zonasLuzApagada.zonas.filter(z => [1602, 1603].includes(z.id)).map(z => z.opacidade),
      torres: b.geradores.map(t => ({ id: t.id, estado: t.estado, frame: t.visual.frame.name,
        choque: t.luzChoqueIdle.intensidade })),
      escudo: b.sistemaGeradores?.cargaEscudo ?? 0,
      vermelho: s.iluminacaoEnergiaBoss.fontesVisiveis.some(f => f.vermelha),
      centroY: c.midPoint.y, bloqueado: s.movimentoBloqueado, relogio: b.relogioCombate };
  });
}
try {
  // Visita nova, ainda do lado de fora: o boss nem precisa existir para a arena esperar apagada.
  await page.evaluate(config => {
    const s = window.__game.scene.getScene("Level1Parte2");
    window.__bossAntesEntrada = s.novoBoss;
    s.scene.resume();
    s.scene.restart({ personagem: "kai-mercer", spawnX: -1080, spawnY: -5251, novoBossConfig: config });
  }, config);
  await page.waitForFunction(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    return s.scene.isActive() && s.player?.active && s.novoBoss &&
      s.novoBoss !== window.__bossAntesEntrada && !s.cameras.main.fadeEffect.isRunning &&
      s.cameras.main.fadeEffect.alpha === 0;
  });
  await session.pausar();
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.acenderLuzFabrica();
    for (const p of s.portasFabrica.filter(p => ["porta02", "porta03"].includes(p.nome))) {
      p.estado = "aberta"; p.progresso = 1; p.colisao?.destroy(); p.colisao = null;
      p.visual.setVisible(false);
    }
  });
  await session.retomar();
  await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").zonasLuzApagada.zonas
    .filter(z => [1602, 1603].includes(z.id)).every(z => z.opacidade === 0));
  await session.pausar();
  const antes = await snapshot();
  assert.equal(antes.etapa, "aguardando");
  assert.notEqual(antes.bloqueado, true);
  assert.ok(antes.piso.length > 50 && antes.piso.every(l => l.acesa === 0));
  assert.ok(antes.anel.length > 10 && antes.anel.every(a => a === 0));
  assert.equal(antes.aura, 0); assert.equal(antes.ambiente, 0);
  assert.ok(antes.sombras.every(a => a === 0));
  await page.screenshot({ path: "/tmp/boss-intro-00-antes-de-entrar.png" });
  await posicionar(-1080, -5400);
  await avancar(0);
  let estado = await snapshot();
  assert.equal(estado.etapa, "indo");
  assert.ok(estado.piso.length > 50);
  assert.ok(estado.piso.every(l => l.acesa === 0));
  assert.equal(estado.aura, 0); assert.equal(estado.ambiente, 0);
  assert.ok(estado.sombras.every(a => a === 0));
  await page.screenshot({ path: "/tmp/boss-intro-01-apagado.png" });
  await avancar(1600);
  estado = await snapshot();
  assert.equal(estado.etapa, "indo");
  assert.ok(estado.piso.some(l => l.acesa) && estado.piso.some(l => !l.acesa));
  assert.ok(Math.min(...estado.piso.filter(l => l.acesa).map(l => l.y)) >=
    Math.max(...estado.piso.filter(l => !l.acesa).map(l => l.y)) - 16);
  assert.equal(estado.vermelho, false);
  await page.screenshot({ path: "/tmp/boss-intro-02-fileiras.png" });
  await avancar(1600);
  estado = await snapshot();
  assert.equal(estado.etapa, "mostrando");
  assert.ok(estado.piso.every(l => l.acesa)); assert.equal(estado.aura, 0);
  assert.ok(estado.anel.length > 10 && estado.anel.every(a => a === 0));
  await avancar(450);
  estado = await snapshot();
  assert.equal(estado.aura, 1); assert.equal(estado.vermelho, true);
  assert.ok(estado.anel.every(a => a === 1));
  await page.screenshot({ path: "/tmp/boss-intro-03-percebe.png" });
  await avancar(450);
  const ordem = [];
  const ritmoTorres = config.cenaEntrada.velocidadeTorres;
  for (let i = 0; i < 4; i++) {
    estado = await snapshot();
    assert.equal(estado.etapa, "indo-torre");
    const id = estado.torre; ordem.push(id);
    await avancar(650 / ritmoTorres);
    assert.equal((await snapshot()).etapa, "invocando-torre");
    await avancar(1600 / ritmoTorres);
    assert.equal((await snapshot()).etapa, "mostrando-choque-torre");
    await avancar(200 / ritmoTorres);
    estado = await snapshot();
    assert.equal(estado.torre, id);
    assert.ok(estado.torres.find(t => t.id === id).choque > 0);
    assert.equal(estado.escudo, 0);
    await page.screenshot({ path: `/tmp/boss-intro-04-torre-${i + 1}.png` });
    await avancar(1400 / ritmoTorres);
  }
  assert.equal(new Set(ordem).size, 4);
  await avancar(800);
  assert.equal((await snapshot()).etapa, "carregando-escudo");
  await avancar(975);
  estado = await snapshot();
  assert.ok(Math.abs(estado.escudo - 0.5) < 0.001);
  await page.screenshot({ path: "/tmp/boss-intro-05-escudo.png" });
  await avancar(525);
  assert.equal((await snapshot()).escudo, 1);
  await page.screenshot({ path: "/tmp/boss-intro-06-escudo-completo.png" });
  await avancar(350 + 720);
  assert.equal((await snapshot()).etapa, "fechando");
  assert.equal((await snapshot()).relogio, 0);
  await session.retomar();
  await page.waitForFunction(() => window.__game.scene.getScene("Level1Parte2").novoBoss.introducao.snapshot().concluida);
  estado = await snapshot();
  assert.equal(estado.bloqueado, false); assert.equal(estado.escudo, 1);
  assert.ok(estado.sombras.every(a => a === 0));
  assert.deepEqual(session.errors, []); assert.deepEqual(session.assetErrors, []);
  console.log("PASS: arena apagada antes da entrada com porta aberta e fábrica energizada; apresentação completa, reinício e controles sem erros.");
} finally { await session.fechar(); }
