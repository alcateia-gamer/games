import { causarDanoInimigo } from "../enemies/EnemyTest.js";
import { causarDanoBoss } from "../enemies/BossFinal.js";

const DIRECOES_PROJETIL = {
  // x/y definem o movimento; frame escolhe o desenho correspondente na folha da flecha.
  up: { x: 0, y: -1, frame: 0 },
  left: { x: -1, y: 0, frame: 1 },
  right: { x: 1, y: 0, frame: 2 },
  down: { x: 0, y: 1, frame: 3 },
};

const VELOCIDADE_PROJETIL = 420;
const ALCANCE_MAXIMO_PROJETIL = 1800;
const DANO_PROJETIL_ARIA = 25;

function normalizarDirecao(direcao) {
  const magnitude = Math.hypot(direcao.x, direcao.y);

  if (magnitude === 0) {
    return null;
  }

  return {
    x: direcao.x / magnitude,
    y: direcao.y / magnitude,
    frame: direcao.frame,
  };
}

function destruirProjetil(projetil) {
  if (!projetil?.active) {
    return;
  }

  projetil.acertou = true;
  projetil.destroy();
}

function criarSistemaProjeteis(scene) {
  if (
    !scene.projeteisPlayer?.active ||
    !scene.projeteisPlayer.children?.entries
  ) {
    scene.projeteisPlayer = scene.physics.add.group();
  }
}

function encontrarProjetil(primeiro, segundo) {
  if (primeiro?.projetilPlayer) {
    return primeiro;
  }
  if (segundo?.projetilPlayer) {
    return segundo;
  }
  return null;
}

function dispararProjetil(scene) {
  const direcaoBase =
    DIRECOES_PROJETIL[scene.direcaoAtaque ?? scene.direcaoAtual];
  const direcao = direcaoBase ? normalizarDirecao(direcaoBase) : null;

  if (!scene.player?.active || !direcao) {
    return;
  }

  criarSistemaProjeteis(scene);

  const origemX = scene.player.x + direcao.x * 38;
  const origemY = scene.player.y + direcao.y * 38;
  const projetil = scene.physics.add.sprite(
    origemX,
    origemY,
    "aria-arrow",
    direcao.frame,
  );

  projetil.setOrigin(0.5, 0.5);
  projetil.setDepth(scene.player.depth + 0.1);
  projetil.projetilPlayer = true;
  scene.networkProjectileId = (scene.networkProjectileId || 0) + 1;
  projetil.networkId = `${scene.multiplayerManager?.playerId || "local"}-${scene.networkProjectileId}`;
  projetil.frameProjetil = direcao.frame;
  projetil.acertou = false;
  projetil.direcaoDisparo = { x: direcao.x, y: direcao.y };
  projetil.dano = DANO_PROJETIL_ARIA;
  projetil.body.setAllowGravity(false);
  projetil.body.setImmovable(true);
  const projetilHorizontal = direcao.x !== 0;
  const larguraHitbox = projetilHorizontal ? 59 : 8;
  const alturaHitbox = projetilHorizontal ? 8 : 46;
  projetil.body.setSize(larguraHitbox, alturaHitbox, true);
  const deslocamentoX = projetilHorizontal ? -5 : 3;
  const deslocamentoY = projetilHorizontal ? -4 : 0;
  projetil.body.setOffset(
    (64 - larguraHitbox) / 2 + deslocamentoX,
    (64 - alturaHitbox) / 2 + deslocamentoY,
  );
  const velocidadeProjetil = scene.velocidadeProjetil ?? VELOCIDADE_PROJETIL;
  projetil.velocidade = velocidadeProjetil;
  projetil.body.setVelocity(0, 0);
  scene.projeteisPlayer.add(projetil);

  if (scene.collisionGroup) {
    scene.physics.add.collider(
      projetil,
      scene.collisionGroup,
      (primeiro, segundo) => {
        destruirProjetil(encontrarProjetil(primeiro, segundo));
      },
    );
  }

  scene.time.delayedCall(
    (ALCANCE_MAXIMO_PROJETIL / velocidadeProjetil) * 1000,
    () => destruirProjetil(projetil),
  );
}

function atualizarProjeteis(scene, delta = 0) {
  const grupoProjeteis = scene.projeteisPlayer;
  if (!grupoProjeteis?.active || !grupoProjeteis.children?.entries) {
    scene.projeteisPlayer = null;
    return;
  }

  const inimigos = Array.isArray(scene.inimigos) ? scene.inimigos : [];

  grupoProjeteis.getChildren().forEach((projetil) => {
    if (!projetil?.active || projetil.acertou) {
      return;
    }

    const segundos = Math.max(0, delta) / 1000;
    projetil.x += projetil.direcaoDisparo.x * projetil.velocidade * segundos;
    projetil.y += projetil.direcaoDisparo.y * projetil.velocidade * segundos;
    projetil.body.updateFromGameObject();

    const boundsProjetil = new Phaser.Geom.Rectangle(
      projetil.body.x,
      projetil.body.y,
      projetil.body.width,
      projetil.body.height,
    );
    const boss = scene.bossFinal;
    const bossAtingido =
      boss?.active &&
      !boss.morto &&
      Phaser.Geom.Intersects.RectangleToRectangle(
        boundsProjetil,
        boss.hitboxDano,
      );
    const inimigoAtingido = bossAtingido
      ? null
      : inimigos.find(
          (inimigo) =>
            inimigo?.active &&
            !inimigo.morto &&
            inimigo.hitboxDano &&
            Phaser.Geom.Intersects.RectangleToRectangle(
              boundsProjetil,
              inimigo.hitboxDano,
            ),
        );

    if (!bossAtingido && !inimigoAtingido) {
      return;
    }

    if (bossAtingido) {
      causarDanoBoss(scene, projetil.dano);
    } else {
      causarDanoInimigo(scene, inimigoAtingido, projetil.dano, {
        playSound: true,
      });
    }

    destruirProjetil(projetil);
  });
}

export { criarSistemaProjeteis, dispararProjetil, atualizarProjeteis };
