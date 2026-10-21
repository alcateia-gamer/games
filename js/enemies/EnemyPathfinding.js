/**
 * @file Navegação dos robôs com índice espacial compartilhado, passagem da hitbox inteira e
 * A* com orçamento por frame. Linha de visão e espaço para caminhar são consultas diferentes.
 */

const CONFIG = Object.freeze({
  tamanhoCelula: 24,
  tamanhoIndice: 128,
  margemRota: 288,
  distanciaMaximaRota: 1400,
  expansoesMaximas: 3200,
  buscasPorFrame: 2,
  intervaloRecalculo: 1350,
  intervaloMinimo: 550,
  toleranciaPonto: 7,
  margemCorpo: 1.5,
});

const caches = new WeakMap();
const direcoes = [
  [0, -1, 1], [1, 0, 1], [0, 1, 1], [-1, 0, 1],
  [1, -1, Math.SQRT2], [1, 1, Math.SQRT2],
  [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

function obterFilhosGrupoSeguro(grupo) {
  if (!grupo?.getChildren) return [];
  try {
    const filhos = grupo.getChildren();
    return Array.isArray(filhos) ? filhos : [];
  } catch (_) {
    return [];
  }
}

function chave(x, y) {
  return `${x},${y}`;
}

function limites(x, y, largura, altura) {
  return { left: x, top: y, right: x + largura, bottom: y + altura };
}

function limitesCorpo(body) {
  return limites(body.x, body.y, body.width, body.height);
}

function corpoValido(body) {
  return body && body.enable !== false &&
    [body.x, body.y, body.width, body.height].every(Number.isFinite) &&
    body.width > 0 && body.height > 0;
}

/** Corpos estáticos que mudarem de posição/tamanho devem invalidar o índice. */
function criarIndice(scene) {
  const grupo = scene?.collisionGroup;
  const filhos = obterFilhosGrupoSeguro(grupo);
  const anterior = caches.get(scene);
  if (anterior && anterior.grupo === grupo && anterior.quantidade === filhos.length) {
    return anterior;
  }

  const indice = new Map();
  const grandes = [];
  for (const bloco of filhos) {
    const body = bloco?.body;
    if (!corpoValido(body)) continue;
    const rect = limitesCorpo(body);
    const item = { rect, body, consulta: 0 };
    const minX = Math.floor(rect.left / CONFIG.tamanhoIndice);
    const maxX = Math.floor(rect.right / CONFIG.tamanhoIndice);
    const minY = Math.floor(rect.top / CONFIG.tamanhoIndice);
    const maxY = Math.floor(rect.bottom / CONFIG.tamanhoIndice);
    if ((maxX - minX + 1) * (maxY - minY + 1) > 256) {
      grandes.push(item);
      continue;
    }
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const id = chave(x, y);
        if (!indice.has(id)) indice.set(id, []);
        indice.get(id).push(item);
      }
    }
  }

  const cache = {
    grupo, quantidade: filhos.length, indice, grandes,
    consulta: 0, frameBusca: -1, buscasNoFrame: 0,
  };
  caches.set(scene, cache);
  return cache;
}

function invalidarCacheNavegacao(scene) {
  if (scene) caches.delete(scene);
}

/** Evita montar arrays e Sets em cada consulta das milhares de células do A*. */
function algumObstaculo(cache, area, testar, dinamicos = []) {
  const consulta = ++cache.consulta;
  const minX = Math.floor(area.left / CONFIG.tamanhoIndice);
  const maxX = Math.floor(area.right / CONFIG.tamanhoIndice);
  const minY = Math.floor(area.top / CONFIG.tamanhoIndice);
  const maxY = Math.floor(area.bottom / CONFIG.tamanhoIndice);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const itens = cache.indice.get(chave(x, y));
      if (!itens) continue;
      for (const item of itens) {
        if (item.consulta === consulta || item.body.enable === false) continue;
        item.consulta = consulta;
        if (testar(item.rect)) return true;
      }
    }
  }
  for (const item of cache.grandes) {
    if (item.body.enable !== false && testar(item.rect)) return true;
  }
  for (const rect of dinamicos) {
    if (testar(rect)) return true;
  }
  return false;
}

