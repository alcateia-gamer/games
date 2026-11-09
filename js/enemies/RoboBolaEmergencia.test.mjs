import test from "node:test";
import assert from "node:assert/strict";
import { iniciarEmergenciaRoboBola, atualizarEmergenciaRoboBola } from "./RoboBolaEmergencia.js";

function preparar(direcao) {
  const robo = { x: 100, y: 100, active: true, scaleX: 0.56, scaleY: 0.56,
    body: { x: 83.2, y: 83.2, width: 33.6, height: 33.6, velocity: { x: 0, y: 0 } },
    setAlpha(alpha) { this.alpha = alpha; },
    setVelocity(x, y) { this.body.velocity = { x, y }; },
  };
  robo.barraVida = { setAlpha(alpha) { this.alpha = alpha; } };
  iniciarEmergenciaRoboBola(robo, direcao);
  return { robo, scene: {} };
}

test("sai para dentro da arena em ambos os lados, sem saltar ou redimensionar a colisão", () => {
  for (const direcao of [1, -1]) {
    const { robo, scene } = preparar(direcao);
    assert.equal(robo.alpha, 0);
    assert.equal(robo.direcaoAtual, direcao === 1 ? "right" : "left");
    for (let i = 0; i < 30; i++) {
      const x = robo.x;
      assert.equal(atualizarEmergenciaRoboBola(scene, robo, 20), true);
      assert.equal(robo.x, x, "a animação só define velocidade; quem move o corpo é a física");
      const v = robo.body.velocity;
      assert.ok(Math.hypot(v.x, v.y) <= 100);
      robo.x += v.x * 0.02;
      robo.y += v.y * 0.02;
      robo.body.x = robo.x - 16.8;
      robo.body.y = robo.y - 16.8;
    }
    assert.ok((robo.x - 100) * direcao > 40);
    assert.ok((robo.x - 100) * direcao <= 48);
    assert.equal(robo.alpha, 1);
    assert.equal(robo.barraVida.alpha, 1);
    assert.equal(robo.emergenciaPortal, null);
    assert.equal(robo.body.width, 33.6);
    assert.equal(robo.scaleX, 0.56);
    assert.equal(atualizarEmergenciaRoboBola(scene, robo, 20), false);
  }
});

test("nova colisão bloqueia a saída sem teletransportar para o outro lado", () => {
  const { robo, scene } = preparar(1);
  scene.collisionGroup = { getChildren: () => [{ body: { x: 125, y: 50, width: 20, height: 100 } }] };
  for (let i = 0; i < 30; i++) atualizarEmergenciaRoboBola(scene, robo, 20);
  assert.deepEqual(robo.body.velocity, { x: 0, y: 0 });
  assert.equal(robo.x, 100);
  assert.equal(robo.alpha, 1);
  assert.equal(robo.emergenciaPortal, null);
});
