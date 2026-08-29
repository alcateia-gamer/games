class Level1 extends Phaser.Scene {
  constructor() {
    super("Level1");

    this.threshold = 0.1;
    this.speed = 400;
    this.direction = undefined;

    // Respawn inicial temporário
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

    // =====================================================
    // LISTA DOS TILESETS
    // =====================================================

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
// CORREÇÃO PARA MAPA INFINITO DO TILED
// =====================================================

const TILE = 48;

const camadaChao = this.map.createLayer(
  "Chão",
  tilesets,
  -48 * TILE,
  -48 * TILE
);

const camadaPredios = this.map.createLayer(
  "Prédios",
  tilesets,
  -16 * TILE,
  -32 * TILE
);

const camadaJanelas = this.map.createLayer(
  "Janela dos Prédios",
  tilesets,
  -16 * TILE,
  -32 * TILE
);

const camadaParedes = this.map.createLayer(
  "Paredes",
  tilesets,
  -48 * TILE,
  -16 * TILE
);

const camadaObjetos2 = this.map.createLayer(
  "Objetos 2",
  tilesets,
  -48 * TILE,
  -32 * TILE
);

const camadaObjetos = this.map.createLayer(
  "Objetos",
  tilesets,
  -48 * TILE,
  -32 * TILE
);

const camadaCerca = this.map.createLayer(
  "Cercas",
  tilesets,
  -48 * TILE,
  -16 * TILE
);

const camadaCercaTorre = this.map.createLayer(
  "CercaTorre",
  tilesets,
  0,
  0,
);

const camadaMuroDelegacia = this.map.createLayer(
  "Muro delegacia",
  tilesets,
  -16 * TILE,
  0
);

const camadaPostes = this.map.createLayer(
  "Postes",
  tilesets,
  -32 * TILE,
  -48 * TILE
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
// ANIMAÇÃO DIREITA
// =====================================================

this.anims.create({
  key: "walk-right",

  frames: this.anims.generateFrameNumbers("personagem1", {
    start: 87,
    end: 95,
  }),

  frameRate: 12,
  repeat: -1,
});

// =====================================================
// ANIMAÇÃO ESQUERDA
// =====================================================

this.anims.create({
  key: "walk-left",

  frames: this.anims.generateFrameNumbers("personagem1", {
    start: 69,
    end: 77,
  }),

  frameRate: 12,
  repeat: -1,
});

// =====================================================
// ANIMAÇÃO CIMA
// =====================================================

this.anims.create({
  key: "walk-up",

  frames: this.anims.generateFrameNumbers("personagem1", {
    start: 60,
    end: 68,
  }),

  frameRate: 12,
  repeat: -1,
});

// =====================================================
// ANIMAÇÃO BAIXO
// =====================================================

this.anims.create({
  key: "walk-down",

  frames: this.anims.generateFrameNumbers("personagem1", {
    start: 78,
    end: 86,
  }),

  frameRate: 12,
  repeat: -1,
});

// =====================================================
// PERSONAGEM
// =====================================================

this.player = this.physics.add.sprite(
  this.respawnX,
  this.respawnY,
  "personagem1",
  218,
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

      base: this.add.circle(0, 0, 50, 0xcccccc),

      thumb: this.add.circle(0, 0, 25, 0x666666),
    });

    // =====================================================
    // JOYSTICK FIXO NA TELA
    // =====================================================

    this.joystick.base.setScrollFactor(0);
    this.joystick.thumb.setScrollFactor(0);

    this.joystick.base.setDepth(100);
    this.joystick.thumb.setDepth(101);

    // =====================================================
    // MOVIMENTO
    // =====================================================

    this.joystick.on("update", () => {
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
          if (this.direction.x > 0) {
            this.player.anims.play("walk-right", true);
          } else {
            this.player.anims.play("walk-left", true);
          }
        }

        // =================================================
        // VERTICAL
        // =================================================
        else {
          if (this.direction.y > 0) {
            this.player.anims.play("walk-down", true);
          } else {
            this.player.anims.play("walk-up", true);
          }
        }
      } else {
        this.player.setVelocity(0, 0);

        this.player.anims.stop();
      }
    });

    // =====================================================
    // CÂMERA
    // =====================================================

    this.cameras.main.startFollow(this.player, true);

    this.cameras.main.setZoom(1);

    // =====================================================
    // TEXTO COM COORDENADAS
    // =====================================================

    this.textoCoordenadas = this.add.text(10, 10, "", {
      fontSize: "18px",
      backgroundColor: "#000000",
      padding: {
        x: 8,
        y: 5,
      },
    });

    this.textoCoordenadas.setScrollFactor(0);
    this.textoCoordenadas.setDepth(200);

    // =====================================================
    // TECLA R PARA TESTAR RESPAWN
    // =====================================================

    this.teclaR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    console.log("Respawn atual:", this.respawnX, this.respawnY);
  }

  // =====================================================
  // RESPAWN
  // =====================================================

  respawnPlayer() {
    this.player.setVelocity(0, 0);

    this.player.setPosition(this.respawnX, this.respawnY);
  }

  update() {
    // =====================================================
    // MOSTRA COORDENADAS
    // =====================================================

    const x = Math.round(this.player.x);

    const y = Math.round(this.player.y);

    this.textoCoordenadas.setText("X: " + x + "  Y: " + y);

    // =====================================================
    // APERTAR R = VOLTAR PARA O RESPAWN
    // =====================================================

    if (Phaser.Input.Keyboard.JustDown(this.teclaR)) {
      this.respawnPlayer();
    }
  }
}

export default Level1;
