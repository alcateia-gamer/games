/**
 * @file Navegação dos robôs: índice espacial das colisões e A* com orçamento limitado. O cache
 * é compartilhado por cena.
 */

const CONFIG = Object.freeze({
  tamanhoCelula: 32,
  tamanhoIndice: 128,
  margemRota: 220,
  distanciaMaximaRota: 960,
  expansoesMaximas: 2600,
  buscasPorFrame: 2,
  intervaloRecalculo: 1350,
  toleranciaPonto: 15,
});

const caches = new WeakMap();

const direcoes = [
  [0, -1, 1],
  [1, 0, 1],
  [0, 1, 1],
  [-1, 0, 1],
  [1, -1, Math.SQRT2],
  [1, 1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
];

// =====================================================
// LEITURA SEGURA DOS GRUPOS
// =====================================================

/**
 * Obtém os filhos de um grupo com segurança, inclusive durante sua destruição ou troca de
 * cena.
 */
function obterFilhosGrupoSeguro(grupo) {
  if (!grupo?.getChildren) return [];

  try {
    const filhos = grupo.getChildren();
    return Array.isArray(filhos) ? filhos : [];
  } catch (_) {
    return [];
  }
}

/**
 * Gera a chave textual de uma célula do índice ou da grade de navegação.
 */
function chave(x, y) {
  return `${x},${y}`;
}

// =====================================================
// ÍNDICE ESPACIAL COMPARTILHADO
// =====================================================

/**
 * Cria ou reutiliza o índice espacial de corpos estáticos; obstáculos grandes ficam em uma
 * lista separada.
 */
function criarIndice(scene) {
  const grupo = scene?.collisionGroup;
  const filhos = obterFilhosGrupoSeguro(grupo);

  const anterior = caches.get(scene);

  if (
    anterior &&
    anterior.grupo === grupo &&
    anterior.quantidade === filhos.length
  ) {
    return anterior;
  }

  const indice = new Map();
  const grandes = [];

  for (const bloco of filhos) {
    const body = bloco?.body;

    if (
      !body ||
      body.enable === false ||
      !(body.width > 0) ||
      !(body.height > 0)
    ) {
      continue;
    }

    const rect = new Phaser.Geom.Rectangle(
      body.x,
      body.y,
      body.width,
      body.height,
    );

    const minX = Math.floor(rect.left / CONFIG.tamanhoIndice);

    const maxX = Math.floor(rect.right / CONFIG.tamanhoIndice);

    const minY = Math.floor(rect.top / CONFIG.tamanhoIndice);

    const maxY = Math.floor(rect.bottom / CONFIG.tamanhoIndice);

    const totalCelulas = (maxX - minX + 1) * (maxY - minY + 1);

    if (totalCelulas > 256) {
      grandes.push({ rect, body });
      continue;
    }

    const item = { rect, body };

    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        const id = chave(cx, cy);

        if (!indice.has(id)) {
          indice.set(id, []);
        }

        indice.get(id).push(item);
      }
    }
  }

  const cache = {
    grupo,
    quantidade: filhos.length,
    indice,
    grandes,
    frameBusca: -1,
    buscasNoFrame: 0,
  };

  caches.set(scene, cache);

  return cache;
}

// Chamar quando portas ou outras colisões
// estáticas mudarem de tamanho ou posição
// sem alterar a quantidade de objetos.

/**
 * Descarta o índice quando uma colisão muda de posição ou tamanho sem mudar a quantidade de
 * corpos.
 */
function invalidarCacheNavegacao(scene) {
  if (scene) {
    caches.delete(scene);
  }
}

// =====================================================
// BUSCA DE OBSTÁCULOS PRÓXIMOS
// =====================================================

/**
 * Consulta as células que cruzam um retângulo e reúne obstáculos candidatos sem duplicação.
 */
