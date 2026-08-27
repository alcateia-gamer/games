class Preloader extends Phaser.Scene {
  /// CONSTRUTOR DA CENA
  constructor() {
    super("preloader");
  }

  /// TELA DE CARREGAMENTO
  init() {
    /// IMAGEM DE FUNDO DA TELA DE CARREGAMENTO
    this.add.image(400, 225, "start-background");

    /// BORDA DA BARRA DE CARREGAMENTO
    this.add.rectangle(400, 300, 468, 32).setStrokeStyle(1, 0xffffff);

    /// BARRA DE CARREGAMENTO
    const bar = this.add.rectangle(400, 300, 300, 28, 0xffffff);

    /// ATUALIZA A BARRA ENQUANTO OS ARQUIVOS CARREGAM
    this.load.on("progress", (progress) => {
      bar.width = 4 + 460 * progress;
    });
  }

  /// CARREGAMENTO DOS ARQUIVOS
  preload() {
    /// DEFINE A PASTA PRINCIPAL DOS ASSETS
    this.load.setPath("./assets/");

    /// MAPA DO TILED
    this.load.tilemapTiledJSON("mapa", "map/mapa.json");

    /// TILESET PIXEL CYBERPUNK INTERIOR
    this.load.image(
      "pixel-cyberpunk-interior",
      "map/lab_tileset_LITE/pixel_cyberpunk_interior_free_1.0.1/pixel-cyberpunk-interior.png",
    );

    /// TILESET DO LABORATÓRIO
    this.load.image("lab", "map/lab_tileset_LITE/lab_tileset_LITE.png");

    /// TILESET DE MÓVEIS
    this.load.image("furniture", "map/scifi_asset_pack/furniture.png");

    /// TILESET DE MÓVEIS ADICIONAIS
    this.load.image(
      "furniture_pack",
      "map/scifi_asset_pack/furniture_pack.png",
    );

    /// TILESET IDLE
    this.load.image("idle", "map/scifi_asset_pack/idle.png");

    /// TILESET MUSH ANIMATION
    this.load.image("mush_anim", "map/scifi_asset_pack/mush_anim.png");

    /// TILESET ORCHID ANIMATION
    this.load.image("orchid_anim", "map/scifi_asset_pack/orchid_anim.png");

    /// TILESET CHAMA ROXA
    this.load.image(
      "purple_flame_sheet",
      "map/scifi_asset_pack/purple_flame_sheet.png",
    );

    /// TILESET FUNDO ESPACIAL
    this.load.image(
      "space_background",
      "map/scifi_asset_pack/space_background.png",
    );

    /// TILESET PRINCIPAL SCI-FI
    this.load.image("tileset", "map/scifi_asset_pack/tileset.png");

    /// TILESET WALK BACK
    this.load.image("walk_back", "map/scifi_asset_pack/walk_back.png");

    /// TILESET WALK FRONT
    this.load.image("walk_front", "map/scifi_asset_pack/walk_front.png");

    /// TILESET WALK LEFT
    this.load.image("walk_left", "map/scifi_asset_pack/walk_left.png");

    /// TILESET WALK RIGHT
    this.load.image("walk_right", "map/scifi_asset_pack/walk_right.png");

    /// TILESET WE R MUSH
    this.load.image(
      "we_r_mush_anim",
      "map/scifi_asset_pack/we_r_mush_anim.png",
    );

    /// TILESET TECH DUNGEON
    this.load.image(
      "tileset_x1",
      "map/Tech Dungeon Roguelite - Asset Pack (DEMO)/tileset x1.png",
    );

    /// SPRITESHEET DO PERSONAGEM
    this.load.spritesheet("Verme", "personagem/Verme.png", {
      frameWidth: 64,
      frameHeight: 64,
    });

    /// PLUGIN DO JOYSTICK
    this.load.plugin(
      "rexvirtualjoystickplugin",
      "../js/rexvirtualjoystickplugin.min.js",
      true,
    );
  }

  /// QUANDO TERMINAR DE CARREGAR
  create() {
    /// INICIA A CENA LEVEL1
    this.scene.start("Level1");
  }
}

export default Preloader;
