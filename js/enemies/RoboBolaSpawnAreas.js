/** Ondas únicas por visita à fábrica, disparadas pela aproximação das áreas do Tiled. */
import { CONFIG_AGLOMERACAO, concentracaoRobos, ocupacaoNascimento,
  areaNascimentoLotada, registrarNascimentoLocal, registrarRoboNaFila } from "./RoboBolaAglomeracao.js";
import { centroCaminhadaFabrica, criarAcessoSpawnFabrica } from "./FactorySpawnAccess.js";
import { retanguloLivreDoMapa } from "./EnemyPathfinding.js";
import { criarRoboBola } from "./RoboBola.js";
import { obterPisoSpawnRobos, retanguloSpawnLivre, ampliarAreaNascimento, FOLGA_SPAWN_ROBOS,
  CORPO_ROBO_BOLA, retanguloCorpoSpawnRoboBola, separacaoSpawnRobos, notaDistribuicaoSpawn } from "./EnemySpawnValidation.js";

export const CONFIG_SPAWN_ROBO_BOLA = Object.freeze({
  candidatosPorQuadro: 512, candidatosPorVez: 32, consultasPorQuadro: 640, consultasNavegacao: 448,
  fracaoTotal: 0.8, proximidade: 180, areaPorRobo: 40000, maximo: 7, intervaloMs: 450,
  tamanhoCorpo: CORPO_ROBO_BOLA.tamanho * CORPO_ROBO_BOLA.escala, margem: FOLGA_SPAWN_ROBOS.objetos,
  proximidadeArea: FOLGA_SPAWN_ROBOS.proximidadeArea,
  // Os três retângulos contíguos junto de (-1067, -4478) formam uma só região.
  limitesRegionais: Object.freeze([
    Object.freeze({ areas: Object.freeze([1625, 1629, 1630]), maximo: 7 }),
  ]),
});

export function distanciaAteAreaRoboBola(ponto, area) {
  return Math.hypot(Math.max(area.x - ponto.x, 0, ponto.x - area.x - area.width),
    Math.max(area.y - ponto.y, 0, ponto.y - area.y - area.height));
}

export function quantidadeRobosArea(area) {
  return Math.max(1, Math.min(CONFIG_SPAWN_ROBO_BOLA.maximo,
    Math.ceil(area.width * area.height / CONFIG_SPAWN_ROBO_BOLA.areaPorRobo)));
}

export function lerAreasRoboBola(map) {
  const camada = map?.getObjectLayer?.("SpawnRoboBola") ??
    map?.objects?.find(l => l.name?.split("/").at(-1) === "SpawnRoboBola");
  return Array.from(camada?.objects ?? []).filter(o => o.visible !== false && !o.point && !o.ellipse && !o.polygon &&
    !o.polyline && !o.gid && !o.rotation && [o.x, o.y, o.width, o.height].every(Number.isFinite) &&
    o.width > 0 && o.height > 0).map(o => ({ id: o.id, x: o.x,
      y: o.y, width: o.width, height: o.height }));
}

function* coordenadas(min, tamanho, passo) {
  const margem = CONFIG_SPAWN_ROBO_BOLA.tamanhoCorpo / 2 + CONFIG_SPAWN_ROBO_BOLA.margem;
  if (tamanho < margem * 2) return;
  const meio = min + tamanho / 2, inicio = min + margem, fim = min + tamanho - margem;
  yield meio;
  if (inicio !== meio) yield inicio;
  if (fim !== meio && fim !== inicio) yield fim;
  for (let v = inicio + passo; v < fim; v += passo) if (v !== meio) yield v;
}

function* iterarCandidatos(area, margemProxima, passo) {
  for (const a of [area, ampliarAreaNascimento(area, margemProxima)]) {
    const grade = Math.max(passo, Math.sqrt(a.width * a.height / 4096));
    for (const x of coordenadas(a.x, a.width, grade)) {
      for (const y of coordenadas(a.y, a.height, grade)) yield { x, y };
    }
  }
}

/** Área original e faixa próxima, sujeitas a piso, colisões e espaçamento. */
export function candidatosAreaRoboBola(area, margemProxima = CONFIG_SPAWN_ROBO_BOLA.proximidadeArea, passo = 48) {
  return [...iterarCandidatos(area, margemProxima, passo)];
}