function sobrepoe(a, b) {
  return a.left < b.right && a.right > b.left &&
    a.top < b.bottom && a.bottom > b.top;
}

function retanguloLivreDoMapa(scene, rect) {
  if (!scene || !rect) return false;
  const area = limites(rect.x, rect.y, rect.width, rect.height);
  if (!Object.values(area).every(Number.isFinite)) return false;
  return !algumObstaculo(criarIndice(scene), area, (obstaculo) => sobrepoe(area, obstaculo));
}

/** Interseção exata de um segmento com AABB, incluindo obstáculos finos entre as células. */
function segmentoTocaRetangulo(x1, y1, x2, y2, rect) {
  let entrada = 0;
  let saida = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (Math.abs(dx) < 0.000001) {
    if (x1 < rect.left || x1 > rect.right) return false;
  } else {
    const a = (rect.left - x1) / dx;
    const b = (rect.right - x1) / dx;
    entrada = Math.max(entrada, Math.min(a, b));
    saida = Math.min(saida, Math.max(a, b));
    if (entrada > saida) return false;
  }
  if (Math.abs(dy) < 0.000001) {
    if (y1 < rect.top || y1 > rect.bottom) return false;
  } else {
    const a = (rect.top - y1) / dy;
    const b = (rect.bottom - y1) / dy;
    entrada = Math.max(entrada, Math.min(a, b));
    saida = Math.min(saida, Math.max(a, b));
    if (entrada > saida) return false;
  }
  return true;
}

function coordenadasValidas(a, b) {
  return a && b && [a.x, a.y, b.x, b.y].every(Number.isFinite);
}

/** Visão/tiro: mantém o teste pontual, independente da hitbox de caminhada. */
function caminhoDiretoBloqueado(scene, inimigo, alvo) {
  if (!scene || !inimigo || !alvo) return false;
  if (!coordenadasValidas(inimigo, alvo)) return true;
  const area = {
    left: Math.min(inimigo.x, alvo.x), right: Math.max(inimigo.x, alvo.x),
    top: Math.min(inimigo.y, alvo.y), bottom: Math.max(inimigo.y, alvo.y),
  };
  return algumObstaculo(criarIndice(scene), area, (rect) =>
    segmentoTocaRetangulo(inimigo.x, inimigo.y, alvo.x, alvo.y, rect));
}

/** O centro físico dos pés não coincide com a posição visual do sprite. */
function geometriaInimigo(inimigo) {
  const body = inimigo.body;
  const largura = body?.width > 0 ? body.width : 24;
  const altura = body?.height > 0 ? body.height : 24;
  return {
    meiaLargura: largura / 2 + CONFIG.margemCorpo,
    meiaAltura: altura / 2 + CONFIG.margemCorpo,
    deslocamentoX: Number.isFinite(body?.x) ? body.x + largura / 2 - inimigo.x : 0,
    deslocamentoY: Number.isFinite(body?.y) ? body.y + altura / 2 - inimigo.y : 0,
  };
}

function areaInimigo(geometria, ponto) {
  const x = ponto.x + geometria.deslocamentoX;
  const y = ponto.y + geometria.deslocamentoY;
  return limites(x - geometria.meiaLargura, y - geometria.meiaAltura,
    geometria.meiaLargura * 2, geometria.meiaAltura * 2);
}

function dentroDosLimites(scene, inimigo, area) {
  const mundo = scene.physics?.world?.bounds;
  if (!inimigo.body?.collideWorldBounds || !mundo) return true;
  return area.left >= mundo.x && area.top >= mundo.y &&
    area.right <= mundo.x + mundo.width && area.bottom <= mundo.y + mundo.height;
}

