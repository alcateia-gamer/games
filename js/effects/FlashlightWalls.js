/** Contornos de luz indexados uma vez; fontes fixas reutilizam o recorte e portas são atualizadas. */
const ALCANCE = 360;
const CELULA = 128;
const VOLTA = Math.PI * 2;
const CAMADAS_PAREDE = new Set(["ParedeAbaixoPerso", "ParedeAcimaPerso"]);

function segmento(ax, ay, bx, by, regiao = null) {
  return { ax, ay, bx, by, minX: Math.min(ax, bx), minY: Math.min(ay, by),
    maxX: Math.max(ax, bx), maxY: Math.max(ay, by), consulta: 0, regiao };
}

function contorno(pontos, destino, fechado = true, bloquearNaBorda = false) {
  const regiao = fechado && !bloquearNaBorda ? {} : null;
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

function adicionarContornosObjetos(camada, segmentos, bloquearNaBorda = false) {
  for (const objeto of camada?.objects ?? []) {
    // Aceita propriedades no JSON do Tiled e no objeto convertido pelo Phaser.
    const luzAtravessa = Array.isArray(objeto.properties)
      ? objeto.properties.find(propriedade => propriedade.name === "Luzatravessa")?.value
      : objeto.properties?.Luzatravessa;
    if (!bloquearNaBorda && luzAtravessa === true) continue;
    // Por padrão, toda área de colisão bloqueia a lanterna, mesmo sem tipo no Tiled.
    // O recorte alcança a saída do contorno para iluminar a superfície do tileset,
    // mas não o cenário atrás dele. Pontos e textos não representam obstáculos.
    if (objeto.point || objeto.text) continue;
    if (!Number.isFinite(objeto.x) || !Number.isFinite(objeto.y)) continue;
    const locais = objeto.polygon ?? objeto.polyline ??
      (objeto.width > 0 && objeto.height > 0 ? [{ x: 0, y: 0 }, { x: objeto.width, y: 0 },
        { x: objeto.width, y: objeto.height }, { x: 0, y: objeto.height }] : []);
    if (locais.length < 2) continue;
    const angulo = (objeto.rotation ?? 0) * Math.PI / 180;
    const cos = Math.cos(angulo), sin = Math.sin(angulo);
    contorno(locais.map(p => ({ x: objeto.x + p.x * cos - p.y * sin,
      y: objeto.y + p.x * sin + p.y * cos })), segmentos, !objeto.polyline, bloquearNaBorda);
  }
}

function lerContornosMapa(map, regiaoSala, somenteLimites) {
  const segmentos = [];
  // Esta camada é uma barreira óptica explícita, independente da colisão e de Luzatravessa.
  adicionarContornosObjetos(map?.getObjectLayer?.("LimitaLuz"), segmentos, true);
  if (somenteLimites) return segmentos;
  adicionarContornosObjetos(map?.getObjectLayer?.("collision"), segmentos);

  // Remove arestas compartilhadas: a luz consulta só a borda externa das paredes de tiles.
  const bordas = new Map();
  const bordasSala = new Map();
  const adicionarBorda = (destino, ax, ay, bx, by, regiao) => {
    const invertida = ax > bx || (ax === bx && ay > by);
    const chave = invertida ? `${bx},${by}:${ax},${ay}` : `${ax},${ay}:${bx},${by}`;
    if (destino.has(chave)) destino.delete(chave);
    else destino.set(chave, segmento(ax, ay, bx, by, regiao));
  };
  // Cada camada é unida antes de combinar, preservando paredes sobrepostas entre camadas.
  for (const dados of map?.layers ?? []) {
    const layer = dados.tilemapLayer;
    if (!CAMADAS_PAREDE.has(dados.name) || !layer?.forEachTile) continue;
    bordas.clear();
    bordasSala.clear();
    // A superfície recebe o feixe até a saída; a silhueta visual de ParedeAcimaPerso
    // é retirada do carimbo da lanterna sem alterar estes contornos de colisão.
    const regiao = {};
    const regiaoSemFachada = {};
    let temFachada = false;
    layer.forEachTile(tile => {
      if (!tile || tile.index < 0) return;
      const p = layer.tileToWorldXY(tile.x, tile.y);
      const w = tile.width * (layer.scaleX ?? 1), h = tile.height * (layer.scaleY ?? 1);
      adicionarBorda(bordas, p.x, p.y, p.x + w, p.y, regiao);
      adicionarBorda(bordas, p.x + w, p.y, p.x + w, p.y + h, regiao);
      adicionarBorda(bordas, p.x + w, p.y + h, p.x, p.y + h, regiao);
      adicionarBorda(bordas, p.x, p.y + h, p.x, p.y, regiao);
      if (!regiaoSala) return;
      if (p.x < regiaoSala.right && p.x + w > regiaoSala.left &&
          p.y < regiaoSala.bottom && p.y + h > regiaoSala.top) {
        temFachada = true;
        return;
      }
      adicionarBorda(bordasSala, p.x, p.y, p.x + w, p.y, regiaoSemFachada);
      adicionarBorda(bordasSala, p.x + w, p.y, p.x + w, p.y + h, regiaoSemFachada);
      adicionarBorda(bordasSala, p.x + w, p.y + h, p.x, p.y + h, regiaoSemFachada);
      adicionarBorda(bordasSala, p.x, p.y + h, p.x, p.y, regiaoSemFachada);
    });
    if (temFachada) {
      // A fachada oculta os pixels do feixe, mas não encurta a luz dirigida ao interior.
      for (const aresta of bordas.values()) segmentos.push(Object.assign(aresta, { sala: false }));
      for (const aresta of bordasSala.values()) segmentos.push(Object.assign(aresta, { sala: true }));
    } else segmentos.push(...bordas.values());
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

function recortarPoligono(context, pontos) {
  if (!pontos.length) return;
  context.beginPath();
  context.moveTo(pontos[0].x, pontos[0].y);
  for (let i = 1; i < pontos.length; i++) context.lineTo(pontos[i].x, pontos[i].y);
  context.closePath();
  context.clip();
}

export default class FlashlightWalls {
  constructor(scene, { somenteLimites = false } = {}) {
    this.scene = scene;
    this.indice = new Map();
    this.grandes = [];
    this.dinamicos = [];
    this.portas = new Map();
    this.proximas = [];
    this.angulos = [];
    this.pontos = [];
    this.intersecoes = [];
    this.poolIntersecoes = [];
    this.cruzamentos = new Map();
    this.fontesFixas = new WeakMap();
    this.consulta = 0;
    this.revisao = 0;
    this.ultimo = { x: null, y: null, revisao: -1, sala: false, alcance: ALCANCE, sairOrigem: false };
    for (const aresta of lerContornosMapa(scene.map, scene.regiaoTrocaCamada, somenteLimites)) {
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
  calcularAlcance(x, y, dx, dy, alcance = ALCANCE, sairOrigem = false) {
    const hits = this.intersecoes;
    hits.length = 0;
    for (const aresta of this.proximas) {
      const distancia = distanciaAresta(x, y, dx, dy, aresta);
      if (distancia > alcance) continue;
      const den = dx * (aresta.by - aresta.ay) - dy * (aresta.bx - aresta.ax);
      // Os mesmos registros atendem todos os raios, sem criar lixo por projétil.
      const hit = this.poolIntersecoes[hits.length] ?? (this.poolIntersecoes[hits.length] = {});
      hit.distancia = distancia;
      hit.regiao = aresta.regiao;
      hit.delta = den < 0 ? 1 : -1;
      hits.push(hit);
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
        if (delta < 0) {
          // Um giroflex montado na parede emite para fora do seu próprio suporte.
          if (sairOrigem) continue;
          return distancia;
        }
        atingiu = true;
      }
      profundidade += delta;
      if (profundidade <= 0) return distancia;
    }
    return alcance;
  }

  obterPoligono(x, y, regiaoSala = null, alcance = ALCANCE, sairOrigem = false) {
    const sala = !!regiaoSala;
    if (this.ultimo.x === x && this.ultimo.y === y && this.ultimo.revisao === this.revisao &&
        this.ultimo.sala === sala && this.ultimo.alcance === alcance &&
        this.ultimo.sairOrigem === sairOrigem) return this.pontos;
    Object.assign(this.ultimo, { x, y, revisao: this.revisao, sala, alcance, sairOrigem });
    this.proximas.length = 0;
    const consulta = ++this.consulta;
    const incluir = aresta => {
      if (aresta.sala !== undefined && aresta.sala !== sala) return;
      if (aresta.consulta === consulta || aresta.maxX < x - alcance || aresta.minX > x + alcance ||
          aresta.maxY < y - alcance || aresta.minY > y + alcance) return;
      aresta.consulta = consulta;
      this.proximas.push(aresta);
    };
    const minX = Math.floor((x - alcance) / CELULA), maxX = Math.floor((x + alcance) / CELULA);
    const minY = Math.floor((y - alcance) / CELULA), maxY = Math.floor((y + alcance) / CELULA);
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
      for (let ponta = 0; ponta < 2; ponta++) {
        const a = Math.atan2((ponta ? aresta.by : aresta.ay) - y, (ponta ? aresta.bx : aresta.ax) - x);
        angulos.push((a - 0.00001 + VOLTA) % VOLTA, (a + VOLTA) % VOLTA, (a + 0.00001 + VOLTA) % VOLTA);
      }
    }
    angulos.sort((a, b) => a - b);
    let quantidade = 0;
    for (let i = 0; i < angulos.length; i++) {
      // Vértices compartilhados geram a mesma direção em mais de uma aresta.
      if (i && Math.abs(angulos[i] - angulos[i - 1]) < 1e-12) continue;
      const dx = Math.cos(angulos[i]), dy = Math.sin(angulos[i]);
      const distancia = this.calcularAlcance(x, y, dx, dy, alcance, sairOrigem);
      const ponto = this.pontos[quantidade] ?? (this.pontos[quantidade] = { x: 0, y: 0 });
      ponto.x = x + dx * distancia;
      ponto.y = y + dy * distancia;
      quantidade++;
    }
    this.pontos.length = quantidade;
    return this.pontos;
  }

  recortar(context, x, y, regiaoSala = null) {
    recortarPoligono(context, this.obterPoligono(x, y, regiaoSala));
  }

  /** Fontes fixas reutilizam a visibilidade; mudanças nas portas invalidam o cache. */
  recortarFonte(context, fonte, alcance, x = fonte.x, y = fonte.y) {
    let cache = this.fontesFixas.get(fonte);
    if (!cache || cache.x !== x || cache.y !== y || cache.alcance !== alcance ||
        cache.revisao !== this.revisao) {
      const pontos = this.obterPoligono(x, y, null, alcance, true);
      if (!cache) {
        cache = { pontos: [] };
        this.fontesFixas.set(fonte, cache);
      }
      // O polígono principal também atende a lanterna e outras luzes; cada fonte guarda sua cópia.
      for (let i = 0; i < pontos.length; i++) {
        const ponto = cache.pontos[i] ?? (cache.pontos[i] = { x: 0, y: 0 });
        Object.assign(ponto, pontos[i]);
      }
      cache.pontos.length = pontos.length;
      Object.assign(cache, { x, y, alcance, revisao: this.revisao });
    }
    recortarPoligono(context, cache.pontos);
  }

  destroy() {
    this.scene = null;
    this.indice.clear();
    this.portas.clear();
    this.cruzamentos.clear();
    this.fontesFixas = new WeakMap();
    for (const array of [this.grandes, this.dinamicos, this.proximas, this.angulos, this.pontos,
      this.intersecoes, this.poolIntersecoes]) array.length = 0;
  }
}
