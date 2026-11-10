/** Item 8: mira por aviso, alvos fixos, perseguição e cópias no Phaser real. */
import assert from "node:assert/strict";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const config = { ...novoBossConfig,
  ataques: { ...novoBossConfig.ataques, automatico: false },
  fase2: { ...novoBossConfig.fase2, ativo: false },
};
const sessao = await abrirSessaoNovoBoss(config);
const { page, avancar, posicionar } = sessao;
const pontos = [{ x: -1080, y: -5710 }, { x: -1300, y: -5770 },
  { x: -860, y: -5770 }, { x: -1080, y: -5990 }];
const snapshot = () => page.evaluate(() => {
  const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
  const a = scene.hitboxDanoPlayer;
  return { vida: scene.vida, ataque: b.ataqueAtual?.snapshot() ?? null,
    centro: { x: a.centerX, y: a.centerY }, estado: b.estado,
    raios: scene.children.list.filter(o => o.active && o.texture?.key === "novo-boss-heavens-fury")
      .map(o => ({ x: o.x, y: o.y, frame: o.frame.name, escala: o.scaleX })) };
});
async function iniciar() {
  assert.ok(await page.evaluate(() => window.__game.scene.getScene("Level1Parte2").novoBoss.executarAtaque("chuva")));
  await avancar(0);
}
function noCentro(marca, centro) {
  assert.ok(Math.hypot(marca.x - centro.x, marca.y - centro.y) < 0.001,
    `Alvo ${JSON.stringify(marca)} deve mirar ${JSON.stringify(centro)}.`);
}

