/**
 * Junta pisos vizinhos em retângulos maiores sem preencher buracos, curvas ou áreas vazias.
 */
export function mergeMiniMapRects(rects) {
  const sorted = rects.map(rect => ({ ...rect })).sort((a, b) =>
    a.kind.localeCompare(b.kind) || a.y - b.y || a.height - b.height || a.x - b.x);
  const rows = [];
  for (const rect of sorted) {
    const previous = rows.at(-1);
    if (previous && previous.kind === rect.kind && previous.y === rect.y &&
        previous.height === rect.height && rect.x <= previous.x + previous.width + 1e-6) {
      previous.width = Math.max(previous.x + previous.width, rect.x + rect.width) - previous.x;
    } else rows.push(rect);
  }
  rows.sort((a, b) => a.y - b.y || a.x - b.x);
  const columns = new Map(), blocks = [];
  for (const rect of rows) {
    const key = `${rect.kind}:${rect.x}:${rect.width}`;
    const previous = columns.get(key);
    if (previous && Math.abs(previous.y + previous.height - rect.y) < 1e-6) {
      previous.height += rect.height;
    } else {
      blocks.push(rect);
      columns.set(key, rect);
    }
  }
  return blocks;
}

/**
 * Mantém a calçada inteira quando existe uma passagem para ela. Objetos sobre esse piso
 * não deixam recortes no desenho final do radar.
 */
export function connectedSidewalkBlocks(sidewalks, connected, bounds, scale, width, height) {
  return sidewalks.filter(rect => {
    const left = Math.max(0, Math.ceil((rect.x - bounds.x) * scale - 0.5));
    const right = Math.min(width, Math.ceil((rect.x + rect.width - bounds.x) * scale - 0.5));
    const top = Math.max(0, Math.ceil((rect.y - bounds.y) * scale - 0.5));
    const bottom = Math.min(height, Math.ceil((rect.y + rect.height - bounds.y) * scale - 0.5));
    for (let y = top; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        if (connected[(y * width + x) * 4 + 3] >= 250) return true;
      }
    }
    return false;
  });
}

/**
 * Conserva paredes e cercas compridas, ignorando colisões pequenas e corpos de veículos.
 * A espessura mínima mantém a separação legível mesmo com o radar reduzido.
 */
export function miniMapBarriers(shapes, vehicles = [], minimumThickness = 0) {
  return shapes.filter(shape => {
    const longest = Math.max(shape.width, shape.height);
    const shortest = Math.min(shape.width, shape.height);
    if (!(shortest > 0) || longest < 144 || longest / shortest < 4) return false;
    return !vehicles.some(vehicle => shape.x >= vehicle.x - 1 && shape.y >= vehicle.y - 1 &&
      shape.x + shape.width <= vehicle.x + vehicle.width + 1 &&
      shape.y + shape.height <= vehicle.y + vehicle.height + 1);
  }).map(shape => {
    if (shape.points) return shape;
    const width = Math.max(shape.width, minimumThickness);
    const height = Math.max(shape.height, minimumThickness);
    return { ...shape, x: shape.x - (width - shape.width) / 2,
      y: shape.y - (height - shape.height) / 2, width, height };
  });
}
