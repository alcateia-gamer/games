/**
 * @file Interface dos slots do inventário. Prepara ícones sem margens transparentes e mantém
 * posição e tamanho durante o zoom.
 */

import { obterTemaPersonagem } from "../ui/CharacterTheme.js";

const SLOT_SIZE = 36;
const SLOT_GAP = 5;
const SLOT_STRIDE = SLOT_SIZE + SLOT_GAP;
const UI_DEPTH = 220;
const ICON_SIZE = SLOT_SIZE - 2;

/** A porcentagem é desenhada pelo navegador para não ser ampliada com o canvas de pixel art. */
function createFuelLabel(scene, index) {
  if (!scene.add.dom) return null;
  const node = document.createElement("div");
  node.setAttribute("data-inventory-fuel-label", String(index));
  Object.assign(node.style, {
    font: "bold 9px monospace", color: "#ffe29a", background: "#07121d",
    whiteSpace: "nowrap", pointerEvents: "none", textRendering: "optimizeLegibility",
  });
  const label = scene.add.dom(0, 0, node).setOrigin(0.5).setScrollFactor(0)
    .setDepth(UI_DEPTH + 1).setName(`inventory-fuel-label-native:${index}`);
  label.pointerEvents = "none";
  return label;
}

/**
 * Encontra os pixels visíveis do frame, preserva sua proporção e armazena um ícone no tamanho
 * final para reutilização.
 */
