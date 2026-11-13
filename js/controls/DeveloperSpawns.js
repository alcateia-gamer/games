/** Os atalhos usam o mesmo spawn do solo, com o host criando os inimigos compartilhados. */
import { criarRobos, criarRoboSerra } from "../enemies/EnemyTest.js";
import { criarRoboOlhao } from "../enemies/RoboOlhao.js";
import { criarRoboBola } from "../enemies/RoboBola.js";

export function executarSpawnDev(scene, tipo, quantidade = 1) {
  if (scene.sys?.settings?.key === "Level1" && !["padrao", "serra"].includes(tipo)) return null;
  if (tipo === "padrao") return criarRobos(scene, quantidade);
  if (tipo === "serra") return criarRoboSerra(scene);
  if (tipo === "olhao") return criarRoboOlhao(scene);
  if (tipo === "bola") return criarRoboBola(scene);
}

export function atualizarSpawnsDev(scene) {
  const pressionada = tecla => Phaser.Input.Keyboard.JustDown(tecla);
  const criar = (tipo, quantidade = 1) => scene.coopRuntime
    ? scene.coopRuntime.manager.sendCoopAction("devSpawn", { tipo, quantidade })
    : (!scene.multiplayer || scene.isMultiplayerHost) && executarSpawnDev(scene, tipo, quantidade);
  if (pressionada(scene.teclaSpawnRobo1)) criar("padrao", 1);
  else if (pressionada(scene.teclaSpawnRobo2)) criar("padrao", 2);
  else if (pressionada(scene.teclaSpawnRobo3)) criar("padrao", 3);
  if (pressionada(scene.teclaSpawnRoboSerra)) criar("serra");
  if (scene.teclaSpawnRoboOlhao && pressionada(scene.teclaSpawnRoboOlhao)) criar("olhao");
  if (pressionada(scene.teclaSpawnRoboBola)) criar("bola");
}
