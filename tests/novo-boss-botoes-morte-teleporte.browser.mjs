/** Novas artes no Phaser real: cliques, zoom, viagem segura, derrota e limpeza. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const pasta = process.env.NOVO_BOSS_VISUAIS_DIR ?? "/tmp/novo-boss-teleporte-botoes/browser";
await mkdir(pasta, { recursive: true });
const config = { ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, automatico: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const sessao = await abrirSessaoNovoBoss(config, { personagem: "personagem-teste-2" });
const { page, avancar } = sessao;
const snapshot = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("Level1Parte2"), b = s.novoBoss;
  const fx = s.children.list.filter(o => o.active && o.novoBossTeleporteVisual);
  return { estado: b.estado, teleporte: b.teleporte?.etapa ?? null,
    sprite: { chave: b.sprite.texture.key, alpha: b.sprite.alpha, visible: b.sprite.visible,
      flipX: b.sprite.flipX, x: b.sprite.x, y: b.sprite.y, corpo: b.body.enable },
    efeitos: fx.map(o => ({ key: o.texture.key, frame: o.frame.name, visible: o.visible,
      flipX: o.flipX, corpo: Boolean(o.body), x: o.x, y: o.y })),
    arma: s.armaPersonagemTeste?.config.id,
    golpe: s.armaPersonagemTeste?.golpeEspada?.config.id ?? null,
    sucata: s.inventory.getQuantity("sucata"),
    lasers: s.armaPersonagemTeste?.lasers.length,
    derrota: b.apresentacao.snapshot(), morto: b.morto,
  };
});
async function fotografar(nome) {
  const frame = await page.evaluate(() => window.__game.loop.frame);
  await page.waitForFunction(f => window.__game.loop.frame >= f + 2, frame);
  await page.screenshot({ path: pasta + "/" + nome + ".png" });
}
async function clicar(x, y) {
  const ponto = await page.evaluate(({ x, y }) => {
    const game = window.__game, r = game.canvas.getBoundingClientRect();
    return { x: r.left + x / game.scale.width * r.width,
      y: r.top + y / game.scale.height * r.height };
  }, { x, y });
  await page.mouse.click(ponto.x, ponto.y, { delay: 50 });
  await page.waitForTimeout(80);
}
try {
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2"), c = s.cameras.main;
    for (const [zx, zy] of [[1, 1], [0.7, 0.7], [0.8, 1.4]]) {
      c.setZoom(zx, zy);
      s.events.emit("prerender");
      const a = s.botaoAtaque, i = s.botaoColetarItem, w = s.botaoTrocaArma;
      if (a.texture.key !== "personagem-teste-botao-ataque" ||
          i.texture.key !== "personagem-teste-botao-acao" ||
          w.texture.key !== "personagem-teste-botao-troca") throw new Error("Arte incorreta.");
      for (const o of [a, i]) {
        if (Math.abs(o.displayWidth * zx - 92) > 0.01 ||
            Math.abs(o.displayHeight * zy - 92) > 0.01) throw new Error("Ataque/interação diferem de 92 px.");
      }
      if (Math.abs(w.displayWidth * zx - 60) > 0.01) throw new Error("Troca mudou de tamanho.");
    }
    c.setZoom(1);
    s.events.emit("prerender");
  });
  await fotografar("botoes");
  console.log("PASS: três WebPs reais; ataque e interação 92×92 px, troca proporcional 60 px, inclusive zoom por eixo.");

  await sessao.retomar();
  const antesTroca = await snapshot();
  await clicar(730, 260);
  let state = await snapshot();
  assert.notEqual(state.arma, antesTroca.arma);
  assert.equal(state.lasers, 0);
  await clicar(730, 260); // rifle
  await clicar(730, 260); // dourada
  await clicar(730, 260); // espada
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.itensColetaveis.push({ uniqueId: "browser:novo-botao", itemId: "sucata", quantity: 1,
      x: s.player.x, y: s.player.y, range: 64,
      image: s.add.image(s.player.x, s.player.y, "hand_icon") });
    s.atualizarColetaItens();
  });
  const antesColeta = await snapshot();
  await fotografar("interacao");
  await clicar(720, 350);
  state = await snapshot();
  assert.equal(state.sucata, antesColeta.sucata + 1);
  assert.equal(state.golpe, null);
  await clicar(720, 350);
  assert.ok((await snapshot()).golpe);
  console.log("PASS: cliques reais trocam arma, coletam sem atacar e iniciam golpe pelo botão novo.");
  await sessao.pausar();

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
  assert.equal((await snapshot()).sprite.alpha, 0.5);
  await avancar(150);
  assert.equal((await snapshot()).sprite.visible, false);
  assert.ok((await snapshot()).efeitos.every(o => !o.visible));
  console.log("PASS: derrota real usa pose de morte sem alterar escala/direção, mantém física desligada e termina em 900 ms.");

  await sessao.reiniciar({ personagem: "personagem-teste" });
  state = await snapshot();
  assert.equal(state.morto, false);
  assert.equal(state.sprite.chave, "novo-boss-idle");
  assert.equal(state.efeitos.length, 0);
  assert.equal(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").botaoAtaque.texture.key),
    "personagem-teste-botao-ataque");
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
  console.log("PASS: reinício limpa os efeitos, restaura idle e carrega botões também na primeira personagem; zero erros JS/assets.");
} finally {
  await sessao.fechar();
}
