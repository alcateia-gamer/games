import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { candidatosPortaisNovoBoss, escolherParPortais, pontoSeguroPortal, lateralPortalNovoBoss } from "./NovoBossPortais.js";
import { emissoesPadraoPrologo } from "./NovoBossPadroesPrologo.js";
import { criarControleColisaoTorre } from "./NovoBossColisoesTorres.js";
import { pontosTorresNovoBoss } from "./NovoBossTorres.js";
import { novoBossConfig } from "./NovoBossConfig.js";
import { causarDanoAreaAlvosAdicionais } from "../../combat/CombatTargets.js";
import { retanguloLivreDoMapa } from "../EnemyPathfinding.js";

function arenaReal() {
  const tiled = JSON.parse(readFileSync(new URL("../../../assets/map/parte2-fase1.json", import.meta.url)));
  const scene = { map: { getObjectLayer: nome => tiled.layers.find(l => l.name === nome) },
    player: { x: -1093, y: -5520, active: true }, inimigos: [] };
  const colisoes = scene.map.getObjectLayer("collision").objects.filter(o => o.width > 0 && o.height > 0);
  const objetos = colisoes.map(o => ({ tiledCollisionId: o.id, body: { ...o, enable: true } }));
  scene.collisionGroup = { getChildren: () => objetos };
  const encontro = { config: novoBossConfig, x: -1080, y: -5810, geradores: pontosTorresNovoBoss(scene) };
  return { scene, encontro, objetos };
}

test("mapa real liga exatamente os quatro retângulos de colisão às torres", () => {
  const { scene, encontro } = arenaReal();
  assert.deepEqual(encontro.geradores.map(g => g.colisaoId), [1598, 1599, 1600, 1601]);
  for (const ponto of encontro.geradores) assert.equal(criarControleColisaoTorre(scene, ponto).corpos.length, 1);
});

test("subterrâneo libera só sua colisão e invalida o cache de navegação na restauração", () => {
  const { scene, encontro, objetos } = arenaReal();
  const ponto = encontro.geradores[0];
  const controle = criarControleColisaoTorre(scene, ponto);
  const area = { ...controle.corpos[0] };
  assert.equal(retanguloLivreDoMapa(scene, area), false);
  controle.definir(false);
  assert.equal(retanguloLivreDoMapa(scene, area), true);
  assert.ok(objetos.filter(o => o.tiledCollisionId !== ponto.colisaoId).every(o => o.body.enable));
  // Força a construção do índice sem a torre antes de restaurá-la.
  controle.definir(true);
  assert.equal(retanguloLivreDoMapa(scene, area), false);
  controle.restaurar();
  assert.ok(objetos.every(o => o.body.enable));
});

test("restauração detecta jogador e inimigo sobre a base, sem movê-los", () => {
  const { scene, encontro } = arenaReal();
  const controle = criarControleColisaoTorre(scene, encontro.geradores[0]);
  const b = controle.corpos[0];
  assert.equal(controle.ocupado(), false);
  scene.player.body = { x: b.x + 10, y: b.y + 10, width: 20, height: 20 };
  assert.equal(controle.ocupado(), true);
  scene.player.body.x = 0;
  scene.inimigos = [{ active: true, body: { ...b, enable: true } }];
  assert.equal(controle.ocupado(), true);
  scene.inimigos[0].morto = true;
  assert.equal(controle.ocupado(), false);
  scene.companionPet = { active: true, body: { ...b, enable: true } };
  assert.equal(controle.ocupado(), true, "companheiro real também impede restauração sobreposta");
});

test("seis candidatos e fallback determinísticos são seguros e alternam o par", () => {
  const { scene, encontro } = arenaReal();
  assert.equal(candidatosPortaisNovoBoss(encontro.config.arena).length, 6);
  const primeiro = escolherParPortais(scene, encontro);
  const segundo = escolherParPortais(scene, encontro, primeiro);
  assert.equal(primeiro.length, 2);
  assert.deepEqual(new Set(primeiro.map(p => lateralPortalNovoBoss(encontro.config.arena, p))),
    new Set(["esquerda", "direita"]));
  assert.ok(candidatosPortaisNovoBoss(encontro.config.arena).every(p => lateralPortalNovoBoss(encontro.config.arena, p)));
  assert.notDeepEqual(primeiro, segundo);
  for (const ponto of [...primeiro, ...segundo]) assert.equal(pontoSeguroPortal(scene, encontro, ponto), true);
  assert.deepEqual(escolherParPortais(scene, encontro, primeiro), segundo);
  assert.equal(pontoSeguroPortal(scene, encontro, { x: -1080, y: -6060 }), false, "centro é proibido mesmo livre");
});

test("nenhum espaço válido aguarda, sem relaxar limites ou criar dentro do jogador", () => {
  const { scene, encontro } = arenaReal();
  const a = encontro.config.arena;
  scene.collisionGroup = { getChildren: () => [{ body: { enable: true,
    x: a.xMin, y: a.yMin, width: a.xMax - a.xMin, height: a.yMax - a.yMin } }] };
  assert.equal(escolherParPortais(scene, encontro), null);
  assert.equal(pontoSeguroPortal(scene, encontro, scene.player), false);
  assert.equal(pontoSeguroPortal(scene, encontro, { x: a.xMin - 100, y: a.yMin }), false);
});

test("anéis têm abertura ampla; rajadas mantêm corredores; espiral é reduzida", () => {
  const aneis = emissoesPadraoPrologo("aneis");
  for (const em of new Set(aneis.map(e => e.em))) {
    const angulos = aneis.filter(e => e.em === em).map(e => (e.angulo % 360)).sort((a, b) => a - b);
    const lacunas = angulos.map((a, i) => ((angulos[(i + 1) % angulos.length] - a + 360) % 360));
    assert.ok(Math.max(...lacunas) >= 120);
  }
  assert.equal(emissoesPadraoPrologo("rajadas").filter(e => e.em === 0).length, 6);
  const espiral = emissoesPadraoPrologo("espiral");
  assert.equal(espiral.length, 18);
  assert.ok(espiral.at(-1).em < 3000);
});

test("impacto simultâneo escolhe uma morte por ID e mantém dano não fatal dos sobreviventes", () => {
  let fechado = false;
  const cena = { novoBoss: { prologo: { estado: "GERADORES_EXPOSTOS" }, geradores: [] } };
  const criar = (id, vida) => ({ id, vida, torre: true, active: true, visible: true,
    body: { enable: true }, hitboxDano: {}, receberDano(dano) {
      if (fechado) return false;
      this.vida = Math.max(0, this.vida - dano);
      if (this.vida === 0) { this.morto = true; fechado = true; }
      return true;
    } });
  const torres = [criar(4, 20), criar(2, 10), criar(8, 120), criar(6, 120)];
  cena.novoBoss.geradores = torres;
  causarDanoAreaAlvosAdicionais(cena, torres, 30, null, {});
  assert.equal(torres[1].vida, 0);
  assert.equal(torres[0].vida, 1);
  assert.equal(torres[2].vida, 90);
  assert.equal(torres[3].vida, 90);
});
