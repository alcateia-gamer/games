/**
 * @file Protocolo de salas sobre MQTT. O host publica o estado compartilhado; clientes enviam
 * ações, presença e atualizações de movimento.
 */

import { COOP, RecentActions, validPlayerState } from "./CoopProtocol.js";

const ROOM_CODE = /^[A-Z0-9]{4,6}$/;
const CHARACTER_IDS = ["kai-mercer", "magnus-force", "aria-kade", "nyx"];
const MAX_PLAYERS = 4;
const HEARTBEAT_MS = 3000;
const PLAYER_TIMEOUT_MS = 10000;

/**
 * Gera um código de sala de quatro caracteres sem símbolos visualmente ambíguos.
 */
function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 4 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

/**
 * Remove espaços e converte o código digitado para maiúsculas.
 */
function cleanCode(code) {
  return String(code || "")
    .replace(/\s/g, "")
    .toUpperCase();
}

class MultiplayerManager extends Phaser.Events.EventEmitter {
  /**
   * Assina os eventos do cliente MQTT e inicializa os dados de sala e presença.
   */
  constructor(mqtt) {
    super();
    this.mqtt = mqtt;
    this.playerId = mqtt.clientId;
    this.room = null;
    this.roomTopic = null;
    this.heartbeatTimer = null;
    this.coopActions = new RecentActions();
    this.coopSequence = 0;
    this.coopReceivedSequence = -1;
    this.actionSequence = 0;
    /**
     * Encaminha mensagens MQTT para o roteador do gerenciador, preservando a referência para
     * remoção do listener.
     */
    this.boundMessage = (topic, data) => this.receive(topic, data);
    mqtt.on("message", this.boundMessage);
    mqtt.on("connect", () => this.emit("connectionChanged", true));
    mqtt.on("close", () => this.emit("connectionChanged", false));
    mqtt.on("error", (error) => this.emit("error", error));
    mqtt.connect();
  }

  /**
   * Normaliza dados recebidos de um jogador e preenche valores ausentes de posição, ataque e
   * presença.
   */
  normalizePlayer(player) {
    return {
      id: String(player.id),
      isHost: Boolean(player.isHost),
      character: CHARACTER_IDS.includes(player.character)
        ? player.character
        : null,
      ready: Boolean(player.ready),
      x: Number.isFinite(player.x) ? player.x : -490,
      y: Number.isFinite(player.y) ? player.y : 8823,
      direction: player.direction || "down",
      moving: Boolean(player.moving),
      attacking: Boolean(player.attacking),
      attackDirection: player.attackDirection || player.direction || "down",
      attackId: Number(player.attackId) || 0,
      attackPhase: player.attackPhase || "normal",
      attackStartedAt: Number(player.attackStartedAt) || 0,
      serverTick: Number(player.serverTick) || 0,
      projectiles: Array.isArray(player.projectiles) ? player.projectiles : [],
      mapKey: COOP.maps.includes(player.mapKey) ? player.mapKey : "Level1",
      health: Number.isFinite(player.health) ? player.health : 100,
      maxHealth: Number.isFinite(player.maxHealth) ? player.maxHealth : 100,
      dead: Boolean(player.dead),
      coop: player.coop && typeof player.coop === "object" ? player.coop : null,
      nyxAura: player.character === "nyx" && player.nyxAura &&
        typeof player.nyxAura.id === "string" && Number.isFinite(player.nyxAura.startedAt)
        ? { id: player.nyxAura.id, startedAt: player.nyxAura.startedAt,
          mapKey: String(player.nyxAura.mapKey || "") } : null,
      nyxAuraCooldownUntil: Number(player.nyxAuraCooldownUntil) || 0,
      lastSeen: Number(player.lastSeen) || Date.now(),
    };
  }

  /**
   * Gera um código, entra como host e retorna o código da nova sala.
   */
  createRoom() {
    const code = makeRoomCode();
    this.enterRoom(code, true);
    return code;
  }

