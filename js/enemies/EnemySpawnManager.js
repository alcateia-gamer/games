/**
 * @file Geração de inimigos por zonas de proximidade. Planeja posições livres, garante os
 * tipos obrigatórios e controla limite e remoção por distância.
 */

import { criarInimigoTeste } from "./EnemyTest.js";

// =====================================================
// ZONAS ORIGINAIS DE SPAWN
// =====================================================

const SPAWN_ZONES = [
  { id: 1, x: -316, y: 1304 },
  { id: 2, x: 1221, y: 1298 },
  { id: 3, x: 1123, y: -463 },
  { id: 4, x: 678, y: 29 },
  { id: 5, x: -313, y: -557 },
  { id: 6, x: 1221, y: -1434 },
  { id: 7, x: -309, y: -1438 },
];

// =====================================================
// CONFIGURACOES
// =====================================================

const SPAWN_CONFIG = {
  spawnRadius: 250,
  activationRadius: 600,

  minEnemies: 3,
  maxEnemies: 5,

  maxActiveEnemies: 10,

  minEnemyDistance: 70,
  minPlayerDistance: 150,

  wallMargin: 14,
  maxAttemptsPerEnemy: 65,

  checkInterval: 400,
  retryDelay: 2500,

  despawnDistance: 1350,
  despawnGraceMs: 5000,

  spawnOnce: true,

  debug: false,
  debugRejectedLimit: 40,
};

const ROBOT_TYPES = ["padrao", "serra"];

const PERFIS = {
  serra: {
    frameWidth: 278,
    frameHeight: 270,
    scale: 0.36,
    width: 190,
    height: 100,
    offsetX: 44,
    offsetY: 160,
  },

  padrao: {
    frameWidth: 311,
    frameHeight: 421,
    scale: 0.23,
    width: 180,
    height: 110,
    offsetX: 65,
    offsetY: 270,
  },
};

// =====================================================
// DISTANCIA
// =====================================================

/**
 * Calcula a distância ao quadrado para comparar alcances sem calcular raiz quadrada.
 */
function distancia2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;

  return dx * dx + dy * dy;
}

// =====================================================
// LIMITES DO MAPA
// =====================================================

/**
 * Obtém os limites do mapa pelos chunks ou usa os limites de referência quando eles não estão
 * disponíveis.
 */
function limitesMapa(map) {
  const layers = map?.data?.layers || map?.layers || [];

  const chunks = layers.flatMap((l) => l.chunks || []);

  const w = Number(map?.tileWidth || 1);
  const h = Number(map?.tileHeight || 1);

  if (!chunks.length) {
    return {
      left: -2304,
      top: -3072,
      right: 2304,
      bottom: 9216,
    };
  }

  return chunks.reduce(
    (b, c) => ({
      left: Math.min(b.left, c.x * w),

      top: Math.min(b.top, c.y * h),

      right: Math.max(b.right, (c.x + c.width) * w),

      bottom: Math.max(b.bottom, (c.y + c.height) * h),
    }),
    {
      left: Infinity,
      top: Infinity,
      right: -Infinity,
      bottom: -Infinity,
    },
  );
}

// =====================================================
// HITBOX UTILIZADA NO SPAWN
// =====================================================

/**
 * Calcula a área ocupada pelos pés do tipo de robô, incluindo uma margem de segurança.
 */
function footprint(x, y, tipo, margem) {
  const p = PERFIS[tipo] || PERFIS.padrao;

  const displayW = p.frameWidth * p.scale;

  const displayH = p.frameHeight * p.scale;

  return new Phaser.Geom.Rectangle(
    x - displayW / 2 + p.offsetX * p.scale - margem,

    y - displayH / 2 + p.offsetY * p.scale - margem,

    p.width * p.scale + margem * 2,

    p.height * p.scale + margem * 2,
  );
}

// =====================================================
// LIMPEZA DE ELEMENTOS
// =====================================================

