import { obterBocaMetralhadora, criarMunicaoRobo } from "./WarRobotProjectile.js";
/**
 * Disparos dos robôs e dano ao jogador.
 * Integra Kai, Nyx e holograma sem alterar
 * colisões do mapa.
 */

import mostrarTelaMorte from "../scenes/DeathScreen.js";
import { tomarDano } from "../player/PlayerStatus.js";
import { tocarSomTiroLaser } from "../sounds/inimigos.js";

import { obterFilhosGrupoSeguro } from "./EnemyPathfinding.js";

// =====================================================
// CONFIGURAÇÃO DE DANO
// =====================================================

const COR_DANO_PLAYER = 0xff4040;

// Feixes longos usam seu retângulo orientado. A caixa externa de um disparo
// diagonal ocupa muito espaço vazio e causaria acertos longe da luz visível.
export function laserAtingeRetangulo(laser, rect) {
  if (!laser.comprimentoFeixe) {
    return Phaser.Geom.Intersects.RectangleToRectangle(rect, laser.getBounds());
  }
  const c = Math.cos(laser.rotation), s = Math.sin(laser.rotation);
  const dx = (rect.x + rect.width / 2) - laser.x;
  const dy = (rect.y + rect.height / 2) - laser.y;
  const a = laser.comprimentoFeixe / 2, b = laser.larguraFeixe / 2;
  const w = rect.width / 2, h = rect.height / 2;
  // Teorema dos eixos separadores: dois eixos do mapa e dois do feixe.
  return Math.abs(dx) <= w + Math.abs(c) * a + Math.abs(s) * b &&
    Math.abs(dy) <= h + Math.abs(s) * a + Math.abs(c) * b &&
    Math.abs(dx * c + dy * s) <= a + w * Math.abs(c) + h * Math.abs(s) &&
    Math.abs(-dx * s + dy * c) <= b + w * Math.abs(s) + h * Math.abs(c);
}

// =====================================================
// VERIFICAR RECARGA DO ROBÔ
// =====================================================

function tentarDispararLaser(scene, time, inimigo = scene.inimigoTeste) {
  if (!inimigo?.active) {
    return;
  }

  if (time < inimigo.ultimoTiro + inimigo.tempoEntreTiros) {
    return;
  }

  inimigo.ultimoTiro = time;

  dispararLaser(scene, inimigo);
}

// =====================================================
// DISPARAR LASER
// =====================================================

function dispararLaser(scene, inimigo = scene.inimigoTeste) {
  const alvo = inimigo?.alvoAtual || scene.player;

  if (!inimigo?.active || !alvo || alvo.active === false) {
    return;
  }

  inimigo.networkAttackId = (inimigo.networkAttackId || 0) + 1;

  const boca = obterBocaMetralhadora(inimigo);
  const angulo = Phaser.Math.Angle.Between(boca.x, boca.y, alvo.x, alvo.y);
  const laser = criarMunicaoRobo(scene, boca.x, boca.y, angulo, boca);

  // Identificação para habilidades especiais.
  laser.especialLaserInimigo = true;
  laser.especialAtirador = inimigo;
  laser.danoLaser = inimigo.danoLaser;
  laser.especialRefletido = false;
  laser.danoEspecial = 0;

  scene.physics.add.existing(laser);

  laser.body.setAllowGravity(false);
  laser.body.setCircle(4, 6, 0);

  if (!scene.lasersInimigo?.add) {
    laser.destroy();
    return;
  }

  scene.lasersInimigo.add(laser);

  tocarSomTiroLaser(scene, inimigo);

  scene.physics.velocityFromRotation(
    angulo,
    inimigo.velocidadeLaser + 30,
    laser.body.velocity,
  );

  // Tempo máximo de vida do projétil.
  scene.time.delayedCall(2000, () => {
    if (laser.active) {
      laser.destroy();
    }
  });

  // Preservar sincronização original do multiplayer.
  if (scene.multiplayer && !scene.coopRuntime && scene.isMultiplayerHost && alvo.id) {
    scene.time.delayedCall(220, () => {
      scene.multiplayerManager?.publishPlayerDamage(alvo.id, inimigo.danoLaser);
    });
  }
}

// =====================================================
// COLISÃO DOS LASERS COM O MAPA
// =====================================================