export function pontoLivreAreaRoboBola(scene, ponto, piso = null, cacheOcupacoes = null, consultar = undefined) {
  const corpo = retanguloCorpoSpawnRoboBola(ponto, CONFIG_SPAWN_ROBO_BOLA.margem);
  if (!retanguloSpawnLivre(scene, corpo, consultar) || (piso && !piso.contem(corpo))) return false;
  const jogadores = [scene.player, ...((scene.remotePlayers?.values &&
    [...scene.remotePlayers.values()]) || [])];
  if (jogadores.some(p => p?.active && Math.hypot(ponto.x - (p.body?.center?.x ?? p.x), ponto.y - (p.body?.center?.y ?? p.y)) < 70)) return false;
  const visual = { x: ponto.x - 127 * .56 / 2, y: ponto.y - 127 * .56 / 2,
    width: 127 * .56, height: 127 * .56 };
  return separacaoSpawnRobos(scene, ponto, visual, [], undefined, undefined, cacheOcupacoes);
}

/** Distribui cortes pelo método dos maiores restos, preservando as ondas unitárias. */
function distribuirCortes(areas, cortes) {
  const maiores = areas.filter(area => area.total > 1);
  const capacidade = maiores.reduce((soma, area) => soma + area.total - 1, 0);
  if (!capacidade) return;
  cortes = Math.min(cortes, capacidade);
  const cotas = maiores.map(area => {
    const numerador = (area.total - 1) * cortes;
    return { area, corte: Math.floor(numerador / capacidade), resto: numerador % capacidade };
  });
  const restantes = cortes - cotas.reduce((soma, cota) => soma + cota.corte, 0);
  cotas.sort((a, b) => b.resto - a.resto || a.area.id - b.area.id);
  for (const [i, cota] of cotas.entries()) cota.area.total -= cota.corte + Number(i < restantes);
}

function aplicarLimitesRegionais(areas) {
  for (const limite of CONFIG_SPAWN_ROBO_BOLA.limitesRegionais) {
    const membros = areas.filter(a => limite.areas.includes(a.id));
    const total = membros.reduce((soma, a) => soma + a.total, 0);
    if (total > limite.maximo) {
      // Mantém as cotas regionais anteriores antes de calcular a redução global.
      const cotas = membros.map(area => ({
        area, quantidade: Math.floor(area.total * limite.maximo / total),
        resto: (area.total * limite.maximo) % total,
      }));
      const restantes = limite.maximo - cotas.reduce((soma, cota) => soma + cota.quantidade, 0);
      cotas.sort((a, b) => b.resto - a.resto || a.area.id - b.area.id);
      for (const [i, cota] of cotas.entries()) cota.area.total = cota.quantidade + Number(i < restantes);
    }
  }
}

function jogadoresParaOndas(scene) {
  const jogadores = [];
  if (scene.player?.active && !scene.morteEmAndamento && !(scene.vida <= 0)) jogadores.push(scene.player);
  if (scene.multiplayer) {
    const participantes = scene.multiplayerManager?.room?.players;
    for (const [id, aliado] of scene.remotePlayers?.entries() ?? []) {
      const dados = participantes?.find(p => p.id === id);
      if (participantes && (!dados || dados.dead || dados.mapKey && dados.mapKey !== "Level1Parte2")) continue;
      if (aliado.active && !aliado.morto && !(aliado.vida <= 0)) jogadores.push(aliado);
    }
  }
  return jogadores;
}

// Componentes da entrada com porta01 e porta04 fechadas, verificados no mapa Tiled.
const PRIMEIRA_AREA = new Set([1608, 1610, 1613]);

export function planejarOndasFabrica(map) {
  const areas = lerAreasRoboBola(map).map(area => ({ ...area, total: quantidadeRobosArea(area) }));
  aplicarLimitesRegionais(areas);
  const original = areas.map(area => area.total);
  const soma = original.reduce((total, cota) => total + cota, 0);
  const atual = areas.map(area => ({ ...area }));
  distribuirCortes(atual, soma - Math.round(soma * CONFIG_SPAWN_ROBO_BOLA.fracaoTotal));

  const segunda = [];
  let originalSegunda = 0, subtotal = 0;
  for (const [i, area] of areas.entries()) {
    area.original = original[i];
    area.atual = atual[i].total;
    area.trecho = PRIMEIRA_AREA.has(area.id) ? 1 : 2;
    area.total = area.atual;
    if (area.trecho === 1) {
      if (area.original === 2 && area.atual === 1) area.total = 2;
    } else {
      segunda.push(area);
      originalSegunda += area.original;
      subtotal += area.total;
    }
  }
  const meta = Math.round(originalSegunda * CONFIG_SPAWN_ROBO_BOLA.fracaoTotal);
  while (subtotal !== meta) {
    const cortar = subtotal > meta;
    const ordem = cortar ? segunda.filter(a => a.total > 1)
      .sort((a, b) => b.total - a.total || a.id - b.id) :
      segunda.filter(a => a.total < a.original)
        .sort((a, b) => b.original - b.total - (a.original - a.total) || a.id - b.id);
    if (!ordem.length) break;
    const passo = cortar ? -1 : 1;
    ordem[0].total += passo;
    subtotal += passo;
  }
  return areas;
}

