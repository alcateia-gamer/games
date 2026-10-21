/**
 * @file Planta do cenário: caminhos sólidos e contornos, sem texturas ou decoração.
 */

import { connectSidewalks } from "./MiniMapConnections.js";
import { mergeMiniMapRects, connectedSidewalkBlocks, miniMapBarriers } from "./MiniMapBlocks.js";
import { solidVehicleBlocks } from "./MiniMapVehicles.js";

export const RADAR_COLORS = {
  background: "#303538",
  paths: "#35676b",
  outline: "#40777b",
  accent: 0x42e2ed,
  label: "#153e45",
  player: 0x62ffad,
  vehicles: "#172e33",
  vehicleOutline: "#6a9b9e",
};

/**
 * Preenche o contorno de um obstáculo em coordenadas do mundo.
 */
function fillObstacle(context, shape) {
  if (!shape.points) {
    context.fillRect(shape.x, shape.y, shape.width, shape.height);
    return;
  }
  context.beginPath();
  shape.points.forEach((point, index) => {
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  });
  context.closePath();
  context.fill();
}

/**
 * Cria uma planta com grandes retângulos de piso, sem recortes dos objetos sobre eles.
 * As colisões conectam calçadas e preservam as separações de paredes e cercas compridas.
 */
export function drawMiniMapAtlas(geometry) {
  const { bounds, rects, shapes } = geometry;
  const scale = Math.min(1 / 12, 1024 / Math.max(bounds.width, bounds.height));
  const image = document.createElement("canvas");
  image.width = Math.max(1, Math.ceil(bounds.width * scale));
  image.height = Math.max(1, Math.ceil(bounds.height * scale));
  const paths = document.createElement("canvas");
  paths.width = image.width;
  paths.height = image.height;
  const mask = paths.getContext("2d");
  mask.scale(scale, scale);
  mask.translate(-bounds.x, -bounds.y);
  mask.fillStyle = RADAR_COLORS.paths;
  const floors = rects.filter(rect => rect.kind === "floors" || rect.kind === "roads" || rect.kind === "interiors");
  for (const rect of mergeMiniMapRects(floors)) {
    mask.fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  const obstacles = shapes.length ? shapes : rects.filter(rect =>
    rect.kind === "walls" || rect.kind === "buildings");
  const vehicles = solidVehicleBlocks(rects.filter(rect => rect.kind === "vehicles"));
  const barriers = miniMapBarriers(obstacles, vehicles, 1.25 / scale);

  const sidewalks = rects.filter(rect => rect.kind === "sidewalks");
  if (sidewalks.length) {
    const surface = document.createElement("canvas");
    surface.width = image.width;
    surface.height = image.height;
    const walkable = surface.getContext("2d");
    walkable.scale(scale, scale);
    walkable.translate(-bounds.x, -bounds.y);
    walkable.fillStyle = "#ffffff";
    // Uma única união dos pisos evita costuras transparentes entre tiles adjacentes.
    walkable.beginPath();
    for (const rect of mergeMiniMapRects([...floors, ...sidewalks])) {
      walkable.rect(rect.x, rect.y, rect.width, rect.height);
    }
    walkable.fill();
    walkable.globalCompositeOperation = "destination-out";
    for (const shape of obstacles) fillObstacle(walkable, shape);
    const asphalt = mask.getImageData(0, 0, image.width, image.height);
    const connected = connectSidewalks(
      walkable.getImageData(0, 0, image.width, image.height).data,
      asphalt.data, image.width, image.height,
    );
    const connectedRects = connectedSidewalkBlocks(sidewalks, connected, bounds, scale, image.width, image.height);
    for (const rect of mergeMiniMapRects(connectedRects)) {
      mask.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  }

  // Aplica depois dos pisos inteiros para que uma calçada não repinte por cima da cerca.
  mask.globalCompositeOperation = "destination-out";
  for (const barrier of barriers) fillObstacle(mask, barrier);
  mask.globalCompositeOperation = "source-over";

  const context = image.getContext("2d");
  for (const [x, y] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
    context.drawImage(paths, x * 0.75, y * 0.75);
  }
  context.globalCompositeOperation = "source-in";
  context.fillStyle = RADAR_COLORS.outline;
  context.fillRect(0, 0, image.width, image.height);
  context.globalCompositeOperation = "source-over";
  context.drawImage(paths, 0, 0);

  if (barriers.length) {
    // O contorno suavizado das ruas também deve respeitar a separação entre as áreas.
    context.save();
    context.scale(scale, scale);
    context.translate(-bounds.x, -bounds.y);
    context.fillStyle = RADAR_COLORS.background;
    for (const barrier of barriers) fillObstacle(context, barrier);
    context.restore();
  }

  if (vehicles.length) {
    // Os veículos ficam sobre a planta, sem alterar a máscara das ruas e calçadas.
    context.save();
    context.scale(scale, scale);
    context.translate(-bounds.x, -bounds.y);
    context.fillStyle = RADAR_COLORS.vehicles;
    context.strokeStyle = RADAR_COLORS.vehicleOutline;
    context.lineWidth = 0.6 / scale;
    for (const rect of vehicles) {
      context.fillRect(rect.x, rect.y, rect.width, rect.height);
      context.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }
    context.restore();
  }
  return { image, scale };
}
