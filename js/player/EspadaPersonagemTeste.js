/** Golpe da espada: um único relógio governa lâmina, quadros do efeito e janela de dano. */
import { obstaculosFlecha, tempoImpactoFlecha } from "./ArrowCollision.js";
import { causarDanoInimigo } from "../enemies/EnemyHealth.js";
import { causarDanoBoss } from "../enemies/BossFinal.js";
import { eAlvoAdicionalCombate, causarDanoAlvoAdicional } from "../combat/CombatTargets.js";

const radianos = graus => graus * Math.PI / 180;
const interpolar = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
const suave = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

// Tangentes contínuas, sem ultrapassar o arco nos pontos de mudança de direção.
function anguloDoArco(angulos, posicao) {
  const i = Math.floor(posicao), j = Math.min(i + 1, angulos.length - 1), t = posicao - i;
  const tangente = k => {
    if (k === 0 || k === angulos.length - 1) return 0;
    const a = angulos[k] - angulos[k - 1], b = angulos[k + 1] - angulos[k];
    return a * b > 0 ? 2 * a * b / (a + b) : 0;
  };
  return (2 * t ** 3 - 3 * t ** 2 + 1) * angulos[i] +
    (t ** 3 - 2 * t ** 2 + t) * tangente(i) +
    (-2 * t ** 3 + 3 * t ** 2) * angulos[j] + (t ** 3 - t ** 2) * tangente(j);
}

export function calcularFaseEspada(config, tempo, g = config.golpe, anguloInicial = g.anguloRepouso) {
  const duracaoEfeito = g.quadros * g.msPorQuadro;
  const duracao = g.preparo + duracaoEfeito + g.recuperacao;
  let angulo, quadro = -1;
  if (tempo < g.preparo) {
    angulo = interpolar(anguloInicial, g.angulos[0], suave(tempo / g.preparo));
  } else if (tempo < g.preparo + duracaoEfeito) {
    const posicao = (tempo - g.preparo) / g.msPorQuadro;
    quadro = Math.floor(posicao);
    angulo = anguloDoArco(g.angulos, posicao);
  } else {
    angulo = interpolar(g.angulos[g.quadros - 1], g.anguloRepouso,
      suave((tempo - g.preparo - duracaoEfeito) / g.recuperacao));
  }
  return { quadro, angulo: radianos(angulo), terminou: tempo >= duracao };
}

function avancarRelogioEspada(scene, estado) {
  const golpe = estado.golpeEspada, g = golpe.config;
  const delta = Math.max(0, scene.time.now - golpe.ultimoRelogio);
  golpe.ultimoRelogio = Math.max(golpe.ultimoRelogio, scene.time.now);
  let tempo = golpe.tempo + delta;
  const proximoQuadro = golpe.tempo < g.preparo ? 0
    : Math.floor((golpe.tempo - g.preparo) / g.msPorQuadro) + 1;
  // Em uma queda de FPS, retoma pelo próximo quadro em vez de saltar o arco ou o fade.
  // O mesmo tempo limitado governa a lâmina e o dano, sem acertos antes do efeito.
  if (proximoQuadro < g.quadros &&
    tempo >= g.preparo + (proximoQuadro + 1) * g.msPorQuadro) {
    tempo = g.preparo + proximoQuadro * g.msPorQuadro;
  }
  // Um golpe preparado emenda no fim do efeito, mesmo se o próximo update atrasar.
  if (estado.comboPendente) tempo = Math.min(tempo, g.preparo + g.quadros * g.msPorQuadro);
  golpe.tempo = tempo;
  return tempo;
}

/** Mantém o lado e a mira escolhidos no início do golpe, mesmo recuando ou cruzando o alvo. */
export function aplicarPoseEspada(scene, estado, pose) {
  const config = estado.config, golpe = estado.golpeEspada;
  const fase = golpe ? calcularFaseEspada(config, avancarRelogioEspada(scene, estado),
    golpe.config, golpe.anguloInicial)
    : { angulo: radianos(config.golpe.anguloRepouso) };
  const lado = pose.esquerda ? -1 : 1;
  pose.angulo += fase.angulo * lado;
  pose.rotacaoSprite = pose.angulo - config.anguloArte * lado;
  const alcance = Math.hypot(config.cano.x - config.empunhadura.x,
    config.cano.y - config.empunhadura.y) * pose.escala;
  pose.cano = { x: pose.mao.x + Math.cos(pose.angulo) * alcance,
    y: pose.mao.y + Math.sin(pose.angulo) * alcance };
}

export function iniciarGolpeEspada(scene, estado, g = estado.config.golpe, anguloAnterior = null) {
  const alcance = Math.hypot(estado.pose.cano.x - estado.pose.mao.x,
    estado.pose.cano.y - estado.pose.mao.y);
  const efeito = scene.add.image(estado.pose.mao.x, estado.pose.mao.y, g.prefixoTextura + 0)
    .setOrigin(g.origemEfeito.x / 128, g.origemEfeito.y / 128)
    .setScale(alcance / g.raioEfeito).setVisible(false);
  // A pose de repouso inclina a lâmina; a direção do golpe é a mira, antes dessa inclinação.
  const lado = estado.pose.esquerda ? -1 : 1;
  const angulo = estado.pose.angulo - radianos(g.anguloRepouso) * lado;
  // Continua da pose anterior pelo caminho mais curto, sem retornar ao repouso entre golpes.
  const diferenca = anguloAnterior === null ? null : (anguloAnterior - angulo) * lado;
  const anguloInicial = diferenca === null ? g.anguloRepouso
    : g.angulos[0] + Math.atan2(Math.sin(diferenca - radianos(g.angulos[0])),
      Math.cos(diferenca - radianos(g.angulos[0]))) * 180 / Math.PI;
  estado.golpeEspada = { config: g, tempo: 0, ultimoRelogio: scene.time.now,
    angulo, anguloInicial, esquerda: estado.pose.esquerda,
    direcao: { x: Math.cos(angulo), y: Math.sin(angulo) },
    efeito, acertados: new Set(), ultimoTempo: 0,
    ultimaMao: { ...estado.pose.mao }, somAcerto: false };
  if (scene.cache?.audio?.exists("ataque-no-ar")) {
    scene.sound.play("ataque-no-ar", { volume: 0.15 });
  }
}

