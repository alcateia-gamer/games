class Level1 extends Phaser.Scene {
  /// ==================================================
  /// CONSTRUTOR DA CENA
  /// ==================================================
  constructor() {
    super("Level1");

    /// FORÇA MÍNIMA DO JOYSTICK
    this.threshold = 0.1;

    /// VELOCIDADE DO PERSONAGEM
    this.speed = 300;

    /// DIREÇÃO ATUAL
    this.direction = undefined;
  }

  /// ==================================================
  /// CRIAÇÃO DA CENA
  /// ==================================================
  create() {
    /// ==================================================
    /// MAPA DO TILED
    /// ==================================================

    this.map = this.make.tilemap({
      key: "mapa",
    });

    /// ==================================================
    /// TILESETS
    /// ==================================================

    const pixelCyberpunk = this.map.addTilesetImage(
      "pixel-cyberpunk-interior",
      "pixel-cyberpunk-interior",
    );

    const lab = this.map.addTilesetImage("lab_tileset_LITE", "lab");

    const furniture = this.map.addTilesetImage("furniture", "furniture");

    const furniturePack = this.map.addTilesetImage(
      "furniture_pack",
      "furniture_pack",
    );

    const idle = this.map.addTilesetImage("idle", "idle");

    const mushAnim = this.map.addTilesetImage("mush_anim", "mush_anim");

    const orchidAnim = this.map.addTilesetImage("orchid_anim", "orchid_anim");

    const purpleFlame = this.map.addTilesetImage(
      "purple_flame_sheet",
      "purple_flame_sheet",
    );

    const spaceBackground = this.map.addTilesetImage(
      "space_background",
      "space_background",
    );

    const tileset = this.map.addTilesetImage("tileset", "tileset");

    const walkBack = this.map.addTilesetImage("walk_back", "walk_back");

    const walkFront = this.map.addTilesetImage("walk_front", "walk_front");

    const walkLeft = this.map.addTilesetImage("walk_left", "walk_left");

    const walkRight = this.map.addTilesetImage("walk_right", "walk_right");

    const weRMush = this.map.addTilesetImage(
      "we_r_mush_anim",
      "we_r_mush_anim",
    );

    const tilesetX1 = this.map.addTilesetImage("tileset x1", "tileset_x1");

    /// ==================================================
    /// LISTA DE TILESETS
    /// ==================================================

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

    /// ==================================================
    /// CAMADAS DO MAPA
    /// ==================================================

    const camadaChao = this.map.createLayer("Chão", tilesets, 0, 0);

    const camadaSombra = this.map.createLayer("Sombra", tilesets, 0, 0);

    const camadaParedeTras = this.map.createLayer(
      "parede-trás",
      tilesets,
      0,
      0,
    );

    const camadaParedeFrente = this.map.createLayer(
      "parede-frente",
      tilesets,
      0,
      0,
    );

    const camadaAdicionais = this.map.createLayer("Adicionais", tilesets, 0, 0);

    const camadaObjetos1 = this.map.createLayer("Objetos 1", tilesets, 0, 0);

    const camadaObjetos2 = this.map.createLayer("objetos2", tilesets, 0, 0);

    /// ==================================================
    /// PROFUNDIDADE DAS CAMADAS
    /// ==================================================

    camadaChao.setDepth(0);
    camadaSombra.setDepth(1);
    camadaParedeTras.setDepth(2);
    camadaAdicionais.setDepth(3);
    camadaObjetos1.setDepth(4);
    camadaObjetos2.setDepth(5);
    camadaParedeFrente.setDepth(6);

    /// ==================================================
    /// ANIMAÇÃO - DIREITA
    /// ==================================================

    this.anims.create({
      key: "walk-right",

      frames: this.anims.generateFrameNumbers("Verme", {
        start: 87,
        end: 95,
      }),

      frameRate: 12,
      repeat: -1,
    });

    /// ==================================================
    /// ANIMAÇÃO - ESQUERDA
    /// ==================================================

    this.anims.create({
      key: "walk-left",

      frames: this.anims.generateFrameNumbers("Verme", {
        /// TROCAR DEPOIS PELOS FRAMES CORRETOS
        start: 69,
        end: 77,
      }),

      frameRate: 12,
      repeat: -1,
    });

    /// ==================================================
    /// ANIMAÇÃO - CIMA
    /// ==================================================

    this.anims.create({
      key: "walk-up",

      frames: this.anims.generateFrameNumbers("Verme", {
        /// TROCAR DEPOIS PELOS FRAMES CORRETOS
        start: 59,
        end: 68,
      }),

      frameRate: 12,
      repeat: -1,
    });

    /// ==================================================
    /// ANIMAÇÃO - BAIXO
    /// ==================================================

    this.anims.create({
      key: "walk-down",

      frames: this.anims.generateFrameNumbers("Verme", {
        /// TROCAR DEPOIS PELOS FRAMES CORRETOS
        start: 78,
        end: 86,
      }),

      frameRate: 12,
      repeat: -1,
    });

    /// ==================================================
    /// PERSONAGEM
    /// ==================================================

    this.player = this.physics.add.sprite(400, 300, "Verme", 14);

    /// REMOVE A GRAVIDADE
    this.player.body.setAllowGravity(false);

    /// PERSONAGEM ACIMA DO MAPA
    this.player.setDepth(50);

    /// ==================================================
    /// GUARDA A ÚLTIMA DIREÇÃO
    /// ==================================================

    this.ultimaDirecao = "down";

    /// ==================================================
    /// JOYSTICK
    /// ==================================================

    this.joystick = this.plugins.get("rexvirtualjoystickplugin").add(this, {
      /// POSIÇÃO
      x: 100,
      y: 350,

      /// TAMANHO
      radius: 50,

      /// BASE
      base: this.add.circle(0, 0, 50, 0xcccccc),

      /// BOTÃO CENTRAL
      thumb: this.add.circle(0, 0, 25, 0x666666),
    });

    /// ==================================================
    /// JOYSTICK FIXO NA TELA
    /// ==================================================

    this.joystick.base.setScrollFactor(0);
    this.joystick.thumb.setScrollFactor(0);

    /// ==================================================
    /// JOYSTICK ACIMA DO MAPA
    /// ==================================================

    this.joystick.base.setDepth(100);
    this.joystick.thumb.setDepth(101);

    /// ==================================================
    /// MOVIMENTO DO PERSONAGEM
    /// ==================================================

    this.joystick.on("update", () => {
      /// ÂNGULO DO JOYSTICK
      const angle = Phaser.Math.DegToRad(this.joystick.angle);

      /// FORÇA DO JOYSTICK
      const force = this.joystick.force;

      /// ==================================================
      /// SE O JOYSTICK ESTIVER SENDO USADO
      /// ==================================================

      if (force > this.threshold) {
        /// CALCULA A DIREÇÃO
        this.direction = new Phaser.Math.Vector2(
          Math.cos(angle),
          Math.sin(angle),
        ).normalize();

        /// VELOCIDADE X
        const x = this.direction.x * this.speed;

        /// VELOCIDADE Y
        const y = this.direction.y * this.speed;

        /// MOVE O PERSONAGEM
        this.player.setVelocity(x, y);

        /// ==================================================
        /// ESCOLHE A ANIMAÇÃO
        /// ==================================================

        /// MOVIMENTO MAIS FORTE NA HORIZONTAL
        if (Math.abs(this.direction.x) > Math.abs(this.direction.y)) {
          /// DIREITA
          if (this.direction.x > 0) {
            this.player.anims.play("walk-right", true);

            this.ultimaDirecao = "right";
          }

          /// ESQUERDA
          else {
            this.player.anims.play("walk-left", true);

            this.ultimaDirecao = "left";
          }
        }

        /// MOVIMENTO MAIS FORTE NA VERTICAL
        else {
          /// BAIXO
          if (this.direction.y > 0) {
            this.player.anims.play("walk-down", true);

            this.ultimaDirecao = "down";
          }

          /// CIMA
          else {
            this.player.anims.play("walk-up", true);

            this.ultimaDirecao = "up";
          }
        }
      }

      /// ==================================================
      /// QUANDO SOLTAR O JOYSTICK
      /// ==================================================
      else {
        /// PARA O PERSONAGEM
        this.player.setVelocity(0, 0);

        /// PARA A ANIMAÇÃO
        this.player.anims.stop();
      }
    });

    /// ==================================================
    /// CÂMERA
    /// ==================================================

    this.cameras.main.startFollow(this.player, true);
  }
}

export default Level1;