  /**
   * Valida o código digitado e solicita a entrada na sala como participante.
   */
  joinRoom(rawCode) {
    const code = cleanCode(rawCode);
    if (!ROOM_CODE.test(code)) {
      this.emit("error", new Error("Código de sala inválido"));
      return false;
    }
    this.enterRoom(code, false);
    return true;
  }

  /**
   * Sai da sala anterior, assina os tópicos da nova sala e inicia presença e solicitação de
   * entrada.
   */
  enterRoom(code, host) {
    this.leaveRoom(false);
    this.lastSentPlayerState = null;
    this.coopReceivedSequence = -1;
    this.coopSequence = 0;
    this.coopActions.clear();
    this.coopWorld = null;
    this.roomTopic = `room/${code}`;
    ["state", "action", "presence", "frame"].forEach((suffix) =>
      this.mqtt.subscribe(`${this.roomTopic}/${suffix}`),
    );
    this.room = host
      ? {
          roomCode: code,
          hostId: this.playerId,
          status: "WAITING",
          players: [this.normalizePlayer({ id: this.playerId, isHost: true })],
          enemies: [],
        }
      : null;
    if (host) this.publishState();
    this.publishAction({
      type: "join_room",
      roomCode: code,
      playerId: this.playerId,
    });
    this.startHeartbeat();
    this.emit(host ? "roomCreated" : "roomSearching", code);
  }

  /**
   * Filtra mensagens por sala e remetente e as encaminha para estado, ações ou presença.
   */
  receive(topic, data) {
    if (!this.roomTopic || !topic.startsWith(`${this.roomTopic}/`) || !data)
      return;
    const kind = topic.slice(this.roomTopic.length + 1);
    if (data.clientId === this.playerId && kind !== "action") return;
    if (kind === "state") this.receiveState(data);
    if (kind === "action") this.receiveAction(data);
    if (kind === "presence") this.receivePresence(data);
    if (kind === "frame") this.receiveCoopFrame(data);
  }

  /**
   * Aceita revisões mais recentes do estado da sala e anuncia atualizações ou início da
   * partida.
   */
  receiveState(data) {
    if (
      data.roomCode !== this.roomTopic.split("/")[1] ||
      !Array.isArray(data.players)
    )
      return;
    if (!this.room || data.revision > (this.room.revision || 0)) {
      this.room = {
        ...data,
        players: data.players.map((player) => this.normalizePlayer(player)),
      };
      this.emit("roomUpdated", this.room);
      if (this.room.status === "PLAYING") this.emit("gameStarted", this.room);
    }
  }

