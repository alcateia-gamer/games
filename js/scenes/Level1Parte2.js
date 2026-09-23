import criarLevel1Parte2Map from "../map/Level1Parte2Map.js";
import criarAnimacoesPlayer from "../player/PlayerAnimations.js";
import { criarPlayer, atualizarHitboxDanoPlayer } from "../player/Player.js";
import {
  criarControles,
  atualizarControles,
} from "../controls/PlayerControls.js";
import {
  criarStatusPlayer,
  atualizarStatusPlayer,
} from "../player/PlayerStatus.js";
import {
  criarRobos,
  atualizarInimigoTeste,
  limparGrupoRobos,
} from "../enemies/EnemyTest.js";
import {
  criarCompanionPet,
  atualizarCompanionPet,
  atualizarDepthCompanionPet,
} from "../player/CompanionPet.js";

class Level1Parte2 extends Phaser.Scene {
  constructor() {
    super("Level1Parte2");

    this.threshold = 0.1;
    this.speed = 200;
    this.speedTurbo = 400;
    this.developerMode = false;
    this.direcaoAtual = "down";
    this.atacando = false;
  }

  init(data) {
    this.respawnX = data.spawnX ?? 97;
    this.respawnY = data.spawnY ?? -980;
    this.personagemSelecionada = data.personagem || "standard";
    this.morteEmAndamento = false;
    this.inimigos = [];
    this.grupoRobosAtivado = false;
    this.inimigoTeste = null;
    this.teleporteRetornoLiberado = false;
    this.transicaoRetornoEmAndamento = false;
  }

  create() {
    this.physics.resume();
    this.physics.world.resume();
    this.cameras.main.fadeIn(250, 0, 0, 0);
    this.input.keyboard.enabled = true;
    this.input.keyboard.resetKeys();
    this.teclaSpawnRobo1 = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ONE,
    );
    this.teclaSpawnRobo2 = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.TWO,
    );
    this.teclaSpawnRobo3 = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.THREE,
    );

    this.map = criarLevel1Parte2Map(this);
    criarAnimacoesPlayer(this);
    criarPlayer(this);
    criarCompanionPet(this);

    this.criarTeleporteRetornoParte1();

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

    this.inimigos = [];
    this.grupoRobosAtivado = false;
    this.inimigoTeste = null;
  }

  update(time, delta) {
    if (this.morteEmAndamento) {
      return;
    }

    atualizarControles(this);
    atualizarStatusPlayer(this, delta);

    if (Phaser.Input.Keyboard.JustDown(this.teclaSpawnRobo1)) {
      criarRobos(this, 1);
    } else if (Phaser.Input.Keyboard.JustDown(this.teclaSpawnRobo2)) {
      criarRobos(this, 2);
    } else if (Phaser.Input.Keyboard.JustDown(this.teclaSpawnRobo3)) {
      criarRobos(this, 3);
    }

    atualizarInimigoTeste(this, time);
    atualizarCompanionPet(this, time, delta);
    atualizarDepthCompanionPet(this);

    const x = Math.round(this.player.x);
    const y = Math.round(this.player.y);

    this.textoCoordenadas.setText("X: " + x + "  Y: " + y);

    if (
      !this.teleporteRetornoLiberado &&
      Phaser.Math.Distance.Between(this.player.x, this.player.y, 97, -995) > 24
    ) {
      this.teleporteRetornoLiberado = true;
    }
  }

  criarTeleporteRetornoParte1() {
    const x = 97;
    const y = -995;
    const largura = 16;
    const altura = 8;

    this.teleporteRetornoParte1 = this.add.zone(x, y, largura, altura);

    this.physics.world.enable(
      this.teleporteRetornoParte1,
      Phaser.Physics.Arcade.STATIC_BODY,
    );
    this.teleporteRetornoParte1.body.setSize(largura, altura);

    this.physics.add.overlap(this.player, this.teleporteRetornoParte1, () => {
      if (
        this.transicaoRetornoEmAndamento ||
        (!this.teleporteRetornoLiberado &&
          (this.player.body?.velocity?.y ?? 0) >= 0)
      ) {
        return;
      }

      this.transicaoRetornoEmAndamento = true;
      this.physics.pause();
      this.cameras.main.fadeOut(250, 0, 0, 0);

      this.cameras.main.once("camerafadeoutcomplete", () => {
        limparGrupoRobos(this);
        this.scene.start("Level1", {
          spawnX: 72,
          spawnY: -2160,
          portaAberta: true,
          transicao: true,
          personagem: this.personagemSelecionada,
        });
      });
    });
  }
}

export default Level1Parte2;
