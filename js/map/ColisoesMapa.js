/**
 * @file Converte as áreas de colisão do Tiled em corpos estáticos invisíveis da física Arcade.
 */

/**
 * Cria os corpos retangulares definidos na camada Collision da cidade.
 */
function criarColisoesCidade(scene, map) {
  criarColisoes(scene, map, "Collision", "mapa");
}

/**
 * Usa cruzamento de raios para decidir se um ponto está dentro de um polígono.
 */
function pontoDentroPoligono(x, y, pontos) {
  let dentro = false;

  for (
    let indice = 0, anterior = pontos.length - 1;
    indice < pontos.length;
    anterior = indice++
  ) {
    const pontoAtual = pontos[indice];
    const pontoAnterior = pontos[anterior];
    const cruzaLinha =
      pontoAtual.y > y !== pontoAnterior.y > y &&
      x <
        ((pontoAnterior.x - pontoAtual.x) * (y - pontoAtual.y)) /
          (pontoAnterior.y - pontoAtual.y) +
          pontoAtual.x;

    if (cruzaLinha) {
      dentro = !dentro;
    }
  }

  return dentro;
}

/**
 * Aproxima o interior do polígono com faixas retangulares de até dois pixels.
 */
function adicionarCorposPoligono(grupo, objeto) {
  const pontos = objeto.polygon.map((ponto) => ({
    x: Number(objeto.x) + Number(ponto.x),
    y: Number(objeto.y) + Number(ponto.y),
  }));
  // Faixas entre vértices não atravessam concavidades. A interseção dos extremos
  // contém o retângulo inteiro, em vez de aceitar só seu centro.
  const ys = [...new Set(pontos.map(p => p.y))].sort((a, b) => a - b);
  const intervalos = y => {
    const xs = [];
    for (let i = 0; i < pontos.length; i++) {
      const a = pontos[i], b = pontos[(i + 1) % pontos.length];
      if ((a.y > y) !== (b.y > y)) xs.push(a.x + (y - a.y) * (b.x - a.x) / (b.y - a.y));
    }
    xs.sort((a, b) => a - b);
    return xs.filter((_, i) => i % 2 === 0).map((x, i) => [x, xs[i * 2 + 1]]);
  };
  for (let i = 0; i < ys.length - 1; i++) {
    for (let y = ys[i]; y < ys[i + 1] - 1e-8; y += 2) {
      const bottom = Math.min(y + 2, ys[i + 1]);
      const topo = intervalos(y + 1e-9), base = intervalos(bottom - 1e-9);
      for (const a of topo) for (const b of base) {
        const left = Math.max(a[0], b[0]) + 1e-7, right = Math.min(a[1], b[1]) - 1e-7;
        if (right > left && pontoDentroPoligono((left + right) / 2, (y + bottom) / 2, pontos))
          adicionarRetangulo(grupo, objeto.id, left, y, right - left, bottom - y);
      }
    }
  }
}

/** StaticBody lê displaySize no refresh; setSize isolado deslocava o corpo pelo frame. */
function adicionarRetangulo(grupo, id, x, y, width, height) {
  const corpo = grupo.create(x + width / 2, y + height / 2);
  corpo.setDisplaySize(width, height).setVisible(false).refreshBody();
  corpo.tiledCollisionId = id;
  corpo.setData?.("tiledObjectId", id);
}

function adicionarCorposCurvos(grupo, objeto) {
  const { x, y, width: w, height: h } = objeto;
  const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2;
  const metade = py => {
    const dy = Math.abs(py - cy);
    if (!objeto.capsule) return w / 2 * Math.sqrt(Math.max(0, 1 - (dy / (h / 2)) ** 2));
    if (w >= h) return w / 2 - r + Math.sqrt(Math.max(0, r * r - dy * dy));
    const ponta = Math.max(0, dy - (h / 2 - r));
    return Math.sqrt(Math.max(0, r * r - ponta * ponta));
  };
  for (let top = y; top < y + h - 1e-8; top += 2) {
    const bottom = Math.min(top + 2, y + h);
    const half = Math.min(metade(top), metade(bottom));
    if (half > 1e-6) adicionarRetangulo(grupo, objeto.id, cx - half, top, half * 2, bottom - top);
  }
}

function objetosOriginais(layers) {
  return (layers ?? []).flatMap(layer => [...(layer.objects ?? []), ...objetosOriginais(layer.layers)]);
}

function criarColisoes(scene, map, nome, chave) {
  const layer = map.getObjectLayer(nome);
  if (!layer) return;
  scene.collisionGroup = scene.physics.add.staticGroup();
  // O parser do Phaser ignora a marca capsule do Tiled. Reaproveita somente
  // essa marca por ID, mantendo coordenadas/offsets já processados pelo parser.
  const raw = objetosOriginais(scene.cache?.tilemap?.get(chave)?.data?.layers);
  const capsulas = new Set(raw.filter(o => o.capsule).map(o => o.id));
  for (const original of layer.objects) {
    const obj = capsulas.has(original.id) ? { ...original, capsule: true } : original;
    if (obj.polyline || obj.point || obj.text) continue;
    if (obj.polygon?.length >= 3) adicionarCorposPoligono(scene.collisionGroup, obj);
    else if (obj.width > 0 && obj.height > 0) {
      if (obj.ellipse || obj.capsule) adicionarCorposCurvos(scene.collisionGroup, obj);
      else adicionarRetangulo(scene.collisionGroup, obj.id, obj.x, obj.y, obj.width, obj.height);
    }
  }
}

/**
 * Cria os obstáculos da fábrica, tratando separadamente polígonos e retângulos da camada
 * collision.
 */
function criarColisoesFabrica(scene, map) {
  criarColisoes(scene, map, "collision", "mapaParte2");
}

export { criarColisoesCidade, criarColisoesFabrica };
