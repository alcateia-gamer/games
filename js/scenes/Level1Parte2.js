import criarLevel1Parte2Map from "../map/Level1Parte2Map.js";
import criarAnimacoesPlayer from "../player/PlayerAnimations.js";
import {
  criarPlayer,
  atualizarHitboxDanoPlayer,
} from "../player/Player.js";
import { criarControles, atualizarControles } from "../controls/PlayerControls.js";
import { criarStatusPlayer, atualizarStatusPlayer } from "../player/PlayerStatus.js";

class Level1Parte2 extends Phaser.Scene {
  constructor() {
    super("Level1Parte2");

    this.threshold = 0.1;
    this.speed = 400;
    this.direcaoAtual = "down";
    this.atacando = false;
  }

  init(data) {
    this.respawnX = data.spawnX ?? 50;
    this.respawnY = data.spawnY ?? -1087;
  }

  create() {
    this.map = criarLevel1Parte2Map(this);
    criarAnimacoesPlayer(this);
    criarPlayer(this);

    this.criarBlocoRetornoParte1();

    if (this.collisionGroup) {
      this.physics.add.collider(this.player, this.collisionGroup);
    }

    this.events.on(Phaser.Scenes.Events.POST_UPDATE, () => {
      atualizarHitboxDanoPlayer(this);
    });

    criarStatusPlayer(this);
    criarControles(this);

    this.textoCoordenadas = this.add.text(10, 78, "", {
      fontSize: "14px",
      backgroundColor: "#000000",
      padding: {
        x: 6,
        y: 4,
      },
    });

    this.textoCoordenadas.setScrollFactor(0).setDepth(200);

    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.setZoom(1);
  }

  update(time, delta) {
    atualizarControles(this);
    atualizarStatusPlayer(this, delta);

    const x = Math.round(this.player.x);
    const y = Math.round(this.player.y);

    this.textoCoordenadas.setText("X: " + x + "  Y: " + y);

    this.pertoDoBlocoRetorno = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.blocoRetornoParte1.x,
      this.blocoRetornoParte1.y,
    ) <= 64;

    if (
      this.pertoDoBlocoRetorno &&
      Phaser.Input.Keyboard.JustDown(this.teclaInteracao)
    ) {
      this.scene.start("Level1", {
        spawnX: -107,
        spawnY: 454,
      });
    }
  }

  criarBlocoRetornoParte1() {
    const x = 50;
    const y = -1087;
    const tamanho = 48;

    this.blocoRetornoParte1 = this.add
      .rectangle(x, y, tamanho, tamanho, 0x00d9ff, 0.85)
      .setStrokeStyle(3, 0xffffff, 1)
      .setDepth(12);

    this.blocoRetornoParte1Label = this.add
      .text(x, y, "E", {
        color: "#06131f",
        fontFamily: "monospace",
        fontSize: "22px",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setDepth(13);

    this.teclaInteracao = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.E,
    );

    this.physics.world.enable(this.blocoRetornoParte1, Phaser.Physics.Arcade.STATIC_BODY);
    this.blocoRetornoParte1.body.setSize(tamanho, tamanho);

    this.pertoDoBlocoRetorno = false;

  }
}

export default Level1Parte2;