function candidatos(cache, rect) {
  const resultado = [];
  const vistos = new Set();

  const minX = Math.floor(rect.left / CONFIG.tamanhoIndice);

  const maxX = Math.floor(rect.right / CONFIG.tamanhoIndice);

  const minY = Math.floor(rect.top / CONFIG.tamanhoIndice);

  const maxY = Math.floor(rect.bottom / CONFIG.tamanhoIndice);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const itens = cache.indice.get(chave(x, y)) || [];

      for (const item of itens) {
        if (vistos.has(item)) continue;

        vistos.add(item);
        resultado.push(item);
      }
    }
  }

  return resultado.concat(cache.grandes);
}

// =====================================================
// VERIFICAR SE UMA ÁREA ESTÁ LIVRE
// =====================================================

/**
 * Verifica se um retângulo está livre de colisões estáticas habilitadas.
 */
function retanguloLivreDoMapa(scene, rect) {
  if (!scene || !rect) return false;

  const cache = criarIndice(scene);

  for (const item of candidatos(cache, rect)) {
    if (item.body.enable === false) {
      continue;
    }

    if (Phaser.Geom.Intersects.RectangleToRectangle(rect, item.rect)) {
      return false;
    }
  }

  return true;
}

// =====================================================
// VERIFICAR LINHA DE VISÃO / CAMINHO
// =====================================================

/**
 * Testa se algum obstáculo intercepta o segmento entre inimigo e alvo.
 */
function caminhoDiretoBloqueado(scene, inimigo, alvo) {
  if (!scene || !inimigo || !alvo) {
    return false;
  }

  const coordenadas = [inimigo.x, inimigo.y, alvo.x, alvo.y];

  if (!coordenadas.every(Number.isFinite)) {
    return true;
  }

  const cache = criarIndice(scene);

  if (!cache.indice.size && !cache.grandes.length) {
    return false;
  }

  const x = Math.min(inimigo.x, alvo.x);

  const y = Math.min(inimigo.y, alvo.y);

  const area = new Phaser.Geom.Rectangle(
    x,
    y,
    Math.max(1, Math.abs(alvo.x - inimigo.x)),
    Math.max(1, Math.abs(alvo.y - inimigo.y)),
  );

  const linha = new Phaser.Geom.Line(inimigo.x, inimigo.y, alvo.x, alvo.y);

  for (const item of candidatos(cache, area)) {
    if (item.body.enable === false) {
      continue;
    }

    if (Phaser.Geom.Intersects.LineToRectangle(linha, item.rect)) {
      return true;
    }
  }

  return false;
}

// =====================================================
// VERIFICAR ESPAÇO PARA O CORPO DO ROBÔ
// =====================================================

/**
 * Posiciona hipoteticamente a hitbox do robô e verifica se cabe sem sobrepor o cenário.
 */
function livreParaInimigo(scene, inimigo, x, y, cache) {
  const largura = Math.max(14, Number(inimigo.body?.width) || 24);

  const altura = Math.max(14, Number(inimigo.body?.height) || 24);

  const deslocamentoX =
    (inimigo.body?.x ?? inimigo.x - largura / 2) + largura / 2 - inimigo.x;

  const deslocamentoY =
    (inimigo.body?.y ?? inimigo.y - altura / 2) + altura / 2 - inimigo.y;

  const rect = new Phaser.Geom.Rectangle(
    x + deslocamentoX - largura / 2,
    y + deslocamentoY - altura / 2,
    largura,
    altura,
  );

  for (const item of candidatos(cache, rect)) {
    if (item.body.enable === false) {
      continue;
    }

    if (Phaser.Geom.Intersects.RectangleToRectangle(rect, item.rect)) {
      return false;
    }
  }

  return true;
}

// =====================================================
// A* OTIMIZADO
// =====================================================

/**
 * Busca uma sequência de pontos livres com A*, limitando distância, região de busca e número
 * de expansões.
 */
