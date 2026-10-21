/** Regressões da navegação: hitbox deslocada, quinas, orçamento e recuperação de colisões. */
import test from "node:test";
import assert from "node:assert/strict";
import {
  caminhoDiretoBloqueado,
  caminhoMovimentoBloqueado,
  atualizarRotaSeguindoInimigo,
  seguirRotaAtual,
  retanguloLivreDoMapa,
  invalidarCacheNavegacao,
} from "./EnemyPathfinding.js";

function obstaculo(x, y, width, height) {
  return { body: { x, y, width, height, enable: true } };
}

function criarRobo(x = 0, y = 0, { width = 24, height = 24, offsetX = 0, offsetY = 0 } = {}) {
  return {
    x, y, active: true, velocidade: 60, rotaAtual: [], indiceRota: 0,
    body: { x: x + offsetX - width / 2, y: y + offsetY - height / 2,
      width, height, enable: true, velocity: { x: 0, y: 0 } },
    setVelocity(vx, vy) { this.body.velocity = { x: vx, y: vy }; },
  };
}

function posicionar(robo, x, y) {
  robo.body.x += x - robo.x;
  robo.body.y += y - robo.y;
  robo.x = x;
  robo.y = y;
}

function criarCena(blocos = []) {
  return {
    collisionGroup: { getChildren: () => blocos },
    inimigos: [],
    physics: { moveTo(robo, x, y, velocidade) {
      const d = Math.hypot(x - robo.x, y - robo.y);
      robo.setVelocity(d ? (x - robo.x) / d * velocidade : 0,
        d ? (y - robo.y) / d * velocidade : 0);
    } },
  };
}

function verificarTrechos(scene, robo) {
  const inicial = { x: robo.x, y: robo.y };
  for (const ponto of robo.rotaAtual) {
    assert.equal(caminhoMovimentoBloqueado(scene, robo, ponto), false,
      `Trecho obstruído: (${robo.x}, ${robo.y}) até (${ponto.x}, ${ponto.y})`);
    posicionar(robo, ponto.x, ponto.y);
  }
  posicionar(robo, inicial.x, inicial.y);
}

function simularRota(scene, robo, alvo, { time = 0, velocidade = 60 } = {}) {
  let andou = 0;
  for (let frame = 0; frame < 1600; frame++) {
    if (!seguirRotaAtual(scene, robo, alvo, time + frame * 16, null, velocidade)) return andou;
    const vx = robo.body.velocity.x * 0.016;
    const vy = robo.body.velocity.y * 0.016;
    const proximo = { x: robo.x + vx, y: robo.y + vy };
    assert.equal(caminhoMovimentoBloqueado(scene, robo, proximo), false,
      `Movimento simulado bateu no cenário em ${robo.x}, ${robo.y}`);
    posicionar(robo, proximo.x, proximo.y);
    andou += Math.hypot(vx, vy);
  }
  assert.fail("A rota não terminou no limite de frames");
}

test("cena sem grupo de colisão suporta visão, movimento e área livre", () => {
  const scene = { physics: {} };
  const robo = criarRobo();
  assert.equal(caminhoDiretoBloqueado(scene, robo, { x: 100, y: 0 }), false);
  assert.equal(caminhoMovimentoBloqueado(scene, robo, { x: 100, y: 0 }), false);
  assert.equal(retanguloLivreDoMapa(scene, { x: 0, y: 0, width: 24, height: 24 }), true);
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, { x: 100, y: 0 }), false);
});

test("visão pontual não autoriza corpo a passar em abertura estreita", () => {
  const scene = criarCena([obstaculo(48, -100, 8, 90), obstaculo(48, 10, 8, 90)]);
  const robo = criarRobo();
  const alvo = { x: 100, y: 0 };
  assert.equal(caminhoDiretoBloqueado(scene, robo, alvo), false);
  assert.equal(caminhoMovimentoBloqueado(scene, robo, alvo), true);
});

test("varredura acompanha offset dos pés em ambos os eixos", () => {
  const robo = criarRobo(0, 0, { width: 20, height: 18, offsetX: 8, offsetY: 40 });
  const alvo = { x: 100, y: 0 };
  const paredeDosPes = criarCena([obstaculo(50, 32, 5, 16)]);
  assert.equal(caminhoDiretoBloqueado(paredeDosPes, robo, alvo), false);
  assert.equal(caminhoMovimentoBloqueado(paredeDosPes, robo, alvo), true);
  const paredeVisual = criarCena([obstaculo(50, -8, 5, 16)]);
  assert.equal(caminhoDiretoBloqueado(paredeVisual, robo, alvo), true);
  assert.equal(caminhoMovimentoBloqueado(paredeVisual, robo, alvo), false);
});

