import { alvosAdicionaisCombate } from "../combat/CombatTargets.js";
import { obstaculosFlecha, tempoImpactoFlecha } from "./ArrowCollision.js";

const ALCANCE_MAXIMO_MIRA = 1800;

function centroAlvo(alvo) {
  const area = alvo.hitboxDano ?? alvo.body;
  if (!area || !Number.isFinite(area.x) || !Number.isFinite(area.y) ||
      !Number.isFinite(area.width) || !Number.isFinite(area.height)) return null;
  return { x: area.x + area.width / 2, y: area.y + area.height / 2 };
}

/** Mira no inimigo válido mais próximo que não esteja atrás de um obstáculo. */
export function obterDirecaoMiraAutomaticaAria(scene) {
  const jogador = scene.player;
  if (!jogador?.active || !Number.isFinite(jogador.x) || !Number.isFinite(jogador.y)) return null;

  const alvos = [...new Set([
    ...(Array.isArray(scene.inimigos) ? scene.inimigos : []),
    scene.inimigoTeste,
    ...alvosAdicionaisCombate(scene),
  ])].flatMap(alvo => {
    if (!alvo?.active || alvo.visible === false || alvo.morto || alvo.body?.enable === false ||
        (alvo.vida != null && alvo.vida <= 0)) return [];
    const centro = centroAlvo(alvo);
    if (!centro) return [];
    const dx = centro.x - jogador.x, dy = centro.y - jogador.y;
    const distancia = Math.hypot(dx, dy);
    if (!(distancia > 0) || distancia > ALCANCE_MAXIMO_MIRA) return [];
    const direcao = { x: dx / distancia, y: dy / distancia };
    const bloqueado = obstaculosFlecha(scene, jogador, centro, 16).some(corpo => {
      const impacto = tempoImpactoFlecha(jogador, centro, direcao, corpo);
      return impacto !== null && impacto < 1;
    });
    return bloqueado ? [] : [{ direcao, distancia }];
  }).sort((a, b) => a.distancia - b.distancia);

  return alvos[0]?.direcao ?? null;
}
