/**
 * @file Flechas da Aria: criação, movimento por delta, alcance, colisão com o mapa e dano a
 * inimigos ou boss.
 */

import { causarDanoInimigo } from "../enemies/EnemyTest.js";
import { causarDanoBoss } from "../enemies/BossFinal.js";

const DIRECOES_PROJETIL = {
  // arcoX/arcoY marcam a saída da corda no frame de ataque de 64×64.
  up: { x: 0, y: -1, frame: 0, arcoX: 29, arcoY: 16 },
  left: { x: -1, y: 0, frame: 1, arcoX: 28, arcoY: 28 },
  right: { x: 1, y: 0, frame: 2, arcoX: 36, arcoY: 28 },
  down: { x: 0, y: 1, frame: 3, arcoX: 29, arcoY: 44 },
};

const VELOCIDADE_PROJETIL = 420;
const ALCANCE_MAXIMO_PROJETIL = 1800;
const DANO_PROJETIL_ARIA = 25;

/**
 * Converte um vetor em direção unitária preservando o frame; retorna null para um vetor sem
 * comprimento.
 */
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

/**
 * Marca o projétil como resolvido e o destrói somente se ainda estiver ativo.
 */
function destruirProjetil(projetil) {
  if (!projetil?.active) {
    return;
  }

  projetil.acertou = true;
  projetil.destroy();
}

/**
 * Cria o grupo físico de projéteis quando não há um grupo válido na cena.
 */
function criarSistemaProjeteis(scene) {
  if (
    !scene.projeteisPlayer?.active ||
    !scene.projeteisPlayer.children?.entries
  ) {
    scene.projeteisPlayer = scene.physics.add.group();
  }
}

/**
 * Identifica qual dos dois objetos recebidos em uma colisão é o projétil do jogador.
 */
function encontrarProjetil(primeiro, segundo) {
  if (primeiro?.projetilPlayer) {
    return primeiro;
  }
  if (segundo?.projetilPlayer) {
    return segundo;
  }
  return null;
}

/**
 * Cria a flecha com hitbox orientada, ID de rede, colisão com obstáculos e limite de duração
 * por alcance.
 */
function dispararProjetil(scene) {
  const direcaoBase =
    DIRECOES_PROJETIL[scene.direcaoAtaque ?? scene.direcaoAtual];
  const direcao = direcaoBase ? normalizarDirecao(direcaoBase) : null;

  if (!scene.player?.active || !direcao) {
    return;
  }

  criarSistemaProjeteis(scene);

  // A flecha mede 32 pixels: sua cauda começa na corda do arco.
  // Usa a origem atual da Aria também quando ela muda de direção durante a carga.
  const origemX = scene.player.x + direcaoBase.arcoX - scene.player.displayOriginX + direcao.x * 16;
  const origemY = scene.player.y + direcaoBase.arcoY - scene.player.displayOriginY + direcao.y * 16;
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
  const larguraHitbox = projetilHorizontal ? 32 : 6;
  const alturaHitbox = projetilHorizontal ? 6 : 32;
  projetil.body.setSize(larguraHitbox, alturaHitbox, true);
  projetil.body.setOffset(
    (64 - larguraHitbox) / 2,
    (64 - alturaHitbox) / 2,
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

/**
 * Avança as flechas com delta em milissegundos e aplica dano ao primeiro boss ou inimigo
 * atingido.
 */
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