function calcularRotaAStar(scene, inimigo, alvo) {
  const cache = criarIndice(scene);

  if (!cache.indice.size && !cache.grandes.length) {
    return [];
  }

  const d = Phaser.Math.Distance.Between(inimigo.x, inimigo.y, alvo.x, alvo.y);

  if (!Number.isFinite(d) || d > CONFIG.distanciaMaximaRota) {
    return [];
  }

  const cel = CONFIG.tamanhoCelula;
  const margem = CONFIG.margemRota;

  const minX = Math.floor((Math.min(inimigo.x, alvo.x) - margem) / cel);

  const maxX = Math.ceil((Math.max(inimigo.x, alvo.x) + margem) / cel);

  const minY = Math.floor((Math.min(inimigo.y, alvo.y) - margem) / cel);

  const maxY = Math.ceil((Math.max(inimigo.y, alvo.y) + margem) / cel);

  const inicio = {
    x: Math.floor(inimigo.x / cel),
    y: Math.floor(inimigo.y / cel),
  };

  let fim = {
    x: Math.floor(alvo.x / cel),
    y: Math.floor(alvo.y / cel),
  };

  const livres = new Map();

  /**
   * Consulta e memoriza se uma célula da busca está dentro da região permitida e livre para o
   * robô.
   */
  function podePassar(x, y) {
    if (x < minX || x > maxX || y < minY || y > maxY) {
      return false;
    }

    const id = chave(x, y);

    if (livres.has(id)) {
      return livres.get(id);
    }

    const valor = livreParaInimigo(
      scene,
      inimigo,
      (x + 0.5) * cel,
      (y + 0.5) * cel,
      cache,
    );

    livres.set(id, valor);

    return valor;
  }

  // Se o destino encostou numa parede,
  // procura uma célula livre próxima.

  if (!podePassar(fim.x, fim.y)) {
    let maisProximo = Infinity;
    let novoFim = null;

    for (let ry = -3; ry <= 3; ry++) {
      for (let rx = -3; rx <= 3; rx++) {
        const x = fim.x + rx;
        const y = fim.y + ry;

        if (!podePassar(x, y)) {
          continue;
        }

        const pontuacao = rx * rx + ry * ry;

        if (pontuacao < maisProximo) {
          maisProximo = pontuacao;

          novoFim = {
            x,
            y,
          };
        }
      }
    }

    if (!novoFim) return [];

    fim = novoFim;
  }

  /**
   * Estima a distância restante até a célula de destino para priorizar a busca A*.
   */
  function heuristica(x, y) {
    return Math.hypot(fim.x - x, fim.y - y);
  }

  const inicial = chave(inicio.x, inicio.y);

  const aberto = [
    {
      x: inicio.x,
      y: inicio.y,
      f: heuristica(inicio.x, inicio.y),
    },
  ];

  const g = new Map([[inicial, 0]]);

  const pais = new Map();
  const fechados = new Set();

  let expansoes = 0;

  // ============================================
  // FILA DE PRIORIDADE: MIN-HEAP
  // ============================================

  /**
   * Insere um nó na fila mínima, subindo-o até respeitar a ordem de prioridade f.
   */
  function push(no) {
    aberto.push(no);

    let i = aberto.length - 1;

    while (i > 0) {
      const pai = Math.floor((i - 1) / 2);

      if (aberto[pai].f <= aberto[i].f) {
        break;
      }

      [aberto[pai], aberto[i]] = [aberto[i], aberto[pai]];

      i = pai;
    }
  }

  /**
   * Remove o nó de menor custo estimado e reorganiza a fila mínima de busca.
   */
  function pop() {
    if (!aberto.length) return null;

    const primeiro = aberto[0];
    const ultimo = aberto.pop();

    if (aberto.length) {
      aberto[0] = ultimo;

      let i = 0;

      while (true) {
        const e = i * 2 + 1;
        const d = e + 1;

        let menor = i;

        if (e < aberto.length && aberto[e].f < aberto[menor].f) {
          menor = e;
        }

        if (d < aberto.length && aberto[d].f < aberto[menor].f) {
          menor = d;
        }

        if (menor === i) break;

        [aberto[i], aberto[menor]] = [aberto[menor], aberto[i]];

        i = menor;
      }
    }

    return primeiro;
  }

  // ============================================
  // LOOP PRINCIPAL DO A*
  // ============================================

  while (aberto.length && expansoes < CONFIG.expansoesMaximas) {
    const atual = pop();

    const id = chave(atual.x, atual.y);

    if (fechados.has(id)) {
      continue;
    }

    fechados.add(id);
    expansoes++;

    // ==========================================
    // DESTINO ENCONTRADO
    // ==========================================

    if (atual.x === fim.x && atual.y === fim.y) {
      const pontos = [];

      let atualId = id;

      while (atualId && pontos.length < CONFIG.expansoesMaximas) {
        const [cx, cy] = atualId.split(",").map(Number);

        pontos.push({
          x: (cx + 0.5) * cel,
          y: (cy + 0.5) * cel,
        });

        atualId = pais.get(atualId);
      }

      pontos.reverse();

      if (pontos.length) {
        pontos.shift();
      }

      return pontos;
    }

    // ==========================================
    // ANALISAR VIZINHOS
    // ==========================================

    for (const [dx, dy, custo] of direcoes) {
      const nx = atual.x + dx;
      const ny = atual.y + dy;

      if (!podePassar(nx, ny)) {
        continue;
      }

      // Impede atravessar quinas na diagonal.
      if (
        dx !== 0 &&
        dy !== 0 &&
        (!podePassar(atual.x + dx, atual.y) ||
          !podePassar(atual.x, atual.y + dy))
      ) {
        continue;
      }

      const vizinho = chave(nx, ny);

      if (fechados.has(vizinho)) {
        continue;
      }

      const custoTotal = (g.get(id) ?? Infinity) + custo;

      if (custoTotal >= (g.get(vizinho) ?? Infinity)) {
        continue;
      }

      pais.set(vizinho, id);
      g.set(vizinho, custoTotal);

      push({
        x: nx,
        y: ny,
        f: custoTotal + heuristica(nx, ny),
      });
    }
  }

  return [];
}

