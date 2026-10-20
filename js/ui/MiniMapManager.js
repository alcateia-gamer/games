import {
  MINI_MAP_PROFILES, MAP_COLORS, buildMiniMapGeometry, ExplorationGrid,
  createMapTransform, worldToMiniMap, miniMapLayout,
} from "./MiniMapData.js";

const WIDTH = 180, HEIGHT = 130;
const VIEW_X = 8, VIEW_Y = 20, VIEW_WIDTH = 164, VIEW_HEIGHT = 100;
const UPDATE_INTERVAL = 100, SAVE_INTERVAL = 2000;
const cache = new WeakMap();
let nextTextureId = 0;

function canvas(width, height) {
  const result = document.createElement("canvas");
  result.width = width; result.height = height;
  return result;
}

function drawAtlas(geometry) {
  const { bounds } = geometry;
  const scale = Math.min(1 / 12, 1024 / Math.max(bounds.width, bounds.height));
  const image = canvas(Math.max(1, Math.ceil(bounds.width * scale)), Math.max(1, Math.ceil(bounds.height * scale)));
  const context = image.getContext("2d");
  context.scale(scale, scale);
  context.translate(-bounds.x, -bounds.y);
  for (const rect of geometry.rects) {
    context.fillStyle = MAP_COLORS[rect.kind];
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
  }
  context.fillStyle = MAP_COLORS.collision;
  for (const shape of geometry.shapes) {
    if (shape.points) {
      context.beginPath();
      shape.points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.closePath(); context.fill();
    } else context.fillRect(shape.x, shape.y, shape.width, shape.height);
  }
  return { image, scale };
}

function getCachedMap(scene, map, profile) {
  const key = scene.cache.tilemap.get(profile.cacheKey)?.data ?? map;
  let entry = cache.get(key);
  if (!entry) {
    const geometry = buildMiniMapGeometry(map, profile);
    if (!geometry) return null;
    entry = { geometry, atlas: drawAtlas(geometry) };
    cache.set(key, entry);
  }
  return entry;
}