  /**
   * Processa entrada, escolhas, prontidão, movimento e dano; as decisões de sala são tratadas
   * pelo host.
   */
  receiveAction(action) {
    if (!action || !action.type) return;
    if (action.type === "coop_action") {
      const known = this.room?.players?.some(p => p.id === action.playerId);
      if (!known || (action.clientId && action.clientId !== action.playerId) ||
          !this.coopActions.accept(action.id)) return;
      if (action.targetId && action.targetId !== this.playerId) return;
      if (action.authority && action.playerId !== this.room.hostId) return;
      if (!action.authority && this.room.hostId !== this.playerId) return;
      this.emit("coopAction", action);
      return;
    }
    if (
      action.type === "character_rejected" &&
      action.playerId === this.playerId
    ) {
      this.emit("error", new Error("Esse personagem já foi escolhido"));
      return;
    }
    if (action.type === "join_room" && this.room?.hostId === this.playerId) {
      const existing = this.room.players.find(
        (player) => player.id === action.playerId,
      );
      if (existing) return;
      if (
        this.room.status === "PLAYING" ||
        this.room.players.length >= MAX_PLAYERS
      ) {
        this.mqtt.publish(`${this.roomTopic}/presence`, {
          type: "room_rejected",
          playerId: action.playerId,
          reason:
            this.room.status === "PLAYING" ? "Sala já iniciada" : "Sala cheia",
        });
        return;
      }
      if (
        this.room.status !== "PLAYING" &&
        this.room.players.length < MAX_PLAYERS
      ) {
        this.room.players.push(this.normalizePlayer({ id: action.playerId }));
        this.publishState();
      }
      return;
    }
    if (action.type === "heartbeat") {
      const player = this.room?.players.find(
        (item) => item.id === action.playerId,
      );
      if (player) player.lastSeen = Date.now();
      if (this.room?.hostId === this.playerId) this.publishState();
      return;
    }
    if (action.type === "enemy_damage" && this.room?.hostId === this.playerId) {
      const enemy = (this.room.enemies || []).find(
        (item) => item.id === action.enemyId,
      );
      if (enemy)
        this.emit("enemyDamage", {
          enemyId: enemy.id,
          playerId: action.playerId,
          damage: Math.min(Math.max(Number(action.damage) || 0, 0), 25),
        });
      return;
    }
    if (action.type === "player_damage" && action.targetId === this.playerId) {
      if (action.clientId && action.clientId !== this.room?.hostId) return;
      this.emit("playerDamage", Number(action.damage) || 0);
      return;
    }
    // As ações de escolha e prontidão abaixo só alteram a sala no cliente que é host.
    if (this.room?.hostId !== this.playerId) return;
    const player = this.room.players.find(
      (item) => item.id === action.playerId,
    );
    if (action.type === "leave_room") this.removePlayer(action.playerId);
    else if (
      action.type === "select_character" &&
      player &&
      this.room.status !== "PLAYING"
    ) {
      if (
        !CHARACTER_IDS.includes(action.character) ||
        this.room.players.some(
          (item) =>
            item.id !== player.id && item.character === action.character,
        )
      ) {
        this.publishAction({
          type: "character_rejected",
          playerId: action.playerId,
        });
        return;
      }
      player.character = action.character;
      player.ready = false;
      this.publishState();
    } else if (
      action.type === "player_ready" &&
      player &&
      this.room.status !== "PLAYING"
    ) {
      player.ready = Boolean(action.ready) && Boolean(player.character);
      this.publishState();
    } else if (action.type === "start_game" && this.canStart()) {
      this.room.status = "PLAYING";
      this.publishState();
      this.emit("gameStarted", this.room);
    } else if (action.type === "nyx_aura" && player?.character === "nyx" &&
      this.room.status === "PLAYING") {
      if (action.stop) {
        if (player.nyxAura?.id !== action.id) return;
        player.nyxAura = null;
      } else {
        const now = Date.now();
        if (now < (player.nyxAuraCooldownUntil || 0) ||
          typeof action.id !== "string" || !action.id || action.id.length > 120 ||
          !["Level1", "Level1Parte2"].includes(action.mapKey)) return;
        player.nyxAuraCooldownUntil = now + 20000;
        player.nyxAura = { id: action.id, startedAt: now, mapKey: action.mapKey };
      }
      this.publishState();
    } else if (action.type === "game_state" && player) {
      if (this.coopEnabled && (!validPlayerState(action) ||
          (action.clientId && action.clientId !== action.playerId))) return;
      const previousAttackId = player.attackId;
      player.x = Number.isFinite(action.x) ? action.x : player.x;
      player.y = Number.isFinite(action.y) ? action.y : player.y;
      player.direction = action.direction || player.direction;
      player.moving = Boolean(action.moving);
      player.attacking = Boolean(action.attacking);
      player.attackDirection = action.attackDirection || player.direction;
      player.attackId = Number(action.attackId) || player.attackId;
      player.attackPhase = action.attackPhase || "normal";
      if (player.attacking && player.attackId !== previousAttackId) {
        player.attackStartedAt = Date.now();
      }
      player.projectiles = Array.isArray(action.projectiles)
        ? action.projectiles.slice(0, 64)
        : [];
      if (this.coopEnabled) {
        player.mapKey = action.mapKey || "Level1";
        player.health = Math.max(0, Math.min(10000, Number(action.health) || 0));
        player.maxHealth = Math.max(1, Math.min(10000, Number(action.maxHealth) || 100));
        player.dead = Boolean(action.dead);
        player.coop = action.coop;
        player.lastSeen = Date.now();
        this.emit("playerInput", player);
      } else this.publishState({ retain: false, qos: 0 });
    }
  }

