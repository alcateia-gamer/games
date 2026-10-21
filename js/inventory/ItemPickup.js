/**
 * @file Coleta de itens dos mapas Tiled e botão compartilhado de interação. A tecla E atende
 * itens, porta e gerador, respeitando o menu aberto.
 */

import { InventoryUI } from "./InventoryUI.js";
import {
  createBuiltinInventoryTextures,
  getInventoryItem,
  listInventoryItems,
} from "./InventoryItems.js";
import { obterInventarioDoJogador } from "./Inventory.js";
import { createCollectibleMarker } from "../ui/CollectibleMarker.js";

const ITEM_LAYER_NAMES = ["Coletaveis", "Itens"];
const DEFAULT_PICKUP_RANGE = 64;
const PICKUP_BUTTON_DEPTH = 230;
const CONFIG_BOTAO_COLETA = {
  tamanho: 60,
  distanciaXBotao: -30,
  distanciaYBotao: 90,
};

/**
 * Lê uma propriedade de um objeto Tiled sem diferenciar maiúsculas e minúsculas no nome.
 */
function getProperty(object, propertyName) {
  return object.properties?.find(
    (property) => property.name?.toLowerCase() === propertyName.toLowerCase(),
  )?.value;
}

/**
 * Converte pontos, retângulos e objetos de tile para a posição central onde o coletável será
 * desenhado.
 */
function getItemPosition(object) {
  if (object.point) return { x: object.x, y: object.y };

  const width = Number(object.width || 0);
  const height = Number(object.height || 0);

  if (object.gid) {
    return { x: object.x + width / 2, y: object.y - height / 2 };
  }

  if (width > 0 && height > 0) {
    return { x: object.x + width / 2, y: object.y + height / 2 };
  }

  return { x: object.x, y: object.y };
}

/**
 * Pré-filtra texturas muito reduzidas para evitar cintilação durante o movimento da câmera.
 * Preserva o frame inteiro, inclusive margens transparentes, e não modifica a imagem original.
 */
function preparePickupTexture(scene, item, displaySize) {
  const original = { key: item.image.key, frame: item.image.frame };
  const frame = scene.textures.getFrame(original.key, original.frame);
  // Duas amostras por pixel exibido preservam detalhes sem a redução extrema na GPU.
  const size = Math.ceil(displaySize * 2);
  if (frame.cutWidth <= size && frame.cutHeight <= size) return original;

  const key = `pickup-filtered:${original.key}:${frame.name}:${size}`;
  if (!scene.textures.exists(key)) {
    const texture = scene.textures.createCanvas(key, size, size);
    const context = texture.getContext();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      frame.source.image,
      frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
      0, 0, size, size,
    );
    texture.refresh();
    texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  }
  return { key, frame: undefined };
}

/**
 * Cria o botão de mão fixo na tela, inicialmente oculto.
 */
function createPickupButton(scene) {
  return scene.add
    .image(0, 0, "hand_icon")
    .setDisplaySize(CONFIG_BOTAO_COLETA.tamanho, CONFIG_BOTAO_COLETA.tamanho)
    .setDepth(PICKUP_BUTTON_DEPTH)
    .setScrollFactor(0)
    .setAlpha(0.75)
    .setVisible(false);
}

/**
 * Cria inventário, interface e coletáveis; restaura objetos já coletados e conecta as
 * interações por E e toque.
 */
