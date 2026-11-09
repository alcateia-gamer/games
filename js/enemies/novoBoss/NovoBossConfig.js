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
  cenaEntrada: Object.freeze({
    ativo: true, velocidade: 1.25, idaMs: 3200, pausaMs: 900, voltaMs: 900,
    velocidadeTorres: 1.5, viagemTorreMs: 650, enquadramentoMs: 1000, margemEnquadramento: 70,
    cargaEscudoMs: 1500, dissipacaoRaiosMs: 350,
  }),
  combate: Object.freeze({
    vidaMaxima: 1000,
    preparacaoMs: 1500,
    janelaVulneravelMs: 4000,
    acertosPorAbertura: 3,
    intervaloAcertosMs: 0,
    fatorRecuo: 0.2,
  }),
  movimento: Object.freeze({ ativo: true, velocidade: 28, distanciaPreferida: 220,
    alternarRumoMs: 2600 }),
  prologo: Object.freeze({
    ativo: true, aberturaPortalMs: 650, fechamentoPortalMs: 450,
    preparacaoOndaMs: 1500, intervaloSpawnMs: 950, reposicaoMs: 700,
    protecaoSpawnMs: 1000, distanciaJogador: 140, distanciaPortais: 260,
    falhaEscudoMs: 650, recargaEscudoMs: 1200, colapsoMs: 1000,
    impactosPorJanela: 2, intervaloImpactosMs: 180, intervaloPadroesMs: 1800,
    ciclos: Object.freeze([
      Object.freeze({ total: 4, simultaneos: 2, padroes: ["espiral"] }),
      Object.freeze({ total: 5, simultaneos: 3, padroes: ["espiral", "aneis"] }),
      Object.freeze({ total: 6, simultaneos: 3, padroes: ["aneis", "rajadas"] }),
      Object.freeze({ total: 6, simultaneos: 4, padroes: ["espiral", "aneis", "rajadas"] }),
    ]),
    lasers: Object.freeze({ velocidade: 115, raio: 5, dano: 10, alcance: 650,
      vidaProjetilMs: 5000, avisoMs: 800 }),
  }),
  geradores: Object.freeze({
    ativo: true,
    distanciaInteracao: 72,
    tamanho: 36,
    vidaTorre: 120,
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
    ativo: true, limiarVida: 0.5, intervaloOndasMs: 10000, invulneravelAoClonarMs: 0,
    movimento: Object.freeze({ ativo: true, velocidade: 60, distanciaPreferida: 180,
      alternarRumoMs: 1800, intervaloTeleporteMs: 6000 }),
  }),
  ataques: Object.freeze({
    ativo: true,
    automatico: true,
    sequencia: Object.freeze(["chuva", "lasers", "ilusoes", "pulso", "tentaculos"]),
    pulsoRepulsao: Object.freeze({ centralizar: true, raio: 310, avisoMs: 1500, expansaoMs: 450, dano: 14, empurrao: 230, duracaoEmpurrao: 180 }),
    chuvaRaios: Object.freeze({ mirarJogador: true, raio: 96, avisoMs: 1000, intervaloMs: 400, quantidade: 15, reutilizarPontos: true, ajustarEscalaAoRaio: true, dano: 16, perigoMs: 150, frameMs: 100, frameImpacto: 4 }),
    lasersEspiral: Object.freeze({ centralizar: true, duracaoDisparosMs: 10000, intercalar: true, velocidade: 145, quantidade: 100, intervaloMs: 100, avisoMs: 700, passoAngulo: 22.5, raio: 6, alcance: 650, dano: 10, vidaProjetilMs: 5500 }),
    tentaculos: Object.freeze({ quantidade: 5, distanciaMinima: 120, distanciaMaxima: 300, apertosParaLibertar: 8, raio: 18, avisoMs: 1000, ativoMs: 18000, agarrarMs: 2500 }),
  }),
  teleporte: Object.freeze({
    pontos: Object.freeze([
      Object.freeze({ id: "centro", x: -1080, y: -5810 }),
      Object.freeze({ id: "esquerda", x: -1400, y: -5810 }),
      Object.freeze({ id: "direita", x: -760, y: -5810 }),
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

/** ZonaBoss define a área de ativação; os limites físicos da luta continuam na configuração. */
export function configurarZonasNovoBoss(map, config = novoBossConfig) {
  const camada = map?.getObjectLayer?.("ZonaBoss");
  if (!camada) return config;
  // Camadas de gatilhos podem ficar ocultas no editor sem desativar o encontro.
  const zonas = (camada.objects ?? []).filter(objeto => objeto.visible !== false &&
    !objeto.point && !objeto.ellipse && !objeto.polygon && !objeto.polyline && !objeto.gid && !objeto.text &&
    [objeto.x, objeto.y, objeto.width, objeto.height, objeto.rotation ?? 0].every(Number.isFinite) &&
    objeto.width > 0 && objeto.height > 0).map(objeto => {
    const angulo = (objeto.rotation ?? 0) * Math.PI / 180;
    return { x: objeto.x, y: objeto.y, width: objeto.width, height: objeto.height,
      cos: Math.cos(angulo), sin: Math.sin(angulo) };
  });
  return { ...config, arena: { ...config.arena, zonas } };
}

export function jogadorNaArenaNovoBoss(player, arena = novoBossConfig.arena) {
  if (!player?.active || player.morto || !Number.isFinite(player.x) || !Number.isFinite(player.y)) return false;
  if (Array.isArray(arena.zonas)) {
    return arena.zonas.some(zona => {
      const dx = player.x - zona.x, dy = player.y - zona.y;
      const x = dx * zona.cos + dy * zona.sin, y = -dx * zona.sin + dy * zona.cos;
      // As bordas fracionárias exportadas pelo Tiled podem diferir após a subtração.
      const margem = 1e-7;
      return x >= -margem && x <= zona.width + margem && y >= -margem && y <= zona.height + margem;
    });
  }
  return Boolean(
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
