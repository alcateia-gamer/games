import criarLevel1Map from "../map/Level1Map.js";

import criarTransicaoParaParte2 from "../core/MapTransition.js";

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
  criarGrupoRobos,
  atualizarInimigoTeste,
} from "../enemies/EnemyTest.js";

// =====================================================
// LEVEL 1
// =====================================================

class Level1 extends Phaser.Scene {
  constructor() {
    super("Level1");

    // =====================================================
    // MOVIMENTO
    // =====================================================

    this.threshold = 0.1;

    this.speed = 200;

    this.direction = undefined;

    this.direcaoAtual = "down";

    this.atacando = false;

    // =====================================================
    // RESPAWN
    // =====================================================

    this.respawnX = -1440;

    this.respawnY = 454;
  }

  init(data) {
    this.respawnX = data.spawnX ?? -1440;
    this.respawnY = data.spawnY ?? 454;
    this.inimigos = [];
    this.grupoRobosAtivado = false;
  }

  // =====================================================
  // CREATE
  // =====================================================

  create() {
    // =====================================================
    // MAPA
    // =====================================================

    this.map = criarLevel1Map(this);

    // =====================================================
    // ANIMAÇÕES DO PLAYER
    // =====================================================

    criarAnimacoesPlayer(this);

    // =====================================================
    // PLAYER
    // =====================================================

    criarPlayer(this);

    this.criarBlocoParte2();

    // =====================================================
    // COLISÃO DO PLAYER COM O MAPA
    // =====================================================

    this.physics.add.collider(this.player, this.collisionGroup);

    // =====================================================
    // PORTA PARA A PARTE 2
    // =====================================================

    criarTransicaoParaParte2(this);

    // =====================================================
    // HITBOX DE DANO DO PLAYER
    //
    // ATUALIZA DEPOIS DA FÍSICA
    // =====================================================

    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => {
      atualizarHitboxDanoPlayer(this);
    });

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

    this.inimigos = [];
    this.grupoRobosAtivado = false;

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

  // =====================================================
  // UPDATE
  // =====================================================

  update(time, delta) {
    // =====================================================
    // CONTROLES
    // =====================================================

    atualizarControles(this);

    // =====================================================
    // VIDA E ESTAMINA
    // =====================================================

    atualizarStatusPlayer(this, delta);

    this.atualizarProfundidadeCerca();

    // =====================================================
    // INIMIGO
    // =====================================================

    const distanciaAoPontoSpawn = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      -295,
      1284,
    );

    if (!this.grupoRobosAtivado && distanciaAoPontoSpawn <= 450) {
      criarGrupoRobos(this, -295, 1284);
      this.grupoRobosAtivado = true;
    }

    atualizarInimigoTeste(this, time);

    // =====================================================
    // COORDENADAS
    // =====================================================

    const x = Math.round(this.player.x);

    const y = Math.round(this.player.y);

    this.textoCoordenadas.setText("X: " + x + "  Y: " + y);

    const pertoDoBlocoParte2 =
      Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.blocoParte2.x,
        this.blocoParte2.y,
      ) <= 64;

    if (
      pertoDoBlocoParte2 &&
      Phaser.Input.Keyboard.JustDown(this.teclaInteracaoParte2)
    ) {
      this.scene.start("Level1Parte2", {
        spawnX: 50,
        spawnY: -1087,
      });
    }

    // =====================================================
    // RESPAWN
    // =====================================================

    if (Phaser.Input.Keyboard.JustDown(this.teclaR)) {
      respawnPlayer(this);
    }
  }

  criarBlocoParte2() {
    const x = -107;
    const y = 454;
    const tamanho = 48;

    this.blocoParte2 = this.add
      .rectangle(x, y, tamanho, tamanho, 0xffc107, 0.9)
      .setStrokeStyle(3, 0xffffff, 1)
      .setDepth(12);

    this.blocoParte2Label = this.add
      .text(x, y, "E", {
        color: "#241700",
        fontFamily: "monospace",
        fontSize: "22px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(13);

    this.teclaInteracaoParte2 = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.E,
    );
  }

  // =====================================================
  // PROFUNDIDADE DAS CERCA
  // =====================================================
  // Cerca do spawn: sempre fica na frente do personagem.
  // Camada "Cercas":
  //   y >= -207 -> fica atrás do personagem
  //   y <= -225 -> fica na frente do personagem
  //   entre esses valores -> continua atrás
  // =====================================================
  atualizarProfundidadeCerca() {
    if (!this.player?.body) {
      return;
    }

    if (this.camadaCercaSpawn) {
      this.camadaCercaSpawn.setDepth(13);
    }

    if (!this.camadaCercas) {
      return;
    }

    if (this.player.y >= -207) {
      this.camadaCercas.setDepth(11);
    } else if (this.player.y <= -225) {
      this.camadaCercas.setDepth(13);
    } else {
      this.camadaCercas.setDepth(11);
    }
  }
}

export default Level1;
