/** Validação dos portais e da camada SpawnRoboBola no mapa/Arcade reais. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const pasta = "/tmp/robo-bola-portais-areas";
mkdirSync(pasta, { recursive: true });
const sessao = await abrirSessaoNovoBoss({ ...novoBossConfig,
  cenaEntrada: { ...novoBossConfig.cenaEntrada, ativo: false },
  ataques: { ...novoBossConfig.ataques, ativo: false },
});
const { page, avancar, posicionar } = sessao;
const relatorio = {};
async function foto(nome) {
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.children.depthSort(); window.__fotoFrame = window.__game.loop.frame;
  });
  await page.waitForFunction(() => window.__game.loop.frame > window.__fotoFrame + 2);
  await page.screenshot({ path: `${pasta}/${nome}.png` });
}
try {
  // O relógio do encontro está pausado para capturar o primeiro instante da saída.
  for (let t = 0; t < 8000; t += 50) {
    const nasceu = await page.evaluate(() => window.__game.scene.getScene("Level1Parte2")
      .inimigos.some(r => r.prologoEncontroId));
    if (nasceu) break;
    await avancar(50);
  }
  relatorio.portais = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { atualizarRoboBola } = await import("/js/enemies/RoboBola.js");
    const { retanguloLivreDoMapa } = await import("/js/enemies/EnemyPathfinding.js");
    const portais = s.children.list.filter(o => /^novo-boss-portal-[12]$/.test(o.name))
      .sort((a, b) => a.x - b.x);
    const robos = s.inimigos.filter(r => r.prologoEncontroId === s.novoBoss.prologo.id);
    const robo = robos[0];
    if (!robo) throw new Error(`Sem robô na abertura: ${JSON.stringify(s.novoBoss.prologo.snapshot())}`);
    const portal = portais.find(p => p.x === robo.x && p.y === robo.y);
    if (!portal) throw new Error("Robô não nasceu no centro do portal");
    const inicio = { x: robo.x, y: robo.y, alpha: robo.alpha };
    let seguro = true;
    const quadros = [];
    for (let i = 0; i < 40; i++) {
      s.time.now += 20;
      atualizarRoboBola(s, s.time.now, 20);
      s.physics.world.bodies.forEach(b => { if (b.enable) b.preUpdate(false, 0.02); });
      s.physics.world.step(0.02); s.physics.world.postUpdate();
      seguro &&= retanguloLivreDoMapa(s, robo.body);
      if ([0, 9, 19, 29, 39].includes(i)) quadros.push({ x: robo.x, y: robo.y,
        alpha: robo.alpha, barra: robo.barraVida.alpha, emergindo: !!robo.emergenciaPortal });
    }
    s.cameras.main.stopFollow().setZoom(0.85).centerOn(-1080, -5800);
    return { portais: portais.map(p => ({ x: p.x, y: p.y, flipX: p.flipX })),
      inicio, quadros, seguro, corpo: { w: robo.body.width, h: robo.body.height },
      lasers: s.lasersInimigo.getChildren().length };
  });
  assert.equal(relatorio.portais.portais[0].flipX, true);
  assert.equal(relatorio.portais.portais[1].flipX, false);
  assert.equal(relatorio.portais.inicio.alpha, 0);
  assert.ok(relatorio.portais.quadros[1].alpha > 0 && relatorio.portais.quadros[1].alpha < 1);
  assert.ok(relatorio.portais.quadros.at(-1).alpha === 1 && !relatorio.portais.quadros.at(-1).emergindo);
  assert.ok(Math.abs(relatorio.portais.quadros.at(-1).x - relatorio.portais.inicio.x) > 35);
  assert.ok(relatorio.portais.seguro);
  assert.equal(relatorio.portais.lasers, 0);
  assert.ok(Math.abs(relatorio.portais.corpo.w - 33.6) < 1e-6);
  await foto("portais-espelhados-saida");

  // Proximidade do primeiro retângulo, ainda do lado de fora.
  await posicionar(-1270, -1300);
  relatorio.gerador = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.luzFabricaAcesa = false;
    s.spawnAreasRoboBola.atualizar(5000);
    const antes = s.spawnAreasRoboBola.snapshot();
    s.acenderLuzFabrica();
    // update real da cena: testa também a integração, não só a função isolada.
    s.update(s.time.now, 16);
    const depois = s.spawnAreasRoboBola.snapshot();
    return { antes, depois, powered: s.luzFabricaAcesa,
      jogador: { x: s.player.x, y: s.player.y },
      robos: s.inimigos.filter(r => r.spawnAreaRoboBolaId).map(r => ({ area: r.spawnAreaRoboBolaId, x: r.x, y: r.y })) };
  });
  assert.ok(relatorio.gerador.antes.every(a => !a.ativada && a.invocados === 0));
  assert.equal(relatorio.gerador.powered, true);
  const primeira = relatorio.gerador.depois.find(a => a.id === 1608);
  assert.equal(primeira.ativada, true);
  assert.equal(primeira.invocados, 1);
  assert.ok(relatorio.gerador.jogador.x < primeira.x, "ativa sem entrar no retângulo");

  // Todas as áreas reais, piso e colisões reais: spawn progressivo, inclusive as
  // menores e as que possuem paredes no centro. Robôs ficam parados neste ensaio.
  relatorio.areas = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { retanguloLivreDoMapa } = await import("/js/enemies/EnemyPathfinding.js");
    const { pontoLivreAreaRoboBola, candidatosAreaRoboBola } = await import("/js/enemies/RoboBolaSpawnAreas.js");
    const resultados = [];
    for (const area of s.spawnAreasRoboBola.snapshot()) {
      // Caminha junto à borda, mantendo-se fora do retângulo.
      s.player.body.reset(area.x - 120, area.y + area.height / 2);
      s.player.body.updateFromGameObject();
      for (let i = 0; i < 20; i++) s.spawnAreasRoboBola.atualizar(450);
      const atual = s.spawnAreasRoboBola.snapshot().find(a => a.id === area.id);
      const robos = s.inimigos.filter(r => r.spawnAreaRoboBolaId === area.id);
      resultados.push({ id: area.id, total: atual.total, invocados: atual.invocados,
        candidatosLivres: candidatosAreaRoboBola(area).filter(p => pontoLivreAreaRoboBola(s, p, s.companionPet.areaMapa)).length,
        robos: robos.map(r => ({ x: r.x, y: r.y, livre: retanguloLivreDoMapa(s, r.body),
          piso: s.companionPet.areaMapa.contem(r.body), dentro: r.body.x >= area.x && r.body.y >= area.y &&
          r.body.right <= area.x + area.width && r.body.bottom <= area.y + area.height })) });
    }
    return resultados;
  });
  console.log("AREAS", JSON.stringify(relatorio.areas.map(a => ({ id: a.id,
    total: a.total, invocados: a.invocados, seguros: a.robos.every(r => r.livre && r.piso && r.dentro) }))));
  assert.equal(relatorio.areas.length, 18);
  for (const area of relatorio.areas) {
    assert.ok(area.invocados > 0, `Área ${area.id} deve ter piso e spawn válido`);
    assert.equal(area.invocados, area.total, `Área ${area.id} deve completar a quantidade prevista`);
    assert.ok(area.invocados <= 7);
    assert.ok(area.robos.every(r => r.livre && r.piso && r.dentro), `Colisão/piso/limites da área ${area.id}`);
  }
  const regiaoCorredor = relatorio.areas.filter(a => [1625, 1629, 1630].includes(a.id));
  assert.equal(regiaoCorredor.reduce((total, a) => total + a.invocados, 0), 7,
    "Os três retângulos próximos de (-1067, -4478) compartilham o limite de sete robôs");
  await posicionar(-1050, -2850);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.cameras.main.stopFollow().setZoom(0.7).centerOn(-1020, -2810);
  });
  // O ensaio anterior valida os locais antes da IA movê-los. Agora o loop real
  // aplica profundidade, flutuação e combate para a inspeção visual da composição.
  await sessao.retomar();
  await page.waitForTimeout(350);
  await sessao.pausar();
  await foto("spawns-ao-redor-colisao");
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
  writeFileSync(`${pasta}/relatorio.json`, JSON.stringify(relatorio, null, 2));
  console.log(`PASSOU: portais, emergência física, gerador e 18 áreas reais. ${pasta}`);
} finally { await sessao.fechar(); }
