/**
 * @file Interação com o gerador da fábrica: localiza a área do mapa, mostra o menu, consome
 * recursos e restaura a iluminação.
 */

const INTERACTION_LAYER_NAMES = ["interacoes", "coletaveis"];
const GENERATOR_OBJECT_NAME = "gerador01";
const GENERATOR_INTERACTION_RANGE = 48;
const FACTORY_GENERATOR_STATE_KEY = "factoryGeneratorPowered";
const GENERATOR_REQUIREMENTS = Object.freeze([
  Object.freeze({
    id: "gasolina",
    label: "COMBUSTÍVEL",
    quantity: 1,
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
    ({ id, quantity }) => inventory.getQuantity(id) < quantity,
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
  const camera = scene.cameras.main;
  const playerCenter = new Phaser.Math.Vector2();
  const inventory = scene.inventory;
  let dialogOpen = false;
  let isActivating = false;
  let activationCloseEvent = null;
  scene.geradorInteracaoDisponivel = false;

  const modal = scene.add.container(0, 0).setDepth(1000).setScrollFactor(0);
  const backdrop = scene.add
    .rectangle(0, 0, camera.width, camera.height, 0x02070b, 0.86)
    .setInteractive();
  const panel = scene.add
    .rectangle(0, 0, 500, 330, 0x08131b, 0.98)
    .setStrokeStyle(2, 0x29c9d8, 0.95);
  const title = scene.add
    .text(0, -122, "GERADOR INDUSTRIAL", {
      color: "#e7fbff",
      fontFamily: "monospace",
      fontSize: "24px",
      fontStyle: "bold",
    })
    .setOrigin(0.5);
  const state = scene.add
    .text(0, -88, "SEM ENERGIA", {
      color: "#ff6565",
      fontFamily: "monospace",
      fontSize: "16px",
      fontStyle: "bold",
    })
    .setOrigin(0.5);
  const fuelLabel = scene.add.text(-205, -38, "COMBUSTÍVEL (1)", {
    color: "#d7e4e8",
    fontFamily: "monospace",
    fontSize: "15px",
  });
  const fuelCount = scene.add
    .text(205, -38, "", {
      color: "#ff6565",
      fontFamily: "monospace",
      fontSize: "15px",
      fontStyle: "bold",
    })
    .setOrigin(1, 0);
  const batteryLabel = scene.add.text(-205, 8, "BATERIA (1)", {
    color: "#d7e4e8",
    fontFamily: "monospace",
    fontSize: "15px",
  });
  const batteryCount = scene.add
    .text(205, 8, "", {
      color: "#ff6565",
      fontFamily: "monospace",
      fontSize: "15px",
      fontStyle: "bold",
    })
    .setOrigin(1, 0);
  const feedback = scene.add
    .text(0, 58, "", {
      color: "#ff9292",
      fontFamily: "monospace",
      fontSize: "13px",
      align: "center",
      wordWrap: { width: 430 },
    })
    .setOrigin(0.5);
  /**
   * Monta um botão do modal com fundo interativo e texto centralizado.
   */
  const createButton = (x, y, width, label, fill, stroke) => {
    const button = scene.add
      .rectangle(x, y, width, 44, fill, 0.96)
      .setStrokeStyle(2, stroke, 1)
      .setInteractive({ useHandCursor: true });
    const text = scene.add
      .text(x, y, label, {
        color: "#f0fcff",
        fontFamily: "monospace",
        fontSize: "13px",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    return { button, text };
  };
  const activateButton = createButton(
    -95,
    119,
    220,
    "LIGAR GERADOR",
    0x07505a,
    0x30e0e9,
  );
  const cancelButton = createButton(
    157,
    119,
    125,
    "CANCELAR",
    0x282f35,
    0x84939b,
  );

  modal.add([
    backdrop,
    panel,
    title,
    state,
    fuelLabel,
    fuelCount,
    batteryLabel,
    batteryCount,
    feedback,
    activateButton.button,
    activateButton.text,
    cancelButton.button,
    cancelButton.text,
  ]);
  modal.setVisible(false);

  const escapeKey = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.ESC,
  );

  /**
   * Atualiza as quantidades disponíveis, as cores e o estado visual do botão de ativação.
   */
  const atualizarModal = () => {
    const missing = listarRecursosFaltantes(inventory);
    const fuelQuantity = inventory.getQuantity("gasolina");
    const batteryQuantity = inventory.getQuantity("bateria");
    fuelCount
      .setText(`POSSUI: ${fuelQuantity}`)
      .setColor(fuelQuantity >= 1 ? "#72f2a0" : "#ff6565");
    batteryCount
      .setText(`POSSUI: ${batteryQuantity}`)
      .setColor(batteryQuantity >= 1 ? "#72f2a0" : "#ff6565");
    activateButton.button.setAlpha(
      scene.luzFabricaAcesa || missing.length === 0 ? 1 : 0.58,
    );
    return missing;
  };

  /**
   * Mantém o modal centralizado e com tamanho fixo mesmo durante mudanças de zoom.
   */
  const posicionarElementosFixos = () => {
    if (!modal.scene) return;

    const zoomX = camera.zoomX || camera.zoom || 1;
    const zoomY = camera.zoomY || camera.zoom || 1;
    const originX = camera.width * camera.originX;
    const originY = camera.height * camera.originY;
    const screenCenterX = camera.width / 2;
    const screenCenterY = camera.height / 2;
    modal
      .setPosition(
        originX + (screenCenterX - originX) / zoomX,
        originY + (screenCenterY - originY) / zoomY,
      )
      .setScale(1 / zoomX, 1 / zoomY);
    backdrop.setSize(camera.width, camera.height);
  };

  /**
   * Fecha o modal, libera o movimento e limpa a mensagem de retorno.
   */
  const fecharModal = () => {
    if (!dialogOpen) return;
    dialogOpen = false;
    scene.generatorMenuOpen = false;
    scene.movimentoBloqueado = false;
    modal.setVisible(false);
    feedback.setText("");
    scene.player?.setVelocity(0, 0);
  };

  /**
   * Abre o menu do gerador e bloqueia o movimento enquanto o jogador escolhe uma ação.
   */
  const abrirModal = () => {
    if (dialogOpen || scene.luzFabricaAcesa) return;
    dialogOpen = true;
    scene.generatorMenuOpen = true;
    scene.geradorInteracaoDisponivel = false;
    scene.movimentoBloqueado = true;
    scene.player?.setVelocity(0, 0);
    feedback.setText("");
    feedback.setColor("#ff9292");
    state.setText("SEM ENERGIA").setColor("#ff6565");
    cancelButton.button.setInteractive({ useHandCursor: true });
    activateButton.button.setInteractive({ useHandCursor: true });
    atualizarModal();
    modal.setVisible(true);
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
    if (isActivating || scene.luzFabricaAcesa) return;

    const missing = atualizarModal();
    if (missing.length > 0) {
      feedback.setText(
        `FALTANDO: ${missing.map(({ label }) => label).join(" E ")}`,
      );
      return;
    }

    isActivating = true;
    const removed = inventory.removeItems(
      GENERATOR_REQUIREMENTS.map(({ id, quantity }) => ({
        itemId: id,
        quantity,
      })),
    );
    if (!removed) {
      isActivating = false;
      atualizarModal();
      feedback.setText("RECURSOS INSUFICIENTES. VERIFIQUE O INVENTÁRIO.");
      return;
    }

    scene.acenderLuzFabrica();
    state.setText("ENERGIA RESTABELECIDA").setColor("#72f2a0");
    feedback
      .setColor("#72f2a0")
      .setText("A FÁBRICA VOLTOU A TER ENERGIA.");
    activateButton.text.setText("GERADOR LIGADO");
    cancelButton.text.setText("FECHANDO...");
    activateButton.button.disableInteractive();
    cancelButton.button.disableInteractive();
    activationCloseEvent = scene.time.delayedCall(1100, () => {
      isActivating = false;
      fecharModal();
    });
  };

  /**
   * Encaminha toques no modal para ativar ou cancelar, ignorando comandos durante a ativação.
   */
  const handleMenuPointerDown = (pointer) => {
    if (!dialogOpen || isActivating) return;

    if (
      pointerDentroDoBotao(pointer, camera.width, camera.height, {
        x: -95,
        y: 119,
        width: 220,
        height: 44,
      })
    ) {
      ativarGerador();
    } else if (
      pointerDentroDoBotao(pointer, camera.width, camera.height, {
        x: 157,
        y: 119,
        width: 125,
        height: 44,
      })
    ) {
      fecharModal();
    }
  };

  scene.input.on("pointerdown", handleMenuPointerDown);
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, posicionarElementosFixos);

  /**
   * Atualiza a proximidade pela hitbox do jogador e permite fechar o menu com Esc.
   */
  scene.atualizarInteracaoGeradorFabrica = () => {
    if (dialogOpen) {
      atualizarModal();
      if (
        !isActivating &&
        Phaser.Input.Keyboard.JustDown(escapeKey)
      ) {
        fecharModal();
      }
      return;
    }

    // A aproximação usa a hitbox no chão, deslocada do centro visual do sprite.
    const bodyCenter = scene.player?.body?.center;
    if (bodyCenter) {
      playerCenter.copy(bodyCenter);
    } else {
      scene.player?.getCenter(playerCenter);
    }
    scene.geradorInteracaoDisponivel =
      !scene.luzFabricaAcesa &&
      !!scene.player?.active &&
      distanceToInteractionArea(playerCenter.x, playerCenter.y, area) <=
        GENERATOR_INTERACTION_RANGE;
  };

  posicionarElementosFixos();
  atualizarModal();

  /**
   * Remove modal, temporizadores, teclas e listeners; libera os bloqueios ao encerrar a cena.
   */
  const cleanup = () => {
    scene.events.off(
      Phaser.Scenes.Events.PRE_RENDER,
      posicionarElementosFixos,
    );
    scene.input.off("pointerdown", handleMenuPointerDown);
    activationCloseEvent?.remove(false);
    modal.destroy();
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
