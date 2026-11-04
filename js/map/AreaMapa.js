/** Contorno dos tiles desenhados: ignora paredes internas, mas exclui o vazio do mapa. */
export function criarAreaMapa(map) {
  const width = map.tileWidth;
  const height = map.tileHeight;
  const cells = new Set();
  const centers = [];
  for (const data of map.layers ?? []) {
    const layer = data.tilemapLayer;
    if (!layer?.forEachTile) continue;
    layer.forEachTile(tile => {
      if (!tile || tile.index < 0) return;
      const world = layer.tileToWorldXY(tile.x, tile.y);
      const x = Math.floor(world.x / width), y = Math.floor(world.y / height);
      const key = `${x},${y}`;
      if (cells.has(key)) return;
      cells.add(key);
      centers.push({ x: (x + 0.5) * width, y: (y + 0.5) * height });
    });
  }
  if (!cells.size) return null;
  return {
    contem(rect) {
      const minX = Math.floor(rect.x / width), minY = Math.floor(rect.y / height);
      const maxX = Math.floor((rect.x + rect.width - 1e-6) / width);
      const maxY = Math.floor((rect.y + rect.height - 1e-6) / height);
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        if (!cells.has(`${x},${y}`)) return false;
      }
      return true;
    },
    centroMaisProximo(x, y) {
      let nearest = centers[0], distance = Infinity;
      for (const point of centers) {
        const next = (point.x - x) ** 2 + (point.y - y) ** 2;
        if (next < distance) { nearest = point; distance = next; }
      }
      return nearest;
    },
  };
}
