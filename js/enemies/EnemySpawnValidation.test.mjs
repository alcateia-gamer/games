import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarMapaSpawns, geometriaSpawnPhaser, parseObjectLayers } from '../../tests/spawn-map-fixture.mjs';
import EnemySpawnManager from './EnemySpawnManager.js';
import { areaContemCorpo } from './EnemySpawnArea.js';
import { obterPisoSpawnRobos, retanguloSpawnLivre, ampliarAreaNascimento, FOLGA_SPAWN_ROBOS,
  separacaoSpawnRobos } from './EnemySpawnValidation.js';
import { retanguloLivreDoMapa } from './EnemyPathfinding.js';
import { candidatosAreaRoboBola, criarSpawnAreasRoboBola, lerAreasRoboBola, pontoLivreAreaRoboBola } from './RoboBolaSpawnAreas.js';
globalThis.Phaser = geometriaSpawnPhaser;

test('sete zonas da cidade usam o piso real e os corpos estáticos corrigidos', t => {
  let seed = 741;
  t.mock.method(Math, 'random', () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32));
  const { scene, map } = carregarMapaSpawns('InicioFase1 (1).json');
  const manager = new EnemySpawnManager(scene, map), piso = obterPisoSpawnRobos(scene);
  assert.equal(manager.regions.length, 7); assert.ok(piso);
  const resultados = [];
  for (const r of manager.regions) for (const tipo of ['padrao', 'serra']) {
    let aceitos = 0;
    for (let i = 0; i < 60; i++) {
      const p = manager.findPosition(r, tipo, []);
      if (!p) continue;
      assert.equal(manager.autorizarCriacao({ ...p, tipoRobo: tipo, spawnZoneId: r.id }), true);
      const w = tipo === 'serra' ? 278 * .36 : 311 * .23;
      const h = tipo === 'serra' ? 270 * .36 : 421 * .23;
      const rect = new Phaser.Geom.Rectangle(p.x - w / 2, p.y - h / 2, w, h);
      assert.ok(areaContemCorpo(ampliarAreaNascimento(r.area), rect)); assert.ok(piso.contem(rect));
      assert.ok(retanguloLivreDoMapa(scene, rect)); aceitos++;
    }
    resultados.push({ id: r.id, tipo, aceitos });
  }
  assert.ok(resultados.every(r => r.aceitos > 0), JSON.stringify(resultados));
});

test('18 áreas da fábrica: candidatos e ondas nunca nascem no vazio ou dentro da colisão', () => {
  const { scene } = carregarMapaSpawns('parte2-fase1.json'), piso = obterPisoSpawnRobos(scene);
  const areas = lerAreasRoboBola(scene.map); assert.equal(areas.length, 18);
  for (const a of areas) {
    const livres = candidatosAreaRoboBola(a, undefined, 8).filter(p => pontoLivreAreaRoboBola(scene, p, piso));
    assert.ok(livres.length, `área ${a.id} precisa ter ao menos um ponto seguro`);
    for (const p of livres) {
      const rect = new Phaser.Geom.Rectangle(p.x - 36.8, p.y - 36.8, 73.6, 73.6);
      assert.ok(areaContemCorpo(ampliarAreaNascimento(a), rect));
      assert.ok(piso.contem(rect)); assert.ok(retanguloLivreDoMapa(scene, rect));
    }
  }
  const sistema = criarSpawnAreasRoboBola(scene, (_scene, p) => {
    assert.ok(pontoLivreAreaRoboBola(scene, p, piso));
    const robo = { ...p, active: true, tipoRobo: 'bola' }; scene.inimigos.push(robo); return robo;
  });
  for (const a of areas) {
    Object.assign(scene.player, { x: a.x - 120, y: a.y + a.height / 2 });
    for (let i = 0; i < 25; i++) sistema.atualizar(450);
  }
  assert.ok(scene.inimigos.length > 0);
  for (const p of scene.inimigos) {
    const a = areas.find(a => a.id === p.spawnAreaRoboBolaId);
    assert.ok(areaContemCorpo(ampliarAreaNascimento(a), new Phaser.Geom.Rectangle(p.x - 36.8, p.y - 36.8, 73.6, 73.6)));
  }
  assert.ok(sistema.snapshot().every(a => a.invocados <= a.total && a.total <= 7));
  assert.ok(sistema.snapshot().filter(a => [1625, 1629, 1630].includes(a.id)).reduce((s, a) => s + a.invocados, 0) <= 7);
  sistema.destruir();
});