export default class MiniMapManager {
  constructor(scene, map, profileName) {
    this.scene = scene;
    this.profile = MINI_MAP_PROFILES[profileName];
    this.destroyed = false;
    const entry = getCachedMap(scene, map, this.profile);
    if (!entry) return;
    this.geometry = entry.geometry;
    this.atlas = entry.atlas;
    this.storage = null;
    try { this.storage = globalThis.localStorage; } catch { /* Navegação privada/restrita. */ }
    let saved = scene.game.registry.get(this.profile.id);
    if (saved?.signature !== this.geometry.signature) {
      try { saved = JSON.parse(this.storage?.getItem(this.profile.id) ?? "null"); }
      catch { console.warn(`[Minimapa ${this.profile.label}] Exploração salva indisponível; usando o progresso da sessão.`); }
    }
    this.grid = new ExplorationGrid(this.geometry, saved);
    scene.game.registry.set(this.profile.id, {
      signature: this.geometry.signature, cells: this.grid.cells,
    });
    this.known = canvas(this.atlas.image.width, this.atlas.image.height);
    const explored = [];
    for (let i = 0; i < this.grid.cells.length; i++) if (this.grid.cells[i]) explored.push(i);
    this.paintDiscovered(explored);

    this.textureKey = `nullborns-minimap-${++nextTextureId}`;
    // Só esta textura pequena é enviada à GPU, mesmo em mapas muito extensos.
    this.texture = scene.textures.createCanvas(this.textureKey, VIEW_WIDTH * 2, VIEW_HEIGHT * 2);
    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(100100);
    const frame = scene.add.graphics();
    frame.fillStyle(0x030a12, 0.96).fillRoundedRect(0, 0, WIDTH, HEIGHT, 6);
    frame.lineStyle(1, 0x467d8e, 0.8).strokeRoundedRect(0.5, 0.5, WIDTH - 1, HEIGHT - 1, 6);
    frame.lineStyle(1, 0x62d9ed, 0.6).lineBetween(9, 17, 31, 17);
    const title = scene.add.text(9, 4, this.profile.label, {
      fontFamily: "monospace", fontSize: "10px", color: "#86adb9",
    });
    const north = scene.add.text(165, 4, "N", {
      fontFamily: "monospace", fontSize: "10px", color: "#6ecada",
    });
    this.image = scene.add.image(VIEW_X, VIEW_Y, this.textureKey).setOrigin(0, 0)
      .setDisplaySize(VIEW_WIDTH, VIEW_HEIGHT);
    this.marker = scene.add.container(0, 0);
    const glow = scene.add.circle(0, 0, 5, 0x26cde5, 0.18);
    const point = scene.add.circle(0, 0, 2.5, 0x64e5ff, 1).setStrokeStyle(1, 0xe5fcff);
    const heading = scene.add.graphics().fillStyle(0xa5f4ff, 0.9)
      .fillTriangle(0, -7, -2, -4, 2, -4);
    this.marker.add([glow, heading, point]);
    this.root.add([frame, title, north, this.image, this.marker]);
    // Nenhum elemento é interativo: os toques continuam chegando aos controles.
    this.lastX = NaN; this.lastY = NaN;
    this.nextUpdate = 0; this.nextSave = 0; this.dirty = false;
    this.onPageHide = () => this.save();
    this.onShutdown = () => this.destroy();
    globalThis.addEventListener?.("pagehide", this.onPageHide);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);
    this.layout(scene.cameras.main);
    this.update(0);
  }

  paintDiscovered(cells) {
    if (!cells.length) return;
    const context = this.known.getContext("2d");
    const { columns, cellSize } = this.geometry;
    const scale = this.atlas.scale;
    context.save(); context.beginPath();
    for (const i of cells) {
      context.rect((i % columns) * cellSize * scale,
        Math.floor(i / columns) * cellSize * scale, cellSize * scale, cellSize * scale);
    }
    context.clip();
    context.drawImage(this.atlas.image, 0, 0);
    context.restore();
  }

  layout(camera) {
    if (!this.root || this.destroyed) return;
    const result = miniMapLayout(camera, this.scene.botaoDesenvolvedor,
      this.scene.botaoAtaque, this.scene.botaoColetarItem);
    this.devScreenY = result.devScreenY;
    this.root.setPosition(result.x, result.y).setScale(result.scaleX, result.scaleY)
      .setVisible(result.visible && !this.scene.generatorMenuOpen);
  }

  dynamicObstacles() {
    const body = this.scene.portaFabrica?.colisao?.body;
    return body?.enable !== false && body?.width > 0
      ? [{ x: body.x, y: body.y, width: body.width, height: body.height }] : [];
  }

  update(time = 0) {
    if (this.destroyed || !this.grid) return;
    const player = this.scene.player;
    if (!player?.active) { this.marker.setVisible(false); return; }
    const x = player.x, y = player.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const doorState = this.scene.portaFabrica?.estado;
    const { bounds, cellSize } = this.geometry;
    const cellX = Math.floor((x - bounds.x) / cellSize), cellY = Math.floor((y - bounds.y) / cellSize);
    const moved = !this.transform || Math.hypot(x - this.lastX, y - this.lastY) >= 16 ||
      cellX !== this.lastCellX || cellY !== this.lastCellY || doorState !== this.lastDoorState;
    if (moved && time >= this.nextUpdate) {
      this.nextUpdate = time + UPDATE_INTERVAL;
      this.lastX = x; this.lastY = y; this.lastCellX = cellX; this.lastCellY = cellY;
      this.lastDoorState = doorState;
      const discovered = this.grid.reveal(x, y, 170, this.dynamicObstacles());
      this.paintDiscovered(discovered);
      if (discovered.length) this.dirty = true;
      this.transform = createMapTransform(bounds, VIEW_WIDTH, VIEW_HEIGHT, x, y);
      this.drawView();
    }
    if (this.dirty && time >= this.nextSave) {
      this.nextSave = time + SAVE_INTERVAL;
      this.save();
    }
    if (!this.transform) return;
    const position = worldToMiniMap(this.transform, x, y);
    const inside = x >= bounds.x && y >= bounds.y && x <= bounds.x + bounds.width && y <= bounds.y + bounds.height &&
      position.x >= 7 && position.y >= 7 && position.x <= VIEW_WIDTH - 7 && position.y <= VIEW_HEIGHT - 7;
    this.marker.setVisible(inside).setPosition(VIEW_X + position.x, VIEW_Y + position.y);
    this.marker.setRotation({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[this.scene.direcaoAtual] ?? 0);
  }

  drawView() {
    const context = this.texture.getContext();
    const { bounds, cellSize, columns } = this.geometry;
    const transform = this.transform;
    context.save(); context.scale(2, 2);
    context.fillStyle = "#02060c";
    context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    const left = bounds.x * transform.scale + transform.x;
    const top = bounds.y * transform.scale + transform.y;
    const width = this.atlas.image.width * transform.scale / this.atlas.scale;
    const height = this.atlas.image.height * transform.scale / this.atlas.scale;
    context.imageSmoothingEnabled = true;
    context.globalAlpha = 0.62;
    context.drawImage(this.known, left, top, width, height);
    // Recorta a camada clara às células com linha de visão atual. A camada
    // conhecida permanece intacta quando o personagem deixa a região.
    context.globalAlpha = 1;
    context.beginPath();
    for (const i of this.grid.current) {
      context.rect(left + (i % columns) * cellSize * transform.scale,
        top + Math.floor(i / columns) * cellSize * transform.scale,
        cellSize * transform.scale, cellSize * transform.scale);
    }
    context.clip();
    context.drawImage(this.atlas.image, left, top, width, height);
    context.restore();
    this.texture.refresh();
  }

  save() {
    if (!this.dirty || !this.grid) return;
    if (this.storage) {
      try { this.storage.setItem(this.profile.id, JSON.stringify(this.grid.serialize())); }
      catch {
        console.warn(`[Minimapa ${this.profile.label}] Armazenamento indisponível; exploração mantida no game.registry.`);
        this.storage = null;
      }
    }
    this.dirty = false;
  }

  destroy() {
    if (this.destroyed) return;
    this.save(); this.destroyed = true;
    globalThis.removeEventListener?.("pagehide", this.onPageHide);
    if (this.onShutdown) this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);
    this.root?.destroy();
    if (this.textureKey) this.scene.textures.remove(this.textureKey);
    if (this.known) { this.known.width = 1; this.known.height = 1; }
    this.grid = null; this.known = null; this.texture = null; this.atlas = null;
    this.geometry = null; this.root = null; this.marker = null; this.image = null;
    if (this.scene.minimap === this) this.scene.minimap = null;
  }
}
