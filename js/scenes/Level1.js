import criarLevel1Map from "../map/Level1Map.js";

import criarAnimacoesPlayer from "../player/PlayerAnimations.js";

import { criarPlayer, respawnPlayer } from "../player/Player.js";

import criarControles from "../controls/PlayerControls.js";

class Level1 extends Phaser.Scene {
  constructor() {
    super("Level1");

    // =====================================================
    // MOVIMENTO
    // =====================================================

    this.threshold = 0.1;
    this.speed = 400;
    this.direction = undefined;

    // =====================================================
    // DIREÇÃO DO PERSONAGEM
    // =====================================================

    this.direcaoAtual = "down";

    // =====================================================
    // ATAQUE
    // =====================================================

    this.atacando = false;

    // =====================================================
    // RESPAWN
    // =====================================================

    this.respawnX = -1440;
    this.respawnY = 454;
  }

  create() {
    // =====================================================
    // MAPA
    // =====================================================

    this.map = criarLevel1Map(this);

    // =====================================================
    // ANIMAÇÕES DO PERSONAGEM
    // =====================================================

    criarAnimacoesPlayer(this);

    // =====================================================
    // PERSONAGEM
    // =====================================================

    criarPlayer(this);

    // =====================================================
    // CONTROLES
    // =====================================================

    criarControles(this);

    // =====================================================
    // CÂMERA
    // =====================================================

    this.cameras.main.startFollow(this.player, true);

    this.cameras.main.setZoom(1);

    // =====================================================
    // TEXTO DAS COORDENADAS
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

  update() {
    // =====================================================
    // COORDENADAS DO PERSONAGEM
    // =====================================================

    const x = Math.round(this.player.x);

    const y = Math.round(this.player.y);

    this.textoCoordenadas.setText("X: " + x + "  Y: " + y);

    // =====================================================
    // R = RESPAWN
    // =====================================================

    if (Phaser.Input.Keyboard.JustDown(this.teclaR)) {
      respawnPlayer(this);
    }
  }
}

export default Level1;
