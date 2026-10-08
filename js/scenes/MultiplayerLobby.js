const CHARACTER_NAMES = {
  "kai-mercer": "KAI MERCER",
  "magnus-force": "MAGNUS FORCE",
  "aria-kade": "ARIA KADE",
  "nyx": "NYX",
};

class MultiplayerLobby extends Phaser.Scene {
  constructor() { super("MultiplayerLobby"); }

  create() {
    this.manager = this.registry.get("multiplayer");
    this.cameras.main.setBackgroundColor("#020805");
    this.add.text(400, 38, "LOBBY // SALA", { color: "#c9ffda", fontFamily: "monospace", fontSize: "22px", fontStyle: "bold" }).setOrigin(0.5);
    this.roomText = this.add.text(400, 70, "SALA: ----", { color: "#54d879", fontFamily: "monospace", fontSize: "13px" }).setOrigin(0.5);
    this.rows = [];
    for (let index = 0; index < 4; index += 1) {
      const row = this.add.text(110, 125 + index * 46, "", { color: "#9dffb9", fontFamily: "monospace", fontSize: "14px" });
      this.rows.push(row);
    }
    this.characterButtons = ["kai-mercer", "magnus-force", "aria-kade", "nyx"].map((id, index) => {
      const button = this.createButton(180 + index * 145, 340, CHARACTER_NAMES[id], 132, 34);
      button.on("buttondown", () => this.manager.selectCharacter(id));
      return button;
    });
    this.readyButton = this.createButton(400, 400, "PRONTO", 150, 34);
    this.readyButton.on("buttondown", () => {
      const local = this.manager.room?.players.find((player) => player.id === this.manager.playerId);
      this.manager.setReady(!local?.ready);
    });
    this.startButton = this.createButton(635, 400, "INICIAR PARTIDA", 190, 34);
    this.startButton.on("buttondown", () => this.manager.startGame());
    this.leaveButton = this.createButton(80, 400, "SAIR", 90, 34);
    this.leaveButton.on("buttondown", () => {
      this.manager.leaveRoom();
      this.scene.start("Start", { abrirMenu: true });
    });
    this.status = this.add.text(400, 440, "AGUARDANDO OPERADORES...", { color: "#75ff9a", fontFamily: "monospace", fontSize: "11px" }).setOrigin(0.5);
    this.manager.on("roomUpdated", this.renderRoom, this);
    this.manager.on("gameStarted", this.startGame, this);
    this.onConnectionChanged = (connected) => this.status.setText(connected ? "CONEXÃO RESTAURADA" : "RECONECTANDO...");
    this.onManagerError = (error) => this.status.setText(error.message || "ERRO");
    this.manager.on("connectionChanged", this.onConnectionChanged, this);
    this.manager.on("error", this.onManagerError, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.renderRoom(this.manager.room);
  }

  renderRoom(room) {
    if (!room) return;
    this.roomText.setText(`SALA: ${room.roomCode}`);
    const players = room.players || [];
    this.rows.forEach((row, index) => {
      const player = players[index];
      row.setText(player ? `JOGADOR ${index + 1}  ${player.isHost ? "[HOST]" : "      "}  ${CHARACTER_NAMES[player.character] || "-"}  ${player.ready ? "[PRONTO]" : ""}` : `JOGADOR ${index + 1}  -- VAGO --`);
    });
    const local = players.find((player) => player.id === this.manager.playerId);
    this.readyButton.list[1].setText(local?.ready ? "CANCELAR PRONTO" : "PRONTO");
    this.startButton.setVisible(room.hostId === this.manager.playerId);
    this.status.setText(room.players.every((player) => player.character && player.ready) ? "TODOS PRONTOS" : "ESCOLHA UM OPERADOR E FIQUE PRONTO");
  }

  startGame(room) {
    if (this.started) return;
    this.started = true;
    const local = room.players.find((player) => player.id === this.manager.playerId);
    this.scene.start("preloader", { personagem: local?.character || "kai-mercer", multiplayer: true });
  }

  createButton(x, y, label, width, height) {
    const background = this.add.rectangle(0, 0, width, height, 0x062b16, 0.95).setStrokeStyle(2, 0x42ff84).setInteractive({ useHandCursor: true });
    const text = this.add.text(0, 0, label, { color: "#9dffb9", fontFamily: "monospace", fontSize: "11px", fontStyle: "bold" }).setOrigin(0.5);
    const button = this.add.container(x, y, [background, text]);
    background.on("pointerover", () => background.setFillStyle(0x0b5429));
    background.on("pointerout", () => background.setFillStyle(0x062b16));
    background.on("pointerdown", () => button.emit("buttondown"));
    return button;
  }

  shutdown() {
    this.manager?.off("roomUpdated", this.renderRoom, this);
    this.manager?.off("gameStarted", this.startGame, this);
    this.manager?.off("connectionChanged", this.onConnectionChanged, this);
    this.manager?.off("error", this.onManagerError, this);
  }
}

export default MultiplayerLobby;