  /**
   * Trata saída, rejeição de entrada e atualização de presença dos participantes.
   */
  receivePresence(data) {
    if (data.type === "leave_room") this.removePlayer(data.playerId);
    if (data.type === "room_rejected" && data.playerId === this.playerId) {
      this.emit(
        "error",
        new Error(data.reason || "Não foi possível entrar na sala"),
      );
      this.leaveRoom(false);
    }
    if (data.type === "heartbeat") {
      const player = this.room?.players.find(
        (item) => item.id === data.playerId,
      );
      if (player) player.lastSeen = Date.now();
    }
  }

  /**
   * Publica uma ação no tópico da sala atual com as opções de entrega recebidas.
   */
  publishAction(action, options = {}) {
    return this.mqtt.publish(`${this.roomTopic}/action`, action, options);
  }

  /**
   * Incrementa a revisão do estado e publica jogadores, inimigos e referência de tempo para a
   * sala.
   */
  publishState(options = {}) {
    if (!this.room) return;
    // A revisão permite ignorar mensagens antigas que chegam depois de uma atualização.
    this.room.revision = (this.room.revision || 0) + 1;
    this.room.updatedAt = Date.now();
    this.room.serverTime = this.room.updatedAt;
    this.room.serverTick = Math.floor(this.room.serverTime / (1000 / 30));
    this.room.players.forEach((player) => {
      player.serverTick = this.room.serverTick;
    });
    this.mqtt.publish(`${this.roomTopic}/state`, this.room, {
      retain: options.retain ?? true,
      qos: options.qos ?? 1,
    });
    this.emit("roomUpdated", this.room);
  }

  /**
   * Envia a escolha de um personagem reconhecido pelo jogo.
   */
  selectCharacter(character) {
    if (CHARACTER_IDS.includes(character))
      this.publishAction({
        type: "select_character",
        playerId: this.playerId,
        character,
      });
  }
  /**
   * Envia o estado de prontidão do jogador local para o host.
   */
  setReady(ready) {
    this.publishAction({
      type: "player_ready",
      playerId: this.playerId,
      ready,
    });
  }
  /**
   * Verifica se há jogadores e se todos escolheram personagem e marcaram prontidão.
   */
  canStart() {
    return (
      Boolean(this.room?.players.length) &&
      this.room.players.every((player) => player.character && player.ready)
    );
  }
  /**
   * Solicita o início da partida somente quando o jogador local é host e todos estão prontos.
   */
  startGame() {
    if (this.room?.hostId === this.playerId && this.canStart())
      this.publishAction({ type: "start_game", playerId: this.playerId });
  }

  /**
   * Remove um jogador e escolhe outro host por ID quando o host anterior saiu.
   */
  removePlayer(playerId) {
    if (!this.room) return;
    const wasHost = this.room.hostId === playerId;
    this.room.players = this.room.players.filter(
      (player) => player.id !== playerId,
    );
    if (!this.room.players.length) {
      this.room = null;
      return;
    }
    if (wasHost) {
      const nextHost = [...this.room.players].sort((left, right) =>
        left.id.localeCompare(right.id),
      )[0];
      this.room.hostId = nextHost.id;
      this.room.players.forEach((player) => {
        player.isHost = player.id === nextHost.id;
      });
    }
    if (this.room.hostId === this.playerId) this.publishState();
    this.emit("playerLeft", playerId);
  }

