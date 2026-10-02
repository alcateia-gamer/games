function obterObstaculosMapa(scene) {
  if (!scene?.collisionGroup?.getChildren) {
    return [];
  }

  const blocos = obterFilhosGrupoSeguro(scene.collisionGroup);
  return blocos.filter((bloco) => bloco && bloco.body);
}

function calcularBoundsInimigoParaPosicao(inimigo, x, y) {
  if (!inimigo || !inimigo.body) {
    return new Phaser.Geom.Rectangle(x - 8, y - 8, 16, 16);
  }

  const largura = inimigo.body.width || 32;
  const altura = inimigo.body.height || 32;
  return new Phaser.Geom.Rectangle(
    x - largura / 2,
    y - altura / 2,
    largura,
    altura,
  );
}

function caminhoDiretoBloqueado(scene, inimigo, alvo) {
  if (!scene || !inimigo || !alvo) {
    return false;
  }

  const blocos = obterObstaculosMapa(scene);
  if (blocos.length === 0) {
    return false;
  }

  const linha = new Phaser.Geom.Line(inimigo.x, inimigo.y, alvo.x, alvo.y);

  for (const bloco of blocos) {
    const rect = new Phaser.Geom.Rectangle(
      bloco.body.x,
      bloco.body.y,
      bloco.body.width,
      bloco.body.height,
    );

    if (Phaser.Geom.Intersects.LineToRectangle(linha, rect)) {
      return true;
    }
  }

  return false;
}

function posicaoLivreParaDesvio(scene, inimigo, x, y) {
  const bounds = calcularBoundsInimigoParaPosicao(inimigo, x, y);
  const blocos = obterObstaculosMapa(scene);

  for (const bloco of blocos) {
    const rect = new Phaser.Geom.Rectangle(
      bloco.body.x,
      bloco.body.y,
      bloco.body.width,
      bloco.body.height,
    );

    if (Phaser.Geom.Intersects.RectangleToRectangle(bounds, rect)) {
      return false;
    }
  }

  return true;
}

function escolherDirecaoDesvio(scene, inimigo, alvo) {
  const deslocamentos = [
    { x: -55, y: 0 },
    { x: 55, y: 0 },
    { x: 0, y: -55 },
    { x: 0, y: 55 },
    { x: -80, y: -30 },
    { x: -80, y: 30 },
    { x: 80, y: -30 },
    { x: 80, y: 30 },
  ];

  let melhor = null;
  let melhorScore = Number.POSITIVE_INFINITY;

  for (const deslocamento of deslocamentos) {
    const xDestino = inimigo.x + deslocamento.x;
    const yDestino = inimigo.y + deslocamento.y;

    if (!posicaoLivreParaDesvio(scene, inimigo, xDestino, yDestino)) {
      continue;
    }

    const distancia = Phaser.Math.Distance.Between(
      xDestino,
      yDestino,
      alvo.x,
      alvo.y,
    );
    const score =
      distancia +
      Math.abs(deslocamento.x) * 0.05 +
      Math.abs(deslocamento.y) * 0.05;

    if (score < melhorScore) {
      melhorScore = score;
      melhor = { x: xDestino, y: yDestino };
    }
  }

  return melhor;
}

// =====================================================
// ATUALIZA INIMIGO
// =====================================================

function obterFilhosGrupoSeguro(grupo) {
  if (!grupo?.getChildren) {
    return [];
  }

  try {
    const filhos = grupo.getChildren();
    return Array.isArray(filhos) ? filhos : [];
  } catch {
    return [];
  }
}

