/** Objetos persistentes coexistem com ataques; somente o escudo impede dano. */
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = { ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, automatico: false },
  teleporte: { ...novoBossConfig.teleporte, preventivoMs: 600000 },
  fase2: { ...novoBossConfig.fase2, movimento: { ...novoBossConfig.fase2.movimento, ativo: false } },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar } = sessao;
const ler = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("Level1Parte2"), b = s.novoBoss;
  return { estado: b.estado, vida: b.vida, fase: b.fase, escudo: b.barreiraAtiva,
    ataque: b.ataqueAtual?.snapshot() ?? null, tentaculos: b.tentaculosAtivos?.snapshot() ?? null,
    captura: s.restricaoControleNovoBoss?.apertosNecessarios ?? null,
    protegido: b.invulneravelClonesAte, clones: b.sistemaClones.ativo,
    efeitos: s.children.list.filter(o => o.active && o.novoBossTentaculoVisual).length };
});
const acertar = () => page.evaluate(async () => {
  const s = window.__game.scene.getScene("Level1Parte2");
  const { causarDanoAlvoAdicional } = await import("/js/combat/CombatTargets.js");
  return causarDanoAlvoAdicional(s, s.novoBoss, 25, { ...s.novoBoss.hitboxDano });
});
try {
  assert.equal(await acertar(), false);
  assert.equal((await ler()).vida, 1000);
  const geradores = await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.geradores.map(g => ({ id: g.id, x: g.x, y: g.y })));
  for (const g of geradores) {
    await posicionar(g.x, g.y - 26);
    assert.equal(await page.evaluate(id => window.__game.scene.getScene("Level1Parte2").novoBoss.sistemaGeradores.interagir(id), g.id), true);
  }
  assert.equal((await ler()).escudo, false);
  assert.equal(await acertar(), true, "Preparação aceita dano sem escudo.");
  await posicionar(-650, -5550);
  await page.evaluate(() => {
    const b = window.__game.scene.getScene("Level1Parte2").novoBoss;
    b.rng = () => 0.4;
    b.config.ataques.automatico = true;
    b.config.ataques.sequencia = ["tentaculos", "chuva"];
    b.tempoEstado = b.config.combate.preparacaoMs;
    b.indiceAtaque = 0;
  });
  await avancar(0);
  let s = await ler();
  assert.equal(s.tentaculos.armadilhas.length, 5);
  assert.equal(s.ataque.tipo, "chuvaRaios");
  assert.equal(s.tentaculos.decorrido, 0);
  assert.equal(await acertar(), true, "Ataque em curso aceita dano.");
  await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").novoBoss.config.ataques.automatico = false; });
  const alvo = s.tentaculos.armadilhas[0];
  await posicionar(alvo.x, alvo.y - 26);
  await avancar(1000); s = await ler();
  assert.equal(s.captura, 8);
  assert.equal(s.ataque.tipo, "chuvaRaios");
  assert.equal(s.ataque.tempo, 1000);
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    for (let i = 0; i < 8; i++) {
      const p = { id: 99, isDown: true, leftButtonDown: () => true };
      scene.input.emit("pointerdown", p, []); scene.input.emit("pointerup", p);
    }
  });
  await avancar(1); s = await ler();
  assert.equal(s.captura, null);
  assert.equal(s.ataque.tipo, "chuvaRaios");
  assert.ok(s.tentaculos.armadilhas.some(a => a.ativa));
  console.log("PASS: cinco tentáculos e chuva simultâneos, oito apertos libertam sem interromper o ataque.");

  await posicionar(-650, -5550);
  await page.evaluate(() => {
    const b = window.__game.scene.getScene("Level1Parte2").novoBoss;
    b.cancelarAtaque({ preservarTentaculos: true });
    if (!b.executarAtaque("pulso")) throw Error("Pulso bloqueado pelas armadilhas.");
  });
  await avancar(1000);
  assert.equal(await acertar(), true, "Pulso aceita dano durante o aviso.");
  await avancar(950);
  s = await ler();
  assert.equal(s.ataque, null);
  assert.ok(s.tentaculos && s.efeitos > 0);
  await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
    const { iniciarTeleporteNovoBoss } = await import("/js/enemies/novoBoss/NovoBossTeleporte.js");
    if (!iniciarTeleporteNovoBoss(scene, b, "validacao")) throw Error("Teleporte recusado.");
    b.estado = "teletransportando";
  });
  await avancar(100);
  assert.equal(await acertar(), true, "Teleporte mantém alvo apesar do corpo Arcade desligado.");
  await avancar(400);
  assert.ok((await ler()).tentaculos);
  await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(500); });
  await avancar(1500);
  s = await ler();
  assert.equal(s.fase, 2); assert.equal(s.clones, true); assert.equal(s.protegido, 0);
  assert.equal(await acertar(), true, "Clonar não concede invulnerabilidade.");
  assert.ok(s.tentaculos, "A transição mantém os tentáculos existentes.");
  assert.ok(!await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.hud.textoEstado.text.includes("PROTEGIDA")));
  console.log("PASS: escudo bloqueia dano; preparação, ataque, teleporte e clonagem aceitam golpes sem escudo.");

  await mkdir("/tmp/boss-tentaculos-arena", { recursive: true });
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.cameras.main.stopFollow().setZoom(0.8).centerOn(-1080, -5810);
    window.__quadroTentaculosArena = window.__game.loop.frame;
  });
  await page.waitForFunction(() => window.__game.loop.frame > window.__quadroTentaculosArena + 2);
  await page.screenshot({ path: "/tmp/boss-tentaculos-arena/combate.png" });
  await posicionar(-650, -5550);
  await avancar(19000 - s.tentaculos.decorrido - 1);
  assert.ok((await ler()).tentaculos);
  await avancar(1); assert.equal((await ler()).tentaculos, null);
  console.log("PASS: duração de 18 segundos após surgir, sem ondas acumuladas.");

  await page.evaluate(() => {
    const b = window.__game.scene.getScene("Level1Parte2").novoBoss;
    b.cancelarAtaque();
    if (!b.executarAtaque("tentaculos")) throw Error("Não invocou após expirar.");
  });
  await posicionar(-1093, -5350); await avancar(0);
  s = await ler(); assert.equal(s.tentaculos, null); assert.equal(s.efeitos, 0); assert.equal(s.captura, null);
  assert.deepEqual(sessao.errors, []); assert.deepEqual(sessao.assetErrors, []); assert.deepEqual(sessao.consoleErrors, []);
  console.log("PASS: saída limpa as armadilhas e a captura, sem erros JavaScript, de assets ou console.");
} catch (error) { console.error("Estado:", await ler().catch(() => null)); throw error; }
finally { await sessao.fechar(); }
