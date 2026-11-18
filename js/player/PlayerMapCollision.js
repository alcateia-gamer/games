/** Varredura do corpo físico durante o dash, antes da sincronização dos sprites. */
import { limitarPassoInimigo } from '../enemies/EnemyCollision.js';
import { retanguloLivreDoMapa } from '../enemies/EnemyPathfinding.js';

export function protegerDashNoMapa(scene) {
  scene.removerProtecaoDashMapa?.();
  const mundo = scene.physics?.world, player = scene.player;
  if (!mundo?.on || !player?.once) return;
  let removido = false;
  const atualizar = () => {
    const b = player.body, dash = scene.estadoDash;
    if (!player.active || player.morto || scene.morteEmAndamento || !dash?.ativo ||
        !b || b.enable === false || !b.prev || scene.colliderPlayerMapa?.active === false ||
        (scene.developerMode && scene.teclaEspaco?.isDown)) return;
    const inicio = { x: b.prev.x, y: b.prev.y, width: b.width, height: b.height };
    // Não trata teleporte ou uma origem já sobreposta como se fossem um dash livre.
    if (!retanguloLivreDoMapa(scene, inicio)) return;
    // A mesma varredura AABB já protege os robôs; usa as dimensões atuais do jogador.
    const fim = limitarPassoInimigo(scene, { body: b }, inicio, b);
    if (Math.hypot(fim.x - b.x, fim.y - b.y) <= 0.001) return;
    b.x = fim.x; b.y = fim.y; b.updateCenter?.(); b.setVelocity(0, 0);
    dash.ativo = false;
  };
  const remover = () => {
    if (removido) return;
    removido = true;
    mundo.off('worldstep', atualizar);
    player.off('destroy', remover);
    scene.events.off('shutdown', remover);
    if (scene.removerProtecaoDashMapa === remover) scene.removerProtecaoDashMapa = null;
  };
  mundo.on('worldstep', atualizar);
  player.once('destroy', remover);
  scene.events.once('shutdown', remover);
  scene.removerProtecaoDashMapa = remover;
  return remover;
}
