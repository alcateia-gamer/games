import test from "node:test";
import assert from "node:assert/strict";
import { atualizarPoseLanterna } from "./FlashlightPose.js";

function cena() {
  return { direcaoAtual: "down", player: {
    x: 200, y: 300, scaleX: 1, scaleY: 1, displayOriginX: 64, displayOriginY: 64,
    texture: { key: "walk" }, frame: { name: 18 }, body: { velocity: { x: 0, y: 0 } },
  } };
}

test("barriga permanece centralizada em cada pose cardinal e mantém o feixe nas oito direções ao parar", () => {
  for (const [direcao, frame, barriga] of [
    ["up", 0, [0, 10]], ["left", 9, [0, 10]],
    ["down", 18, [0, 10]], ["right", 27, [0, 10]],
  ]) {
    for (const [vx, vy] of [[0,-100], [100,-100], [100,0], [100,100],
      [0,100], [-100,100], [-100,0], [-100,-100]]) {
      const scene = cena();
      scene.direcaoAtual = direcao;
      scene.player.frame.name = frame;
      Object.assign(scene.player.body.velocity, { x: vx, y: vy });
      const pose = atualizarPoseLanterna(scene, {});
      assert.deepEqual([pose.x, pose.y], [200 + barriga[0], 300 + barriga[1]],
        "a origem fica no centro da barriga em todas as direções");
      assert.equal(pose.angulo, Math.atan2(vy, vx));
      Object.assign(scene.player.body.velocity, { x: 0, y: 0 });
      assert.equal(atualizarPoseLanterna(scene, pose), pose);
      assert.equal(pose.angulo, Math.atan2(vy, vx), "soltar o controle preserva a direção");
    }
  }
});

test("a barriga mantém a origem durante a animação e respeita a transformação do sprite", () => {
  const scene = cena();
  const pose = atualizarPoseLanterna(scene, {});
  scene.player.frame.name = 21;
  atualizarPoseLanterna(scene, pose);
  assert.deepEqual([pose.x, pose.y], [200, 310]);
  Object.assign(scene.player, { x: -120, y: -900, displayOriginX: 60, displayOriginY: 70,
    scaleX: 2, scaleY: 3, flipX: true, flipY: true, rotation: Math.PI / 2 });
  atualizarPoseLanterna(scene, pose);
  // Barriga (64,74); espelhada (64,54); relativa à origem (4,-16).
  assert.ok(Math.abs(pose.x - (-72)) < 1e-10);
  assert.ok(Math.abs(pose.y - (-892)) < 1e-10);
});

test("cada personagem usa as coordenadas da própria folha e os testes respeitam flipX", () => {
  for (const [textura, frame, tamanho, origemY, escala, esperado] of [
    ["walk", 18, 128, 64, 1, [0,10]],
    ["personagem2-walk", 18, 64, 32, 1, [0,8]],
    ["personagem3-walk", 18, 128, 68, 1, [0,9]],
    ["personagem4-walk", 18, 64, 32, 1, [0,6]],
    ["personagem-teste-idle", 0, 240, 136.5, 64/240, [0, (190-136.5)*64/240]],
    ["personagem-teste-2-idle", 0, 240, 130.5, 64/240, [0,17.2]],
    ["personagem-teste-2-walk", 0, 240, 130.5, 64/240, [0,17.2]],
  ]) {
    const scene = cena();
    Object.assign(scene.player, { texture: { key: textura }, frame: { name: frame },
      displayOriginX: tamanho/2, displayOriginY: origemY, scaleX: escala, scaleY: escala });
    const pose = atualizarPoseLanterna(scene, {});
    assert.ok(Math.abs(pose.x - 200 - esperado[0]) < 1e-10, textura);
    assert.ok(Math.abs(pose.y - 300 - esperado[1]) < 1e-10, textura);
    scene.player.flipX = true;
    atualizarPoseLanterna(scene, pose);
    assert.ok(Math.abs(pose.x - 200 + esperado[0]) < 1e-10, textura);
  }
});

test("mudança de direção parado atualiza a mira e ataques não usam o centro da textura", () => {
  const scene = cena();
  const pose = atualizarPoseLanterna(scene, {});
  scene.direcaoAtual = "up";
  atualizarPoseLanterna(scene, pose);
  assert.equal(pose.angulo, -Math.PI/2);
  Object.assign(scene.player, { texture: { key: "attack" }, displayOriginX: 80, displayOriginY: 55 });
  scene.direcaoAtaque = "left";
  atualizarPoseLanterna(scene, pose);
  assert.deepEqual([pose.x, pose.y], [200, 310]);
});
