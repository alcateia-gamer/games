/** Parâmetros exclusivos do arco e do controle da Aria, em pixels lógicos e ms de jogo. */
export const ARIA_ATTACK_CONFIG = Object.freeze({
  centerX: 720, centerY: 350,
  joystickRadius: 55, interactionRadius: 46, thumbRadius: 22, deadZone: 8, maxThumbDistance: 45,
  quickTapThreshold: 180, maxChargeTime: 1200, quickShotCooldown: 250,
  minDamage: 25, maxDamage: 45,
  minProjectileSpeed: 420, maxProjectileSpeed: 600,
  movePenaltyStart: 600, movePenaltyMultiplier: 0.90,
  visualHysteresis: Math.PI / 36,
  aimLineLength: 180,
});

export const ARIA_AIM_DIRECTIONS = Object.freeze({
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
});

/** Interpola o instante entre quadros no relógio do jogo, usando o timestamp nativo do toque. */
export function tempoEntradaAria(scene, pointer) {
  const instante = pointer?.event?.timeStamp;
  const quadro = scene.game?.loop?.now;
  const diferenca = instante - quadro;
  return scene.time.now + (Number.isFinite(diferenca) && Math.abs(diferenca) < 60000
    ? diferenca : 0);
}

export function calcularCargaAria(tempo, config = ARIA_ATTACK_CONFIG) {
  const ratio = tempo <= config.quickTapThreshold ? 0 :
    Math.max(0, Math.min(1, tempo / config.maxChargeTime));
  return {
    ratio,
    damage: config.minDamage + (config.maxDamage - config.minDamage) * ratio,
    speed: config.minProjectileSpeed + (config.maxProjectileSpeed - config.minProjectileSpeed) * ratio,
  };
}

/** Histerese somente no sprite: o vetor físico nunca é arredondado. */
export function direcaoVisualAria(vetor, anterior, config = ARIA_ATTACK_CONFIG) {
  const angulo = Math.atan2(vetor.y, vetor.x);
  const base = ARIA_AIM_DIRECTIONS[anterior];
  if (base) {
    const diferenca = Math.atan2(Math.sin(angulo - Math.atan2(base.y, base.x)),
      Math.cos(angulo - Math.atan2(base.y, base.x)));
    if (Math.abs(diferenca) <= Math.PI / 4 + config.visualHysteresis) return anterior;
  }
  return Math.abs(vetor.x) > Math.abs(vetor.y) ?
    (vetor.x > 0 ? "right" : "left") : (vetor.y > 0 ? "down" : "up");
}
