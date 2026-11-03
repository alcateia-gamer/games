/**
 * @file Configuração do novo encontro. Coordenadas em pixels do mundo.
 * Os parâmetros formam a base da luta solo validada nos testes integrados e
 * permanecem centralizados para ajustes de playtest.
 */

export const novoBossConfig = Object.freeze({
  arena: Object.freeze({
    xMin: -1621,
    xMax: -537,
    yMin: -6144,
    yMax: -5394,
    entradaY: -5470,
  }),
  posicaoInicial: Object.freeze({ x: -1080, y: -5810 }),
  cameraArena: Object.freeze({
    fatorZoom: 0.8, velocidade: 5, margemSaidaX: 70, margemSaidaY: 80,
  }),
  combate: Object.freeze({
    vidaMaxima: 1000,
    preparacaoMs: 1500,
    janelaVulneravelMs: 4000,
    acertosPorAbertura: 3,
    intervaloAcertosMs: 250,
  }),
  geradores: Object.freeze({
    ativo: true,
    distanciaInteracao: 72,
    tamanho: 36,
    raioBarreira: 95,
    pontos: Object.freeze([
      Object.freeze({ id: "superior-esquerdo", x: -1460, y: -5920 }),
      Object.freeze({ id: "superior-direito", x: -740, y: -5920 }),
      Object.freeze({ id: "inferior-esquerdo", x: -1450, y: -5620 }),
      Object.freeze({ id: "inferior-direito", x: -720, y: -5620 }),
    ]),
  }),
  ilusoes: Object.freeze({ ativo: true, duracaoMs: 10000 }),
  clones: Object.freeze({ ativo: true, quantidade: 9, duracaoMs: 18000, velocidade: 55 }),
  fase2: Object.freeze({
    ativo: true, limiarVida: 0.5, intervaloOndasMs: 10000, invulneravelAoClonarMs: 2000,
    movimento: Object.freeze({ ativo: true, velocidade: 250, distanciaPreferida: 180,
      alternarRumoMs: 1200, intervaloTeleporteMs: 6000 }),
  }),
  ataques: Object.freeze({
    ativo: true,
    automatico: true,
    sequencia: Object.freeze(["chuva", "lasers", "ilusoes", "pulso", "tentaculos"]),
    pulsoRepulsao: Object.freeze({ centralizar: true, raio: 310, avisoMs: 1500, expansaoMs: 450, dano: 14, empurrao: 230, duracaoEmpurrao: 180 }),
    chuvaRaios: Object.freeze({ mirarJogador: true, raio: 96, avisoMs: 1000, intervaloMs: 400, quantidade: 15, reutilizarPontos: true, ajustarEscalaAoRaio: true, dano: 16, perigoMs: 150, frameMs: 100, frameImpacto: 4 }),
    lasersEspiral: Object.freeze({ centralizar: true, duracaoDisparosMs: 10000, intercalar: true, velocidade: 145, quantidade: 100, intervaloMs: 100, avisoMs: 700, passoAngulo: 22.5, raio: 6, alcance: 650, dano: 10, vidaProjetilMs: 5500 }),
    tentaculos: Object.freeze({ quantidade: 3, raio: 18, avisoMs: 1000, ativoMs: 3500, agarrarMs: 2500 }),
  }),
  teleporte: Object.freeze({
    pontos: Object.freeze([
      Object.freeze({ id: "centro", x: -1080, y: -5810 }),
      Object.freeze({ id: "esquerda", x: -1400, y: -5770 }),
      Object.freeze({ id: "direita", x: -760, y: -5770 }),
      Object.freeze({ id: "superior", x: -1080, y: -6020 }),
    ]),
    intervaloMinimoMs: 2400,
    preventivoMs: 10000,
    distanciaAproximacao: 180,
    desaparecerMs: 250,
    reaparecerMs: 250,
    reavaliarDestinoMs: 500,
  }),
  visual: Object.freeze({
    escala: 0.55,
    profundidade: 16.5,
    origemX: 0.5,
    origemY: 0.5,
    // Região do corpo principal dentro da célula idle de 288 × 288.
    corpo: Object.freeze({ x: 88, y: 76, largura: 112, altura: 196 }),
  }),
});

export function jogadorNaArenaNovoBoss(player, arena = novoBossConfig.arena) {
  return Boolean(
    player?.active &&
    !player.morto &&
    Number.isFinite(player.x) && Number.isFinite(player.y) &&
    player.x >= arena.xMin && player.x <= arena.xMax &&
    player.y >= arena.yMin && player.y <= arena.yMax &&
    player.y <= arena.entradaY,
  );
}

/** Área do corpo no mundo, usada para validar o ponto antes da criação. */
export function areaCorpoNovoBoss(config = novoBossConfig, ponto = config.posicaoInicial) {
  const { visual } = config;
  const corpo = visual.corpo;
  return {
    x: ponto.x + (corpo.x - 288 * visual.origemX) * visual.escala,
    y: ponto.y + (corpo.y - 288 * visual.origemY) * visual.escala,
    width: corpo.largura * visual.escala,
    height: corpo.altura * visual.escala,
  };
}
