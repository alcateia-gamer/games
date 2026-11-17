/** Testa os quatro cantos nas coordenadas locais do retângulo desenhado no Tiled. */
export function areaContemCorpo(area, rect) {
  const cos = Math.cos(area.rotation), sin = Math.sin(area.rotation);
  const epsilon = 1e-7; // Coordenadas fracionárias e rotação podem variar em poucos ULPs.
  return [[rect.left, rect.top], [rect.right, rect.top],
    [rect.right, rect.bottom], [rect.left, rect.bottom]].every(([x, y]) => {
    const dx = x - area.x, dy = y - area.y;
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;
    return localX >= -epsilon && localX <= area.width + epsilon &&
      localY >= -epsilon && localY <= area.height + epsilon;
  });
}

/** A patrulha preserva a mesma folga do nascimento, incluindo sprite e pés. */
export function posicaoDentroAreaSpawn(robo, ponto) {
  if (!robo.spawnArea) return true;
  const margem = robo.spawnWallMargin ?? 0;
  const dx = ponto.x - robo.x, dy = ponto.y - robo.y;
  const b = robo.body;
  return areaContemCorpo(robo.spawnArea, {
    left: Math.min(ponto.x - robo.displayWidth / 2, b.x + dx - margem),
    top: Math.min(ponto.y - robo.displayHeight / 2, b.y + dy - margem),
    right: Math.max(ponto.x + robo.displayWidth / 2, b.x + dx + b.width + margem),
    bottom: Math.max(ponto.y + robo.displayHeight / 2, b.y + dy + b.height + margem),
  });
}
