import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { criarColisoesFabrica } from '../map/ColisoesMapa.js';
import { retanguloLivreDoMapa } from '../enemies/EnemyPathfinding.js';
import { TERMINAIS_HACKING } from './HackingConfig.js';

test('estação EV-041 na posição exigida é alcançável no piso real sem atravessar colisões Tiled', () => {
  const raw = JSON.parse(readFileSync(new URL('../../assets/map/parte2-fase1.json', import.meta.url)));
  const children = [];
  const scene = { cache: { tilemap: { get: () => ({ data: raw }) } }, physics: { add: { staticGroup: () => ({
    getChildren: () => children,
    create(x, y) { const obj = { x, y, setDisplaySize(w, h) { this.w = w; this.h = h; return this; },
      setVisible() { return this; }, refreshBody() { this.body = { x: x - this.w / 2, y: y - this.h / 2, width: this.w, height: this.h, enable: true }; return this; } };
      children.push(obj); return obj;
    },
  }) } } };
  criarColisoesFabrica(scene, { getObjectLayer: name => raw.layers.find(l => l.name === name) });
  const floor = new Set();
  for (const layer of raw.layers.filter(l => ['chão', 'ChãoProdução'].includes(l.name))) for (const chunk of layer.chunks) {
    const data = Buffer.from(chunk.data, 'base64');
    for (let i = 0; i < chunk.width * chunk.height; i++) if (data.readUInt32LE(i * 4)) floor.add(`${chunk.x + i % chunk.width},${chunk.y + Math.floor(i / chunk.width)}`);
  }
  const t = TERMINAIS_HACKING.bruteforce; assert.deepEqual([t.x, t.y], [-378, -2996]);
  const livre = (x, y) => [[x - 11, y - 6], [x + 11, y - 6], [x - 11, y + 6], [x + 11, y + 6]]
    .every(([a, b]) => floor.has(`${Math.floor(a / 48)},${Math.floor(b / 48)}`)) &&
    retanguloLivreDoMapa(scene, { x: x - 11, y: y - 6, width: 22, height: 12 });
  const queue = [[996, -1872]], visited = new Set(['996,-1872']); let reached = false;
  for (let at = 0; at < queue.length && at < 150000; at++) {
    const [x, y] = queue[at];
    if (Math.hypot(x - t.x, y - t.y) < t.alcance - 24) { reached = true; break; }
    for (const [dx, dy] of [[12, 0], [-12, 0], [0, 12], [0, -12]]) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
      if (ny < -4100 || ny > -1300 || visited.has(key)) continue;
      visited.add(key); if (livre(nx, ny)) queue.push([nx, ny]);
    }
  }
  assert.ok(reached, `terminal inacessível, ${queue.length} pontos livres examinados`);
  assert.ok(children.some(c => c.tiledCollisionId === 559), 'a bancada continua sólida');
});
