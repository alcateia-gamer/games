const DEPTHS = {
  worldBase: 12.5,
  worldScale: 0.0003,
  alwaysAboveWorld: 18,
  overlayAboveWorld: 20,
};

function depthFromWorldY(y) {
  return DEPTHS.worldBase + Number(y) * DEPTHS.worldScale;
}

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

export {
  DEPTHS,
  depthFromWorldY,
  calcularDepthObjeto,
  PROFUNDIDADES_OBJETOS_PARTE2,
  atualizarDepthObjetosProducaoEArmazem,
  atualizarDepthGarras,
};