try {
  await posicionar(pontos[0].x, pontos[0].y);
  await iniciar();
  const s0 = await snapshot();
  noCentro(s0.ataque.marcas[0], s0.centro);
  assert.equal(s0.ataque.marcas[1].x, null);
  await posicionar(pontos[1].x, pontos[1].y);
  await avancar(399);
  assert.equal((await snapshot()).ataque.marcas[1].x, null);
  await avancar(1);
  const s1 = await snapshot();
  noCentro(s1.ataque.marcas[1], s1.centro);
  noCentro(s1.ataque.marcas[0], s0.centro);
  for (let i = 2; i <= 3; i++) {
    await posicionar(pontos[i].x, pontos[i].y);
    await avancar(400);
    const s = await snapshot();
    noCentro(s.ataque.marcas[i], s.centro);
    noCentro(s.ataque.marcas[0], s0.centro);
    noCentro(s.ataque.marcas[1], s1.centro);
  }
  await avancar(200);
  let s = await snapshot();
  assert.equal(s.vida, 100, "Sair do primeiro alvo deve evitar seu impacto.");
  assert.ok(s.raios.some(r => r.frame === 4 && r.x === s0.centro.x && r.y === s0.centro.y && r.escala === 1.28));
  await page.evaluate(() => {
    window.__game.scene.getScene("Level1Parte2").cameras.main
      .stopFollow().setZoom(0.65).centerOn(-1080, -5810);
  });
  await page.screenshot({ path: "/tmp/novo-boss-parte8/chuva-mirada.png" });
  console.log("PASS: novos avisos miram quatro posições atuais; futuros alvos ficam pendentes e os anunciados permanecem fixos até o impacto do PNG.");

  await sessao.reiniciar();
  await posicionar(pontos[0].x, pontos[0].y);
  await iniciar();
  await avancar(1399);
  assert.equal((await snapshot()).vida, 100);
  await avancar(1);
  assert.equal((await snapshot()).vida, 84);
  console.log("PASS: ficar parado no alvo recebe 16 de dano somente após os 1400 ms de aviso.");

  await sessao.reiniciar();
  const limites = await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
    const { criarChuvaRaios } = await import("/js/enemies/novoBoss/ataques/ChuvaRaios.js");
    const { criarServicosAtaques } = await import("/js/enemies/novoBoss/NovoBossServicosAtaques.js");
    const servicos = criarServicosAtaques(scene, b);
    const arena = b.config.arena;
    const entradas = [...b.config.geradores.pontos,
      { x: arena.xMin + 1, y: arena.yMin + 1 },
      { x: arena.xMax - 1, y: arena.entradaY - 1 }];
    return entradas.map(p => {
      const a = criarChuvaRaios({ player: p }, b, b.config.ataques.chuvaRaios,
        { pontoLivre: servicos.pontoLivre });
      const alvo = a.obterAlvoChuva(0), raio = a.snapshot().raio;
      if (!alvo || !servicos.pontoLivre(alvo.x, alvo.y, raio)) throw new Error("Mira sobre parede ou gerador.");
      if (alvo.x - raio < arena.xMin || alvo.x + raio > arena.xMax ||
          alvo.y - raio < arena.yMin || alvo.y + raio > arena.entradaY) throw new Error("Raio fora da arena.");
      let melhorAmostra = Infinity;
      for (let y = arena.yMin + raio + 8; y <= arena.entradaY - raio - 8; y += 64) {
        for (let x = arena.xMin + raio + 8; x <= arena.xMax - raio - 8; x += 64) {
          if (servicos.pontoLivre(x, y, raio)) melhorAmostra = Math.min(melhorAmostra, Math.hypot(x - p.x, y - p.y));
        }
      }
      a.destruir();
      return { distancia: Math.hypot(alvo.x - p.x, alvo.y - p.y), melhorAmostra };
    });
  });
  assert.equal(limites.length, 6);
  assert.ok(limites.every(d => d.distancia <= d.melhorAmostra + 0.001));
  console.log("PASS: quatro geradores e duas bordas desviam a mira para uma região próxima, livre e dentro da arena.");

  await sessao.reiniciar();
  await posicionar(-1400, -5770);
  await iniciar();
  await page.evaluate(async () => {
    const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
    const { retanguloLivreDoMapa } = await import("/js/enemies/EnemyPathfinding.js");
    const corpo = scene.player.body, dx = corpo.x - scene.player.x, dy = corpo.y - scene.player.y;
    for (let x = -1400; x <= -800; x += 4) {
      if (!retanguloLivreDoMapa(scene, { x: x + dx, y: -5770 + dy, width: corpo.width, height: corpo.height })) {
        throw new Error("Caminho da verificação de teclado deve estar livre.");
      }
    }
    scene.speed = 200;
    window.__caminhadaMira = null;
    const alvos = new Map();
    scene.events.on("postupdate", window.__observarCaminhadaMira = () => {
      for (const [i, m] of (b.ataqueAtual?.snapshot().marcas ?? []).entries()) {
        if (m.iniciou) alvos.set(i, { x: m.x, y: m.y });
      }
      if (scene.player.x < -800) return;
      window.__caminhadaMira = { vida: scene.vida, naArena: b.jogadorNaArena,
        alvos: [...alvos.values()], playerX: scene.player.x, tempo: b.tempoAtaque };
      scene.player.setVelocity(0, 0);
      scene.events.off("postupdate", window.__observarCaminhadaMira);
      scene.scene.pause();
    });
  });
  await sessao.retomar();
  await page.keyboard.down("d");
  await page.waitForFunction(() => window.__caminhadaMira !== null, null, { timeout: 12000 });
  await page.keyboard.up("d");
  await sessao.pausar();
  const caminhada = await page.evaluate(() => window.__caminhadaMira);
  assert.equal(caminhada.vida, 100);
  assert.ok(caminhada.naArena);
  assert.ok(caminhada.alvos.length >= 6);
  assert.ok(caminhada.alvos.at(-1).x - caminhada.alvos[0].x > 400);
  assert.ok(caminhada.playerX - caminhada.alvos.at(-1).x < 110);
  console.log(`PASS: caminhada real com D a 200 px/s produziu ${caminhada.alvos.length} avisos acompanhando mais de 400 px do percurso, sem dano ou dash.`);

  for (const grupo of [3, 9]) {
    await sessao.reiniciar();
    await posicionar(-590, -5520);
    assert.ok(await page.evaluate(grupo => {
      const b = window.__game.scene.getScene("Level1Parte2").novoBoss;
      return grupo === 3 ? b.iniciarIlusoes() : b.iniciarClones();
    }, grupo));
    await posicionar(pontos[0].x, pontos[0].y);
    await iniciar();
    const copias = await page.evaluate(async ({ pontos, grupo }) => {
      const scene = window.__game.scene.getScene("Level1Parte2"), b = scene.novoBoss;
      const { atualizarBoss } = await import("/js/enemies/BossPrincipal.js");
      const { atualizarHitboxDanoPlayer } = await import("/js/player/Player.js");
      const anunciados = new Set();
      for (let t = 20; t <= 7900; t += 20) {
        if (t % 400 === 0 && t <= 5600) {
          const p = pontos[(t / 400) % pontos.length];
          scene.player.setPosition(p.x, p.y); scene.player.body.reset(p.x, p.y);
          scene.player.body.updateFromGameObject(); atualizarHitboxDanoPlayer(scene);
        }
        b.sprite.preUpdate(scene.time.now, 20);
        for (const a of b.alvosIlusorios) a.sprite.preUpdate(scene.time.now, 20);
        atualizarBoss(scene, scene.time.now, 20);
        const marcas = b.ataqueAtual?.snapshot().marcas;
        if (!marcas) continue;
        if (b.alvosIlusorios.length !== grupo) throw new Error("Perdeu cópias antes do fim.");
        for (const alvo of b.alvosIlusorios) {
          if (alvo.sprite.frame.name !== b.sprite.frame.name) throw new Error("Quadros diferentes.");
          const c = alvo.ataquesIlusorios.snapshot();
          if (c.tempo !== b.tempoAtaque) throw new Error("Relógios diferentes.");
          for (const [i, m] of c.execucao.marcas.entries()) {
            if (m.x !== marcas[i].x || m.y !== marcas[i].y || m.iniciou !== marcas[i].iniciou) {
              throw new Error("Cópia escolheu outro alvo para a chuva.");
            }
            if (m.iniciou) anunciados.add(i);
          }
        }
      }
      return { avisos: anunciados.size, estado: b.estado };
    }, { pontos, grupo });
    assert.equal(copias.avisos, 15);
    assert.equal(copias.estado, "vulneravel");
    console.log(`PASS: ${grupo} cópias reproduzem os quinze alvos móveis da verdadeira, com avisos, frames e relógios sincronizados.`);
  }

  for (const motivo of ["cancelar", "sair", "morrer", "multiplayer", "reiniciar"]) {
    await sessao.reiniciar();
    await iniciar();
    await avancar(800);
    await page.evaluate(() => {
      const scene = window.__game.scene.getScene("Level1Parte2");
      window.__chuvaMiraAnterior = scene.novoBoss.ataqueAtual;
      window.__visuaisMiraAnteriores = scene.children.list.filter(o => o.active &&
        (o.name === "novo-boss-aviso" || o.texture?.key === "novo-boss-heavens-fury"));
    });
    if (motivo === "reiniciar") await sessao.reiniciar();
    else {
      await page.evaluate(motivo => {
        const scene = window.__game.scene.getScene("Level1Parte2");
        if (motivo === "cancelar") scene.novoBoss.cancelarAtaque();
        if (motivo === "sair") scene.player.setPosition(-1093, -5350);
        if (motivo === "morrer") scene.morteEmAndamento = true;
        if (motivo === "multiplayer") scene.multiplayer = true;
      }, motivo);
      await avancar(9000);
    }
    assert.ok(await page.evaluate(() => {
      const a = window.__chuvaMiraAnterior.snapshot();
      return a.destruida && a.marcas.slice(3).every(m => !m.iniciou) &&
        window.__visuaisMiraAnteriores.every(o => !o.active);
    }));
  }
  console.log("PASS: cinco formas de interrupção limpam os efeitos e impedem seleção/dano de alvos futuros.");
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
  assert.deepEqual(sessao.consoleErrors, []);
} finally { await sessao.fechar(); }
