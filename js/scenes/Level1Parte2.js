import { prepararAudioCoop } from "../multiplayer/CoopAudio.js";
import { descarregarCidade, descarregarFabricaParaBoss } from "../map/ProgressaoMapa.js";
import { atualizarSpawnsDev } from "../controls/DeveloperSpawns.js";
import { obterBocaMetralhadora, criarMunicaoRobo } from "../enemies/WarRobotProjectile.js";
/**
 * @file Cena da fábrica. Integra iluminação, gerador, porta interativa, inventário e
 * mudança de sobreposição por região.
 */

import { iniciarMusicaFabrica } from "../sounds/musicaFabrica.js";
import { desvanecerMusicaAmbiente, DURACAO_SAIDA_MUSICA_MS } from "../sounds/musicaAmbiente.js";
import criarLevel1Parte2Map from "../map/MapaFabrica.js";
import MiniMapManager from "../ui/MiniMapManager.js";
import { criarSpawnAreasRoboBola } from "../enemies/RoboBolaSpawnAreas.js";
import { configurarTrocaCamada } from "../map/TrocaCamada.js";

import {
  atualizarDepthAtores,
  atualizarDepthGarras,
  atualizarDepthObjetosProducaoEArmazem,
  atualizarDepthComputadoresPcAdm,
  atualizarDepthObjetosSuperPC,
  atualizarDepthObjetosDepthPerso,
  atualizarDepthParedePortaBoss,
} from "../map/ProfundidadeMapa.js";

import criarAnimacoesPlayer, {
  criarAnimacoesPersonagensRemotos,
} from "../player/PlayerAnimations.js";

import { criarPlayer, atualizarHitboxDanoPlayer, atualizarDepthPlayer } from "../player/Player.js";

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

import { prepararBoss, atualizarBoss } from "../enemies/BossPrincipal.js";
import criarIluminacaoTerror from "../effects/TerrorLighting.js";
import {
  atualizarSistemaInventario,
  criarSistemaInventario,
} from "../inventory/ItemPickup.js";
import {
  FACTORY_GENERATOR_STATE_KEY,
  criarInteracaoGeradorFabrica,
} from "../interactions/FactoryGenerator.js";
import { criarInteracaoPortaFabrica } from "../interactions/FactoryDoor.js";
import { criarRoboBola, atualizarRoboBola } from "../enemies/RoboBola.js";

import { criarRuntimeCoop } from "../multiplayer/CoopRuntime.js";

class Level1Parte2 extends Phaser.Scene {
  /**
   * Registra a segunda parte da fase e define movimento e profundidade inicial do personagem.
   */
  constructor() {
    super("Level1Parte2");

    this.DEBUG_MAP = true;
    this.profundidadePersonagemParte2 = 16.5;
    this.speed = 200;
    this.speedTurbo = 400;
    this.velocidadeProjetil = 420;
    this.developerMode = false;
    this.direcaoAtual = "down";
    this.atacando = false;
  }

  /**
   * Recupera energia persistida e dados de entrada e reinicializa rede, inimigos e controles
   * de transição.
   */
  init(data) {
    this.developerMode = data.developerMode ?? this.developerMode;
    this.novoBossConfig = data.novoBossConfig ?? null;
    this.luzFabricaAcesa =
      this.game.registry.get(FACTORY_GENERATOR_STATE_KEY) === true;
    this.respawnX = data.spawnX ?? -1093;
    this.respawnY = data.spawnY ?? -5905;

    this.profundidadePersonagemParte2 =
      data.profundidadePersonagem ?? this.profundidadePersonagemParte2;

    this.personagemSelecionada = data.personagem || "kai-mercer";

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
    this.telaMorteMostrada = false;
    this.coopParryUntil = 0;
    this.coopHologram = false;
    this.inimigos = [];
    this.lasersInimigo = null;
    this.grupoRobosAtivado = false;
    this.inimigoTeste = null;
    this.cidadeDescarregada = false;
    this.fabricaDescarregada = false;
    this.limiteFabricaDescarregadaY = null;
    this.teleporteRetornoLiberado = false;
    this.transicaoRetornoEmAndamento = false;
    this.regiaoTrocaCamada = null;
    this.profundidadeRegiaoTroca = null;
  }

  // =====================================================
  // COORDENADAS FIXAS DURANTE O ZOOM
  // =====================================================

