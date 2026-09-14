class Start extends Phaser.Scene {
  constructor() {
    super("Start");

    this.characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%&*@?!<>[]{}";
    this.messages = [
      "INITIALIZING...",
      "MEMORY CHECK",
      "CONNECTION",
      "WARNING",
      "ERROR",
      "CORRUPTED",
    ];
    this.mode = "intro";
  }

  preload() {
    this.load.spritesheet(
      "start-character",
      "assets/personagem/standard/walk.png",
      {
        frameWidth: 64,
        frameHeight: 64,
      },
    );
    this.load.spritesheet(
      "start-character-2",
      "assets/personagem/personagem 2/Idle.png",
      {
        frameWidth: 48,
        frameHeight: 64,
      },
    );
  }

  create() {
    this.cameras.main.setBackgroundColor("#000000");
    this.width = this.scale.width;
    this.height = this.scale.height;
    this.columns = [];
    this.sequenceStarted = false;
    this.selectedCharacter = "standard";

    if (this.scene.settings.data?.abrirMenu) {
      this.mode = "menu";
      this.showMainMenu();
      return;
    }

    this.createStartButton();
  }

  createStartButton() {
    const button = this.createButton(this.width / 2, this.height / 2, "J0GAR");
    button.on("buttondown", () => {
      if (!this.sequenceStarted) {
        this.startSequence(button);
      }
    });
  }

  createButton(x, y, label, width = 180, height = 42) {
    const background = this.add
      .rectangle(0, 0, width, height, 0x062b16, 0.88)
      .setStrokeStyle(2, 0x42ff84, 0.95)
      .setInteractive({ useHandCursor: true });
    const text = this.add
      .text(0, 0, label, {
        color: "#9dffb9",
        fontFamily: "monospace",
        fontSize: "17px",
        fontStyle: "bold",
        shadow: { blur: 8, color: "#00ff66", fill: true },
      })
      .setOrigin(0.5);
    const button = this.add.container(x, y, [background, text]);
    button.background = background;
    button.label = text;
    button.setAngle(0);
    background.on("pointerover", () => {
      background.setFillStyle(0x0b5429, 0.95);
      text.setColor("#e4ffeb");
      button.emit("buttonover");
    });
    background.on("pointerout", () => {
      background.setFillStyle(0x062b16, 0.88);
      text.setColor("#9dffb9");
      button.emit("buttonout");
    });
    background.on("pointerdown", () => button.emit("buttondown"));
    return button;
  }

  startSequence(button) {
    this.sequenceStarted = true;
    this.tweens.add({
      targets: button,
      alpha: 0,
      duration: 180,
      ease: "Cubic.easeIn",
      onComplete: () => {
        button.destroy();
        this.time.delayedCall(320, () => this.beginRain());
      },
    });
  }

  beginRain() {
    this.rainStartedAt = this.time.now;
    this.nextMessageAt = 1200;
    this.nextMessageIndex = 0;
    this.glitchStarted = false;
    this.createScanlines();
    this.createColumns();
  }

  createColumns() {
    const columnCount = Math.ceil(this.width / 26);

    for (let index = 0; index < columnCount; index += 1) {
      const glyphs = [];
      const length = Phaser.Math.Between(5, 15);
      const column = {
        x: index * (this.width / columnCount) + Phaser.Math.Between(-5, 5),
        y: Phaser.Math.Between(-this.height, 0),
        speed: Phaser.Math.Between(32, 70),
        length,
        brightness: Phaser.Math.FloatBetween(0.35, 1),
        nextChange: 0,
        frozen: false,
        glyphs,
      };

      for (let glyphIndex = 0; glyphIndex < length; glyphIndex += 1) {
        glyphs.push(
          this.add
            .text(column.x, column.y - glyphIndex * 18, "0", {
              color: "#55ff88",
              fontFamily: "monospace",
              fontSize: "15px",
              shadow: { blur: 8, color: "#00ff55", fill: true },
            })
            .setOrigin(0.5),
        );
      }

      this.columns.push(column);
    }
  }

  createScanlines() {
    this.scanlines = this.add.graphics().setDepth(10);
    this.scanlines.lineStyle(1, 0x65ff9a, 0.035);
    for (let y = 0; y < this.height; y += 4) {
      this.scanlines.lineBetween(0, y, this.width, y);
    }
  }

  showSystemMessage(message) {
    const text = this.add
      .text(
        Phaser.Math.Between(this.width * 0.15, this.width * 0.7),
        Phaser.Math.Between(this.height * 0.2, this.height * 0.8),
        message,
        {
          color: "#75ff9a",
          fontFamily: "monospace",
          fontSize: Phaser.Math.Between(11, 17) + "px",
          shadow: { blur: 12, color: "#00ff55", fill: true },
        },
      )
      .setAlpha(0);

    this.tweens.add({
      targets: text,
      alpha: { from: 0, to: 0.9 },
      duration: 100,
      hold: 260,
      yoyo: true,
      repeat: 1,
      onComplete: () => text.destroy(),
    });
  }

  showFailure() {
    const error = this.add
      .text(this.width / 2, this.height * 0.43, "ERROR", {
        color: "#c7ffd4",
        fontFamily: "monospace",
        fontSize: "34px",
        fontStyle: "bold",
        shadow: { blur: 18, color: "#00ff55", fill: true },
      })
      .setOrigin(0.5)
      .setAlpha(0);
    const failure = this.add
      .text(this.width / 2, this.height * 0.56, "SYSTEM FAILURE", {
        color: "#57ff85",
        fontFamily: "monospace",
        fontSize: "20px",
        shadow: { blur: 14, color: "#00ff55", fill: true },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: error,
      alpha: 1,
      duration: 60,
      yoyo: true,
      repeat: 3,
    });
    this.tweens.add({
      targets: failure,
      alpha: 1,
      delay: 180,
      duration: 70,
      yoyo: true,
      repeat: 2,
    });
  }

  finishSequence() {
    this.mode = "menu";
    this.rainStartedAt = this.time.now;
    this.columns.forEach((column, index) => {
      column.frozen = false;
      column.speed = Phaser.Math.Between(18, 36);
      column.brightness = Phaser.Math.FloatBetween(0.18, 0.42);
      column.y = Phaser.Math.Between(-this.height, this.height);
      column.glyphs.forEach((glyph, glyphIndex) => {
        glyph.setDepth(4);
        glyph.setAlpha(
          Math.max(0.04, column.brightness * (1 - glyphIndex / column.length)),
        );
      });
      if (index % 2 === 0) {
        column.nextChange = this.time.now;
      }
    });
    this.showMainMenu();
  }

  showMainMenu() {
    this.menuLayer = this.add.container(0, 0).setDepth(20).setAlpha(0);
    const shade = this.add.rectangle(
      this.width / 2,
      this.height / 2,
      this.width,
      this.height,
      0x000000,
      0.52,
    );
    const title = this.add
      .text(this.width / 2, 64, "N E X U S", {
        color: "#c9ffda",
        fontFamily: "monospace",
        fontSize: "30px",
        fontStyle: "bold",
        shadow: { blur: 16, color: "#00ff66", fill: true },
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(this.width / 2, 96, "SYSTEM INTERFACE", {
        color: "#54d879",
        fontFamily: "monospace",
        fontSize: "11px",
      })
      .setOrigin(0.5);
    this.menuLayer.add([shade, title, subtitle]);

    const menuItems = ["SOLO", "MULTIJOGADOR", "OPÇÕES", "SAIR"];
    menuItems.forEach((label, index) => {
      const button = this.createButton(
        this.width / 2,
        165 + index * 54,
        label,
        240,
        38,
      );
      this.menuLayer.add(button);
      button.on("buttondown", () => this.selectMenuOption(label));
    });

    this.menuStatus = this.add
      .text(this.width / 2, 392, "AGUARDANDO COMANDO...", {
        color: "#5be884",
        fontFamily: "monospace",
        fontSize: "11px",
      })
      .setOrigin(0.5);
    this.menuLayer.add(this.menuStatus);
    this.tweens.add({
      targets: this.menuLayer,
      alpha: 1,
      duration: 420,
      ease: "Cubic.easeOut",
    });
  }

  selectMenuOption(option) {
    if (option === "SOLO") {
      this.showSoloSelection();
      return;
    }

    if (option === "SAIR") {
      this.menuStatus.setText("ENCERRANDO SESSÃO...");
      window.close();
      this.time.delayedCall(250, () =>
        this.menuStatus.setText("O NAVEGADOR BLOQUEOU O FECHAMENTO"),
      );
      return;
    }

    this.menuStatus.setText(`${option} // DISPONÍVEL EM BREVE`);
    this.tweens.add({
      targets: this.menuStatus,
      alpha: 0.35,
      duration: 120,
      yoyo: true,
      repeat: 2,
    });
  }

  showSoloSelection() {
    this.menuLayer.setVisible(false);
    this.soloLayer = this.add.container(0, 0).setDepth(21).setAlpha(0);
    const shade = this.add.rectangle(
      this.width / 2,
      this.height / 2,
      this.width,
      this.height,
      0x000000,
      0.72,
    );
    const title = this.add
      .text(this.width / 2, 62, "SELECIONE SEU OPERADOR", {
        color: "#c9ffda",
        fontFamily: "monospace",
        fontSize: "20px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    const characters = [
      {
        id: "standard",
        x: this.width / 2 - 92,
        texture: "start-character",
        frame: 26,
        scale: 1.45,
        name: "OPERADOR // 01",
      },
      {
        id: "personagem2",
        x: this.width / 2 + 92,
        texture: "start-character-2",
        frame: 0,
        scale: 1.9,
        name: "OPERADORA // 02",
      },
    ];
    const characterViews = characters.map((character) => {
      const frame = this.add
        .rectangle(character.x, 205, 112, 112, 0x062b16, 0.95)
        .setStrokeStyle(2, 0x1b6b3b, 1)
        .setInteractive({ useHandCursor: true });
      const portrait = this.add
        .image(character.x, 205, character.texture, character.frame)
        .setScale(character.scale)
        .setInteractive({ useHandCursor: true });
      const name = this.add
        .text(character.x, 285, character.name, {
          color: "#9dffb9",
          fontFamily: "monospace",
          fontSize: "11px",
        })
        .setOrigin(0.5);
      return { ...character, frame, portrait, name };
    });
    const choose = this.createButton(
      this.width / 2,
      350,
      "INICIAR SOLO",
      210,
      40,
    );
    const back = this.createButton(this.width / 2, 405, "VOLTAR", 130, 30);
    back.label.setFontSize("12px");
    this.soloLayer.add([
      shade,
      title,
      ...characterViews.flatMap(({ frame, portrait, name }) => [
        frame,
        portrait,
        name,
      ]),
      choose,
      back,
    ]);
    const selectCharacter = (character) => {
      this.selectedCharacter = character.id;
      characterViews.forEach((view) =>
        view.frame.setStrokeStyle(
          2,
          view.id === this.selectedCharacter ? 0x42ff84 : 0x1b6b3b,
          1,
        ),
      );
      this.menuStatus.setText(`${character.name} // SELECIONADA`);
    };
    characterViews.forEach((character) => {
      character.frame.on("pointerdown", () => selectCharacter(character));
      character.portrait.on("pointerdown", () => selectCharacter(character));
    });
    selectCharacter(characterViews[0]);
    choose.on("buttondown", () => this.startSoloGame());
    back.on("buttondown", () => {
      this.soloLayer.destroy();
      this.menuLayer.setVisible(true);
    });
    this.tweens.add({ targets: this.soloLayer, alpha: 1, duration: 260 });
  }

  startSoloGame() {
    this.scene.start("preloader", {
      personagem: this.selectedCharacter,
    });
  }

  update(time, delta) {
    if (
      !this.rainStartedAt ||
      (this.mode === "intro" && !this.sequenceStarted)
    ) {
      return;
    }

    const elapsed = time - this.rainStartedAt;
    const intensity = Phaser.Math.Clamp((elapsed - 800) / 2200, 0, 1);
    const speedMultiplier = 0.75 + intensity * 1.7;

    this.columns.forEach((column) => {
      if (!column.frozen) {
        column.y += column.speed * speedMultiplier * (delta / 1000);
      }

      if (time > column.nextChange) {
        column.nextChange = time + Phaser.Math.Between(80, 260);
        column.glyphs.forEach((glyph, glyphIndex) => {
          glyph.setText(
            this.characters[Phaser.Math.Between(0, this.characters.length - 1)],
          );
          glyph.setAlpha(
            Math.max(
              0.08,
              column.brightness * (1 - glyphIndex / column.length),
            ),
          );
          glyph.setPosition(column.x, column.y - glyphIndex * 18);
        });
      } else {
        column.glyphs.forEach((glyph, glyphIndex) => {
          glyph.y = column.y - glyphIndex * 18;
        });
      }

      if (column.y - column.length * 18 > this.height) {
        column.y = Phaser.Math.Between(-180, -20);
      }
    });

    if (this.mode === "intro" && elapsed > 1200 && time > this.nextMessageAt) {
      this.showSystemMessage(
        this.messages[this.nextMessageIndex % this.messages.length],
      );
      this.nextMessageIndex += 1;
      this.nextMessageAt = time + Phaser.Math.Between(180, 450);
    }

    if (this.mode === "intro" && elapsed > 3700 && !this.glitchStarted) {
      this.glitchStarted = true;
      this.showFailure();
      this.columns.forEach((column, index) => {
        column.frozen = index % 3 === 0;
        column.speed *= index % 2 === 0 ? 3.5 : 0.4;
      });
    }

    if (this.mode === "intro" && elapsed > 4450) {
      this.finishSequence();
    }
  }
}

export default Start;
