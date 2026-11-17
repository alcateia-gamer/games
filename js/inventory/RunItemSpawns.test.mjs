import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { selectRunItemObjects, getProperty, getItemPosition, itemSpawnSeedFor, ITEM_SPAWN_SEED_KEY } from './RunItemSpawns.js';
const maps = [
  ['Level1', 'InicioFase1 (1).json', ['gasolina', 'bateria']],
  ['Level1Parte2', 'parte2-fase1.json', ['card']],
];
for (const [key, file, ids] of maps) test(`${key}: mapas reais, um spawn garantido por item e escolhas persistentes para host/cliente`, () => {
  const data = JSON.parse(readFileSync(new URL(`../../assets/map/${file}`, import.meta.url)));
  const objects = data.layers.filter(l => ['Itens', 'Coletaveis'].includes(l.name)).flatMap(l => l.objects);
  const seen = Object.fromEntries(ids.map(id => [id, new Set()]));
  for (let seed = 0; seed < 1000; seed++) {
    const selected = selectRunItemObjects(objects, key, seed);
    assert.deepEqual(selected.filter(o => ids.includes(getProperty(o, 'itemId'))),
      selectRunItemObjects([...objects].reverse(), key, seed).filter(o => ids.includes(getProperty(o, 'itemId'))));
    assert.deepEqual(selected, selectRunItemObjects(objects, key, seed));
    for (const id of ids) {
      const items = selected.filter(o => getProperty(o, 'itemId') === id);
      assert.equal(items.length, 1); assert.ok(objects.includes(items[0]));
      seen[id].add(items[0].id); assert.ok(Number.isFinite(getItemPosition(items[0]).x));
    }
  }
  for (const id of ids) assert.equal(seen[id].size, 4, `todos os pontos de ${id} participam`);
});
test('pontos inválidos não podem impedir spawn; sem pontos usa posição original de reserva', () => {
  for (const objects of [[], [{ id: 1, x: NaN, y: 0, properties: [{ name: 'ItemID', value: 'gasolina' }] }]]) {
    const items = selectRunItemObjects(objects, 'Level1', 0);
    for (const id of ['gasolina', 'bateria']) {
      const selected = items.filter(o => getProperty(o, 'itemId') === id);
      assert.equal(selected.length, 1); assert.ok(Number.isFinite(selected[0].x));
    }
  }
});
test('preserva outros objetos e não modifica mapas; objetos Tiled mantêm coordenadas corretas', () => {
  const other = { id: 9, name: 'porta' }, objects = [other];
  const before = structuredClone(objects); const selected = selectRunItemObjects(objects, 'Level1Parte2', 1);
  assert.ok(selected.includes(other)); assert.deepEqual(objects, before);
  assert.deepEqual(getItemPosition({ x: 10, y: 20, width: 30, height: 40, gid: 3 }), { x: 25, y: 0 });
  assert.deepEqual(getItemPosition({ x: 10, y: 20, width: 30, height: 40 }), { x: 25, y: 40 });
});
test('semente solo permanece na run e reinicia quando removida; clientes usam a semente do host', () => {
  const registry = new Map(), scene = { game: { registry } };
  const seed = itemSpawnSeedFor(scene); assert.equal(itemSpawnSeedFor(scene), seed);
  registry.delete(ITEM_SPAWN_SEED_KEY); registry.set(ITEM_SPAWN_SEED_KEY, 123);
  assert.equal(itemSpawnSeedFor(scene), 123);
  for (const playerId of ['host', 'guest']) assert.equal(itemSpawnSeedFor({ multiplayer: true,
    multiplayerManager: { playerId, room: { itemSpawnSeed: 9087 } } }), 9087);
});