function construirGridNavegacao(scene, inimigo, cellSize = 24) {
  const blocos = obterObstaculosMapa(scene);

  if (!blocos.length) {
    return null;
  }

  const margem = Math.ceil(
    Math.max(inimigo?.body?.width || 30, inimigo?.body?.height || 15) * 0.5 +
      12,
  );
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const bloco of blocos) {
    const rect = new Phaser.Geom.Rectangle(
      bloco.body.x,
      bloco.body.y,
      bloco.body.width,
      bloco.body.height,
    );

    minX = Math.min(minX, rect.x - margem);
    maxX = Math.max(maxX, rect.right + margem);
    minY = Math.min(minY, rect.y - margem);
    maxY = Math.max(maxY, rect.bottom + margem);
  }

  const cols = Math.ceil((maxX - minX) / cellSize) + 2;
  const rows = Math.ceil((maxY - minY) / cellSize) + 2;
  const grid = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (const bloco of blocos) {
    const rect = new Phaser.Geom.Rectangle(
      bloco.body.x,
      bloco.body.y,
      bloco.body.width,
      bloco.body.height,
    );

    const startCol = Math.floor((rect.x - margem - minX) / cellSize);
    const endCol = Math.floor((rect.right + margem - minX) / cellSize);
    const startRow = Math.floor((rect.y - margem - minY) / cellSize);
    const endRow = Math.floor((rect.bottom + margem - minY) / cellSize);

    for (
      let row = Math.max(0, startRow);
      row <= Math.min(rows - 1, endRow);
      row += 1
    ) {
      for (
        let col = Math.max(0, startCol);
        col <= Math.min(cols - 1, endCol);
        col += 1
      ) {
        grid[row][col] = 1;
      }
    }
  }

  return {
    grid,
    cols,
    rows,
    cellSize,
    minX,
    minY,
    margem,
  };
}

function cellParaCoordenada(gridInfo, col, row) {
  return {
    x: gridInfo.minX + col * gridInfo.cellSize + gridInfo.cellSize / 2,
    y: gridInfo.minY + row * gridInfo.cellSize + gridInfo.cellSize / 2,
  };
}

function mundoParaCell(gridInfo, x, y) {
  const col = Math.floor((x - gridInfo.minX) / gridInfo.cellSize);
  const row = Math.floor((y - gridInfo.minY) / gridInfo.cellSize);
  return { col, row };
}

function celulaCaminhavel(gridInfo, col, row) {
  if (!gridInfo) {
    return false;
  }

  if (col < 0 || row < 0 || col >= gridInfo.cols || row >= gridInfo.rows) {
    return false;
  }

  return gridInfo.grid[row]?.[col] !== 1;
}

