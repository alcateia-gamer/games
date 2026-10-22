/**
 * @file Disparos dos robôs e dano ao jogador. Trata recarga, impactos contra cenário,
 * invulnerabilidade temporária e tela de morte.
 */

import mostrarTelaMorte from "../scenes/DeathScreen.js";
import { tomarDano } from "../player/PlayerStatus.js";
import { tocarSomTiroLaser } from "../sounds/inimigos.js";
import { obterFilhosGrupoSeguro } from "./EnemyPathfinding.js";

// =====================================================
// CONFIGURAÇÃO DO EFEITO VISUAL DE DANO
// =====================================================

// Vermelho mais forte, mantendo os detalhes do personagem.
const COR_DANO_PLAYER = 0xff4040;

/**
 * Verifica o intervalo mínimo de disparo e cria um laser quando o inimigo está pronto.
 */
function tentarDispararLaser(scene, time, inimigo = scene.inimigoTeste) {
  if (!inimigo || !inimigo.active) {
    return;
  }

  if (time < inimigo.ultimoTiro + inimigo.tempoEntreTiros) {
    return;
  }

  inimigo.ultimoTiro = time;
  dispararLaser(scene, inimigo);
}

// =====================================================
// DISPARA LASER
// =====================================================

/**
 * Cria um laser na direção do alvo com som, velocidade e duração limitada, notificando dano
 * remoto pelo host.
 */
function dispararLaser(scene, inimigo = scene.inimigoTeste) {
  const alvo = inimigo?.alvoAtual || scene.player;
  if (!inimigo || !inimigo.active || !alvo || alvo.active === false) {
    return;
  }
  inimigo.networkAttackId = (inimigo.networkAttackId || 0) + 1;

  const angulo = Phaser.Math.Angle.Between(
    inimigo.x,
    inimigo.y,
    alvo.x,
    alvo.y,
  );

  const lado = inimigo.ultimoLadoTiro === "right" ? "right" : "left";
  inimigo.ultimoLadoTiro = lado === "right" ? "left" : "right";

  const offsetX = (lado === "right" ? 26 : -26) - 10;
  const offsetY = 12;
  const distanciaSaida = 34;

  const laserX = inimigo.x + Math.cos(angulo) * distanciaSaida + offsetX * 0.5;
  const laserY = inimigo.y + Math.sin(angulo) * distanciaSaida + offsetY;

  
const laser = scene.add.circle(laserX, laserY, 4, 0xff0000, 1);

laser.setDepth(55);
laser.setStrokeStyle(2, 0xff8888, 1);

// Identificar o projétil e seu robô de origem.
laser.especialLaserInimigo = true;
laser.especialAtirador = inimigo;
laser.especialRefletido = false;
laser.danoEspecial = 0;

  scene.physics.add.existing(laser);
  laser.body.setAllowGravity(false);
  if (!scene.lasersInimigo?.add) {
    laser.destroy();
    return;
  }
  scene.lasersInimigo.add(laser);

  tocarSomTiroLaser(scene);

  scene.physics.velocityFromRotation(
    angulo,
    inimigo.velocidadeLaser + 30,
    laser.body.velocity,
  );

  scene.time.delayedCall(2000, () => {
    if (laser && laser.active) {
      laser.destroy();
    }
  });

  if (scene.multiplayer && scene.isMultiplayerHost && alvo.id) {
    scene.time.delayedCall(220, () => {
      scene.multiplayerManager?.publishPlayerDamage(alvo.id, inimigo.danoLaser);
    });
  }
}

// =====================================================
// VERIFICA LASERS NA HITBOX DE DANO
// =====================================================

/**
 * Destrói os lasers cujos limites visuais cruzam os corpos de colisão do mapa.
 */
