const SLOT_SIZE = 36;
const SLOT_GAP = 5;
const SLOT_STRIDE = SLOT_SIZE + SLOT_GAP;
const UI_DEPTH = 220;

class InventoryUI {
  constructor(scene, inventory) {
    this.scene = scene;
    this.inventory = inventory;
    this.container = scene.add.container(0, 0).setDepth(UI_DEPTH);
    this.container.setScrollFactor(0);
    this.unsubscribe = inventory.onChange(() => this.render());
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

  render() {
    this.container.removeAll(true);
    const slots = this.inventory.getSlots();
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
      const x = column * SLOT_STRIDE - ((rowLength - 1) * SLOT_STRIDE) / 2;
      const y = row * SLOT_STRIDE;
      const definition = this.scene.inventoryItems.get(slot.itemId);

      const background = this.scene.add
        .rectangle(x, y, SLOT_SIZE, SLOT_SIZE, 0x07121d, 0.94)
        .setStrokeStyle(1, 0x16d9f5, 0.9);
      const icon = this.scene.add
        .image(x, y - 1, definition.image.key, definition.image.frame)
        .setDisplaySize(25, 25);
      const slotObjects = [background, icon];
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

    this.lastWidth = 0;
    this.updateCameraLayout();
  }

  getColumnCount() {
    const availableWidth = Math.max(1, this.scene.cameras.main.width - 24);
    return Math.max(1, Math.floor((availableWidth + SLOT_GAP) / SLOT_STRIDE));
  }

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
    const screenX = camera.width / 2;
    const screenY =
      camera.height -
      bottomPadding -
      SLOT_SIZE / 2 -
      (rows - 1) * SLOT_STRIDE;

    this.container
      .setPosition(
        originX + (screenX - originX) / zoomX,
        originY + (screenY - originY) / zoomY,
      )
      .setScale(1 / zoomX, 1 / zoomY);

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

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(
      Phaser.Scenes.Events.PRE_RENDER,
      this.updateCameraLayout,
    );
    this.unsubscribe?.();
    this.container.destroy();
  }
}

export { InventoryUI };