function livreParaInimigo(scene, inimigo, ponto, cache, geometria, dinamicos) {
  const area = areaInimigo(geometria, ponto);
  return dentroDosLimites(scene, inimigo, area) &&
    !algumObstaculo(cache, area, (rect) => sobrepoe(area, rect), dinamicos);
}

/** Permite se soltar de uma sobreposição inicial somente pela borda mais próxima. */
function estaSaindoDaColisao(origem, destino, rect) {
  if (origem.x < rect.left || origem.x > rect.right ||
      origem.y < rect.top || origem.y > rect.bottom) return false;
  const distancias = [origem.x - rect.left, rect.right - origem.x,
    origem.y - rect.top, rect.bottom - origem.y];
  const menor = Math.min(...distancias);
  return (distancias[0] <= menor + 0.01 && destino.x < rect.left) ||
    (distancias[1] <= menor + 0.01 && destino.x > rect.right) ||
    (distancias[2] <= menor + 0.01 && destino.y < rect.top) ||
    (distancias[3] <= menor + 0.01 && destino.y > rect.bottom);
}

/** Varre a hitbox inteira expandindo obstáculos, sem amostragens que cortariam quinas. */
function movimentoBloqueado(scene, inimigo, origem, destino, cache, geometria, dinamicos = [], permitirSaida = false) {
  const inicial = areaInimigo(geometria, origem);
  const final = areaInimigo(geometria, destino);
  if (!dentroDosLimites(scene, inimigo, final)) return true;
  const area = {
    left: Math.min(inicial.left, final.left), right: Math.max(inicial.right, final.right),
    top: Math.min(inicial.top, final.top), bottom: Math.max(inicial.bottom, final.bottom),
  };
  const inicio = { x: origem.x + geometria.deslocamentoX, y: origem.y + geometria.deslocamentoY };
  const fim = { x: destino.x + geometria.deslocamentoX, y: destino.y + geometria.deslocamentoY };
  return algumObstaculo(cache, area, (rect) => {
    const expandido = {
      left: rect.left - geometria.meiaLargura, right: rect.right + geometria.meiaLargura,
      top: rect.top - geometria.meiaAltura, bottom: rect.bottom + geometria.meiaAltura,
    };
    if (permitirSaida && estaSaindoDaColisao(inicio, fim, expandido)) return false;
    return segmentoTocaRetangulo(inicio.x, inicio.y, fim.x, fim.y, expandido);
  }, dinamicos);
}

/** Passagem física: considera dimensões e deslocamento do corpo, ao contrário da visão. */
function caminhoMovimentoBloqueado(scene, inimigo, destino) {
  if (!scene || !coordenadasValidas(inimigo, destino)) return true;
  return movimentoBloqueado(scene, inimigo, inimigo, destino, criarIndice(scene),
    geometriaInimigo(inimigo), [], true);
}

/** Só considera outros robôs durante a recuperação; evita recalcular por cada aliado andando. */
function obstaculosDinamicos(scene, inimigo, time) {
  if (!(inimigo.iaForcarRotaAte > time)) return [];
  const resultado = [];
  for (const outro of scene.inimigos || []) {
    if (outro === inimigo || !outro?.active || outro.morto || !corpoValido(outro.body)) continue;
    if (Math.hypot(outro.x - inimigo.x, outro.y - inimigo.y) > 400) continue;
    resultado.push(limitesCorpo(outro.body));
  }
  return resultado;
}

