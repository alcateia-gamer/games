/** SAT contínuo: retângulo fino orientado varrido contra AABB, sem caixa diagonal inflada. */
export function tempoImpactoFlecha(inicio, fim, direcao, retangulo, meiaLong = 16, meiaLarg = 3) {
  const cx = retangulo.x + retangulo.width / 2;
  const cy = retangulo.y + retangulo.height / 2;
  const vx = fim.x - inicio.x, vy = fim.y - inicio.y;
  const normal = { x: -direcao.y, y: direcao.x };
  let entrada = 0, saida = 1;
  for (const eixo of [{ x: 1, y: 0 }, { x: 0, y: 1 }, direcao, normal]) {
    const raio = Math.abs(eixo.x) * retangulo.width / 2 +
      Math.abs(eixo.y) * retangulo.height / 2 +
      Math.abs(eixo.x * direcao.x + eixo.y * direcao.y) * meiaLong +
      Math.abs(eixo.x * normal.x + eixo.y * normal.y) * meiaLarg;
    const distancia = (inicio.x - cx) * eixo.x + (inicio.y - cy) * eixo.y;
    const velocidade = vx * eixo.x + vy * eixo.y;
    if (Math.abs(velocidade) < 1e-10) {
      if (Math.abs(distancia) > raio) return null;
    } else {
      const a = (-raio - distancia) / velocidade, b = (raio - distancia) / velocidade;
      entrada = Math.max(entrada, Math.min(a, b));
      saida = Math.min(saida, Math.max(a, b));
      if (entrada > saida) return null;
    }
  }
  return entrada;
}

/** Consulta espacial dos corpos existentes; não cria nem altera colisões do mapa. */
export function obstaculosFlecha(scene, inicio, fim, margem = 19) {
  const grupo = scene.collisionGroup;
  if (!grupo) return [];
  const arvore = scene.physics?.world?.staticTree;
  if (arvore && grupo.contains) {
    return arvore.search({
      minX: Math.min(inicio.x, fim.x) - margem, minY: Math.min(inicio.y, fim.y) - margem,
      maxX: Math.max(inicio.x, fim.x) + margem, maxY: Math.max(inicio.y, fim.y) + margem,
    }).filter(corpo => corpo.enable !== false && grupo.contains(corpo.gameObject));
  }
  return (grupo.getChildren?.() ?? []).filter(obj => obj.active && obj.body?.enable !== false)
    .map(obj => obj.body);
}
