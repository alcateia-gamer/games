class Level1 extends Phaser.Scene {
  /// CONSTRUTOR DA CENA
  constructor() {
    super("Level1");

    /// FORÇA MÍNIMA DO JOYSTICK PARA MOVIMENTAR
    this.threshold = 0.1;

    /// VELOCIDADE DO PERSONAGEM
    this.speed = 300;

    /// DIREÇÃO DO PERSONAGEM
    this.direction = undefined;
  }

  /// CRIA A CENA
  create() {
    /// CRIA O MAPA DO TILED
    this.map = this.make.tilemap({
      key: "mapa",
    });

    /// TILESET PIXEL CYBERPUNK
    const pixelCyberpunk = this.map.addTilesetImage(
      "pixel-cyberpunk-interior",
      "pixel-cyberpunk-interior",
    );

    /// TILESET LABORATÓRIO
    const lab = this.map.addTilesetImage("lab_tileset_LITE", "lab");

    /// TILESET FURNITURE
    const furniture = this.map.addTilesetImage("furniture", "furniture");

    /// TILESET FURNITURE PACK
    const furniturePack = this.map.addTilesetImage(
      "furniture_pack",
      "furniture_pack",
    );

    /// TILESET IDLE
    const idle = this.map.addTilesetImage("idle", "idle");

    /// TILESET MUSH
    const mushAnim = this.map.addTilesetImage("mush_anim", "mush_anim");

    /// TILESET ORCHID
    const orchidAnim = this.map.addTilesetImage("orchid_anim", "orchid_anim");

    /// TILESET CHAMA ROXA
    const purpleFlame = this.map.addTilesetImage(
      "purple_flame_sheet",
      "purple_flame_sheet",
    );

    /// TILESET FUNDO ESPACIAL
    const spaceBackground = this.map.addTilesetImage(
      "space_background",
      "space_background",
    );

    /// TILESET PRINCIPAL
    const tileset = this.map.addTilesetImage("tileset", "tileset");

    /// TILESET WALK BACK
    const walkBack = this.map.addTilesetImage("walk_back", "walk_back");

    /// TILESET WALK FRONT
    const walkFront = this.map.addTilesetImage("walk_front", "walk_front");

    /// TILESET WALK LEFT
    const walkLeft = this.map.addTilesetImage("walk_left", "walk_left");

    /// TILESET WALK RIGHT
    const walkRight = this.map.addTilesetImage("walk_right", "walk_right");

    /// TILESET WE R MUSH
    const weRMush = this.map.addTilesetImage(
      "we_r_mush_anim",
      "we_r_mush_anim",
    );

    /// TILESET TECH DUNGEON
    const tilesetX1 = this.map.addTilesetImage("tileset x1", "tileset_x1");

    /// JUNTA TODOS OS TILESETS
    const tilesets = [
      pixelCyberpunk,
      lab,
      furniture,
      furniturePack,
      idle,
      mushAnim,
      orchidAnim,
      purpleFlame,
      spaceBackground,
      tileset,
      walkBack,
      walkFront,
      walkLeft,
      walkRight,
      weRMush,
      tilesetX1,
    ];

    /// CAMADA DO CHÃO
    this.map.createLayer("Chão", tilesets, 0, 0);

    /// CAMADA DE SOMBRA
    this.map.createLayer("Sombra", tilesets, 0, 0);

    /// CAMADA DAS PAREDES DE TRÁS
    this.map.createLayer("parede-trás", tilesets, 0, 0);

    /// CAMADA DAS PAREDES DA FRENTE
    this.map.createLayer("parede-frente", tilesets, 0, 0);

    /// CAMADA DE ELEMENTOS ADICIONAIS
    this.map.createLayer("Adicionais", tilesets, 0, 0);

    /// CAMADA DE OBJETOS
    this.map.createLayer("Objetos 1", tilesets, 0, 0);

    /// SEGUNDA CAMADA DE OBJETOS
    this.map.createLayer("objetos2", tilesets, 0, 0);

    /// CRIA A ANIMAÇÃO DO PERSONAGEM
    this.anims.create({
      key: "right",

      frames: this.anims.generateFrameNumbers("Verme", {
        start: 87,
        end: 95,
      }),

      frameRate: 12,

      repeat: -1,
    });

    /// CRIA O PERSONAGEM
    this.player = this.physics.add.sprite(400, 300, "Verme", 14);

    /// DEIXA O PERSONAGEM NA FRENTE DO MAPA
    this.player.setDepth(10);

    /// REMOVE GRAVIDADE DO PERSONAGEM
    this.player.body.setAllowGravity(false);

    /// CRIA O JOYSTICK
    this.joystick = this.plugins.get("rexvirtualjoystickplugin").add(this, {
      /// POSIÇÃO DO JOYSTICK
      x: 100,
      y: 350,
      
      /// TAMANHO DO JOYSTICK
      radius: 50,

      /// BASE DO JOYSTICK
      base: this.add.circle(0, 0, 50, 0xcccccc),

      /// PARTE QUE O USUÁRIO MOVE
      thumb: this.add.circle(0, 0, 25, 0x666666),
    });
      /// DEIXA O JOYSTICK FIXO NA TELA
    this.joystick.base.setScrollFactor(0);
    this.joystick.thumb.setScrollFactor(0);

    /// DEIXA O JOYSTICK NA FRENTE DO MAPA
    this.joystick.base.setDepth(100);
    this.joystick.thumb.setDepth(101);

    /// DETECTA MOVIMENTO DO JOYSTICK
    this.joystick.on("update", () => {

      /// CONVERTE O ÂNGULO DO JOYSTICK
      const angle = Phaser.Math.DegToRad(this.joystick.angle);

      /// PEGA A FORÇA DO JOYSTICK
      const force = this.joystick.force;

      /// SE O JOYSTICK ESTIVER SENDO MOVIDO
      if (force > this.threshold) {
        /// CALCULA A DIREÇÃO
        this.direction = new Phaser.Math.Vector2(
          Math.cos(angle),
          Math.sin(angle),
        ).normalize();

        /// CALCULA VELOCIDADE X
        const x = this.direction.x * this.speed;

        /// CALCULA VELOCIDADE Y
        const y = this.direction.y * this.speed;

        /// MOVE O PERSONAGEM
        this.player.setVelocity(x, y);
      }

      /// SE SOLTAR O JOYSTICK
      else {
        /// PARA O PERSONAGEM
        this.player.setVelocity(0, 0);
      }
    });

    /// FAZ A CÂMERA SEGUIR O PERSONAGEM
    this.cameras.main.startFollow(this.player, true);

    
  }
}

export default Level1;
