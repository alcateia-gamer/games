// Dados independentes do renderizador. O Phaser já decodificou os chunks do Tiled;
// LayerData.x/y preservam a origem negativa e Tile.pixelX/Y são locais à camada.
export const MINI_MAP_PROFILES = {
  cidade: {
    id: "minimap_mapa1_cidade", cacheKey: "mapa", label: "NIGHT CITY",
    floors: ["Chão"], roads: ["FaixasRua"],
    buildings: ["Prédios", "TetoPredio", "ContainerTorre", "Vehicles"],
    walls: ["Paredes", "Borda", "BordaCurva", "Cercas", "CercaSpawn",
      "CercaTorre", "CercaFabrica", "CercaFabrica2"],
    doors: ["Cancelas"], objects: [], collision: "Collision",
  },
  fabrica: {
    id: "minimap_mapa1_fabrica", cacheKey: "mapaParte2", label: "FÁBRICA",
    floors: ["chão", "ChãoProdução"], roads: ["ListrasChão"],
    buildings: ["Objetos1", "Objetos2", "BancadaArmas", "TrilhoBraços"],
    walls: ["ParedeAbaixoPerso", "ParedeAcimaPerso", "BordaAlta", "BordaCurvas"],
    doors: ["Portas"], objects: ["ObjetosProdução", "ObjetosArmazem",
      "ObjetosBoss", "EstátuaRobos", "PcAdm", "ObjetosCozinha"],
    collision: "collision",
  },
};

export const MAP_COLORS = {
  floors: "#244354", roads: "#416879", buildings: "#385362",
  walls: "#71939e", doors: "#70a7a8", collision: "#648692",
};
const MAX_CELLS = 262144;
const INDEX_SIZE = 128;

export function buildMiniMapGeometry(map, profile, warn = console.warn) {
  const rects = [];
  const shapes = [];
  const layers = map?.layers ?? [];
  const objects = map?.objects ?? [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let hash = 2166136261;
  const hashValue = (value) => { hash = Math.imul(hash ^ Math.round(value * 10), 16777619) >>> 0; };
  const extend = (x, y, width, height) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width); maxY = Math.max(maxY, y + height);
    [x, y, width, height].forEach(hashValue);
  };
  const addRect = (x, y, width, height, kind) => {
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
    rects.push({ x, y, width, height, kind });
    extend(x, y, width, height);
  };
  const available = new Set(layers.map((layer) => layer.name));
  const missing = [...profile.floors, ...profile.walls].filter((name) => !available.has(name));
  if (missing.length) warn(`[Minimapa ${profile.label}] Camadas ausentes: ${missing.join(", ")}. Usando as demais camadas disponíveis.`);

  for (const kind of ["floors", "roads", "buildings", "walls", "doors"]) {
    for (const layer of layers.filter((item) => profile[kind].includes(item.name))) {
      const rendered = layer.tilemapLayer;
      const originX = rendered?.x ?? layer.x ?? 0;
      const originY = rendered?.y ?? layer.y ?? 0;
      const scaleX = rendered?.scaleX ?? 1, scaleY = rendered?.scaleY ?? 1;
      for (const row of layer.data ?? []) {
        if (!Array.isArray(row)) continue;
        for (const tile of row) {
          if (!tile || tile.index < 0) continue;
          const width = tile.baseWidth || map.tileWidth;
          const height = tile.baseHeight || map.tileHeight;
          addRect(originX + (tile.pixelX ?? tile.x * width) * scaleX,
            originY + (tile.pixelY ?? tile.y * height) * scaleY,
            width * scaleX, height * scaleY, kind);
        }
      }
    }
  }
  for (const layer of objects.filter((item) => profile.objects.includes(item.name))) {
    for (const object of layer.objects ?? []) {
      if (object.gid) addRect(object.x, object.y - object.height,
        object.width, object.height, "buildings");
    }
  }
  const collision = objects.find((layer) => layer.name === profile.collision);
  if (!collision) warn(`[Minimapa ${profile.label}] Camada '${profile.collision}' ausente; descoberta sem oclusão das colisões estáticas.`);
  for (const object of collision?.objects ?? []) {
    const shape = collisionShape(object);
    if (!shape) continue;
    shapes.push(shape);
    extend(shape.x, shape.y, shape.width, shape.height);
    shape.points?.forEach((point) => { hashValue(point.x); hashValue(point.y); });
  }
  if (!Number.isFinite(minX)) {
    warn(`[Minimapa ${profile.label}] Nenhuma geometria válida encontrada; minimapa desativado nesta cena.`);
    return null;
  }
  // A grade cresce apenas para mapas excepcionalmente grandes, limitando a RAM.
  let cellSize = 32;
  while (Math.ceil((maxX - minX) / cellSize) * Math.ceil((maxY - minY) / cellSize) > MAX_CELLS) cellSize *= 2;
  const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  const columns = Math.ceil(bounds.width / cellSize), rows = Math.ceil(bounds.height / cellSize);
  const signature = `1:${hash}:${minX}:${minY}:${bounds.width}:${bounds.height}:${cellSize}`;
  return { bounds, rects, shapes, cellSize, columns, rows, signature };
}

