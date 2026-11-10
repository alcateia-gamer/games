/** Boss principal no Phaser real: viagem segura, derrota e limpeza. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const pasta = process.env.NOVO_BOSS_VISUAIS_DIR ?? "/tmp/novo-boss-teleporte-botoes/browser";
await mkdir(pasta, { recursive: true });
const config = { ...novoBossConfig,
  cenaEntrada: { ...novoBossConfig.cenaEntrada, ativo: false },
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, ativo: false },
  movimento: { ...novoBossConfig.movimento, ativo: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const sessao = await abrirSessaoNovoBoss(config, { personagem: "kai-mercer" });
const { page, avancar } = sessao;
const snapshot = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("Level1Parte2"), b = s.novoBoss;
  const fx = s.children.list.filter(o => o.active && o.novoBossTeleporteVisual);
  return { estado: b.estado, teleporte: b.teleporte?.etapa ?? null,
    sprite: { chave: b.sprite.texture.key, alpha: b.sprite.alpha, visible: b.sprite.visible,
      flipX: b.sprite.flipX, x: b.sprite.x, y: b.sprite.y, corpo: b.sprite.body.enable },
    efeitos: fx.map(o => ({ key: o.texture.key, frame: o.frame.name, visible: o.visible,
      flipX: o.flipX, corpo: Boolean(o.body), x: o.x, y: o.y })),
    sucata: s.inventory.getQuantity("sucata"),
    derrota: b.apresentacao.snapshot(), morto: b.morto,
  };
});
async function fotografar(nome) {
  const frame = await page.evaluate(() => window.__game.loop.frame);
  await page.waitForFunction(f => window.__game.loop.frame >= f + 2, frame);
  await page.screenshot({ path: pasta + "/" + nome + ".png" });
}
let state;
try {
  await sessao.reiniciar({ personagem: "kai-mercer" });
  await avancar(1500);
  const viagem = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { iniciarTeleporteNovoBoss } = await import("/js/enemies/novoBoss/NovoBossTeleporte.js");
    if (!iniciarTeleporteNovoBoss(s, s.novoBoss, "teste-visual")) throw new Error("Sem destino seguro.");
    const origem = { ...s.novoBoss.teleporte.origem }, destino = { ...s.novoBoss.teleporte.destino };
    s.cameras.main.stopFollow().setZoom(0.8).centerOn(origem.x, origem.y - 40);
    return { origem, destino };
  });
  await avancar(0);
  state = await snapshot();
  assert.equal(state.efeitos[0].key, "novo-boss-teleporte-saida");
  assert.equal(state.efeitos[0].frame, 0);
  assert.equal(state.sprite.alpha, 0);
  assert.equal(state.sprite.corpo, false);
  await avancar(125);
  state = await snapshot();
  assert.ok(state.efeitos[0].frame > 0);
  assert.equal(state.efeitos[0].flipX, state.sprite.flipX);
  assert.equal(state.efeitos[0].corpo, false);
  await fotografar("teleporte-saida");
  await avancar(125);
  state = await snapshot();
  assert.equal(state.teleporte, "reaparecendo");
  assert.equal(state.efeitos[0].key, "novo-boss-teleporte-entrada");
  assert.equal(state.sprite.corpo, false);
  assert.deepEqual([state.sprite.x, state.sprite.y], [viagem.destino.x, viagem.destino.y]);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.cameras.main.centerOn(s.novoBoss.sprite.x, s.novoBoss.sprite.y - 40);
  });
  await avancar(125);
  await fotografar("teleporte-entrada");
  await avancar(125);
  state = await snapshot();
  assert.equal(state.teleporte, null);
  assert.equal(state.sprite.alpha, 1);
  assert.equal(state.sprite.corpo, true);
  assert.ok(state.efeitos.every(o => !o.visible));
  console.log("PASS: saída/entrada seguem o relógio real de 250+250 ms, sem corpo duplicado ou física no efeito; destino seguro e espelhamento preservados.");

  await avancar(config.combate.preparacaoMs);
  assert.equal((await snapshot()).estado, "vulneravel");
  assert.ok(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(1000)));
  state = await snapshot();
  assert.equal(state.morto, true);
  assert.equal(state.sprite.chave, "novo-boss-morte");
  assert.equal(state.sprite.corpo, false);
  await avancar(600);
  assert.equal((await snapshot()).sprite.alpha, 1);
  await fotografar("morte");
  await avancar(150);
  assert.equal((await snapshot()).sprite.alpha, 1);
  await avancar(60000);
  assert.equal((await snapshot()).sprite.visible, true);
  assert.equal((await snapshot()).sprite.alpha, 1);
  assert.equal((await snapshot()).sprite.corpo, false);
  assert.ok((await snapshot()).efeitos.every(o => !o.visible));
  console.log("PASS: corpo derrotado permanece visível e opaco após 60 s, com física desligada e ameaças removidas.");

  await sessao.reiniciar({ personagem: "nyx" });
  state = await snapshot();
  assert.equal(state.morto, false);
  assert.equal(state.sprite.chave, "novo-boss-idle");
  assert.equal(state.efeitos.length, 0);
  assert.equal(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").botaoAtaque.radius), 46);
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
  console.log("PASS: reinício limpa os efeitos, restaura idle e preserva os controles de Nyx; zero erros JS/assets.");
} finally {
  await sessao.fechar();
}
