import criarLevel1Parte2Map from "../map/MapaFabrica.js";
import {
  atualizarDepthGarras,
  atualizarDepthObjetosProducaoEArmazem,
} from "../map/ProfundidadeMapa.js";
import criarAnimacoesPlayer, {
  criarAnimacoesPersonagensRemotos,
} from "../player/PlayerAnimations.js";
import { criarPlayer, atualizarHitboxDanoPlayer } from "../player/Player.js";
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
  limparGrupoRobos,
  causarDanoInimigo,
} from "../enemies/EnemyTest.js";
import {
  atualizarEstadoVisualRobo,
  tocarAnimacaoInimigo,
} from "../enemies/EnemyAnimations.js";
import {
  criarCompanionPet,
  atualizarCompanionPet,
  atualizarDepthCompanionPet,
} from "../player/CompanionPet.js";
import {
  criarSistemaProjeteis,
  atualizarProjeteis,
} from "../player/PlayerProjectiles.js";

class Level1Parte2 extends Phaser.Scene {
  constructor() {
    super("Level1Parte2");

    this.DEBUG_MAP = true;
    this.profundidadePersonagemParte2 = 16.5;
    this.threshold = 0.1;
    this.speed = 200;
    this.speedTurbo = 400;
    this.velocidadeProjetil = 420;
    this.developerMode = false;
    this.direcaoAtual = "down";
    this.atacando = false;
  }

  init(data) {
    this.respawnX = data.spawnX ?? 97;
    this.respawnY = data.spawnY ?? -980;
    this.profundidadePersonagemParte2 =
      data.profundidadePersonagem ?? this.profundidadePersonagemParte2;
    this.personagemSelecionada = data.personagem || "standard";
    this.multiplayer = data.multiplayer === true;
    this.multiplayerManager = this.game.registry.get("multiplayer");
    this.remotePlayers = new Map();
    this.remoteProjectiles = new Map();
    this.lastNetworkUpdate = 0;
    this.lastEnemyNetworkUpdate = 0;
    this.networkAttackId = 0;
    this.networkProjectileId = 0;
    this.isMultiplayerHost =
      this.multiplayer &&
      this.multiplayerManager?.room?.hostId ===
        this.multiplayerManager?.playerId;
    this.morteEmAndamento = false;
    this.inimigos = [];
    this.grupoRobosAtivado = false;
    this.inimigoTeste = null;
    this.teleporteRetornoLiberado = false;
    this.transicaoRetornoEmAndamento = false;
  }

  create() {
    this.physics.resume();
    this.physics.world.resume();
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.input.keyboard.enabled = true;
    this.input.keyboard.resetKeys();
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

    this.map = criarLevel1Parte2Map(this);
    criarAnimacoesPlayer(this);
    criarAnimacoesPersonagensRemotos(this);
    criarPlayer(this);
    this.definirProfundidadePersonagem(this.profundidadePersonagemParte2);
    if (!this.multiplayer) {
      criarCompanionPet(this);
    }

    this.criarTeleporteRetornoParte1();

    if (this.collisionGroup) {
      this.physics.add.collider(this.player, this.collisionGroup);
    }
    criarSistemaProjeteis(this);

    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => {
      atualizarHitboxDanoPlayer(this);
    });

    criarStatusPlayer(this);
    criarControles(this);
    if (this.multiplayer) this.iniciarMultiplayer();

    this.textoCoordenadas = this.add.text(10, 78, "", {
      fontSize: "14px",
      backgroundColor: "#000000",
      padding: {
        x: 6,
        y: 4,
      },
    });

    this.textoCoordenadas.setScrollFactor(0).setDepth(200);

    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.setZoom(1);