class FilaMinima {
  constructor() { this.itens = []; }
  inserir(no) {
    const itens = this.itens;
    let i = itens.length;
    itens.push(no);
    while (i > 0) {
      const pai = (i - 1) >> 1;
      if (itens[pai].f <= no.f) break;
      itens[i] = itens[pai];
      i = pai;
    }
    itens[i] = no;
  }
  retirar() {
    const itens = this.itens;
    const primeiro = itens[0];
    const ultimo = itens.pop();
    if (itens.length) {
      let i = 0;
      while (i * 2 + 1 < itens.length) {
        let filho = i * 2 + 1;
        if (filho + 1 < itens.length && itens[filho + 1].f < itens[filho].f) filho++;
        if (itens[filho].f >= ultimo.f) break;
        itens[i] = itens[filho];
        i = filho;
      }
      itens[i] = ultimo;
    }
    return primeiro;
  }
}

/** Remove zigue-zagues somente quando a hitbox inteira atravessa o atalho. */
function simplificarRota(scene, inimigo, pontos, cache, geometria, dinamicos) {
  const resultado = [];
  let origem = inimigo;
  let i = 0;
  while (i < pontos.length) {
    let proximo = i;
    for (let j = Math.min(pontos.length - 1, i + 15); j > i; j--) {
      if (!movimentoBloqueado(scene, inimigo, origem, pontos[j], cache, geometria, dinamicos, true)) {
        proximo = j;
        break;
      }
    }
    resultado.push(pontos[proximo]);
    origem = pontos[proximo];
    i = proximo + 1;
  }
  return resultado;
}

