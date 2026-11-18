/** Ondas únicas por visita à fábrica, disparadas pela aproximação das áreas do Tiled. */
import { criarRoboBola } from "./RoboBola.js";
import { obterPisoSpawnRobos, retanguloSpawnLivre, ampliarAreaNascimento, FOLGA_SPAWN_ROBOS,
  separacaoSpawnRobos, notaDistribuicaoSpawn } from "./EnemySpawnValidation.js";

export const CONFIG_SPAWN_ROBO_BOLA = Object.freeze({
  proximidade: 180, areaPorRobo: 40000, maximo: 7, intervaloMs: 450,
  tamanhoCorpo: 33.6, margem: FOLGA_SPAWN_ROBOS.objetos,
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
  return (camada?.objects ?? []).filter(o => o.visible !== false && !o.point && !o.ellipse && !o.polygon &&
    !o.polyline && !o.gid && !o.rotation && [o.x, o.y, o.width, o.height].every(Number.isFinite) &&
    o.width > 0 && o.height > 0).map(o => ({ id: o.id, x: o.x,
      y: o.y, width: o.width, height: o.height }));
}

function coordenadas(min, tamanho, passo) {
  const margem = CONFIG_SPAWN_ROBO_BOLA.tamanhoCorpo / 2 + CONFIG_SPAWN_ROBO_BOLA.margem;
  if (tamanho < margem * 2) return [];
  const valores = [(min + tamanho / 2), min + margem, min + tamanho - margem];
  for (let v = min + margem + passo; v < min + tamanho - margem; v += passo) valores.push(v);
  return [...new Set(valores)];
}

/** Área original e uma faixa próxima, sempre sujeitas a piso, colisões e espaçamento. */
export function candidatosAreaRoboBola(area, margemProxima = CONFIG_SPAWN_ROBO_BOLA.proximidadeArea, passo = 48) {
  return [area, ampliarAreaNascimento(area, margemProxima)].flatMap(a => {
    // Orçamento limitado mesmo se um retângulo for ampliado muito no editor.
    const grade = Math.max(passo, Math.sqrt(a.width * a.height / 4096));
    return coordenadas(a.x, a.width, grade).flatMap(x =>
      coordenadas(a.y, a.height, grade).map(y => ({ x, y })));
  });
}

export function pontoLivreAreaRoboBola(scene, ponto, piso = null) {
  const tamanho = CONFIG_SPAWN_ROBO_BOLA.tamanhoCorpo + CONFIG_SPAWN_ROBO_BOLA.margem * 2;
  const corpo = { x: ponto.x - tamanho / 2, y: ponto.y - tamanho / 2,
    width: tamanho, height: tamanho };
  if (!retanguloSpawnLivre(scene, corpo) || (piso && !piso.contem(corpo))) return false;
  const jogadores = [scene.player, ...((scene.remotePlayers?.values &&
    [...scene.remotePlayers.values()]) || [])];
  if (jogadores.some(p => p?.active && Math.hypot(ponto.x - p.x, ponto.y - p.y) < 70)) return false;
  const visual = { x: ponto.x - 127 * .56 / 2, y: ponto.y - 127 * .56 / 2,
    width: 127 * .56, height: 127 * .56 };
  return separacaoSpawnRobos(scene, ponto, visual);
}

/** Divide o orçamento da região proporcionalmente, conservando o limite total. */
function aplicarLimitesRegionais(areas) {
  for (const limite of CONFIG_SPAWN_ROBO_BOLA.limitesRegionais) {
    const membros = areas.filter(a => limite.areas.includes(a.id));
    const total = membros.reduce((soma, a) => soma + a.total, 0);
    if (total <= limite.maximo) continue;
    const cotas = membros.map(area => {
      const proporcional = area.total * limite.maximo / total;
      return { area, quantidade: Math.floor(proporcional), resto: proporcional % 1 };
    });
    let restantes = limite.maximo - cotas.reduce((soma, cota) => soma + cota.quantidade, 0);
    cotas.sort((a, b) => b.resto - a.resto || a.area.id - b.area.id);
    for (const cota of cotas) {
      cota.area.total = cota.quantidade + (restantes-- > 0 ? 1 : 0);
    }
  }
}

export function criarSpawnAreasRoboBola(scene, criar = criarRoboBola) {
  const areas = lerAreasRoboBola(scene.map).map(area => ({ ...area,
    total: quantidadeRobosArea(area), invocados: 0, ativada: false,
    proximoSpawn: 0, candidatos: candidatosAreaRoboBola(area), candidatosDetalhados: null }));
  aplicarLimitesRegionais(areas);
  const piso = obterPisoSpawnRobos(scene);
  let tempo = 0, destruido = false;
  const sistema = {
    atualizar(delta) {
      if (destruido || !scene.luzFabricaAcesa || !scene.player?.active ||
          scene.morteEmAndamento || scene.vida <= 0 ||
          (scene.multiplayer && !scene.isMultiplayerHost)) return;
      tempo += Math.max(0, Number.isFinite(delta) ? delta : 0);
      const jogadores = [scene.player, ...((scene.remotePlayers?.values &&
        [...scene.remotePlayers.values()]) || [])].filter(p => p?.active);
      for (const area of areas) {
        const distancia = Math.min(...jogadores.map(p => distanciaAteAreaRoboBola(p.body?.center ?? p, area)));
        if (!area.ativada && distancia <= CONFIG_SPAWN_ROBO_BOLA.proximidade) area.ativada = true;
        // Uma área pequena pode estar inteiramente ocupada pelo jogador. Espera espaço
        // livre e continua a onda após ele sair, sem exigir nova entrada no retângulo.
        if (!area.ativada || area.invocados >= area.total || tempo < area.proximoSpawn || distancia > 800) continue;
        area.proximoSpawn = tempo + CONFIG_SPAWN_ROBO_BOLA.intervaloMs;
        let livres = area.candidatos.filter(p => pontoLivreAreaRoboBola(scene, p, piso));
        if (!livres.length) {
          // Faixas estreitas junto às máquinas podem ficar entre os pontos da grade grossa.
          area.candidatosDetalhados ??= candidatosAreaRoboBola(area, CONFIG_SPAWN_ROBO_BOLA.proximidadeArea, 8);
          livres = area.candidatosDetalhados.filter(p => pontoLivreAreaRoboBola(scene, p, piso));
        }
        if (!livres.length) continue;
        // Inicia em índice aleatório, mas escolhe a maior separação da onda atual.
        let ponto = livres[Math.floor(Math.random() * livres.length)];
        let nota = notaDistribuicaoSpawn(scene, ponto);
        for (const candidato of livres) {
          const atual = notaDistribuicaoSpawn(scene, candidato);
          if (atual > nota) { nota = atual; ponto = candidato; }
        }
        const robo = criar(scene, ponto);
        if (!robo) continue;
        robo.spawnAreaRoboBolaId = area.id;
        robo.spawnProtegidoAte = (scene.time?.now ?? 0) + 700;
        robo.ultimoTiro = robo.spawnProtegidoAte;
        area.invocados++;
      }
    },
    snapshot() { return areas.map(({ candidatos, candidatosDetalhados, ...area }) => ({ ...area })); },
    destruir() { destruido = true; scene.events.off("shutdown", sistema.destruir); },
  };
  scene.events.once("shutdown", sistema.destruir);
  return sistema;
}
