/** GIF original, laterais, tampas transitáveis e testes reais da física de robôs/escudo. */
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { novoBossConfig } from "../js/enemies/novoBoss/NovoBossConfig.js";
import { abrirSessaoNovoBoss } from "./novo-boss-browser-helpers.mjs";

const pasta = "/tmp/boss-portais-colisoes";
mkdirSync(pasta, { recursive: true });
const sessao = await abrirSessaoNovoBoss({ ...novoBossConfig,
  cenaEntrada: { ...novoBossConfig.cenaEntrada, ativo: false },
  ataques: { ...novoBossConfig.ataques, ativo: false },
});
const { page, avancar } = sessao;
page.on("pageerror", error => console.error(error.stack));
try {
  await avancar(5500);
  await page.evaluate(() => {
    // step() isolado não faz o preUpdate do frame; sem ele o sprite acumularia
    // deslocamentos antigos em postUpdate, diferindo do loop real do Phaser.
    window.__passoFisicaBoss = (s, dt) => {
      s.physics.world.bodies.forEach(b => { if (b.enable) b.preUpdate(false, dt); });
      s.physics.world.step(dt); s.physics.world.postUpdate();
    };
  });
  const visuais = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2"), e = s.novoBoss;
    const { lateralPortalNovoBoss } = await import("/js/enemies/novoBoss/NovoBossPortais.js");
    const portais = s.children.list.filter(o => /^novo-boss-portal-[12]$/.test(o.name));
    const primeiro = portais.map(o => o.frame.name);
    e.prologo.atualizar(110);
    s.cameras.main.stopFollow().setZoom(0.8).centerOn(-1080, -5800);
    s.children.depthSort();
    return { estado: e.prologo.estado, portais: portais.map(o => ({
      textura: o.texture.key, visible: o.visible, lado: lateralPortalNovoBoss(e.config.arena, o),
      primeiro: primeiro[portais.indexOf(o)], segundo: o.frame.name,
    })), torres: e.geradores.map(g => ({ visible: g.visual.visible, frame: g.visual.frame.name,
      estado: g.estadoGerador, alvo: g.active, body: g.body.enable,
      colisao: g.colisaoMapa.corpos.some(b => b.enable), depth: g.visual.depth })),
      baseDepth: s.profundidadePersonagemParte2 };
  });
  assert.equal(visuais.estado, "ONDA_ROBOS");
  assert.equal(visuais.portais.length, 2);
  assert.deepEqual(new Set(visuais.portais.map(p => p.lado)), new Set(["esquerda", "direita"]));
  assert.ok(visuais.portais.every(p => p.visible && p.textura === "novo-boss-portal" && p.primeiro !== p.segundo));
  assert.ok(visuais.torres.every(t => t.visible && t.frame === 0 && t.estado === "subterraneo" &&
    !t.alvo && !t.body && !t.colisao && t.depth < visuais.baseDepth));
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${pasta}/portais-tampas.png` });

  const paredes = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2"), e = s.novoBoss;
    const { retanguloLivreDoMapa } = await import("/js/enemies/EnemyPathfinding.js");
    const robo = s.inimigos.find(r => r.prologoEncontroId === e.prologo.id);
    const resultados = [];
    const colocar = (x, y) => { robo.body.reset(x, y); robo.body.updateFromGameObject(); };
    const passo = dt => { window.__passoFisicaBoss(s, dt); s.events.emit("postupdate", s.time.now, dt * 1000); };
    for (const caso of [
      { nome: "parede esquerda", x: -1570, y: -5820, vx: -1600, vy: 0, eixo: "x", limite: e.config.arena.xMin },
      { nome: "parede direita", x: -590, y: -5950, vx: 1600, vy: 0, eixo: "right", limite: e.config.arena.xMax },
      { nome: "parede superior fina", x: -1080, y: -6070, vx: 0, vy: -1600, eixo: "y", limite: e.config.arena.yMin },
      { nome: "limite inferior", x: -1450, y: -5460, vx: 0, vy: 1600, eixo: "bottom", limite: e.config.arena.yMax },
      { nome: "quina superior esquerda", x: -1570, y: -6070, vx: -1600, vy: -1600 },
    ]) {
      colocar(caso.x, caso.y);
      let livre = true, dentro = true;
      for (let i = 0; i < 4; i++) {
        robo.setVelocity(caso.vx, caso.vy); passo(0.25);
        const b = robo.body, a = e.config.arena;
        livre &&= retanguloLivreDoMapa(s, b);
        dentro &&= b.x >= a.xMin - 0.01 && b.y >= a.yMin - 0.01 &&
          b.right <= a.xMax + 0.01 && b.bottom <= a.yMax + 0.01;
      }
      resultados.push({ nome: caso.nome, livre, dentro, x: robo.body.x, y: robo.body.y });
    }
    colocar(-1530, -5800);
    return resultados;
  });
  console.log("PAREDES", JSON.stringify(paredes));
  assert.ok(paredes.every(r => r.livre && r.dentro), "Impulsos de 1600 px/s em frames de 250 ms não podem atravessar paredes");

  const escudo = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2"), e = s.novoBoss;
    const { criarInimigoTeste } = await import("/js/enemies/EnemyTest.js");
    const robo = s.inimigos.find(r => r.prologoEncontroId === e.prologo.id);
    const comum = criarInimigoTeste(s, { x: -1300, y: -5780 });
    const atores = [s.player, robo, comum, s.companionPet].filter(Boolean);
    const centro = { x: e.x, y: e.y + 16 }, raio = e.config.geradores.raioBarreira;
    const casos = [];
    function colocarCentro(a, x, y) {
      a.body.updateFromGameObject();
      a.body.reset(a.x + x - a.body.center.x, a.y + y - a.body.center.y);
      a.body.updateFromGameObject();
    }
    function distancia(b) {
      const px = Math.max(b.x, Math.min(centro.x, b.right));
      const py = Math.max(b.y, Math.min(centro.y, b.bottom));
      return Math.hypot(px - centro.x, py - centro.y);
    }
    for (const ator of atores) {
      for (const outro of atores) if (outro !== ator) {
        colocarCentro(outro, -1510, -5900 + atores.indexOf(outro) * 80); outro.setVelocity(0, 0);
      }
      for (let direcao = 0; direcao < 8; direcao++) {
        const angulo = direcao * Math.PI / 4, nx = Math.cos(angulo), ny = Math.sin(angulo);
        colocarCentro(ator, centro.x + nx * 160, centro.y + ny * 160);
        e.sistemaGeradores.controlarEscudo(1, true, true);
        let menor = Infinity;
        for (let i = 0; i < 20; i++) {
          ator.setVelocity(-nx * 1000, -ny * 1000);
          window.__passoFisicaBoss(s, i === 0 ? 0.25 : 1 / 30);
          // Mesmo encostando, o estado do prólogo não pode desligar a barreira.
          e.prologo.atualizar(16);
          menor = Math.min(menor, distancia(ator.body));
        }
        casos.push({ tipo: ator === s.player ? "jogador" : ator === s.companionPet ? "companheiro" : ator.tipoRobo,
          direcao, menor, habilitada: e.sistemaGeradores.corpoBarreira.enable });
      }
    }
    colocarCentro(s.player, -1093, -5520);
    colocarCentro(robo, -1480, -5810);
    colocarCentro(comum, -1420, -5780);
    if (s.companionPet) colocarCentro(s.companionPet, -1170, -5520);
    // Sem escudo, o mesmo trajeto deve ser liberado.
    e.sistemaGeradores.controlarEscudo(0, false, false);
    colocarCentro(robo, centro.x - 150, centro.y);
    robo.setVelocity(1000, 0); window.__passoFisicaBoss(s, 0.15);
    const atravessouSemEscudo = distancia(robo.body) < 10;
    colocarCentro(robo, -1480, -5810); robo.setVelocity(0, 0);
    e.sistemaGeradores.controlarEscudo(1, true, true);
    // O robô comum criado depois do escudo deve estar na lista física atualizada.
    window.__roboNormalAjustes = comum;
    return { casos, atravessouSemEscudo };
  });
  console.log("ESCUDO", JSON.stringify(escudo));
  assert.ok(escudo.casos.every(c => c.menor >= 94.99 && c.habilitada));
  assert.ok(escudo.atravessouSemEscudo);

  const orbita = await page.evaluate(async () => {
    const s = window.__game.scene.getScene("Level1Parte2"), e = s.novoBoss;
    const { atualizarRoboBola } = await import("/js/enemies/RoboBola.js");
    const { retanguloLivreDoMapa } = await import("/js/enemies/EnemyPathfinding.js");
    const robos = s.inimigos.filter(r => r.prologoEncontroId);
    const lados = [{ x: -1540, y: -5800 }, { x: -620, y: -5900 }, { x: -1100, y: -6040 }, { x: -1300, y: -5500 }];
    let violacoes = 0, movimentos = 0, desalinhamento = 0;
    for (let i = 0; i < 2400; i++) {
      const p = lados[Math.floor(i / 600)];
      s.player.body.reset(p.x, p.y); s.player.body.updateFromGameObject(); s.player.setVelocity(0, 0);
      const dt = i % 90 === 0 ? 0.18 : 1 / 60;
      s.time.now += dt * 1000;
      atualizarRoboBola(s, s.time.now, dt * 1000);
      e.prologo.atualizar(0);
      window.__passoFisicaBoss(s, dt);
      for (const r of robos) {
        const b = r.body, a = e.config.arena;
        if (!retanguloLivreDoMapa(s, b) || b.x < a.xMin - 0.01 || b.y < a.yMin - 0.01 ||
          b.right > a.xMax + 0.01 || b.bottom > a.yMax + 0.01) violacoes++;
        if (Math.hypot(b.velocity.x, b.velocity.y) > 1) movimentos++;
        desalinhamento = Math.max(desalinhamento, Math.abs((r.x - 16.8) - b.x), Math.abs((r.y - 16.8) - b.y));
      }
    }
    return { violacoes, movimentos, desalinhamento, passos: 2400, robos: robos.length,
      info: robos.map(r => ({x:r.x,y:r.y,body:{x:r.body.x,y:r.body.y},prev:r.body.prev,estado:r.iaEstado,
        protegido:r.prologoProtegidoAte,tempo:s.time.now,vel:r.body.velocity,
        alvo:r.iaUltimaPosicao,stun:r.especialAtordoadoAte,bodyEnable:r.body.enable,morto:r.morto})),
      vida:s.vida, bloqueado:s.movimentoBloqueado, suspenso:e.suspenso };
  });
  console.log("ÓRBITA", JSON.stringify(orbita));
  assert.equal(orbita.violacoes, 0); assert.ok(orbita.movimentos > 50);
  assert.ok(orbita.desalinhamento < 0.001, "sprite e corpo continuam sincronizados após colisões");
  await page.evaluate(() => { window.__game.scene.getScene("Level1Parte2").novoBoss.prologo.suspender(); });
  assert.ok(await page.evaluate(() => window.__roboNormalAjustes.active));
  await sessao.reiniciar(); await avancar(5000);
  assert.deepEqual(sessao.errors, []); assert.deepEqual(sessao.assetErrors, []);
  writeFileSync(`${pasta}/relatorio.json`, JSON.stringify({ visuais, paredes, escudo, orbita }, null, 2));
  console.log("PASS GIF, tampas, laterais, paredes, escudo, movimento real e reinício.");
} finally { await sessao.fechar(); }
