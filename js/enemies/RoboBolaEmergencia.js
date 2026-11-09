/** Saída curta pelo portal: movimento físico, sem tweens nem teletransporte do corpo. */
import { caminhoMovimentoBloqueado } from "./EnemyPathfinding.js";

export const EMERGENCIA_ROBO_BOLA = Object.freeze({ duracaoMs: 600, distancia: 48 });

export function iniciarEmergenciaRoboBola(robo, direcao) {
  robo.emergenciaPortal = { tempo: 0, destino: { x: robo.x + direcao * EMERGENCIA_ROBO_BOLA.distancia, y: robo.y } };
  robo.direcaoAtual = direcao > 0 ? "right" : "left";
  robo.setAlpha(0);
  for (const barra of [robo.fundoVida, robo.barraVida, robo.bordaVida]) barra?.setAlpha(0);
}

export function atualizarEmergenciaRoboBola(scene, robo, delta) {
  const efeito = robo.emergenciaPortal;
  if (!efeito) return false;
  const restante = Math.max(1, EMERGENCIA_ROBO_BOLA.duracaoMs - efeito.tempo);
  efeito.tempo += Math.max(0, Number.isFinite(delta) ? delta : 0);
  const p = Math.min(1, efeito.tempo / EMERGENCIA_ROBO_BOLA.duracaoMs);
  robo.setAlpha(Math.min(1, p * 2));
  for (const barra of [robo.fundoVida, robo.barraVida, robo.bordaVida]) barra?.setAlpha(p);
  if (p >= 1) {
    robo.setVelocity(0, 0);
    robo.emergenciaPortal = null;
    return true;
  }
  const dx = efeito.destino.x - robo.x, dy = efeito.destino.y - robo.y;
  const fator = Math.min(1000 / restante, 100 / Math.max(1, Math.hypot(dx, dy)));
  if (caminhoMovimentoBloqueado(scene, robo, efeito.destino)) robo.setVelocity(0, 0);
  else robo.setVelocity(dx * fator, dy * fator);
  return true;
}
