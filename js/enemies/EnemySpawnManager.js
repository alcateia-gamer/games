import { criarInimigoTeste } from "./EnemyTest.js";

const SPAWN_ZONES = [
  { id: 1, x: -316, y: 1304 },
  { id: 2, x: 1221, y: 1298 },
  { id: 3, x: 1123, y: -463 },
  { id: 4, x: 678, y: 29 },
  { id: 5, x: -313, y: -557 },
  { id: 6, x: 1221, y: -1434 },
  { id: 7, x: -309, y: -1438 },
];

const SPAWN_CONFIG = {
  spawnRadius: 250,
  activationRadius: 600,
  minEnemies: 3,
  maxEnemies: 5,
  minEnemyDistance: 70,
  minPlayerDistance: 150,
  wallMargin: 32,
  maxAttemptsPerEnemy: 150,
  checkInterval: 200,
  spawnOnce: true,
  debug: false,
  debugRejectedLimit: 80,
};

const ROBOT_TYPES = ["padrao", "serra"];

function obterLimitesDosChunks(map) {
  const camadas = map?.data?.layers || map?.layers || [];
  const chunks = camadas.flatMap((camada) => camada.chunks || []);

  const tileWidth = Number(map.tileWidth || 1);
  const tileHeight = Number(map.tileHeight || 1);
  if (chunks.length === 0) {
    return {
      left: -2304,
      top: -3072,
      right: 2304,
      bottom: 9216,
    };
  }
  return chunks.reduce(
    (bounds, chunk) => ({
      left: Math.min(bounds.left, chunk.x * tileWidth),
      top: Math.min(bounds.top, chunk.y * tileHeight),
      right: Math.max(
        bounds.right,
        (chunk.x + chunk.width) * tileWidth,
      ),
      bottom: Math.max(
        bounds.bottom,
        (chunk.y + chunk.height) * tileHeight,
      ),
    }),
    {
      left: Number.POSITIVE_INFINITY,
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
    },
  );
}

function retanguloFootprint(x, y, tipoRobo, margem) {
  const perfil =
    tipoRobo === "serra"
      ? {
          frameWidth: 278,
          frameHeight: 270,
          scale: 0.36,
          width: 190,
          height: 100,
          offsetX: 44,
          offsetY: 160,
        }
      : {
          frameWidth: 311,
          frameHeight: 421,
          scale: 0.23,
          width: 180,
          height: 110,
          offsetX: 65,
          offsetY: 270,
        };
  const displayWidth = perfil.frameWidth * perfil.scale;
  const displayHeight = perfil.frameHeight * perfil.scale;
  const bodyLeft = x - displayWidth / 2 + perfil.offsetX * perfil.scale;
  const bodyTop = y - displayHeight / 2 + perfil.offsetY * perfil.scale;
  return new Phaser.Geom.Rectangle(
    bodyLeft - margem,
    bodyTop - margem,
    perfil.width + margem * 2,
    perfil.height + margem * 2,
  );
}

function distanciaQuadrada(aX, aY, bX, bY) {
  const dx = aX - bX;
  const dy = aY - bY;
  return dx * dx + dy * dy;
}

function retanguloDoCorpo(corpo) {
  return new Phaser.Geom.Rectangle(corpo.x, corpo.y, corpo.width, corpo.height);
}

