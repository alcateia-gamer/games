class Level1 extends Phaser.Scene {
  constructor() {
    super("Level1");

    this.threshold = 0.1;
    this.speed = 400;
    this.direction = undefined;

    // Direção inicial
    this.direcaoAtual = "down";

    // Controle do ataque
    this.atacando = false;

    // Respawn
    this.respawnX = -1440;
    this.respawnY = 454;
  }

  create() {
    // =====================================================
    // MAPA
    // =====================================================

    this.map = this.make.tilemap({
      key: "mapa",
    });

    // =====================================================
    // TILESETS
    // =====================================================

    const cityShopping = this.map.addTilesetImage(
      "Tileset_SciFi_CityShopping_Rasak",
      "cityShopping",
    );

    const street = this.map.addTilesetImage(
      "Tileset_SciFi_Street_Rasak",
      "street",
    );

    const garbage = this.map.addTilesetImage(
      "Tileset_SciFi_Garbage_Rasak",
      "garbage",
    );

    const a5Street = this.map.addTilesetImage("A5_Street_Rasak", "a5Street");

    const slums = this.map.addTilesetImage(
      "Tileset_SciFi_Slums_Rasak",
      "slums",
    );

    const a4Outside = this.map.addTilesetImage(
      "A4_SciFi_Outside_Rasak",
      "a4Outside",
    );

    const a3Outside = this.map.addTilesetImage(
      "A3_SciFi_Outside_Rasak",
      "a3Outside",
    );

    const buildingExtras = this.map.addTilesetImage(
      "Tileset_SciFi_BuildingExtras",
      "buildingExtras",
    );

    const torre = this.map.addTilesetImage("TorreTileset", "torre");

    const tilesets = [
      cityShopping,
      street,
      garbage,
      a5Street,
      slums,
      a4Outside,
      a3Outside,
      buildingExtras,
      torre,
    ].filter(Boolean);

    // =====================================================
    // CAMADAS
    // =====================================================

    const TILE = 48;

    const camadaChao = this.map.createLayer(
      "Chão",
      tilesets,
      -48 * TILE,
      -48 * TILE,
    );

    const camadaPredios = this.map.createLayer(
      "Prédios",
      tilesets,
      -16 * TILE,
      -32 * TILE,
    );

    const camadaJanelas = this.map.createLayer(
      "Janela dos Prédios",
      tilesets,
      -16 * TILE,
      -32 * TILE,
    );

    const camadaParedes = this.map.createLayer(
      "Paredes",
      tilesets,
      -48 * TILE,
      -16 * TILE,
    );

    const camadaObjetos2 = this.map.createLayer(
      "Objetos 2",
      tilesets,
      -48 * TILE,
      -32 * TILE,
    );

    const camadaObjetos = this.map.createLayer(
      "Objetos",
      tilesets,
      -48 * TILE,
      -32 * TILE,
    );

    const camadaCerca = this.map.createLayer(
      "Cercas",
      tilesets,
      -48 * TILE,
      -16 * TILE,
    );

    const camadaCercaTorre = this.map.createLayer("CercaTorre", tilesets, 0, 0);

    const camadaMuroDelegacia = this.map.createLayer(
      "Muro delegacia",
      tilesets,
      -16 * TILE,
      0,
    );

    const camadaPostes = this.map.createLayer(
      "Postes",
      tilesets,
      -32 * TILE,
      -48 * TILE,
    );

    // =====================================================
    // PROFUNDIDADE
    // =====================================================

    camadaChao.setDepth(0);
    camadaCercaTorre.setDepth(2);
    camadaPredios.setDepth(3);
    camadaMuroDelegacia.setDepth(4);
    camadaJanelas.setDepth(5);
    camadaParedes.setDepth(6);
    camadaObjetos2.setDepth(7);
    camadaObjetos.setDepth(8);
    camadaCerca.setDepth(9);
    camadaPostes.setDepth(10);

    // =====================================================
    // ANIMAÇÕES DE CAMINHADA
    // =====================================================

    // CIMA
    this.anims.create({
      key: "walk-up",

      frames: this.anims.generateFrameNumbers("walk", {
        start: 0,
        end: 8,
      }),

      frameRate: 12,
      repeat: -1,
    });

    // ESQUERDA
    this.anims.create({
      key: "walk-left",

      frames: this.anims.generateFrameNumbers("walk", {
        start: 13,
        end: 21,
      }),

      frameRate: 12,
      repeat: -1,
    });

    // BAIXO
    this.anims.create({
      key: "walk-down",

      frames: this.anims.generateFrameNumbers("walk", {
        start: 26,
        end: 34,
      }),

      frameRate: 12,
      repeat: -1,
    });

    // DIREITA
    this.anims.create({
      key: "walk-right",

      frames: this.anims.generateFrameNumbers("walk", {
        start: 39,
        end: 47,
      }),

      frameRate: 12,
      repeat: -1,
    });

    // =====================================================
    // ANIMAÇÕES DE ATAQUE COM KATANA
    // 128x128
    // 6 frames por direção
    // =====================================================

    // CIMA
    this.anims.create({
      key: "attack-up",

      frames: this.anims.generateFrameNumbers("attack", {
        start: 0,
        end: 5,
      }),

      frameRate: 12,
      repeat: 0,
    });

    // ESQUERDA
    this.anims.create({
      key: "attack-left",

      frames: this.anims.generateFrameNumbers("attack", {
        start: 6,
        end: 11,
      }),

      frameRate: 12,
      repeat: 0,
    });

    // BAIXO
    this.anims.create({
      key: "attack-down",

      frames: this.anims.generateFrameNumbers("attack", {
        start: 12,
        end: 17,
      }),

      frameRate: 12,
      repeat: 0,
    });

    // DIREITA
    this.anims.create({
      key: "attack-right",

      frames: this.anims.generateFrameNumbers("attack", {
        start: 18,
        end: 23,
      }),

      frameRate: 12,
      repeat: 0,
    });

    // =====================================================
    // PERSONAGEM
    // =====================================================

    this.player = this.physics.add.sprite(
      this.respawnX,
      this.respawnY,
      "walk",
      26,
    );

    this.player.body.setAllowGravity(false);
    this.player.setDepth(50);

    // =====================================================
    // JOYSTICK
    // =====================================================

    this.joystick = this.plugins.get("rexvirtualjoystickplugin").add(this, {
      x: 100,
      y: 350,

      radius: 50,

      base: this.add.circle(0, 0, 50, 0xcccccc, 0.7),

      thumb: this.add.circle(0, 0, 25, 0x666666, 0.9),
    });

    this.joystick.base.setScrollFactor(0);
    this.joystick.thumb.setScrollFactor(0);

    this.joystick.base.setDepth(100);
    this.joystick.thumb.setDepth(101);

    // =====================================================
    // MOVIMENTO
    // =====================================================

    this.joystick.on("update", () => {
      // Não anda enquanto ataca
      if (this.atacando) {
        this.player.setVelocity(0, 0);
        return;
      }

      const angle = Phaser.Math.DegToRad(this.joystick.angle);

      const force = this.joystick.force;

      if (force > this.threshold) {
        this.direction = new Phaser.Math.Vector2(
          Math.cos(angle),
          Math.sin(angle),
        ).normalize();

        const velocidadeX = this.direction.x * this.speed;

        const velocidadeY = this.direction.y * this.speed;

        this.player.setVelocity(velocidadeX, velocidadeY);

        // =================================================
        // HORIZONTAL
        // =================================================

        if (Math.abs(this.direction.x) > Math.abs(this.direction.y)) {
          // DIREITA
          if (this.direction.x > 0) {
            this.direcaoAtual = "right";

            this.player.anims.play("walk-right", true);
          }

          // ESQUERDA
          else {
            this.direcaoAtual = "left";

            this.player.anims.play("walk-left", true);
          }
        }

        // =================================================
        // VERTICAL
        // =================================================
        else {
          // BAIXO
          if (this.direction.y > 0) {
            this.direcaoAtual = "down";

            this.player.anims.play("walk-down", true);
          }

          // CIMA
          else {
            this.direcaoAtual = "up";

            this.player.anims.play("walk-up", true);
          }
        }
      }

      // ===================================================
      // PARADO
      // ===================================================
      else {
        this.player.setVelocity(0, 0);
        this.player.anims.stop();
      }
    });

    // =====================================================
    // BOTÃO DE ATAQUE
    // CÍRCULO COM FUNDO BRANCO
    // =====================================================

    this.botaoAtaque = this.add.circle(720, 350, 46, 0xffffff, 0.9);

    // Borda escura
    this.botaoAtaque.setStrokeStyle(4, 0x333333, 1);

    this.botaoAtaque.setScrollFactor(0).setDepth(100).setInteractive();

    // =====================================================
    // ESPADINHA DO BOTÃO
    // =====================================================

    this.iconeAtaque = this.add.graphics();

    this.iconeAtaque.setPosition(720, 350).setScrollFactor(0).setDepth(101);

    // =====================================================
    // LÂMINA
    // =====================================================

    this.iconeAtaque.fillStyle(0xdddddd, 1);

    this.iconeAtaque.lineStyle(2, 0x333333, 1);

    this.iconeAtaque.beginPath();

    // Ponta
    this.iconeAtaque.moveTo(0, -31);

    // Lado direito
    this.iconeAtaque.lineTo(5, -21);

    this.iconeAtaque.lineTo(5, 9);

    // Base
    this.iconeAtaque.lineTo(-5, 9);

    // Lado esquerdo
    this.iconeAtaque.lineTo(-5, -21);

    this.iconeAtaque.closePath();

    this.iconeAtaque.fillPath();
    this.iconeAtaque.strokePath();

    // =====================================================
    // DETALHE CENTRAL DA LÂMINA
    // =====================================================

    this.iconeAtaque.lineStyle(1, 0xffffff, 0.8);

    this.iconeAtaque.beginPath();

    this.iconeAtaque.moveTo(0, -26);

    this.iconeAtaque.lineTo(0, 5);

    this.iconeAtaque.strokePath();

    // =====================================================
    // GUARDA
    // =====================================================

    this.iconeAtaque.fillStyle(0x555555, 1);

    this.iconeAtaque.fillRoundedRect(-13, 8, 26, 5, 2);

    // =====================================================
    // CABO
    // =====================================================

    this.iconeAtaque.fillStyle(0x333333, 1);

    this.iconeAtaque.fillRoundedRect(-4, 12, 8, 18, 2);

    // =====================================================
    // FINAL DO CABO
    // =====================================================

    this.iconeAtaque.fillStyle(0x555555, 1);

    this.iconeAtaque.fillCircle(0, 31, 5);

    // =====================================================
    // INCLINA A ESPADA INTEIRA
    // =====================================================

    this.iconeAtaque.setAngle(18);

    // =====================================================
    // ÁREA CLICÁVEL DA ESPADA
    // =====================================================

    // A espada também pode ser apertada diretamente
    this.iconeAtaque.setInteractive(
      new Phaser.Geom.Rectangle(-25, -40, 50, 80),
      Phaser.Geom.Rectangle.Contains,
    );

    // =====================================================
    // FUNÇÃO VISUAL DO BOTÃO
    // =====================================================

    const apertarBotao = () => {
      this.botaoAtaque.setScale(0.92);
      this.iconeAtaque.setScale(0.92);

      this.atacar();
    };

    const soltarBotao = () => {
      this.botaoAtaque.setScale(1);
      this.iconeAtaque.setScale(1);
    };

    // =====================================================
    // CLICAR NO CÍRCULO
    // =====================================================

    this.botaoAtaque.on("pointerdown", apertarBotao);

    this.botaoAtaque.on("pointerup", soltarBotao);

    this.botaoAtaque.on("pointerout", soltarBotao);

    // =====================================================
    // CLICAR DIRETAMENTE NA ESPADA
    // =====================================================

    this.iconeAtaque.on("pointerdown", apertarBotao);

    this.iconeAtaque.on("pointerup", soltarBotao);

    this.iconeAtaque.on("pointerout", soltarBotao);

    // =====================================================
    // QUANDO O ATAQUE TERMINAR
    // =====================================================

    this.player.on("animationcomplete", (animation) => {
      if (animation.key.startsWith("attack-")) {
        this.atacando = false;

        this.player.setVelocity(0, 0);

        // =================================================
        // VOLTA PARA A SPRITESHEET DE CAMINHADA
        // =================================================

        if (this.direcaoAtual === "up") {
          this.player.setTexture("walk", 0);
        } else if (this.direcaoAtual === "left") {
          this.player.setTexture("walk", 13);
        } else if (this.direcaoAtual === "down") {
          this.player.setTexture("walk", 26);
        } else if (this.direcaoAtual === "right") {
          this.player.setTexture("walk", 39);
        }
      }
    });

    // =====================================================
    // CÂMERA
    // =====================================================

    this.cameras.main.startFollow(this.player, true);

    this.cameras.main.setZoom(1);

    // =====================================================
    // COORDENADAS
    // =====================================================

    this.textoCoordenadas = this.add.text(10, 10, "", {
      fontSize: "18px",

      backgroundColor: "#000000",

      padding: {
        x: 8,
        y: 5,
      },
    });

    this.textoCoordenadas.setScrollFactor(0).setDepth(200);

    // =====================================================
    // TECLA R
    // =====================================================

    this.teclaR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    console.log("Respawn atual:", this.respawnX, this.respawnY);
  }

  // =====================================================
  // ATAQUE
  // =====================================================

  atacar() {
    if (this.atacando) {
      return;
    }

    this.atacando = true;

    this.player.setVelocity(0, 0);

    // =====================================================
    // ATAQUE NA DIREÇÃO ATUAL
    // =====================================================

    if (this.direcaoAtual === "up") {
      this.player.anims.play("attack-up", true);
    } else if (this.direcaoAtual === "left") {
      this.player.anims.play("attack-left", true);
    } else if (this.direcaoAtual === "down") {
      this.player.anims.play("attack-down", true);
    } else if (this.direcaoAtual === "right") {
      this.player.anims.play("attack-right", true);
    }
  }

  // =====================================================
  // RESPAWN
  // =====================================================

  respawnPlayer() {
    this.player.setVelocity(0, 0);

    this.atacando = false;
    this.direcaoAtual = "down";

    this.player.anims.stop();

    this.player.setTexture("walk", 26);

    this.player.setPosition(this.respawnX, this.respawnY);
  }

  // =====================================================
  // UPDATE
  // =====================================================

  update() {
    const x = Math.round(this.player.x);

    const y = Math.round(this.player.y);

    this.textoCoordenadas.setText("X: " + x + "  Y: " + y);

    // =====================================================
    // R = RESPAWN
    // =====================================================

    if (Phaser.Input.Keyboard.JustDown(this.teclaR)) {
      this.respawnPlayer();
    }
  }
}

export default Level1;
