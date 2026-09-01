class Preloader extends Phaser.Scene {
  constructor() {
    super("preloader");
  }

  init() {
    this.add.image(400, 225, "start-background");

    this.add.rectangle(400, 300, 468, 32).setStrokeStyle(1, 0xffffff);

    const bar = this.add.rectangle(400, 300, 300, 28, 0xffffff);

    this.load.on("progress", (progress) => {
      bar.width = 4 + 460 * progress;
    });
  }

  preload() {
    // =====================================================
    // CAMINHO DOS ASSETS
    // =====================================================

    this.load.setPath("./assets/");

    // =====================================================
    // MAPA
    // =====================================================

    this.load.tilemapTiledJSON("mapa", "map/InicioFase1 (1).json");

    // =====================================================
    // PERSONAGEM - CAMINHADA
    // =====================================================

    this.load.spritesheet("walk", "personagem/standard/walk.png", {
      frameWidth: 64,
      frameHeight: 64,
    });

    // =====================================================
    // PERSONAGEM - ATAQUE COM KATANA
    // =====================================================

    this.load.spritesheet("attack", "personagem/katana_slash_128.png", {
      frameWidth: 128,
      frameHeight: 128,
    });

    // =====================================================
    // JOYSTICK
    // =====================================================

    this.load.plugin(
      "rexvirtualjoystickplugin",
      "../js/libs/rexvirtualjoystickplugin.min.js",
      true,
    );

    // =====================================================
    // TILESETS
    // =====================================================

    this.load.image(
      "cityShopping",
      "../Tilesets/City/Tileset_SciFi_CityShopping_Rasak.png",
    );

    this.load.image(
      "street",
      "../Tilesets/City/Tileset_SciFi_Street_Rasak.png",
    );

    this.load.image(
      "garbage",
      "../Tilesets/City/Tileset_SciFi_Garbage_Rasak.png",
    );

    this.load.image("a5Street", "../Tilesets/City/A5_Street_Rasak.png");

    this.load.image("slums", "../Tilesets/City/Tileset_SciFi_Slums_Rasak.png");

    this.load.image("a4Outside", "../Tilesets/City/A4_SciFi_Outside_Rasak.png");

    this.load.image("a3Outside", "../Tilesets/City/A3_SciFi_Outside_Rasak.png");

    this.load.image(
      "buildingExtras",
      "../Tilesets/City/Tileset_SciFi_BuildingExtras.png",
    );

    this.load.image("torre", "../Tilesets/City/TorreTileset.png");
  }

  create() {
    // =====================================================
    // INICIA O LEVEL 1
    // =====================================================

    this.scene.start("Level1");
  }
}

export default Preloader;