class EnemySpawnManager {
  constructor(scene, map, config = {}) {
    this.scene = scene;
    this.map = map;
    this.config = { ...SPAWN_CONFIG, ...config };
    this.regions = SPAWN_ZONES.map((zone) => ({
      id: zone.id,
      center: { x: zone.x, y: zone.y },
      activated: false,
      enemies: [],
    }));
    this.mapBounds = obterLimitesDosChunks(map);
    this.debugGraphics = scene.add.graphics().setDepth(190);
    this.lastCheckAt = Number.NEGATIVE_INFINITY;

    this.drawDebugRegions();
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update(time) {
    if (time - this.lastCheckAt < this.config.checkInterval) {
      return;
    }
    this.lastCheckAt = time;
    this.checkSpawnZones();
  }

  checkSpawnZones() {
    const { scene, config } = this;
    const player = scene.player;
    if (!player?.active || (scene.multiplayer && !scene.isMultiplayerHost)) {
      return;
    }

    const activationDistanceSquared = config.activationRadius ** 2;
    for (const region of this.regions) {
      if (
        (this.config.spawnOnce && region.activated) ||
        distanciaQuadrada(
          player.x,
          player.y,
          region.center.x,
          region.center.y,
        ) > activationDistanceSquared
      ) {
        continue;
      }
      if (this.config.debug) {
        console.log("[SpawnManager] Posição válida encontrada");
      }

      region.activated = true;
      if (config.debug) {
        console.log(`[SpawnManager] Jogador entrou na zona ${region.id}`);
      }
      this.spawnRegion(region);
    }
  }

  spawnRegion(region) {
    const quantidade = Phaser.Math.Between(
      this.config.minEnemies,
      this.config.maxEnemies,
    );
    const criados = [];
    const escolhidas = [];

    for (let index = 0; index < quantidade; index += 1) {
      const tipoRobo = ROBOT_TYPES[
        Math.floor(Math.random() * ROBOT_TYPES.length)
      ];
      const position = this.findPosition(region, tipoRobo, escolhidas);
      if (!position) {
        console.warn(`[SpawnManager] Sem posição válida na zona ${region.id}`);
        continue;
      }
      const enemy = criarInimigoTeste(this.scene, {
        x: position.x,
        y: position.y,
        tipoRobo,
        velocidade: tipoRobo === "serra" ? 62 : 50,
        distanciaDeteccao: tipoRobo === "serra" ? 600 : 550,
        distanciaAtaque: tipoRobo === "serra" ? 68 : 180,
        distanciaGrupo: 220,
        vidaMaxima: tipoRobo === "serra" ? 120 : 100,
        danoContato: 12,
      });
      criados.push(enemy);
      escolhidas.push(position);
      region.enemies.push(enemy);
      if (this.config.debug) {
        console.log(`[SpawnManager] Robô ${tipoRobo} criado`);
      }
    }

    if (this.config.debug) {
      console.log(
        `[SpawnManager] ${criados.length}/${quantidade} robôs gerados`,
      );
    }
    this.addCollidersForNewEnemies(criados);
    this.drawDebugRegions();
  }

  findPosition(region, tipoRobo, positions) {
    const rejected = [];
    for (let attempt = 0; attempt < this.config.maxAttemptsPerEnemy; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * this.config.spawnRadius;
      const candidate = {
        x: region.center.x + Math.cos(angle) * radius,
        y: region.center.y + Math.sin(angle) * radius,
      };
      if (this.isValidPosition(candidate, tipoRobo, positions)) {
        region.positions = positions.concat(candidate);
        region.rejected = rejected;
        return candidate;
      }
      if (rejected.length < this.config.debugRejectedLimit) {
        rejected.push(candidate);
      }
    }
    region.rejected = rejected;
    return null;
  }

  isValidPosition(candidate, tipoRobo, positions) {
    const footprint = retanguloFootprint(
      candidate.x,
      candidate.y,
      tipoRobo,
      this.config.wallMargin,
    );
    const bounds = this.mapBounds;
    if (
      footprint.left < bounds.left ||
      footprint.top < bounds.top ||
      footprint.right > bounds.right ||
      footprint.bottom > bounds.bottom
    ) {
      return false;
    }

    const minDistanceSquared = this.config.minEnemyDistance ** 2;
    if (
      positions.some(
        (position) =>
          distanciaQuadrada(candidate.x, candidate.y, position.x, position.y) <
          minDistanceSquared,
      )
    ) {
      return false;
    }

    const player = this.scene.player;
    if (
      player?.active &&
      distanciaQuadrada(candidate.x, candidate.y, player.x, player.y) <
        this.config.minPlayerDistance ** 2
    ) {
      return false;
    }

    const corpos = this.scene.collisionGroup?.getChildren?.() || [];
    if (
      corpos.some(
        (corpo) =>
          corpo?.body &&
          Phaser.Geom.Intersects.RectangleToRectangle(
            footprint,
            retanguloDoCorpo(corpo.body),
          ),
      )
    ) {
      return false;
    }

    const inimigos = this.scene.inimigos || [];
    return !inimigos.some(
      (inimigo) =>
        inimigo?.active &&
        distanciaQuadrada(candidate.x, candidate.y, inimigo.x, inimigo.y) <
          minDistanceSquared,
    );
  }

  addCollidersForNewEnemies(enemies) {
    const { scene } = this;
    if (!scene.physics || enemies.length === 0) {
      return;
    }

    const existing = (scene.inimigos || []).filter(
      (enemy) => enemy.active && !enemies.includes(enemy),
    );
    for (const enemy of enemies) {
      if (scene.collisionGroup) {
        scene.physics.add.collider(enemy, scene.collisionGroup);
      }
      for (const other of existing) {
        scene.physics.add.collider(enemy, other);
      }
      for (const other of enemies) {
        if (other !== enemy && enemies.indexOf(other) < enemies.indexOf(enemy)) {
          scene.physics.add.collider(enemy, other);
        }
      }
    }
  }

  drawDebugRegions() {
    if (!this.config.debug) {
      this.debugGraphics.clear();
      return;
    }

    const graphics = this.debugGraphics;
    graphics.clear();
    for (const region of this.regions) {
      graphics.lineStyle(2, 0xffcc00, 0.8);
      graphics.strokeCircle(
        region.center.x,
        region.center.y,
        this.config.spawnRadius,
      );
      graphics.lineStyle(2, 0x00ccff, 0.8);
      graphics.strokeCircle(
        region.center.x,
        region.center.y,
        this.config.activationRadius,
      );
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(region.center.x, region.center.y, 5);

      if (region.activated) {
        graphics.fillStyle(0xff3333, 0.9);
        (region.positions || []).forEach((position) =>
          graphics.fillCircle(position.x, position.y, 7),
        );
        graphics.fillStyle(0xff00ff, 0.5);
        (region.rejected || []).forEach((position) =>
          graphics.fillCircle(position.x, position.y, 3),
        );
      }
    }
  }

  destroy() {
    this.debugGraphics?.destroy();
    this.debugGraphics = null;
    this.regions = [];
  }
}

export { SPAWN_CONFIG, SPAWN_ZONES, EnemySpawnManager };
export default EnemySpawnManager;