function criarSistemaInventario(scene) {
  createBuiltinInventoryTextures(scene);
  scene.inventoryItems = new Map(
    listInventoryItems().map((item) => [item.id, item]),
  );
  scene.inventory = obterInventarioDoJogador(scene);
  scene.inventoryUI = new InventoryUI(scene, scene.inventory);
  scene.teclaColetarItem = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.E,
  );
  scene.botaoColetarItem = createPickupButton(scene);
  scene.itensColetaveis = [];
  scene.itemColetavelProximo = null;
  scene.botaoColetarItemVisivel = false;
  let avisoInventarioCheio;
  let interagirComMundo = null;

  /**
   * Alterna a visibilidade e a área clicável do botão apenas quando seu estado muda.
   */
  const definirVisibilidadeBotao = (visivel) => {
    if (scene.botaoColetarItemVisivel === visivel) return;

    scene.botaoColetarItemVisivel = visivel;
    scene.botaoColetarItem.setVisible(visivel);

    if (visivel) {
      scene.botaoColetarItem.setInteractive({ useHandCursor: true });
    } else {
      scene.botaoColetarItem.disableInteractive();
    }
  };

  /**
   * Destaca temporariamente o botão quando o inventário não tem espaço para a coleta.
   */
  scene.mostrarAvisoInventarioCheio = () => {
    scene.botaoColetarItem.setTint(0xff5577);
    avisoInventarioCheio?.remove(false);
    avisoInventarioCheio = scene.time.delayedCall(1100, () => {
      if (!scene.botaoColetarItem) return;
      scene.botaoColetarItem.clearTint();
    });
  };

  const itemLayers = ITEM_LAYER_NAMES.map((name) =>
    scene.map?.getObjectLayer(name),
  ).filter(Boolean);
  const avisosEmitidos = new Set();

  for (const object of itemLayers.flatMap((layer) => layer.objects ?? [])) {
    const itemId = getProperty(object, "itemId");
    // Áreas de porta e gerador podem dividir esta camada, mas não são itens.
    if (itemId == null) continue;
    const itemUid = getProperty(object, "itemUid");
    const item = getInventoryItem(itemId);

    if (!item) {
      const avisoKey = String(itemId);
      if (!avisosEmitidos.has(avisoKey)) {
        console.error(
          `[Inventário] itemId "${avisoKey}" não está registrado em InventoryItems.js.`,
        );
        avisosEmitidos.add(avisoKey);
      }
      continue;
    }

    if (!scene.textures.exists(item.image.key)) {
      console.error(
        `[Inventário] imagem "${item.image.key}" do item "${itemId}" não foi carregada.`,
      );
      continue;
    }

    const mapKey = scene.scene.key;
    // Combina mapa e objeto para distinguir itens com o mesmo ID em fases diferentes.
    const uniqueId = `${mapKey}:${itemUid ?? object.id}`;

    if (scene.inventory.hasCollected(uniqueId)) continue;

    const quantity = Number(getProperty(object, "quantidade") ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      console.error(
        `[Inventário] quantidade inválida no objeto Tiled ${object.id}.`,
      );
      continue;
    }

    const range = Number(
      getProperty(object, "alcance") ?? DEFAULT_PICKUP_RANGE,
    );
    if (!Number.isFinite(range) || range <= 0) {
      console.error(
        `[Inventário] alcance inválido no objeto Tiled ${object.id}.`,
      );
      continue;
    }

    const position = getItemPosition(object);
    const displaySize = itemId === "gasolina" ? 36.4 : 28;
    const texture = preparePickupTexture(scene, item, displaySize);
    const image = scene.add
      .image(position.x, position.y, texture.key, texture.frame)
      .setDisplaySize(displaySize, displaySize)
      .setDepth(
        itemId === "card"
          ? (scene.player?.depth ?? 30) - 0.01
          : scene.calcularDepthMundo?.(position.y) ?? 30,
      );

    scene.itensColetaveis.push({
      uniqueId,
      itemId,
      quantity,
      image,
      marker: createCollectibleMarker(scene, image),
      x: position.x,
      y: position.y,
      range,
      name: item.name,
    });
  }

  /**
   * Executa a interação selecionada ou coleta o item próximo; usa o gerador quando não há item
   * ou porta selecionados.
   */
  const coletarItemProximo = () => {
    if (scene.generatorMenuOpen) return false;
    if (interagirComMundo) {
      const interagiu = interagirComMundo();
      if (interagiu) {
        interagirComMundo = null;
        definirVisibilidadeBotao(false);
      }
      return interagiu;
    }
    const pickup = scene.itemColetavelProximo;
    if (!pickup) {
      return scene.geradorInteracaoDisponivel
        ? scene.interagirGerador?.() ?? false
        : false;
    }
    if (scene.inventory.hasCollected(pickup.uniqueId)) return false;

    if (!scene.inventory.addItem(pickup.itemId, pickup.quantity)) {
      scene.mostrarAvisoInventarioCheio?.();
      return false;
    }

    scene.inventory.markCollected(pickup.uniqueId);
    pickup.image.destroy();
    scene.itensColetaveis = scene.itensColetaveis.filter(
      (item) => item !== pickup,
    );
    scene.itemColetavelProximo = null;
    definirVisibilidadeBotao(false);
    return true;
  };

  scene.coletarItemProximo = coletarItemProximo;
  scene.botaoColetarItem.on("pointerdown", coletarItemProximo);
  /**
   * Seleciona o item ao alcance ou a interação de mundo mais próxima e processa a tecla E.
   */
  scene.atualizarColetaItens = () => {
    interagirComMundo = null;
    if (scene.generatorMenuOpen) {
      scene.itemColetavelProximo = null;
      definirVisibilidadeBotao(false);
      return;
    }

    const player = scene.player;
    if (!player?.active) return;

    const nearest = scene.itensColetaveis.reduce((closest, item) => {
      const distance = Phaser.Math.Distance.Between(
        player.x,
        player.y,
        item.x,
        item.y,
      );
      return distance <= item.range && (!closest || distance < closest.distance)
        ? { item, distance }
        : closest;
    }, null);

    const interaction = scene.interacaoMundoProxima;
    const useWorldInteraction = interaction &&
      (!nearest || interaction.distance < nearest.distance);
    interagirComMundo = useWorldInteraction ? interaction.interact : null;
    scene.itemColetavelProximo = useWorldInteraction ? null : nearest?.item ?? null;
    const canInteract = !!nearest || !!useWorldInteraction ||
      !!scene.geradorInteracaoDisponivel;
    definirVisibilidadeBotao(canInteract);

    if (canInteract && Phaser.Input.Keyboard.JustDown(scene.teclaColetarItem)) {
      coletarItemProximo();
    }
  };

  /**
   * Compensa o zoom para manter o botão de coleta próximo ao botão de ataque na tela.
   */
  scene.posicionarBotaoColetarItem = () => {
    const camera = scene.cameras.main;
    const zoomX = camera.zoomX || camera.zoom || 1;
    const zoomY = camera.zoomY || camera.zoom || 1;
    const originX = camera.width * camera.originX;
    const originY = camera.height * camera.originY;
    const screenX =
      (scene.botaoAtaque?.x ?? camera.width - 80) -
      CONFIG_BOTAO_COLETA.distanciaXBotao;
    const screenY = Math.max(
      42,
      Math.min(
        camera.height - 46,
        (scene.botaoAtaque?.y ?? camera.height - 100) -
          CONFIG_BOTAO_COLETA.distanciaYBotao,
      ),
    );

    scene.botaoColetarItem
      .setPosition(
        originX + (screenX - originX) / zoomX,
        originY + (screenY - originY) / zoomY,
      )
      .setDisplaySize(
        CONFIG_BOTAO_COLETA.tamanho / zoomX,
        CONFIG_BOTAO_COLETA.tamanho / zoomY,
      );
  };

  scene.events.on(
    Phaser.Scenes.Events.PRE_RENDER,
    scene.posicionarBotaoColetarItem,
  );
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(
      Phaser.Scenes.Events.PRE_RENDER,
      scene.posicionarBotaoColetarItem,
    );
    scene.itensColetaveis.forEach((item) => item.image.destroy());
    scene.itensColetaveis = [];
    scene.botaoColetarItem.destroy();
    scene.inventoryUI.destroy();
    scene.inventory.destroy();
    avisoInventarioCheio?.remove(false);
    scene.mostrarAvisoInventarioCheio = null;
    scene.inventoryUI = null;
    scene.botaoColetarItem = null;
    scene.botaoColetarItemVisivel = false;
    scene.inventory = null;
    scene.inventoryItems = null;
    scene.atualizarColetaItens = null;
    scene.coletarItemProximo = null;
    scene.posicionarBotaoColetarItem = null;
  });
}

/**
 * Executa a atualização de coleta quando o sistema está disponível na cena.
 */
function atualizarSistemaInventario(scene) {
  scene.atualizarColetaItens?.();
}

export { atualizarSistemaInventario, criarSistemaInventario, preparePickupTexture };