// =====================================================
// ATUALIZAÇÃO DA ROTA DE UM INIMIGO
// =====================================================

/**
 * Recalcula a rota apenas quando necessário e quando o orçamento compartilhado de buscas
 * permite.
 */
function atualizarRotaSeguindoInimigo(scene, inimigo, alvo, time = 0) {
  if (!scene || !inimigo?.active || !alvo) {
    return false;
  }

  // Se o caminho direto ficou livre,
  // não precisa manter uma rota A*.

  if (!caminhoDiretoBloqueado(scene, inimigo, alvo)) {
    inimigo.rotaAtual = [];
    inimigo.indiceRota = 0;

    return false;
  }

  const rotaExistente =
    Array.isArray(inimigo.rotaAtual) &&
    inimigo.indiceRota < inimigo.rotaAtual.length;

  const destino = inimigo.ultimoDestinoRota;

  const mudouAlvo =
    !destino ||
    Phaser.Math.Distance.Between(destino.x, destino.y, alvo.x, alvo.y) > 90;

  if (
    rotaExistente &&
    !mudouAlvo &&
    time < (inimigo.ultimoCalculoRota || 0) + CONFIG.intervaloRecalculo
  ) {
    return true;
  }

  if (time < (inimigo.ultimoCalculoRota || -Infinity) + 500) {
    return rotaExistente;
  }

  // ============================================
  // ORÇAMENTO DE BUSCAS POR FRAME
  // ============================================

  const cache = criarIndice(scene);

  const frame = Math.floor(time / 16.6667);

  if (cache.frameBusca !== frame) {
    cache.frameBusca = frame;
    cache.buscasNoFrame = 0;
  }

  if (cache.buscasNoFrame >= CONFIG.buscasPorFrame) {
    return rotaExistente;
  }

  cache.buscasNoFrame++;

  inimigo.ultimoCalculoRota = time;

  inimigo.ultimoDestinoRota = {
    x: alvo.x,
    y: alvo.y,
  };

  const rota = calcularRotaAStar(scene, inimigo, alvo);

  if (rota.length) {
    inimigo.rotaAtual = rota;
    inimigo.indiceRota = 0;

    inimigo.ultimaPosicaoRota = {
      x: inimigo.x,
      y: inimigo.y,
    };

    inimigo.tempoPreso = time;

    return true;
  }

  inimigo.rotaAtual = [];
  inimigo.indiceRota = 0;

  return false;
}

