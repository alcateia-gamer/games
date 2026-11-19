/** Compatibilidade para os robôs-bola que compartilham a proteção física dos inimigos. */
export { limitarPassoInimigo as limitarPassoRoboBola,
  protegerColisaoInimigo as protegerColisaoRoboBola } from "./EnemyCollision.js";

const gruposOndas = new WeakMap();

/** O Arcade consulta a árvore espacial para as colisões entre membros do grupo. */
export function agruparColisaoOndas(scene, robo) {
  let grupo = gruposOndas.get(scene);
  if (!grupo) {
    grupo = scene.physics.add.group({ allowGravity: false });
    gruposOndas.set(scene, grupo);
    const collider = scene.physics.add.collider(grupo, grupo);
    scene.events.once("shutdown", () => {
      gruposOndas.delete(scene);
      if (collider.world) collider.destroy();
      if (grupo.scene) grupo.destroy(false);
    });
  }
  grupo.add(robo);
}
