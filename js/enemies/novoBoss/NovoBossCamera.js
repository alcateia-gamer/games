/** Zoom da arena inspirado no boss anterior; não controla estados de combate. */
import { jogadorNaArenaNovoBoss } from "./NovoBossConfig.js";

export function prepararCameraNovoBoss(scene, encontro) {
  let cameraControlada = null;
  let normal = null;
  let dentroArena = false;
  let destruida = false;
  const config = encontro.config.cameraArena ?? {
    fatorZoom: 0.8, velocidade: 5, margemSaidaX: 70, margemSaidaY: 80,
  };

  function restaurar() {
    if (cameraControlada && normal) cameraControlada.setZoom(normal.x, normal.y);
    cameraControlada = null;
    normal = null;
    dentroArena = false;
  }

  return {
    atualizar(delta = 16.67) {
      if (destruida) return;
      const camera = scene.cameras?.main;
      if (cameraControlada && cameraControlada !== camera) restaurar();
      if (!camera?.setZoom) return;
      const p = scene.player, arena = encontro.config.arena;
      const podeEntrar = encontro.sprite?.active && !encontro.morto && !encontro.encerrado &&
        !encontro.suspenso && !scene.multiplayer && !scene.morteEmAndamento &&
        (scene.vida ?? 1) > 0 && p?.active && !p.morto;
      if (!podeEntrar) dentroArena = false;
      else if (!dentroArena || Array.isArray(arena.zonas)) dentroArena = jogadorNaArenaNovoBoss(p, arena);
      else dentroArena = Number.isFinite(p.x) && Number.isFinite(p.y) &&
        p.x >= arena.xMin - config.margemSaidaX &&
        p.x <= arena.xMax + config.margemSaidaX &&
        p.y >= arena.yMin - config.margemSaidaY &&
        p.y <= arena.entradaY + config.margemSaidaY;

      if (dentroArena && !cameraControlada) {
        normal = { x: camera.zoomX ?? camera.zoom, y: camera.zoomY ?? camera.zoom };
        cameraControlada = camera;
      }
      if (!cameraControlada) return;
      const fator = dentroArena ? config.fatorZoom : 1;
      const alvo = { x: normal.x * fator, y: normal.y * fator };
      const dt = Number.isFinite(delta) ? Math.max(0, delta) : 16.67;
      const suavidade = 1 - Math.exp(-config.velocidade * dt / 1000);
      const x = (camera.zoomX ?? camera.zoom) + (alvo.x - (camera.zoomX ?? camera.zoom)) * suavidade;
      const y = (camera.zoomY ?? camera.zoom) + (alvo.y - (camera.zoomY ?? camera.zoom)) * suavidade;
      if (Math.abs(x - alvo.x) < 0.001 && Math.abs(y - alvo.y) < 0.001) {
        camera.setZoom(alvo.x, alvo.y);
        if (!dentroArena) restaurar();
      } else camera.setZoom(x, y);
    },
    destruir() {
      if (destruida) return;
      restaurar();
      destruida = true;
    },
    snapshot() { return { dentroArena, controlando: Boolean(cameraControlada),
      zoomNormal: normal ? { ...normal } : null, destruida }; },
  };
}