/** A grade parte da posição real do robô: não o encaixa em uma célula dentro da parede. */
function calcularRotaAStar(scene, inimigo, alvo, cache, time, cel = CONFIG.tamanhoCelula,
  orcamento = { restante: CONFIG.expansoesMaximas }) {
  const distancia = Math.hypot(alvo.x - inimigo.x, alvo.y - inimigo.y);
  if (!Number.isFinite(distancia) || distancia > CONFIG.distanciaMaximaRota) return [];
  // Uma passagem de 60px cabe no atirador, mas pode cair entre duas colunas de 24px.
  // Refina apenas se a grade grossa falhar e ainda houver expansões no mesmo orçamento.
  const tentarRefinada = () => cel > 12 && orcamento.restante > 0
    ? calcularRotaAStar(scene, inimigo, alvo, cache, time, 12, orcamento) : [];
  const geometria = geometriaInimigo(inimigo);
  const dinamicos = obstaculosDinamicos(scene, inimigo, time);
  const alvoX = (alvo.x - inimigo.x) / cel;
  const alvoY = (alvo.y - inimigo.y) / cel;
  const margem = CONFIG.margemRota / cel;
  const minX = Math.floor(Math.min(0, alvoX) - margem);
  const maxX = Math.ceil(Math.max(0, alvoX) + margem);
  const minY = Math.floor(Math.min(0, alvoY) - margem);
  const maxY = Math.ceil(Math.max(0, alvoY) + margem);
  const colunas = maxX - minX + 1;
  const total = colunas * (maxY - minY + 1);
  const livres = new Int8Array(total);
  const custos = new Float64Array(total).fill(Infinity);
  const pais = new Int32Array(total).fill(-1);
  const fechados = new Uint8Array(total);
  const fila = new FilaMinima();
  const idCelula = (x, y) => (y - minY) * colunas + x - minX;
  const pontoCelula = (x, y) => ({ x: inimigo.x + x * cel, y: inimigo.y + y * cel });
  const coordenadasCelula = (id) => ({ x: id % colunas + minX, y: Math.floor(id / colunas) + minY });
  function podePassar(x, y) {
    if (x < minX || x > maxX || y < minY || y > maxY) return false;
    const id = idCelula(x, y);
    if (!livres[id]) {
      livres[id] = livreParaInimigo(scene, inimigo, pontoCelula(x, y), cache, geometria, dinamicos) ? 1 : -1;
    }
    return livres[id] > 0;
  }

  // Aceita diferentes aproximações ao alvo, evitando escolher a outra face de uma parede.
  const destinoLivre = livreParaInimigo(scene, inimigo, alvo, cache, geometria, dinamicos);
  const finais = new Set();
  const fimX = Math.round(alvoX);
  const fimY = Math.round(alvoY);
  let menorDistanciaFinal = Infinity;
  const candidatosFinais = [];
  for (let y = fimY - 4; y <= fimY + 4; y++) {
    for (let x = fimX - 4; x <= fimX + 4; x++) {
      if (!podePassar(x, y)) continue;
      const ponto = pontoCelula(x, y);
      if (destinoLivre && movimentoBloqueado(scene, inimigo, ponto, alvo, cache, geometria, dinamicos)) continue;
      const d = Math.hypot(x - alvoX, y - alvoY);
      menorDistanciaFinal = Math.min(menorDistanciaFinal, d);
      candidatosFinais.push({ id: idCelula(x, y), d });
    }
  }
  for (const candidato of candidatosFinais) {
    if (candidato.d <= menorDistanciaFinal + 0.75) finais.add(candidato.id);
  }
  if (!finais.size) return tentarRefinada();

  // A heurística octil fica admissível para qualquer uma das células finais.
  const raioFinal = menorDistanciaFinal + 0.75;
  function heuristica(x, y) {
    const dx = Math.abs(alvoX - x);
    const dy = Math.abs(alvoY - y);
    return Math.max(0, Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy) - raioFinal * Math.SQRT2);
  }
  function inserirInicio(x, y) {
    const id = idCelula(x, y);
    const g = Math.hypot(x, y);
    custos[id] = g;
    fila.inserir({ x, y, id, g, f: g + heuristica(x, y) });
  }
  if (podePassar(0, 0)) {
    inserirInicio(0, 0);
  } else {
    // Também consegue sair de um spawn/empurrão parcialmente sobreposto ao cenário.
    for (let y = -3; y <= 3; y++) {
      for (let x = -3; x <= 3; x++) {
        if (!podePassar(x, y)) continue;
        const ponto = pontoCelula(x, y);
        if (!movimentoBloqueado(scene, inimigo, inimigo, ponto, cache, geometria, dinamicos, true)) inserirInicio(x, y);
      }
    }
  }

  let encontrado = -1;
  let maisProximo = -1;
  let distanciaMaisProximo = Math.hypot(alvoX, alvoY);
  let expansoes = 0;
  while (fila.itens.length && expansoes < orcamento.restante) {
    const atual = fila.retirar();
    if (fechados[atual.id] || atual.g !== custos[atual.id]) continue;
    fechados[atual.id] = 1;
    expansoes++;
    const d = Math.hypot(alvoX - atual.x, alvoY - atual.y);
    if (d < distanciaMaisProximo - 0.01) {
      distanciaMaisProximo = d;
      maisProximo = atual.id;
    }
    if (finais.has(atual.id)) {
      encontrado = atual.id;
      break;
    }
    const pontoAtual = pontoCelula(atual.x, atual.y);
    for (const [dx, dy, custo] of direcoes) {
      const x = atual.x + dx;
      const y = atual.y + dy;
      if (!podePassar(x, y)) continue;
      const id = idCelula(x, y);
      if (fechados[id] || atual.g + custo >= custos[id]) continue;
      if (dx && dy && (!podePassar(atual.x + dx, atual.y) || !podePassar(atual.x, atual.y + dy))) continue;
      // Células livres isoladamente não garantem que o trecho entre elas esteja livre.
      if (movimentoBloqueado(scene, inimigo, pontoAtual, pontoCelula(x, y), cache, geometria, dinamicos)) continue;
      const g = atual.g + custo;
      custos[id] = g;
      pais[id] = atual.id;
      fila.inserir({ x, y, id, g, f: g + heuristica(x, y) });
    }
  }
  orcamento.restante -= expansoes;

  // Alvos em colisão podem ser investigados pela face acessível mais próxima da parede.
  if (encontrado < 0 && !destinoLivre && maisProximo >= 0) encontrado = maisProximo;
  if (encontrado < 0) return tentarRefinada();
  const pontos = [];
  let id = encontrado;
  while (id >= 0 && pontos.length < CONFIG.expansoesMaximas) {
    const { x, y } = coordenadasCelula(id);
    if (x || y) pontos.push(pontoCelula(x, y));
    id = pais[id];
  }
  pontos.reverse();
  if (destinoLivre) pontos.push({ x: alvo.x, y: alvo.y });
  return simplificarRota(scene, inimigo, pontos, cache, geometria, dinamicos);
}

