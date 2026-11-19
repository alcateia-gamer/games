import { retanguloLivreDoMapa } from "./EnemyPathfinding.js";

// Os quatro operadores, inclusive as réplicas físicas do host, usam 30 × 15.
const PASSO = 12;
const REGIAO = 96;
const ALCANCE_REFINAMENTO = 288;
const VIZINHOS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DESVIOS = [6, 3, 9, 1, 2, 4, 5, 7, 8, 10, 11].flatMap(n => [n, -n]);
const chave = (x, y) => `${x},${y}`;
const regioes = ponto => chave(Math.floor(ponto.x / REGIAO), Math.floor(ponto.y / REGIAO));

export function centroCaminhadaFabrica(jogador) {
  const corpo = jogador.body;
  if (corpo && [corpo.x, corpo.y, corpo.width, corpo.height].every(Number.isFinite)) {
    return { x: corpo.x + corpo.width / 2, y: corpo.y + corpo.height / 2 };
  }
  return corpo?.center ?? jogador;
}

export function criarAcessoSpawnFabrica(scene, piso) {
  let grupo, quantidade, portas = [], revisao = 0, invalidou = false;
  const celulas = new Map(), fronteiras = new Map(), pedidos = new Set(), pais = new Map();
  let fila = [], cursor = 0, componentes = 0, refinamentos = [], cursorRefino = 0;
  let tarefa = null, locais = new Map();
  let consultar = rect => retanguloLivreDoMapa(scene, rect);

  const retangulo = (a, b) => ({ x: Math.min(a.x, b.x) - 15, y: Math.min(a.y, b.y) - 7.5,
    width: Math.abs(a.x - b.x) + 30, height: Math.abs(a.y - b.y) + 15 });
  const livre = (a, b) => {
    const rect = retangulo(a, b);
    return piso.contem(rect) && consultar(rect);
  };
  // Cada yield marca uma consulta inteira. Ao pausar, nenhum segmento fica com resultado incompleto.
  function* testar(a, b) {
    const resultado = livre(a, b);
    yield;
    return resultado;
  }

  function* ancoras(ponto, aceitar = () => true, protegido = false) {
    const x = Math.floor(ponto.x / PASSO), y = Math.floor(ponto.y / PASSO);
    for (const ix of [x, x + 1]) for (const iy of [y, y + 1]) {
      if (!aceitar(ix, iy)) continue;
      const no = { x: ix * PASSO, y: iy * PASSO };
      const canto = { x: no.x, y: ponto.y };
      const outro = { x: ponto.x, y: no.y };
      // Nos nascimentos, a folga de 20 px já cobre ambos os segmentos de até 12 px.
      if (protegido || (livre(ponto, canto) && livre(canto, no)) ||
          (livre(ponto, outro) && livre(outro, no))) yield { ix, iy };
    }
  }

  function raiz(id) {
    while (pais.has(id)) id = pais.get(id);
    return id;
  }

  function inserir(ix, iy, componente) {
    const id = chave(ix, iy);
    const anterior = celulas.get(id);
    if (anterior) {
      const a = raiz(anterior), b = raiz(componente);
      if (a !== b) pais.set(a, b);
      return;
    }
    celulas.set(id, componente);
    fila.push({ ix, iy, componente });
  }

  function* expandir(no) {
    const origem = { x: no.ix * PASSO, y: no.iy * PASSO };
    for (const [dx, dy] of VIZINHOS) {
      const x = no.ix + dx, y = no.iy + dy;
      const existente = celulas.get(chave(x, y));
      if (existente && raiz(existente) === raiz(no.componente)) continue;
      if (yield* testar(origem, { x: x * PASSO, y: y * PASSO })) inserir(x, y, no.componente);
      else {
        const regiao = regioes(origem);
        if (!fronteiras.has(regiao)) fronteiras.set(regiao, new Map());
        fronteiras.get(regiao).set(`${no.ix},${no.iy},${dx},${dy}`, { no, origem, dx, dy });
      }
    }
  }

  /** Só examina bordas próximas ao destino pendente e conserva a malha principal de 12 px. */
  function* refinar({ no, origem, dx, dy }) {
    for (let passo = 2; passo * PASSO <= ALCANCE_REFINAMENTO; passo++) {
      const ix = no.ix + dx * passo, iy = no.iy + dy * passo;
      const existente = celulas.get(chave(ix, iy));
      if (existente && raiz(existente) === raiz(no.componente)) return;
      const fim = { x: ix * PASSO, y: iy * PASSO };
      if (!(yield* testar(fim, fim))) continue;
      for (const desvio of DESVIOS) {
        const a = { x: origem.x - dy * desvio, y: origem.y + dx * desvio };
        const b = { x: fim.x - dy * desvio, y: fim.y + dx * desvio };
        if ((yield* testar(origem, a)) && (yield* testar(a, b)) && (yield* testar(b, fim))) {
          inserir(ix, iy, no.componente);
          return;
        }
      }
      // A primeira saída possível basta para testar esta entrada; evita sondar toda a parede.
      return;
    }
  }

  function pedirRefinamento(ponto) {
    const x = Math.floor(ponto.x / REGIAO), y = Math.floor(ponto.y / REGIAO);
    for (let ix = x - 3; ix <= x + 3; ix++) for (let iy = y - 3; iy <= y + 3; iy++) {
      const id = chave(ix, iy);
      if (pedidos.has(id) || !fronteiras.has(id)) continue;
      pedidos.add(id);
      refinamentos.push(...fronteiras.get(id).values());
    }
  }

  function limpar() {
    celulas.clear(); fronteiras.clear(); pedidos.clear(); pais.clear();
    fila = []; refinamentos = []; cursor = cursorRefino = componentes = 0;
    tarefa = null;
    locais.clear();
  }

  function componentesDos(jogadores = locais.keys()) {
    const resultado = new Set();
    for (const jogador of jogadores) for (const id of locais.get(jogador) ?? []) resultado.add(raiz(id));
    return resultado;
  }

  return {
    limpar, componentesDos,
    get revisao() { return revisao; },
    get invalidou() { return invalidou; },
    get pendente() { return tarefa !== null || cursor < fila.length || cursorRefino < refinamentos.length; },
    atualizar(jogadores, consultas = 512, consulta = rect => retanguloLivreDoMapa(scene, rect)) {
      consultar = consulta;
      const grupoAtual = scene.collisionGroup;
      const total = grupoAtual?.getChildren?.().length;
      const portasAtuais = (scene.portasFabrica ?? []).flatMap(porta => {
        const body = porta.colisao?.body;
        return body && body.enable !== false ? [{ body, x: body.x, y: body.y,
          width: body.width, height: body.height }] : [];
      });
      const igual = (a, b) => a.body === b.body && a.x === b.x && a.y === b.y &&
        a.width === b.width && a.height === b.height;
      const removidas = portas.filter(anterior => !portasAtuais.some(atual => igual(atual, anterior)));
      const adicionadas = portasAtuais.some(atual => !portas.some(anterior => igual(atual, anterior)));
      if (grupo !== grupoAtual || quantidade !== total || removidas.length || adicionadas) {
        revisao++;
        const somenteAbertura = grupo === grupoAtual && removidas.length && !adicionadas &&
          (quantidade === total || quantidade - total === removidas.length);
        invalidou = !somenteAbertura;
        if (somenteAbertura) {
          // Abrir uma porta só acrescenta caminhos. Reexaminar as suas bordas preserva o piso já visitado.
          const retomar = new Set();
          for (const porta of removidas) {
            const esquerda = Math.floor((porta.x - 30) / REGIAO);
            const direita = Math.floor((porta.x + porta.width + 30) / REGIAO);
            const topo = Math.floor((porta.y - 30) / REGIAO);
            const fundo = Math.floor((porta.y + porta.height + 30) / REGIAO);
            for (let x = esquerda; x <= direita; x++) for (let y = topo; y <= fundo; y++) {
              const bordas = fronteiras.get(chave(x, y));
              if (bordas) for (const { no, origem } of bordas.values()) {
                if (origem.x >= porta.x - 30 && origem.x <= porta.x + porta.width + 30 &&
                    origem.y >= porta.y - 30 && origem.y <= porta.y + porta.height + 30) retomar.add(no);
              }
            }
          }
          fila.push(...retomar);
          pedidos.clear();
        } else limpar();
        grupo = grupoAtual;
        quantidade = total;
        portas = portasAtuais;
      }

      // Quatro âncoras, dois caminhos em L de dois segmentos, até 16 consultas por operador.
      const ancorasPorJogador = jogadores.map(p => [...ancoras(centroCaminhadaFabrica(p))]);
      const pontos = ancorasPorJogador.flat();
      let restante = Math.max(0, consultas - jogadores.length * 16);
      while (restante > 0) {
        if (!tarefa) {
          if (cursor < fila.length) tarefa = expandir(fila[cursor++]);
          else {
            fila = []; cursor = 0;
            const semente = pontos.find(({ ix, iy }) => !celulas.has(chave(ix, iy)));
            if (semente) { inserir(semente.ix, semente.iy, ++componentes); continue; }
            if (cursorRefino < refinamentos.length) tarefa = refinar(refinamentos[cursorRefino++]);
            else { refinamentos = []; cursorRefino = 0; break; }
          }
        }
        if (tarefa.next().done) tarefa = null;
        else restante--;
      }
      locais = new Map(jogadores.map((p, i) => [p, ancorasPorJogador[i]
        .map(({ ix, iy }) => celulas.get(chave(ix, iy))).filter(Boolean)]));
      return !this.pendente && pontos.every(({ ix, iy }) => celulas.has(chave(ix, iy)));
    },
    alcanca(ponto, componentesAtivos = componentesDos(), protegido = false) {
      if (!componentesAtivos.size) return false;
      const encontrado = !ancoras(ponto, (x, y) =>
        componentesAtivos.has(raiz(celulas.get(chave(x, y)))), protegido).next().done;
      if (!encontrado && cursor >= fila.length && !tarefa) pedirRefinamento(ponto);
      return encontrado;
    },
  };
}
