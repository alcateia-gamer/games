/**
 * @file Regras de sobreposição visual da cidade e fábrica. Ajusta depth pelo Y ou pela posição
 * relativa ao personagem.
 */

// Depth ordena o desenho; não muda posição nem colisões. Valores maiores ficam à frente.
const DEPTHS = {
  worldBase: 12.5,
  worldScale: 0.0003,
  alwaysAboveWorld: 18,
  overlayAboveWorld: 20,
};

/**
 * Converte a coordenada Y do mundo em uma profundidade crescente para ordenar objetos da
 * cidade.
 */
function depthFromWorldY(y) {
  return DEPTHS.worldBase + Number(y) * DEPTHS.worldScale;
}

/**
 * Acrescenta um pequeno ajuste por Y à profundidade base de uma camada de objetos.
 */
function calcularDepthObjeto(profundidadeCamada, y) {
  return profundidadeCamada - Number(y || 0) / 100000;
}

const PROFUNDIDADES_OBJETOS_PARTE2 = {
  ObjetosRobos: 4,
  ObjetosProdução: 10,
  NeonArma: 17,
  ObjetosCozinha: 18,
  ObjetosArmazem: 19,
  Garras: 16.25,
  SuporteTrilho: 20,
  ObjetosBoss: 21,
  EstátuaRobos: 15,
};

/**
 * Reaplica a profundidade dos objetos de produção e armazém a partir da camada e do Y
 * armazenados.
 */
function atualizarDepthObjetosProducaoEArmazem(scene) {
  if (!Array.isArray(scene.objetosMapaParte2)) {
    return;
  }

  scene.objetosMapaParte2.forEach((visual) => {
    if (
      !visual?.active ||
      !["ObjetosProdução", "ObjetosArmazem"].includes(
        visual.getData("objectLayerName"),
      )
    ) {
      return;
    }

    visual.setDepth(
      calcularDepthObjeto(
        visual.getData("depthBase"),
        visual.getData("worldY"),
      ),
    );
  });
}

/**
 * Coloca cada garra acima ou abaixo do jogador conforme a posição de seus pés em relação ao
 * objeto.
 */
function atualizarDepthGarras(scene) {
  const player = scene.player;
  if (!player?.active || !Array.isArray(scene.objetosMapaParte2)) {
    return;
  }

  const playerY = player.body?.bottom ?? player.getBounds().bottom;
  const playerDepth = player.depth;

  scene.objetosMapaParte2.forEach((visual) => {
    if (!visual?.active || visual.getData("objectLayerName") !== "Garras") {
      return;
    }

    const garraY = visual.getData("worldY");
    const personagemAcima = playerY > garraY;
    visual.setDepth(playerDepth + (personagemAcima ? -0.01 : 0.01));
  });
}

/**
 * Compara os centros visuais do jogador e dos computadores PcAdm para inverter a sobreposição
 * durante a passagem.
 */
function atualizarDepthComputadoresPcAdm(scene) {
  const player = scene.player;
  if (!player?.active || !Array.isArray(scene.objetosMapaParte2)) {
    return;
  }

  const centroPlayerY = player.getBounds().centerY;

  scene.objetosMapaParte2.forEach((visual) => {
    if (!visual?.active || visual.getData("objectLayerName") !== "PcAdm") {
      return;
    }

    const centroObjetoY = visual.getBounds().centerY;
    const personagemAcima = centroPlayerY > centroObjetoY;

    visual.setDepth(player.depth + (personagemAcima ? -0.01 : 0.01));
  });
}

export {
  DEPTHS,
  depthFromWorldY,
  calcularDepthObjeto,
  PROFUNDIDADES_OBJETOS_PARTE2,
  atualizarDepthObjetosProducaoEArmazem,
  atualizarDepthGarras,
  atualizarDepthComputadoresPcAdm,
};