function heuristica(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function calcularRotaAStar(scene, inimigo, alvo, cellSize = 24) {
  const gridInfo = construirGridNavegacao(scene, inimigo, cellSize);

  if (!gridInfo) {
    return [];
  }

  const startCell = mundoParaCell(gridInfo, inimigo.x, inimigo.y);
  const goalCell = mundoParaCell(gridInfo, alvo.x, alvo.y);

  if (!celulaCaminhavel(gridInfo, startCell.col, startCell.row)) {
    return [];
  }

  if (!celulaCaminhavel(gridInfo, goalCell.col, goalCell.row)) {
    let melhor = null;
    let melhorDistancia = Infinity;

    for (
      let y = Math.max(0, goalCell.row - 2);
      y <= Math.min(gridInfo.rows - 1, goalCell.row + 2);
      y += 1
    ) {
      for (
        let x = Math.max(0, goalCell.col - 2);
        x <= Math.min(gridInfo.cols - 1, goalCell.col + 2);
        x += 1
      ) {
        if (!celulaCaminhavel(gridInfo, x, y)) {
          continue;
        }

        const dist = Math.abs(x - goalCell.col) + Math.abs(y - goalCell.row);
        if (dist < melhorDistancia) {
          melhorDistancia = dist;
          melhor = { col: x, row: y };
        }
      }
    }

    if (!melhor) {
      return [];
    }

    goalCell.col = melhor.col;
    goalCell.row = melhor.row;
  }

  const openSet = [
    {
      x: startCell.col,
      y: startCell.row,
      g: 0,
      f: heuristica(startCell, goalCell),
    },
  ];
  const cameFrom = new Map();
  const gScore = new Map();

  gScore.set(`${startCell.col},${startCell.row}`, 0);

  while (openSet.length > 0) {
    openSet.sort((a, b) => a.f - b.f || a.g - b.g);
    const atual = openSet.shift();
    const atualKey = `${atual.x},${atual.y}`;

    if (atual.x === goalCell.col && atual.y === goalCell.row) {
      const caminho = [];
      let cursor = atualKey;

      while (cursor) {
        const [cx, cy] = cursor.split(",").map(Number);
        caminho.push(cellParaCoordenada(gridInfo, cx, cy));

        if (cameFrom.has(cursor)) {
          cursor = cameFrom.get(cursor);
        } else {
          break;
        }
      }

      caminho.reverse();
      return caminho;
    }

    const vizinhos = [
      { x: 0, y: -1 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: -1 },
      { x: 1, y: 1 },
      { x: -1, y: -1 },
      { x: -1, y: 1 },
    ];

    for (const vizinho of vizinhos) {
      const nx = atual.x + vizinho.x;
      const ny = atual.y + vizinho.y;

      if (!celulaCaminhavel(gridInfo, nx, ny)) {
        continue;
      }

      const vizinhoKey = `${nx},${ny}`;
      const custo = Math.abs(vizinho.x) + Math.abs(vizinho.y) === 2 ? 1.4 : 1;
      const tentativeG = (gScore.get(atualKey) ?? Infinity) + custo;

      if ((gScore.get(vizinhoKey) ?? Infinity) <= tentativeG) {
        continue;
      }

      cameFrom.set(vizinhoKey, atualKey);
      gScore.set(vizinhoKey, tentativeG);
      openSet.push({
        x: nx,
        y: ny,
        g: tentativeG,
        f: tentativeG + heuristica({ x: nx, y: ny }, goalCell),
      });
    }
  }

  return [];
}

function gerarRotaParaJogador(scene, inimigo, alvo) {
  const rota = calcularRotaAStar(scene, inimigo, alvo);

  if (!Array.isArray(rota) || rota.length < 2) {
    return [];
  }

  const rotaSuavizada = [rota[0]];
  for (let index = 1; index < rota.length - 1; index += 1) {
    const pontoAtual = rota[index];
    const pontoAnterior = rotaSuavizada[rotaSuavizada.length - 1];
    const pontoProximo = rota[index + 1];

    const distanciaAnterior = Phaser.Math.Distance.Between(
      pontoAnterior.x,
      pontoAnterior.y,
      pontoAtual.x,
      pontoAtual.y,
    );
    const distanciaProxima = Phaser.Math.Distance.Between(
      pontoAtual.x,
      pontoAtual.y,
      pontoProximo.x,
      pontoProximo.y,
    );

    if (distanciaAnterior < 18 && distanciaProxima < 18) {
      continue;
    }

    rotaSuavizada.push(pontoAtual);
  }

  if (
    rotaSuavizada[rotaSuavizada.length - 1] !== rota[rota.length - 1] &&
    rota.length > 0
  ) {
    rotaSuavizada.push(rota[rota.length - 1]);
  }

  return rotaSuavizada;
}

function atualizarRotaSeguindoInimigo(scene, inimigo, alvo, time) {
  if (!scene || !inimigo || !alvo) {
    return false;
  }

  const caminhoDiretoObstruido = caminhoDiretoBloqueado(scene, inimigo, alvo);
  if (
    !caminhoDiretoObstruido &&
    Array.isArray(inimigo.rotaAtual) &&
    inimigo.rotaAtual.length > 0
  ) {
    inimigo.rotaAtual = [];
    inimigo.indiceRota = 0;
    return false;
  }

  const precisaRecalcular =
    !Array.isArray(inimigo.rotaAtual) ||
    inimigo.rotaAtual.length === 0 ||
    time > (inimigo.ultimoCalculoRota || 0) + 1200 ||
    (inimigo.ultimaPosicaoRota &&
      Phaser.Math.Distance.Between(
        inimigo.ultimaPosicaoRota.x,
        inimigo.ultimaPosicaoRota.y,
        inimigo.x,
        inimigo.y,
      ) < 8 &&
      time > (inimigo.tempoPreso || 0) + 1600);

  if (
    !caminhoDiretoObstruido &&
    !(Array.isArray(inimigo.rotaAtual) && inimigo.rotaAtual.length > 0)
  ) {
    return false;
  }

  if (
    !precisaRecalcular &&
    Array.isArray(inimigo.rotaAtual) &&
    inimigo.rotaAtual.length > 0
  ) {
    return true;
  }

  const rota = gerarRotaParaJogador(scene, inimigo, alvo);
  if (!Array.isArray(rota) || rota.length < 2) {
    inimigo.rotaAtual = [];
    inimigo.indiceRota = 0;
    inimigo.ultimoCalculoRota = time;
    return false;
  }

  inimigo.rotaAtual = rota;
  inimigo.indiceRota = 0;
  inimigo.ultimoCalculoRota = time;
  inimigo.ultimaPosicaoRota = { x: inimigo.x, y: inimigo.y };
  inimigo.tempoPreso = time;
  return true;
}

function seguirRotaAtual(scene, inimigo, alvo, time, atualizarDirecao) {
  if (!Array.isArray(inimigo.rotaAtual) || inimigo.rotaAtual.length === 0) {
    return false;
  }

  const alvoRota =
    inimigo.rotaAtual[inimigo.indiceRota] ||
    inimigo.rotaAtual[inimigo.rotaAtual.length - 1];

  if (!alvoRota) {
    inimigo.rotaAtual = [];
    inimigo.indiceRota = 0;
    return false;
  }

  const dist = Phaser.Math.Distance.Between(
    inimigo.x,
    inimigo.y,
    alvoRota.x,
    alvoRota.y,
  );

  if (dist <= 16) {
    inimigo.indiceRota += 1;
    inimigo.ultimaPosicaoRota = { x: inimigo.x, y: inimigo.y };
    inimigo.tempoPreso = time;

    if (inimigo.indiceRota >= inimigo.rotaAtual.length) {
      inimigo.rotaAtual = [];
      inimigo.indiceRota = 0;
      return false;
    }

    return true;
  }

  scene.physics.moveTo(
    inimigo,
    alvoRota.x,
    alvoRota.y,
    inimigo.velocidade * 1.75,
  );
  atualizarDirecao(scene, inimigo);
  return true;
}

function desenharDebugRotaInimigo(scene, inimigo) {
  if (!scene || !inimigo || !scene.debugRotaRobos) {
    return;
  }

  if (!scene.debugRotaGraphics) {
    scene.debugRotaGraphics = scene.add.graphics();
    scene.debugRotaGraphics.setDepth(200);
  }

  scene.debugRotaGraphics.clear();
  scene.debugRotaGraphics.lineStyle(2, 0xffcc00, 1);

  if (Array.isArray(inimigo.rotaAtual) && inimigo.rotaAtual.length > 1) {
    for (let index = 0; index < inimigo.rotaAtual.length - 1; index += 1) {
      const pontoAtual = inimigo.rotaAtual[index];
      const proximo = inimigo.rotaAtual[index + 1];
      scene.debugRotaGraphics.lineBetween(
        pontoAtual.x,
        pontoAtual.y,
        proximo.x,
        proximo.y,
      );
    }
  }

  if (Array.isArray(inimigo.rotaAtual) && inimigo.rotaAtual.length > 0) {
    const waypointAtual =
      inimigo.rotaAtual[
        Math.min(inimigo.indiceRota, inimigo.rotaAtual.length - 1)
      ];
    scene.debugRotaGraphics.fillStyle(0x00ff00, 1);
    scene.debugRotaGraphics.fillCircle(waypointAtual.x, waypointAtual.y, 4);
  }

  scene.debugRotaGraphics.fillStyle(0xff0000, 1);
  scene.debugRotaGraphics.fillCircle(inimigo.x, inimigo.y, 3);
}

export { obterFilhosGrupoSeguro, caminhoDiretoBloqueado, atualizarRotaSeguindoInimigo, seguirRotaAtual, desenharDebugRotaInimigo };
