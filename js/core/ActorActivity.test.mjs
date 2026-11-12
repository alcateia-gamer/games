import test from "node:test";
import assert from "node:assert/strict";
import { atorRelevante, atualizarDecisaoAtor, atualizarBarrasDistantes } from "./ActorActivity.js";
const fixture = () => ({ sys: { settings: { key: "Level1Parte2" }, game: { device: { input: { touch: true } } } },
  cameras: { main: { worldView: { x: 0, y: 0, width: 500, height: 300 } } },
  player: { active: true, x: 100, y: 100 }, remotePlayers: new Map() });
test("IA distante roda 4 vezes por segundo no celular e mantém a velocidade física", () => {
  const scene = fixture(), robo = { x: 3000, y: 0, body: { velocity: { x: 50, y: 0 } } };
  let decisoes = 0;
  for (let time = 0; time < 1000; time += 10) if (atualizarDecisaoAtor(scene, robo, time)) decisoes++;
  assert.equal(decisoes, 4);
  assert.deepEqual(robo.body.velocity, { x: 50, y: 0 });
});
test("voltar à câmera ou aproximar aliado retoma IA imediatamente", () => {
  const scene = fixture(), robo = { x: 3000, y: 0 };
  assert.equal(atualizarDecisaoAtor(scene, robo, 0), true);
  assert.equal(atualizarDecisaoAtor(scene, robo, 10), false);
  scene.remotePlayers.set("aliado", { active: true, x: 2900, y: 100 });
  assert.equal(atualizarDecisaoAtor(scene, robo, 20), true);
  assert.equal(atualizarDecisaoAtor(scene, robo, 21), true);
  scene.remotePlayers.clear();
  scene.cameras.main.worldView.x = 2800;
  assert.equal(atualizarDecisaoAtor(scene, robo, 22), true);
});
test("não reduz a simulação da cidade ou de cenas sem câmera configurada", () => {
  const scene = fixture(), robo = { x: 3000, y: 0 };
  scene.sys.settings.key = "Level1";
  assert.equal(atorRelevante(scene, robo), true);
  scene.sys.settings.key = "Level1Parte2";
  delete scene.cameras;
  assert.equal(atorRelevante(scene, robo), true);
});
test("barras distantes somem e restauram a visibilidade original ao retornar", () => {
  const barra = visible => ({ active: true, visible, setVisible(value) { this.visible = value; } });
  const robo = { fundoVida: barra(true), barraVida: barra(false), bordaVida: barra(true) };
  atualizarBarrasDistantes(robo, false);
  atualizarBarrasDistantes(robo, false);
  assert.equal(robo.fundoVida.visible, false);
  atualizarBarrasDistantes(robo, true);
  assert.equal(robo.fundoVida.visible, true);
  assert.equal(robo.barraVida.visible, false);
});
