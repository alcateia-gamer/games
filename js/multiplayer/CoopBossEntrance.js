/** Uma fileira após as portas, validada por inteiro antes de mover a equipe. */
import { jogadorNaArenaNovoBoss } from "../enemies/novoBoss/NovoBossConfig.js";
import { retanguloLivreDoMapa } from "../enemies/EnemyPathfinding.js";

export function planejarEntradaBoss(scene, encontro, origem, participantes) {
  if (!participantes.length || participantes.length > 4) return null;
  const portas = (scene.portasFabrica ?? []).filter(p => ["porta02", "porta03"].includes(p.nome));
  const topo = portas.length ? Math.min(...portas.map(p => p.area.y)) : origem.y + 80;
  const centroX = portas.length && portas.every(p => Number.isFinite(p.area.x) && Number.isFinite(p.area.width))
    ? (Math.min(...portas.map(p => p.area.x)) + Math.max(...portas.map(p => p.area.x + p.area.width))) / 2 : origem.x;
  const corpos = participantes.map(({ player }) => {
    const b = player.body;
    return b && [b.x, b.y, b.width, b.height].every(Number.isFinite) && b.width > 0 && b.height > 0
      ? { dx: b.x - player.x, dy: b.y - player.y, width: b.width, height: b.height }
      : { dx: -18, dy: 10, width: 36, height: 20 };
  });
  const espaco = Math.max(64, ...corpos.map(b => b.width + 24));
  const deslocamentos = [0];
  for (let dx = 32; dx <= 256; dx += 32) deslocamentos.push(-dx, dx);
  for (let recuo = 80; recuo <= 512; recuo += 32) for (const dx of deslocamentos) {
    const destinos = {};
    const valido = participantes.every(({ id }, i) => {
      const p = { x: centroX + dx + (i - (participantes.length - 1) / 2) * espaco, y: topo - recuo };
      const b = corpos[i], area = { x: p.x + b.dx, y: p.y + b.dy, width: b.width, height: b.height };
      const cantos = [[p.x, p.y], [area.x, area.y], [area.x + area.width, area.y],
        [area.x, area.y + area.height], [area.x + area.width, area.y + area.height]];
      if (area.y + area.height >= topo || !retanguloLivreDoMapa(scene, area) ||
          !cantos.every(([x, y]) => jogadorNaArenaNovoBoss({ active: true, x, y }, encontro.config.arena))) return false;
      const raio = encontro.config.geradores?.raioBarreira ?? 95;
      if (encontro.barreiraAtiva && Math.hypot(p.x - encontro.x, p.y - (encontro.y + 16)) <= raio + 40) return false;
      destinos[id] = p;
      return true;
    });
    if (valido) return destinos;
  }
  return null;
}
