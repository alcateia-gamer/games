/**
 * @file Limites e posicionamento do minimapa, preservando as coordenadas negativas do cenário.
 */

import { connectedVehicleRects, vehicleInstanceKey } from "./MiniMapVehicles.js";

// Dados independentes do renderizador. O Phaser já decodificou os chunks do Tiled;
// LayerData.x/y preservam a origem negativa e Tile.pixelX/Y são locais à camada.
export const MINI_MAP_SIZE = 90;
const MINI_MAP_LABEL_HEIGHT = 18;

export const MINI_MAP_PROFILES = {
  cidade: {
    id: "minimap_mapa1_cidade", cacheKey: "mapa", label: "NIGHT CITY",
    searchPoint: { x: 26, y: -219 },
    floors: ["Chão"], roads: [],
    asphalt: {
      tileset: "A5_Street_Rasak",
      // Bloco de calçada no canto inferior esquerdo da folha de tiles.
      excludedTiles: [104, 105, 106, 112, 113, 114, 120, 121, 122],
    },
    // Piso da loja de armas e tapete da entrada, em índices locais dos tilesets.
    interiorFloorTiles: {
      A5_SciFi_Inside_Rasak: [3],
      A5_SciFi_Outside_Rasak: [9],
    },
    buildings: ["Prédios", "TetoPredio", "ContainerTorre"],
    vehicles: ["Vehicles"],
    vehicleAttachments: ["ObjSobPerso", "ObjAcimaPerso"],
    excludedTilesets: ["TorreTileset"],
    walls: ["Paredes", "Borda", "BordaCurva", "Cercas", "CercaSpawn",
      "CercaTorre", "CercaFabrica", "CercaFabrica2"],
    doors: ["Cancelas"], objects: [], collision: "Collision",
  },
  fabrica: {
    id: "minimap_mapa1_fabrica", cacheKey: "mapaParte2", label: "FÁBRICA",
    floors: ["chão", "ChãoProdução"], roads: ["ListrasChão"],
    buildings: ["Objetos1", "Objetos2", "BancadaArmas", "TrilhoBraços"],
    vehicles: [],
    walls: ["ParedeAbaixoPerso", "ParedeAcimaPerso", "BordaAlta", "BordaCurvas"],
    doors: ["Portas"], objects: ["ObjetosProdução", "ObjetosArmazem",
      "ObjetosBoss", "EstátuaRobos", "PcAdm", "ObjetosCozinha"],
    collision: "collision",
  },
};

/**
 * Extrai a geometria das camadas selecionadas pelo perfil e calcula os limites do mapa.
 */
export function buildMiniMapGeometry(map, profile, warn = console.warn) {
  const rects = [];
  const shapes = [];
  const vehicleAttachments = [];
  const layers = map?.layers ?? [];
  const objects = map?.objects ?? [];
  const asphaltTileset = map?.tilesets?.find(tileset => tileset.name === profile.asphalt?.tileset);
  const excludedAsphaltTiles = new Set(profile.asphalt?.excludedTiles ?? []);
  const interiorFloorTiles = new Set((map?.tilesets ?? []).flatMap(tileset =>
    (profile.interiorFloorTiles?.[tileset.name] ?? []).map(index => tileset.firstgid + index)));
  const excludedTileRanges = (map?.tilesets ?? [])
    .filter(tileset => profile.excludedTilesets?.includes(tileset.name))
    .map(tileset => ({ start: tileset.firstgid, end: tileset.firstgid + (tileset.total ?? tileset.tilecount) }));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  /**
   * Expande os limites do mapa.
   */
  const extend = (x, y, width, height) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width); maxY = Math.max(maxY, y + height);
  };
  /**
   * Registra um retângulo válido e atualiza os limites do minimapa.
   */
  const addRect = (x, y, width, height, kind, vehicleId) => {
    if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
    const rect = { x, y, width, height, kind };
    if (vehicleId) rect.vehicleId = vehicleId;
    if (kind === "vehicleAttachments") {
      vehicleAttachments.push({ ...rect, kind: "vehicles" });
      return;
    }
    rects.push(rect);
    extend(x, y, width, height);
  };
  const available = new Set(layers.map((layer) => layer.name));
  const missing = [...profile.floors, ...profile.walls].filter((name) => !available.has(name));
  if (missing.length) warn(`[Minimapa ${profile.label}] Camadas ausentes: ${missing.join(", ")}. Usando as demais camadas disponíveis.`);

  for (const kind of ["floors", "roads", "buildings", "walls", "doors", "vehicles", "vehicleAttachments"]) {
    for (const layer of layers.filter((item) => profile[kind]?.some(name => name.toLowerCase() === item.name.toLowerCase()))) {
      const rendered = layer.tilemapLayer;
      const originX = rendered?.x ?? layer.x ?? 0;
      const originY = rendered?.y ?? layer.y ?? 0;
      const scaleX = rendered?.scaleX ?? 1, scaleY = rendered?.scaleY ?? 1;
      for (const row of layer.data ?? []) {
        if (!Array.isArray(row)) continue;
        for (const tile of row) {
          if (!tile || tile.index < 0) continue;
          if (excludedTileRanges.some(range => tile.index >= range.start && tile.index < range.end)) continue;
          const width = tile.baseWidth || map.tileWidth;
          const height = tile.baseHeight || map.tileHeight;
          let radarKind = kind;
          if (kind === "floors" && profile.asphalt) {
            const localIndex = tile.index - (asphaltTileset?.firstgid ?? 0);
            const isAsphalt = asphaltTileset && localIndex >= 0 &&
              localIndex < (asphaltTileset.total ?? asphaltTileset.tilecount) &&
              !excludedAsphaltTiles.has(localIndex);
            if (!isAsphalt) radarKind = asphaltTileset && excludedAsphaltTiles.has(localIndex)
              ? "sidewalks" : "background";
          }
          if (kind === "floors" && interiorFloorTiles.has(tile.index)) radarKind = "interiors";
          const x = originX + (tile.pixelX ?? tile.x * width) * scaleX;
          const y = originY + (tile.pixelY ?? tile.y * height) * scaleY;
          const vehicleId = kind === "vehicles" || kind === "vehicleAttachments"
            ? vehicleInstanceKey(map, tile, x, y, width * scaleX, height * scaleY) : undefined;
          addRect(x, y, width * scaleX, height * scaleY, radarKind, vehicleId);
        }
      }
    }
  }
  const vehicles = rects.filter(rect => rect.kind === "vehicles");
  for (const rect of connectedVehicleRects(vehicles, vehicleAttachments, map.tileWidth, true)) {
    addRect(rect.x, rect.y, rect.width, rect.height, "vehicles", rect.vehicleId);
  }
  for (const layer of objects.filter((item) => profile.objects.includes(item.name))) {
    for (const object of layer.objects ?? []) {
      if (object.gid) addRect(object.x, object.y - object.height,
        object.width, object.height, "buildings");
    }
  }
  const collision = objects.find((layer) => layer.name === profile.collision);
  if (!collision) warn(`[Minimapa ${profile.label}] Camada '${profile.collision}' ausente; usando os limites das camadas visuais.`);
  for (const object of collision?.objects ?? []) {
    const shape = collisionShape(object);
    if (!shape) continue;
    shapes.push(shape);
    extend(shape.x, shape.y, shape.width, shape.height);
  }
  if (!Number.isFinite(minX)) {
    warn(`[Minimapa ${profile.label}] Nenhuma geometria válida encontrada; minimapa desativado nesta cena.`);
    return null;
  }
  const bounds = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  return { bounds, rects, shapes };
}

