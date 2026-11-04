/** Visibilidade da lanterna: contornos do mapa indexados uma vez, portas consultadas ao mudar. */
const ALCANCE = 360;
const CELULA = 128;
const VOLTA = Math.PI * 2;
const CAMADAS_PAREDE = new Set(["ParedeAbaixoPerso", "ParedeAcimaPerso"]);

function segmento(ax, ay, bx, by, regiao = null) {
  return { ax, ay, bx, by, minX: Math.min(ax, bx), minY: Math.min(ay, by),
    maxX: Math.max(ax, bx), maxY: Math.max(ay, by), consulta: 0, regiao };
}

function contorno(pontos, destino, fechado = true) {
  const regiao = fechado ? {} : null;
  if (fechado) {
    let area = 0;
    for (let i = 0; i < pontos.length; i++) {
      const a = pontos[i], b = pontos[(i+1) % pontos.length];
      area += a.x * b.y - b.x * a.y;
    }
    if (area < 0) pontos = [...pontos].reverse();
  }
  for (let i = 0; i < pontos.length - (fechado ? 0 : 1); i++) {
    const a = pontos[i], b = pontos[(i + 1) % pontos.length];
    destino.push(segmento(a.x, a.y, b.x, b.y, regiao));
  }
}

function retangulo(x, y, width, height, destino) {
  if (!(width > 0 && height > 0)) return;
  contorno([{ x, y }, { x: x + width, y }, { x: x + width, y: y + height },
    { x, y: y + height }], destino);
}

function lerContornosMapa(map) {
  const segmentos = [];
  const camada = map?.getObjectLayer?.("collision");
  for (const objeto of camada?.objects ?? []) {
    // A colisão de móveis e máquinas impede o movimento, mas não apaga sua iluminação.
    // Geometria extra só participa quando o autor a identifica explicitamente como parede.
    const tipo = String(objeto.type || objeto.class || "").trim().toLowerCase();
    if (tipo !== "parede" && tipo !== "wall") continue;
    if (!Number.isFinite(objeto.x) || !Number.isFinite(objeto.y)) continue;
    const locais = objeto.polygon ?? objeto.polyline ??
      (objeto.width > 0 && objeto.height > 0 ? [{ x: 0, y: 0 }, { x: objeto.width, y: 0 },
        { x: objeto.width, y: objeto.height }, { x: 0, y: objeto.height }] : []);
    if (locais.length < 2) continue;
    const angulo = (objeto.rotation ?? 0) * Math.PI / 180;
    const cos = Math.cos(angulo), sin = Math.sin(angulo);
    contorno(locais.map(p => ({ x: objeto.x + p.x * cos - p.y * sin,
      y: objeto.y + p.x * sin + p.y * cos })), segmentos, !objeto.polyline);
  }

  // Remove arestas compartilhadas: a luz consulta só a borda externa das paredes de tiles.
  const bordas = new Map();
  const adicionarBorda = (ax, ay, bx, by, regiao) => {
    const invertida = ax > bx || (ax === bx && ay > by);
    const chave = invertida ? `${bx},${by}:${ax},${ay}` : `${ax},${ay}:${bx},${by}`;
    if (bordas.has(chave)) bordas.delete(chave);
    else bordas.set(chave, segmento(ax, ay, bx, by, regiao));
  };
  // Cada camada é unida antes de combinar, preservando paredes sobrepostas entre camadas.
  for (const dados of map?.layers ?? []) {
    const layer = dados.tilemapLayer;
    if (!CAMADAS_PAREDE.has(dados.name) || !layer?.forEachTile) continue;
    bordas.clear();
    const regiao = {};
    layer.forEachTile(tile => {
      if (!tile || tile.index < 0) return;
      const p = layer.tileToWorldXY(tile.x, tile.y);
      const w = tile.width * (layer.scaleX ?? 1), h = tile.height * (layer.scaleY ?? 1);
      adicionarBorda(p.x, p.y, p.x + w, p.y, regiao);
      adicionarBorda(p.x + w, p.y, p.x + w, p.y + h, regiao);
      adicionarBorda(p.x + w, p.y + h, p.x, p.y + h, regiao);
      adicionarBorda(p.x, p.y + h, p.x, p.y, regiao);
    });
    segmentos.push(...bordas.values());
  }
  for (const objeto of map?.getObjectLayer?.("ParedePortaBoss")?.objects ?? []) {
    if (objeto.gid) retangulo(objeto.x, objeto.y - objeto.height, objeto.width, objeto.height, segmentos);
  }
  return segmentos;
}