/**
 * Remove elementos auxiliares e som de passos antes de descartar um inimigo.
 */
function destruirElementos(enemy) {
  for (const nome of [
    "debugHitboxDano",
    "fundoVida",
    "barraVida",
    "bordaVida",
  ]) {
    enemy[nome]?.destroy?.();
    enemy[nome] = null;
  }

  enemy.somPassoRobo?.stop?.();
  enemy.somPassoRobo?.destroy?.();

  enemy.somPassoRobo = null;
}

// =====================================================
// GERENCIADOR PRINCIPAL
// =====================================================

class EnemySpawnManager {
  /**
   * Inicializa zonas, limites, configuração e estruturas compartilhadas de colisão e limpeza.
   */
  constructor(scene, map, config = {}) {
    this.scene = scene;
    this.map = map;

    this.config = {
      ...SPAWN_CONFIG,
      ...config,
    };

    this.regions = SPAWN_ZONES.map((z) => ({
      id: z.id,

      center: {
        x: z.x,
        y: z.y,
      },

      activated: false,
      nextAttempt: 0,

      enemies: [],
      positions: [],
      rejected: [],
    }));

    this.mapBounds = limitesMapa(map);

    this.debugGraphics = this.config.debug
      ? scene.add.graphics().setDepth(190)
      : null;

    this.enemyGroup = null;
    this.colliders = [];

    this.lastCheckAt = -Infinity;
    this.destroyed = false;

    this.drawDebugRegions();

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  // ===================================================
  // COLISOES COMPARTILHADAS
  // ===================================================

  /**
   * Cria um grupo físico comum e conecta as colisões entre inimigos e contra o cenário.
   */
  prepararColisoes() {
    if (this.enemyGroup || !this.scene.physics) {
      return;
    }

    this.enemyGroup = this.scene.physics.add.group({
      runChildUpdate: false,
    });

    this.colliders.push(
      this.scene.physics.add.collider(this.enemyGroup, this.enemyGroup),
    );

    if (this.scene.collisionGroup) {
      this.colliders.push(
        this.scene.physics.add.collider(
          this.enemyGroup,
          this.scene.collisionGroup,
        ),
      );
    }
  }

  // ===================================================
  // QUANTIDADE DE INIMIGOS ATIVOS
  // ===================================================

  /**
   * Conta os inimigos locais ativos, excluindo mortos e representações remotas.
   */
  inimigosAtivos() {
    return (this.scene.inimigos || []).filter(
      (r) => r?.active && !r.morto && !r.remoteOnly,
    ).length;
  }

  // ===================================================
  // ATUALIZACAO
  // ===================================================

  /**
   * Executa periodicamente remoção por distância e ativação de zonas, somente no solo ou no
   * host.
   */
  update(time) {
    if (this.destroyed || time - this.lastCheckAt < this.config.checkInterval) {
      return;
    }

    this.lastCheckAt = time;

    if (
      !this.scene.player?.active ||
      (this.scene.multiplayer && !this.scene.isMultiplayerHost)
    ) {
      return;
    }

    this.limparDistantes(time);
    this.checkSpawnZones(time);
  }

  // ===================================================
  // REMOVER ROBOS MUITO DISTANTES
  // ===================================================

  /**
   * Acompanha o tempo de afastamento e remove inimigos que ficaram longe além do período de
   * tolerância.
   */
  limparDistantes(time) {
    const player = this.scene.player;

    const limite2 = this.config.despawnDistance ** 2;

    for (const region of this.regions) {
      region.enemies = region.enemies.filter((r) => {
        if (!r?.active || r.morto) {
          return false;
        }

        const distanciaAtual = distancia2(r.x, r.y, player.x, player.y);

        if (distanciaAtual <= limite2) {
          r.tempoLongeSpawnManager = null;
          return true;
        }

        if (r.tempoLongeSpawnManager == null) {
          r.tempoLongeSpawnManager = time;
          return true;
        }

        if (time - r.tempoLongeSpawnManager < this.config.despawnGraceMs) {
          return true;
        }

        this.removerInimigoDistante(r);

        return false;
      });
    }
  }

  // ===================================================
  // REMOCAO SEGURA
  // ===================================================

  /**
   * Desativa e remove com segurança um inimigo distante e suas referências na cena.
   */
  removerInimigoDistante(enemy) {
    if (!enemy?.active || enemy.morto) {
      return;
    }

    this.enemyGroup?.remove(enemy, false, false);

    enemy.setVelocity?.(0, 0);

    destruirElementos(enemy);

    enemy.hitboxDano = null;

    if (enemy.body) {
      enemy.body.enable = false;
    }

    enemy.destroy();

    this.scene.inimigos = (this.scene.inimigos || []).filter(
      (r) => r !== enemy,
    );

    if (this.scene.inimigoTeste === enemy) {
      this.scene.inimigoTeste =
        this.scene.inimigos.find((r) => r?.active) || null;
    }
  }

  // ===================================================
  // VERIFICAR ZONAS DE SPAWN
  // ===================================================

  /**
   * Ativa zonas próximas com vagas disponíveis; uma zona só é concluída quando contém atirador
   * e serra.
   */
  checkSpawnZones(time = this.scene.time?.now ?? 0) {
    const player = this.scene.player;

    if (!player?.active) return;

    const raio2 = this.config.activationRadius ** 2;

    for (const region of this.regions) {
      if (
        (this.config.spawnOnce && region.activated) ||
        time < region.nextAttempt
      ) {
        continue;
      }

      const distanciaZona = distancia2(
        player.x,
        player.y,
        region.center.x,
        region.center.y,
      );

      if (distanciaZona > raio2) {
        continue;
      }

      // =========================================
      // VERIFICAR VAGAS
      // =========================================

      const vagas = this.config.maxActiveEnemies - this.inimigosAtivos();

      const tiposAtivos = new Set(
        region.enemies
          .filter((r) => r?.active && !r.morto)
          .map((r) => r.tipoRobo),
      );

      // Garantir que os dois tipos existam.
      const faltantes = ROBOT_TYPES.filter((tipo) => !tiposAtivos.has(tipo));

      if (vagas < faltantes.length || vagas <= 0) {
        region.nextAttempt = time + this.config.retryDelay;

        continue;
      }

      // =========================================
      // CRIAR GRUPO
      // =========================================

      const criados = this.spawnRegion(region, vagas);

      const presentes = new Set(
        region.enemies
          .filter((r) => r?.active && !r.morto)
          .map((r) => r.tipoRobo),
      );

      // So considera a zona ativada se
      // houver robo-serra E robo atirador.
      region.activated = ROBOT_TYPES.every((tipo) => presentes.has(tipo));

      region.nextAttempt = time + this.config.retryDelay;

      if (this.config.debug) {
        console.log(
          `[SpawnManager] Zona ${region.id}: ` +
            `${criados} criados; ` +
            `serra=${presentes.has("serra")}, ` +
            `disparo=${presentes.has("padrao")}`,
        );
      }
    }
  }

  // ===================================================
  // GERAR ROBOS DE UMA REGIAO
  // ===================================================

  /**
   * Planeja o grupo antes de criá-lo, garantindo posições para tipos obrigatórios e
   * respeitando o limite de vagas.
   */
  spawnRegion(region, vagas = Infinity) {
    region.enemies = region.enemies.filter((r) => r?.active && !r.morto);

    const existentes = region.enemies.length;

    const min = Math.max(2, Math.floor(this.config.minEnemies));

    const max = Math.max(min, Math.floor(this.config.maxEnemies));

    if (!Number.isFinite(region.targetCount)) {
      region.targetCount = Phaser.Math.Between(min, max);
    }

    // =========================================
    // IDENTIFICAR TIPOS OBRIGATORIOS
    // =========================================

    const tiposAtivos = new Set(region.enemies.map((r) => r.tipoRobo));

    const necessarios = ROBOT_TYPES.filter((tipo) => !tiposAtivos.has(tipo));

    if (vagas < necessarios.length) {
      return 0;
    }

    const total = Math.min(Math.max(0, region.targetCount - existentes), vagas);

    // Primeiro garante uma unidade de cada classe.
    const tipos = [...necessarios];

    // Outros robos sorteados normalmente.
    while (tipos.length < total) {
      tipos.push(ROBOT_TYPES[Math.floor(Math.random() * ROBOT_TYPES.length)]);
    }

    // =========================================
    // PLANEJAR POSICOES ANTES DE CRIAR
    // =========================================

    const escolhidas = [];
    const planejados = [];

    for (const tipo of tipos) {
      const pos = this.findPosition(region, tipo, escolhidas);

      if (!pos) {
        // Se falhar um dos tipos obrigatorios,
        // nao cria um grupo desequilibrado.
        if (necessarios.includes(tipo)) {
          return 0;
        }

        continue;
      }

      escolhidas.push(pos);

      planejados.push({
        tipo,
        pos,
      });
    }

    // =========================================
    // CRIAR SPRITES
    // =========================================

    const criados = [];

    for (const { tipo, pos } of planejados) {
      this.scene.networkEnemyId = (this.scene.networkEnemyId || 0) + 1;

      const enemy = criarInimigoTeste(this.scene, {
        x: pos.x,
        y: pos.y,

        tipoRobo: tipo,

        networkId: `${
          this.scene.multiplayerManager?.playerId || "local"
        }-zone-${region.id}-${this.scene.networkEnemyId}`,

        formacaoIndex: this.scene.inimigos.length,

        velocidade: tipo === "serra" ? 62 : 50,

        distanciaDeteccao: tipo === "serra" ? 820 : 760,

        distanciaAtaque: tipo === "serra" ? 68 : 330,

        distanciaGrupo: 220,

        vidaMaxima: tipo === "serra" ? 120 : 100,

        danoContato: 12,

        // Robos atiradores mais perigosos.
        tempoEntreTiros: tipo === "padrao" ? 600 : 720,

        danoLaser: tipo === "padrao" ? 6 : 5,
      });

      if (!enemy) continue;

      this.prepararColisoes();

      this.enemyGroup?.add(enemy);

      region.enemies.push(enemy);
      criados.push(enemy);
    }

    region.positions = escolhidas;

    this.drawDebugRegions();

    return criados.length;
  }

  // ===================================================
  // PROCURAR POSICAO DE SPAWN
  // ===================================================

  /**
   * Sorteia e valida posições na região até encontrar uma opção ou esgotar o número de
   * tentativas.
   */
  findPosition(region, tipoRobo, positions) {
    const rejeitados = [];

    for (
      let tentativa = 0;
      tentativa < this.config.maxAttemptsPerEnemy;
      tentativa++
    ) {
      const ang = Math.random() * Math.PI * 2;

      const raio = Math.sqrt(Math.random()) * this.config.spawnRadius;

      const ponto = {
        x: region.center.x + Math.cos(ang) * raio,

        y: region.center.y + Math.sin(ang) * raio,
      };

      if (this.isValidPosition(ponto, tipoRobo, positions)) {
        region.rejected = rejeitados;
        return ponto;
      }

      if (rejeitados.length < this.config.debugRejectedLimit) {
        rejeitados.push(ponto);
      }
    }

    region.rejected = rejeitados;
    return null;
  }

  // ===================================================
  // VERIFICAR POSICAO LIVRE
  // ===================================================

  /**
   * Valida limites, distância mínima, obstáculos e separação de outros robôs para uma posição
   * candidata.
   */
  isValidPosition(candidate, tipoRobo, positions) {
    const rect = footprint(
      candidate.x,
      candidate.y,
      tipoRobo,
      this.config.wallMargin,
    );

    const b = this.mapBounds;

    // Limites do mapa.
    if (
      rect.left < b.left ||
      rect.right > b.right ||
      rect.top < b.top ||
      rect.bottom > b.bottom
    ) {
      return false;
    }

    const min2 = this.config.minEnemyDistance ** 2;

    // Distancia de outras posicoes planejadas.
    if (
      positions.some(
        (p) => distancia2(candidate.x, candidate.y, p.x, p.y) < min2,
      )
    ) {
      return false;
    }

    // Distancia do jogador.
    const player = this.scene.player;

    if (
      player?.active &&
      distancia2(candidate.x, candidate.y, player.x, player.y) <
        this.config.minPlayerDistance ** 2
    ) {
      return false;
    }

    // Colisoes do mapa.
    for (const bloco of this.scene.collisionGroup?.getChildren?.() || []) {
      if (!bloco?.body || bloco.body.enable === false) {
        continue;
      }

      const bb = new Phaser.Geom.Rectangle(
        bloco.body.x,
        bloco.body.y,
        bloco.body.width,
        bloco.body.height,
      );

      if (Phaser.Geom.Intersects.RectangleToRectangle(rect, bb)) {
        return false;
      }
    }

    // Outros inimigos.
    return !(this.scene.inimigos || []).some(
      (r) =>
        r?.active &&
        !r.morto &&
        distancia2(candidate.x, candidate.y, r.x, r.y) < min2,
    );
  }

  // ===================================================
  // COMPATIBILIDADE COM CHAMADAS ANTERIORES
  // ===================================================

  /**
   * Adiciona inimigos recém-criados ao grupo de colisões compartilhado, preservando chamadas
   * anteriores da API.
   */
  addCollidersForNewEnemies(enemies) {
    if (!enemies?.length) return;

    this.prepararColisoes();

    for (const enemy of enemies) {
      if (enemy?.active && !this.enemyGroup.contains(enemy)) {
        this.enemyGroup.add(enemy);
      }
    }
  }

  // ===================================================
  // DEBUG DAS ZONAS
  // ===================================================

  /**
   * Desenha áreas de geração e ativação e as posições aceitas ou rejeitadas quando o debug
   * está ligado.
   */
  drawDebugRegions() {
    const g = this.debugGraphics;

    if (!g || !this.config.debug) {
      return;
    }

    g.clear();

    for (const region of this.regions) {
      g.lineStyle(2, 0xffcc00, 0.8);

      g.strokeCircle(region.center.x, region.center.y, this.config.spawnRadius);

      g.lineStyle(2, 0x00ccff, 0.8);

      g.strokeCircle(
        region.center.x,
        region.center.y,
        this.config.activationRadius,
      );

      if (!region.activated) continue;

      g.fillStyle(0xff3333, 0.9);

      for (const p of region.positions) {
        g.fillCircle(p.x, p.y, 7);
      }

      g.fillStyle(0xff00ff, 0.5);

      for (const p of region.rejected) {
        g.fillCircle(p.x, p.y, 3);
      }
    }
  }

  // ===================================================
  // DESTRUIR GERENCIADOR
  // ===================================================

  /**
   * Destrói colliders, grupo e gráficos e limpa os registros das regiões uma única vez.
   */
  destroy() {
    if (this.destroyed) return;

    this.destroyed = true;

    for (const c of this.colliders) {
      c?.destroy?.();
    }

    this.colliders = [];

    this.enemyGroup?.destroy(false);
    this.enemyGroup = null;

    this.debugGraphics?.destroy();
    this.debugGraphics = null;

    this.regions = [];
  }
}

export { SPAWN_CONFIG, SPAWN_ZONES, EnemySpawnManager };

export default EnemySpawnManager;
