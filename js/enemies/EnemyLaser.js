import mostrarTelaMorte from "../scenes/DeathScreen.js";
import { tomarDano } from "../player/PlayerStatus.js";
import { tocarSomTiroLaser } from "../sounds/inimigos.js";
import { obterFilhosGrupoSeguro } from "./EnemyPathfinding.js";

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

function dispararLaser(scene, inimigo = scene.inimigoTeste) {
  if (!inimigo || !inimigo.active || !scene.player || !scene.player.active) {
    return;
  }

  const angulo = Phaser.Math.Angle.Between(
    inimigo.x,
    inimigo.y,
    scene.player.x,
    scene.player.y,
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
}

// =====================================================
// VERIFICA LASERS NA HITBOX DE DANO
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

  if (blocos.length === 0 || lasers.length === 0) {
    return;
  }

  for (const laser of lasers) {
    if (!laser || !laser.active) {
      continue;
    }

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

function acertarPlayerComLaser(scene, laser) {
  if (!laser || !laser.active) {
    return;
  }

  if (scene.morteEmAndamento) {
    laser.destroy();
    return;
  }

  laser.destroy();

  if (scene.player.invulneravel) {
    return;
  }

  scene.player.invulneravel = true;

  const danoLaser =
    Array.isArray(scene.inimigos) && scene.inimigos.length > 0
      ? scene.inimigos[0].danoLaser
      : (scene.inimigoTeste?.danoLaser ?? 5);

  tomarDano(scene, danoLaser);

  scene.player.setTint(0xff5555);

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
};