export function collisionShape(object) {
  const angle = (object.rotation || 0) * Math.PI / 180;
  let points = object.polygon;
  if (!points && angle) points = [{ x: 0, y: 0 }, { x: object.width, y: 0 },
    { x: object.width, y: object.height }, { x: 0, y: object.height }];
  if (points?.length >= 3) {
    points = points.map((p) => ({
      x: object.x + p.x * Math.cos(angle) - p.y * Math.sin(angle),
      y: object.y + p.x * Math.sin(angle) + p.y * Math.cos(angle),
    }));
    const x = Math.min(...points.map((p) => p.x)), y = Math.min(...points.map((p) => p.y));
    return { x, y, width: Math.max(...points.map((p) => p.x)) - x,
      height: Math.max(...points.map((p) => p.y)) - y, points };
  }
  if (object.width > 0 && object.height > 0) return {
    x: object.x, y: object.y, width: object.width, height: object.height,
  };
  return null;
}

function contains(shape, x, y) {
  if (x < shape.x || y < shape.y || x > shape.x + shape.width || y > shape.y + shape.height) return false;
  if (!shape.points) return true;
  let inside = false;
  const points = shape.points;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function segmentIntersects(ax, ay, bx, by, cx, cy, dx, dy) {
  const denominator = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
  if (Math.abs(denominator) < 1e-8) return false;
  const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denominator;
  const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denominator;
  return t > 0.001 && t < 0.999 && u >= 0 && u <= 1;
}

function obstructs(shape, ax, ay, bx, by) {
  // Permite revelar a própria parede e evita prender a visão em um collider
  // que se sobreponha ao centro visual do personagem.
  if (contains(shape, ax, ay) || contains(shape, bx, by)) return false;
  if (shape.x > Math.max(ax, bx) || shape.y > Math.max(ay, by) ||
      shape.x + shape.width < Math.min(ax, bx) || shape.y + shape.height < Math.min(ay, by)) return false;
  if (!shape.points) {
    const left = shape.x, top = shape.y, right = left + shape.width, bottom = top + shape.height;
    return segmentIntersects(ax, ay, bx, by, left, top, right, top) ||
      segmentIntersects(ax, ay, bx, by, right, top, right, bottom) ||
      segmentIntersects(ax, ay, bx, by, right, bottom, left, bottom) ||
      segmentIntersects(ax, ay, bx, by, left, bottom, left, top);
  }
  const p = shape.points;
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length];
    if (segmentIntersects(ax, ay, bx, by, a.x, a.y, b.x, b.y)) return true;
  }
  return false;
}

export class ExplorationGrid {
  constructor(geometry, saved) {
    this.geometry = geometry;
    this.cells = new Uint8Array(geometry.columns * geometry.rows);
    this.current = [];
    this.index = new Map();
    this.largeShapes = [];
    this.seen = new Uint32Array(geometry.shapes.length);
    this.ray = 0;
    for (let i = 0; i < geometry.shapes.length; i++) {
      const shape = geometry.shapes[i];
      if ((Math.ceil(shape.width / INDEX_SIZE) + 1) * (Math.ceil(shape.height / INDEX_SIZE) + 1) > 4096) {
        this.largeShapes.push(shape);
        continue;
      }
      for (let y = Math.floor(shape.y / INDEX_SIZE); y <= Math.floor((shape.y + shape.height) / INDEX_SIZE); y++) {
        for (let x = Math.floor(shape.x / INDEX_SIZE); x <= Math.floor((shape.x + shape.width) / INDEX_SIZE); x++) {
          const key = `${x},${y}`;
          if (!this.index.has(key)) this.index.set(key, []);
          this.index.get(key).push(i);
        }
      }
    }
    if (saved?.signature === geometry.signature && saved.cells instanceof Uint8Array && saved.cells.length === this.cells.length) {
      this.cells.set(saved.cells);
    } else if (saved?.signature === geometry.signature && typeof saved.bits === "string") {
      try {
        const bytes = atob(saved.bits);
        if (bytes.length === Math.ceil(this.cells.length / 8)) {
          for (let i = 0; i < this.cells.length; i++) this.cells[i] = (bytes.charCodeAt(i >> 3) >> (i & 7)) & 1;
        }
      } catch { /* Um save incompleto não impede iniciar o mapa. */ }
    }
  }