  /**
   * Inicia mensagens periódicas de presença e detecta participantes ou host que excederam o
   * tempo limite.
   */
  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.roomTopic) return;
      this.publishAction({ type: "heartbeat", playerId: this.playerId });
      this.mqtt.publish(`${this.roomTopic}/presence`, {
        type: "heartbeat",
        playerId: this.playerId,
      });
      if (this.room?.hostId === this.playerId) {
        const now = Date.now();
        this.room.players
          .filter(
            (player) =>
              player.id !== this.playerId &&
              now - player.lastSeen > PLAYER_TIMEOUT_MS,
          )
          .forEach((player) => this.removePlayer(player.id));
      } else if (this.room) {
        const host = this.room.players.find(
          (player) => player.id === this.room.hostId,
        );
        if (host && Date.now() - host.lastSeen > PLAYER_TIMEOUT_MS) {
          const nextHost = [...this.room.players].sort((left, right) =>
            left.id.localeCompare(right.id),
          )[0];
          this.room.hostId = nextHost.id;
          this.room.players.forEach((player) => {
            player.isHost = player.id === nextHost.id;
          });
          if (nextHost.id === this.playerId) this.publishState();
          this.emit("roomUpdated", this.room);
        }
      }
    }, HEARTBEAT_MS);
  }

  /**
   * Cancela o temporizador de presença e limpa sua referência.
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
  }

  /**
   * Publica a saída quando solicitado, encerra a presença e cancela os tópicos da sala.
   */
  leaveRoom(publish = true) {
    if (publish && this.roomTopic) {
      this.publishAction({ type: "leave_room", playerId: this.playerId });
      this.mqtt.publish(`${this.roomTopic}/presence`, {
        type: "leave_room",
        playerId: this.playerId,
      });
    }
    this.stopHeartbeat();
    if (this.roomTopic)
      ["state", "action", "presence", "frame"].forEach((suffix) =>
        this.mqtt.unsubscribe(`${this.roomTopic}/${suffix}`),
      );
    this.roomTopic = null;
    this.room = null;
    this.coopEnabled = false;
    this.coopWorld = null;
  }

  /**
   * Envia posição, direção, ataque e projéteis somente quando o estado local mudou em relação
   * ao último envio.
   */
  sendPlayerState(
    x,
    y,
    direction,
    moving = false,
    attacking = false,
    attackDirection = direction,
    attackId = 0,
    attackPhase = "normal",
    projectiles = [],
    extra = {},
  ) {
    const nextState = {
      x,
      y,
      direction,
      moving: Boolean(moving),
      attacking: Boolean(attacking),
      attackDirection,
      attackId: Number(attackId) || 0,
      attackPhase,
      projectiles,
      ...extra,
    };
    const projectilesKey = JSON.stringify(projectiles);
    const previousState = this.lastSentPlayerState;
    // Evita tráfego repetido quando movimento, ataque e projéteis não mudaram.
    if (
      previousState &&
      previousState.x === nextState.x &&
      previousState.y === nextState.y &&
      previousState.direction === nextState.direction &&
      previousState.moving === nextState.moving &&
      previousState.attacking === nextState.attacking &&
      previousState.attackDirection === nextState.attackDirection &&
      previousState.attackId === nextState.attackId &&
      previousState.attackPhase === nextState.attackPhase &&
      previousState.projectilesKey === projectilesKey
      && previousState.extraKey === JSON.stringify(extra)
    ) {
      return false;
    }

    this.lastSentPlayerState = { ...nextState, projectilesKey, extraKey: JSON.stringify(extra) };
    if (this.coopEnabled && this.room?.hostId === this.playerId) {
      this.receiveAction({ type: "game_state", playerId: this.playerId, ...nextState });
      return true;
    }
    this.publishAction(
      {
        type: "game_state",
        playerId: this.playerId,
        ...nextState,
        projectiles,
      },
      { qos: 0 },
    );
    return true;
  }

  /**
   * Publica os inimigos ativos e seus alvos; somente o host pode atualizar esse estado
   * compartilhado.
   */
  publishEnemyState(enemies) {
    if (this.room?.hostId !== this.playerId) return;
    this.room.enemies = enemies
      .filter((enemy) => enemy?.active && !enemy.morto && enemy.networkId)
      .map((enemy) => ({
        id: enemy.networkId,
        x: enemy.x,
        y: enemy.y,
        direction: enemy.direcaoAtual,
        targetPlayerId: enemy.alvoPlayerId || null,
        targetX:
          this.room.players.find((player) => player.id === enemy.alvoPlayerId)
            ?.x ?? null,
        targetY:
          this.room.players.find((player) => player.id === enemy.alvoPlayerId)
            ?.y ?? null,
        alerta: Boolean(enemy.alerta),
        estado: enemy.estado || "idle",
        attackId: enemy.networkAttackId || 0,
        visual: enemy.visualAtual,
        vida: enemy.vida,
        vidaMaxima: enemy.vidaMaxima,
      }));
    if (!this.coopEnabled) this.publishState({ retain: false, qos: 0 });
  }

  enableCoop() { this.coopEnabled = true; }

  sendCoopAction(kind, payload = {}, { authority = false, targetId = null } = {}) {
    if (!this.roomTopic || (authority && this.room?.hostId !== this.playerId)) return false;
    this.publishAction({ type: "coop_action", kind, payload, authority, targetId,
      playerId: this.playerId, id: `${this.playerId}:${Date.now()}:${++this.actionSequence}` },
      { qos: 1, retain: false });
    return true;
  }

  publishCoopFrame(world) {
    if (!this.coopEnabled || this.room?.hostId !== this.playerId) return false;
    const packet = { roomCode: this.room.roomCode, hostId: this.playerId,
      sequence: ++this.coopSequence, serverTime: Date.now(),
      players: this.room.players, enemies: this.room.enemies || [], ...world };
    this.mqtt.publish(`${this.roomTopic}/frame`, packet, { qos: 0, retain: false,
      compress: this.room.players.every(p => p.coop?.compression) });
    return true;
  }

  receiveCoopFrame(packet) {
    if (!this.room || packet.roomCode !== this.room.roomCode ||
        packet.hostId !== this.room.hostId ||
        (packet.clientId && packet.clientId !== this.room.hostId) ||
        !Number.isSafeInteger(packet.sequence) || packet.sequence <= this.coopReceivedSequence ||
        !Array.isArray(packet.players) || packet.players.length > MAX_PLAYERS) return;
    this.coopReceivedSequence = packet.sequence;
    this.coopWorld = packet;
    this.room.players = packet.players.map(p => this.normalizePlayer(p));
    this.room.enemies = packet.enemies || [];
    this.room.serverTime = packet.serverTime;
    this.emit("coopFrame", packet);
    this.emit("roomUpdated", this.room);
  }

  /**
   * Envia ao host uma solicitação de dano contra um inimigo identificado pela rede.
   */
  requestEnemyDamage(enemyId, damage) {
    this.publishAction({
      type: "enemy_damage",
      playerId: this.playerId,
      enemyId,
      damage,
    });
  }

  /**
   * Permite que o host comunique dano a outro jogador, sem enviá-lo de volta ao próprio host.
   */
  publishPlayerDamage(targetId, damage) {
    if (
      this.room?.hostId === this.playerId &&
      targetId &&
      targetId !== this.playerId
    ) {
      this.publishAction({ type: "player_damage", targetId, damage });
    }
  }

  /**
   * Sai da sala e remove a assinatura de mensagens e os listeners do gerenciador.
   */
  destroy() {
    this.leaveRoom();
    this.mqtt.off("message", this.boundMessage);
    this.removeAllListeners();
  }
}

export { CHARACTER_IDS };
export default MultiplayerManager;