/**
 * Converte um objeto Tiled em retângulo ou polígono de colisão em coordenadas de mundo,
 * considerando rotação.
 */
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

/**
 * Calcula uma transformação de escala uniforme para a janela local, centralizando mapas
 * menores que a janela.
 */
export function createMapTransform(bounds, width, height, x, y) {
  // Janela local sem distorção. Mapas pequenos são centralizados e cabem inteiros.
  const localScale = Math.min(0.09, width / 400, height / 300);
  /**
   * Calcula o deslocamento de um eixo e limita a janela aos limites do mapa.
   */
  const offset = (start, size, viewport, focus) => size * localScale <= viewport
    ? (viewport - size * localScale) / 2 - start * localScale
    : -Math.max(start, Math.min(focus - viewport / localScale / 2, start + size - viewport / localScale)) * localScale;
  return { scale: localScale,
    x: offset(bounds.x, bounds.width, width, x),
    y: offset(bounds.y, bounds.height, height, y) };
}

/**
 * Aplica a transformação para converter coordenadas do mundo em coordenadas da janela do
 * minimapa.
 */
export function worldToMiniMap(transform, x, y) {
  return { x: x * transform.scale + transform.x, y: y * transform.scale + transform.y };
}

/**
 * Calcula posição, escala e visibilidade do minimapa sem sobrepor os botões de ação.
 */
export function miniMapLayout(camera, dev, attack, pickup) {
  const zoomX = camera.zoomX || camera.zoom || 1, zoomY = camera.zoomY || camera.zoom || 1;
  const ox = camera.width * camera.originX, oy = camera.height * camera.originY;
  const top = 12;
  const contentHeight = MINI_MAP_SIZE + MINI_MAP_LABEL_HEIGHT;
  const devHeight = dev?.height ?? 30;
  let bottom = camera.height - 12;
  for (const button of [attack, pickup]) {
    if (button?.scene && button.visible !== false) bottom = Math.min(bottom,
      oy + (button.y - oy) * zoomY - button.displayHeight * zoomY / 2 - 12);
  }
  const size = Math.max(0, Math.min(1, (camera.width - 24) / MINI_MAP_SIZE,
    (bottom - top - 12 - devHeight) / contentHeight));
  return { x: ox + (camera.width - 12 - MINI_MAP_SIZE * size - ox) / zoomX,
    y: oy + (top - oy) / zoomY, scaleX: size / zoomX, scaleY: size / zoomY,
    devScreenY: size >= 0.35 ? top + contentHeight * size + 12 + devHeight / 2 : 24,
    visible: size >= 0.35 };
}
