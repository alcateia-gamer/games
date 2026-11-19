/** Controle local exclusivo dos robôs que nasceram em ondas da fábrica. */
import { caminhoMovimentoBloqueado } from "./EnemyPathfinding.js";

export const CONFIG_AGLOMERACAO = Object.freeze({
  intervaloMs: 120, raioNascimento: 220, limiteNascimento: 3, intervaloNascimentoMs: 450,
  alcanceFila: 82, folgaLateral: 42, paradaFila: 48, velocidadeFila: 0.18,
  passoRecuo: 32, alcanceCessao: 192, velocidadeCessao: 110,
  alcanceDistribuicao: 335, raioAtaque: 145, ladosAtaque: 8,
});

const estados = new WeakMap();
const tamanhoCelula = CONFIG_AGLOMERACAO.raioNascimento;
const centro = robo => robo.body?.center ?? robo;
const chave = (x, y) => `${x}:${y}`;

export function roboDeOnda(robo) {
  return robo?.spawnAreaRoboBolaId != null && !robo.prologoEncontroId && !robo.remoteOnly;
}

function inserir(grade, robo, ponto) {
  const id = chave(Math.floor(ponto.x / tamanhoCelula), Math.floor(ponto.y / tamanhoCelula));
  if (!grade.has(id)) grade.set(id, []);
  grade.get(id).push({ robo, x: ponto.x, y: ponto.y });
}

export function concentracaoRobos(scene, time) {
  let estado = estados.get(scene);
  if (!estado || estado.map !== scene.map || time < estado.time) {
    estado = { map: scene.map, time: -Infinity, grade: new Map(), nascimentos: [] };
    estados.set(scene, estado);
  }
  if (time >= estado.time + CONFIG_AGLOMERACAO.intervaloMs) {
    estado.time = time;
    estado.grade.clear();
    for (const robo of scene.inimigos ?? []) {
      if (roboDeOnda(robo) && robo.active && !robo.morto) inserir(estado.grade, robo, centro(robo));
    }
    estado.nascimentos = estado.nascimentos.filter(n => n.ate > time);
  }
  return estado;
}

function proximos(estado, ponto, raio) {
  const resultados = [];
  for (let x = Math.floor((ponto.x - raio) / tamanhoCelula); x <= Math.floor((ponto.x + raio) / tamanhoCelula); x++) {
    for (let y = Math.floor((ponto.y - raio) / tamanhoCelula); y <= Math.floor((ponto.y + raio) / tamanhoCelula); y++) {
      for (const item of estado.grade.get(chave(x, y)) ?? []) {
        if (item.robo.active && !item.robo.morto &&
            (item.x - ponto.x) ** 2 + (item.y - ponto.y) ** 2 < raio ** 2) resultados.push(item);
      }
    }
  }
  return resultados;
}

export function registrarNascimentoLocal(estado, robo, ponto, time) {
  inserir(estado.grade, robo, ponto);
  estado.nascimentos.push({ ...ponto, ate: time + CONFIG_AGLOMERACAO.intervaloNascimentoMs });
}

export function ocupacaoNascimento(estado, ponto, time, robosAtuais = null) {
  const { raioNascimento, limiteNascimento } = CONFIG_AGLOMERACAO;
  if (estado.nascimentos.some(n => n.ate > time && (n.x - ponto.x) ** 2 + (n.y - ponto.y) ** 2 < raioNascimento ** 2)) {
    return limiteNascimento;
  }
  if (!robosAtuais) return proximos(estado, ponto, raioNascimento).length;
  let ocupacao = 0;
  for (const robo of robosAtuais) {
    if (!roboDeOnda(robo) || !robo.active || robo.morto) continue;
    const p = centro(robo);
    if ((p.x - ponto.x) ** 2 + (p.y - ponto.y) ** 2 < raioNascimento ** 2) ocupacao++;
  }
  return ocupacao;
}

/** Prova conservadora usando o canto mais distante do retângulo permitido. */
export function areaNascimentoLotada(estado, area, time) {
  const { raioNascimento, limiteNascimento } = CONFIG_AGLOMERACAO;
  const meio = { x: area.x + area.width / 2, y: area.y + area.height / 2 };
  const cobreArea = p => (Math.abs(p.x - meio.x) + area.width / 2) ** 2 +
    (Math.abs(p.y - meio.y) + area.height / 2) ** 2 < raioNascimento ** 2;
  return estado.nascimentos.some(n => n.ate > time && cobreArea(n)) ||
    proximos(estado, meio, raioNascimento).filter(cobreArea).length >= limiteNascimento;
}

const intencoes = new WeakMap();
const disputas = new WeakMap();
const ordem = new WeakMap();
let proximaOrdem = 0;

