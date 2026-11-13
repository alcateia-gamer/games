/** Contorno dos tiles desenhados: ignora paredes internas, mas exclui o vazio do mapa. */
export function criarAreaMapa(map, { incluirCamada = () => true, bloquearTile = () => false } = {}) {
  const width = map.tileWidth;
  const height = map.tileHeight;
  const cells = new Set();
  const centers = [];
  const blocked = new Set();
  for (const data of map.layers ?? []) {
    const layer = data.tilemapLayer;
    if (!layer?.forEachTile) continue;
    layer.forEachTile(tile => {
      if (!tile || tile.index < 0) return;
      const world = layer.tileToWorldXY(tile.x, tile.y);
      const x = Math.floor(world.x / width), y = Math.floor(world.y / height);
      const key = `${x},${y}`;
      if (bloquearTile(data, tile)) blocked.add(key);
      if (!incluirCamada(data) || cells.has(key)) return;
      cells.add(key);
      centers.push({ x: (x + 0.5) * width, y: (y + 0.5) * height });
    });
  }
  for (const key of blocked) cells.delete(key);
  if (!cells.size) return null;
  const bounds = centers.reduce((b, p) => ({
    left: Math.min(b.left, p.x - width / 2), top: Math.min(b.top, p.y - height / 2),
    right: Math.max(b.right, p.x + width / 2), bottom: Math.max(b.bottom, p.y + height / 2),
  }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const visitar = (rect, todos) => {
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) ||
        rect.width <= 0 || rect.height <= 0) return false;
    if (rect.x + rect.width <= bounds.left || rect.y + rect.height <= bounds.top ||
        rect.x >= bounds.right || rect.y >= bounds.bottom) return false;
    const minX = Math.floor(rect.x / width), minY = Math.floor(rect.y / height);
    const maxX = Math.floor((rect.x + rect.width - 1e-6) / width);
    const maxY = Math.floor((rect.y + rect.height - 1e-6) / height);
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const dentro = cells.has(`${x},${y}`);
      if (todos && !dentro) return false;
      if (!todos && dentro) return true;
    }
    return todos;
  };
  return {
    bounds,
    contem: rect => visitar(rect, true),
    intersecta: rect => visitar(rect, false),
    /** Varre o corpo inteiro; para no primeiro recorte do contorno, mesmo em frames longos. */
    limitarPasso(inicio, fim, bodyWidth, bodyHeight) {
      const dx = fim.x - inicio.x, dy = fim.y - inicio.y;
      const distancia = Math.hypot(dx, dy);
      if (!Number.isFinite(distancia)) return { x: inicio.x, y: inicio.y };
      // Primeiro limita o segmento pelo AABB; não itera até coordenadas corrompidas.
      let limite = 1;
      for (const [origem, delta, min, max] of [[inicio.x, dx, bounds.left, bounds.right - bodyWidth],
        [inicio.y, dy, bounds.top, bounds.bottom - bodyHeight]]) {
        if (delta < 0) limite = Math.min(limite, (min - origem) / delta);
        if (delta > 0) limite = Math.min(limite, (max - origem) / delta);
      }
      limite = Math.max(0, Math.min(1, limite));
      const passos = Math.max(1, Math.ceil(distancia * limite / (Math.min(width, height) / 2)));
      const rect = { x: inicio.x, y: inicio.y, width: bodyWidth, height: bodyHeight };
      let seguro = 0;
      for (let i = 1; i <= passos; i++) {
        const t = limite * i / passos;
        rect.x = inicio.x + dx * t; rect.y = inicio.y + dy * t;
        if (!visitar(rect, true)) {
          let baixo = seguro, alto = t;
          for (let j = 0; j < 18; j++) {
            const meio = (baixo + alto) / 2;
            rect.x = inicio.x + dx * meio; rect.y = inicio.y + dy * meio;
            if (visitar(rect, true)) baixo = meio; else alto = meio;
          }
          return { x: inicio.x + dx * baixo, y: inicio.y + dy * baixo };
        }
        seguro = t;
      }
      return { x: inicio.x + dx * limite, y: inicio.y + dy * limite };
    },
    centroMaisProximo(x, y) {
      let nearest = centers[0], distance = Infinity;
      for (const point of centers) {
        if (!cells.has(`${Math.floor(point.x / width)},${Math.floor(point.y / height)}`)) continue;
        const next = (point.x - x) ** 2 + (point.y - y) ** 2;
        if (next < distance) { nearest = point; distance = next; }
      }
      return nearest;
    },
  };
}

/** Cidade: sombras não são piso. Apenas os dois tiles opacos da camada Sombra
 * representam o fechamento externo; SombraGeral é um véu translúcido sobre toda a cidade. */
export function criarAreaRobosCidade(map) {
  if (!map) return null;
  const pretos = new Set();
  for (const tileset of map.tilesets ?? []) {
    if (tileset.name === "A5_SciFi_Outside_Rasak") pretos.add(tileset.firstgid);
    if (tileset.name === "A5_SciFi_Inside_Rasak") pretos.add(tileset.firstgid + 8);
  }
  return criarAreaMapa(map, {
    incluirCamada: layer => !layer.name?.startsWith("Sombra"),
    bloquearTile: (layer, tile) => layer.name === "Sombra" && pretos.has(tile.index),
  });
}
