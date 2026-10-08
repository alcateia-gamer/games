import criarLevel1Map from "../map/MapaCidade.js";

import criarTransicaoParaParte2 from "../core/MapTransition.js";

import criarAnimacoesPlayer, {
  criarAnimacoesPersonagensRemotos,
} from "../player/PlayerAnimations.js";

import {
  criarPlayer,
  respawnPlayer,
  atualizarHitboxDanoPlayer,
  atualizarDepthPlayer,
} from "../player/Player.js";

import {
  criarControles,
  atualizarControles,
} from "../controls/PlayerControls.js";

import {
  criarStatusPlayer,
  atualizarStatusPlayer,
  tomarDano,
} from "../player/PlayerStatus.js";

import {
  criarInimigoTeste,
  criarRobos,
  criarRoboSerra,
  atualizarInimigoTeste,
  causarDanoInimigo,
} from "../enemies/EnemyTest.js";
import {
  atualizarEstadoVisualRobo,
  tocarAnimacaoInimigo,
} from "../enemies/EnemyAnimations.js";
import { atualizarTransicaoParaParte2 } from "../core/MapTransition.js";
import { atualizarDepthLuzesPostes } from "../map/LuzesMapa.js";
import {
  criarCompanionPet,
  atualizarCompanionPet,
  atualizarDepthCompanionPet,
} from "../player/CompanionPet.js";
import {
  criarSistemaProjeteis,
  atualizarProjeteis,
} from "../player/PlayerProjectiles.js";
import EnemySpawnManager from "../enemies/EnemySpawnManager.js";

const DEBUG_TELEPORTES = false;
// =====================================================
// LEVEL 1
// =====================================================

class Level1 extends Phaser.Scene {
  constructor() {
    super("Level1");

    this.DEBUG_DEPTH_SORTING = false;

    // =====================================================
    // MOVIMENTO
    // =====================================================

    this.threshold = 0.1;

    this.speed = 200;
    this.speedTurbo = 400;
    this.velocidadeProjetil = 420;
    this.developerMode = false;

    this.direction = undefined;

    this.direcaoAtual = "down";

    this.atacando = false;

    // =====================================================
    // RESPAWN
    // =====================================================

    this.respawnX = -490;

    this.respawnY = 8823;
  }

  init(data) {
    this.respawnX = data.spawnX ?? -490;
    this.respawnY = data.spawnY ?? 8823;
    this.personagemSelecionada = data.personagem || "standard";
    this.multiplayer = data.multiplayer === true;
    this.multiplayerManager = this.game.registry.get("multiplayer");
    this.remotePlayers = new Map();
    this.remoteProjectiles = new Map();
    this.lastNetworkUpdate = 0;
    this.networkAttackId = 0;
    this.networkProjectileId = 0;
    this.lastEnemyNetworkUpdate = 0;
    this.isMultiplayerHost =
      this.multiplayer &&
      this.multiplayerManager?.room?.hostId ===
        this.multiplayerManager?.playerId;
    this.portaAbertaAoEntrar = data.portaAberta === true;
    this.entradaComFade = data.transicao === true;
    this.morteEmAndamento = false;
    this.inimigos = [];
    this.grupoRobosAtivado = false;
    this.inimigoTeste = null;
  }

  // =====================================================
  // CREATE
  // =====================================================

