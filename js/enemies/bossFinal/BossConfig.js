export const bossBaseX = -1093;
export const bossBaseY = -5905;
export const bossDepth = 21.5;
export const bossVidaMaxima = 1000;

export const intervaloEntreAtaques = 550;
export const duracaoFrame = 90;
export const distanciaPerto = 260;
export const distanciaLonge = 540;
export const previsaoMaxima = 52;

export const danoAtaqueChao = 16;
export const curaRecVidaPorFrame = 10;
export const percentualVidaParaRecuperar = 0.45;
export const cooldownRecVida = 16000;

export const mostrarHitboxes = true;

// =====================================================
// ANIMACOES - FRAMES DE 256x256
// =====================================================

export const estadosAnimacao = Object.freeze({
  idle: {
    textura: "boss-ataque-chao",
    frameFinal: 15,
    offsetX: 0,
    offsetY: 0,
  },
  ataqueChao: {
    textura: "boss-ataque-chao",
    frameFinal: 15,
    offsetX: 0,
    offsetY: 0,
  },
  raioChao: {
    textura: "boss-raio-chao",
    frameFinal: 11,
    offsetX: 0,
    offsetY: 0,
  },
  recVida: {
    textura: "boss-rec-vida",
    frameFinal: 24,
    offsetX: 0,
    offsetY: 0,
  },
  tiroLaser: {
    textura: "boss-tiro-laser",
    frameFinal: 18,
    offsetX: 0,
    offsetY: 0,
  },
});

export const ataquePorEstado = Object.freeze({
  ataqueChao: "chao",
  raioChao: "raio",
  recVida: "rec",
  tiroLaser: "laser",
});

// =====================================================
// HITBOX VERMELHA - COLISAO COM A BASE
// =====================================================
//
// O ponto (0,0) do Boss esta nos pes do sprite.
//
// Centro Y = -46:
// posiciona a hitbox sobre a base visual do robo,
// sem prolonga-la para o chao em frente.
//
// Dimensoes em unidades do mundo Phaser.
// =====================================================

export const colisaoBase = {
  x: 0,
  y: -110,
  largura: 150,
  altura: 50,
};

// =====================================================
// HITBOX VERDE - RECEBER DANO
// =====================================================
//
// NAO ALTERADA.
// Coordenadas locais do frame 256x256.
// =====================================================

export const zonasVulneraveis = Object.freeze({
  cabeca: {
    x: 105,
    y: 68,
    largura: 44,
    altura: 75,
  },
  corpo: {
    x: 67,
    y: 128,
    largura: 122,
    altura: 65,
  },
});

// =====================================================
// HITBOX AZUL - ATAQUE NO CHAO
// =====================================================
//
// CORRIGIDA.
//
// Centro Y positivo = deslocamento para o chao,
// abaixo do ponto de origem do Boss.
//
// A area nao fica mais em cima da cabeca.
// =====================================================

export const areaAtaqueChao = {
  x: 0,
  y: -100,
  largura: 240,
  altura: 250,
};

// Frames em que ocorre o impacto no chao.
export const framesImpactoChao = Object.freeze([6, 12]);

// =====================================================
// MAOS - HITBOX LARANJA
// =====================================================
//
// NAO ALTERADA.
// Formato: [centroX, centroY, largura, altura].
//
// Coordenadas locais de 256x256.
// A mao direita e espelhada horizontalmente.
// =====================================================