export function registrarRoboNaFila(robo) {
  if (!ordem.has(robo)) ordem.set(robo, ++proximaOrdem);
}

function finalizarDisputa(disputa) {
  disputas.delete(disputa.lider);
  disputas.delete(disputa.cede);
}

/** Dá preferência a quem tem uma saída lateral alcançável para ceder. */
function distanciaParaCeder(scene, robo, { dx, dy }) {
  const { passoRecuo, alcanceCessao, folgaLateral } = CONFIG_AGLOMERACAO;
  for (let d = 0; d <= alcanceCessao; d += passoRecuo) {
    const ponto = { x: robo.x - dx * d, y: robo.y - dy * d };
    if (d > 0 && caminhoMovimentoBloqueado(scene, robo, ponto)) break;
    if ([-1, 1].some(lado => !caminhoMovimentoBloqueado(scene, robo, {
      x: ponto.x - dy * folgaLateral * lado, y: ponto.y + dx * folgaLateral * lado,
    }, ponto))) return d;
  }
  return Infinity;
}

function movimentoDisputa(scene, robo, disputa) {
  const { lider, cede, dx, dy } = disputa;
  const a = centro(lider), b = centro(cede);
  const longitudinal = (b.x - a.x) * dx + (b.y - a.y) * dy;
  const lateral = (b.y - a.y) * dx - (b.x - a.x) * dy;
  const largura = ((lider.body?.width ?? 34) + (cede.body?.width ?? 34)) / 2 + 4;
  if (longitudinal < -largura) {
    finalizarDisputa(disputa);
    return null;
  }
  if (robo === lider) {
    return { fator: Math.abs(lateral) < largura && longitudinal < largura + 1 ? 0 : 1 };
  }
  if (Math.abs(lateral) >= largura + 2) return { fator: 0 };
  const { folgaLateral, passoRecuo } = CONFIG_AGLOMERACAO;
  const direcoes = disputa.lado ? [disputa.lado, -disputa.lado] : [1, -1];
  for (const lado of direcoes) {
    const deslocamento = folgaLateral - lateral * lado;
    const ponto = { x: robo.x - dy * deslocamento * lado, y: robo.y + dx * deslocamento * lado };
    if (caminhoMovimentoBloqueado(scene, robo, ponto)) continue;
    disputa.lado = lado;
    return { fator: 0, recuo: ponto };
  }
  const recuo = [passoRecuo, passoRecuo / 2, passoRecuo / 4]
    .map(passo => ({ x: robo.x + dx * passo, y: robo.y + dy * passo }))
    .find(ponto => !caminhoMovimentoBloqueado(scene, robo, ponto));
  return { fator: 0, recuo };
}

export function velocidadeFilaRobo(scene, robo, destino, time) {
  return movimentoFilaRobo(scene, robo, destino, time).fator;
}

