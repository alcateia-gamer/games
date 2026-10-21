/**
 * @file Radar com caminhos e obstáculos do cenário, disponível desde o início da partida.
 */

import {
  MINI_MAP_PROFILES, MINI_MAP_SIZE, buildMiniMapGeometry,
  createMapTransform, worldToMiniMap, miniMapLayout,
} from "./MiniMapData.js";
import { drawMiniMapAtlas, RADAR_COLORS } from "./MiniMapAtlas.js";

const WIDTH = MINI_MAP_SIZE, HEIGHT = MINI_MAP_SIZE;
const VIEW_X = 2, VIEW_Y = 2, VIEW_WIDTH = WIDTH - 4, VIEW_HEIGHT = HEIGHT - 4;
const UPDATE_INTERVAL = 100;
const ENEMY_MARKER_MARGIN = 7;
const LOOK_DIRECTIONS = {
  up: { x: 0, y: -1 }, right: { x: 1, y: 0 },
  down: { x: 0, y: 1 }, left: { x: -1, y: 0 },
};
const cache = new WeakMap();
let nextTextureId = 0;

/**
 * Recupera ou cria a geometria e o atlas compartilhados para o recurso de mapa.
 */
function getCachedMap(scene, map, profile) {
  const key = scene.cache.tilemap.get(profile.cacheKey)?.data ?? map;
  let entry = cache.get(key);
  if (!entry) {
    const geometry = buildMiniMapGeometry(map, profile);
    if (!geometry) return null;
    entry = { geometry, atlas: drawMiniMapAtlas(geometry) };
    cache.set(key, entry);
  }
  return entry;
}