export const posesMaos = Object.freeze({
  ataqueChao: [
    [69, 185, 34, 39],
    [73, 172, 35, 40],
    [74, 149, 37, 45],
    [54, 123, 36, 51],
    [72, 155, 40, 48],
    [69, 181, 36, 40],
    [69, 192, 40, 42],
    [69, 184, 36, 40],
    [72, 155, 40, 47],
    [54, 123, 36, 51],
    [72, 155, 40, 47],
    [69, 183, 36, 39],
    [69, 192, 41, 43],
    [70, 177, 37, 39],
    [73, 155, 39, 46],
    [73, 175, 36, 44],
  ],

  raioChao: [
    [69, 185, 34, 39],
    [73, 172, 35, 40],
    [74, 149, 37, 45],
    [69, 163, 44, 45],
    [70, 177, 45, 44],
    [69, 192, 40, 42],
    [68, 191, 41, 42],
    [67, 192, 44, 43],
    [68, 189, 43, 43],
    [69, 183, 38, 40],
    [72, 177, 37, 40],
    [69, 187, 35, 40],
  ],

  recVida: [
    [69, 185, 34, 39],
    [73, 172, 35, 40],
    [72, 147, 42, 43],
    [58, 136, 42, 48],
    [57, 142, 46, 46],
    [54, 148, 43, 48],
    [55, 151, 42, 47],
    [56, 153, 42, 47],
    [56, 153, 42, 47],
    [56, 153, 42, 47],
    [56, 153, 42, 47],
    [56, 153, 42, 47],
    [56, 153, 42, 47],
    [56, 153, 42, 47],
    [56, 153, 42, 47],
    [56, 153, 42, 47],
    [56, 153, 42, 47],
    [56, 153, 42, 47],
    [57, 154, 43, 46],
    [61, 154, 43, 45],
    [69, 155, 43, 44],
    [72, 150, 44, 43],
    [69, 182, 37, 42],
    [72, 173, 35, 40],
    [69, 185, 34, 39],
  ],

  tiroLaser: [
    [69, 185, 34, 39],
    [72, 173, 37, 41],
    [79, 155, 39, 44],
    [76, 151, 44, 42],
    [73, 166, 42, 43],
    [72, 157, 43, 42],
    [71, 148, 45, 49],
    [71, 143, 47, 49],
    [71, 150, 46, 49],
    [74, 155, 45, 49],
    [75, 154, 42, 44],
    [72, 143, 46, 49],
    [73, 149, 46, 49],
    [73, 156, 44, 47],
    [73, 159, 46, 46],
    [73, 163, 43, 44],
    [73, 150, 46, 49],
    [73, 153, 46, 49],
    [72, 157, 46, 49],
  ],
});

// =====================================================
// FUNCOES AUXILIARES
// =====================================================

export function distanciaEntre(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function emitirEventoBoss(boss, evento, dados = {}) {
  boss.scene?.events.emit(evento, {
    boss,
    ...dados,
  });
}

export function obterNumeroFrameAnimacao(frame) {
  const valores = [
    frame?.textureFrame?.name,
    frame?.textureFrame,
    frame?.frame?.name,
    frame?.name,
  ];

  for (const valor of valores) {
    if (
      valor !== undefined &&
      valor !== null &&
      valor !== "" &&
      Number.isFinite(Number(valor))
    ) {
      return Math.max(0, Math.floor(Number(valor)));
    }
  }

  return Number.isFinite(frame?.index) ? Math.max(0, frame.index - 1) : 0;
}

// =====================================================
// BARRA DE VIDA
// =====================================================

export function atualizarBarraVidaBoss(boss) {
  if (boss?.barraVida) {
    boss.barraVida.width =
      boss.larguraBarraVida * (boss.vida / boss.vidaMaxima);
  }
}

// =====================================================
// LOCALIZACAO DAS PECAS NO MAPA
// =====================================================

export function localizarPecasBoss(scene) {
  return (scene.objetosMapaParte2 || []).filter((objeto) => {
    if (
      !objeto.active ||
      objeto.getData?.("objectLayerName") !== "ObjetosBoss"
    ) {
      return false;
    }

    const largura = objeto.displayWidth || objeto.width;

    const altura = objeto.displayHeight || objeto.height;

    const esquerda = objeto.x - largura * objeto.originX;

    const topo = objeto.y - altura * objeto.originY;

    return (
      esquerda + largura > bossBaseX - 180 &&
      esquerda < bossBaseX + 180 &&
      topo + altura > bossBaseY - 340 &&
      topo < bossBaseY + 30
    );
  });
}
