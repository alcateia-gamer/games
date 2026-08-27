class Level1 extends Phaser.Scene {
  /// CONSTRUTOR DA CENA
  constructor() {
    super("Level1");

    /// FORÇA MÍNIMA DO JOYSTICK
    this.threshold = 0.1;

    /// VELOCIDADE DO PERSONAGEM
    this.speed = 300;

    /// DIREÇÃO ATUAL DO PERSONAGEM
    this.direction = undefined;
  }

  /// CRIAÇÃO DA CENA
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

    /// PIXEL CYBERPUNK
    const pixelCyberpunk = this.map.addTilesetImage(
      "pixel-cyberpunk-interior",
      "pixel-cyberpunk-interior",
    );

    /// LABORATÓRIO
    const lab = this.map.addTilesetImage("lab_tileset_LITE", "lab");

    /// FURNITURE
    const furniture = this.map.addTilesetImage("furniture", "furniture");

    /// FURNITURE PACK
    const furniturePack = this.map.addTilesetImage(
      "furniture_pack",
      "furniture_pack",
    );

    /// IDLE
    const idle = this.map.addTilesetImage("idle", "idle");

    /// MUSH
    const mushAnim = this.map.addTilesetImage("mush_anim", "mush_anim");

    /// ORCHID
    const orchidAnim = this.map.addTilesetImage("orchid_anim", "orchid_anim");

    /// CHAMA ROXA
    const purpleFlame = this.map.addTilesetImage(
      "purple_flame_sheet",
      "purple_flame_sheet",
    );

    /// FUNDO ESPACIAL
    const spaceBackground = this.map.addTilesetImage(
      "space_background",
      "space_background",
    );

    /// TILESET PRINCIPAL
    const tileset = this.map.addTilesetImage("tileset", "tileset");

    /// WALK BACK
    const walkBack = this.map.addTilesetImage("walk_back", "walk_back");

    /// WALK FRONT
    const walkFront = this.map.addTilesetImage("walk_front", "walk_front");

    /// WALK LEFT
    const walkLeft = this.map.addTilesetImage("walk_left", "walk_left");

    /// WALK RIGHT
    const walkRight = this.map.addTilesetImage("walk_right", "walk_right");

    /// WE R MUSH
    const weRMush = this.map.addTilesetImage(
      "we_r_mush_anim",
      "we_r_mush_anim",
    );

    /// TECH DUNGEON
    const tilesetX1 = this.map.addTilesetImage("tileset x1", "tileset_x1");

    /// ==================================================
    /// LISTA COM TODOS OS TILESETS
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

    /// CHÃO
    const camadaChao = this.map.createLayer("Chão", tilesets, 0, 0);

    /// SOMBRA
    const camadaSombra = this.map.createLayer("Sombra", tilesets, 0, 0);

    /// PAREDE DE TRÁS
    const camadaParedeTras = this.map.createLayer(
      "parede-trás",
      tilesets,
      0,
      0,
    );

    /// PAREDE DA FRENTE
    const camadaParedeFrente = this.map.createLayer(
      "parede-frente",
      tilesets,
      0,
      0,
    );

    /// ADICIONAIS
    const camadaAdicionais = this.map.createLayer("Adicionais", tilesets, 0, 0);

    /// OBJETOS
    const camadaObjetos1 = this.map.createLayer("Objetos 1", tilesets, 0, 0);

    /// OBJETOS 2
    const camadaObjetos2 = this.map.createLayer("objetos2", tilesets, 0, 0);

    /// ==================================================
    /// LISTA DAS CAMADAS
    /// ==================================================

    const camadas = [
      camadaChao,
      camadaSombra,
      camadaParedeTras,
      camadaParedeFrente,
      camadaAdicionais,
      camadaObjetos1,
      camadaObjetos2,
    ];

    /// ==================================================
    /// PROFUNDIDADE DAS CAMADAS
    /// ==================================================

    /// CAMADAS MAIS BAIXAS
    camadaChao.setDepth(0);
    camadaSombra.setDepth(1);
    camadaParedeTras.setDepth(2);
    camadaAdicionais.setDepth(3);
    camadaObjetos1.setDepth(4);
    camadaObjetos2.setDepth(5);

    /// PAREDE DA FRENTE
    camadaParedeFrente.setDepth(6);

    /// ==================================================
    /// ANIMAÇÃO DO PERSONAGEM
    /// ==================================================

    this.anims.create({
      key: "right",

      frames: this.anims.generateFrameNumbers("Verme", {
        start: 87,
        end: 95,
      }),

      frameRate: 12,

      repeat: -1,
    });

    /// ==================================================
    /// PERSONAGEM
    /// ==================================================

    this.player = this.physics.add.sprite(400, 300, "Verme", 14);

    /// REMOVE GRAVIDADE
    this.player.body.setAllowGravity(false);

    /// DEIXA O PERSONAGEM ACIMA DO MAPA
    this.player.setDepth(50);

    /// ==================================================
    /// JOYSTICK
    /// ==================================================

    this.joystick = this.plugins.get("rexvirtualjoystickplugin").add(this, {
      /// POSIÇÃO NA TELA
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
    /// DEIXA O JOYSTICK FIXO NA TELA
    /// ==================================================

    this.joystick.base.setScrollFactor(0);

    this.joystick.thumb.setScrollFactor(0);

    /// ==================================================
    /// JOYSTICK SEMPRE NA FRENTE
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

      /// SE ESTIVER MOVENDO O JOYSTICK
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

        /// MOVIMENTA O PERSONAGEM
        this.player.setVelocity(x, y);
      }

      /// SE SOLTAR O JOYSTICK
      else {
        /// PARA O PERSONAGEM
        this.player.setVelocity(0, 0);
      }
    });

    /// ==================================================
    /// CÂMERA
    /// ==================================================

    /// FAZ A CÂMERA SEGUIR O PERSONAGEM
    this.cameras.main.startFollow(this.player, true);

    /// ==================================================
    /// DESCOBRE O TAMANHO REAL DO MAPA
    /// ==================================================

    /// O SEU MAPA É INFINITO NO TILED.
    /// POR ISSO NÃO PODEMOS USAR SIMPLESMENTE:
    ///
    /// 0, 0, map.widthInPixels, map.heightInPixels
    ///
    /// ABAIXO PEGAMOS O TAMANHO REAL DAS CAMADAS.

    let esquerda = Infinity;
    let topo = Infinity;
    let direita = -Infinity;
    let baixo = -Infinity;

    /// VERIFICA CADA CAMADA
    camadas.forEach((camada) => {
      /// IGNORA CAMADA INVÁLIDA
      if (!camada) {
        return;
      }

      /// PEGA OS LIMITES DA CAMADA
      const bounds = camada.getBounds();

      /// MENOR POSIÇÃO X
      esquerda = Math.min(esquerda, bounds.left);

      /// MENOR POSIÇÃO Y
      topo = Math.min(topo, bounds.top);

      /// MAIOR POSIÇÃO X
      direita = Math.max(direita, bounds.right);

      /// MAIOR POSIÇÃO Y
      baixo = Math.max(baixo, bounds.bottom);
    });

    /// ==================================================
    /// APLICA OS LIMITES DA CÂMERA
    /// ==================================================

    if (
      Number.isFinite(esquerda) &&
      Number.isFinite(topo) &&
      Number.isFinite(direita) &&
      Number.isFinite(baixo)
    ) {
      /// LARGURA TOTAL DO MAPA
      const larguraMapa = direita - esquerda;

      /// ALTURA TOTAL DO MAPA
      const alturaMapa = baixo - topo;

      /// DEFINE OS LIMITES
      this.cameras.main.setBounds(esquerda, topo, larguraMapa, alturaMapa);
    }
  }
}

export default Level1;
