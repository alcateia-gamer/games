/** A barreira bloqueia atores, incluindo robôs criados depois de sua ativação. */
import { entidadesFisicasArena } from "./NovoBossColisoesTorres.js";
import { retanguloLivreDoMapa } from "../EnemyPathfinding.js";

function tocaCirculo(area, circulo) {
  const x = Math.max(area.x, Math.min(circulo.x, area.x + area.width));
  const y = Math.max(area.y, Math.min(circulo.y, area.y + area.height));
  return Math.hypot(x - circulo.x, y - circulo.y) < circulo.radius;
}

/** Varredura do retângulo inteiro: impede atravessar o escudo em dash/empurrões. */
export function limitarCorpoNaBarreira(body, circulo, origem = body.prev) {
  if (!origem || ![origem.x, origem.y, body.x, body.y].every(Number.isFinite)) return false;
  const dx = body.x - origem.x, dy = body.y - origem.y;
  const passos = Math.ceil(Math.hypot(dx, dy) / 3);
  if (!passos || tocaCirculo({ ...origem, width: body.width, height: body.height }, circulo)) return false;
  for (let i = 1; i <= passos; i++) {
    const t = i / passos;
    if (!tocaCirculo({ x: origem.x + dx * t, y: origem.y + dy * t,
      width: body.width, height: body.height }, circulo)) continue;
    // Refina a fronteira sem depender da taxa de quadros.
    let livre = (i - 1) / passos, bloqueado = t;
    for (let j = 0; j < 16; j++) {
      const meio = (livre + bloqueado) / 2;
      if (tocaCirculo({ x: origem.x + dx * meio, y: origem.y + dy * meio,
        width: body.width, height: body.height }, circulo)) bloqueado = meio; else livre = meio;
    }
    body.x = origem.x + dx * livre; body.y = origem.y + dy * livre;
    body.updateCenter?.(); body.setVelocity(0, 0);
    return true;
  }
  return false;
}

export function criarColisaoBarreiraNovoBoss(scene, objeto) {
  let destruido = false;
  const atores = () => entidadesFisicasArena(scene).filter(a => a?.active && !a.morto &&
    a.body?.enable !== false && a.body && !a.remoteOnly);
  const collider = scene.physics.add.collider(atores(), objeto);
  const proteger = () => {
    if (destruido || !objeto.body?.enable) return;
    const circulo = { x: objeto.x, y: objeto.y, radius: objeto.body.radius };
    for (const ator of atores()) {
      const body = ator.body;
      limitarCorpoNaBarreira(body, circulo);
      // Um robô pode já ocupar o local quando o escudo se forma. Retira somente
      // se o trajeto até a borda estiver livre; o jogador usa a recarga segura existente.
      if (ator === scene.player || !tocaCirculo(body, circulo)) continue;
      const angulo = Math.atan2(body.y + body.height / 2 - circulo.y,
        body.x + body.width / 2 - circulo.x);
      for (const giro of [0, Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2, Math.PI]) {
        const nx = Math.cos(angulo + giro), ny = Math.sin(angulo + giro);
        let destino = null;
        for (let d = 3; d <= circulo.radius * 2 + body.width + body.height; d += 3) {
          const area = { x: body.x + nx * d, y: body.y + ny * d, width: body.width, height: body.height };
          if (!retanguloLivreDoMapa(scene, area)) break;
          if (!tocaCirculo(area, circulo)) { destino = area; break; }
        }
        if (!destino) continue;
        body.x = destino.x; body.y = destino.y; body.updateCenter?.(); body.setVelocity(0, 0);
        break;
      }
    }
  };
  scene.physics.world?.on?.("worldstep", proteger);
  return {
    atualizar() { if (!destruido) collider.object1 = atores(); },
    destruir() {
      if (destruido) return;
      destruido = true;
      scene.physics.world?.off?.("worldstep", proteger);
      collider.destroy();
    },
  };
}
