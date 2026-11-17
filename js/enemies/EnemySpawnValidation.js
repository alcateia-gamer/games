/** Validação comum às ondas, portais e criações manuais; usa o piso e corpos atuais. */
import { criarAreaSpawnRobos } from "../map/AreaMapa.js";
import { retanguloLivreDoMapa } from "./EnemyPathfinding.js";

const pisos = new WeakMap();
export function obterPisoSpawnRobos(scene) {
  const map = scene?.map;
  if (!map) return null;
  if (!pisos.has(map)) pisos.set(map, criarAreaSpawnRobos(map));
  return pisos.get(map);
}

export function retanguloSpawnLivre(scene, rect) {
  if (![rect?.x, rect?.y, rect?.width, rect?.height].every(Number.isFinite) ||
      rect.width <= 0 || rect.height <= 0) return false;
  const piso = obterPisoSpawnRobos(scene);
  if (piso ? !piso.contem(rect) : scene?.map?.layers?.some(l => l.tilemapLayer)) return false;
  if (!retanguloLivreDoMapa(scene, rect)) return false;
  // O escudo tem corpo próprio fora de collisionGroup. Também é proibido nascer nele.
  const barreira = scene.novoBoss?.sistemaGeradores?.corpoBarreira;
  if (barreira?.enable !== false && barreira?.isCircle) {
    const x = Math.max(rect.x, Math.min(barreira.center.x, rect.x + rect.width));
    const y = Math.max(rect.y, Math.min(barreira.center.y, rect.y + rect.height));
    if (Math.hypot(x - barreira.center.x, y - barreira.center.y) < barreira.radius) return false;
  }
  return true;
}
