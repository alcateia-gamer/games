/**
 * @file Efeitos de impacto do combate: partículas, flash, recuo, deformação, pausa breve e
 * tremor. Os efeitos coordenados são aplicados no modo solo.
 */

const COMBAT_FEEL = {
  inputBufferMs: 100,
  hitFlashDuration: 55,
  hitStopDuration: 40,
  shakeDuration: 55,
  shakeIntensity: 0.002,
  knockback: 110,
  knockbackDuration: 90,
  playerKnockback: 35,
  playerKnockbackDuration: 30,
  particles: {
    quantity: 6,
    lifespan: 190,
    speedMin: 35,
    speedMax: 105,
  },
  squash: {
    duration: 100,
    impactScaleX: 0.86,
    impactScaleY: 1.12,
  },
};

const COMBAT_FEEL_DEBUG = false;

/**
 * Indica se a cena executa uma partida solo, condição usada pelos efeitos de combate.
 */
function isSoloMode(scene) {
  return scene?.multiplayer !== true;
}

/**
 * Escreve diagnósticos de combate apenas quando a configuração de depuração está ativa.
 */
function debugCombat(message, data) {
  if (COMBAT_FEEL_DEBUG) {
    console.debug(`[COMBAT] ${message}`, data ?? "");
  }
}

/**
 * Aplica um flash branco temporário e restaura a cor se o inimigo ainda existir.
 */
function playHitFlash(enemy, duration = COMBAT_FEEL.hitFlashDuration) {
  if (!enemy?.active || !enemy.scene) {
    return;
  }

  enemy.setTint?.(0xffffff).setTintMode(Phaser.TintModes.FILL);
  enemy.scene.time.delayedCall(duration, () => {
    if (enemy.active) {
      enemy.clearTint();
    }
  });
}

/**
 * Cria pequenos fragmentos que se afastam do impacto e são destruídos ao terminar a animação.
 */
function spawnHitParticles(scene, enemy, quantity = COMBAT_FEEL.particles.quantity) {
  if (!scene?.add || !enemy?.active) {
    return;
  }

  const { lifespan, speedMin, speedMax } = COMBAT_FEEL.particles;
  const particleDepth = (enemy.depth ?? 0) + 1;

  for (let index = 0; index < quantity; index += 1) {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const speed = Phaser.Math.Between(speedMin, speedMax);
    const particle = scene.add
      .rectangle(enemy.x, enemy.y - 20, 4, 4, 0xffd166, 1)
      .setDepth(particleDepth)
      .setRotation(angle);

    scene.tweens.add({
      targets: particle,
      x: enemy.x + Math.cos(angle) * speed * (lifespan / 1000),
      y: enemy.y - 20 + Math.sin(angle) * speed * (lifespan / 1000),
      alpha: 0,
      scaleX: 0.25,
      scaleY: 0.25,
      duration: lifespan,
      ease: "Cubic.easeOut",
      onComplete: () => particle.destroy(),
    });
  }

  debugCombat("PARTICLES", quantity);
}

/**
 * Prolonga a pausa breve de combate sem somar pausas menores; não altera o multiplayer.
 */
function applyHitStop(scene, duration = COMBAT_FEEL.hitStopDuration) {
  if (!isSoloMode(scene)) {
    return;
  }

  scene.combatHitStopRemaining = Math.max(
    scene.combatHitStopRemaining ?? 0,
    duration,
  );
  debugCombat("HIT STOP", `${duration}ms`);
}

/**
 * Aplica um tremor curto na câmera, limitando sua intensidade conforme o dano recebido.
 */
function applyCombatShake(
  scene,
  damage,
  duration = COMBAT_FEEL.shakeDuration,
) {
  if (!isSoloMode(scene) || !scene.cameras?.main) {
    return;
  }

  const intensity = Phaser.Math.Clamp(
    damage * 0.0001,
    0.001,
    COMBAT_FEEL.shakeIntensity,
  );
  scene.cameras.main.shake(duration, intensity);
  debugCombat("SHAKE", { duration, intensity });
}

/**
 * Empurra o alvo para longe do atacante e marca o intervalo em que o movimento deve
 * preservar esse impulso.
 */