export function movimentoFilaRobo(scene, robo, destino, time, alvo = destino) {
  if (!roboDeOnda(robo)) return { fator: 1 };
  const estado = concentracaoRobos(scene, time);
  const x = destino.x - robo.x, y = destino.y - robo.y;
  const d = Math.hypot(x, y);
  const dx = x / Math.max(1, d), dy = y / Math.max(1, d);
  if (d >= 1) {
    registrarRoboNaFila(robo);
    intencoes.set(robo, { dx, dy, alvo, time });
  }
  const disputaAtiva = disputas.get(robo);
  if (disputaAtiva) {
    if (disputaAtiva.alvos.get(robo) !== alvo ||
        [disputaAtiva.lider, disputaAtiva.cede].some(r => !r.active || r.morto ||
          r.alvoAtual && disputaAtiva.alvos.get(r) !== r.alvoAtual)) finalizarDisputa(disputaAtiva);
    else {
      const movimento = movimentoDisputa(scene, robo, disputaAtiva);
      if (movimento) return movimento;
    }
  }
  if (d < 1) return { fator: 1 };

  const { alcanceFila, folgaLateral, velocidadeFila } = CONFIG_AGLOMERACAO;
  const origem = centro(robo);
  let avaliacao = robo.filaOnda;
  if (avaliacao?.rodada !== estado.time || dx * avaliacao.dx + dy * avaliacao.dy < 0.85 ||
      avaliacao.vizinho && (!avaliacao.vizinho.active || avaliacao.vizinho.morto)) {
    const candidatos = proximos(estado, origem, alcanceFila);
    let frente = Infinity, vizinho;
    for (const p of candidatos) {
      const ax = p.x - origem.x, ay = p.y - origem.y;
      const avanco = ax * dx + ay * dy;
      if (p.robo !== robo && avanco > 6 &&
        Math.abs(ay * dx - ax * dy) < folgaLateral &&
        avanco < frente && !caminhoMovimentoBloqueado(scene, robo, { x: robo.x + ax, y: robo.y + ay })) {
        frente = avanco;
        vizinho = p.robo;
      }
    }
    const semUltrapassagem = ponto => [-1, 1].every(lado => caminhoMovimentoBloqueado(scene, robo, {
      x: ponto.x - dy * folgaLateral * lado, y: ponto.y + dx * folgaLateral * lado,
    }, ponto));
    const estreito = Number.isFinite(frente) && (semUltrapassagem(robo) ||
      semUltrapassagem({ x: robo.x + dx * frente, y: robo.y + dy * frente }));
    avaliacao = robo.filaOnda = { rodada: estado.time, dx, dy, frente, vizinho, estreito };
  }
  const { frente, vizinho, estreito } = avaliacao;
  const intencao = intencoes.get(vizinho);
  if (estreito && intencao && time - intencao.time <= 3 * CONFIG_AGLOMERACAO.intervaloMs &&
      dx * intencao.dx + dy * intencao.dy < -0.7 &&
      (origem.x - centro(vizinho).x) * intencao.dx + (origem.y - centro(vizinho).y) * intencao.dy > 0 &&
      !disputas.has(vizinho)) {
    const recuoRobo = distanciaParaCeder(scene, robo, { dx, dy });
    const recuoVizinho = distanciaParaCeder(scene, vizinho, intencao);
    const prioridade = recuoRobo > recuoVizinho ||
      (recuoRobo === recuoVizinho && ordem.get(robo) < ordem.get(vizinho));
    const lider = prioridade ? robo : vizinho, cede = prioridade ? vizinho : robo;
    const rumo = intencoes.get(lider);
    const disputa = { lider, cede, dx: rumo.dx, dy: rumo.dy,
      alvos: new Map([[robo, alvo], [vizinho, intencao.alvo]]) };
    disputas.set(lider, disputa);
    disputas.set(cede, disputa);
    return movimentoDisputa(scene, robo, disputa) ?? { fator: 1 };
  }
  const parada = CONFIG_AGLOMERACAO.paradaFila;
  const fator = estreito ? (frente < parada ? 0 :
    Math.max(velocidadeFila, (frente - parada) / (alcanceFila - parada))) : 1;
  return { fator };
}

/** Reserva um lado alcançável e mantém a reserva enquanto ele continuar livre. */
export function pontoAtaqueOnda(scene, robo, alvo, time) {
  const { alcanceDistribuicao, ladosAtaque, raioAtaque } = CONFIG_AGLOMERACAO;
  if (!roboDeOnda(robo) || (robo.x - alvo.x) ** 2 + (robo.y - alvo.y) ** 2 > alcanceDistribuicao ** 2) {
    robo.ladoOnda = null;
    return null;
  }
  const estado = concentracaoRobos(scene, time);
  const anterior = robo.ladoOnda;
  if (anterior?.alvo === alvo && anterior.rodada === estado.time) return anterior.ponto;
  const aliados = proximos(estado, alvo, alcanceDistribuicao)
    .filter(p => p.robo !== robo && p.robo.alvoAtual === alvo);
  const ocupados = new Set(aliados.filter(p => p.robo.ladoOnda?.alvo === alvo).map(p => p.robo.ladoOnda.indice));
  const candidatos = [];
  if (aliados.length) for (let indice = 0; indice < ladosAtaque; indice++) {
    if (ocupados.has(indice)) continue;
    const angulo = indice * Math.PI * 2 / ladosAtaque;
    const ponto = { x: alvo.x + Math.cos(angulo) * raioAtaque, y: alvo.y + Math.sin(angulo) * raioAtaque };
    const custo = indice === anterior?.indice && anterior.alvo === alvo ? -1 :
      (ponto.x - robo.x) ** 2 + (ponto.y - robo.y) ** 2;
    candidatos.push({ indice, ponto, angulo, custo });
  }
  candidatos.sort((a, b) => a.custo - b.custo);
  const melhor = candidatos.find(({ ponto, angulo }) => {
    if (caminhoMovimentoBloqueado(scene, robo, ponto)) return false;
    const folga = CONFIG_AGLOMERACAO.folgaLateral;
    return [-1, 1].some(lado => !caminhoMovimentoBloqueado(scene, robo, {
      x: ponto.x - Math.sin(angulo) * folga * lado, y: ponto.y + Math.cos(angulo) * folga * lado,
    }, ponto));
  });
  robo.ladoOnda = { ...melhor, alvo, rodada: estado.time, ponto: melhor?.ponto ?? null };
  return robo.ladoOnda.ponto;
}
