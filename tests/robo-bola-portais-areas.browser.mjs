import { exigirNascimentoDaArea } from "./factory-wave-assertions.mjs";
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
  await posicionar(-1080, -1140);
  relatorio.gerador = await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.luzFabricaAcesa = false;
    s.spawnAreasRoboBola.atualizar(5000);
    const antes = s.spawnAreasRoboBola.snapshot();
    s.acenderLuzFabrica();
    // update real da cena: testa também a integração, não só a função isolada.
    s.update(s.time.now, 16);
    for (let i = 0; i < 60 && !s.inimigos.some(r => r.spawnAreaRoboBolaId === 1608); i++) {
      s.time.now += 16;
      s.spawnAreasRoboBola.atualizar(16);
    }
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
  assert.ok(relatorio.gerador.jogador.y > primeira.y + primeira.height, "ativa sem entrar no retângulo");

  // Uma onda por ensaio, com os demais nascimentos já contabilizados. Isso reproduz
  // espaço livre e impede que robôs de áreas vizinhas satisfaçam a expectativa.
  relatorio.areas = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { retanguloLivreDoMapa } = await import("/js/enemies/EnemyPathfinding.js");
    const { candidatosAreaRoboBola, criarSpawnAreasRoboBola } = await import("/js/enemies/RoboBolaSpawnAreas.js");
    const { criarAcessoSpawnFabrica } = await import("/js/enemies/FactorySpawnAccess.js");
    const { ampliarAreaNascimento, obterPisoSpawnRobos, retanguloCorpoSpawnRoboBola } =
      await import("/js/enemies/EnemySpawnValidation.js");
    const piso = obterPisoSpawnRobos(s);
    const entrada = { x: 98, y: -1040 };
    const acesso = criarAcessoSpawnFabrica(s, piso);
    const plano = s.spawnAreasRoboBola.snapshot();
    const resultados = [];
    for (const area of [...plano].sort((a, b) => a.trecho - b.trecho)) {
      for (const robo of s.inimigos.filter(r => r.spawnAreaRoboBolaId != null)) robo.destroy();
      s.inimigos = s.inimigos.filter(r => r.active);
      s.inimigoTeste = s.inimigos[0] ?? null;
      const iniciais = s.portasFabrica.filter(p => ["porta01", "porta04"].includes(p.nome));
      if (area.trecho === 2) for (const porta of iniciais.filter(p => p.estado !== "aberta")) {
        porta.aplicarEstadoRede({ estado: "aberta", progresso: 1 });
      }
      const portas = Object.fromEntries(iniciais.map(p => [p.nome, p.estado]));
      for (let i = 0; i < 180 && !acesso.atualizar([entrada]); i++) {}
      const centro = area.id === 1608 ? { x: -1080, y: -1140 } : {
        x: area.x + area.width / 2, y: area.y + area.height / 2,
      };
      const ponto = [centro, ...candidatosAreaRoboBola(area)].find(p => acesso.alcanca(p));
      if (!ponto) {
        resultados.push({ id: area.id, total: area.total, invocados: 0, portas, robos: [],
          pendencia: "sem posição caminhável para o jogador no estágio de acesso" });
        continue;
      }
      s.player.body.reset(ponto.x, ponto.y);
      s.player.body.updateFromGameObject();
      const sistema = criarSpawnAreasRoboBola(s);
      sistema.restaurar(Object.fromEntries(plano.filter(a => a.id !== area.id).map(a => [a.id, a.total])));
      const minimo = area.id === 1608 ? 2 : 1;
      let atual = sistema.snapshot().find(a => a.id === area.id);
      for (let i = 0; i < 360 && atual.invocados < minimo; i++) {
        s.time.now += 16;
        sistema.atualizar(16);
        atual = sistema.snapshot().find(a => a.id === area.id);
      }
      const trabalho = sistema.trabalhoUltimaAtualizacao();
      const faixa = ampliarAreaNascimento(area);
      const robos = s.inimigos.filter(r => r.spawnAreaRoboBolaId === area.id).map(r => {
        const corpo = retanguloCorpoSpawnRoboBola(r, 20, r.body);
        return { area: r.spawnAreaRoboBolaId, nasceuEm: r.spawnProtegidoAte - 700,
          livre: retanguloLivreDoMapa(s, corpo), piso: piso.contem(corpo), acessivel: acesso.alcanca(r.body.center),
          dentro: r.body.center.x >= faixa.x && r.body.center.y >= faixa.y &&
            r.body.center.x <= faixa.x + faixa.width && r.body.center.y <= faixa.y + faixa.height };
      });
      resultados.push({ id: area.id, total: atual.total, invocados: atual.invocados, portas, robos,
        pendencia: !atual.ativada ? "onda não ativada pela posição do jogador" : trabalho.navegacaoPendente
          ? "conectividade ainda em cálculo" : "prazo esgotado à espera de vaga válida" });
      sistema.destruir();
    }
    return resultados;
  });
  assert.equal(relatorio.areas.length, 18);
  assert.equal(relatorio.areas.reduce((soma, a) => soma + a.total, 0), 35);
  for (const area of relatorio.areas) {
    exigirNascimentoDaArea(area, area.id === 1608 ? 2 : 1);
    assert.ok(area.invocados <= area.total && area.total <= 7, `Cota da área ${area.id}`);
    assert.ok(area.robos.every(r => r.livre && r.piso && r.dentro && r.acessivel), `Colisão/piso/limites da área ${area.id}`);
  }
  const [primeiro1608, segundo1608] = relatorio.areas.find(a => a.id === 1608).robos;
  assert.ok(segundo1608.nasceuEm - primeiro1608.nasceuEm >= 450);
  const regiaoCorredor = relatorio.areas.filter(a => [1625, 1629, 1630].includes(a.id));
  assert.equal(regiaoCorredor.reduce((total, a) => total + a.total, 0), 6,
    "Os três retângulos próximos de (-1067, -4478) recebem seis robôs após a redução no segundo trecho");
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