export function criarSpawnAreasRoboBola(scene, criar = criarRoboBola) {
  const areas = planejarOndasFabrica(scene.map).map(area => ({ ...area,
    invocados: 0, ativada: false, proximoSpawn: 0, busca: null }));
  const piso = obterPisoSpawnRobos(scene);
  const acesso = piso && criarAcessoSpawnFabrica(scene, piso);
  let revisaoAcesso;
  let tempo = 0, destruido = false, cursor = 0;
  let trabalho;
  const sistema = {
    atualizar(delta) {
      trabalho = { gerados: 0, avaliados: 0, revalidados: 0, areas: 0,
        consultasNavegacao: 0, consultasNascimento: 0, navegacaoPendente: false };

      if (destruido || scene.fabricaDescarregada || scene.robosFabricaDescarregados ||
          !scene.luzFabricaAcesa || (scene.multiplayer && !scene.isMultiplayerHost)) {
        sistema.cancelarBuscas();
        return;
      }
      const jogadores = jogadoresParaOndas(scene);
      if (!jogadores.length) { sistema.cancelarBuscas(); return; }
      tempo += Math.max(0, Number.isFinite(delta) ? delta : 0);
      const agora = scene.time?.now || tempo;
      const prontas = new Map();
      let concentracao;
      for (const area of areas) {
        if (area.invocados >= area.total) continue;
        const proximos = jogadores.filter(p => {
          const distancia = distanciaAteAreaRoboBola(centroCaminhadaFabrica(p), area);
          if (distancia <= CONFIG_SPAWN_ROBO_BOLA.proximidade) area.ativada = true;
          return distancia <= 800;
        });
        if (!area.ativada || !proximos.length) { area.busca = null; continue; }
        if (tempo < area.proximoSpawn) continue;
        concentracao ??= concentracaoRobos(scene, agora);
        const faixa = ampliarAreaNascimento(area);
        const margem = CONFIG_SPAWN_ROBO_BOLA.tamanhoCorpo / 2 + CONFIG_SPAWN_ROBO_BOLA.margem;
        if (areaNascimentoLotada(concentracao, { x: faixa.x + margem, y: faixa.y + margem,
          width: faixa.width - 2 * margem, height: faixa.height - 2 * margem }, agora)) {
          area.busca = null;
          area.proximoSpawn = tempo + CONFIG_SPAWN_ROBO_BOLA.intervaloMs;
          continue;
        }
        area.busca ??= { iterador: iterarCandidatos(area, CONFIG_SPAWN_ROBO_BOLA.proximidadeArea, 48),
          detalhada: false, ponto: null, ocupacao: CONFIG_AGLOMERACAO.limiteNascimento, separacao: -Infinity };
        prontas.set(area, proximos);
      }

      if (acesso && prontas.size) {
        trabalho.navegacaoPendente = !acesso.atualizar([...new Set([...prontas.values()].flat())],
          CONFIG_SPAWN_ROBO_BOLA.consultasNavegacao, rect => {
            trabalho.consultasNavegacao++;
            return retanguloLivreDoMapa(scene, rect);
          });
        if (acesso.revisao !== revisaoAcesso) {
          revisaoAcesso = acesso.revisao;
          if (acesso.invalidou) sistema.cancelarBuscas();
          else for (const area of prontas.keys()) {
            if (!area.busca?.ponto) area.busca = null;
          }
          return;
        }
      }
      const componentesPorArea = acesso && new Map([...prontas]
        .map(([area, proximos]) => [area, acesso.componentesDos(proximos)]));
      const avancaram = new Set();
      const cacheOcupacoes = new WeakMap();
      const limite = CONFIG_SPAWN_ROBO_BOLA.candidatosPorQuadro;
      const consultarSpawn = rect => {
        trabalho.consultasNascimento++;
        return retanguloLivreDoMapa(scene, rect);
      };
      // Uma conclusão pode consultar o ponto escolhido, o spawn explícito e o corpo Arcade.
      const temOrcamento = () => trabalho.consultasNavegacao + trabalho.consultasNascimento
        <= CONFIG_SPAWN_ROBO_BOLA.consultasPorQuadro - 3;
      while (prontas.size && trabalho.avaliados < limite && temOrcamento()) {
        const area = areas[cursor];
        cursor = (cursor + 1) % areas.length;
        if (!prontas.has(area)) continue;
        avancaram.add(area);
        const busca = area.busca;
        const componentes = componentesPorArea?.get(area);
        const teto = Math.min(limite, trabalho.avaliados + CONFIG_SPAWN_ROBO_BOLA.candidatosPorVez);
        while (trabalho.avaliados < teto && temOrcamento()) {
          const { value: candidato, done } = busca.iterador.next();
          if (!done) {
            trabalho.gerados++;
            trabalho.avaliados++;
            const ocupacao = ocupacaoNascimento(concentracao, candidato, agora);
            if (ocupacao >= CONFIG_AGLOMERACAO.limiteNascimento || ocupacao > busca.ocupacao ||
                !pontoLivreAreaRoboBola(scene, candidato, piso, cacheOcupacoes, consultarSpawn) ||
                (acesso && !acesso.alcanca(candidato, componentes, true))) continue;
            const separacao = notaDistribuicaoSpawn(scene, candidato);
            if (ocupacao === busca.ocupacao && separacao <= busca.separacao) continue;
            Object.assign(busca, { ponto: candidato, ocupacao, separacao });
            continue;
          }
          if (!busca.ponto && !busca.detalhada) {
            busca.detalhada = true;
            busca.iterador = iterarCandidatos(area, CONFIG_SPAWN_ROBO_BOLA.proximidadeArea, 8);
            continue;
          }
          prontas.delete(area);
          area.busca = null;
          const ponto = busca.ponto;
          // Ausência provisória de caminho não consome vaga nem inicia a espera de 450 ms.
          if (ponto || !acesso?.pendente) area.proximoSpawn = tempo + CONFIG_SPAWN_ROBO_BOLA.intervaloMs;
          if (!ponto) break;
          trabalho.avaliados++;
          trabalho.revalidados++;
          if (ocupacaoNascimento(concentracao, ponto, agora, scene.inimigos) >= CONFIG_AGLOMERACAO.limiteNascimento ||
              !pontoLivreAreaRoboBola(scene, ponto, piso, null, consultarSpawn) || (acesso && !acesso.alcanca(ponto, componentes, true))) break;
          const robo = criar(scene, ponto, null, null, area.id,
            acesso && (centro => acesso.alcanca(centro, componentes, true)), consultarSpawn);
          if (!robo) break;
          robo.spawnAreaRoboBolaId = area.id;
          registrarRoboNaFila(robo);
          robo.spawnProtegidoAte = (scene.time?.now ?? 0) + 700;
          robo.ultimoTiro = robo.spawnProtegidoAte;
          area.invocados++;
          registrarNascimentoLocal(concentracao, robo, ponto, agora);
          if (areas.every(a => a.invocados === a.total)) acesso?.limpar();
          if (scene.multiplayer && !scene.coopRuntime) robo.networkId = `fabrica:${area.id}:${area.invocados}`;
          break;
        }
      }
      trabalho.areas = avancaram.size;
      trabalho.navegacaoPendente ||= acesso?.pendente === true;
    },
    cancelarBuscas() { for (const area of areas) area.busca = null; },
    trabalhoUltimaAtualizacao() { return { ...trabalho }; },
    progresso() {
      return Object.fromEntries(areas.filter(a => a.ativada).map(a => [a.id, a.invocados]));
    },
    restaurar(progresso) {
      for (const area of areas) {
        const invocados = progresso?.[area.id];
        if (!Number.isSafeInteger(invocados) || invocados < 0) continue;
        area.ativada = true;
        area.invocados = Math.max(area.invocados, Math.min(area.total, invocados));
        if (area.invocados === area.total) area.busca = null;
      }
    },
    snapshot() { return areas.map(({ busca, ...area }) => ({ ...area })); },
    destruir() { destruido = true; sistema.cancelarBuscas(); acesso?.limpar(); scene.events.off("shutdown", sistema.destruir); },
  };
  scene.events.once("shutdown", sistema.destruir);
  return sistema;
}
