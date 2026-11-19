import { createCoopLobby } from "../ui/CoopLobby.js";

class MultiplayerLobby extends Phaser.Scene {
  constructor() { super("MultiplayerLobby"); }

  create() {
    this.started = false;
    this.startRequested = false;
    this.feedback = "";
    this.manager = this.registry.get("multiplayer");
    this.cameras.main.setBackgroundColor("#020805");

    const view = this.view = createCoopLobby({
      onSelect: id => {
        if (this.started || !this.localPlayer()) return;
        this.feedback = "";
        this.manager.selectCharacter(id);
      },
      onReady: () => {
        const local = this.localPlayer();
        if (this.started || !local?.character) return;
        this.feedback = "";
        this.manager.setReady(!local.ready);
      },
      onStart: () => this.requestStart(),
      onLeave: () => {
        if (this.started) return;
        this.manager.leaveRoom();
        this.scene.start("Start", { abrirMenu: true });
      },
    });
    document.body.append(view.root);
    view.root.focus();

    this.manager.on("roomUpdated", this.renderRoom, this);
    this.manager.on("gameStarted", this.startGame, this);
    this.manager.on("connectionChanged", this.connectionChanged, this);
    this.manager.on("error", this.managerError, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    this.renderRoom(this.manager.room);
    if (this.manager.room?.status === "PLAYING") this.startGame(this.manager.room);
  }

  localPlayer(room = this.manager.room) {
    return room?.players.find(player => player.id === this.manager.playerId);
  }

  showFeedback(message) {
    this.feedback = message;
    this.view?.setStatus(message);
  }

  connectionChanged(connected) {
    this.feedback = connected ? "" : "RECONECTANDO...";
    this.view?.setStatus(connected ? "CONEXÃO RESTAURADA" : this.feedback);
  }

  managerError(error) {
    this.showFeedback(error.message || "ERRO");
  }

  renderRoom(room) {
    if (!room) return;
    this.view.renderRoom(room, {
      playerId: this.manager.playerId,
      canStart: !this.startRequested && this.manager.canStart(),
      feedback: this.feedback,
    });
  }

  requestStart() {
    if (this.started || this.startRequested) return;
    this.feedback = "";
    if (!this.manager.startGame()) return;
    this.startRequested = true;
    this.renderRoom(this.manager.room);
    // A sala continua validando o pedido. Se ele não for confirmado, o host pode tentar novamente.
    this.time.delayedCall(1000, () => {
      this.startRequested = false;
      this.renderRoom(this.manager.room);
    });
  }

  startGame(room) {
    const local = this.localPlayer(room);
    if (this.started || !local?.character) return;
    this.started = true;
    this.scene.start("BootPartida", { personagem: local.character, multiplayer: true });
  }

  shutdown() {
    this.manager.off("roomUpdated", this.renderRoom, this);
    this.manager.off("gameStarted", this.startGame, this);
    this.manager.off("connectionChanged", this.connectionChanged, this);
    this.manager.off("error", this.managerError, this);
    this.view.root.remove();
    this.view = null;
  }
}

export default MultiplayerLobby;