  create() {
    this.physics.resume();
    this.physics.world.resume();
    if (this.entradaComFade) {
      this.cameras.main.fadeIn(250, 0, 0, 0);
    }
    this.input.keyboard.enabled = true;
    this.input.keyboard.resetKeys();

    // =====================================================
    // MAPA
    // =====================================================

    this.map = criarLevel1Map(this);

    // =====================================================
    // ANIMAÇÕES DO PLAYER
    // =====================================================

    criarAnimacoesPlayer(this);
    criarAnimacoesPersonagensRemotos(this);

    // =====================================================
    // PLAYER
    // =====================================================

    criarPlayer(this);
    if (!this.multiplayer) {
      criarCompanionPet(this);
    }

    if (this.multiplayer) this.iniciarMultiplayer();

    this.atualizarProfundidadePostes();

    // =====================================================
    // COLISÃO DO PLAYER COM O MAPA
    // =====================================================

    if (this.collisionGroup) {
      this.physics.add.collider(this.player, this.collisionGroup);
    }

    this.canTeleport = true;

    const teleporteA = this.add.zone(-436, 9000, 80, 12).setVisible(false);
    this.physics.add.existing(teleporteA, true);
    teleporteA.body.setSize(60, 12);
    teleporteA.body.debugShowBody = false;

    const teleporteB = this.add.zone(816, -860, 90, 12).setVisible(false);
    this.physics.add.existing(teleporteB, true);
    teleporteB.body.setSize(60, 12);
    teleporteB.body.debugShowBody = false;

    if (DEBUG_TELEPORTES) {
      this.add
        .graphics()
        .setDepth(100)
        .lineStyle(1, 0xff00ff, 1)
        .strokeRect(-476, 9000, 60, 12)
        .strokeRect(771, -866, 60, 12);
    }

    const teleportarComFadeNovo = (x, y) => {
      if (!this.canTeleport) return;

      this.canTeleport = false;
      const camera = this.cameras.main;

      camera.once("camerafadeoutcomplete", () => {
        this.player.setPosition(x, y);
        this.companionPet?.setPosition(x - 45, y + 35);
        camera.fadeIn(250, 0, 0, 0);

        this.time.delayedCall(400, () => {
          this.canTeleport = true;
        });
      });

      camera.fadeOut(250, 0, 0, 0);
    };

    this.physics.add.overlap(this.player, teleporteA, () => {
      teleportarComFadeNovo(818, -848);
    });

    this.physics.add.overlap(this.player, teleporteB, () => {
      teleportarComFadeNovo(-436, 8959);
    });

    criarSistemaProjeteis(this);

    // =====================================================
    // PORTA PARA A PARTE 2
    // =====================================================

    criarTransicaoParaParte2(this);

    // =====================================================
    // HITBOX DE DANO DO PLAYER
    //
    // ATUALIZA DEPOIS DA FÍSICA
    // =====================================================

    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => {
      atualizarHitboxDanoPlayer(this);
    });

    // =====================================================
    // STATUS
    // =====================================================

    criarStatusPlayer(this);

    // =====================================================
    // CONTROLES
    // =====================================================

    criarControles(this);

    // =====================================================
    // COMANDOS DE SPAWN DOS ROBÔS
    // =====================================================

