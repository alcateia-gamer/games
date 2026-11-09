import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { candidatosAreaRoboBola, criarSpawnAreasRoboBola, distanciaAteAreaRoboBola,
  lerAreasRoboBola, pontoLivreAreaRoboBola, quantidadeRobosArea } from "./RoboBolaSpawnAreas.js";

function preparar(area = { id: 1, x: 0, y: 0, width: 500, height: 600 }) {
  const scene = { map: { getObjectLayer: () => ({ objects: Array.isArray(area) ? area : [area] }), layers: [] },
    events: new EventEmitter(), time: { now: 0 }, inimigos: [], vida: 100,
    luzFabricaAcesa: true, player: { x: -150, y: 200, active: true } };
  const criar = (_s, ponto) => {
    const robo = { ...ponto, active: true }; scene.inimigos.push(robo); return robo;
  };
  return { scene, sistema: criarSpawnAreasRoboBola(scene, criar) };
}

test("aproximação usa a borda e os cantos do retângulo, não a distância ao centro", () => {
  const a = { x: 0, y: 0, width: 1000, height: 1000 };
  assert.equal(distanciaAteAreaRoboBola({ x: -180, y: 900 }, a), 180);
  assert.equal(distanciaAteAreaRoboBola({ x: 500, y: 500 }, a), 0);
  assert.equal(distanciaAteAreaRoboBola({ x: -30, y: -40 }, a), 50);
});

test("gerador desligado e aproximação distante nunca ativam a onda", () => {
  const { scene, sistema } = preparar();
  scene.luzFabricaAcesa = false;
  sistema.atualizar(5000);
  assert.equal(sistema.snapshot()[0].ativada, false);
  scene.luzFabricaAcesa = true; scene.player.x = -181;
  sistema.atualizar(5000);
  assert.equal(scene.inimigos.length, 0);
  scene.player.x = -180;
  sistema.atualizar(16);
  assert.equal(scene.inimigos.length, 1, "ativa do lado de fora pela borda");
});

test("área define quantidades proporcionais com limite de sete", () => {
  assert.equal(quantidadeRobosArea({ width: 57, height: 61 }), 1);
  assert.equal(quantidadeRobosArea({ width: 200, height: 300 }), 2);
  assert.equal(quantidadeRobosArea({ width: 500, height: 600 }), 7);
  assert.equal(quantidadeRobosArea({ width: 10000, height: 10000 }), 7);
});

test("onda é progressiva e reaproximação não repõe robôs mortos", () => {
  const { scene, sistema } = preparar();
  sistema.atualizar(1);
  assert.equal(scene.inimigos.length, 1);
  sistema.atualizar(449);
  assert.equal(scene.inimigos.length, 1);
  for (let i = 0; i < 30; i++) sistema.atualizar(450);
  assert.equal(scene.inimigos.length, 7);
  scene.inimigos.forEach(r => { r.morto = true; });
  scene.player.x = -1000; sistema.atualizar(1000);
  scene.player.x = -150; sistema.atualizar(1000);
  assert.equal(scene.inimigos.length, 7);
});

test("corpo inteiro cabe inclusive nos retângulos estreitos e evita obstáculo interno", () => {
  const area = { x: 0, y: 0, width: 57, height: 61 };
  for (const p of candidatosAreaRoboBola(area)) {
    assert.ok(p.x - 16.8 >= 0 && p.x + 16.8 <= 57);
    assert.ok(p.y - 16.8 >= 0 && p.y + 16.8 <= 61);
  }
  const { scene, sistema } = preparar({ id: 2, x: 0, y: 0, width: 400, height: 400 });
  scene.collisionGroup = { getChildren: () => [{ body: { x: 100, y: 100, width: 200, height: 200 } }] };
  for (let i = 0; i < 10; i++) sistema.atualizar(450);
  assert.equal(scene.inimigos.length, 4);
  for (const p of scene.inimigos) {
    assert.ok(p.x + 16.8 <= 100 || p.x - 16.8 >= 300 || p.y + 16.8 <= 100 || p.y - 16.8 >= 300);
  }
});