/** Distância exata até uma aresta, inclusive obstáculos menores que um pixel. */
export function distanciaAresta(x, y, dx, dy, aresta) {
  const ex = aresta.bx - aresta.ax, ey = aresta.by - aresta.ay;
  const den = dx * ey - dy * ex;
  if (Math.abs(den) < 1e-10) return Infinity;
  const ax = aresta.ax - x, ay = aresta.ay - y;
  const t = (ax * ey - ay * ex) / den;
  const u = (ax * dy - ay * dx) / den;
  return t > 1e-7 && u >= -1e-9 && u <= 1 + 1e-9 ? t : Infinity;
}

export default class FlashlightWalls {
  constructor(scene) {
    this.scene = scene;
    this.indice = new Map();
    this.grandes = [];
    this.dinamicos = [];
    this.portas = new Map();
    this.proximas = [];
    this.angulos = [];
    this.pontos = [];
    this.intersecoes = [];
    this.cruzamentos = new Map();
    this.consulta = 0;
    this.revisao = 0;
    this.ultimo = { x: null, y: null, revisao: -1 };
    for (const aresta of lerContornosMapa(scene.map)) {
      const minX = Math.floor(aresta.minX / CELULA), maxX = Math.floor(aresta.maxX / CELULA);
      const minY = Math.floor(aresta.minY / CELULA), maxY = Math.floor(aresta.maxY / CELULA);
      if ((maxX - minX + 1) * (maxY - minY + 1) > 256) {
        this.grandes.push(aresta);
        continue;
      }
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const chave = `${x},${y}`;
        if (!this.indice.has(chave)) this.indice.set(chave, []);
        this.indice.get(chave).push(aresta);
      }
    }
  }

  atualizarPortas() {
    let alteradas = false, quantidade = 0;
    for (const porta of this.scene.portasFabrica ?? []) {
      const body = porta.colisao?.body;
      if (!body || body.enable === false) continue;
      quantidade++;
      const anterior = this.portas.get(porta);
      if (!anterior || anterior.x !== body.x || anterior.y !== body.y ||
          anterior.width !== body.width || anterior.height !== body.height) {
        this.portas.set(porta, { x: body.x, y: body.y, width: body.width, height: body.height });
        alteradas = true;
      }
    }
    if (quantidade !== this.portas.size) {
      for (const porta of this.portas.keys()) {
        if (!this.scene.portasFabrica?.includes(porta) || !porta.colisao?.body || porta.colisao.body.enable === false) {
          this.portas.delete(porta);
        }
      }
      alteradas = true;
    }
    if (alteradas) {
      this.dinamicos.length = 0;
      for (const rect of this.portas.values()) retangulo(rect.x, rect.y, rect.width, rect.height, this.dinamicos);
      this.revisao++;
    }
  }

  /** Ilumina a espessura da primeira parede atingida e para antes do espaço atrás. */
  calcularAlcance(x, y, dx, dy) {
    const hits = this.intersecoes;
    hits.length = 0;
    for (const aresta of this.proximas) {
      const distancia = distanciaAresta(x, y, dx, dy, aresta);
      if (distancia > ALCANCE) continue;
      const den = dx * (aresta.by - aresta.ay) - dy * (aresta.bx - aresta.ax);
      hits.push({ distancia, regiao: aresta.regiao, delta: den < 0 ? 1 : -1 });
    }
    hits.sort((a,b) => a.distancia - b.distancia);
    let profundidade = 0, atingiu = false;
    for (let i = 0; i < hits.length;) {
      const distancia = hits[i].distancia;
      this.cruzamentos.clear();
      // Duas arestas da mesma quina representam um único cruzamento da superfície.
      do {
        const hit = hits[i++];
        if (!hit.regiao) return distancia; // Parede definida por linha, sem espessura.
        this.cruzamentos.set(hit.regiao, (this.cruzamentos.get(hit.regiao) ?? 0) + hit.delta);
      } while (i < hits.length && Math.abs(hits[i].distancia - distancia) < 1e-7);
      let delta = 0;
      for (const contagem of this.cruzamentos.values()) delta += Math.sign(contagem);
      if (!delta) continue;
      if (!atingiu) {
        // A origem pode já estar na parede ao encostar nela com a barriga.
        if (delta < 0) return distancia;
        atingiu = true;
      }
      profundidade += delta;
      if (profundidade <= 0) return distancia;
    }
    return ALCANCE;
  }

  obterPoligono(x, y) {
    if (this.ultimo.x === x && this.ultimo.y === y && this.ultimo.revisao === this.revisao) return this.pontos;
    Object.assign(this.ultimo, { x, y, revisao: this.revisao });
    this.proximas.length = 0;
    const consulta = ++this.consulta;
    const incluir = aresta => {
      if (aresta.consulta === consulta || aresta.maxX < x - ALCANCE || aresta.minX > x + ALCANCE ||
          aresta.maxY < y - ALCANCE || aresta.minY > y + ALCANCE) return;
      aresta.consulta = consulta;
      this.proximas.push(aresta);
    };
    const minX = Math.floor((x - ALCANCE) / CELULA), maxX = Math.floor((x + ALCANCE) / CELULA);
    const minY = Math.floor((y - ALCANCE) / CELULA), maxY = Math.floor((y + ALCANCE) / CELULA);
    for (let cy = minY; cy <= maxY; cy++) for (let cx = minX; cx <= maxX; cx++) {
      for (const aresta of this.indice.get(`${cx},${cy}`) ?? []) incluir(aresta);
    }
    for (const aresta of this.grandes) incluir(aresta);
    for (const aresta of this.dinamicos) incluir(aresta);
    if (!this.proximas.length) { this.pontos.length = 0; return this.pontos; }

    const angulos = this.angulos;
    angulos.length = 0;
    for (let i = 0; i < 96; i++) angulos.push(i / 96 * VOLTA);
    // Raios nos dois lados dos vértices preservam frestas e quinas, sem varrer pixels.
    for (const aresta of this.proximas) {
      for (const a of [Math.atan2(aresta.ay - y, aresta.ax - x), Math.atan2(aresta.by - y, aresta.bx - x)]) {
        for (const delta of [-0.00001, 0, 0.00001]) angulos.push((a + delta + VOLTA) % VOLTA);
      }
    }
    angulos.sort((a, b) => a - b);
    for (let i = 0; i < angulos.length; i++) {
      const dx = Math.cos(angulos[i]), dy = Math.sin(angulos[i]);
      const distancia = this.calcularAlcance(x, y, dx, dy);
      const ponto = this.pontos[i] ?? (this.pontos[i] = { x: 0, y: 0 });
      ponto.x = x + dx * distancia;
      ponto.y = y + dy * distancia;
    }
    this.pontos.length = angulos.length;
    return this.pontos;
  }

  recortar(context, x, y) {
    const pontos = this.obterPoligono(x, y);
    if (!pontos.length) return;
    context.beginPath();
    context.moveTo(pontos[0].x, pontos[0].y);
    for (let i = 1; i < pontos.length; i++) context.lineTo(pontos[i].x, pontos[i].y);
    context.closePath();
    context.clip();
  }

  destroy() {
    this.scene = null;
    this.indice.clear();
    this.portas.clear();
    this.cruzamentos.clear();
    for (const array of [this.grandes, this.dinamicos, this.proximas, this.angulos, this.pontos, this.intersecoes]) array.length = 0;
  }
}