function applyKnockback(
  scene,
  attacker,
  enemy,
  force = COMBAT_FEEL.knockback,
  duration = COMBAT_FEEL.knockbackDuration,
) {
  if (!isSoloMode(scene) || !enemy?.active || !enemy.body || !attacker) {
    return;
  }

  const angle = Phaser.Math.Angle.Between(
    attacker.x,
    attacker.y,
    enemy.x,
    enemy.y,
  );
  enemy.body.setVelocity(Math.cos(angle) * force, Math.sin(angle) * force);
  enemy.combatKnockbackUntil = scene.time.now + duration;
  debugCombat("KNOCKBACK", force);
}

/**
 * Aplica tremor e pausa de impacto ao jogador, com recuo mais leve e breve.
 */
function playPlayerHitEffects(scene, attacker, damage) {
  const player = scene.player;
  if (!isSoloMode(scene) || !player?.active) {
    return;
  }

  applyKnockback(
    scene,
    attacker,
    player,
    COMBAT_FEEL.playerKnockback,
    COMBAT_FEEL.playerKnockbackDuration,
  );
  if (player.combatKnockbackUntil > scene.time.now && scene.estadoDash) {
    scene.estadoDash.ativo = false;
  }
  applyHitStop(scene);
  applyCombatShake(scene, damage);
}

/**
 * Deforma temporariamente a escala do inimigo e anima o retorno à proporção original.
 */
function applySquash(enemy) {
  if (!enemy?.active || !enemy.scene) {
    return;
  }

  const baseScaleX = enemy.baseScaleX ?? enemy.scaleX;
  const baseScaleY = enemy.baseScaleY ?? enemy.scaleY;
  enemy.baseScaleX = baseScaleX;
  enemy.baseScaleY = baseScaleY;
  enemy.scene.tweens.killTweensOf(enemy);
  enemy.setScale(
    baseScaleX * COMBAT_FEEL.squash.impactScaleX,
    baseScaleY * COMBAT_FEEL.squash.impactScaleY,
  );
  enemy.scene.tweens.add({
    targets: enemy,
    scaleX: baseScaleX,
    scaleY: baseScaleY,
    duration: COMBAT_FEEL.squash.duration,
    ease: "Back.Out",
  });
}

/**
 * Toca o som de impacto disponível no cache durante o modo solo.
 */
function playHitSound(scene) {
  if (!isSoloMode(scene) || !scene.sound?.play) {
    return;
  }

  if (scene.cache?.audio?.exists("katana-ataque")) {
    scene.sound.play("katana-ataque", { volume: 0.15 });
  }
}

/**
 * Emite partículas extras e tremor de câmera para destacar a derrota de um inimigo.
 */
function playDeathEffect(scene, enemy) {
  if (!isSoloMode(scene) || !enemy?.active) {
    return;
  }

  spawnHitParticles(scene, enemy, 8);
  applyCombatShake(scene, 25, 70);
}

/**
 * Coordena os efeitos de um acerto e, se a vida chegou a zero, acrescenta o efeito de derrota.
 */
function playHitEffects(scene, attacker, enemy, damage, options = {}) {
  if (!isSoloMode(scene) || !enemy?.active) {
    return;
  }

  playHitFlash(enemy);
  spawnHitParticles(scene, enemy, options.particles ?? COMBAT_FEEL.particles.quantity);
  applyKnockback(scene, attacker, enemy, options.knockback ?? COMBAT_FEEL.knockback);
  applySquash(enemy);
  applyHitStop(scene, options.hitStop ?? COMBAT_FEEL.hitStopDuration);
  applyCombatShake(scene, damage, options.shakeDuration ?? COMBAT_FEEL.shakeDuration);
  if (options.playSound) {
    playHitSound(scene);
  }

  if (enemy.vida <= 0) {
    playDeathEffect(scene, enemy);
  }

  debugCombat("HIT", { damage });
}

export {
  COMBAT_FEEL,
  isSoloMode,
  playHitEffects,
  playPlayerHitEffects,
  playHitFlash,
  spawnHitParticles,
  applyHitStop,
  applyCombatShake,
  applyKnockback,
  applySquash,
  playHitSound,
  playDeathEffect,
};