function verificarLasersNoMapa(scene) {
  if (
    !scene?.collisionGroup?.getChildren ||
    !scene?.lasersInimigo?.getChildren
  ) {
    return;
  }

  const blocos = obterFilhosGrupoSeguro(scene.collisionGroup);

  const lasers = obterFilhosGrupoSeguro(scene.lasersInimigo);

  if (!blocos.length || !lasers.length) {
    return;
  }

  for (const laser of lasers) {
    if (!laser?.active) {
      continue;
    }

    for (const bloco of blocos) {
      if (!bloco?.body) {
        continue;
      }

      const rectBloco = new Phaser.Geom.Rectangle(
        bloco.body.x,
        bloco.body.y,
        bloco.body.width,
        bloco.body.height,
      );

      // Refletidos também devem colidir
      // com obstáculos do cenário.
      if (laserAtingeRetangulo(laser, rectBloco)) {
        laser.destroy();
        break;
      }
    }
  }
}

// =====================================================
// COLISÃO DOS LASERS COM O JOGADOR
// =====================================================

function verificarLasersNoPlayer(scene) {
  if (!scene.hitboxDanoPlayer || !scene.lasersInimigo) {
    return;
  }

  const lasers = obterFilhosGrupoSeguro(scene.lasersInimigo);

  for (const laser of lasers) {
    if (!laser?.active) {
      continue;
    }

    // Lasers refletidos pelo Kai não machucam
    // mais o próprio jogador.
    if (laser.especialRefletido) {
      continue;
    }

    // ===============================================
    // KAI - INTERCEPTAÇÃO DO LASER
    // ===============================================

    if (scene.tentarInterceptarLaserEspecial?.(laser)) {
      continue;
    }

    // ===============================================
    // ARIA - HOLOGRAMA RECEBENDO DISPAROS
    // ===============================================

    if (scene.acertarHologramaEspecial?.(laser)) {
      continue;
    }

    // ===============================================
    // COLISÃO ORIGINAL COM O PLAYER
    // ===============================================

    const acertou = laserAtingeRetangulo(laser, scene.hitboxDanoPlayer);

    if (acertou) {
      acertarPlayerComLaser(scene, laser);
    }
  }
}

// =====================================================
// LASER ATINGE O PLAYER
// =====================================================

function acertarPlayerComLaser(scene, laser) {
  if (!laser?.active) {
    return;
  }

  const velocidade = laser.body?.velocity;

  const atacante =
    velocidade && (velocidade.x !== 0 || velocidade.y !== 0)
      ? {
          x: scene.player.x - velocidade.x,
          y: scene.player.y - velocidade.y,
        }
      : {
          x: laser.x,
          y: laser.y,
        };

  laser.destroy();

  const danoLaser = laser.danoLaser ?? laser.especialAtirador?.danoLaser ?? 5;

  causarDanoPlayer(scene, danoLaser, atacante);
}

// =====================================================
// APLICAR DANO AO PLAYER
// =====================================================

function causarDanoPlayer(scene, dano, atacante = null) {
  if (scene.coopRemotePlayerId && scene.coopRuntime) return scene.coopRuntime.damage(scene, dano, atacante);
  if (scene.coopParryUntil > (scene.time?.now || 0)) return;
  if (
    scene.morteEmAndamento ||
    !scene.player?.active ||
    scene.player.invulneravel
  ) {
    return;
  }

  // ===============================================
  // KAI - BARREIRA TEMPORÁRIA
  // ===============================================
  //
  // Bloqueia o golpe enquanto a esfera
  // estiver ativa.
  // ===============================================

  if (scene.tentarBloquearDanoEspecial?.(atacante)) {
    return;
  }

  // Sistema de dano original.
  scene.player.invulneravel = true;

  tomarDano(scene, dano, atacante);

  scene.player.setTint(COR_DANO_PLAYER);

  scene.player.setTintMode(Phaser.TintModes.MULTIPLY);

  scene.time.delayedCall(500, () => {
    if (scene.player?.active) {
      scene.player.invulneravel = false;
      scene.player.clearTint();
    }
  });

  if (scene.vida <= 0) {
    mostrarTelaMorte(scene);
  }
}

// =====================================================
// RESPAWN DO JOGADOR
// =====================================================

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
// EXPORTAÇÕES
// =====================================================

export {
  tentarDispararLaser,
  verificarLasersNoMapa,
  verificarLasersNoPlayer,
  causarDanoPlayer,
};