export default class MiniMapManager {
  /**
   * Monta a vista do mapa, a moldura e o marcador e conecta a limpeza da cena.
   */
  constructor(scene, map, profileName) {
    this.scene = scene;
    this.profile = MINI_MAP_PROFILES[profileName];
    this.destroyed = false;
    const entry = getCachedMap(scene, map, this.profile);
    if (!entry) return;
    this.geometry = entry.geometry;
    this.atlas = entry.atlas;
    this.textureKey = `nullborns-minimap-${++nextTextureId}`;
    // Só esta textura pequena é enviada à GPU, mesmo em mapas muito extensos.
    this.texture = scene.textures.createCanvas(this.textureKey, VIEW_WIDTH * 2, VIEW_HEIGHT * 2);
    this.root = scene.add.container(0, 0).setScrollFactor(0).setDepth(100100);
    const frame = scene.add.graphics();
    frame.fillStyle(Number.parseInt(RADAR_COLORS.background.slice(1), 16), 1)
      .fillRect(0, 0, WIDTH, HEIGHT);
    frame.lineStyle(1, RADAR_COLORS.accent, 0.85)
      .strokeRect(0.5, 0.5, WIDTH - 1, HEIGHT - 1);
    // Pequenos cantos reforçam o acabamento angular da interface da referência.
    frame.lineStyle(2, RADAR_COLORS.accent, 1)
      .lineBetween(0, 1, 9, 1).lineBetween(1, 0, 1, 9)
      .lineBetween(WIDTH - 9, HEIGHT - 1, WIDTH, HEIGHT - 1);
    frame.fillStyle(RADAR_COLORS.accent, 1).fillRect(0, HEIGHT + 1, WIDTH, 13);
    const title = scene.add.text(WIDTH / 2, HEIGHT + 7.5, this.profile.label, {
      fontFamily: "monospace", fontSize: "9px", fontStyle: "bold", color: RADAR_COLORS.label,
    }).setOrigin(0.5);
    this.image = scene.add.image(VIEW_X, VIEW_Y, this.textureKey).setOrigin(0, 0)
      .setDisplaySize(VIEW_WIDTH, VIEW_HEIGHT);
    this.enemyMarkers = scene.add.graphics();
    this.marker = scene.add.container(0, 0);
    const glow = scene.add.circle(0, 0, 5.5, 0x071d18, 0.7);
    const heading = scene.add.graphics().lineStyle(1.5, RADAR_COLORS.player, 1);
    heading.beginPath().moveTo(-3, 2).lineTo(0, -4).lineTo(3, 2).strokePath();
    this.marker.add([glow, heading]);
    this.root.add([frame, this.image, this.enemyMarkers, title, this.marker]);
    // Nenhum elemento é interativo: os toques continuam chegando aos controles.
    this.lastX = NaN; this.lastY = NaN;
    this.nextUpdate = 0;
    /**
     * Destrói os recursos locais do minimapa ao encerrar a cena.
     */
    this.onShutdown = () => this.destroy();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);
    this.layout(scene.cameras.main);
    this.update(0);
  }

  /**
   * Posiciona a interface e a oculta quando falta espaço ou o menu do gerador está aberto.
   */
  layout(camera) {
    if (!this.root || this.destroyed) return;
    const result = miniMapLayout(camera, this.scene.botaoDesenvolvedor,
      this.scene.botaoAtaque, this.scene.botaoColetarItem);
    this.devScreenY = result.devScreenY;
    this.root.setPosition(result.x, result.y).setScale(result.scaleX, result.scaleY)
      .setVisible(result.visible && !this.scene.generatorMenuOpen);
  }

  /**
   * Acompanha o personagem e atualiza a janela do mapa em intervalos controlados.
   */
  update(time = 0) {
    if (this.destroyed || !this.geometry) return;
    const player = this.scene.player;
    if (!player?.active) {
      this.marker.setVisible(false);
      this.enemyMarkers.clear();
      return;
    }
    const x = player.x, y = player.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      this.marker.setVisible(false);
      this.enemyMarkers.clear();
      return;
    }
    const { bounds } = this.geometry;
    const moved = !this.transform || Math.hypot(x - this.lastX, y - this.lastY) >= 16;
    if (moved && time >= this.nextUpdate) {
      this.nextUpdate = time + UPDATE_INTERVAL;
      this.lastX = x; this.lastY = y;
      this.transform = createMapTransform(bounds, VIEW_WIDTH, VIEW_HEIGHT, x, y);
      this.drawView();
    }
    if (!this.transform) return;
    this.updateEnemyMarkers();
    const position = worldToMiniMap(this.transform, x, y);
    const inside = x >= bounds.x && y >= bounds.y && x <= bounds.x + bounds.width && y <= bounds.y + bounds.height &&
      position.x >= 7 && position.y >= 7 && position.x <= VIEW_WIDTH - 7 && position.y <= VIEW_HEIGHT - 7;
    this.marker.setVisible(inside).setPosition(VIEW_X + position.x, VIEW_Y + position.y);
    this.marker.setRotation({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[this.scene.direcaoAtual] ?? 0);
  }

  /**
   * Mostra robôs vivos como pontos vermelhos com uma seta na direção do olhar.
   * Atualiza a cada quadro, mesmo quando o jogador e o mapa estão parados.
   */
  updateEnemyMarkers() {
    const graphics = this.enemyMarkers;
    graphics.clear();
    const enemies = Array.isArray(this.scene.inimigos)
      ? this.scene.inimigos : [this.scene.inimigoTeste];
    const { bounds } = this.geometry;
    for (const enemy of enemies) {
      if (!enemy?.active || enemy.morto || !Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) continue;
      if (enemy.x < bounds.x || enemy.y < bounds.y ||
          enemy.x > bounds.x + bounds.width || enemy.y > bounds.y + bounds.height) continue;
      const position = worldToMiniMap(this.transform, enemy.x, enemy.y);
      if (position.x < ENEMY_MARKER_MARGIN || position.y < ENEMY_MARKER_MARGIN ||
          position.x > VIEW_WIDTH - ENEMY_MARKER_MARGIN || position.y > VIEW_HEIGHT - ENEMY_MARKER_MARGIN) continue;
      const x = VIEW_X + position.x, y = VIEW_Y + position.y;
      const direction = LOOK_DIRECTIONS[enemy.direcaoAtual] ?? LOOK_DIRECTIONS.down;
      const sideX = -direction.y * 1.8, sideY = direction.x * 1.8;
      graphics.fillStyle(0xffa080, 1).fillTriangle(
        x + direction.x * 6, y + direction.y * 6,
        x + direction.x * 2 + sideX, y + direction.y * 2 + sideY,
        x + direction.x * 2 - sideX, y + direction.y * 2 - sideY,
      );
      graphics.fillStyle(0x17191d, 1).fillCircle(x, y, 2.5);
      graphics.fillStyle(0xff4c4c, 1).fillCircle(x, y, 1.7);
    }
  }

  /**
   * Desenha o cenário completo na janela local, sem recortes por exploração ou linha de visão.
   */
  drawView() {
    const context = this.texture.getContext();
    const { bounds } = this.geometry;
    const transform = this.transform;
    context.save(); context.scale(2, 2);
    context.fillStyle = RADAR_COLORS.background;
    context.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    const left = bounds.x * transform.scale + transform.x;
    const top = bounds.y * transform.scale + transform.y;
    const width = this.atlas.image.width * transform.scale / this.atlas.scale;
    const height = this.atlas.image.height * transform.scale / this.atlas.scale;
    context.imageSmoothingEnabled = true;
    context.globalAlpha = 1;
    context.drawImage(this.atlas.image, left, top, width, height);
    context.restore();
    this.texture.refresh();
  }

  /**
   * Remove textura, interface e listeners sem destruir o atlas compartilhado.
   */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.onShutdown) this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown);
    this.root?.destroy();
    if (this.textureKey) this.scene.textures.remove(this.textureKey);
    this.texture = null; this.atlas = null;
    this.geometry = null; this.root = null; this.marker = null; this.image = null;
    this.enemyMarkers = null;
    if (this.scene.minimap === this) this.scene.minimap = null;
  }
}