    this.inimigos = [];
    this.grupoRobosAtivado = false;
    this.inimigoTeste = null;
  }

  update(time, delta) {
    if (this.morteEmAndamento) {
      return;
    }

    atualizarControles(this);
    atualizarStatusPlayer(this, delta);
    this.definirProfundidadePersonagem(this.profundidadePersonagemParte2);
    atualizarDepthObjetosProducaoEArmazem(this);
    atualizarDepthGarras(this);

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
    atualizarProjeteis(this, delta);
    if (!this.multiplayer) {
      atualizarCompanionPet(this, time, delta);
      atualizarDepthCompanionPet(this);
    }
    this.atualizarInterpolacaoRemota();

    if (
      this.multiplayer &&
      this.isMultiplayerHost &&
      time - this.lastEnemyNetworkUpdate >= 1000 / 30
    ) {
      this.lastEnemyNetworkUpdate = time;
      this.multiplayerManager?.publishEnemyState(this.inimigos);
    }

    if (this.multiplayer && time - this.lastNetworkUpdate >= 1000 / 30) {
      this.lastNetworkUpdate = time;
      this.multiplayerManager?.sendPlayerState(
        this.player.x,
        this.player.y,
        this.direcaoAtual,
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

    const x = Math.round(this.player.x);
    const y = Math.round(this.player.y);

    this.textoCoordenadas.setText("X: " + x + "  Y: " + y);

    if (
      !this.teleporteRetornoLiberado &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, 95, -965) > 24
    ) {
      this.teleporteRetornoLiberado = true;
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
      if (!remote) {
        remote = this.add
          .sprite(player.x, player.y, texture, 18)
          .setOrigin(0.5, 0.5)
          .setAlpha(0.88)
          .setDepth(13);
        remote.targetX = player.x;
        remote.targetY = player.y;
        remote.remoteAttackId = 0;
        remote.remoteAttackPhase = "normal";
        this.remotePlayers.set(player.id, remote);
      }
      if (remote.texture.key !== texture) remote.setTexture(texture);
      const direction = player.direction || "down";
      const attackDirection = player.attackDirection || direction;
      const walkKey = `remote-${player.character}-walk-${direction}`;
      const attackPhase = player.attackPhase || "normal";
      const attackKey =
        player.character === "personagem3" && attackPhase !== "normal"
          ? `remote-${player.character}-${attackPhase}-${attackDirection}`
          : `remote-${player.character}-attack-${attackDirection}`;
      const targetChanged =
        remote.targetX !== player.x || remote.targetY !== player.y;
      remote.targetX = player.x;
      remote.targetY = player.y;
      const stillMoving =
        targetChanged ||
        Math.abs(remote.x - remote.targetX) > 2 ||
        Math.abs(remote.y - remote.targetY) > 2;
      if (
        player.attacking &&
        (remote.remoteAttackId !== player.attackId ||
          remote.remoteAttackPhase !== attackPhase ||
          !remote.anims.isPlaying)
      ) {
        remote.remoteAttackId = player.attackId;
        remote.remoteAttackPhase = attackPhase;
        remote.anims.play(attackKey, true);
      } else if (
        !player.attacking &&
        (stillMoving || remote.anims.currentAnim?.key !== walkKey)
      ) {
        remote.anims.play(walkKey, true);
      } else if (
        !player.attacking &&
        !stillMoving &&
        remote.anims.currentAnim?.key === walkKey
      ) {
        remote.anims.stop();
        remote.setFrame(
          direction === "up"
            ? 0
            : direction === "left"
              ? 9
              : direction === "right"
                ? 27
                : 18,
        );
      }
      const projectileIds = new Set();
      (player.projectiles || []).forEach((projectile) => {
        if (!projectile?.id) return;
        const projectileKey = `${player.id}:${projectile.id}`;
        projectileIds.add(projectileKey);
        let remoteProjectile = this.remoteProjectiles.get(projectileKey);
        if (!remoteProjectile) {
          remoteProjectile = this.add
            .sprite(
              projectile.x,
              projectile.y,
              "aria-arrow",
              projectile.frame ?? 0,
            )
            .setDepth(55);
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
    });
    this.remotePlayers.forEach((sprite, id) => {
      if (!activeIds.has(id)) {
        sprite.destroy();
        this.remotePlayers.delete(id);
      }
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

  atualizarInterpolacaoRemota() {
    this.remotePlayers.forEach((sprite) => {
      sprite.x = Phaser.Math.Linear(sprite.x, sprite.targetX ?? sprite.x, 0.35);
      sprite.y = Phaser.Math.Linear(sprite.y, sprite.targetY ?? sprite.y, 0.35);
    });
    this.remoteProjectiles.forEach((sprite) => {
      sprite.x = Phaser.Math.Linear(sprite.x, sprite.targetX ?? sprite.x, 0.55);
      sprite.y = Phaser.Math.Linear(sprite.y, sprite.targetY ?? sprite.y, 0.55);
    });
    this.inimigos
      ?.filter((enemy) => enemy.remoteOnly)
      .forEach((enemy) => {
        enemy.x = Phaser.Math.Linear(enemy.x, enemy.targetX ?? enemy.x, 0.35);
        enemy.y = Phaser.Math.Linear(enemy.y, enemy.targetY ?? enemy.y, 0.35);
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

  definirProfundidadePersonagem(profundidade) {
    const valor = Number(profundidade);

    if (!Number.isFinite(valor)) {
      return;
    }

    this.profundidadePersonagemParte2 = valor;
    this.player?.setDepth(valor);
  }

  criarTeleporteRetornoParte1() {
    const x = 95;
    const y = -965;
    const largura = 16;
    const altura = 8;

    this.teleporteRetornoParte1 = this.add.zone(x, y, largura, altura);

    this.physics.world.enable(
      this.teleporteRetornoParte1,
      Phaser.Physics.Arcade.STATIC_BODY,
    );
    this.teleporteRetornoParte1.body.setSize(largura, altura);

    this.physics.add.overlap(this.player, this.teleporteRetornoParte1, () => {
      if (
        this.transicaoRetornoEmAndamento ||
        (!this.teleporteRetornoLiberado &&
          (this.player.body?.velocity?.y ?? 0) >= 0)
      ) {
        return;
      }

      this.transicaoRetornoEmAndamento = true;
      this.physics.pause();
      this.cameras.main.fadeOut(250, 0, 0, 0);

      this.cameras.main.once("camerafadeoutcomplete", () => {
        limparGrupoRobos(this);
        this.scene.start("Level1", {
          spawnX: 72,
          spawnY: -2160,
          portaAberta: true,
          transicao: true,
          personagem: this.personagemSelecionada,
          multiplayer: this.multiplayer,
        });
      });
    });
  }
}

export default Level1Parte2;
