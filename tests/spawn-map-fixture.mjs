/** Dados Tiled e StaticBody da biblioteca real, sem carregar texturas ou iniciar o jogo. */
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import vm from 'node:vm';
import { criarColisoesCidade, criarColisoesFabrica } from '../js/map/ColisoesMapa.js';

const source = readFileSync(new URL('../js/libs/phaser.min.js', import.meta.url), 'utf8');
const context = { module: { exports: {} }, exports: {} };
vm.runInNewContext(source.replace('i(85454)})());', 'i})());'), context);
const load = context.module.exports, StaticBody = load(72624);
export const parseObjectLayers = load(22611);
export const geometriaSpawnPhaser = { Geom: { Rectangle: load(93232),
  Intersects: { RectangleToRectangle: load(59996) } }, Math: { Between: (a, b) => Math.floor((a + b) / 2) },
  Scenes: { Events: { SHUTDOWN: 'shutdown' } } };

export function carregarMapaSpawns(arquivo) {
  const raw = JSON.parse(readFileSync(new URL(`../assets/map/${arquivo}`, import.meta.url)));
  const objetos = load(22611)(structuredClone(raw));
  const map = { tileWidth: raw.tilewidth, tileHeight: raw.tileheight, tilesets: raw.tilesets,
    objects: objetos, getObjectLayer: name => objetos.find(l => l.name === name),
    layers: raw.layers.filter(l => l.type === 'tilelayer').map(l => ({ name: l.name, tilemapLayer: {
      forEachTile(fn) {
        for (const c of l.chunks ?? []) {
          const data = Buffer.from(c.data, 'base64');
          for (let i = 0; i < c.width * c.height; i++) {
            const index = data.readUInt32LE(i * 4) & 0x1fffffff;
            if (index) fn({ x: c.x + i % c.width, y: c.y + Math.floor(i / c.width), index });
          }
        }
      },
      tileToWorldXY(x, y) { return { x: x * raw.tilewidth + (l.offsetx ?? 0), y: y * raw.tileheight + (l.offsety ?? 0) }; },
    } })),
  };
  const corpos = new Set(), children = [];
  const world = { defaults: {}, staticTree: {
    insert: b => corpos.add(b), remove: b => corpos.delete(b),
    search: a => [...corpos].filter(b => b.x < a.maxX && b.x + b.width > a.minX && b.y < a.maxY && b.y + b.height > a.minY),
  } };
  const grupo = { getChildren: () => children, contains: o => children.includes(o), create(x, y) {
    const o = { x, y, originX: .5, originY: .5, displayWidth: 32, displayHeight: 32,
      frame: { realWidth: 32, realHeight: 32 },
      getTopLeft(p) { return p.set(this.x - this.displayWidth / 2, this.y - this.displayHeight / 2); },
      getCenter() { return { x: this.x, y: this.y }; },
      setDisplaySize(w, h) { this.displayWidth = w; this.displayHeight = h; return this; },
      setVisible() { return this; }, refreshBody() { this.body.updateFromGameObject(); return this; },
      setData() { return this; },
    };
    o.body = new StaticBody(world, o); corpos.add(o.body); children.push(o); return o;
  } };
  const scene = { map, inimigos: [], player: { active: true, x: 10000, y: 10000 }, vida: 100,
    events: new EventEmitter(), time: { now: 0 }, luzFabricaAcesa: true,
    cache: { tilemap: { get: () => ({ data: raw }) } }, physics: { world, add: { staticGroup: () => grupo } } };
  (arquivo.startsWith('Inicio') ? criarColisoesCidade : criarColisoesFabrica)(scene, map);
  return { scene, map, raw, corpos };
}