test("área ocupada aguarda e completa a onda depois que o jogador se afasta", () => {
  const { scene, sistema } = preparar({ id: 3, x: 0, y: 0, width: 57, height: 61 });
  scene.player.x = 28; scene.player.y = 30;
  sistema.atualizar(1000);
  assert.equal(sistema.snapshot()[0].ativada, true);
  assert.equal(scene.inimigos.length, 0);
  scene.player.x = -100;
  sistema.atualizar(450);
  assert.equal(scene.inimigos.length, 1);
});

test("parede total e piso ausente não geram robôs sobre colisões nem no vazio", () => {
  const { scene, sistema } = preparar();
  scene.collisionGroup = { getChildren: () => [{ body: { x: 0, y: 0, width: 500, height: 600 } }] };
  sistema.atualizar(1000);
  assert.equal(scene.inimigos.length, 0);
  assert.equal(pontoLivreAreaRoboBola(scene, { x: 600, y: 600 }, { contem: () => false }), false);
});

test("host pode ativar por aliado remoto; cliente, morte e shutdown não criam inimigos", () => {
  const { scene, sistema } = preparar();
  scene.multiplayer = true; scene.isMultiplayerHost = false;
  sistema.atualizar(1000); assert.equal(scene.inimigos.length, 0);
  scene.isMultiplayerHost = true; scene.vida = 0;
  sistema.atualizar(1000); assert.equal(scene.inimigos.length, 0);
  scene.vida = 100; scene.player.x = -2000;
  scene.remotePlayers = new Map([["aliado", { active: true, x: -150, y: 200 }]]);
  sistema.atualizar(1000); assert.equal(scene.inimigos.length, 1);
  scene.events.emit("shutdown");
  sistema.atualizar(1000); assert.equal(scene.inimigos.length, 1);
  assert.equal(scene.events.listenerCount("shutdown"), 0);
});

test("mapa real contém 18 áreas; todas têm candidatos livres ao redor das colisões", () => {
  const dados = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const scene = { map: { getObjectLayer: nome => dados.layers.find(l => l.name === nome) },
    player: { x: 10000, y: 10000, active: true }, inimigos: [],
    collisionGroup: { getChildren: () => dados.layers.find(l => l.name === "collision").objects
      .filter(o => o.width && o.height).map(o => ({ body: o })) } };
  const areas = lerAreasRoboBola(scene.map);
  assert.equal(areas.length, 18);
  for (const a of areas) {
    assert.ok(quantidadeRobosArea(a) <= 7);
    assert.ok(candidatosAreaRoboBola(a).some(p => pontoLivreAreaRoboBola(scene, p)), `área ${a.id}`);
  }
});

test("três retângulos junto de (-1067, -4478) compartilham sete spawns por visita", () => {
  const dados = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const { scene, sistema } = preparar(dados.layers.find(l => l.name === "SpawnRoboBola").objects);
  const ids = [1625, 1629, 1630];
  const cotas = sistema.snapshot().filter(a => ids.includes(a.id));
  assert.deepEqual(cotas.map(a => [a.id, a.total]), [[1625, 2], [1629, 2], [1630, 3]]);
  assert.equal(sistema.snapshot().find(a => a.id === 1627).total, 3, "retângulo vizinho conserva sua quantidade");
  for (const [x, y] of [[-1067, -4478], [-1100, -4180], [-1067, -4478]]) {
    Object.assign(scene.player, { x, y });
    for (let i = 0; i < 30; i++) sistema.atualizar(450);
  }
  const robosRegiao = scene.inimigos.filter(r => ids.includes(r.spawnAreaRoboBolaId));
  assert.equal(robosRegiao.length, 7);
  robosRegiao.forEach(r => { r.morto = true; });
  for (let i = 0; i < 30; i++) sistema.atualizar(450);
  assert.equal(scene.inimigos.filter(r => ids.includes(r.spawnAreaRoboBolaId)).length, 7,
    "derrotar os robôs não libera mais spawns nos retângulos da região");
});