/**
 * Mantém o retorno booleano. rotaPendente/proximaTentativaRota informam quando o orçamento
 * ou intervalo mínimo adiou uma busca, para a IA tentar novamente sem esperar outra decisão.
 */
function atualizarRotaSeguindoInimigo(scene, inimigo, alvo, time = 0) {
  if (!scene || !inimigo?.active || !coordenadasValidas(inimigo, alvo)) return false;
  inimigo.rotaPendente = false;
  const forcar = inimigo.iaForcarRotaAte > time;
  if (!forcar && !caminhoMovimentoBloqueado(scene, inimigo, alvo)) {
    inimigo.rotaAtual = [];
    inimigo.indiceRota = 0;
    return false;
  }
  const rotaExistente = Array.isArray(inimigo.rotaAtual) &&
    (inimigo.indiceRota || 0) < inimigo.rotaAtual.length;
  const destino = inimigo.ultimoDestinoRota;
  const mudouAlvo = !destino || Math.hypot(destino.x - alvo.x, destino.y - alvo.y) > 64;
  const ultimoCalculo = destino ? (inimigo.ultimoCalculoRota ?? -Infinity) : -Infinity;
  if (rotaExistente && !mudouAlvo && time < ultimoCalculo + CONFIG.intervaloRecalculo) return true;
  const intervaloMinimo = inimigo.rotaInvalidada || (!rotaExistente && forcar) ? 180 : CONFIG.intervaloMinimo;
  if (time < ultimoCalculo + intervaloMinimo) {
    inimigo.rotaPendente = true;
    inimigo.proximaTentativaRota = ultimoCalculo + intervaloMinimo;
    return rotaExistente;
  }

  const cache = criarIndice(scene);
  const frame = scene.game?.loop?.frame ?? Math.floor(time / 16.6667);
  if (cache.frameBusca !== frame) {
    cache.frameBusca = frame;
    cache.buscasNoFrame = 0;
  }
  if (cache.buscasNoFrame >= CONFIG.buscasPorFrame) {
    inimigo.rotaPendente = true;
    inimigo.proximaTentativaRota = time + 17;
    return rotaExistente;
  }
  cache.buscasNoFrame++;
  inimigo.ultimoCalculoRota = time;
  inimigo.ultimoDestinoRota = { x: alvo.x, y: alvo.y };
  inimigo.proximaTentativaRota = time + CONFIG.intervaloMinimo;
  inimigo.rotaInvalidada = false;
  const rota = calcularRotaAStar(scene, inimigo, alvo, cache, time);
  inimigo.rotaAtual = rota;
  inimigo.indiceRota = 0;
  inimigo.ultimaPosicaoRota = { x: inimigo.x, y: inimigo.y };
  inimigo.tempoPreso = time;
  return rota.length > 0;
}

function descartarRotaBloqueada(inimigo, time) {
  inimigo.rotaAtual = [];
  inimigo.indiceRota = 0;
  inimigo.rotaInvalidada = true;
  inimigo.iaProximaRota = 0;
  inimigo.iaForcarRotaAte = Math.max(inimigo.iaForcarRotaAte || 0, time + 1600);
  inimigo.proximaTentativaRota = time;
  inimigo.setVelocity(0, 0);
}

