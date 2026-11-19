import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";
import { carregarMapaSpawns, geometriaSpawnPhaser } from "../../tests/spawn-map-fixture.mjs";
import { moverInimigoAte } from "./EnemyAI.js";
import { caminhoMovimentoBloqueado } from "./EnemyPathfinding.js";
import { obterPisoSpawnRobos } from "./EnemySpawnValidation.js";
import { criarSpawnAreasRoboBola } from "./RoboBolaSpawnAreas.js";
import { areaNascimentoLotada, concentracaoRobos, ocupacaoNascimento, pontoAtaqueOnda, registrarNascimentoLocal, registrarRoboNaFila, velocidadeFilaRobo } from "./RoboBolaAglomeracao.js";

globalThis.Phaser = { ...geometriaSpawnPhaser, Math: { ...geometriaSpawnPhaser.Math,
  Clamp: (n, min, max) => Math.max(min, Math.min(n, max)) } };

function robo(x, y, id, piso) {
  return { x, y, tipoRobo: "bola", spawnAreaRoboBolaId: id, active: true, playableArea: piso,
    body: { width: 33.6, height: 33.6, center: { x, y }, velocity: { x: 0, y: 0 } },
    setVelocity(x, y) { this.body.velocity = { x, y }; } };
}

test("passagem do mapa real dá prioridade ao primeiro e solta a fila quando há espaço", t => {
  const { scene } = carregarMapaSpawns("parte2-fase1.json");
  const piso = obterPisoSpawnRobos(scene);
  const alvo = { x: -850, y: -4775 };
  const dt = 20;
  scene.physics.moveTo = (r, x, y, speed) => r.setVelocity(0, Math.sign(y - r.y) * speed);
  function percorrer(controle) {
    scene.inimigos = [-4898, -4945, -4992, -5039].map((y, i) => robo(-850, y, controle ? i : null, piso));
    const [primeiro, segundo] = scene.inimigos;
    assert.equal(caminhoMovimentoBloqueado(scene, primeiro, alvo), false);
    assert.equal(caminhoMovimentoBloqueado(scene, primeiro, { x: -808, y: primeiro.y }), true);
    assert.equal(caminhoMovimentoBloqueado(scene, primeiro, { x: -892, y: primeiro.y }), true);
    assert.equal(velocidadeFilaRobo(scene, primeiro, alvo, 0), 1);
    assert.equal(velocidadeFilaRobo(scene, segundo, alvo, 0), controle ? 0 : 1);
    const medidas = { picoEm82px: 0, bloqueiosPorCorpo: 0, buscasAStar: 0, primeiroCruzaEmMs: null, ultimoCruzaEmMs: null };
    for (let time = dt; time <= 9000; time += dt) {
      // O alvo para na passagem e depois atrai a fila adiante.
      const destino = { x: alvo.x, y: time < 1500 ? alvo.y - 45 : alvo.y };
      const direcao = time < 6000 ? 1 : -1;
      const destinoAtual = direcao === 1 ? destino : { x: alvo.x, y: -5060 };
      const ordenados = direcao === 1 ? scene.inimigos : [...scene.inimigos].reverse();
      for (const r of ordenados) {
        const buscaAnterior = r.ultimoCalculoRota;
        moverInimigoAte(scene, r, destinoAtual, time, 145, true, Math.abs(destinoAtual.y - r.y), destinoAtual);
        if (r.ultimoCalculoRota !== buscaAnterior) medidas.buscasAStar++;
        const deslocamento = r.body.velocity.y * dt / 1000;
        const y = r.y + deslocamento;
        if (caminhoMovimentoBloqueado(scene, r, { x: r.x, y })) continue;
        if (deslocamento && scene.inimigos.some(outro => outro !== r && Math.abs(outro.y - y) < 33.6)) {
          medidas.bloqueiosPorCorpo++;
          continue;
        }
        r.y = r.body.center.y = y;
      }
      if (primeiro.y > -4860) medidas.primeiroCruzaEmMs ??= time;
      if (scene.inimigos.every(r => r.y > -4960)) medidas.ultimoCruzaEmMs ??= time;
      for (const r of scene.inimigos) medidas.picoEm82px = Math.max(medidas.picoEm82px,
        scene.inimigos.filter(outro => Math.abs(r.y - outro.y) < 82).length);
    }
    medidas.voltaram = scene.inimigos.filter(r => r.y < -4870).length;
    return medidas;
  }
  const antes = percorrer(false), depois = percorrer(true);
  t.diagnostic(JSON.stringify({ antes, depois }));
  assert.equal(depois.primeiroCruzaEmMs, antes.primeiroCruzaEmMs);
  assert.ok(depois.ultimoCruzaEmMs);
  assert.equal(depois.voltaram, 4);
  assert.ok(depois.bloqueiosPorCorpo < antes.bloqueiosPorCorpo);
});

for (const jogadores of [2, 3, 4]) test(`host adia a onda saturada com ${jogadores} jogadores sem bloquear outra sala`, () => {
  const areas = [0, 2000].map((x, id) => ({ id, x, y: 0, width: 60, height: 60 }));
  const { scene } = carregarMapaSpawns("parte2-fase1.json");
  scene.map = { getObjectLayer: () => ({ objects: areas }) };
  scene.collisionGroup = null;
  scene.player = { x: -155, y: 30, active: true };
  scene.multiplayer = scene.isMultiplayerHost = true;
  scene.remotePlayers = new Map(Array.from({ length: jogadores - 1 }, (_, id) =>
    [id, { x: 1845 + id * 30, y: 30, active: true }]));
  scene.inimigos = [[25, 30], [30, 25], [35, 30]].map(([x, y], i) => robo(x, y, i + 10));
  const sistema = criarSpawnAreasRoboBola(scene, (s, p) => {
    const novo = robo(p.x, p.y, null);
    s.inimigos.push(novo);
    return novo;
  });
  sistema.atualizar(450);
  assert.deepEqual(sistema.snapshot().map(a => a.invocados), [0, 1]);
  for (const aliado of scene.remotePlayers.values()) aliado.x = -155;
  for (const r of scene.inimigos.slice(0, 3)) r.body.center.y = r.y = -500;
  sistema.atualizar(449);
  assert.deepEqual(sistema.snapshot().map(a => a.invocados), [0, 1]);
  sistema.atualizar(1);
  assert.deepEqual(sistema.snapshot().map(a => a.invocados), [1, 1]);
});