test('decoração e sombras sobre o vazio não autorizam spawns; consulta exige corpo inteiro no piso', () => {
  const layer = (name, cells) => ({ name, tilemapLayer: {
    forEachTile: fn => cells.forEach(([x, y]) => fn({ x, y, index: 1 })),
    tileToWorldXY: (x, y) => ({ x: x * 48, y: y * 48 }),
  } });
  for (const name of ['Chão', 'chão']) {
    const scene = { map: { tileWidth: 48, tileHeight: 48,
      layers: [layer(name, [[-1, -1]]), layer('Teto', [[0, 0]]), layer('SombraGeral', [[1, 1]])] } };
    assert.equal(retanguloSpawnLivre(scene, { x: -40, y: -40, width: 20, height: 20 }), true);
    for (const [x, y] of [[5, 5], [55, 55], [-5, -5], [100000, 100000]])
      assert.equal(retanguloSpawnLivre(scene, { x, y, width: 20, height: 20 }), false);
  }
});

test('a mesma quantidade de corpos não reaproveita colisões de uma porta removida ou movida', () => {
  let children = [{ body: { x: 0, y: 0, width: 20, height: 20 } }];
  const scene = { collisionGroup: { getChildren: () => children } };
  const rect = { x: 0, y: 0, width: 10, height: 10 };
  assert.equal(retanguloSpawnLivre(scene, rect), false);
  children[0].body.x = 100; assert.equal(retanguloSpawnLivre(scene, rect), true);
  children = [{ body: { x: 0, y: 0, width: 20, height: 20 } }];
  assert.equal(retanguloSpawnLivre(scene, rect), false);
});

test('escudo ativo do boss também impede materializar robôs na área bloqueada', () => {
  const body = { enable: true, isCircle: true, center: { x: 50, y: 50 }, radius: 30 };
  const scene = { novoBoss: { sistemaGeradores: { corpoBarreira: body } } };
  assert.equal(retanguloSpawnLivre(scene, { x: 30, y: 30, width: 20, height: 20 }), false);
  body.enable = false;
  assert.equal(retanguloSpawnLivre(scene, { x: 30, y: 30, width: 20, height: 20 }), true);
});

test('áreas do robô-bola herdam offsets do parser uma única vez, inclusive em grupos', () => {
  const { raw } = carregarMapaSpawns('parte2-fase1.json');
  const layer = raw.layers.find(l => l.name === 'SpawnRoboBola');
  const original = layer.objects[0];
  raw.layers = [{ type: 'group', name: 'grupo', x: 0, y: 0, offsetx: 100, offsety: -200,
    opacity: 1, visible: true, layers: [{ ...layer, offsetx: 20, offsety: 30 }] }];
  const parsed = parseObjectLayers(raw), areas = lerAreasRoboBola({ objects: parsed });
  assert.equal(areas[0].x, original.x + 120); assert.equal(areas[0].y, original.y - 170);
});

test('distância entre centros não libera sprites sobrepostos nem encostados pela diagonal', () => {
  const origem = { x: 0, y: 0 }, rect = { x: -50, y: -50, width: 100, height: 100 };
  const scene = { inimigos: [{ x: 86, y: 86, active: true, displayWidth: 100, displayHeight: 100 }] };
  assert.ok(Math.hypot(86, 86) > FOLGA_SPAWN_ROBOS.distancia);
  assert.equal(separacaoSpawnRobos(scene, origem, rect), false);
  scene.inimigos[0].x = 150; scene.inimigos[0].y = 0;
  assert.equal(separacaoSpawnRobos(scene, origem, rect), true);
  scene.inimigos[0].x = 123;
  assert.equal(separacaoSpawnRobos(scene, origem, rect), false, 'folga visível de ao menos 24px');
});

test('entorno acompanha a rotação do retângulo sem alterar a área original', () => {
  const area = { x: 100, y: -200, width: 20, height: 40, rotation: Math.PI / 2 };
  const expandida = ampliarAreaNascimento(area, 50);
  assert.equal(area.x, 100); assert.equal(area.width, 20);
  assert.equal(expandida.width, 120); assert.equal(expandida.height, 140);
  assert.ok(Math.abs(expandida.x - 150) < 1e-6 && Math.abs(expandida.y + 250) < 1e-6);
});
