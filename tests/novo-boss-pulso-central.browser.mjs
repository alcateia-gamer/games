/** Item 5: pulso ampliado no centro, fuga real e segunda fase no Phaser. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = { ...novoBossConfig,
  geradores: { ...novoBossConfig.geradores, ativo: false },
  ataques: { ...novoBossConfig.ataques, automatico: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar } = sessao;
const pontoCentral = novoBossConfig.teleporte.pontos.find(p => p.id === "centro");
const centro = { x: pontoCentral.x, y: pontoCentral.y };
const snapshot = () => page.evaluate(() => {
  const scene = window.__game.scene.getScene("Level1Parte2"), boss = scene.novoBoss;
  const rect = a => ({ x: a.x, y: a.y, width: a.width, height: a.height });
  return { x: boss.x, y: boss.y, estado: boss.estado, pendente: boss.ataquePendente?.tipo ?? null,
    tempo: boss.tempoAtaque, teleporte: Boolean(boss.teleporte), alpha: boss.sprite.alpha,
    corpoAtivo: boss.body.enable, body: rect(boss.body), hitbox: rect(boss.hitboxDano),
    jogadorNaArena: boss.jogadorNaArena, vida: scene.vida, fase: boss.fase,
    ataque: boss.ataqueAtual?.snapshot() ?? null,
    falsos: boss.alvosIlusorios.filter(a => a.active).map(a => ({
      x: a.x, y: a.y, frame: a.sprite.frame.name, ataque: a.ataquesIlusorios.snapshot() })),
    frame: boss.sprite.frame.name,
    explosao: scene.children.list.filter(o => o.active && o.name === "novo-boss-explosao")
      .map(o => ({ x: o.x, y: o.y, escala: o.scaleX, frame: o.frame.name })),
    avisos: scene.children.list.filter(o => o.active && o.name === "novo-boss-aviso").length };
});
async function moverBoss(ponto) {
  await page.evaluate(async ponto => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { sincronizarCorpoNovoBoss } = await import("/js/enemies/novoBoss/NovoBossTeleporte.js");
    scene.novoBoss.cancelarAtaque();
    sincronizarCorpoNovoBoss(scene.novoBoss, ponto);
  }, ponto);
  await avancar(0);
}
async function iniciar() {
  assert.ok(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.executarAtaque("pulso")));
  await avancar(0);
}

try {
  for (const origem of config.teleporte.pontos) {
    await moverBoss(origem);
    await iniciar();
    if (origem.id !== "centro") {
      let s = await snapshot();
      assert.equal(s.pendente, "pulso");
      assert.equal(s.ataque, null);
      assert.equal(s.avisos, 0);
      await avancar(499);
      s = await snapshot();
      assert.equal(s.ataque, null);
      assert.equal(s.corpoAtivo, false);
      await avancar(1);
    }
    const s = await snapshot();
    assert.deepEqual({ x: s.x, y: s.y }, { x: centro.x, y: centro.y });
    assert.equal(s.estado, "atacando");
    assert.equal(s.tempo, 0);
    assert.equal(s.avisos, 1);
    assert.equal(s.corpoAtivo, true);
    for (const key of ["x", "y", "width", "height"]) assert.ok(Math.abs(s.body[key] - s.hitbox[key]) < 0.001);
  }
  console.log("PASS: os quatro pontos iniciam o pulso no centro; aviso e ataque aguardam a chegada e mantêm corpo e hitbox alinhados.");

  await moverBoss(centro);
  const ponto270 = await page.evaluate(centro => {
    const scene = window.__game.scene.getScene("Level1Parte2"), a = scene.hitboxDanoPlayer;
    return { x: centro.x + 270 - (a.centerX - scene.player.x),
      y: centro.y - (a.centerY - scene.player.y) };
  }, centro);
  await posicionar(ponto270.x, ponto270.y);
  const hp = (await snapshot()).vida;
  await iniciar();
  await avancar(1499);
  assert.equal((await snapshot()).vida, hp);
  assert.equal((await snapshot()).explosao.length, 0);
  await avancar(1);
  let s = await snapshot();
  assert.equal(s.explosao[0].frame, 0);
  assert.ok(Math.abs(s.explosao[0].escala * 576 - 620) < 0.001);
  assert.deepEqual({ x: s.explosao[0].x, y: s.explosao[0].y }, centro);
  await avancar(450);
  s = await snapshot();
  assert.equal(s.vida, hp - 14, "A expansão deve atingir a 270 px, além do antigo raio de 145.");
  assert.equal(s.estado, "vulneravel");
  await avancar(700);
  assert.equal((await snapshot()).vida, hp - 14);
  console.log("PASS: GIF tem diâmetro 620, aviso de 1500 ms e um único impacto real a 270 px; a abertura normal continua funcionando.");

  await sessao.reiniciar();
  const fuga = await page.evaluate(async centro => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    const { retanguloLivreDoMapa } = await import("/js/enemies/EnemyPathfinding.js");
    const dano = scene.hitboxDanoPlayer, corpo = scene.player.body;
    const dx = dano.centerX - scene.player.x, dy = dano.centerY - scene.player.y;
    const fisX = corpo.x - scene.player.x, fisY = corpo.y - scene.player.y;
    const opcoes = [[1, 0, ["d"]], [-1, 0, ["a"]], [1, 1, ["d", "s"]],
      [-1, 1, ["a", "s"]], [1, -1, ["d", "w"]], [-1, -1, ["a", "w"]], [0, 1, ["s"]], [0, -1, ["w"]]];
    for (const [vx, vy, teclas] of opcoes) {
      const n = Math.hypot(vx, vy), ux = vx / n, uy = vy / n;
      const fim = 310 + Math.abs(ux) * dano.width / 2 + Math.abs(uy) * dano.height / 2 + 8;
      let livre = true;
      for (let d = 100; d <= fim; d += 4) {
        const x = centro.x + ux * d - dx, y = centro.y + uy * d - dy;
        const arena = scene.novoBoss.config.arena;
        if (x < arena.xMin || x > arena.xMax || y < arena.yMin || y > arena.entradaY ||
            !retanguloLivreDoMapa(scene, { x: x + fisX, y: y + fisY, width: corpo.width, height: corpo.height })) {
          livre = false; break;
        }
      }
      if (livre) return { x: centro.x + ux * 100 - dx, y: centro.y + uy * 100 - dy, teclas };
    }
    throw new Error("Não encontrou caminho livre para testar a fuga andando.");
  }, centro);
  await posicionar(fuga.x, fuga.y);
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.speed = 200; // Fuga com caminhada conservadora; não usa dash ou turbo.
    window.__fugaPulso = null;
    scene.events.on("postupdate", window.__observarFugaPulso = () => {
      const boss = scene.novoBoss, a = scene.hitboxDanoPlayer;
      const x = Math.max(a.x, Math.min(boss.x, a.right));
      const y = Math.max(a.y, Math.min(boss.y, a.bottom));
      if (Math.hypot(x - boss.x, y - boss.y) <= 312) return;
      window.__fugaPulso = { tempo: boss.tempoAtaque, vida: scene.vida, naArena: boss.jogadorNaArena };
      scene.player.setVelocity(0, 0);
      scene.events.off("postupdate", window.__observarFugaPulso);
      scene.scene.pause();
    });
  });
  await iniciar();
  await sessao.retomar();
  for (const tecla of fuga.teclas) await page.keyboard.down(tecla);
  await page.waitForFunction(() => window.__fugaPulso !== null, null, { timeout: 6000 });
  for (const tecla of fuga.teclas) await page.keyboard.up(tecla);
  await sessao.pausar();
  const fugiu = await page.evaluate(() => window.__fugaPulso);
  assert.equal(fugiu.vida, 100);
  assert.equal(fugiu.naArena, true);
  assert.ok(fugiu.tempo < 1950);
  await avancar(1950 - fugiu.tempo + 100);
  assert.equal((await snapshot()).vida, 100);
  assert.equal((await snapshot()).estado, "vulneravel");
  console.log(`PASS: teclas reais permitem escapar andando a 200 px/s, sem dash, dano ou saída da arena (${fugiu.tempo} ms).`);

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
  assert.equal(s.explosao.length, 0);
  assert.equal(s.corpoAtivo, true);
  console.log("PASS: ocupar o centro durante o reaparecimento recupera uma posição segura e cancela o pulso, sem explosão em outro ponto.");

  await sessao.reiniciar({ novoBossConfig: { ...config, fase2: novoBossConfig.fase2 } });
  assert.ok(await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2"), boss = scene.novoBoss;
    const { atualizarBoss } = await import("/js/enemies/BossPrincipal.js");
    for (let i = 0; boss.estado !== "vulneravel" && i < 500; i++) atualizarBoss(scene, scene.time.now, 20);
    if (!boss.receberDano(501)) return false;
    for (let i = 0; !boss.sistemaClones.ativo && i < 500; i++) atualizarBoss(scene, scene.time.now, 20);
    return boss.fase === 2 && boss.sistemaClones.ativo;
  }));
  await posicionar(-680, -5770);
  await iniciar();
  if ((await snapshot()).pendente) await avancar(500);
  for (let i = 0; i < 95; i++) {
    s = await snapshot();
    assert.deepEqual({ x: s.x, y: s.y }, centro);
    assert.equal(s.falsos.length, 9);
    assert.ok(s.falsos.every(a => a.frame === s.frame && a.ataque.ativo));
    await avancar(20);
  }
  await page.evaluate(() => {
    const scene = window.__game.scene.getScene("Level1Parte2");
    scene.cameras.main.stopFollow().setZoom(0.65).centerOn(-1080, -5810);
  });
  await page.screenshot({ path: "/tmp/novo-boss-pulso-central.png" });
  await avancar(70);
  s = await snapshot();
  assert.equal(s.estado, "vulneravel");
  assert.ok(Math.hypot(s.x - centro.x, s.y - centro.y) > 1);
  console.log("PASS: segunda fase mantém a verdadeira no centro durante o pulso, com nove ataques ilusórios sincronizados; o movimento retoma na abertura.");
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
  assert.deepEqual(sessao.consoleErrors, []);
} finally { await sessao.fechar(); }