  /**
   * Conecta o reposicionamento do texto de coordenadas para que permaneça fixo durante o zoom.
   */
  configurarCoordenadasFixas() {
    const texto = this.textoCoordenadas;

    if (!texto) return;

    const posicaoX = 10;
    const posicaoY = 78;

    /**
     * Compensa a transformação da câmera para manter o texto na mesma posição e com a mesma
     * escala visual.
     */
    const atualizarPosicao = () => {
      if (!texto.scene) return;

      const camera = this.cameras.main;
      if (!camera) return;

      const zoomX = camera.zoomX || camera.zoom || 1;

      const zoomY = camera.zoomY || camera.zoom || 1;

      const centroX = camera.width * camera.originX;

      const centroY = camera.height * camera.originY;

      // Mantém as coordenadas no mesmo ponto da tela.
      texto.setPosition(
        centroX + (posicaoX - centroX) / zoomX,
        centroY + (posicaoY - centroY) / zoomY,
      );

      // Mantém o tamanho original do texto.
      texto.setScale(1 / zoomX, 1 / zoomY);
    };

    this.events.on(Phaser.Scenes.Events.PRE_RENDER, atualizarPosicao);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.PRE_RENDER, atualizarPosicao);
    });

    atualizarPosicao();
  }

  // =====================================================
  // CRIAÇÃO DA CENA
  // =====================================================

  /**
   * Monta mapa, jogador, controles, inventário, interações e retorno à cidade.
   */
  create() {
    prepararAudioCoop(this);
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
    this.teclaSpawnRoboBola = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SIX,
    );

    this.map = criarLevel1Parte2Map(this);
    this.inicializarTrocaCamada();

    criarAnimacoesPlayer(this);
    criarAnimacoesPersonagensRemotos(this);
    criarPlayer(this);

    this.definirProfundidadePersonagem(this.profundidadePersonagemParte2);
    // Os pontos de LuzesFabrica só ficam disponíveis depois da criação do mapa.
    this.removerLanternaParte2 = criarIluminacaoTerror(this);

    if (!this.multiplayer) {
      criarCompanionPet(this);
    }

    this.criarTeleporteRetornoParte1();

    if (this.collisionGroup) {
      this.colliderPlayerMapa = this.physics.add.collider(
        this.player,
        this.collisionGroup,
      );
    }

    criarSistemaProjeteis(this);

    const atualizarPosFisica = () => {
      atualizarHitboxDanoPlayer(this);
      atualizarDepthAtores(this);
      atualizarDepthGarras(this);
      atualizarDepthComputadoresPcAdm(this);
      atualizarDepthObjetosSuperPC(this);
      atualizarDepthObjetosDepthPerso(this);
      atualizarDepthParedePortaBoss(this);
    };
    this.events.on(Phaser.Scenes.Events.POST_UPDATE, atualizarPosFisica);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.POST_UPDATE, atualizarPosFisica);
    });

    criarStatusPlayer(this);
    criarControles(this);
    criarSistemaInventario(this);
    this.removerInteracaoGerador = criarInteracaoGeradorFabrica(this);
    criarInteracaoPortaFabrica(this);
    this.minimap = new MiniMapManager(this, this.map, "fabrica");

    if (this.multiplayer) {
      this.iniciarMultiplayer();
    }

    prepararBoss(this);

    // =====================================================
    // TEXTO DE COORDENADAS
    // =====================================================

    this.textoCoordenadas = this.add.text(10, 78, "", {
      fontSize: "14px",
      backgroundColor: "#000000",
      padding: {
        x: 6,
        y: 4,
      },
    });

    this.textoCoordenadas.setScrollFactor(0).setDepth(200).setVisible(!this.multiplayer);

    // Compensa o zoom sem modificar o visual.
    this.configurarCoordenadasFixas();

    // O arredondamento causa saltos de 1 px no HUD fixo durante o movimento.
    this.cameras.main.startFollow(this.player, false);

    this.cameras.main.setZoom(1);

    this.inimigos = [];
    this.grupoRobosAtivado = false;
    this.inimigoTeste = null;
    this.spawnAreasRoboBola = criarSpawnAreasRoboBola(this);
    criarRuntimeCoop(this);
    iniciarMusicaFabrica(this);
    if (this.luzFabricaAcesa) descarregarCidade(this);
  }

  /**
   * Liga a iluminação uma única vez e persiste o estado do gerador no registry entre visitas
   * ao mapa.
   */
  acenderLuzFabrica(obterProgressoPartida = null) {
    if (this.luzFabricaAcesa) return;

    if (this.coopRuntime) obterProgressoPartida = this.coopRuntime.world.generatorProgress();
    this.luzFabricaAcesa = true;
    this.game.registry.set(FACTORY_GENERATOR_STATE_KEY, true);
    this.definirIluminacaoFabrica(true, obterProgressoPartida);
    descarregarCidade(this);
  }

  /** Invocada pelo início autoritativo da cutscene e por sua réplica de rede. */
  descarregarFabricaParaBoss() {
    descarregarFabricaParaBoss(this);
  }

  /** Permite repetir o teste da fábrica sem energia pelo mesmo controle DEV. */
  apagarLuzFabrica() {
    if (!this.developerMode || !this.luzFabricaAcesa) return;

    this.luzFabricaAcesa = false;
    this.game.registry.set(FACTORY_GENERATOR_STATE_KEY, false);
    this.definirIluminacaoFabrica(false);
  }

  /** Carrega o gatilho do Tiled sem alterar a ordem global do mapa. */
  inicializarTrocaCamada() {
    configurarTrocaCamada(this);
  }

  /** Cada ator usa sua própria hitbox para entrar e sair do gatilho. */
  atualizarTrocaCamada() {
    atualizarDepthAtores(this);
  }

  // =====================================================
  // ATUALIZAÇÃO
  // =====================================================

  /**
   * Atualiza interações antes da entrada por E, depois movimento, inventário, status,
   * profundidade, inimigos e rede.
   */
  update(time, delta) {
    atualizarBoss(this, time, delta);
    this.minimap?.update(time);
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

    this.atualizarInteracaoGeradorFabrica?.();
    this.atualizarInteracaoPortaFabrica?.();
    atualizarControles(this);
    atualizarSistemaInventario(this, delta);
    atualizarStatusPlayer(this, delta);

    this.definirProfundidadePersonagem(this.profundidadePersonagemParte2);
    this.atualizarTrocaCamada();

    atualizarDepthObjetosProducaoEArmazem(this);
    atualizarDepthGarras(this);
    atualizarDepthComputadoresPcAdm(this);

    atualizarSpawnsDev(this);

    this.spawnAreasRoboBola?.atualizar(delta);
    atualizarInimigoTeste(this, time);
    atualizarRoboBola(this, time, delta);
    atualizarProjeteis(this, delta);

    if (!this.multiplayer) {
      atualizarCompanionPet(this, time, delta);

      atualizarDepthCompanionPet(this);
    }

    this.atualizarInterpolacaoRemota(delta);

    if (
      this.multiplayer &&
      !this.coopRuntime &&
      this.isMultiplayerHost &&
      time - this.lastEnemyNetworkUpdate >= 1000 / 30
    ) {
      this.lastEnemyNetworkUpdate = time;

      this.multiplayerManager?.publishEnemyState(this.inimigos);
    }

    if (this.multiplayer && !this.coopRuntime && time - this.lastNetworkUpdate >= 1000 / 30) {
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
            rotation: projetil.rotation,
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

  // =====================================================
  // MULTIPLAYER
  // =====================================================

  /**
   * Conecta os eventos multiplayer e prepara a limpeza dos objetos e listeners remotos da
   * fábrica.
   */
  iniciarMultiplayer() {
    const manager = this.multiplayerManager;

    if (!manager) return;

    /**
     * Aplica no host o dano solicitado por outro jogador e registra esse participante como
     * alvo do inimigo.
     */
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

    /**
     * Encaminha o dano recebido da rede para os status do jogador local.
     */
    this.onPlayerDamage = (damage) => tomarDano(this, damage);

    /**
     * Reavalia quem é host e sincroniza os objetos remotos após uma atualização de sala.
     */
    this.onMultiplayerRoomUpdated = (room) => {
      this.isMultiplayerHost = room.hostId === manager.playerId;

      this.atualizarJogadoresRemotos(room);
      this.atualizarInimigosRemotos(room);
    };

    manager.on("roomUpdated", this.onMultiplayerRoomUpdated, this);

    manager.on("enemyDamage", this.onEnemyDamage, this);

    manager.on("playerDamage", this.onPlayerDamage, this);

    // CoopRuntime cria as representações depois que os sistemas da cena estão prontos.

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

  // =====================================================
  // JOGADORES REMOTOS
  // =====================================================

  /**
   * Mantém sprites, ataques e projéteis dos demais jogadores de acordo com o estado
   * compartilhado.
   */
  atualizarJogadoresRemotos(room) {
    if (this.coopRuntime) return;
    if (!room?.players) return;

    const activeIds = new Set();

    room.players.forEach((player) => {
      if (player.id === this.multiplayerManager.playerId || !player.character) {
        return;
      }

      activeIds.add(player.id);

      const texture = {
        "kai-mercer": "walk",
        "magnus-force": "personagem2-walk",
        "aria-kade": "personagem3-walk",
        nyx: "personagem4-walk",
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
          .setVertexRoundMode("safe")
          .setAlpha(0.88)
          .setDepth(13);

        remote.targetX = player.x;
        remote.targetY = player.y;
        remote.remoteAttackId = 0;
        remote.remoteAttackPhase = "normal";
        remote.remoteAttackActive = false;
        remote.remoteAnimationKey = null;

        this.remotePlayers.set(player.id, remote);
      }

      if (remote.texture.key !== texture && !remote.remoteAttackActive) {
        remote.setTexture(texture);
      }
      remote.mapCharacter = player.character;

      const direction = player.direction || "down";

      const attackDirection = player.attackDirection || direction;

      const walkKey = `remote-${player.character}-walk-${direction}`;

      const attackPhase = player.attackPhase || "normal";

      const attackKey =
        player.character === "aria-kade" && attackPhase !== "normal"
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
        // Mantém a animação atual.
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
        remote.anims.stop();

        const idleFrame =
          direction === "up"
            ? 0
            : direction === "left"
              ? 9
              : direction === "right"
                ? 27
                : 18;

        if (
          remote.frame?.name !== idleFrame ||
          remote.remoteAnimationKey !== `idle-${direction}`
        ) {
          remote.setFrame(idleFrame);
          remote.remoteAnimationKey = `idle-${direction}`;
        }
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
        remoteProjectile.setRotation(projectile.rotation ?? 0);

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

  // =====================================================
  // INIMIGOS REMOTOS
  // =====================================================

  /**
   * Atualiza as representações de inimigos nos clientes e remove robôs ausentes da lista
   * recebida.
   */
  atualizarInimigosRemotos(room) {
    if (this.coopRuntime) return;
    if (!this.multiplayer || this.isMultiplayerHost || !room) {
      return;
    }

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

      atualizarEstadoVisualRobo(enemy);
      tocarAnimacaoInimigo(enemy);
      if (data.attackId && enemy.remoteAttackId !== data.attackId) {
        enemy.remoteAttackId = data.attackId;

        this.criarLaserInimigoRemoto(enemy, data);
      }

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

  // =====================================================
  // INTERPOLAÇÃO REMOTA
  // =====================================================

  /**
   * Suaviza o deslocamento das representações remotas em direção às últimas posições
   * recebidas.
   */
  atualizarInterpolacaoRemota(delta = 0) {
    if (this.coopRuntime) return;
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
        enemy.body?.updateFromGameObject();
      });
  }

  // =====================================================
  // LASER REMOTO
  // =====================================================

  /**
   * Representa um disparo inimigo comunicado pela rede com um efeito visual de laser.
   */
  criarLaserInimigoRemoto(enemy, data) {
    const boca = obterBocaMetralhadora(enemy);
    const angulo = Math.atan2((data.targetY ?? enemy.y) - boca.y, (data.targetX ?? enemy.x) - boca.x);
    const laser = criarMunicaoRobo(this, boca.x, boca.y, angulo, boca);
    this.tweens.add({
      targets: laser,
      x: data.targetX ?? enemy.x,
      y: data.targetY ?? enemy.y,
      duration: 220,
      onComplete: () => laser.destroy(),
    });
  }

  // =====================================================
  // PROFUNDIDADE DO PERSONAGEM
  // =====================================================

  /**
   * Valida e aplica a profundidade configurada para o personagem nesta cena.
   */
  definirProfundidadePersonagem(profundidade) {
    const valor = Number(profundidade);

    if (!Number.isFinite(valor)) {
      return;
    }

    this.profundidadePersonagemParte2 = valor;

    atualizarDepthPlayer(this);
    atualizarDepthObjetosSuperPC(this);
    atualizarDepthObjetosDepthPerso(this);
    atualizarDepthParedePortaBoss(this);
  }

  // =====================================================
  // TELEPORTE DE RETORNO
  // =====================================================

  /**
   * Cria a área de saída e retorna à cidade com fade, preservando personagem, modo de jogo e
   * porta de entrada aberta.
   */
  criarTeleporteRetornoParte1() {
    const x = 95;
    const y = -916;
    const largura = 100;
    const altura = 8;

    this.teleporteRetornoParte1 = this.add.zone(x, y, largura, altura);

    this.physics.world.enable(
      this.teleporteRetornoParte1,
      Phaser.Physics.Arcade.STATIC_BODY,
    );

    this.teleporteRetornoParte1.body.setSize(largura, altura);
    this.physics.add.collider(this.player, this.teleporteRetornoParte1, undefined,
      () => this.luzFabricaAcesa || this.cidadeDescarregada);

    this.physics.add.overlap(this.player, this.teleporteRetornoParte1, () => {
      if (
        this.cidadeDescarregada || this.luzFabricaAcesa ||
        this.transicaoRetornoEmAndamento ||
        (!this.teleporteRetornoLiberado &&
          (this.player.body?.velocity?.y ?? 0) >= 0)
      ) {
        return;
      }

      this.transicaoRetornoEmAndamento = true;

      if (this.coopRuntime) {
        this.transicaoRetornoEmAndamento = false;
        return this.coopRuntime.world.requestMap("Level1");
      }

      this.physics.pause();

      desvanecerMusicaAmbiente(this);
      this.cameras.main.fadeOut(DURACAO_SAIDA_MUSICA_MS, 0, 0, 0);

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
