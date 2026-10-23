/**
 * @file Flechas da Aria: criação, movimento por delta, alcance, colisão com o mapa e dano a
 * inimigos ou boss.
 */

import { causarDanoInimigo } from "../enemies/EnemyTest.js";
import { causarDanoBoss } from "../enemies/BossFinal.js";
import { tempoImpactoFlecha, obstaculosFlecha } from "./ArrowCollision.js";

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
 * Converte um vetor em direção unitária; retorna null para um vetor sem
 * comprimento.
 */
function normalizarDirecao(direcao) {
  const magnitude = Math.hypot(direcao.x, direcao.y);

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return null;
  }

  return {
    x: direcao.x / magnitude,
    y: direcao.y / magnitude,
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
 * Cria a flecha com hitbox orientada, ID de rede, colisão com obstáculos e limite de duração
 * por alcance.
 */
function dispararProjetil(scene, opcoes = {}) {
  const direcaoBase =
    DIRECOES_PROJETIL[scene.direcaoAtaque ?? scene.direcaoAtual];
  const direcao = direcaoBase ? normalizarDirecao(opcoes.direction ?? direcaoBase) : null;

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
    direcaoBase.frame,
  );

  projetil.setOrigin(0.5, 0.5);
  projetil.setDepth(scene.player.depth + 0.1);
  projetil.projetilPlayer = true;
  scene.networkProjectileId = (scene.networkProjectileId || 0) + 1;
  projetil.networkId = `${scene.multiplayerManager?.playerId || "local"}-${scene.networkProjectileId}`;
  projetil.frameProjetil = direcaoBase.frame;
  // Cada frame já aponta para uma cardinal; gira somente a diferença angular.
  if (opcoes.direction) projetil.setRotation(
    Math.atan2(direcao.y, direcao.x) - Math.atan2(direcaoBase.y, direcaoBase.x),
  );
  projetil.acertou = false;
  projetil.direcaoDisparo = { x: direcao.x, y: direcao.y };
  projetil.dano = opcoes.damage ?? DANO_PROJETIL_ARIA;
  projetil.distanciaPercorrida = 0;
  projetil.body.setAllowGravity(false);
  projetil.body.setImmovable(true);
  const projetilHorizontal = direcaoBase.x !== 0;
  const larguraHitbox = projetilHorizontal ? 32 : 6;
  const alturaHitbox = projetilHorizontal ? 6 : 32;
  projetil.body.setSize(larguraHitbox, alturaHitbox, true);
  projetil.body.setOffset(
    (64 - larguraHitbox) / 2,
    (64 - alturaHitbox) / 2,
  );
  const velocidadeProjetil = opcoes.speed ?? scene.velocidadeProjetil ?? VELOCIDADE_PROJETIL;
  projetil.velocidade = velocidadeProjetil;
  projetil.body.setVelocity(0, 0);
  scene.projeteisPlayer.add(projetil);

  // A colisão real é o retângulo orientado varrido, não o corpo Arcade sem rotação.
  return projetil;
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

  // Destruir uma flecha remove sua entrada do grupo; a cópia preserva a atualização das demais.
  grupoProjeteis.getChildren().slice().forEach((projetil) => {
    if (!projetil?.active || projetil.acertou) {
      return;
    }

    const distancia = Math.min(Math.max(0, delta) / 1000 * projetil.velocidade,
      ALCANCE_MAXIMO_PROJETIL - projetil.distanciaPercorrida);
    const inicio = { x: projetil.x, y: projetil.y };
    const fim = {
      x: inicio.x + projetil.direcaoDisparo.x * distancia,
      y: inicio.y + projetil.direcaoDisparo.y * distancia,
    };
    let impacto = null;
    const testar = (retangulo, alvo = null) => {
      if (!retangulo) return;
      const tempo = tempoImpactoFlecha(inicio, fim, projetil.direcaoDisparo, retangulo);
      // Obstáculos são testados primeiro e vencem empates com alvos.
      if (tempo !== null && (!impacto || tempo < impacto.tempo)) impacto = { tempo, alvo };
    };
    for (const corpo of obstaculosFlecha(scene, inicio, fim)) testar(corpo);
    const boss = scene.bossFinal;
    if (boss?.active && !boss.morto) testar(boss.hitboxDano, boss);
    for (const inimigo of inimigos) {
      if (inimigo?.active && !inimigo.morto) testar(inimigo.hitboxDano, inimigo);
    }
    const proporcao = impacto?.tempo ?? 1;
    projetil.x = inicio.x + (fim.x - inicio.x) * proporcao;
    projetil.y = inicio.y + (fim.y - inicio.y) * proporcao;
    projetil.distanciaPercorrida += distancia * proporcao;
    projetil.body.updateFromGameObject();
    if (!impacto) {
      if (projetil.distanciaPercorrida >= ALCANCE_MAXIMO_PROJETIL) destruirProjetil(projetil);
      return;
    }
    if (impacto.alvo === boss && boss) causarDanoBoss(scene, projetil.dano);
    else if (impacto.alvo) causarDanoInimigo(scene, impacto.alvo, projetil.dano, { playSound: true });

    destruirProjetil(projetil);
  });
}

export { criarSistemaProjeteis, dispararProjetil, atualizarProjeteis };
