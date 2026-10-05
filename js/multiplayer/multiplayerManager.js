const ROOM_CODE = /^[A-Z0-9]{4,6}$/;
const CHARACTER_IDS = ["standard", "personagem2", "personagem3", "personagem4"];
const MAX_PLAYERS = 4;
const HEARTBEAT_MS = 3000;
const PLAYER_TIMEOUT_MS = 10000;

function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function cleanCode(code) {
  return String(code || "").replace(/\s/g, "").toUpperCase();
}

class MultiplayerManager extends Phaser.Events.EventEmitter {
  constructor(mqtt) {
    super();
    this.mqtt = mqtt;
    this.playerId = mqtt.clientId;
    this.room = null;
    this.roomTopic = null;
    this.heartbeatTimer = null;
    this.boundMessage = (topic, data) => this.receive(topic, data);
    mqtt.on("message", this.boundMessage);
    mqtt.on("connect", () => this.emit("connectionChanged", true));
    mqtt.on("close", () => this.emit("connectionChanged", false));
    mqtt.on("error", (error) => this.emit("error", error));
    mqtt.connect();
  }

  normalizePlayer(player) {
    return {
      id: String(player.id), isHost: Boolean(player.isHost),
      character: CHARACTER_IDS.includes(player.character) ? player.character : null,
      ready: Boolean(player.ready), x: Number.isFinite(player.x) ? player.x : -490,
      y: Number.isFinite(player.y) ? player.y : 8823, direction: player.direction || "down",
      lastSeen: Number(player.lastSeen) || Date.now(),
    };
  }

  createRoom() {
    const code = makeRoomCode();
    this.enterRoom(code, true);
    return code;
  }

  joinRoom(rawCode) {
    const code = cleanCode(rawCode);
    if (!ROOM_CODE.test(code)) { this.emit("error", new Error("Código de sala inválido")); return false; }
    this.enterRoom(code, false);
    return true;
  }

  enterRoom(code, host) {
    this.leaveRoom(false);
    this.roomTopic = `room/${code}`;
    ["state", "action", "presence"].forEach((suffix) => this.mqtt.subscribe(`${this.roomTopic}/${suffix}`));
    this.room = host ? { roomCode: code, hostId: this.playerId, status: "WAITING", players: [this.normalizePlayer({ id: this.playerId, isHost: true })] } : null;
    if (host) this.publishState();
    this.publishAction({ type: "join_room", roomCode: code, playerId: this.playerId });
    this.startHeartbeat();
    this.emit(host ? "roomCreated" : "roomSearching", code);
  }

  receive(topic, data) {
    if (!this.roomTopic || !topic.startsWith(`${this.roomTopic}/`) || !data || data.clientId === this.playerId) return;
    const kind = topic.slice(this.roomTopic.length + 1);
    if (kind === "state") this.receiveState(data);
    if (kind === "action") this.receiveAction(data);
    if (kind === "presence") this.receivePresence(data);
  }

  receiveState(data) {
    if (data.roomCode !== this.roomTopic.split("/")[1] || !Array.isArray(data.players)) return;
    if (!this.room || data.revision >= (this.room.revision || 0)) {
      this.room = { ...data, players: data.players.map((player) => this.normalizePlayer(player)) };
      this.emit("roomUpdated", this.room);
      if (this.room.status === "PLAYING") this.emit("gameStarted", this.room);
    }
  }

  receiveAction(action) {
    if (!action || !action.type) return;
    if (action.type === "character_rejected" && action.playerId === this.playerId) {
      this.emit("error", new Error("Esse personagem já foi escolhido"));
      return;
    }
    if (action.type === "join_room" && this.room?.hostId === this.playerId) {
      const existing = this.room.players.find((player) => player.id === action.playerId);
      if (existing) return;
      if (this.room.status === "PLAYING" || this.room.players.length >= MAX_PLAYERS) {
        this.mqtt.publish(`${this.roomTopic}/presence`, { type: "room_rejected", playerId: action.playerId, reason: this.room.status === "PLAYING" ? "Sala já iniciada" : "Sala cheia" });
        return;
      }
      if (this.room.status !== "PLAYING" && this.room.players.length < MAX_PLAYERS) {
        this.room.players.push(this.normalizePlayer({ id: action.playerId }));
        this.publishState();
      }
      return;
    }
    if (action.type === "heartbeat") {
      const player = this.room?.players.find((item) => item.id === action.playerId);
      if (player) player.lastSeen = Date.now();
      if (this.room?.hostId === this.playerId) this.publishState();
      return;
    }
    if (this.room?.hostId !== this.playerId) return;
    const player = this.room.players.find((item) => item.id === action.playerId);
    if (action.type === "leave_room") this.removePlayer(action.playerId);
    else if (action.type === "select_character" && player && this.room.status !== "PLAYING") {
      if (!CHARACTER_IDS.includes(action.character) || this.room.players.some((item) => item.id !== player.id && item.character === action.character)) {
        this.publishAction({ type: "character_rejected", playerId: action.playerId });
        return;
      }
      player.character = action.character; player.ready = false; this.publishState();
    } else if (action.type === "player_ready" && player && this.room.status !== "PLAYING") {
      player.ready = Boolean(action.ready) && Boolean(player.character); this.publishState();
    } else if (action.type === "start_game" && this.canStart()) {
      this.room.status = "PLAYING"; this.publishState();
    } else if (action.type === "game_state" && player) {
      player.x = Number(action.x) || player.x; player.y = Number(action.y) || player.y; player.direction = action.direction || player.direction; this.publishState();
    }
  }

