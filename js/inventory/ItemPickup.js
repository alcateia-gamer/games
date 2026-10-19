import { InventoryUI } from "./InventoryUI.js";
import {
  createBuiltinInventoryTextures,
  getInventoryItem,
  listInventoryItems,
} from "./InventoryItems.js";
import { obterInventarioDoJogador } from "./Inventory.js";

const ITEM_LAYER_NAMES = ["Coletaveis", "Itens"];
const DEFAULT_PICKUP_RANGE = 64;
const PICKUP_BUTTON_DEPTH = 230;

function getProperty(object, propertyName) {
  return object.properties?.find(
    (property) =>
      property.name?.toLowerCase() === propertyName.toLowerCase(),
  )?.value;
}

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

function createPickupButton(scene) {
  const background = scene.add
    .rectangle(0, 0, 116, 38, 0x07121d, 0.96)
    .setStrokeStyle(2, 0x16d9f5, 1)
    .disableInteractive();
  const label = scene.add
    .text(0, 0, "E  PEGAR", {
      fontFamily: "monospace",
      fontSize: "13px",
      color: "#b5fbff",
      fontStyle: "bold",
    })
    .setOrigin(0.5);
  const container = scene.add
    .container(0, 0, [background, label])
    .setDepth(PICKUP_BUTTON_DEPTH)
    .setScrollFactor(0)
    .setVisible(false);

  return { background, container, label };
}

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
  let avisoAtivo = false;

  const definirVisibilidadeBotao = (visivel) => {
    if (scene.botaoColetarItemVisivel === visivel) return;

    scene.botaoColetarItemVisivel = visivel;
    scene.botaoColetarItem.container.setVisible(visivel);

    if (visivel) {
      scene.botaoColetarItem.background.setInteractive({
        useHandCursor: true,
      });
    } else {
      scene.botaoColetarItem.background.disableInteractive();
    }
  };

  scene.mostrarAvisoInventarioCheio = () => {
    avisoAtivo = true;
    scene.botaoColetarItem.label.setText("SEM ESPAÇO");
    scene.botaoColetarItem.background.setStrokeStyle(2, 0xff5577, 1);
    avisoInventarioCheio?.remove(false);
    avisoInventarioCheio = scene.time.delayedCall(1100, () => {
      if (!scene.botaoColetarItem) return;
      avisoAtivo = false;
      scene.botaoColetarItem.label.setText("E  PEGAR");
      scene.botaoColetarItem.background.setStrokeStyle(2, 0x16d9f5, 1);
    });
  };

  const itemLayers = ITEM_LAYER_NAMES.map((name) =>
    scene.map?.getObjectLayer(name),
  ).filter(Boolean);
  const avisosEmitidos = new Set();

  for (const object of itemLayers.flatMap((layer) => layer.objects ?? [])) {
    const itemId = getProperty(object, "itemId");
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
    const image = scene.add
      .image(position.x, position.y, item.image.key, item.image.frame)
      .setDisplaySize(28, 28)
      .setDepth(scene.calcularDepthMundo?.(position.y) ?? 30);

    scene.itensColetaveis.push({
      uniqueId,
      itemId,
      quantity,
      image,
      x: position.x,
      y: position.y,
      range,
      name: item.name,
    });
  }

  const coletarItemProximo = () => {
    const pickup = scene.itemColetavelProximo;
    if (!pickup || scene.inventory.hasCollected(pickup.uniqueId)) return false;

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
  scene.botaoColetarItem.background.on("pointerdown", coletarItemProximo);
  scene.atualizarColetaItens = () => {
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

    scene.itemColetavelProximo = nearest?.item ?? null;
    if (!avisoAtivo) {
      scene.botaoColetarItem.label.setText("E  PEGAR");
    }
    definirVisibilidadeBotao(!!nearest);

    if (nearest && Phaser.Input.Keyboard.JustDown(scene.teclaColetarItem)) {
      coletarItemProximo();
    }
  };

  scene.posicionarBotaoColetarItem = () => {
    const camera = scene.cameras.main;
    const zoomX = camera.zoomX || camera.zoom || 1;
    const zoomY = camera.zoomY || camera.zoom || 1;
    const originX = camera.width * camera.originX;
    const originY = camera.height * camera.originY;
    const screenX = camera.width - 68;
    const screenY = Math.max(
      42,
      Math.min(
        camera.height - 46,
        (scene.botaoAtaque?.y ?? camera.height - 100) - 74,
      ),
    );

    scene.botaoColetarItem.container
      .setPosition(
        originX + (screenX - originX) / zoomX,
        originY + (screenY - originY) / zoomY,
      )
      .setScale(1 / zoomX, 1 / zoomY);
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
    scene.botaoColetarItem.container.destroy();
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

function atualizarSistemaInventario(scene) {
  scene.atualizarColetaItens?.();
}

export { atualizarSistemaInventario, criarSistemaInventario };