test("robôs de ondas diferentes reservam lados distintos e mantêm a escolha", () => {
  const alvo = { x: 0, y: 0 };
  const a = Object.assign(robo(160, 4, 1), { alvoAtual: alvo });
  const b = Object.assign(robo(170, 16, 2), { alvoAtual: alvo });
  const scene = { inimigos: [a, b] };
  concentracaoRobos(scene, 0);
  const ladoA = pontoAtaqueOnda(scene, a, alvo, 0);
  const ladoB = pontoAtaqueOnda(scene, b, alvo, 0);
  assert.ok(ladoA && ladoB);
  assert.notDeepEqual(ladoA, ladoB);
  assert.deepEqual(pontoAtaqueOnda(scene, a, alvo, 120), ladoA);
  b.prologoEncontroId = "portal";
  assert.equal(pontoAtaqueOnda(scene, b, alvo, 240), null);
});

test("reserva expira em 450 ms mesmo com a grade ainda na mesma rodada", () => {
  const ponto = { x: 0, y: 0 };
  for (const quantidade of [0, 3]) {
    const scene = { inimigos: Array.from({ length: quantidade }, (_, i) => robo(i * 40, 0, i)) };
    const reserva = robo(0, 0, 9);
    const estado = concentracaoRobos(scene, 0);
    registrarNascimentoLocal(estado, reserva, ponto, 0);
    reserva.active = false;
    concentracaoRobos(scene, 430);
    const area = { ...ponto, width: 1, height: 1 };
    for (const time of [449, 450, 451]) {
      assert.equal(concentracaoRobos(scene, time), estado);
      assert.equal(estado.time, 430);
      assert.equal(ocupacaoNascimento(estado, ponto, time), time < 450 ? 3 : quantidade);
      assert.equal(areaNascimentoLotada(estado, area, time), time < 450 || quantidade === 3);
    }
  }
});

test("encontro frontal libera a passagem com corpos Arcade e alvos em lados opostos", t => {
  const fonte = readFileSync(new URL("../libs/phaser.min.js", import.meta.url), "utf8");
  const contexto = { module: { exports: {} }, exports: {} };
  vm.runInNewContext(fonte.replace("i(85454)})());", "({World:i(82248),Body:i(37742)})})());"), contexto);
  const { World, Body } = contexto.module.exports;
  for (const inverter of [false, true]) {
    const { scene } = carregarMapaSpawns("parte2-fase1.json");
    const piso = obterPisoSpawnRobos(scene);
    const mundo = new World({ sys: { scale: { width: 800, height: 450 } } }, { fixedStep: false });
    const montar = (y, id, alvo) => {
      const r = Object.assign(robo(-850, y, id, piso), { alvoAtual: alvo, angle: 0,
        active: true, width: 33.6, height: 33.6, displayWidth: 33.6, displayHeight: 33.6,
        displayOriginX: 16.8, displayOriginY: 16.8, scaleX: 1, scaleY: 1,
        getCenter() { return { x: this.x, y: this.y }; },
        setVelocity(x, y) { this.body.setVelocity(x, y); },
      });
      r.body = mundo.add(new Body(mundo, r));
      return r;
    };
    scene.multiplayer = true;
    const alvos = [{ x: -850, y: -4690 }, { x: -850, y: -5025 }];
    const [a, b] = [montar(-4943, 1, alvos[0]), montar(-4898, 2, alvos[1])];
    scene.remotePlayers = new Map([["aliado", alvos[1]]]);
    scene.player = alvos[0];
    scene.inimigos = [a, b];
    scene.physics.moveTo = (r, x, y, speed) => {
      const d = Math.hypot(x - r.x, y - r.y) || 1;
      r.setVelocity((x - r.x) * speed / d, (y - r.y) * speed / d);
    };
    mundo.addCollider(a, b);
    const decidir = (r, time) => moverInimigoAte(scene, r, r.alvoAtual, time, 145, true,
      Math.hypot(r.x - r.alvoAtual.x, r.y - r.alvoAtual.y), r.alvoAtual);
    for (const r of inverter ? [b, a] : [a, b]) registrarRoboNaFila(r);
    for (const r of inverter ? [b, a] : [a, b]) decidir(r, 0);
    for (let time = 16; time <= 6500; time += 16) {
      if (inverter) scene.inimigos.reverse();
      for (const r of scene.inimigos) decidir(r, time);
      const anteriores = [a, b].map(r => ({ x: r.x, y: r.y }));
      mundo.update(time, 16);
      mundo.postUpdate();
      for (const [i, r] of [a, b].entries()) {
        assert.equal(caminhoMovimentoBloqueado(scene, r, r, anteriores[i]), false, "passo respeita paredes");
      }
      assert.ok(Math.abs(a.x - b.x) >= 33.5 || Math.abs(a.y - b.y) >= 33.5, "corpos separados");
    }
    t.diagnostic(JSON.stringify({ inverter, a: [a.x, a.y], b: [b.x, b.y] }));
    assert.ok(a.y > -4775 && b.y < -4943, "ambos atravessaram e retomaram a perseguição");
  }
});