function verificarLasersNoMapa(scene) {
  if (
    !scene?.collisionGroup?.getChildren ||
    !scene?.lasersInimigo?.getChildren
  ) {
    return;
  }

  const blocos = obterFilhosGrupoSeguro(scene.collisionGroup);
  const lasers = obterFilhosGrupoSeguro(scene.lasersInimigo);

  if (blocos.length === 0 || lasers.length === 0) {
    return;
  }

  
for (const laser of lasers) {
  if (!laser || !laser.active) {
    continue;
  }

  // Laser refletido não causa dano ao jogador.
  // O sistema especial verifica colisão com robôs.
  if (laser.especialRefletido) {
    continue;
  }

  // Kai pode bloquear ou refletir o laser.
  // Nyx pode destruir o projétil.
  if (scene.tentarInterceptarLaserEspecial?.(laser)) {
    continue;
  }

  // Holograma da Aria pode receber o disparo.
  if (scene.acertarHologramaEspecial?.(laser)) {
    continue;
  }

  // Verificação original de dano ao jogador.
  const boundsLaser = laser.getBounds();

  for (const bloco of blocos) {
    if (!bloco || !bloco.body) {
      continue;
    }

    const rectBloco = new Phaser.Geom.Rectangle(
      bloco.body.x,
      bloco.body.y,
      bloco.body.width,
      bloco.body.height,
    );

    if (Phaser.Geom.Intersects.RectangleToRectangle(rectBloco, boundsLaser)) {
      laser.destroy();
      break;
    }
  }
}
}

/**
 * Testa os lasers ativos contra a área de dano do jogador.
 */
function verificarLasersNoPlayer(scene) {
  if (!scene.hitboxDanoPlayer || !scene.lasersInimigo) {
    return;
  }

  const lasers = obterFilhosGrupoSeguro(scene.lasersInimigo);

  for (const laser of lasers) {
    if (!laser || !laser.active) {
      continue;
    }

    const boundsLaser = laser.getBounds();
    const acertou = Phaser.Geom.Intersects.RectangleToRectangle(
      scene.hitboxDanoPlayer,
      boundsLaser,
    );

    if (acertou) {
      acertarPlayerComLaser(scene, laser);
    }
  }
}

// =====================================================
// LASER ACERTA PLAYER
// =====================================================

/**
 * Remove o laser que atingiu o jogador e encaminha o valor de dano ao tratamento de impacto.
 */
function acertarPlayerComLaser(scene, laser) {
  if (!laser || !laser.active) {
    return;
  }

  // Preserva a direção de chegada antes de destruir o corpo do projétil.
  const velocidade = laser.body?.velocity;
  const atacante =
    velocidade && (velocidade.x !== 0 || velocidade.y !== 0)
      ? {
          x: scene.player.x - velocidade.x,
          y: scene.player.y - velocidade.y,
        }
      : { x: laser.x, y: laser.y };
  laser.destroy();

  const danoLaser =
    Array.isArray(scene.inimigos) && scene.inimigos.length > 0
      ? scene.inimigos[0].danoLaser
      : (scene.inimigoTeste?.danoLaser ?? 5);
  causarDanoPlayer(scene, danoLaser, atacante);
}

/**
 * Aplica dano uma vez por janela de invulnerabilidade, mostra o efeito vermelho e abre a tela
 * de morte se a vida zerou.
 */
function causarDanoPlayer(scene, dano, atacante = null) {
  if (
    scene.morteEmAndamento ||
    !scene.player?.active ||
    scene.player.invulneravel
  ) {
    return;
  }

  scene.player.invulneravel = true;
  tomarDano(scene, dano, atacante);

  // Efeito vermelho mais intenso sem esconder a textura.
  scene.player.setTint(COR_DANO_PLAYER);
  scene.player.setTintMode(Phaser.TintModes.MULTIPLY);

  scene.time.delayedCall(500, () => {
    if (scene.player && scene.player.active) {
      scene.player.invulneravel = false;
      scene.player.clearTint();
    }
  });

  if (scene.vida <= 0) {
    mostrarTelaMorte(scene);
  }
}

// =====================================================
// RESPAWN DO PLAYER
// =====================================================

/**
 * Restaura posição, área de dano, vida e estamina do jogador no ponto de respawn.
 */
function respawnPlayerPorLaser(scene) {
  scene.player.setVelocity(0, 0);
  scene.player.setPosition(scene.respawnX, scene.respawnY);

  if (scene.hitboxDanoPlayer) {
    const largura = 38;
    const altura = 46;
    const baseY = scene.respawnY + 26;

    scene.hitboxDanoPlayer.setTo(
      scene.respawnX - largura / 2,
      baseY - altura,
      largura,
      altura,
    );
  }

  scene.vida = scene.vidaMaxima;
  scene.estamina = scene.estaminaMaxima;
  scene.player.invulneravel = false;
}

// =====================================================
// DANO NO INIMIGO
// =====================================================

export {
  tentarDispararLaser,
  verificarLasersNoMapa,
  verificarLasersNoPlayer,
  causarDanoPlayer,
};
