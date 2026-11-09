import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const pasta = process.env.ARTIFACT_DIR ?? "/tmp/novo-boss-prologo";
mkdirSync(pasta, { recursive: true });
const sessao = await abrirSessaoNovoBoss({ ...novoBossConfig,
  cenaEntrada: { ...novoBossConfig.cenaEntrada, ativo: false },
});
const { page, avancar, posicionar } = sessao;
page.on("pageerror", error => console.error(error.stack));
async function previa(nome) {
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    s.cameras.main.stopFollow().setZoom(0.85).centerOn(-1080, -5780);
    window.__framePreviaPrologo = window.__game.loop.frame;
  });
  await page.waitForFunction(() => window.__game.loop.frame > window.__framePreviaPrologo + 2);
  await page.screenshot({ path: `${pasta}/${nome}.png` });
}
const snapshot = () => page.evaluate(() => {
  const s = window.__game.scene.getScene("Level1Parte2"), e = s.novoBoss;
  return { ...e.prologo.snapshot(), vida: e.vida, fase: e.fase,
    barreira: e.barreiraAtiva, fisica: e.sistemaGeradores.corpoBarreira.enable,
    torres: e.geradores.map(g => ({ id: g.id, vida: g.vida, estado: g.estadoGerador,
      alvo: g.active, body: g.body.enable, colisoes: g.colisaoMapa.corpos.map(b => b.enable) })),
    clones: e.sistemaClones.alvos.length, teleporte: Boolean(e.teleporte),
  };
});
async function ate(estado, limite = 15000) {
  for (let t = 0; t < limite; t += 100) {
    const p = await snapshot();
    if (p.estado === estado) return p;
    await avancar(100);
  }
  throw new Error(`Estado ${estado} não alcançado: ${JSON.stringify(await snapshot())}`);
}
async function matarVivos() {
  return page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { causarDanoInimigo } = await import("/js/enemies/EnemyHealth.js");
    const alvos = s.inimigos.filter(r => r.prologoEncontroId === s.novoBoss.prologo.id && !r.morto);
    alvos.forEach(r => causarDanoInimigo(s, r, r.vida + 1));
    return alvos.length;
  });
}
async function avancarOnda(ms) {
  await page.evaluate(async ms => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const { atualizarNovoBoss } = await import("/js/enemies/novoBoss/NovoBoss.js");
    const { atualizarRoboBola } = await import("/js/enemies/RoboBola.js");
    const devAnterior = s.developerMode;
    // Este ensaio mede estados/limites das ondas. Mantém o jogador vivo enquanto
    // executa a saída do portal, a IA e a física reais, em vez de congelar robôs
    // sobre o centro do invocador e impedir sua próxima invocação.
    s.developerMode = true;
    try {
      for (let restante = ms; restante > 0;) {
        const dt = Math.min(20, restante); restante -= dt; s.time.now += dt;
        atualizarNovoBoss(s, s.time.now, dt);
        atualizarRoboBola(s, s.time.now, dt);
        s.physics.world.bodies.forEach(b => { if (b.enable) b.preUpdate(false, dt / 1000); });
        s.physics.world.step(dt / 1000); s.physics.world.postUpdate();
        s.events.emit("postupdate", s.time.now, dt);
      }
    } finally { s.developerMode = devAnterior; }
  }, ms);
}
async function atravessarBase() {
  const r = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2");
    const b = s.novoBoss.geradores[0].colisaoMapa.corpos[0];
    const x = b.x - 40, y = b.y + b.height / 2 - 3;
    s.player.body.reset(x, y); s.player.body.updateFromGameObject();
    s.player.setVelocity(200, 0);
    for (let i = 0; i < 60; i++) {
      s.time.now += 1000 / 60;
      s.physics.world.update(s.time.now, 1000 / 60);
      s.events.emit("postupdate", s.time.now, 1000 / 60);
    }
    const distancia = s.player.x - x;
    s.player.setVelocity(0, 0);
    return distancia;
  });
  await posicionar(-1093, -5520);
  return r;
}
const relatorio = { ciclos: [], verificacoes: [] };
function verificar(nome, valor) { assert.ok(valor, nome); relatorio.verificacoes.push(nome); }
try {
  let p = await snapshot();
  verificar("inicia protegido com quatro torres", p.barreira && p.vida === 1000 && p.torres.length === 4);
  await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2");
    window.__spawnsPrologo = [];
    s.events.on("novo-boss:prologo-robo", ({ robo, ciclo }) => window.__spawnsPrologo.push({
      ciclo, x: robo.x, y: robo.y, portal: robo.prologoPortal,
      encontro: robo.prologoEncontroId, onda: robo.prologoOndaId,
      grace: robo.prologoProtegidoAte - s.time.now,
    }));
    window.__outrasColisoes = s.collisionGroup.getChildren().filter(c =>
      !s.novoBoss.geradores.some(g => g.colisaoMapa.corpos.includes(c.body)))
      .map(c => ({ c, enable: c.body.enable }));
    window.__laserNormal = s.add.circle(-1100, -5580, 2, 0xffffff);
    s.lasersInimigo ??= s.physics.add.group();
    s.lasersInimigo.add(window.__laserNormal);
  });
  let parAnterior = null;
  for (let ciclo = 1; ciclo <= 4; ciclo++) {
    await ate("ONDA_ROBOS");
    p = await snapshot();
    verificar(`ciclo ${ciclo}: torres subterrâneas sem hitbox ou colisão`,
      p.torres.filter(g => g.vida > 0).every(g => g.estado === "subterraneo" && !g.alvo && !g.body &&
        g.colisoes.length === 1 && g.colisoes.every(v => !v)));
    verificar(`ciclo ${ciclo}: exatamente dois portais`, p.portais.length === 2);
    const par = JSON.stringify(p.portais);
    if (parAnterior) verificar(`ciclo ${ciclo}: alterna o par de portais`, par !== parAnterior);
    parAnterior = par;
    verificar(`ciclo ${ciclo}: posições seguras`, await page.evaluate(async () => {
      const s = window.__game.scene.getScene("Level1Parte2");
      const { pontoSeguroPortal } = await import("/js/enemies/novoBoss/NovoBossPortais.js");
      return s.novoBoss.prologo.snapshot().portais.every(p => pontoSeguroPortal(s, s.novoBoss, p));
    }));
    if (ciclo === 1) {
      verificar("Arcade permite atravessar base subterrânea", await atravessarBase() > 150);
      await previa("01-portais");
    }
    await avancarOnda(5500);
    p = await snapshot();
    verificar(`ciclo ${ciclo}: spawn progressivo com limite`, p.invocados > 0 &&
      p.invocados < p.total && p.vivos === p.simultaneos);
    verificar(`ciclo ${ciclo}: padrão exclusivo, fase e teleporte bloqueados`,
      p.padrao && p.fase === 1 && !p.teleporte && p.clones === 0);
    if (ciclo === 1) {
      await page.evaluate(() => {
        const s = window.__game.scene.getScene("Level1Parte2");
        s.inimigos.find(r => r.prologoEncontroId === s.novoBoss.prologo.id).setVisible(false);
      });
      await avancar(300);
      verificar("invisibilidade não conta como morte", (await snapshot()).mortos === 0);
      await page.evaluate(() => {
        const s = window.__game.scene.getScene("Level1Parte2");
        s.inimigos.filter(r => r.prologoEncontroId).forEach(r => r.setVisible(true));
      });
    }
    let eliminados = 0, maximo = 0;
    for (let t = 0; t < 25000; t += 250) {
      p = await snapshot(); maximo = Math.max(maximo, p.vivos);
      assert.ok(p.vivos <= p.simultaneos);
      if (p.estado !== "ONDA_ROBOS") break;
      eliminados += await matarVivos();
      await avancar(250);
    }
    p = await snapshot();
    verificar(`ciclo ${ciclo}: onda finita e mortes reais`, p.invocados === p.total && p.mortos === p.total);
    verificar(`ciclo ${ciclo}: encerra somente seus projéteis`, p.projeteis === 0 &&
      await page.evaluate(() => window.__laserNormal.active));
    if (ciclo === 1) {
      const pos = await page.evaluate(() => {
        const g = window.__game.scene.getScene("Level1Parte2").novoBoss.geradores[0];
        const b = g.colisaoMapa.corpos[0]; return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      });
      await posicionar(pos.x, pos.y - 12);
      await avancar(2200);
      verificar("subida espera ocupante sair sem restaurar colisão", (await snapshot()).torres[0].estado === "emergindo");
      await posicionar(-1093, -5520);
    }
    await ate("GERADORES_EXPOSTOS");
    p = await snapshot();
    verificar(`ciclo ${ciclo}: sobreviventes expostos juntos`, p.torres.filter(g => g.vida > 0).every(g =>
      g.alvo && g.body && g.colisoes.every(Boolean)));
    verificar(`ciclo ${ciclo}: portais fechados e boss parado`, p.portais.length === 0 && !p.padrao && p.barreira);
    if (ciclo === 1) {
      verificar("Arcade bloqueia passagem pela base exposta", await atravessarBase() < 50);
      await avancar(30000);
      verificar("exposição sem limite de tempo", (await snapshot()).estado === "GERADORES_EXPOSTOS");
      await previa("02-torres-expostas");
      const resultado = await page.evaluate(async () => {
        const s = window.__game.scene.getScene("Level1Parte2");
        const { causarDanoAreaAlvosAdicionais } = await import("/js/combat/CombatTargets.js");
        const gs = s.novoBoss.geradores;
        gs[0].receberDano(100); gs[1].receberDano(30);
        // Um impacto amplo artificial força a condição simultânea pela API de combate real.
        causarDanoAreaAlvosAdicionais(s, gs, 25, null, {});
        return gs.map(g => ({ vida: g.vida, morto: g.morto }));
      });
      verificar("área destrói somente uma torre e conserva dano dos demais", resultado.filter(g => g.morto).length === 1 &&
        resultado[1].vida === 65 && resultado[2].vida === 95);
      verificar("recolhimento bloqueia dano imediatamente", await page.evaluate(() => {
        const e = window.__game.scene.getScene("Level1Parte2").novoBoss;
        return e.geradores.filter(g => !g.morto).every(g => !g.receberDano(1000));
      }));
    } else {
      if (ciclo === 2) verificar("HP das torres persiste entre ciclos", p.torres.find(g => g.id === 1594).vida === 65);
      await page.evaluate(() => {
        const e = window.__game.scene.getScene("Level1Parte2").novoBoss;
        e.geradores.find(g => g.active).receberDano(1000);
      });
    }
    p = await snapshot();
    verificar(`ciclo ${ciclo}: falha física e lógica imediata do escudo`, !p.barreira && !p.fisica);
    if (ciclo < 4) {
      await ate("BOSS_VULNERAVEL");
      await avancar(15000);
      verificar(`ciclo ${ciclo}: janela sem limite`, (await snapshot()).estado === "BOSS_VULNERAVEL");
      const vidaAntes = (await snapshot()).vida;
      verificar(`ciclo ${ciclo}: primeiro impacto`, await page.evaluate(() => {
        const e = window.__game.scene.getScene("Level1Parte2").novoBoss;
        window.__golpe = {}; return e.receberDano(100, null, window.__golpe);
      }));
      await avancar(250);
      verificar(`ciclo ${ciclo}: mesmo ataque não conta duas vezes`, !await page.evaluate(() =>
        window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(100, null, window.__golpe)));
      verificar(`ciclo ${ciclo}: ataque fora da hitbox não conta`, !await page.evaluate(() =>
        window.__game.scene.getScene("Level1Parte2").novoBoss.receberDano(100, { x: 0, y: 0, width: 5, height: 5 }, {})));
      await posicionar(-1080, -5810);
      const hits = await page.evaluate(() => {
        const e = window.__game.scene.getScene("Level1Parte2").novoBoss;
        return [e.receberDano(100, null, {}), e.receberDano(100, null, {})];
      });
      verificar(`ciclo ${ciclo}: exatamente dois impactos`, hits[0] && !hits[1] && (await snapshot()).vida === vidaAntes - 200);
      await avancar(2000);
      p = await snapshot();
      verificar(`ciclo ${ciclo}: recarga não prende jogador`, p.estado === "ESCUDO_RECARREGANDO" && !p.fisica && p.aguardandoSaidaEscudo);
      await previa("03-recarga");
      await posicionar(-1093, -5520);
      await avancar(100);
      verificar(`ciclo ${ciclo}: escudo volta após saída`, (await snapshot()).fisica);
    } else {
      await ate("COMBATE_PRINCIPAL");
      p = await snapshot();
      verificar("colapso definitivo sem quinta onda ou nova janela", !p.barreira && !p.fisica && p.portais.length === 0 &&
        p.torres.every(g => g.estado === "destruido"));
      verificar("vida preservada e segunda fase avaliada na transição", p.vida === 400 && p.fase === 2);
      const vida = p.vida;
      const acertos = await page.evaluate(() => {
        const e = window.__game.scene.getScene("Level1Parte2").novoBoss;
        return [e.receberDano(10), e.receberDano(10), e.receberDano(10)];
      });
      verificar("combate principal sem limite artificial de dois impactos", acertos.every(Boolean) && (await snapshot()).vida === vida - 30);
      await avancar(2000);
      verificar("luta principal retoma clonagem e ataques originais", (await snapshot()).clones === 9);
      await previa("04-combate-principal");
    }
    relatorio.ciclos.push({ ciclo, eliminados, maximo, estadoFinal: (await snapshot()).estado });
  }
  verificar("colisões alheias às torres preservadas", await page.evaluate(() =>
    window.__outrasColisoes.every(({ c, enable }) => c.body.enable === enable)));
  const spawns = await page.evaluate(() => window.__spawnsPrologo);
  for (const ciclo of [1, 2, 3, 4]) {
    const lista = spawns.filter(r => r.ciclo === ciclo);
    verificar(`ciclo ${ciclo}: alterna invocadores e identifica unidades`, lista.every((r, i) =>
      r.portal === i % 2 && r.encontro && r.onda && r.grace >= 1000));
  }
  relatorio.spawns = spawns;
  await sessao.reiniciar();
  await ate("ONDA_ROBOS"); await avancar(2000);
  await posicionar(-1093, -5250); await avancar(100);
  verificar("saída limpa robôs e portais sem agendar novas invocações", await page.evaluate(() => {
    const s = window.__game.scene.getScene("Level1Parte2"), p = s.novoBoss.prologo.snapshot();
    return p.suspenso && p.portais.length === 0 && !s.inimigos.some(r => r.prologoEncontroId);
  }));
  await posicionar(-1093, -5520); await avancar(2000);
  verificar("reentrada retoma um único controlador", !(await snapshot()).suspenso && (await snapshot()).portais.length === 2);
  await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").vida = 0; });
  await avancar(100);
  verificar("morte do jogador limpa recursos", (await snapshot()).portais.length === 0 && (await snapshot()).vivos === 0);
  await sessao.reiniciar({ multiplayer: true });
  verificar("multiplayer continua sem encontro solo", await page.evaluate(() => {
    const e = window.__game.scene.getScene("Level1Parte2").novoBoss; return !e.sprite && !e.prologo;
  }));
  assert.deepEqual(sessao.errors, []);
  assert.deepEqual(sessao.assetErrors, []);
  relatorio.resultado = "PASS";
  writeFileSync(`${pasta}/relatorio.json`, JSON.stringify(relatorio, null, 2));
  console.log(JSON.stringify(relatorio, null, 2));
} finally { await sessao.fechar(); }
