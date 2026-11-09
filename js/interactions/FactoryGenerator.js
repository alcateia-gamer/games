/**
 * @file Interação com o gerador da fábrica: localiza a área do mapa, mostra o menu, consome
 * recursos e restaura a iluminação.
 */

import { criarSomGerador } from "../sounds/gerador.js";
import { criarPainelGerador } from "./FactoryGeneratorPanel.js";

const INTERACTION_LAYER_NAMES = ["interacoes", "coletaveis"];
const GENERATOR_OBJECT_NAME = "gerador01";
const GENERATOR_INTERACTION_RANGE = 48;
const FACTORY_GENERATOR_STATE_KEY = "factoryGeneratorPowered";
const GENERATOR_REQUIREMENTS = Object.freeze([
  Object.freeze({
    id: "gasolina",
    label: "COMBUSTÍVEL",
    quantity: 1,
    minFuel: 1,
  }),
  Object.freeze({
    id: "bateria",
    label: "BATERIA",
    quantity: 1,
  }),
]);

/**
 * Procura uma área retangular pelo nome em Interacoes ou Coletaveis, aceitando dados Tiled e
 * camadas do Phaser.
 */
function findFactoryInteraction(map, objectName) {
  const objectLayers = Array.isArray(map?.objects)
    ? map.objects
    : map?.layers;
  const layers = objectLayers?.filter(
    (objectLayer) =>
      INTERACTION_LAYER_NAMES.includes(objectLayer.name?.toLowerCase()),
  );

  if (!layers?.length) {
    return { status: "missing-layer" };
  }

  const object = layers.flatMap((layer) => layer.objects ?? []).find(
    (mapObject) => mapObject.name === objectName,
  );

  if (!object) {
    return { status: "missing-object" };
  }

  if (
    object.point ||
    !Number.isFinite(object.width) ||
    !Number.isFinite(object.height) ||
    object.width <= 0 ||
    object.height <= 0
  ) {
    return { status: "invalid-area" };
  }

  return { status: "ok", object };
}

/**
 * Localiza a área gerador01 usando as mesmas regras de busca das outras interações da fábrica.
 */
function findGeneratorInteraction(map) {
  return findFactoryInteraction(map, GENERATOR_OBJECT_NAME);
}

/**
 * Calcula a distância do ponto até a borda mais próxima do retângulo; pontos internos têm
 * distância zero.
 */
function distanceToInteractionArea(x, y, area) {
  const nearestX = Math.max(area.x, Math.min(x, area.x + area.width));
  const nearestY = Math.max(area.y, Math.min(y, area.y + area.height));
  return Math.hypot(x - nearestX, y - nearestY);
}

/**
 * Verifica se o ponteiro está dentro de um botão cujas coordenadas são relativas ao centro da
 * tela.
 */
function pointerDentroDoBotao(pointer, viewportWidth, viewportHeight, area) {
  return (
    pointer.x >= viewportWidth / 2 + area.x - area.width / 2 &&
    pointer.x <= viewportWidth / 2 + area.x + area.width / 2 &&
    pointer.y >= viewportHeight / 2 + area.y - area.height / 2 &&
    pointer.y <= viewportHeight / 2 + area.y + area.height / 2
  );
}

/**
 * Lista os requisitos do gerador que o inventário ainda não atende.
 */
function listarRecursosFaltantes(inventory) {
  return GENERATOR_REQUIREMENTS.filter(
    ({ id, quantity, minFuel }) => inventory.getQuantity(id, { minFuel }) < quantity,
  );
}

/**
 * Configura proximidade, menu, ativação e limpeza do gerador a partir da área definida no
 * mapa.
 */
