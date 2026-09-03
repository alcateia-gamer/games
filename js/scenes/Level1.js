import criarLevel1Map from "../map/Level1Map.js";

import criarAnimacoesPlayer from "../player/PlayerAnimations.js";

import {
  criarPlayer,
  respawnPlayer,
  atualizarHitboxDanoPlayer,
} from "../player/Player.js";

import {
  criarControles,
  atualizarControles,
} from "../controls/PlayerControls.js";

import {
  criarStatusPlayer,
  atualizarStatusPlayer,
} from "../player/PlayerStatus.js";

import {
  criarInimigoTeste,
  atualizarInimigoTeste,
} from "../enemies/EnemyTest.js";

class Level1 extends Phaser.Scene {
  constructor() {
    super("Level1");

    // =====================================================
    // MOVIMENTO
    // =====================================================

    this.threshold = 0.1;

    this.speed = 400;

    this.direction = undefined;

    this.direcaoAtual = "down";

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
    // PLAYER
    // =====================================================

    criarAnimacoesPlayer(this);

    criarPlayer(this);

    // =====================================================
    // HITBOX DE DANO
    // =====================================================
    // ATUALIZA DEPOIS DO PASSO DO JOGO
    // =====================================================

    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => {
      atualizarHitboxDanoPlayer(this);
    });

    // =====================================================
    // COLISÃO DO PLAYER COM O MAPA
    // =====================================================

    this.physics.add.collider(this.player, this.collisionGroup);

    // =====================================================
    // STATUS
    // =====================================================

    criarStatusPlayer(this);

    // =====================================================
    // CONTROLES
    // =====================================================

    criarControles(this);

    // =====================================================
    // INIMIGO
    // =====================================================

    criarInimigoTeste(this);

    // =====================================================
    // CÂMERA
    // =====================================================

    this.cameras.main.startFollow(this.player, true);

    this.cameras.main.setZoom(1);

    // =====================================================
    // COORDENADAS
    // =====================================================

    this.textoCoordenadas = this.add.text(10, 78, "", {
      fontSize: "14px",

      backgroundColor: "#000000",

      padding: {
        x: 6,
        y: 4,
      },
    });

    this.textoCoordenadas.setScrollFactor(0).setDepth(200);

    // =====================================================
    // TECLA R
    // =====================================================

    this.teclaR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
  }

  update(time, delta) {
    // =====================================================
    // CONTROLES
    // =====================================================

    atualizarControles(this);

    // =====================================================
    // VIDA E ESTAMINA
    // =====================================================

    atualizarStatusPlayer(this, delta);

    // =====================================================
    // INIMIGO
    // =====================================================

    atualizarInimigoTeste(this, time);

    // =====================================================
    // COORDENADAS
    // =====================================================

    const x = Math.round(this.player.x);

    const y = Math.round(this.player.y);

    this.textoCoordenadas.setText("X: " + x + "  Y: " + y);

    // =====================================================
    // RESPAWN
    // =====================================================

    if (Phaser.Input.Keyboard.JustDown(this.teclaR)) {
      respawnPlayer(this);
    }
  }
}

export default Level1;
