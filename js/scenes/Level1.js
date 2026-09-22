import criarLevel1Map from "../map/Level1Map.js";

import criarTransicaoParaParte2 from "../core/MapTransition.js";

import criarAnimacoesPlayer from "../player/PlayerAnimations.js";

import {
  criarPlayer,
  respawnPlayer,
  atualizarHitboxDanoPlayer,
  atualizarDepthPlayer,
} from "../player/Player.js";

import {
  criarControles,
  atualizarControles,
} from "../controls/PlayerControls.js";

import {
  criarStatusPlayer,
  atualizarStatusPlayer,
} from "../player/PlayerStatus.js";
import { prepararArqueira } from "../player/archer/Archer.js";

import { criarRobos, atualizarInimigoTeste } from "../enemies/EnemyTest.js";
import { atualizarTransicaoParaParte2 } from "../core/MapTransition.js";

// =====================================================
// LEVEL 1
// =====================================================

class Level1 extends Phaser.Scene {
  constructor() {
    super("Level1");

    this.DEBUG_DEPTH_SORTING = false;

    // =====================================================
    // MOVIMENTO
    // =====================================================

    this.threshold = 0.1;

    this.speed = 200;
    this.speedTurbo = 400;
    this.developerMode = false;

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
    this.respawnX = data.spawnX ?? 99;
    this.respawnY = data.spawnY ?? -2127;
    this.personagemSelecionada = data.personagem || "standard";
    this.portaAbertaAoEntrar = data.portaAberta === true;
    this.entradaComFade = data.transicao === true;
    this.morteEmAndamento = false;
    this.inimigos = [];
    this.grupoRobosAtivado = false;
    this.inimigoTeste = null;
  }

  // =====================================================
  // CREATE
  // =====================================================

  create() {
    this.physics.resume();
    this.physics.world.resume();
    if (this.entradaComFade) {
      this.cameras.main.fadeIn(250, 0, 0, 0);
    }
    this.input.keyboard.enabled = true;
    this.input.keyboard.resetKeys();

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
    prepararArqueira(this);

    this.atualizarProfundidadePostes();

    // =====================================================
    // COLISÃO DO PLAYER COM O MAPA
    // =====================================================

    if (this.collisionGroup) {
      this.physics.add.collider(this.player, this.collisionGroup);
    }

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
    // COMANDOS DE SPAWN DOS ROBÔS
    // =====================================================

    this.inimigos = [];
    this.inimigoTeste = null;
    this.teclaSpawnRobo1 = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.ONE,
    );
    this.teclaSpawnRobo2 = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.TWO,
    );
    this.teclaSpawnRobo3 = this.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.THREE,
    );

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
    if (this.morteEmAndamento) {
      return;
    }

    // =====================================================
    // CONTROLES
    // =====================================================

    atualizarControles(this);

    // =====================================================
    // VIDA E ESTAMINA
    // =====================================================

    atualizarStatusPlayer(this, delta);
    atualizarTransicaoParaParte2(this);

    this.atualizarProfundidadeCerca();
    this.atualizarProfundidadePostes();

    // =====================================================
    // INIMIGO
    // =====================================================

    if (Phaser.Input.Keyboard.JustDown(this.teclaSpawnRobo1)) {
      criarRobos(this, 1);
    } else if (Phaser.Input.Keyboard.JustDown(this.teclaSpawnRobo2)) {
      criarRobos(this, 2);
    } else if (Phaser.Input.Keyboard.JustDown(this.teclaSpawnRobo3)) {
      criarRobos(this, 3);
    }

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
      this.camadaCercaSpawn.setDepth(14);
    }

    if (!this.camadaCercas) {
      if (!this.camadaCercaFabrica) {
        return;
      }
    }

    if (this.player.y >= -207) {
      this.camadaCercas?.setDepth(11);
    } else if (this.player.y <= -225) {
      this.camadaCercas?.setDepth(14);
    } else {
      this.camadaCercas?.setDepth(11);
    }

    if (this.camadaCercaFabrica) {
      if (this.player.y <= -1660) {
        this.camadaCercaFabrica.setDepth(14);
      } else if (this.player.y >= -1646) {
        this.camadaCercaFabrica.setDepth(11);
      } else {
        this.camadaCercaFabrica.setDepth(11);
      }
    }
  }

  atualizarProfundidadePostes() {
    if (!this.player?.active) {
      return;
    }

    atualizarDepthPlayer(this);

    if (Array.isArray(this.poleBaseObjects)) {
      this.poleBaseObjects.forEach((base) => {
        if (!base?.active) {
          return;
        }

        const baseDepth = this.calcularDepthMundo(base.getData("worldY"));

        base.setDepth(baseDepth);
      });
    }

    if (Array.isArray(this.inimigos)) {
      this.inimigos.forEach((inimigo) => {
        if (!inimigo || !inimigo.active) {
          return;
        }

        const footY = inimigo.body?.bottom ?? inimigo.getBounds().bottom;
        inimigo.setDepth(this.calcularDepthMundo(footY));
      });
    }
  }
}

export default Level1;
