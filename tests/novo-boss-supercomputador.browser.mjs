import assert from "node:assert/strict";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";

const config = { ...novoBossConfig,
  cenaEntrada: { ...novoBossConfig.cenaEntrada, ativo: false },
  ataques: { ...novoBossConfig.ataques, ativo: false, automatico: false },
  movimento: { ...novoBossConfig.movimento, ativo: false },
};
const session = await abrirSessaoNovoBoss(config);
const { page } = session;
const estado = () => page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.supercomputador.snapshot());
async function capturar(nome) {
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2"), c = s.cameras.main;
    c.stopFollow(); c.setZoom(2);
    const tela = s.novoBoss.supercomputador.snapshot().telas[0];
    c.centerOn(tela.x, tela.y); c.preRender();
    s.game.renderer.emit("render", s, c);
  });
  await page.screenshot({ path: `/tmp/boss-monitor-${nome}.png` });
}
try {
  const inicial = await estado();
  assert.equal(inicial.telas.length, 2, "As duas telas completas da arena precisam ser encontradas no Phaser real.");
  assert.deepEqual(inicial.telas.map(t => [t.x, t.y]).sort(), [[-1272, -6168], [-888, -6168]].sort());
  await capturar("01-preparando");
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.events.emit("novo-boss:ataque-iniciado", { encontro: s.novoBoss, tipo: "chuva" });
    s.novoBoss.supercomputador.atualizar(0);
  });
  assert.equal((await estado()).mensagem, "atacando");
  await capturar("02-atacando");
  // Destruir as torres usa os eventos reais que liberam o escudo.
  const semEscudo = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2"), b = s.novoBoss;
    b.sistemaGeradores.atualizar(10000); // Termina a animação de saída das torres antes dos acertos.
    for (const torre of b.geradores) torre.receberDano(10000);
    b.supercomputador.atualizar(0);
    return { mensagem: b.supercomputador.snapshot().mensagem, barreira: b.barreiraAtiva };
  });
  assert.equal(semEscudo.barreira, false);
  assert.equal(semEscudo.mensagem, "capacidadeEsgotada");
  await capturar("03-sem-escudo");
  const fase2 = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2"), b = s.novoBoss;
    const acertou = b.receberDano(600);
    b.supercomputador.atualizar(0);
    return { acertou, fase: b.fase, mensagem: b.supercomputador.snapshot().mensagem };
  });
  assert.equal(fase2.acertou, true); assert.equal(fase2.fase, 2);
  assert.equal(fase2.mensagem, "protocolo");
  await capturar("04-fase2");
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.novoBoss.supercomputador.atualizar(1801);
    s.vida -= 1;
    s.novoBoss.supercomputador.atualizar(0);
  });
  assert.equal((await estado()).mensagem, "acerto");
  await capturar("05-acerto");
  await page.evaluate(() => {
    const b = window.__game.scene.getScene("Level1Parte2").novoBoss;
    b.receberDano(10000); b.supercomputador.atualizar(0);
  });
  assert.equal((await estado()).mensagem, "fim");
  await capturar("06-vitoria");
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").novoBoss.supercomputador.atualizar(2200);
  });
  assert.equal((await estado()).mensagem, "desligando");
  await capturar("07-desligando");
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").novoBoss.supercomputador.atualizar(1800);
  });
  assert.equal((await estado()).mensagem, "apagado");
  assert.deepEqual(session.errors, []);
  assert.deepEqual(session.assetErrors, []);
  console.log("PASS: duas telas no mapa real; ataque, torres, fase 2, acerto, vitória e desligamento reagem à batalha.");
} finally {
  await session.fechar();
}
