class Preloader extends Phaser.Scene {
  constructor() {
    super("preloader");
  }

  // =====================================================
  // INIT
  // =====================================================

  init() {
    // =====================================================
    // FUNDO
    // =====================================================

    this.add.image(400, 225, "start-background");

    // =====================================================
    // ESCURECIMENTO DO FUNDO
    // =====================================================

    this.add.rectangle(400, 225, 800, 450, 0x000000, 0.3);

    // =====================================================
    // PAINEL PRINCIPAL
    // =====================================================

    this.add
      .rectangle(400, 305, 440, 115, 0x050914, 0.88)
      .setStrokeStyle(2, 0x00d9ff, 0.8);

    // =====================================================
    // STATUS
    // =====================================================

    this.textoStatus = this.add.text(200, 280, "INICIANDO O JOGO...", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#a8f3ff",
    });

    // =====================================================
    // BORDA DA BARRA
    // =====================================================

    this.add
      .rectangle(400, 315, 404, 26, 0x02040a, 0.95)
      .setStrokeStyle(2, 0x00d9ff, 1);

    // =====================================================
    // BARRA DE CARREGAMENTO
    // =====================================================

    this.barra = this.add
      .rectangle(204, 315, 0, 12, 0x00d9ff, 1)
      .setOrigin(0, 0.5);

    // =====================================================
    // PORCENTAGEM
    // =====================================================

    this.porcentagem = this.add
      .text(600, 342, "0%", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
      })
      .setOrigin(1, 0.5);

    // =====================================================
    // PROGRESSO
    // =====================================================

    this.load.on("progress", (progress) => {
      // Atualiza o tamanho da barra
      this.barra.width = 392 * progress;

      // Atualiza a porcentagem
      this.porcentagem.setText(Math.floor(progress * 100) + "%");
    });
  }

  // =====================================================
  // PRELOAD
  // =====================================================

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
    // PERSONAGEM - ATAQUE
    // =====================================================

    this.load.spritesheet("attack", "personagem/katana_slash_128.png", {
      frameWidth: 128,
      frameHeight: 128,
    });

// =====================================================
// INIMIGO DE TESTE
// =====================================================

this.load.spritesheet(
  "robo-teste",
  "personagem/inimigos/robo_teste.png",
  {
    frameWidth: 96,
    frameHeight: 130,
  },
);
// =====================================================
    // JOYSTICK
    // =====================================================

    this.load.plugin(
      "rexvirtualjoystickplugin",
      "../js/libs/rexvirtualjoystickplugin.min.js",
      true,
    );

    // =====================================================
    // TILESETS - CIDADE
    // =====================================================

    // City Shopping
    this.load.image(
      "cityShopping",
      "../Tilesets/City/Tileset_SciFi_CityShopping_Rasak.png",
    );

    // Rua
    this.load.image(
      "street",
      "../Tilesets/City/Tileset_SciFi_Street_Rasak.png",
    );

    // Rua duplicada
    this.load.image(
      "street2",
      "../Tilesets/City/Tileset_SciFi_Street_Rasak_DUP.png",
    );

    // Lixo
    this.load.image(
      "garbage",
      "../Tilesets/City/Tileset_SciFi_Garbage_Rasak.png",
    );

    // Rua A5
    this.load.image("a5Street", "../Tilesets/City/A5_Street_Rasak.png");

    // Slums
    this.load.image("slums", "../Tilesets/City/Tileset_SciFi_Slums_Rasak.png");

    // Transporte público
    this.load.image(
      "publicTransportation",
      "../Tilesets/City/Tileset_SciFi_PublicTransportation_Slums_Rasak.png.png",
    );

    // Exterior A4
    this.load.image("a4Outside", "../Tilesets/City/A4_SciFi_Outside_Rasak.png");

    // Exterior A3
    this.load.image("a3Outside", "../Tilesets/City/A3_SciFi_Outside_Rasak.png");

    // Exterior A5
    this.load.image(
      "A5_SciFi_Outside_Rasak",
      "../Tilesets/City/A5_SciFi_Outside_Rasak.png",
    );

    // Extras de prédios
    this.load.image(
      "buildingExtras",
      "../Tilesets/City/Tileset_SciFi_BuildingExtras.png",
    );

    // Torre
    this.load.image("torre", "../Tilesets/City/TorreTileset.png");

    // =====================================================
    // TILESETS - INTERIOR
    // =====================================================

    // Apartamento
    this.load.image(
      "apartment2",
      "../Tilesets/Inside/Tileset_SciFi_Arpartment_2_Rasak.png",
    );

    // =====================================================
    // TILESETS - INDUSTRIAL
    // =====================================================

    // Tileset industrial
    this.load.image(
      "ModernIndustrial2",
      "../Tilesets/Industrial/Tileset_Modern_Industrial_2_Rasak.png",
    );

    // Interior da fábrica
    this.load.image(
      "ModernInsideFactoryA1",
      "../Tilesets/Industrial/A1_Modern_Inside_Factory_Rasak.png",
    );

    // =====================================================
    // TILESETS - VEÍCULOS
    // =====================================================

    // Speeder civil 5
    this.load.image(
      "VehiclesSpeederCivil5",
      "../Tilesets/Animations/Vehicles/Flying cars/Speeder_civil5.png",
    );

    // Speeder civil 2
    this.load.image(
      "Speeder_civil2",
      "../Tilesets/Animations/Vehicles/Flying cars/Speeder_civil2.png",
    );

    // Transporte privado
    this.load.image(
      "Transporter_Private",
      "../Tilesets/Animations/Vehicles/Flying cars/Transporter_Private.png",
    );

    // Ambulância
    this.load.image(
      "Transporter_Ambulance",
      "../Tilesets/Animations/Vehicles/Flying cars/Transporter_Ambulance.png",
    );

    // SWAT
    this.load.image(
      "Transporter_PoliceSwat",
      "../Tilesets/Animations/Vehicles/Flying cars/Transporter_PoliceSwat.png",
    );

    // =====================================================
    // DEBUG DE ERROS
    // =====================================================

    this.load.on("loaderror", (file) => {
      console.error("ERRO AO CARREGAR:", file.key, file.src);
    });
  }

  // =====================================================
  // CREATE
  // =====================================================

  create() {
    // =====================================================
    // FINALIZA A BARRA
    // =====================================================

    this.barra.width = 392;
    this.porcentagem.setText("100%");
    this.textoStatus.setText("INCURSÃO PRONTA");

    // =====================================================
    // INICIA O LEVEL 1
    // =====================================================

    this.scene.start("Level1");
  }
}

export default Preloader;
