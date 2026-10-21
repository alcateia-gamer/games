const ITEMS = new Map();

function normalizeItemDefinition(definition) {
  if (!definition || typeof definition !== "object") {
    throw new TypeError("A definição do item deve ser um objeto.");
  }

  const { id, name, image, maxStack = 99 } = definition;
  const imageDefinition =
    typeof image === "string" ? { key: image } : image;

  if (typeof id !== "string" || !id.trim()) {
    throw new TypeError("O item precisa de um ID não vazio.");
  }

  if (typeof name !== "string" || !name.trim()) {
    throw new TypeError(`O item "${id}" precisa de um nome.`);
  }

  if (
    !imageDefinition ||
    typeof imageDefinition.key !== "string" ||
    !imageDefinition.key.trim()
  ) {
    throw new TypeError(`O item "${id}" precisa de uma chave de imagem.`);
  }

  if (!Number.isInteger(maxStack) || maxStack < 1) {
    throw new TypeError(`O item "${id}" precisa de um maxStack positivo.`);
  }

  return Object.freeze({
    id: id.trim(),
    name: name.trim(),
    image: Object.freeze({
      key: imageDefinition.key.trim(),
      path: imageDefinition.path,
      frame: imageDefinition.frame,
    }),
    maxStack,
    category: definition.category ?? "misc",
    usable: definition.usable === true,
    showQuantity: definition.showQuantity !== false,
    equipmentSlot: definition.equipmentSlot ?? null,
  });
}

function registerInventoryItem(definition) {
  const item = normalizeItemDefinition(definition);

  if (ITEMS.has(item.id)) {
    throw new Error(`O item "${item.id}" já está registrado.`);
  }

  ITEMS.set(item.id, item);
  return item;
}

function getInventoryItem(itemId) {
  return ITEMS.get(itemId) ?? null;
}

function listInventoryItems() {
  return [...ITEMS.values()];
}

function preloadInventoryItemImages(scene) {
  const queuedKeys = new Set();

  for (const item of ITEMS.values()) {
    if (
      item.image.path &&
      !scene.textures.exists(item.image.key) &&
      !queuedKeys.has(item.image.key)
    ) {
      scene.load.image(item.image.key, item.image.path);
      queuedKeys.add(item.image.key);
    }
  }
}

function createBuiltinInventoryTextures(scene) {
  const textureKey = "inventory-scrap-icon";

  if (scene.textures.exists(textureKey)) {
    return;
  }

  const texture = scene.textures.createCanvas(textureKey, 24, 24);
  const context = texture.getContext();
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, 24, 24);
  context.fillStyle = "#06131d";
  context.fillRect(3, 3, 18, 18);
  context.fillStyle = "#00e5ff";
  context.fillRect(7, 2, 10, 3);
  context.fillRect(4, 5, 16, 3);
  context.fillRect(5, 8, 14, 9);
  context.fillRect(7, 17, 10, 3);
  context.fillRect(9, 20, 6, 2);
  context.fillStyle = "#b5fbff";
  context.fillRect(8, 6, 3, 3);
  context.fillRect(13, 10, 5, 2);
  context.fillStyle = "#087a9a";
  context.fillRect(7, 14, 4, 2);
  texture.refresh();
}

registerInventoryItem({
  id: "sucata",
  name: "Sucata",
  image: "inventory-scrap-icon",
  maxStack: 99,
  category: "material",
});

registerInventoryItem({
  id: "gasolina",
  name: "Gasolina",
  image: {
    key: "inventory-gasolina-icon",
    path: "COLETAVEIS/gasolina.png",
  },
  maxStack: 99,
  category: "consumable",
  usable: true,
  showQuantity: false,
});

registerInventoryItem({
  id: "bateria",
  name: "Bateria",
  image: {
    key: "inventory-bateria-icon",
    path: "COLETAVEIS/bateria.png",
  },
  maxStack: 99,
  category: "consumable",
  showQuantity: false,
});

registerInventoryItem({
  id: "card",
  name: "Crachá de Segurança",
  image: {
    key: "inventory-card-icon",
    path: "ACESSORIOS/Crachá_Segurança.png",
  },
  maxStack: 1,
  category: "key",
  showQuantity: false,
});

export {
  createBuiltinInventoryTextures,
  getInventoryItem,
  listInventoryItems,
  preloadInventoryItemImages,
  registerInventoryItem,
};