  visible(ax, ay, bx, by, dynamic = []) {
    this.ray++;
    if (this.ray >= 0xffffffff) { this.seen.fill(0); this.ray = 1; }
    for (let y = Math.floor(Math.min(ay, by) / INDEX_SIZE); y <= Math.floor(Math.max(ay, by) / INDEX_SIZE); y++) {
      for (let x = Math.floor(Math.min(ax, bx) / INDEX_SIZE); x <= Math.floor(Math.max(ax, bx) / INDEX_SIZE); x++) {
        for (const i of this.index.get(`${x},${y}`) ?? []) {
          if (this.seen[i] === this.ray) continue;
          this.seen[i] = this.ray;
          if (obstructs(this.geometry.shapes[i], ax, ay, bx, by)) return false;
        }
      }
    }
    return !this.largeShapes.some((shape) => obstructs(shape, ax, ay, bx, by)) &&
      !dynamic.some((shape) => obstructs(shape, ax, ay, bx, by));
  }

  reveal(x, y, radius = 170, dynamic = []) {
    const { bounds, cellSize, columns, rows } = this.geometry;
    this.current.length = 0;
    const discovered = [];
    // No máximo 13 × 13 candidatos, mesmo em configurações de raio maiores.
    const range = Math.min(radius, cellSize * 6);
    const left = Math.max(0, Math.floor((x - range - bounds.x) / cellSize));
    const right = Math.min(columns - 1, Math.floor((x + range - bounds.x) / cellSize));
    const top = Math.max(0, Math.floor((y - range - bounds.y) / cellSize));
    const bottom = Math.min(rows - 1, Math.floor((y + range - bounds.y) / cellSize));
    const playerCellX = Math.floor((x - bounds.x) / cellSize);
    const playerCellY = Math.floor((y - bounds.y) / cellSize);
    for (let cy = top; cy <= bottom; cy++) {
      for (let cx = left; cx <= right; cx++) {
        const worldX = bounds.x + (cx + 0.5) * cellSize;
        const worldY = bounds.y + (cy + 0.5) * cellSize;
        const playerCell = cx === playerCellX && cy === playerCellY;
        if (!playerCell && (Math.hypot(worldX - x, worldY - y) > range || !this.visible(x, y, worldX, worldY, dynamic))) continue;
        const i = cy * columns + cx;
        this.current.push(i);
        if (!this.cells[i]) { this.cells[i] = 1; discovered.push(i); }
      }
    }
    return discovered;
  }

  serialize() {
    const bytes = new Uint8Array(Math.ceil(this.cells.length / 8));
    for (let i = 0; i < this.cells.length; i++) if (this.cells[i]) bytes[i >> 3] |= 1 << (i & 7);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return { signature: this.geometry.signature, bits: btoa(binary) };
  }
}

export function createMapTransform(bounds, width, height, x, y) {
  // Janela local sem distorção. Mapas pequenos são centralizados e cabem inteiros.
  const localScale = Math.min(0.08, width / 800, height / 600);
  const offset = (start, size, viewport, focus) => size * localScale <= viewport
    ? (viewport - size * localScale) / 2 - start * localScale
    : -Math.max(start, Math.min(focus - viewport / localScale / 2, start + size - viewport / localScale)) * localScale;
  return { scale: localScale,
    x: offset(bounds.x, bounds.width, width, x),
    y: offset(bounds.y, bounds.height, height, y) };
}

export function worldToMiniMap(transform, x, y) {
  return { x: x * transform.scale + transform.x, y: y * transform.scale + transform.y };
}

export function miniMapLayout(camera, dev, attack, pickup) {
  const zoomX = camera.zoomX || camera.zoom || 1, zoomY = camera.zoomY || camera.zoom || 1;
  const ox = camera.width * camera.originX, oy = camera.height * camera.originY;
  const top = 12;
  const devHeight = dev?.height ?? 30;
  let bottom = camera.height - 12;
  for (const button of [attack, pickup]) {
    if (button?.scene && button.visible !== false) bottom = Math.min(bottom,
      oy + (button.y - oy) * zoomY - button.displayHeight * zoomY / 2 - 12);
  }
  const size = Math.max(0, Math.min(1, (camera.width - 24) / 180,
    (bottom - top - 12 - devHeight) / 130));
  return { x: ox + (camera.width - 12 - 180 * size - ox) / zoomX,
    y: oy + (top - oy) / zoomY, scaleX: size / zoomX, scaleY: size / zoomY,
    devScreenY: size >= 0.35 ? top + 130 * size + 12 + devHeight / 2 : 24,
    visible: size >= 0.35 };
}