  receivePresence(data) {
    if (data.type === "leave_room") this.removePlayer(data.playerId);
    if (data.type === "room_rejected" && data.playerId === this.playerId) {
      this.emit("error", new Error(data.reason || "Não foi possível entrar na sala"));
      this.leaveRoom(false);
    }
    if (data.type === "heartbeat") {
      const player = this.room?.players.find((item) => item.id === data.playerId);
      if (player) player.lastSeen = Date.now();
    }
  }

  publishAction(action) { this.mqtt.publish(`${this.roomTopic}/action`, action); }

  publishState() {
    if (!this.room) return;
    this.room.revision = (this.room.revision || 0) + 1; this.room.updatedAt = Date.now();
    this.mqtt.publish(`${this.roomTopic}/state`, this.room, { retain: true });
    this.emit("roomUpdated", this.room);
  }

  selectCharacter(character) { if (CHARACTER_IDS.includes(character)) this.publishAction({ type: "select_character", playerId: this.playerId, character }); }
  setReady(ready) { this.publishAction({ type: "player_ready", playerId: this.playerId, ready }); }
  canStart() { return Boolean(this.room?.players.length) && this.room.players.every((player) => player.character && player.ready); }
  startGame() { if (this.room?.hostId === this.playerId && this.canStart()) this.publishAction({ type: "start_game", playerId: this.playerId }); }

  removePlayer(playerId) {
    if (!this.room) return;
    const wasHost = this.room.hostId === playerId;
    this.room.players = this.room.players.filter((player) => player.id !== playerId);
    if (!this.room.players.length) { this.room = null; return; }
    if (wasHost) {
      const nextHost = [...this.room.players].sort((left, right) => left.id.localeCompare(right.id))[0];
      this.room.hostId = nextHost.id; this.room.players.forEach((player) => { player.isHost = player.id === nextHost.id; });
    }
    if (this.room.hostId === this.playerId) this.publishState();
    this.emit("playerLeft", playerId);
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.roomTopic) return;
      this.publishAction({ type: "heartbeat", playerId: this.playerId });
      this.mqtt.publish(`${this.roomTopic}/presence`, { type: "heartbeat", playerId: this.playerId });
      if (this.room?.hostId === this.playerId) {
        const now = Date.now();
        this.room.players.filter((player) => player.id !== this.playerId && now - player.lastSeen > PLAYER_TIMEOUT_MS).forEach((player) => this.removePlayer(player.id));
      } else if (this.room) {
        const host = this.room.players.find((player) => player.id === this.room.hostId);
        if (host && Date.now() - host.lastSeen > PLAYER_TIMEOUT_MS) {
          const nextHost = [...this.room.players].sort((left, right) => left.id.localeCompare(right.id))[0];
          this.room.hostId = nextHost.id;
          this.room.players.forEach((player) => { player.isHost = player.id === nextHost.id; });
          if (nextHost.id === this.playerId) this.publishState();
          this.emit("roomUpdated", this.room);
        }
      }
    }, HEARTBEAT_MS);
  }

  stopHeartbeat() { if (this.heartbeatTimer) clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }

  leaveRoom(publish = true) {
    if (publish && this.roomTopic) {
      this.publishAction({ type: "leave_room", playerId: this.playerId });
      this.mqtt.publish(`${this.roomTopic}/presence`, { type: "leave_room", playerId: this.playerId });
    }
    this.stopHeartbeat();
    if (this.roomTopic) ["state", "action", "presence"].forEach((suffix) => this.mqtt.unsubscribe(`${this.roomTopic}/${suffix}`));
    this.roomTopic = null; this.room = null;
  }

  sendPlayerState(x, y, direction) { this.publishAction({ type: "game_state", playerId: this.playerId, x, y, direction }); }

  destroy() { this.leaveRoom(); this.mqtt.off("message", this.boundMessage); this.removeAllListeners(); }
}

export { CHARACTER_IDS };
export default MultiplayerManager;