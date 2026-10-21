/**
 * @file Converte as áreas de colisão do Tiled em corpos estáticos invisíveis da física Arcade.
 */

/**
 * Cria os corpos retangulares definidos na camada Collision da cidade.
 */
function criarColisoesCidade(scene, map) {
  const collisionLayer = map.getObjectLayer("Collision");

  if (collisionLayer) {
    scene.collisionGroup = scene.physics.add.staticGroup();
    collisionLayer.objects.forEach((obj) => {
      const collision = scene.collisionGroup.create(
        obj.x + obj.width / 2,
        obj.y + obj.height / 2,
      );

      collision.setSize(obj.width, obj.height);
      collision.setVisible(false);
    });
  }
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
 * Aproxima a área do polígono com pequenos corpos retangulares de oito pixels.
 */
function adicionarCorposPoligono(grupo, objeto) {
  const pontos = objeto.polygon.map((ponto) => ({
    x: Number(objeto.x) + Number(ponto.x),
    y: Number(objeto.y) + Number(ponto.y),
  }));
  const menorX = Math.floor(Math.min(...pontos.map((ponto) => ponto.x)));
  const maiorX = Math.ceil(Math.max(...pontos.map((ponto) => ponto.x)));
  const menorY = Math.floor(Math.min(...pontos.map((ponto) => ponto.y)));
  const maiorY = Math.ceil(Math.max(...pontos.map((ponto) => ponto.y)));
  const tamanhoCelula = 8;

  for (let y = menorY; y < maiorY; y += tamanhoCelula) {
    for (let x = menorX; x < maiorX; x += tamanhoCelula) {
      const centroX = x + tamanhoCelula / 2;
      const centroY = y + tamanhoCelula / 2;

      if (!pontoDentroPoligono(centroX, centroY, pontos)) {
        continue;
      }

      const corpo = grupo.create(centroX, centroY);
      corpo.setSize(
        Math.min(tamanhoCelula, maiorX - x),
        Math.min(tamanhoCelula, maiorY - y),
      );
      corpo.setVisible(false);
    }
  }
}

/**
 * Cria os obstáculos da fábrica, tratando separadamente polígonos e retângulos da camada
 * collision.
 */
function criarColisoesFabrica(scene, map) {
  const collisionLayer = map.getObjectLayer("collision");

  if (collisionLayer) {
    scene.collisionGroup = scene.physics.add.staticGroup();

    collisionLayer.objects.forEach((obj) => {
      if (obj.polygon?.length >= 3) {
        adicionarCorposPoligono(scene.collisionGroup, obj);
        return;
      }

      const collision = scene.collisionGroup.create(
        obj.x + obj.width / 2,
        obj.y + obj.height / 2,
      );

      collision.setSize(obj.width, obj.height);
      collision.setVisible(false);
    });
  }
}

export { criarColisoesCidade, criarColisoesFabrica };
