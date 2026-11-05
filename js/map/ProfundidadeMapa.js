/**
 * @file Regras de sobreposição visual da cidade e fábrica. Ajusta depth pelo Y ou pela posição
 * relativa ao personagem.
 */

import { obterConfiguracaoHitboxWalk, obterConfiguracaoHitboxAtaque } from "../player/colisoes/index.mjs";
import { atorNaRegiaoTroca } from "./TrocaCamada.js";

// Depth ordena o desenho; não muda posição nem colisões. Valores maiores ficam à frente.
const DEPTHS = {
  worldBase: 12.5,
  worldScale: 0.0003,
  alwaysAboveWorld: 18,
  overlayAboveWorld: 20,
};

const Y_LIMITE_CERCA_FABRICA2 = -2204;
const Y_LIMITE_PERSONAGEM_FRENTE_CERCA_FABRICA2 = -2177;
const MARGEM_DEPTH_CERCA_FABRICA2 = 0.01;
const SUPER_PC_REFERENCIA_SUPERIOR = new Set([1297, 1300]);

/**
 * Converte a coordenada Y do mundo em uma profundidade crescente para ordenar objetos da
 * cidade.
 */
function depthFromWorldY(y) {
  return DEPTHS.worldBase + Number(y) * DEPTHS.worldScale;
}

/**
 * Usa a mesma ordenação pelos pés para personagens e robôs, respeitando a faixa da fábrica.
 */
function calcularDepthAtor(scene, footY, ator = null) {
  if (Number.isFinite(scene.profundidadePersonagemParte2)) {
    const player = scene.player;
    const playerFootY = player?.body?.bottom ?? player?.getBounds?.().bottom ?? footY;
    // As camadas da fábrica podem ficar a apenas 0,001 do personagem.
    // Limita a variação a ±0,0005, mantendo a ordem dos pés sem atravessar essas camadas.
    const offset = Math.atan((footY - playerFootY) / 100) / Math.PI * 0.001;
    const base = Number.isFinite(scene.profundidadeRegiaoTroca) && atorNaRegiaoTroca(scene, ator)
      ? scene.profundidadeRegiaoTroca : scene.profundidadePersonagemParte2;
    return base + offset;
  }

  return scene.calcularDepthMundo
    ? scene.calcularDepthMundo(footY)
    : depthFromWorldY(footY);
}

/** Usa o contato físico com o chão, inclusive nas representações recebidas pela rede. */
function obterFootYAtor(ator) {
  if (Number.isFinite(ator?.body?.bottom)) return ator.body.bottom;
  if (ator?.mapCharacter && ator.getTopLeft) {
    const config = ator.remoteAttackActive
      ? obterConfiguracaoHitboxAtaque(ator.mapCharacter)
      : obterConfiguracaoHitboxWalk(ator.mapCharacter);
    return ator.getTopLeft().y + (config.offsetY + config.height) * Math.abs(ator.scaleY ?? 1);
  }
  return ator?.getBounds?.().bottom ?? ator?.y ?? 0;
}

/** Todos os atores móveis passam pela mesma ordenação, após a física e a interpolação. */
function atualizarDepthAtores(scene) {
  const atores = new Set([scene.player, scene.companionPet, ...(scene.inimigos ?? []),
    ...(scene.remotePlayers?.values?.() ?? [])]);
  for (const ator of atores) {
    if (ator?.active) ator.setDepth(calcularDepthAtor(scene, obterFootYAtor(ator), ator));
  }
}

/**
 * Ordena a camada inteira da cerca com histerese entre as duas posições de passagem.
 */
function atualizarDepthCercaFabrica2(scene) {
  const { player, camadaCercaFabrica2 } = scene;
  if (!Number.isFinite(player?.y) || !camadaCercaFabrica2) return;

  if (player.y <= Y_LIMITE_CERCA_FABRICA2) {
    scene.personagemAtrasCercaFabrica2 = true;
  } else if (player.y >= Y_LIMITE_PERSONAGEM_FRENTE_CERCA_FABRICA2) {
    scene.personagemAtrasCercaFabrica2 = false;
  } else if (typeof scene.personagemAtrasCercaFabrica2 !== "boolean") {
    scene.personagemAtrasCercaFabrica2 =
      Number.isFinite(player.depth) &&
      camadaCercaFabrica2.depth > player.depth;
  }

  const depthPersonagem = Number.isFinite(player.depth)
    ? player.depth
    : calcularDepthAtor(scene, obterFootYAtor(player), player);
  if (!Number.isFinite(depthPersonagem)) return;

  const margem = scene.personagemAtrasCercaFabrica2
    ? MARGEM_DEPTH_CERCA_FABRICA2
    : -MARGEM_DEPTH_CERCA_FABRICA2;
  camadaCercaFabrica2.setDepth(depthPersonagem + margem);
}