    this.inimigos = [];
    this.inimigoTeste = null;
    this.enemySpawnManager = new EnemySpawnManager(this, this.map);
    this.teclaSpawnRobo1 = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ONE,
    );
    this.teclaSpawnRobo2 = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.TWO,
    );
    this.teclaSpawnRobo3 = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.THREE,
    );
    this.teclaSpawnRoboSerra = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.FIVE,
    );

    // =====================================================
    // CÂMERA
    // =====================================================

    this.cameras.main.startFollow(this.player, true);

    this.cameras.main.setZoom(1);

    // =====================================================
    // COORDENADAS
    // =====================================================

    this.textoCoordenadas = this.add.text(10, 78, "", {
      fontSize: "14px",

      backgroundColor: "#000000",

      padding: {
        x: 6,
        y: 4,
      },
    });

    this.textoCoordenadas.setScrollFactor(0).setDepth(200);

    // =====================================================
    // TECLA R
    // =====================================================

    this.teclaR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
  }

  // =====================================================
  // UPDATE
  // =====================================================

  update(time, delta) {
    if (this.morteEmAndamento) {
      return;
    }

    if (!this.multiplayer && this.combatHitStopRemaining > 0) {
      this.combatHitStopRemaining -= delta;
      if (this.combatHitStopRemaining > 0) {
        return;
      }
      this.combatHitStopRemaining = 0;
    }

    // =====================================================
    // CONTROLES
    // =====================================================

    atualizarControles(this);

    // =====================================================
    // VIDA E ESTAMINA
    // =====================================================

    atualizarStatusPlayer(this, delta);
    atualizarTransicaoParaParte2(this);

    this.atualizarProfundidadeCerca();
    this.atualizarProfundidadePostes();

    // =====================================================
    // INIMIGO
    // =====================================================

    if (
      (!this.multiplayer || this.isMultiplayerHost) &&
      Phaser.Input.Keyboard.JustDown(this.teclaSpawnRobo1)
    ) {
      criarRobos(this, 1);
    } else if (
      (!this.multiplayer || this.isMultiplayerHost) &&
      Phaser.Input.Keyboard.JustDown(this.teclaSpawnRobo2)
    ) {
      criarRobos(this, 2);
    } else if (
      (!this.multiplayer || this.isMultiplayerHost) &&
      Phaser.Input.Keyboard.JustDown(this.teclaSpawnRobo3)
    ) {
      criarRobos(this, 3);
    }
    if (Phaser.Input.Keyboard.JustDown(this.teclaSpawnRoboSerra)) {
      criarRoboSerra(this);
    }

    atualizarInimigoTeste(this, time);
    this.enemySpawnManager?.update(time);
    atualizarProjeteis(this, delta);
    if (!this.multiplayer) {
      atualizarCompanionPet(this, time, delta);
    }
    this.atualizarInterpolacaoRemota(delta);

    if (
      this.multiplayer &&
      this.isMultiplayerHost &&
      time - this.lastEnemyNetworkUpdate >= 1000 / 30
    ) {
      this.lastEnemyNetworkUpdate = time;
      this.multiplayerManager?.publishEnemyState(this.inimigos);
    }

    // =====================================================
    // COORDENADAS
    // =====================================================

    const x = Math.round(this.player.x);

    const y = Math.round(this.player.y);

    this.textoCoordenadas.setText("X: " + x + "  Y: " + y);

    // =====================================================
    // RESPAWN
    // =====================================================

    if (Phaser.Input.Keyboard.JustDown(this.teclaR)) {
      respawnPlayer(this);
    }

    if (this.multiplayer && time - this.lastNetworkUpdate >= 1000 / 30) {
      this.lastNetworkUpdate = time;
      this.multiplayerManager?.sendPlayerState(
        this.player.x,
        this.player.y,
        this.direcaoAtual,
        this.player.body?.velocity?.lengthSq() > 0,
        this.atacando,
        this.direcaoAtaque ?? this.direcaoAtual,
        this.networkAttackId,
        this.attackPhase,
        this.projeteisPlayer
          ?.getChildren?.()
          .filter((projetil) => projetil.active)
          .map((projetil) => ({
            id: projetil.networkId,
            x: projetil.x,
            y: projetil.y,
            frame: projetil.frameProjetil,
          })) ?? [],
      );
    }
  }

  iniciarMultiplayer() {
    const manager = this.multiplayerManager;
    if (!manager) return;
    this.onEnemyDamage = ({ enemyId, playerId, damage }) => {
      if (!this.isMultiplayerHost) return;
      const enemy = this.inimigos.find(
        (item) => item.networkId === enemyId && !item.remoteOnly,
      );
      if (enemy) {
        enemy.alvoPlayerId = playerId;
        causarDanoInimigo(this, enemy, damage);
      }
    };
    this.onPlayerDamage = (damage) => tomarDano(this, damage);
    this.onMultiplayerRoomUpdated = (room) => {
      this.isMultiplayerHost = room.hostId === manager.playerId;
      this.atualizarJogadoresRemotos(room);
      this.atualizarInimigosRemotos(room);
    };
    manager.on("roomUpdated", this.onMultiplayerRoomUpdated, this);
    manager.on("enemyDamage", this.onEnemyDamage, this);
    manager.on("playerDamage", this.onPlayerDamage, this);
    this.atualizarJogadoresRemotos(manager.room);
    this.atualizarInimigosRemotos(manager.room);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      manager.off("roomUpdated", this.onMultiplayerRoomUpdated, this);
      manager.off("enemyDamage", this.onEnemyDamage, this);
      manager.off("playerDamage", this.onPlayerDamage, this);
      this.remotePlayers.forEach((sprite) => sprite.destroy());
      this.remotePlayers.clear();
      this.remoteProjectiles.forEach((sprite) => sprite.destroy());
      this.remoteProjectiles.clear();
    });
  }

  atualizarInimigosRemotos(room) {
    if (!this.multiplayer || this.isMultiplayerHost || !room) return;
    const activeIds = new Set();
    (room.enemies || []).forEach((data) => {
      if (!data?.id) return;
      activeIds.add(data.id);
      let enemy = this.inimigos.find((item) => item.networkId === data.id);
      if (!enemy) {
        enemy = criarInimigoTeste(this, {
          networkId: data.id,
          remoteOnly: true,
          x: data.x,
          y: data.y,
          vidaMaxima: data.vidaMaxima,
          direcaoAtual: data.direction,
        });
      }
      enemy.targetX = data.x;
      enemy.targetY = data.y;
      enemy.direcaoAtual = data.direction || enemy.direcaoAtual;
      enemy.alerta = Boolean(data.alerta || data.visual === "alerta");
      enemy.estado = data.estado || (enemy.alerta ? "alerta" : "idle");
      enemy.visualAtual = data.visual || enemy.visualAtual;
      enemy.vida = data.vida;
      enemy.vidaMaxima = data.vidaMaxima || enemy.vidaMaxima;
      if (data.attackId && enemy.remoteAttackId !== data.attackId) {
        enemy.remoteAttackId = data.attackId;
        this.criarLaserInimigoRemoto(enemy, data);
      }
      atualizarEstadoVisualRobo(enemy);
      tocarAnimacaoInimigo(enemy);
    });
    this.inimigos
      .filter((enemy) => enemy.remoteOnly && !activeIds.has(enemy.networkId))
      .forEach((enemy) => {
        [enemy.fundoVida, enemy.barraVida, enemy.bordaVida].forEach((element) =>
          element?.destroy(),
        );
        enemy.destroy();
      });
    this.inimigos = this.inimigos.filter(
      (enemy) => !enemy.remoteOnly || activeIds.has(enemy.networkId),
    );
    this.inimigoTeste = this.inimigos[0] || null;
  }

  atualizarJogadoresRemotos(room) {
    if (!room?.players) return;
    const activeIds = new Set();
    room.players.forEach((player) => {
      if (player.id === this.multiplayerManager.playerId || !player.character)
        return;
      activeIds.add(player.id);
      const texture = {
        standard: "walk",
        personagem2: "personagem2-walk",
        personagem3: "personagem3-walk",
        personagem4: "personagem4-walk",
      }[player.character];
      if (!texture) return;
      let remote = this.remotePlayers.get(player.id);
      const remoteFoiCriado = !remote;
      if (!remote) {
        const initialFrame =
          {
            up: 0,
            left: 9,
            down: 18,
            right: 27,
          }[player.direction] ?? 18;
        remote = this.add
          .sprite(player.x, player.y, texture, initialFrame)
          .setOrigin(0.5, 0.5)
          .setAlpha(0.88)
          .setDepth(13);
        remote.playerId = player.id;
        remote.targetX = player.x;
        remote.targetY = player.y;
        remote.remoteAttackId = 0;
        remote.remoteAttackPhase = "normal";
        remote.remoteAttackActive = false;
        remote.remoteAnimationKey = null;
        this.remotePlayers.set(player.id, remote);
      }
      const projectileIds = new Set();
      (player.projectiles || []).forEach((projectile) => {
        if (!projectile?.id) return;
        projectileIds.add(`${player.id}:${projectile.id}`);
        const projectileKey = `${player.id}:${projectile.id}`;
        let remoteProjectile = this.remoteProjectiles.get(projectileKey);
        if (!remoteProjectile) {
          remoteProjectile = this.add.sprite(
            projectile.x,
            projectile.y,
            "aria-arrow",
            projectile.frame ?? 0,
          );
          remoteProjectile.setDepth(55);
          remoteProjectile.targetX = projectile.x;
          remoteProjectile.targetY = projectile.y;
          this.remoteProjectiles.set(projectileKey, remoteProjectile);
        }
        remoteProjectile.setFrame(projectile.frame ?? 0);
        remoteProjectile.targetX = projectile.x;
        remoteProjectile.targetY = projectile.y;
      });
      this.remoteProjectiles.forEach((sprite, projectileKey) => {
        if (
          projectileKey.startsWith(`${player.id}:`) &&
          !projectileIds.has(projectileKey)
        ) {
          sprite.destroy();
          this.remoteProjectiles.delete(projectileKey);
        }
      });
      if (remote.texture.key !== texture && !remote.remoteAttackActive) {
        remote.setTexture(texture);
      }
      const direction = player.direction || "down";
      const attackDirection = player.attackDirection || direction;
      const walkKey = `remote-${player.character}-walk-${direction}`;
      const attackPhase = player.attackPhase || "normal";
      const attackKey =
        player.character === "personagem3" && attackPhase !== "normal"
          ? `remote-${player.character}-${attackPhase}-${attackDirection}`
          : `remote-${player.character}-attack-${attackDirection}`;
      if (remoteFoiCriado) {
        remote.remoteAttackId = player.attacking
          ? Math.max(0, player.attackId - 1)
          : player.attackId;
        remote.remoteAttackPhase = player.attacking ? "normal" : attackPhase;
        remote.remoteAttackDirection = attackDirection;
      }
      remote.targetX = player.x;
      remote.targetY = player.y;
      const stillMoving = Boolean(player.moving);
      const attackChanged =
        player.attackId > 0 &&
        (remote.remoteAttackId !== player.attackId ||
          (player.attacking &&
            (remote.remoteAttackPhase !== attackPhase ||
              remote.remoteAttackDirection !== attackDirection)));
      if (attackChanged) {
        remote.remoteAttackId = player.attackId;
        remote.remoteAttackPhase = attackPhase;
        remote.remoteAttackDirection = attackDirection;
        remote.remoteAttackActive = true;
        remote.remoteAnimationKey = attackKey;
        remote.anims.play(attackKey, false);
      } else if (
        !player.attacking &&
        remote.remoteAttackActive &&
        remote.anims.isPlaying
      ) {
      } else if (
        !player.attacking &&
        stillMoving &&
        remote.remoteAnimationKey !== walkKey
      ) {
        remote.remoteAttackActive = false;
        remote.remoteAnimationKey = walkKey;
        remote.anims.play(walkKey, true);
      } else if (!player.attacking && !stillMoving) {
        remote.remoteAttackActive = false;
        remote.setTexture(texture);
        const idleFrame =
          direction === "up"
            ? 0
            : direction === "left"
              ? 9
              : direction === "right"
                ? 27
                : 18;
        if (
          remote.anims.isPlaying ||
          remote.frame?.name !== idleFrame ||
          remote.remoteAnimationKey !== `idle-${direction}`
        ) {
          remote.anims.stop();
          remote.setFrame(idleFrame);
          remote.remoteAnimationKey = `idle-${direction}`;
        }
      }
    });
    this.remotePlayers.forEach((sprite, id) => {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.remotePlayers.delete(id);
      }
    });
  }

  atualizarInterpolacaoRemota(delta = 0) {
    const alpha = 1 - Math.exp((-12 * Math.max(0, delta)) / 1000);
    this.remotePlayers.forEach((sprite) => {
      sprite.x = Phaser.Math.Linear(
        sprite.x,
        sprite.targetX ?? sprite.x,
        alpha,
      );
      sprite.y = Phaser.Math.Linear(
        sprite.y,
        sprite.targetY ?? sprite.y,
        alpha,
      );
    });
    this.remoteProjectiles.forEach((sprite) => {
      sprite.x = Phaser.Math.Linear(
        sprite.x,
        sprite.targetX ?? sprite.x,
        alpha,
      );
      sprite.y = Phaser.Math.Linear(
        sprite.y,
        sprite.targetY ?? sprite.y,
        alpha,
      );
    });
    this.inimigos
      ?.filter((enemy) => enemy.remoteOnly)
      .forEach((enemy) => {
        enemy.x = Phaser.Math.Linear(enemy.x, enemy.targetX ?? enemy.x, alpha);
        enemy.y = Phaser.Math.Linear(enemy.y, enemy.targetY ?? enemy.y, alpha);
      });
  }

  criarLaserInimigoRemoto(enemy, data) {
    const laser = this.add
      .circle(enemy.x, enemy.y, 4, 0xff0000, 1)
      .setDepth(55);
    laser.setStrokeStyle(2, 0xff8888, 1);
    this.tweens.add({
      targets: laser,
      x: data.targetX ?? enemy.x,
      y: data.targetY ?? enemy.y,
      duration: 220,
      onComplete: () => laser.destroy(),
    });
  }

  // =====================================================
  // PROFUNDIDADE DAS CERCA
  // =====================================================
  // Cerca do spawn: sempre fica na frente do personagem.
  // Camada "Cercas":
  //   y >= -207 -> fica atrás do personagem
  //   y <= -225 -> fica na frente do personagem
  //   entre esses valores -> continua atrás
  // =====================================================
  atualizarProfundidadeCerca() {
    if (!this.player?.body) {
      return;
    }

    if (this.camadaCercaSpawn) {
      this.camadaCercaSpawn.setDepth(14);
    }

    if (!this.camadaCercas) {
      if (!this.camadaCercaFabrica) {
        return;
      }
    }

    if (this.player.y >= -207) {
      this.camadaCercas?.setDepth(11);
    } else if (this.player.y <= -225) {
      this.camadaCercas?.setDepth(14);
    } else {
      this.camadaCercas?.setDepth(11);
    }

    if (this.camadaCercaFabrica) {
      if (this.player.y <= -1660) {
        this.camadaCercaFabrica.setDepth(14);
      } else if (this.player.y >= -1646) {
        this.camadaCercaFabrica.setDepth(11);
      } else {
        this.camadaCercaFabrica.setDepth(11);
      }
    }
  }

  atualizarProfundidadePostes() {
    if (!this.player?.active) {
      return;
    }

    atualizarDepthPlayer(this);
    atualizarDepthCompanionPet(this);
    atualizarDepthLuzesPostes(this);

    if (Array.isArray(this.poleBaseObjects)) {
      this.poleBaseObjects.forEach((base) => {
        if (!base?.active) {
          return;
        }

        const baseDepth = this.calcularDepthMundo(base.getData("worldY"));

        base.setDepth(baseDepth);
      });
    }

    if (Array.isArray(this.inimigos)) {
      this.inimigos.forEach((inimigo) => {
        if (!inimigo || !inimigo.active) {
          return;
        }

        const footY = inimigo.body?.bottom ?? inimigo.getBounds().bottom;
        inimigo.setDepth(this.calcularDepthMundo(footY));
      });
    }
  }
}

export default Level1;