function criarInteracaoGeradorFabrica(scene) {
  const result = findGeneratorInteraction(scene.map);

  if (result.status !== "ok") {
    const details = {
      "missing-layer":
        "camada de objetos 'Interacoes' ou 'Coletaveis' (o nome não diferencia maiúsculas)",
      "missing-object":
        "objeto retangular 'gerador01' em 'Interacoes' ou 'Coletaveis'",
      "invalid-area":
        "objeto 'gerador01' com largura e altura maiores que zero",
    }[result.status];
    console.warn(
      `[Gerador] Não foi possível configurar a interação: falta ${details}. ` +
        "No Tiled, use a camada de objetos 'Interacoes' ou 'Coletaveis' e adicione nela " +
        "um objeto retangular chamado 'gerador01' cobrindo a área de interação.",
    );
    return () => {};
  }

  const area = result.object;
  const playerCenter = new Phaser.Math.Vector2();
  const inventory = scene.inventory;
  const generatorSound = criarSomGerador(scene);
  let dialogOpen = false;
  let isActivating = false;
  let activationCloseEvent = null;
  scene.geradorInteracaoDisponivel = false;

  const escapeKey = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  const painel = criarPainelGerador(scene, {
    onActivate: () => ativarGerador(),
    onClose: () => fecharModal(),
  });
  let movimentoAnterior = false;
  let cleanedUp = false;

  /**
   * Fecha o modal, libera o movimento e limpa a mensagem de retorno.
   */
  const fecharModal = () => {
    if (!dialogOpen) return;
    dialogOpen = false;
    scene.generatorMenuOpen = false;
    if (!scene.morteEmAndamento) scene.movimentoBloqueado = movimentoAnterior;
    painel.close();
    scene.player?.setVelocity(0, 0);
  };
  const handleEscape = () => {
    if (dialogOpen && !isActivating) fecharModal();
  };
  escapeKey.on("down", handleEscape);

  /**
   * Abre o menu do gerador e bloqueia o movimento enquanto o jogador escolhe uma ação.
   */
  const abrirModal = () => {
    if (dialogOpen || scene.luzFabricaAcesa || scene.generatorMenuOpen || scene.devItemMenuOpen) return;
    dialogOpen = true;
    scene.generatorMenuOpen = true;
    scene.geradorInteracaoDisponivel = false;
    movimentoAnterior = !!scene.movimentoBloqueado;
    scene.movimentoBloqueado = true;
    scene.player?.setVelocity(0, 0);
    painel.open();
  };

  /**
   * Abre o modal somente quando há proximidade válida e informa se a interação foi atendida.
   */
  scene.interagirGerador = () => {
    if (!scene.geradorInteracaoDisponivel) return false;
    abrirModal();
    return dialogOpen;
  };

  /**
   * Valida e consome gasolina e bateria, acende a fábrica e agenda o fechamento após a
   * confirmação visual.
   */
  const ativarGerador = () => {
    if (!dialogOpen || isActivating || scene.luzFabricaAcesa || !painel.ready()) return;

    isActivating = true;
    const removed = inventory.removeItems(
      GENERATOR_REQUIREMENTS.map(({ id, quantity, minFuel }) => ({
        itemId: id,
        quantity,
        minFuel,
      })),
    );
    if (!removed) {
      isActivating = false;
      painel.refresh(true);
      painel.message("Recursos insuficientes. Verifique o inventário.");
      return;
    }

    scene.acenderLuzFabrica(() => generatorSound.getStartupProgress());
    generatorSound.update(
      distanceToInteractionArea(playerCenter.x, playerCenter.y, area),
    );
    painel.start();
    activationCloseEvent = scene.time.delayedCall(1100, () => {
      isActivating = false;
      fecharModal();
    });
  };

  /**
   * Atualiza a proximidade pela hitbox do jogador e permite fechar o menu com Esc.
   */
  scene.atualizarInteracaoGeradorFabrica = () => {
    // A aproximação usa a hitbox no chão, deslocada do centro visual do sprite.
    const bodyCenter = scene.player?.body?.center;
    if (bodyCenter) {
      playerCenter.copy(bodyCenter);
    } else {
      scene.player?.getCenter(playerCenter);
    }
    const distance = scene.player?.active
      ? distanceToInteractionArea(playerCenter.x, playerCenter.y, area)
      : Infinity;
    generatorSound.update(distance);

    if (dialogOpen) {
      painel.refresh();
      return;
    }

    scene.geradorInteracaoDisponivel =
      !scene.luzFabricaAcesa &&
      !!scene.player?.active &&
      distance <= GENERATOR_INTERACTION_RANGE;
  };

  /**
   * Remove modal, temporizadores, teclas e listeners; libera os bloqueios ao encerrar a cena.
   */
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    activationCloseEvent?.remove(false);
    generatorSound.destroy();
    painel.destroy();
    escapeKey.off("down", handleEscape);
    escapeKey.destroy();
    scene.generatorMenuOpen = false;
    scene.movimentoBloqueado = false;
    scene.geradorInteracaoDisponivel = false;
    scene.interagirGerador = null;
    scene.atualizarInteracaoGeradorFabrica = null;
  };

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  return cleanup;
}

export {
  FACTORY_GENERATOR_STATE_KEY,
  GENERATOR_REQUIREMENTS,
  criarInteracaoGeradorFabrica,
  distanceToInteractionArea,
  findFactoryInteraction,
  findGeneratorInteraction,
  listarRecursosFaltantes,
  pointerDentroDoBotao,
};