// =====================================================
// SEGUIR ROTA ATUAL
// =====================================================

/**
 * Avança pelos pontos da rota, atualiza a direção e detecta falta de progresso do robô.
 */
function seguirRotaAtual(scene, inimigo, alvo, time, atualizarDirecao) {
  if (!Array.isArray(inimigo?.rotaAtual) || !inimigo.rotaAtual.length) {
    return false;
  }

  // Pula pontos já alcançados.
  while (inimigo.indiceRota < inimigo.rotaAtual.length) {
    const ponto = inimigo.rotaAtual[inimigo.indiceRota];

    const distancia = Phaser.Math.Distance.Between(
      inimigo.x,
      inimigo.y,
      ponto.x,
      ponto.y,
    );

    if (distancia > CONFIG.toleranciaPonto) {
      break;
    }

    inimigo.indiceRota++;

    inimigo.ultimaPosicaoRota = {
      x: inimigo.x,
      y: inimigo.y,
    };

    inimigo.tempoPreso = time;
  }

  // Rota concluída.
  if (inimigo.indiceRota >= inimigo.rotaAtual.length) {
    inimigo.rotaAtual = [];
    inimigo.indiceRota = 0;

    inimigo.setVelocity(0, 0);

    return false;
  }

  // ============================================
  // DETECÇÃO DE ROBÔ PRESO
  // ============================================

  const posAnterior = inimigo.ultimaPosicaoRota;

  if (time - (inimigo.tempoPreso || time) > 1400) {
    if (
      posAnterior &&
      Phaser.Math.Distance.Between(
        posAnterior.x,
        posAnterior.y,
        inimigo.x,
        inimigo.y,
      ) < 10
    ) {
      inimigo.rotaAtual = [];
      inimigo.indiceRota = 0;

      inimigo.setVelocity(0, 0);

      return false;
    }

    inimigo.ultimaPosicaoRota = {
      x: inimigo.x,
      y: inimigo.y,
    };

    inimigo.tempoPreso = time;
  }

  // ============================================
  // MOVIMENTO AO PRÓXIMO PONTO
  // ============================================

  const ponto = inimigo.rotaAtual[inimigo.indiceRota];

  scene.physics.moveTo(inimigo, ponto.x, ponto.y, inimigo.velocidade);

  if (typeof atualizarDirecao === "function") {
    atualizarDirecao(scene, inimigo);
  }

  return true;
}

// =====================================================
// VISUALIZAÇÃO DE DEBUG DA ROTA
// =====================================================

/**
 * Desenha a rota e os pontos para diagnóstico quando a depuração está habilitada.
 */
function desenharDebugRotaInimigo(scene, inimigo) {
  if (!scene?.debugRotaRobos || !inimigo) {
    return;
  }

  if (!scene.debugRotaGraphics) {
    scene.debugRotaGraphics = scene.add.graphics().setDepth(200);
  }

  const g = scene.debugRotaGraphics;

  g.clear();

  g.lineStyle(2, 0xffcc00, 1);

  let anterior = {
    x: inimigo.x,
    y: inimigo.y,
  };

  const pontos = (inimigo.rotaAtual || []).slice(inimigo.indiceRota || 0);

  for (const p of pontos) {
    g.lineBetween(anterior.x, anterior.y, p.x, p.y);

    anterior = p;
  }

  g.fillStyle(0xff0000, 1);

  g.fillCircle(inimigo.x, inimigo.y, 3);
}

// =====================================================
// EXPORTAÇÕES
// =====================================================

export {
  obterFilhosGrupoSeguro,
  caminhoDiretoBloqueado,
  atualizarRotaSeguindoInimigo,
  seguirRotaAtual,
  desenharDebugRotaInimigo,
  retanguloLivreDoMapa,
  invalidarCacheNavegacao,
};
