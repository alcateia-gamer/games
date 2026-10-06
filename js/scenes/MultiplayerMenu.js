class MultiplayerMenu extends Phaser.Scene {
  constructor() {
    super("MultiplayerMenu");
    this.code = "";
  }

  create() {
    this.manager = this.registry.get("multiplayer");
    this.cameras.main.setBackgroundColor("#020805");
    this.add
      .text(400, 62, "MULTIJOGADOR", {
        color: "#c9ffda",
        fontFamily: "monospace",
        fontSize: "25px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(400, 96, "SALA DE INCURSÃO // ATÉ 4 OPERADORES", {
        color: "#54d879",
        fontFamily: "monospace",
        fontSize: "11px",
      })
      .setOrigin(0.5);
    this.codeText = this.add
      .text(400, 170, "----", {
        color: "#e4ffeb",
        fontFamily: "monospace",
        fontSize: "30px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.status = this.add
      .text(400, 220, "DIGITE O CÓDIGO PARA ENTRAR", {
        color: "#75ff9a",
        fontFamily: "monospace",
        fontSize: "12px",
      })
      .setOrigin(0.5);
    this.criarCampoCodigoMobile();
    this.createButton(310, 300, "CRIAR SALA", 190).on("buttondown", () =>
      this.manager.createRoom(),
    );
    this.createButton(490, 300, "ENTRAR", 150).on("buttondown", () =>
      this.manager.joinRoom(this.code),
    );
    this.createButton(400, 375, "VOLTAR", 130).on("buttondown", () =>
      this.scene.start("Start", { abrirMenu: true }),
    );
    this.onRoomSearching = () => this.setStatus("PROCURANDO SALA...");
    this.onRoomUpdated = (room) => {
      if (
        room.roomCode === this.code &&
        !this.scene.isActive("MultiplayerLobby")
      )
        this.openLobby(room);
    };
    this.onManagerError = (error) =>
      this.setStatus(error.message || "ERRO DE CONEXÃO");
    this.manager.on("roomCreated", this.openLobby, this);
    this.manager.on("roomSearching", this.onRoomSearching, this);
    this.manager.on("roomUpdated", this.onRoomUpdated, this);
    this.manager.on("error", this.onManagerError, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  handleKey(event) {
    if (event.key === "Backspace") this.code = this.code.slice(0, -1);
    else if (/^[a-z0-9]$/i.test(event.key) && this.code.length < 6)
      this.code += event.key.toUpperCase();
    this.codeText.setText(this.code.padEnd(4, "-"));
  }

  criarCampoCodigoMobile() {
    const touchDevice =
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0);

    if (!touchDevice || !this.add.dom) {
      this.input.keyboard.on("keydown", this.handleKey, this);
      return;
    }

    this.codeText.setVisible(false);
    this.codeInput = this.add
      .dom(400, 170)
      .createFromHTML(
        '<input class="multiplayer-code-input" type="text" maxlength="6" inputmode="text" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label="Código da sala">',
      )
      .setOrigin(0.5);
    this.codeInputNode = this.codeInput.node;
    this.codeInputNode.value = this.code;
    this.handleCodeInput = (event) => {
      this.code = event.target.value
        .replace(/[^a-z0-9]/gi, "")
        .slice(0, 6)
        .toUpperCase();
      this.codeInputNode.value = this.code;
    };
    this.codeInputNode.addEventListener("input", this.handleCodeInput);
  }

  setStatus(message) {
    this.status.setText(message);
  }

  openLobby(roomCode) {
    const code = typeof roomCode === "string" ? roomCode : roomCode?.roomCode;
    if (code) this.code = code;
    this.scene.start("MultiplayerLobby");
  }

  createButton(x, y, label, width) {
    const background = this.add
      .rectangle(0, 0, width, 42, 0x062b16, 0.95)
      .setStrokeStyle(2, 0x42ff84)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(0, 0, label, {
        color: "#9dffb9",
        fontFamily: "monospace",
        fontSize: "14px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const button = this.add.container(x, y, [background, text]);
    background.on("pointerover", () => background.setFillStyle(0x0b5429));
    background.on("pointerout", () => background.setFillStyle(0x062b16));
    background.on("pointerdown", () => button.emit("buttondown"));
    return button;
  }

  shutdown() {
    this.input.keyboard.off("keydown", this.handleKey, this);
    this.codeInputNode?.removeEventListener("input", this.handleCodeInput);
    this.codeInput?.destroy();
    this.manager?.off("roomCreated", this.openLobby, this);
    this.manager?.off("roomSearching", this.onRoomSearching, this);
    this.manager?.off("roomUpdated", this.onRoomUpdated, this);
    this.manager?.off("error", this.onManagerError, this);
  }
}

export default MultiplayerMenu;