function testarDano(scene, estado, alvos, tempo, anterior) {
  const golpe = estado.golpeEspada, config = estado.config, g = golpe.config;
  const inicioAtivo = g.preparo + g.quadroAtivoInicio * g.msPorQuadro;
  const fimAtivo = g.preparo + (g.quadroAtivoFim + 1) * g.msPorQuadro;
  const inicio = Math.max(anterior, inicioAtivo);
  const fim = Math.min(tempo, fimAtivo - 0.001);
  if (inicio > fim) return;
  const alcance = Math.hypot(config.cano.x - config.empunhadura.x,
    config.cano.y - config.empunhadura.y) * estado.pose.escala;
  // Amostra o arco a cada 8 ms e interpola a mão: um quadro lento não pula o acerto.
  const passos = Math.max(1, Math.ceil((fim - inicio) / 8));
  for (let i = 0; i <= passos; i++) {
    const instante = interpolar(inicio, fim, i / passos);
    const proporcao = tempo > anterior ? (instante - anterior) / (tempo - anterior) : 1;
    const mao = { x: interpolar(golpe.ultimaMao.x, estado.pose.mao.x, proporcao),
      y: interpolar(golpe.ultimaMao.y, estado.pose.mao.y, proporcao) };
    const angulo = golpe.angulo + calcularFaseEspada(config, instante, g).angulo *
      (estado.pose.esquerda ? -1 : 1);
    const direcao = { x: Math.cos(angulo), y: Math.sin(angulo) };
    const ponta = { x: mao.x + direcao.x * alcance, y: mao.y + direcao.y * alcance };
    let parede = Infinity;
    for (const corpo of obstaculosFlecha(scene, mao, ponta, 3)) {
      const impacto = tempoImpactoFlecha(mao, ponta, direcao, corpo, 0, 3);
      if (impacto !== null) parede = Math.min(parede, impacto);
    }
    for (const alvo of alvos) {
      if (!alvo.active || alvo.morto || golpe.acertados.has(alvo)) continue;
      const area = alvo.hitboxDano ?? alvo.body;
      if (!area) continue;
      const impacto = tempoImpactoFlecha(mao, ponta, direcao, area, 0, 3);
      if (impacto === null || impacto >= parede) continue;
      golpe.acertados.add(alvo);
      if (eAlvoAdicionalCombate(scene, alvo)) causarDanoAlvoAdicional(scene, alvo, config.dano, null, golpe);
      else if (alvo === scene.bossFinal) causarDanoBoss(scene, config.dano);
      else causarDanoInimigo(scene, alvo, config.dano);
      if (!golpe.somAcerto && scene.cache?.audio?.exists("katana-ataque")) {
        scene.sound.play("katana-ataque", { volume: 0.15 });
        golpe.somAcerto = true;
      }
    }
  }
}

export function atualizarGolpeEspada(scene, estado, alvos) {
  const golpe = estado.golpeEspada;
  if (!golpe) return;
  const tempo = golpe.tempo;
  testarDano(scene, estado, alvos, tempo, golpe.ultimoTempo);
  golpe.ultimoTempo = tempo;
  golpe.ultimaMao = { ...estado.pose.mao };
  const g = golpe.config, fase = calcularFaseEspada(estado.config, tempo, g);
  const flipX = estado.pose.esquerda && g.rotacaoEfeito === 90;
  const flipY = estado.pose.esquerda && !flipX;
  // Pivô fixo na mão e raio proporcional à lâmina. Entre dois PNGs, o arco gira
  // junto com a espada; a troca de quadro preserva o movimento natural da arte.
  const quadro = Math.max(0, fase.quadro);
  const ajuste = (fase.angulo - radianos(g.angulos[quadro])) * (estado.pose.esquerda ? -1 : 1);
  golpe.efeito.setVisible(fase.quadro >= 0 && estado.sprite.visible);
  if (fase.quadro >= 0) golpe.efeito.setTexture(g.prefixoTextura + fase.quadro);
  golpe.efeito.setPosition(estado.pose.mao.x, estado.pose.mao.y)
    .setOrigin(flipX ? 1 - g.origemEfeito.x / 128 : g.origemEfeito.x / 128,
      flipY ? 1 - g.origemEfeito.y / 128 : g.origemEfeito.y / 128)
    .setRotation(golpe.angulo + radianos(g.rotacaoEfeito) + ajuste).setFlipX(flipX).setFlipY(flipY)
    // O efeito cobre a espada em qualquer direção, mesmo quando a profundidade muda.
    .setDepth(estado.sprite.depth + (estado.pose.socketMedido ? 0.00003 : 0.02)).setAlpha(scene.player.alpha);
  if (fase.terminou) cancelarGolpeEspada(estado);
}

export function cancelarGolpeEspada(estado) {
  estado.golpeEspada?.efeito.destroy();
  estado.golpeEspada = null;
}