// Em empate, quem está pisando na base aparece à frente do cenário.
function depthCenario(scene, y) {
  return calcularDepthAtor(scene, y) - 1e-9;
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
  ObjetosSuperPC: 16.25,
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
 * Usa a base de cada garra para a passagem de qualquer ator.
 */
function atualizarDepthGarras(scene) {
  atualizarDepthObjetosPelaBase(scene, "Garras");
}

/**
 * Intercala cada objeto com os atores pela base, sem escolher um personagem como alvo.
 */
function atualizarDepthObjetosPelaBase(scene, nomeCamada) {
  if (!Array.isArray(scene.objetosMapaParte2)) return;
  scene.objetosMapaParte2.forEach((visual) => {
    if (!visual?.active || visual.getData("objectLayerName") !== nomeCamada) {
      return;
    }

    const baseY = visual.getData("worldY") ?? visual.getBounds?.().bottom ?? visual.y;
    if (Number.isFinite(baseY)) visual.setDepth(depthCenario(scene, baseY));
  });
}

/**
 * Ordena os computadores PcAdm pelo mesmo chão dos personagens.
 */
function atualizarDepthComputadoresPcAdm(scene) {
  atualizarDepthObjetosPelaBase(scene, "PcAdm");
}

/**
 * Os computadores cruzam os pés dos atores pela base; 1297 e 1300 usam a borda superior.
 * Permanecem acima de Objetos1/Objetos2.
 * Compara o Y assinado: -5800 fica abaixo (à frente) de -5900, mesmo no mapa negativo.
 */
function atualizarDepthObjetosSuperPC(scene) {
  if (!Array.isArray(scene.objetosMapaParte2)) return;
  for (const visual of scene.objetosMapaParte2) {
    if (!visual?.active || visual.getData("objectLayerName") !== "ObjetosSuperPC") continue;
    const referenciaY = SUPER_PC_REFERENCIA_SUPERIOR.has(visual.getData("tiledObjectId"))
      ? visual.getBounds?.().top
      : visual.getData("worldY") ?? visual.getBounds?.().bottom ?? visual.y;
    if (Number.isFinite(referenciaY)) visual.setDepth(depthCenario(scene, referenciaY));
  }
}

/**
 * Ordena cada objeto DepthPerso entre os atores que estão atrás e à frente dele.
 */
function atualizarDepthObjetosDepthPerso(scene) {
  atualizarDepthObjetosPelaBase(scene, "DepthPerso");
}

/** Ordena a parede entre as portas como um conjunto pela base, sem separar seus blocos. */
function atualizarDepthParedePortaBoss(scene) {
  const objetos = scene.objetosMapaParte2;
  if (!Array.isArray(objetos)) return;

  let baseY = -Infinity;
  for (const visual of objetos) {
    if (visual?.active && visual.getData("objectLayerName") === "ParedePortaBoss") {
      baseY = Math.max(baseY, visual.getData("worldY"));
    }
  }
  if (!Number.isFinite(baseY)) return;
  const depth = depthCenario(scene, baseY);
  for (const visual of objetos) {
    if (visual?.active && visual.getData("objectLayerName") === "ParedePortaBoss") {
      visual.setDepth(depth);
    } else if (visual?.active && visual.getData("objectLayerName") === "Leitordecartão") {
      visual.setDepth(depth + 1e-10);
    }
  }
}

export {
  DEPTHS,
  depthFromWorldY,
  calcularDepthAtor,
  obterFootYAtor,
  atualizarDepthAtores,
  atualizarDepthCercaFabrica2,
  calcularDepthObjeto,
  PROFUNDIDADES_OBJETOS_PARTE2,
  atualizarDepthObjetosProducaoEArmazem,
  atualizarDepthGarras,
  atualizarDepthComputadoresPcAdm,
  atualizarDepthObjetosSuperPC,
  atualizarDepthObjetosDepthPerso,
  atualizarDepthParedePortaBoss,
};
