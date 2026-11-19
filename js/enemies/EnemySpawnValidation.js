/** Validação comum às ondas, portais e criações manuais; usa o piso e corpos atuais. */
import { criarAreaSpawnRobos } from "../map/AreaMapa.js";
import { retanguloLivreDoMapa } from "./EnemyPathfinding.js";
import { PERFIS_ROBOS } from './RobotBody.js';

export const FOLGA_SPAWN_ROBOS = Object.freeze({ objetos: 20, entreRobos: 24, distancia: 120, proximidadeArea: 144 });

// Geometria compartilhada entre a previsão da onda e o Arcade no nascimento.
export const CORPO_ROBO_BOLA = Object.freeze({ quadro: 127, tamanho: 60, escala: 0.56 });

export function retanguloCorpoSpawnRoboBola(ponto, margem = 0, body = null) {
  const { quadro, tamanho, escala } = CORPO_ROBO_BOLA;
  const offset = (quadro - tamanho) / 2;
  const x = body?.x ?? ponto.x + (offset - quadro / 2) * escala;
  const y = body?.y ?? ponto.y + (offset - quadro / 2) * escala;
  return { x: x - margem, y: y - margem, width: (body?.width ?? tamanho * escala) + 2 * margem,
    height: (body?.height ?? tamanho * escala) + 2 * margem };
}

/** Faixa local ao redor do retângulo; preserva rotação, gatilho e quantidade originais. */
export function ampliarAreaNascimento(area, margem = FOLGA_SPAWN_ROBOS.proximidadeArea) {
  const rotation = area.rotation ?? 0, cos = Math.cos(rotation), sin = Math.sin(rotation);
  return { ...area, x: area.x - margem * cos + margem * sin,
    y: area.y - margem * sin - margem * cos, width: area.width + margem * 2,
    height: area.height + margem * 2, rotation };
}

/** Desenho inteiro para separar robôs; considera também os corpos físicos deslocados. */
function ocupacaoRobo(robo) {
  const perfil = PERFIS_ROBOS[robo.tipoRobo];
  const width = robo.displayWidth || (perfil ? perfil.frameWidth * perfil.scale : 127 * .56);
  const height = robo.displayHeight || (perfil ? perfil.frameHeight * perfil.scale : 127 * .56);
  const visual = robo.getBounds?.();
  let x = visual?.x ?? robo.x - width / 2, y = visual?.y ?? robo.y - height / 2;
  let right = x + (visual?.width ?? width), bottom = y + (visual?.height ?? height);
  const body = robo.body ?? robo.coopBody;
  if (body?.enable !== false && [body?.x, body?.y, body?.width, body?.height].every(Number.isFinite)) {
    x = Math.min(x, body.x); y = Math.min(y, body.y);
    right = Math.max(right, body.x + body.width); bottom = Math.max(bottom, body.y + body.height);
  }
  return { x, y, width: right - x, height: bottom - y };
}

export function separacaoSpawnRobos(scene, ponto, rect, planejados = [], distancia = FOLGA_SPAWN_ROBOS.distancia,
  folga = FOLGA_SPAWN_ROBOS.entreRobos, cacheOcupacoes = null) {
  for (const grupo of [planejados, scene.inimigos ?? []]) for (const outro of grupo) {
    if (!outro || (grupo !== planejados && (!outro.active || outro.morto))) continue;
    if (Math.hypot(ponto.x - outro.x, ponto.y - outro.y) < distancia) return false;
    let b = cacheOcupacoes?.get(outro);
    if (!b) {
      b = ocupacaoRobo(outro);
      cacheOcupacoes?.set(outro, b);
    }
    const dx = Math.max(b.x - rect.x - rect.width, rect.x - b.x - b.width, 0);
    const dy = Math.max(b.y - rect.y - rect.height, rect.y - b.y - b.height, 0);
    if (Math.hypot(dx, dy) < folga) return false;
  }
  return true;
}

/** Farthest-point entre candidatos válidos evita sortear todos no mesmo canto. */
export function notaDistribuicaoSpawn(scene, ponto, planejados = []) {
  let nota = Infinity;
  for (const grupo of [planejados, scene.inimigos ?? []]) for (const outro of grupo) {
    if (!outro || (grupo !== planejados && (!outro.active || outro.morto))) continue;
    nota = Math.min(nota, (outro.x - ponto.x) ** 2 + (outro.y - ponto.y) ** 2);
  }
  return nota;
}

const pisos = new WeakMap();
export function obterPisoSpawnRobos(scene) {
  const map = scene?.map;
  if (!map) return null;
  if (!pisos.has(map)) pisos.set(map, criarAreaSpawnRobos(map));
  return pisos.get(map);
}

export function retanguloSpawnLivre(scene, rect, consultar = area => retanguloLivreDoMapa(scene, area)) {
  if (![rect?.x, rect?.y, rect?.width, rect?.height].every(Number.isFinite) ||
      rect.width <= 0 || rect.height <= 0) return false;
  const piso = obterPisoSpawnRobos(scene);
  if (piso ? !piso.contem(rect) : scene?.map?.layers?.some(l => l.tilemapLayer)) return false;
  if (!consultar(rect)) return false;
  // O escudo tem corpo próprio fora de collisionGroup. Também é proibido nascer nele.
  const barreira = scene.novoBoss?.sistemaGeradores?.corpoBarreira;
  if (barreira?.enable !== false && barreira?.isCircle) {
    const x = Math.max(rect.x, Math.min(barreira.center.x, rect.x + rect.width));
    const y = Math.max(rect.y, Math.min(barreira.center.y, rect.y + rect.height));
    if (Math.hypot(x - barreira.center.x, y - barreira.center.y) < barreira.radius) return false;
  }
  return true;
}
