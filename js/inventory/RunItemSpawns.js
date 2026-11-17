/** Uma escolha por item/partida, reproduzível em todos os clientes da sala. */
export const ITEM_SPAWN_SEED_KEY = 'nullborns:item-spawns:seed';
const required = { Level1: ['gasolina', 'bateria'], Level1Parte2: ['card'] };
// Pontos originais dos mapas: reserva se todos os candidatos forem removidos/inválidos.
const fallback = {
  gasolina: { x: 288.734848484852, y: -418.825757575758 },
  bateria: { x: -538.91666666667, y: 899 },
  card: { x: -164.333333333333, y: -3009.66666666667 },
};
export function getProperty(object, name) {
  return object.properties?.find(p => p.name?.toLowerCase() === name.toLowerCase())?.value;
}
export function getItemPosition(object) {
  if (object.point) return { x: object.x, y: object.y };
  const width = Number(object.width || 0), height = Number(object.height || 0);
  if (object.gid) return { x: object.x + width / 2, y: object.y - height / 2 };
  if (width > 0 && height > 0) return { x: object.x + width / 2, y: object.y + height / 2 };
  return { x: object.x, y: object.y };
}
export function createItemSpawnSeed() { return Math.floor(Math.random() * 0x100000000); }
export function itemSpawnSeedFor(scene) {
  if (scene.multiplayer && scene.multiplayerManager?.room) {
    const room = scene.multiplayerManager.room;
    // Compatibilidade com salas anteriores; nunca sorteia independentemente no cliente.
    return room.itemSpawnSeed ?? room.hollow?.id ?? room.roomCode;
  }
  const registry = scene.game.registry;
  let seed = registry.get(ITEM_SPAWN_SEED_KEY);
  if (seed == null) { seed = createItemSpawnSeed(); registry.set(ITEM_SPAWN_SEED_KEY, seed); }
  return seed;
}
function hash(value) {
  let h = 2166136261;
  for (const c of String(value)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15;
  return h >>> 0;
}
function valid(object) {
  const { x, y } = getItemPosition(object);
  const quantity = Number(getProperty(object, 'quantidade') ?? 1);
  const range = Number(getProperty(object, 'alcance') ?? 64);
  return Number.isFinite(x) && Number.isFinite(y) && Number.isInteger(quantity) && quantity > 0 && Number.isFinite(range) && range > 0;
}
/** Filtra antes de sortear: nenhum resultado vazio ou chance de não nascer. */
export function selectRunItemObjects(objects, mapKey, seed) {
  const ids = required[mapKey] || [];
  const chosen = objects.filter(o => !ids.includes(getProperty(o, 'itemId')));
  for (const itemId of ids) {
    const candidates = objects.filter(o => getProperty(o, 'itemId') === itemId && valid(o))
      .sort((a, b) => String(a.id).localeCompare(String(b.id), 'en') || a.x - b.x || a.y - b.y);
    if (!candidates.length) candidates.push({
      id: `fallback-${itemId}`, point: true, ...fallback[itemId],
      properties: [{ name: 'ItemID', value: itemId }, { name: 'Quantidade', value: 1 }],
    });
    chosen.push(candidates[hash(`${seed}:${mapKey}:${itemId}`) % candidates.length]);
  }
  return chosen;
}