/** Valida os trechos durante a caminhada e interrompe cedo uma rota sem progresso. */
function seguirRotaAtual(scene, inimigo, alvo, time = 0, atualizarDirecao, velocidade = inimigo?.velocidade) {
  if (!scene || !inimigo?.rotaAtual?.length) return false;
  const cache = criarIndice(scene);
  const geometria = geometriaInimigo(inimigo);
  const dinamicos = obstaculosDinamicos(scene, inimigo, time);
  const bloqueado = (ponto) => movimentoBloqueado(scene, inimigo, inimigo, ponto, cache, geometria, dinamicos, true);
  inimigo.indiceRota ||= 0;
  while (inimigo.indiceRota < inimigo.rotaAtual.length) {
    const ponto = inimigo.rotaAtual[inimigo.indiceRota];
    const d = Math.hypot(ponto.x - inimigo.x, ponto.y - inimigo.y);
    if (d > CONFIG.toleranciaPonto) break;
    const proximo = inimigo.rotaAtual[inimigo.indiceRota + 1];
    // Não abandona cedo um ponto junto à quina se isso cortaria a parede.
    if (proximo && d > 1.5 && bloqueado(proximo)) break;
    inimigo.indiceRota++;
  }
  if (inimigo.indiceRota >= inimigo.rotaAtual.length) {
    inimigo.rotaAtual = [];
    inimigo.indiceRota = 0;
    inimigo.setVelocity(0, 0);
    return false;
  }
  if (bloqueado(inimigo.rotaAtual[inimigo.indiceRota])) {
    descartarRotaBloqueada(inimigo, time);
    return false;
  }
  // Pode avançar pontos visíveis, sempre mantendo folga para a hitbox inteira.
  for (let i = Math.min(inimigo.rotaAtual.length - 1, inimigo.indiceRota + 5); i > inimigo.indiceRota; i--) {
    if (!bloqueado(inimigo.rotaAtual[i])) {
      inimigo.indiceRota = i;
      break;
    }
  }

  if (!inimigo.ultimaPosicaoRota || !Number.isFinite(inimigo.tempoPreso)) {
    inimigo.ultimaPosicaoRota = { x: inimigo.x, y: inimigo.y };
    inimigo.tempoPreso = time;
  } else if (time - inimigo.tempoPreso >= 800) {
    const anterior = inimigo.ultimaPosicaoRota;
    if (Math.hypot(anterior.x - inimigo.x, anterior.y - inimigo.y) < 4) {
      descartarRotaBloqueada(inimigo, time);
      return false;
    }
    inimigo.ultimaPosicaoRota = { x: inimigo.x, y: inimigo.y };
    inimigo.tempoPreso = time;
  }
  const ponto = inimigo.rotaAtual[inimigo.indiceRota];
  scene.physics.moveTo(inimigo, ponto.x, ponto.y, velocidade);
  if (typeof atualizarDirecao === "function") atualizarDirecao(scene, inimigo);
  return true;
}

function desenharDebugRotaInimigo(scene, inimigo) {
  if (!scene?.debugRotaRobos || !inimigo) return;
  if (!scene.debugRotaGraphics) scene.debugRotaGraphics = scene.add.graphics().setDepth(200);
  const g = scene.debugRotaGraphics;
  g.clear();
  g.lineStyle(2, 0xffcc00, 1);
  let anterior = inimigo;
  for (const ponto of (inimigo.rotaAtual || []).slice(inimigo.indiceRota || 0)) {
    g.lineBetween(anterior.x, anterior.y, ponto.x, ponto.y);
    anterior = ponto;
  }
  g.fillStyle(0xff0000, 1);
  g.fillCircle(inimigo.x, inimigo.y, 3);
}

export {
  obterFilhosGrupoSeguro,
  caminhoDiretoBloqueado,
  caminhoMovimentoBloqueado,
  atualizarRotaSeguindoInimigo,
  seguirRotaAtual,
  desenharDebugRotaInimigo,
  retanguloLivreDoMapa,
  invalidarCacheNavegacao,
};