test("obstáculo entre duas células livres não é atravessado nem cortado na diagonal", () => {
  const scene = criarCena([obstaculo(11, -90, 1, 180)]);
  const robo = criarRobo(0, 0, { width: 4, height: 4 });
  const alvo = { x: 72, y: 0 };
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, alvo, 0), true);
  verificarTrechos(scene, robo);
  assert.ok(robo.rotaAtual.some((ponto) => Math.abs(ponto.y) > 90));
});

test("origem livre junto à parede permanece livre sem encaixe em centro de célula", () => {
  const scene = criarCena([obstaculo(14, -100, 32, 200)]);
  const robo = criarRobo();
  const alvo = { x: 140, y: 0 };
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, alvo, 0), true);
  verificarTrechos(scene, robo);
  assert.ok(simularRota(scene, robo, alvo) > 250);
  assert.ok(Math.hypot(alvo.x - robo.x, alvo.y - robo.y) < 8);
  assert.equal(robo.rotaInvalidada, false);
});

test("rota com hitbox deslocada contorna canto e chega por trechos livres", () => {
  const scene = criarCena([obstaculo(55, 20, 40, 160), obstaculo(95, 130, 80, 50)]);
  const robo = criarRobo(0, 0, { width: 40, height: 22, offsetX: 6, offsetY: 40 });
  const alvo = { x: 210, y: 70 };
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, alvo, 0), true);
  verificarTrechos(scene, robo);
  simularRota(scene, robo, alvo);
  assert.ok(Math.hypot(alvo.x - robo.x, alvo.y - robo.y) < 8);
});

test("refina a grade para entrar lateralmente em corredor de 60px com a hitbox real do atirador", () => {
  // Entre x=29 e x=89, o centro físico só cabe aproximadamente em x=51.2..66.8.
  // Nenhuma coluna da grade grossa (0,24,48,72...) serve; a grade fina alcança x=60.
  const scene = criarCena([
    obstaculo(-400, 64, 429, 420),
    obstaculo(89, 64, 400, 420),
  ]);
  const robo = criarRobo(0, 0, { width: 41.4, height: 25.3, offsetX: -0.115, offsetY: 30 });
  const alvo = { x: 59, y: 220 };
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, alvo, 0), true);
  verificarTrechos(scene, robo);
  simularRota(scene, robo, alvo);
  assert.ok(Math.hypot(alvo.x - robo.x, alvo.y - robo.y) < 8);
});

test("destino dentro de parede é aproximado pela face acessível", () => {
  const scene = criarCena([obstaculo(88, -48, 40, 96)]);
  const robo = criarRobo();
  const alvo = { x: 100, y: 0 };
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, alvo, 0), true);
  verificarTrechos(scene, robo);
  assert.ok(robo.rotaAtual.at(-1).x < 88);
});

test("sobreposição inicial sai pela borda próxima sem atravessar a parede", () => {
  const scene = criarCena([obstaculo(8, -40, 24, 80)]);
  const robo = criarRobo();
  const alvo = { x: 120, y: 0 };
  assert.equal(caminhoMovimentoBloqueado(scene, robo, { x: -24, y: 0 }), false);
  assert.equal(caminhoMovimentoBloqueado(scene, robo, alvo), true);
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, alvo, 0), true);
  verificarTrechos(scene, robo);
  assert.ok(robo.rotaAtual[0].x < 0);
});

test("buscas cobrem perseguição além do limite antigo de 960 pixels", () => {
  const scene = criarCena([obstaculo(400, -60, 40, 120)]);
  const robo = criarRobo();
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, { x: 1200, y: 0 }, 0), true);
  verificarTrechos(scene, robo);
  assert.equal(robo.rotaAtual.at(-1).x, 1200);
});

