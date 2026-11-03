/** Deslocamento curto da captura: o tentáculo fica plantado e o jogador vai até ele. */
import { retanguloLivreDoMapa } from "../EnemyPathfinding.js";

function areaNoPonto(scene, ponto) {
  const { player } = scene, body = player.body;
  return { x: body.x + ponto.x - player.x, y: body.y + ponto.y - player.y,
    width: body.width, height: body.height };
}

function areaLivre(scene, area) {
  const encontro = scene.novoBoss, arena = encontro?.config?.arena;
  if (arena && (area.x < arena.xMin || area.y < arena.yMin ||
      area.x + area.width > arena.xMax || area.y + area.height > arena.yMax)) return false;
  if (!retanguloLivreDoMapa(scene, area)) return false;
  const corpos = [...(encontro?.obstaculosTeleporte ?? []), encontro?.sistemaGeradores?.corpoBarreira];
  return !corpos.some(objeto => {
    const b = objeto?.body ?? objeto;
    if (!b || b.enable === false) return false;
    if (b.isCircle) {
      const x = b.x + b.radius, y = b.y + b.radius;
      const dx = x - Math.max(area.x, Math.min(x, area.x + area.width));
      const dy = y - Math.max(area.y, Math.min(y, area.y + area.height));
      return dx * dx + dy * dy < b.radius * b.radius;
    }
    return area.x < b.x + b.width && area.x + area.width > b.x &&
      area.y < b.y + b.height && area.y + area.height > b.y;
  });
}

function trajetoLivre(scene, destino) {
  const player = scene.player;
  const dx = destino.x - player.x, dy = destino.y - player.y;
  const passos = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 4));
  for (let i = 1; i <= passos; i++) {
    if (!areaLivre(scene, areaNoPonto(scene, {
      x: player.x + dx * i / passos, y: player.y + dy * i / passos,
    }))) return false;
  }
  return true;
}

export function criarPuxaoNovoBoss(scene, ponto) {
  const player = scene.player, area = scene.hitboxDanoPlayer ?? player.body;
  if (![ponto?.x,ponto?.y,player.x,player.y,area?.x,area?.y,area?.width,area?.height,
    player.body?.x,player.body?.y,player.body?.width,player.body?.height].every(Number.isFinite)) return null;
  // Alinha o centro dos pés, não o centro da célula da animação, à base do tentáculo.
  const destino = { x: ponto.x - (area.x + area.width / 2 - player.x),
    y: ponto.y - (area.y + area.height - player.y) };
  if (!trajetoLivre(scene, destino)) return null;
  return { destino, restanteMs: 180 };
}

export function atualizarPuxaoNovoBoss(scene, puxao, delta) {
  if (puxao.restanteMs <= 0 || delta <= 0) return true;
  const proporcao = Math.min(1, delta / puxao.restanteMs), player = scene.player;
  const ponto = { x: player.x + (puxao.destino.x - player.x) * proporcao,
    y: player.y + (puxao.destino.y - player.y) * proporcao };
  if (!trajetoLivre(scene, ponto)) return false;
  const dx = ponto.x - player.x, dy = ponto.y - player.y, area = scene.hitboxDanoPlayer;
  player.setPosition(ponto.x, ponto.y);
  player.body.reset(ponto.x, ponto.y);
  player.body.updateFromGameObject();
  // reset() guarda o canto da imagem, sem o offset da hitbox. Após sincronizar
  // esse offset, postUpdate não pode somá-lo novamente à posição do sprite.
  player.body.prev?.copy(player.body.position);
  player.body.prevFrame?.copy(player.body.position);
  player.body.autoFrame?.copy(player.body.position);
  player.setVelocity?.(0, 0);
  if (area?.setTo) area.setTo(area.x + dx, area.y + dy, area.width, area.height);
  else if (area) { area.x += dx; area.y += dy; }
  puxao.restanteMs = Math.max(0, puxao.restanteMs - delta);
  return true;
}
