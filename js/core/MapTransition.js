import { limparGrupoRobos } from "../enemies/EnemyTest.js";

const PORTA_X = 72;
const PORTA_INFERIOR_Y = -2160;
const PORTA_SUPERIOR_Y = PORTA_INFERIOR_Y - 48;
const PONTO_ATIVACAO_X = 72;
const PONTO_ATIVACAO_Y = PORTA_INFERIOR_Y - 24;
const DISTANCIA_ABRIR = 32;
const DISTANCIA_FECHAR = 96;
const COLUNA_PORTA = 4;
const LINHAS_PORTA = [0, 2, 4, 6];

function criarAnimacoesPorta(scene) {
  const textura = scene.textures.get("shopDoor");

  LINHAS_PORTA.forEach((linha, quadro) => {
    if (!textura.frames[`shop-door-top-${quadro}`]) {
      textura.add(
        `shop-door-top-${quadro}`,
        0,
        COLUNA_PORTA * 48,
        linha * 48,
        48,
        48,
      );
    }

    if (!textura.frames[`shop-door-bottom-${quadro}`]) {
      textura.add(
        `shop-door-bottom-${quadro}`,
        0,
        COLUNA_PORTA * 48,
        (linha + 1) * 48,
        48,
        48,
      );
    }
  });

  if (!scene.anims.exists("shop-door-opening")) {
    scene.anims.create({
      key: "shop-door-opening",
      frames: LINHAS_PORTA.map((_, quadro) => ({
        key: "shopDoor",
        frame: `shop-door-top-${quadro}`,
      })),
      duration: 420,
      repeat: 0,
    });
  }

  if (!scene.anims.exists("shop-door-closing")) {
    scene.anims.create({
      key: "shop-door-closing",
      frames: [...LINHAS_PORTA].reverse().map((_, quadro) => ({
        key: "shopDoor",
        frame: `shop-door-top-${3 - quadro}`,
      })),
      duration: 420,
      repeat: 0,
    });
  }

  if (!scene.anims.exists("shop-door-opening-bottom")) {
    scene.anims.create({
      key: "shop-door-opening-bottom",
      frames: LINHAS_PORTA.map((_, quadro) => ({
        key: "shopDoor",
        frame: `shop-door-bottom-${quadro}`,
      })),
      duration: 420,
      repeat: 0,
    });
  }

  if (!scene.anims.exists("shop-door-closing-bottom")) {
    scene.anims.create({
      key: "shop-door-closing-bottom",
      frames: [...LINHAS_PORTA].reverse().map((_, quadro) => ({
        key: "shopDoor",
        frame: `shop-door-bottom-${3 - quadro}`,
      })),
      duration: 420,
      repeat: 0,
    });
  }
}

function iniciarTransicao(scene) {
  if (scene.transicaoEmAndamento) {
    return;
  }

  scene.transicaoEmAndamento = true;
  scene.physics.pause();
  scene.cameras.main.fadeOut(250, 0, 0, 0);

  scene.cameras.main.once("camerafadeoutcomplete", () => {
    limparGrupoRobos(scene);
    scene.scene.start("Level1Parte2", {
      spawnX: 97,
      spawnY: -1028,
      personagem: scene.personagemSelecionada,
    });
  });
}

function criarTransicaoParaParte2(scene) {
  criarAnimacoesPorta(scene);

  scene.portaParte2Superior = scene.add
    .sprite(PORTA_X, PORTA_SUPERIOR_Y, "shopDoor", "shop-door-top-0")
    .setOrigin(0.5, 1)
    .setDepth(11.5);
  scene.portaParte2Inferior = scene.add
    .sprite(PORTA_X, PORTA_INFERIOR_Y, "shopDoor", "shop-door-bottom-0")
    .setOrigin(0.5, 1)
    .setDepth(11.5);

  scene.portaParte2Aberta = false;
  scene.portaParte2Animando = false;
  scene.transicaoEmAndamento = false;
  scene.portaParte2AbertaAoEntrar = scene.portaAbertaAoEntrar === true;

  // O trigger fica sobre o tile inferior da porta.
  scene.entradaFabrica = scene.add.zone(PORTA_X, PORTA_INFERIOR_Y - 24, 40, 48);

  if (scene.portaParte2AbertaAoEntrar) {
    scene.portaParte2Aberta = true;
    scene.portaParte2Superior.setFrame("shop-door-top-3");
    scene.portaParte2Inferior.setFrame("shop-door-bottom-3");
  }

  scene.physics.world.enable(
    scene.entradaFabrica,
    Phaser.Physics.Arcade.STATIC_BODY,
  );
  scene.entradaFabrica.body.setSize(40, 48);

  scene.physics.add.overlap(scene.player, scene.entradaFabrica, () => {
    if (!scene.portaParte2Aberta || scene.portaParte2Animando) {
      return;
    }

    if (
      scene.portaParte2AbertaAoEntrar &&
      (scene.player.body?.velocity?.y ?? 0) >= 0
    ) {
      return;
    }

    iniciarTransicao(scene);
  });
}

function atualizarTransicaoParaParte2(scene) {
  if (
    !scene.portaParte2Superior ||
    scene.transicaoEmAndamento ||
    scene.portaParte2Animando
  ) {
    return;
  }

  const distancia = Phaser.Math.Distance.Between(
    scene.player.x,
    scene.player.y,
    PONTO_ATIVACAO_X,
    PONTO_ATIVACAO_Y,
  );

  if (scene.portaParte2AbertaAoEntrar) {
    if (distancia >= DISTANCIA_FECHAR) {
      scene.portaParte2AbertaAoEntrar = false;
    }
    return;
  }

  if (!scene.portaParte2Aberta && distancia <= DISTANCIA_ABRIR) {
    scene.portaParte2Aberta = true;
    scene.portaParte2Animando = true;
    scene.portaParte2Superior.once("animationcomplete", () => {
      scene.portaParte2Animando = false;
    });
    scene.portaParte2Superior.play("shop-door-opening");
    scene.portaParte2Inferior.play("shop-door-opening-bottom");
  } else if (scene.portaParte2Aberta && distancia >= DISTANCIA_FECHAR) {
    scene.portaParte2Aberta = false;
    scene.portaParte2Animando = true;
    scene.portaParte2Superior.once("animationcomplete", () => {
      scene.portaParte2Animando = false;
    });
    scene.portaParte2Superior.play("shop-door-closing");
    scene.portaParte2Inferior.play("shop-door-closing-bottom");
  }
}

export { atualizarTransicaoParaParte2 };
export default criarTransicaoParaParte2;