test("orçamento compartilhado adia terceiro robô e libera no próximo frame", () => {
  const scene = criarCena([obstaculo(50, -100, 24, 200)]);
  const robos = [criarRobo(0, 0), criarRobo(0, 10), criarRobo(0, 20)];
  assert.equal(atualizarRotaSeguindoInimigo(scene, robos[0], { x: 150, y: 0 }, 1000), true);
  assert.equal(atualizarRotaSeguindoInimigo(scene, robos[1], { x: 150, y: 10 }, 1000), true);
  assert.equal(atualizarRotaSeguindoInimigo(scene, robos[2], { x: 150, y: 20 }, 1000), false);
  assert.equal(robos[2].rotaPendente, true);
  assert.equal(robos[2].proximaTentativaRota, 1017);
  assert.equal(atualizarRotaSeguindoInimigo(scene, robos[2], { x: 150, y: 20 }, 1017), true);
  assert.equal(robos[2].rotaPendente, false);
});

test("cooldown de 550ms funciona também após uma busca feita no instante zero", () => {
  const scene = criarCena([obstaculo(50, -100, 24, 200)]);
  const robo = criarRobo();
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, { x: 150, y: 0 }, 0), true);
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, { x: 150, y: 90 }, 100), true);
  assert.equal(robo.rotaPendente, true);
  assert.equal(robo.proximaTentativaRota, 550);
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, { x: 150, y: 90 }, 550), true);
  assert.equal(robo.ultimoCalculoRota, 550);
});

test("mudança do mapa invalida trecho seguido e pede recálculo imediato", () => {
  const blocos = [obstaculo(50, -40, 24, 80)];
  const scene = criarCena(blocos);
  const robo = criarRobo();
  const alvo = { x: 150, y: 0 };
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, alvo, 0), true);
  blocos.push(obstaculo(-20, -160, 60, 320));
  assert.equal(seguirRotaAtual(scene, robo, alvo, 100), false);
  assert.equal(robo.rotaInvalidada, true);
  assert.equal(robo.iaProximaRota, 0);
  assert.deepEqual(robo.body.velocity, { x: 0, y: 0 });
});

test("monitor detecta falta de movimento mesmo quando tempoPreso começou em zero", () => {
  const scene = criarCena([obstaculo(50, -50, 24, 100)]);
  const robo = criarRobo();
  const alvo = { x: 150, y: 0 };
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, alvo, 0), true);
  assert.equal(seguirRotaAtual(scene, robo, alvo, 10), true);
  assert.equal(seguirRotaAtual(scene, robo, alvo, 801), false);
  assert.equal(robo.rotaInvalidada, true);
  assert.ok(robo.iaForcarRotaAte > 801);
});

test("seguimento usa a velocidade pedida em vez de sempre perseguir na velocidade máxima", () => {
  const scene = criarCena([obstaculo(50, -50, 24, 100)]);
  const robo = criarRobo();
  const alvo = { x: 150, y: 0 };
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, alvo, 0), true);
  assert.equal(seguirRotaAtual(scene, robo, alvo, 20, null, 21), true);
  assert.ok(Math.abs(Math.hypot(robo.body.velocity.x, robo.body.velocity.y) - 21) < 0.000001);
});

test("recuperação forçada desvia do aliado que colide no caminho direto", () => {
  const scene = criarCena();
  const robo = criarRobo();
  const aliado = criarRobo(48, 0);
  scene.inimigos = [robo, aliado];
  robo.iaForcarRotaAte = 10000;
  const alvo = { x: 160, y: 0 };
  assert.equal(atualizarRotaSeguindoInimigo(scene, robo, alvo, 0), true);
  assert.ok(robo.rotaAtual.some((ponto) => Math.abs(ponto.y) >= 24));
  const colisoesOriginais = scene.collisionGroup;
  scene.collisionGroup = { getChildren: () => [aliado] };
  verificarTrechos(scene, robo);
  simularRota(scene, robo, alvo);
  scene.collisionGroup = colisoesOriginais;
  assert.ok(Math.hypot(alvo.x - robo.x, alvo.y - robo.y) < 8);
});

test("invalidação explícita atualiza parede movida sem alteração na quantidade", () => {
  const parede = obstaculo(50, -20, 20, 40);
  const scene = criarCena([parede]);
  const robo = criarRobo();
  const alvo = { x: 100, y: 0 };
  assert.equal(caminhoMovimentoBloqueado(scene, robo, alvo), true);
  parede.body.y = 100;
  invalidarCacheNavegacao(scene);
  assert.equal(caminhoMovimentoBloqueado(scene, robo, alvo), false);
  parede.body.y = -20;
  invalidarCacheNavegacao(scene);
  parede.body.enable = false;
  assert.equal(caminhoMovimentoBloqueado(scene, robo, alvo), false);
});