function prepareInventoryIcon(scene, definition, iconSize = ICON_SIZE) {
  const iconKey = `inventory-ui-icon:${definition.id}${iconSize === ICON_SIZE ? "" : `:${iconSize}`}`;
  if (scene.textures.exists(iconKey)) return iconKey;

  const frame = scene.textures.getFrame(definition.image.key, definition.image.frame);
  const canvas = document.createElement("canvas");
  canvas.width = frame.cutWidth;
  canvas.height = frame.cutHeight;
  const sourceContext = canvas.getContext("2d", { willReadFrequently: true });
  sourceContext.drawImage(
    frame.source.image,
    frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
    0, 0, canvas.width, canvas.height,
  );
  const { data } = sourceContext.getImageData(0, 0, canvas.width, canvas.height);
  let left = canvas.width;
  let top = canvas.height;
  let right = -1;
  let bottom = -1;

  // Localiza o conteúdo visível de cada item apenas ao criar seu ícone.
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (data[(y * canvas.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  const texture = scene.textures.createCanvas(iconKey, iconSize, iconSize);
  const context = texture.getContext();

  if (right >= left && bottom >= top) {
    const cropWidth = right - left + 1;
    const cropHeight = bottom - top + 1;
    const scale = iconSize / Math.max(cropWidth, cropHeight);
    const width = cropWidth * scale;
    const height = cropHeight * scale;

    // Prepara o tamanho final uma única vez, preservando a proporção.
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      canvas, left, top, cropWidth, cropHeight,
      (iconSize - width) / 2, (iconSize - height) / 2,
      width, height,
    );
  }

  texture.refresh();
  texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return iconKey;
}

class InventoryUI {
  /**
   * Cria o container da interface e assina mudanças do inventário, reposicionamento e
   * encerramento da cena.
   */
  constructor(scene, inventory) {
    this.scene = scene;
    this.inventory = inventory;
    this.container = scene.add.container(0, 0).setDepth(UI_DEPTH);
    this.container.setScrollFactor(0);
    this.fuelVisuals = [];
    this.unsubscribe = inventory.onChange(slots => {
      const signature = slots.map(slot => `${slot.itemId}:${slot.quantity}`).join("|");
      if (signature === this.slotSignature) this.updateFuelBars(slots);
      else this.render();
    });
    this.updateCameraLayout = this.updateCameraLayout.bind(this);
    this.scene.events.on(
      Phaser.Scenes.Events.PRE_RENDER,
      this.updateCameraLayout,
    );
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
    this.lastWidth = 0;
    this.lastHeight = 0;
    this.lastZoom = 0;
    this.columns = 0;
    this.destroyed = false;
    this.render();
  }

  /**
   * Reconstrói os slots ocupados, seus ícones e os contadores habilitados na definição de cada
   * item.
   */
  render() {
    for (const { nativeLabel } of this.fuelVisuals) nativeLabel?.destroy();
    this.container.removeAll(true);
    const slots = this.inventory.getSlots();
    this.slotSignature = slots.map(slot => `${slot.itemId}:${slot.quantity}`).join("|");
    this.fuelVisuals = [];
    const columns = this.getColumnCount();
    this.columns = columns;

    if (slots.length === 0) {
      this.container.setVisible(false);
      this.updateCameraLayout();
      return;
    }

    this.container.setVisible(true);

    slots.forEach((slot, index) => {
      const row = Math.floor(index / columns);
      const rowStart = row * columns;
      const rowLength = Math.min(columns, slots.length - rowStart);
      const column = index % columns;
      const x = Math.round(
        column * SLOT_STRIDE - ((rowLength - 1) * SLOT_STRIDE) / 2,
      );
      const y = row * SLOT_STRIDE;
      const definition = this.scene.inventoryItems.get(slot.itemId);

      const background = this.scene.add
        .rectangle(x, y, SLOT_SIZE, SLOT_SIZE, 0x07121d, 0.94)
        .setStrokeStyle(1, obterTemaPersonagem(this.scene.personagemSelecionada).accent, 0.9);
      const iconKey = prepareInventoryIcon(this.scene, definition);
      const icon = this.scene.add
        .image(x, y, iconKey)
        .setDisplaySize(ICON_SIZE, ICON_SIZE);
      const slotObjects = [background, icon];
      if (slot.itemId === "gasolina") {
        icon.setPosition(x, y - 4).setDisplaySize(ICON_SIZE - 7, ICON_SIZE - 7);
        const track = this.scene.add.rectangle(x - 14, y + 13, 28, 4, 0x26333c).setOrigin(0, 0.5);
        const bar = this.scene.add.rectangle(x - 14, y + 13, 28, 4, 0xf3c24b).setOrigin(0, 0.5)
          .setName(`inventory-fuel-bar:${index}`);
        const label = this.scene.add.text(x, y + 6, "", {
          fontFamily: "monospace", fontSize: "8px", color: "#ffe29a",
          backgroundColor: "#07121d", resolution: 2,
        }).setOrigin(0.5);
        const nativeLabel = createFuelLabel(this.scene, index);
        if (nativeLabel) label.setAlpha(0);
        this.fuelVisuals.push({ index, bar, label, nativeLabel });
        slotObjects.push(track, bar, label);
      }
      if (definition.showQuantity) {
        const amount = this.scene.add
          .text(x + 15, y + 14, String(slot.quantity), {
            fontFamily: "monospace",
            fontSize: "10px",
            color: "#ffffff",
            backgroundColor: "#07121d",
            padding: { x: 2, y: 1 },
          })
          .setOrigin(1, 1);
        slotObjects.push(amount);
      }

      this.container.add(slotObjects);
    });

    this.updateFuelBars(slots);
    this.lastWidth = 0;
    this.updateCameraLayout();
  }

  /** Atualiza só a barra e a porcentagem durante o abastecimento. */
  updateFuelBars(slots) {
    for (const { index, bar, label, nativeLabel } of this.fuelVisuals) {
      const fuel = slots[index]?.fuel ?? 0;
      bar.setScale(fuel, 1).setData("fuel", fuel);
      label.setText(`${Math.floor(fuel * 100)}%`);
      if (nativeLabel) {
        nativeLabel.node.textContent = label.text;
        nativeLabel.updateSize();
      }
    }
  }

  /**
   * Calcula quantos slots cabem por linha na largura disponível da câmera.
   */
  getColumnCount() {
    const availableWidth = Math.max(1, this.scene.cameras.main.width - 24);
    return Math.max(1, Math.floor((availableWidth + SLOT_GAP) / SLOT_STRIDE));
  }

  /**
   * Centraliza as linhas na parte inferior e compensa o zoom para manter o tamanho dos slots
   * na tela.
   */
  updateCameraLayout() {
    const camera = this.scene.cameras.main;
    if (!camera || !this.container.scene) return;

    const columns = this.getColumnCount();
    if (columns !== this.columns) {
      this.render();
      return;
    }

    const zoomX = camera.zoomX || camera.zoom || 1;
    const zoomY = camera.zoomY || camera.zoom || 1;
    const originX = camera.width * camera.originX;
    const originY = camera.height * camera.originY;
    const bottomPadding = this.scene.joystick?.base?.active ? 12 : 8;
    const rows = Math.ceil(this.inventory.getSlotCount() / columns);
    const screenX = Math.round(camera.width / 2);
    const screenY = Math.round(
      camera.height -
      bottomPadding -
      SLOT_SIZE / 2 -
      (rows - 1) * SLOT_STRIDE,
    );

    this.container
      .setPosition(
        originX + (screenX - originX) / zoomX,
        originY + (screenY - originY) / zoomY,
      )
      .setScale(1 / zoomX, 1 / zoomY);

    for (const { label, nativeLabel } of this.fuelVisuals) {
      nativeLabel?.setPosition(this.container.x + label.x / zoomX,
        this.container.y + label.y / zoomY)
        .setScale(1 / zoomX, 1 / zoomY).setVisible(this.container.visible);
    }

    if (
      camera.width !== this.lastWidth ||
      camera.height !== this.lastHeight ||
      zoomX !== this.lastZoom
    ) {
      this.lastWidth = camera.width;
      this.lastHeight = camera.height;
      this.lastZoom = zoomX;
    }
  }

  /**
   * Cancela a assinatura do inventário, remove listeners e destrói o container uma única vez.
   */
  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(
      Phaser.Scenes.Events.PRE_RENDER,
      this.updateCameraLayout,
    );
    this.unsubscribe?.();
    for (const { nativeLabel } of this.fuelVisuals) nativeLabel?.destroy();
    this.container.destroy();
  }
}

export { InventoryUI, prepareInventoryIcon };
