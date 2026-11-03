/** Item 6: espiral central de dez segundos, vãos móveis e clones no Phaser real. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = { ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, automatico: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const centro = novoBossConfig.posicaoInicial;
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar } = sessao;
const snapshot = () => page.evaluate(() => {
  const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
  const rect = a => ({ x: a.x, y: a.y, width: a.width, height: a.height });
  return { x: b.x, y: b.y, estado: b.estado, pendente: b.ataquePendente?.tipo ?? null,
    teleporte: Boolean(b.teleporte), corpo: b.body.enable, tempo: b.tempoAtaque,
    body: rect(b.body), hitbox: rect(b.hitboxDano), vida: scene.vida,
    ataque: b.ataqueAtual?.snapshot() ?? null, lasers: b.projeteisBoss.length,
    avisos: scene.children.list.filter(o => o.active && o.name === "novo-boss-aviso").length };
});
async function moverBoss(ponto) {
  await page.evaluate(async ponto => {
    const b = window.__game.scene.getScene("Level1Parte2").novoBoss;
    const { sincronizarCorpoNovoBoss } = await import("/js/enemies/novoBoss/NovoBossTeleporte.js");
    b.cancelarAtaque();
    sincronizarCorpoNovoBoss(b, ponto);
  }, ponto);
  await avancar(0);
}
async function iniciar() {
  assert.ok(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.executarAtaque("lasers")));
  await avancar(0);
}

try {
  for (const origem of config.teleporte.pontos) {
    await moverBoss(origem);
    await iniciar();
    if (origem.id !== "centro") {
      assert.equal((await snapshot()).pendente, "lasers");
      await avancar(499);
      const s = await snapshot();
      assert.equal(s.ataque, null);
      assert.equal(s.avisos, 0);
      assert.equal(s.lasers, 0);
      assert.equal(s.corpo, false);
      await avancar(1);
    }
    const s = await snapshot();
    assert.deepEqual({ x: s.x, y: s.y }, centro);
    assert.equal(s.tempo, 0);
    assert.equal(s.avisos, 1);
    assert.equal(s.ataque.emitidos, 0);
    assert.equal(s.corpo, true);
    for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(s.body[key] - s.hitbox[key]) < 0.001);
  }
  console.log("PASS: quatro origens chegam ao centro antes do aviso e dos disparos, com corpo e hitbox alinhados.");

  await posicionar(-680, -5770);
  await moverBoss(centro);
  await iniciar();
  await avancar(699);
  assert.equal((await snapshot()).ataque.emitidos, 0);
  await avancar(1);
  assert.equal((await snapshot()).ataque.emitidos, 1);
  await avancar(9999);
  let s = await snapshot();
  assert.equal(s.ataque.emitidos, 100);
  assert.equal(s.ataque.emitindo, true);
  await avancar(1);
  s = await snapshot();
  assert.equal(s.ataque.emitidos, 100);
  assert.equal(s.ataque.emitindo, false);
  assert.equal(s.estado, "atacando", "Projéteis restantes ainda são perigosos.");
  for (let i = 0; (await snapshot()).ataque && i < 250; i++) await avancar(20);
  s = await snapshot();
  assert.equal(s.ataque, null);
  assert.equal(s.lasers, 0);
  assert.equal(s.estado, "vulneravel");
  assert.equal(s.teleporte, false, "A espiral longa não deve consumir a abertura com teleporte preventivo.");
  assert.ok(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(25)));
  console.log("PASS: aviso de 700 ms, cem disparos em dez segundos, cauda sem novos tiros e abertura que aceita dano real.");

  // Testa o vão após travar o ângulo inicial. A primeira volta não deve acertar;
  // a seguinte ocupa esse mesmo corredor. Timers reais liberam a invulnerabilidade.
  await sessao.reiniciar();
  await posicionar(centro.x, centro.y + 250);
  await iniciar();
  await avancar(700);
  const alvo = await page.evaluate(centro => {
    const scene = window.__game.scene.getScene("Level1Parte2"), p = scene.novoBoss.ataqueAtual.snapshot().projeteis[0];
    const angulo = Math.atan2(p.dy, p.dx) + 11.25 * Math.PI / 180;
    const a = scene.hitboxDanoPlayer;
    return { x: centro.x + Math.cos(angulo) * 250 - (a.centerX - scene.player.x),
      y: centro.y + Math.sin(angulo) * 250 - (a.centerY - scene.player.y) };
  }, centro);
  await posicionar(alvo.x, alvo.y);
  const parado = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2"), boss = scene.novoBoss;
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    const { retanguloLivreDoMapa } = await import("/js/enemies/EnemyPathfinding.js");
    if (!retanguloLivreDoMapa(scene, scene.player.body)) throw new Error("Jogador sobre uma parede.");
    const ponto = { x: scene.player.x, y: scene.player.y };
    let vidaPrimeiraVolta;
    for (let t = 720; t <= 5100; t += 20) {
      scene.time.preUpdate();
      scene.time.update(scene.time.now + 20, 20);
      atualizarNovoBoss(scene, scene.time.now, 20);
      if (t === 3500) vidaPrimeiraVolta = scene.vida;
      if (scene.player.x !== ponto.x || scene.player.y !== ponto.y) throw new Error("Jogador se moveu no teste parado.");
    }
    return { vidaPrimeiraVolta, vida: scene.vida, emitidos: boss.ataqueAtual.snapshot().emitidos };
  });
  assert.equal(parado.vidaPrimeiraVolta, 100);
  assert.ok(parado.vida < 100);
  console.log(`PASS: no mapa real, ficar parado no vão inicial evita a primeira volta e é atingido pela seguinte (vida ${parado.vida}).`);

  await sessao.reiniciar();
  await moverBoss(config.teleporte.pontos[1]);
  await iniciar();
  await avancar(300);
  await posicionar(centro.x, centro.y);
  await avancar(1000);
  s = await snapshot();
  assert.equal(s.ataque, null);
  assert.equal(s.pendente, null);
  assert.equal(s.teleporte, false);
  assert.equal(s.lasers, 0);
  assert.equal(s.corpo, true);
  console.log("PASS: centro ocupado durante chegada cancela a espiral e recupera uma posição segura sem disparo fora do centro.");

  await sessao.reiniciar({ novoBossConfig: { ...config, fase2: novoBossConfig.fase2 } });
  assert.ok(await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2"), boss = scene.novoBoss;
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    for (let i = 0; boss.estado !== "vulneravel" && i < 500; i++) atualizarNovoBoss(scene, scene.time.now, 20);
    if (!boss.receberDano(501)) return false;
    for (let i = 0; !boss.sistemaClones.ativo && i < 500; i++) atualizarNovoBoss(scene, scene.time.now, 20);
    return boss.fase === 2 && boss.sistemaClones.ativo;
  }));
  await posicionar(-680, -5770);
  await iniciar();
  if ((await snapshot()).pendente) await avancar(500);
  const clones = await page.evaluate(async centro => {
    const scene = window.__game.scene.getScene("Level1Parte2"), boss = scene.novoBoss;
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    const maxEmissoes = new Map();
    const posicoes = boss.alvosIlusorios.map(a => ({ x: a.x, y: a.y }));
    let moveu = false, duracao = 0;
    while (boss.ataqueAtual && duracao < 20000) {
      if (Math.hypot(boss.x - centro.x, boss.y - centro.y) > 0.001) throw new Error("Espiral saiu do centro.");
      if (boss.alvosIlusorios.length !== 9) throw new Error("Clones acabaram antes da espiral.");
      boss.sprite.preUpdate(scene.time.now, 20);
      for (const a of boss.alvosIlusorios) a.sprite.preUpdate(scene.time.now, 20);
      scene.time.preUpdate();
      scene.time.update(scene.time.now + 20, 20);
      atualizarNovoBoss(scene, scene.time.now, 20);
      for (const [i, a] of boss.alvosIlusorios.entries()) {
        const copia = a.ataquesIlusorios.snapshot();
        if (a.sprite.frame.name !== boss.sprite.frame.name) throw new Error("Animação dessincronizada.");
        if (copia.execucao) {
          if (copia.tempo !== boss.tempoAtaque) throw new Error("Relógios diferentes.");
          maxEmissoes.set(a.id, Math.max(maxEmissoes.get(a.id) ?? 0, copia.execucao.emitidos));
        }
        moveu ||= Math.hypot(a.x - posicoes[i].x, a.y - posicoes[i].y) > 1;
      }
      duracao += 20;
    }
    if (boss.ataqueAtual) throw new Error("Espiral não terminou.");
    return { emissoes: [...maxEmissoes.values()], moveu, duracao, estado: boss.estado,
      verdadeiraMoveu: Math.hypot(boss.x - centro.x, boss.y - centro.y) > 0.001 };
  }, centro);
  assert.equal(clones.emissoes.length, 9);
  assert.ok(clones.emissoes.every(n => n === 100));
  assert.ok(clones.moveu);
  assert.ok(clones.verdadeiraMoveu, "Ao terminar, a verdadeira retoma o movimento normal.");
  assert.equal(clones.estado, "vulneravel");
  console.log(`PASS: fase 2 real, verdadeira central durante ${clones.duracao} ms, nove clones móveis com cem tiros e frames sincronizados, movimento retomado na abertura.`);

  await sessao.reiniciar();
  await posicionar(-680, -5770);
  await iniciar();
  await avancar(4500);
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.cameras.main.stopFollow().setZoom(0.65).centerOn(-1080, -5810);
  });
  await page.screenshot({ path: "/tmp/novo-boss-parte6/espiral-central.png" });
  await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.cancelarAtaque());
  await avancar(12000);
  assert.equal((await snapshot()).lasers, 0);
  assert.equal((await snapshot()).ataque, null);
  console.log("PASS: cancelar durante os disparos remove os projéteis e impede emissões tardias.");
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
  assert.deepEqual(sessao.consoleErrors, []);
} finally { await sessao.fechar(); }
