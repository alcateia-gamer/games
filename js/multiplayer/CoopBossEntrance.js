/** Posições próximas ao participante que iniciou a cutscene, validadas antes do teleporte. */
import { jogadorNaArenaNovoBoss } from "../enemies/novoBoss/NovoBossConfig.js";
import { retanguloLivreDoMapa } from "../enemies/EnemyPathfinding.js";

export function planejarEntradaBoss(scene, encontro, origem, participantes) {
  const ocupados = [{ x: origem.x, y: origem.y }];
  const pontos = [];
  for (let raio = 64; raio <= 512; raio += 32) {
    for (let dx = -raio; dx <= raio; dx += 32) {
      for (let dy = -raio; dy <= raio; dy += 32) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === raio) pontos.push({ x: origem.x + dx, y: origem.y + dy });
      }
    }
  }
  pontos.sort((a, b) => Math.hypot(a.x - origem.x, a.y - origem.y) - Math.hypot(b.x - origem.x, b.y - origem.y));
  const destinos = {};
  for (const { id, player } of participantes) {
    if (player === origem) { destinos[id] = { x: player.x, y: player.y }; continue; }
    const ponto = pontos.find(p => {
      const area = { x: p.x - 18, y: p.y + 10, width: 36, height: 20 };
      if (!jogadorNaArenaNovoBoss({ active: true, ...p }, encontro.config.arena) ||
          !retanguloLivreDoMapa(scene, area) || ocupados.some(o => Math.hypot(o.x - p.x, o.y - p.y) < 56)) return false;
      if ((scene.portasFabrica ?? []).some(porta => ["porta02", "porta03"].includes(porta.nome) &&
          area.y + area.height > porta.area.y)) return false;
      const raio = encontro.config.geradores?.raioBarreira ?? 95;
      return !encontro.barreiraAtiva || Math.hypot(p.x - encontro.x, p.y - (encontro.y + 16)) > raio + 40;
    });
    if (!ponto) return null; // Espera espaço livre sem teleportar ninguém para dentro de obstáculos.
    destinos[id] = { ...ponto };
    ocupados.push(ponto);
  }
  return destinos;
}
