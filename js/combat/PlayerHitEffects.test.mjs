import assert from "node:assert/strict";
import test from "node:test";
import { COMBAT_FEEL } from "./CombatEffects.js";
import { causarDanoPlayer, verificarLasersNoPlayer } from "../enemies/EnemyLaser.js";
import { causarDanoJogador } from "../enemies/bossFinal/BossCombate.js";
import { atualizarMovimento } from "../controls/PlayerMovement.js";
import { iniciarDash } from "../controls/PlayerDashControls.js";

globalThis.Phaser = {
  Math: {
    Angle: { Between: (x, y, a, b) => Math.atan2(b - y, a - x) },
    Clamp: (value, min, max) => Math.min(max, Math.max(min, value)),
  },
  TintModes: { MULTIPLY: 0 },
  Geom: { Intersects: { RectangleToRectangle: () => true } },
};

function criarCena() {
  const velocity = { x: 0, y: 0 };
  const player = {
    active: true, x: 0, y: 0,
    body: { velocity, setVelocity(x, y) { Object.assign(velocity, { x, y }); } },
    setVelocity(x, y) { this.body.setVelocity(x, y); },
    setTint() {}, setTintMode() {}, clearTint() {},
    anims: { stop() {} },
  };
  return {
    player, vida: 100, vidaMaxima: 100,
    time: { now: 100, delayedCall() {} },
    cameras: { main: { shake(...args) { this.lastShake = args; } } },
    events: { emit() {} },
    estadoDash: { ativo: true },
    teclasWASD: Object.fromEntries(
      ["cima", "baixo", "esquerda", "direita"].map(key => [key, { isDown: false }]),
    ),
    joystick: { force: 0 }, threshold: 0.1,
  };
}

test("dano preserva recuo durante os controles, cancela dash e libera movimento ao terminar", () => {
  const scene = criarCena();
  causarDanoPlayer(scene, 10, { x: -50, y: 0 });
  assert.equal(scene.vida, 90);
  assert.equal(scene.player.body.velocity.x, COMBAT_FEEL.playerKnockback);
  assert.equal(scene.estadoDash.ativo, false);
  assert.equal(scene.combatHitStopRemaining, COMBAT_FEEL.hitStopDuration);
  assert.deepEqual(scene.cameras.main.lastShake, [COMBAT_FEEL.shakeDuration, 0.001]);

  scene.time.now += COMBAT_FEEL.playerKnockbackDuration - 1;
  scene.teclasWASD.esquerda.isDown = true;
  atualizarMovimento(scene);
  assert.equal(scene.player.body.velocity.x, COMBAT_FEEL.playerKnockback);
  assert.equal(iniciarDash(scene), false);

  scene.time.now += 1;
  scene.teclasWASD.esquerda.isDown = false;
  atualizarMovimento(scene);
  assert.deepEqual(scene.player.body.velocity, { x: 0, y: 0 });
});

test("invulnerabilidade impede novo dano e novo impulso na direção contrária", () => {
  const scene = criarCena();
  causarDanoPlayer(scene, 10, { x: -50, y: 0 });
  scene.time.now += 10;
  causarDanoPlayer(scene, 10, { x: 50, y: 0 });
  assert.equal(scene.vida, 90);
  assert.equal(scene.player.body.velocity.x, COMBAT_FEEL.playerKnockback);
  assert.equal(scene.player.combatKnockbackUntil, 100 + COMBAT_FEEL.playerKnockbackDuration);
});

test("laser usa a trajetória mesmo quando o projétil já passou do centro do jogador", () => {
  const scene = criarCena();
  const laser = {
    active: true, x: 2, y: 0, body: { velocity: { x: 300, y: 0 } },
    getBounds: () => ({}),
    destroy() { this.active = false; this.body = null; },
  };
  scene.hitboxDanoPlayer = {};
  scene.lasersInimigo = { getChildren: () => [laser] };
  verificarLasersNoPlayer(scene);
  assert.equal(laser.active, false);
  assert.equal(scene.vida, 95);
  assert.equal(scene.player.body.velocity.x, COMBAT_FEEL.playerKnockback);
});

test("golpe do chefe empurra o jogador para longe dele", () => {
  const scene = criarCena();
  assert.equal(causarDanoJogador({ scene, x: 0, y: 50 }, 16), true);
  assert.equal(scene.vida, 84);
  assert.equal(scene.player.body.velocity.y, -COMBAT_FEEL.playerKnockback);
  assert.ok(scene.cameras.main.lastShake);
});

test("modo desenvolvedor mantém a vida e permite conferir o impacto", () => {
  const scene = criarCena();
  scene.developerMode = true;
  causarDanoPlayer(scene, 10, { x: -50, y: 0 });
  assert.equal(scene.vida, 100);
  assert.equal(scene.player.body.velocity.x, COMBAT_FEEL.playerKnockback);
});

test("multiplayer preserva o comportamento anterior sem recuo ou tremor adicionais", () => {
  const scene = criarCena();
  scene.multiplayer = true;
  causarDanoPlayer(scene, 10, { x: -50, y: 0 });
  assert.equal(scene.vida, 90);
  assert.deepEqual(scene.player.body.velocity, { x: 0, y: 0 });
  assert.equal(scene.cameras.main.lastShake, undefined);
  assert.equal(scene.combatHitStopRemaining, undefined);
  assert.equal(scene.estadoDash.ativo, true);
});
/**
 * @file Verifica o impacto no jogador e sua integração com dano, movimento e dash.
 * Os substitutos do Phaser não executam a física ou a renderização reais.
 */

