/**
 * Reconhece uma instância pela relação entre as coordenadas do mapa e as peças na folha
 * original. Carros diferentes continuam separados mesmo quando seus tiles se encostam.
 */
export function vehicleInstanceKey(map, tile, x, y, width, height) {
  const tileset = tile.tileset ?? map.tilesets?.find(set => tile.index >= set.firstgid &&
    tile.index < set.firstgid + (set.total ?? set.tilecount));
  if (!tileset?.columns) return undefined;
  const local = tile.index - tileset.firstgid;
  const flipX = tile.flipX ? -1 : 1, flipY = tile.flipY ? -1 : 1;
  const rotation = tile.rotation ?? 0;
  const sourceX = (local % tileset.columns) * width * flipX;
  const sourceY = Math.floor(local / tileset.columns) * height * flipY;
  const anchorX = x - (Math.cos(rotation) * sourceX - Math.sin(rotation) * sourceY);
  const anchorY = y - (Math.sin(rotation) * sourceX + Math.cos(rotation) * sourceY);
  const rounded = value => Math.round(value * 1e6) / 1e6;
  return `${tileset.firstgid}:${flipX}:${flipY}:${rounded(rotation)}:${rounded(anchorX)}:${rounded(anchorY)}`;
}

/**
 * Seleciona da camada complementar apenas os grupos que encostam nos veículos principais.
 * Sobreposição e contato por uma borda conectam os tiles; contato só pela quina não conecta.
 */
export function connectedVehicleRects(vehicles, attachments, cellSize = 48, assignVehicleId = false) {
  if (!vehicles.length || !attachments.length) return [];
  const epsilon = 1e-6;
  const index = new Map();
  const buckets = rect => {
    const keys = [];
    for (let y = Math.floor((rect.y - epsilon) / cellSize); y <= Math.floor((rect.y + rect.height + epsilon) / cellSize); y++) {
      for (let x = Math.floor((rect.x - epsilon) / cellSize); x <= Math.floor((rect.x + rect.width + epsilon) / cellSize); x++) {
        keys.push(`${x},${y}`);
      }
    }
    return keys;
  };
  attachments.forEach((rect, position) => {
    for (const key of buckets(rect)) {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(position);
    }
  });
  const selected = new Uint8Array(attachments.length);
  const resolved = attachments.slice();
  const queue = [...vehicles];
  for (let head = 0; head < queue.length; head++) {
    const rect = queue[head];
    for (const key of buckets(rect)) {
      for (const position of index.get(key) ?? []) {
        if (selected[position]) continue;
        const candidate = attachments[position];
        if (rect.vehicleId || candidate.vehicleId) {
          const compatible = assignVehicleId
            ? rect.vehicleId?.split(":")[0] === candidate.vehicleId?.split(":")[0]
            : rect.vehicleId === candidate.vehicleId;
          if (!compatible) continue;
        }
        const overlapX = Math.min(rect.x + rect.width, candidate.x + candidate.width) - Math.max(rect.x, candidate.x);
        const overlapY = Math.min(rect.y + rect.height, candidate.y + candidate.height) - Math.max(rect.y, candidate.y);
        if ((overlapX > epsilon && overlapY >= -epsilon) ||
            (overlapY > epsilon && overlapX >= -epsilon)) {
          selected[position] = 1;
          resolved[position] = assignVehicleId && rect.vehicleId
            ? { ...candidate, vehicleId: rect.vehicleId } : candidate;
          queue.push(resolved[position]);
        }
      }
    }
  }
  return resolved.filter((_, position) => selected[position]);
}

/**
 * Resume cada grupo conectado em um corpo retangular sólido. Assim o veículo recebe
 * um único contorno, sem linhas internas entre suas partes ou pequenos recortes.
 */
export function solidVehicleBlocks(rects) {
  const pending = new Set(rects);
  const blocks = [];
  while (pending.size) {
    const first = pending.values().next().value;
    pending.delete(first);
    const group = [first, ...connectedVehicleRects([first], [...pending])];
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const rect of group) {
      pending.delete(rect);
      left = Math.min(left, rect.x);
      top = Math.min(top, rect.y);
      right = Math.max(right, rect.x + rect.width);
      bottom = Math.max(bottom, rect.y + rect.height);
    }
    blocks.push({ kind: "vehicles", x: left, y: top, width: right - left, height: bottom - top });
  }
  return blocks;
}
