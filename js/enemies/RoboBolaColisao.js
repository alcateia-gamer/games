/** Proteção varrida da física: cobre órbita, recuo e empurrões em frames longos. */
import { tempoImpactoFlecha } from "../player/ArrowCollision.js";
import { retanguloLivreDoMapa, obterFilhosGrupoSeguro } from "./EnemyPathfinding.js";

function obstaculos(scene, inicio, fim, width, height) {
  const grupo = scene.collisionGroup, arvore = scene.physics?.world?.staticTree;
  if (arvore && grupo?.contains) return arvore.search({
    minX: Math.min(inicio.x, fim.x) - 1, minY: Math.min(inicio.y, fim.y) - 1,
    maxX: Math.max(inicio.x, fim.x) + width + 1, maxY: Math.max(inicio.y, fim.y) + height + 1,
  }).filter(b => b.enable !== false && grupo.contains(b.gameObject));
  return obterFilhosGrupoSeguro(grupo).map(o => o.body).filter(b => b?.enable !== false);
}

export function limitarPassoRoboBola(scene, robo, inicio, fim) {
  const { width, height } = robo.body;
  const dx = fim.x - inicio.x, dy = fim.y - inicio.y;
  const distancia = Math.hypot(dx, dy);
  if (!distancia) return { ...fim };
  let limite = 1;
  const arena = robo.prologoEncontroId ? scene.novoBoss?.config.arena : null;
  if (arena) {
    for (const [origem, delta, min, max] of [[inicio.x, dx, arena.xMin, arena.xMax - width],
      [inicio.y, dy, arena.yMin, arena.yMax - height]]) {
      if (delta < 0) limite = Math.min(limite, (min - origem) / delta);
      if (delta > 0) limite = Math.min(limite, (max - origem) / delta);
    }
  }
  for (const b of obstaculos(scene, inicio, fim, width, height)) {
    if (!b || ![b.x, b.y, b.width, b.height].every(Number.isFinite)) continue;
    // Topo esquerdo do robô contra o obstáculo expandido pelas dimensões reais.
    const expandido = { x: b.x - width, y: b.y - height,
      width: b.width + width, height: b.height + height };
    // Arcade pode deixar o corpo exatamente na borda. Afastar-se não é nova colisão.
    if ((inicio.x <= expandido.x && dx <= 0) ||
        (inicio.x >= expandido.x + expandido.width && dx >= 0) ||
        (inicio.y <= expandido.y && dy <= 0) ||
        (inicio.y >= expandido.y + expandido.height && dy >= 0)) continue;
    const t = tempoImpactoFlecha(inicio, fim, { x: dx / distancia, y: dy / distancia }, expandido, 0, 0);
    if (t !== null) limite = Math.min(limite, Math.max(0, t - 0.02 / distancia));
  }
  limite = Math.max(0, Math.min(1, limite));
  return { x: inicio.x + dx * limite, y: inicio.y + dy * limite };
}

export function protegerColisaoRoboBola(scene, robo) {
  const mundo = scene.physics?.world;
  if (!mundo?.on) return;
  let seguro = null, removido = false;
  const validar = area => retanguloLivreDoMapa(scene, area) && (!robo.prologoEncontroId || !scene.novoBoss ||
    (area.x >= scene.novoBoss.config.arena.xMin && area.y >= scene.novoBoss.config.arena.yMin &&
      area.x + area.width <= scene.novoBoss.config.arena.xMax &&
      area.y + area.height <= scene.novoBoss.config.arena.yMax));
  const atualizar = () => {
    const b = robo.body;
    if (!robo.active || robo.morto || robo.remoteOnly || !b || b.enable === false) return;
    const inicio = { x: b.prev.x, y: b.prev.y, width: b.width, height: b.height };
    let fim;
    if (validar(inicio)) fim = limitarPassoRoboBola(scene, robo, inicio, b);
    else if (seguro && validar({ ...seguro, width: b.width, height: b.height })) fim = seguro;
    else return;
    if (Math.hypot(fim.x - b.x, fim.y - b.y) > 0.001) {
      b.x = fim.x; b.y = fim.y; b.updateCenter?.(); b.setVelocity(0, 0);
      robo.rotaAtual = []; robo.rotaInvalidada = true;
    }
    if (validar(b)) seguro = { x: b.x, y: b.y };
  };
  const remover = () => {
    if (removido) return;
    removido = true;
    mundo.off("worldstep", atualizar);
    scene.events.off("shutdown", remover);
    robo.off("destroy", remover);
  };
  mundo.on("worldstep", atualizar);
  robo.once("destroy", remover);
  scene.events.once("shutdown", remover);
}
