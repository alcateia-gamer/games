/** Painel do gerador. Os encaixes reservam os itens; o consumo pertence à ativação. */
import { getInventoryItem } from "../inventory/InventoryItems.js";
import { prepareInventoryIcon } from "../inventory/InventoryUI.js";
import { criarDisplayGerador } from "./FactoryGeneratorDisplay.js";

const WIDTH = 740;
const HEIGHT = 390;
const GREEN = 0x64f5ba;
const DIM = 0x347958;
const ROWS = [
  { id: "bateria", name: "Bateria", y: -20, sourceY: -25, number: "01" },
  { id: "gasolina", name: "Gasolina", y: 90, sourceY: 54, number: "02" },
];
const inside = (p, x, y, w, h) => Math.abs(p.x - x) <= w / 2 && Math.abs(p.y - y) <= h / 2;

export function criarPainelGerador(scene, { onActivate, onClose }) {
  const camera = scene.cameras.main;
  const inventory = scene.inventory;
  const display = criarDisplayGerador(scene, WIDTH, HEIGHT);
  const root = scene.add.container(0, 0).setDepth(1000).setScrollFactor(0)
    .setName("generator-modal").setVisible(false);
  const backdrop = scene.add.rectangle(0, 0, camera.width, camera.height, 0x010805, 0.82)
    .setInteractive();
  const panel = scene.add.container(0, 0);
  root.add([backdrop, panel]);
  let opened = false;
  let activating = false;
  let scale = 1;
  let drag = null;
  let pressed = null;
  let signature = "";
  let destroyed = false;
  const hiddenDOM = new Map();
  const installed = new Set();
  const visuals = [];
  const hideDOM = () => {
    // Há HUDs tanto no container DOM do Phaser quanto diretamente sobre o jogo.
    for (const element of [scene.game.domContainer, scene.hudStatus?.elemento]) {
      if (!element || hiddenDOM.has(element)) continue;
      hiddenDOM.set(element, element.style.display);
      element.style.display = "none";
    }
  };
  const add = object => { panel.add(object); display?.track(object); return object; };
  const rect = (x, y, w, h, color = 0x04110c, alpha = 1) =>
    add(scene.add.rectangle(x, y, w, h, color, alpha));
  const text = (x, y, label, size = 12, color = "#83e8b9") => add(scene.add.text(x, y, label, {
    fontFamily: "monospace", fontSize: `${size}px`, color,
  }));
  rect(0, 0, WIDTH, HEIGHT, 0x020b07, 0.98).setStrokeStyle(1, GREEN, 0.8);
  rect(0, 0, WIDTH - 12, HEIGHT - 12, 0x03100a, 0.4).setStrokeStyle(1, DIM, 0.6);
  // Textura de terminal discreta, sem competir com as peças interativas.
  for (let y = -143; y < 180; y += 4) rect(0, y, WIDTH - 16, 1, 0x39ad76, 0.018);
  for (let x = -340; x < 350; x += 95) {
    text(x, -140, "01\n  0\n10\n  1", 9, "#0a2919");
    text(x + 12, 125, "1\n 01\n  0", 9, "#0a2919");
  }
  text(-348, -183, "N", 28, "#52d497").setFontStyle("bold");
  text(-316, -181, "NULLBORNS", 14);
  text(-316, -162, "SISTEMA INDUSTRIAL v2.4", 10, "#87bb9e");
  rect(0, -149, WIDTH - 2, 1, DIM);
  const close = rect(343, -171, 32, 32, 0x092117).setStrokeStyle(1, DIM)
    .setName("generator-close").setInteractive({ useHandCursor: true });
  text(343, -171, "×", 24).setOrigin(0.5);
  text(-157, -138, "GERADOR", 26, "#c2ffe3").setFontStyle("bold");
  text(-156, -104, "CIRCUITO DE ATIVAÇÃO", 13, "#9edcba");
  const state = text(343, -128, "● SEM ENERGIA", 11, "#a3c5ae").setOrigin(1, 0.5);
  rect(94, -85, 497, 1, DIM, 0.6);
  rect(-267, 36, 164, 258).setStrokeStyle(1, DIM);
  rect(-267, -77, 162, 30, 0x09251a);
  text(-338, -85, "INVENTÁRIO", 14, "#c5ffe2").setFontStyle("bold");
  text(-338, 119, "PEGUE E ARRASTE", 11, "#a4d5b9");
  text(-338, 137, "até o encaixe →", 11, "#a4d5b9");
  rect(-172, 37, 1, 258, DIM, 0.5);

  const wires = add(scene.add.graphics());
  const drawWires = () => {
    wires.clear();
    for (const row of ROWS) {
      wires.lineStyle(1.5, installed.has(row.id) ? GREEN : DIM, 1);
      wires.beginPath().moveTo(-9, row.y).lineTo(13, row.y)
        .lineTo(28, row.y === -20 ? -5 : 46).lineTo(28, 25).lineTo(63, 25).strokePath();
    }
    wires.fillStyle(installed.size === 2 ? GREEN : DIM);
    wires.fillTriangle(63, 21, 70, 25, 63, 29);
    display?.drawing(wires, ctx => {
      for (const row of ROWS) {
        ctx.strokeStyle = installed.has(row.id) ? "#64f5ba" : "#347958";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-9, row.y); ctx.lineTo(13, row.y);
        ctx.lineTo(28, row.y === -20 ? -5 : 46); ctx.lineTo(28, 25); ctx.lineTo(63, 25);
        ctx.stroke();
      }
      ctx.fillStyle = installed.size === 2 ? "#64f5ba" : "#347958";
      ctx.beginPath(); ctx.moveTo(63, 21); ctx.lineTo(70, 25); ctx.lineTo(63, 29); ctx.fill();
    });
  };
  const generator = add(scene.add.image(207, 14, "industrialGenerator"))
    .setDisplaySize(278, 194).setAlpha(0.8).setName("generator-preview");
  text(205, 94, "UNIDADE DE ENERGIA / G-01", 11, "#9ac5ab").setOrigin(0.5);
  const power = rect(204, 131, 270, 46, 0x072217).setStrokeStyle(1, DIM)
    .setName("generator-power");
  const powerLabel = text(204, 131, "⏻  LIGAR", 22, "#92b6a0").setOrigin(0.5).setFontStyle("bold");
  const feedback = text(0, 177, "Arraste a bateria e a gasolina para conectar o circuito.", 12, "#b1dec3")
    .setOrigin(0.5);
  rect(0, 164, 700, 1, DIM, 0.45);

  for (const row of ROWS) {
    const source = rect(-267, row.sourceY, 144, 65, 0x061b12).setStrokeStyle(1, 0x286d4b)
      .setName(`generator-source:${row.id}`);
    text(-278, row.sourceY - 14, row.name, 14, "#c5ffe2").setFontStyle("bold");
    const quantity = text(-278, row.sourceY + 8, "", 11, "#9dcdb0");
    const slot = rect(-82, row.y, 144, 88, 0x06180f, 0.7).setName(`generator-slot:${row.id}`);
    const outline = add(scene.add.graphics());
    const drawSlot = (color, solid = false) => {
      display?.drawing(outline, ctx => {
        ctx.lineWidth = 1;
        ctx.strokeStyle = `#${color.toString(16).padStart(6, "0")}`;
        ctx.setLineDash(solid ? [] : [8, 8]);
        ctx.strokeRect(-154, row.y - 44, 144, 88);
      });
      outline.clear().lineStyle(1, color, 0.95);
      if (solid) outline.strokeRect(-154, row.y - 44, 144, 88);
      else {
        for (let x = -154; x < -10; x += 16) {
          outline.lineBetween(x, row.y - 44, Math.min(x + 8, -10), row.y - 44);
          outline.lineBetween(x, row.y + 44, Math.min(x + 8, -10), row.y + 44);
        }
        for (let y = row.y - 44; y < row.y + 44; y += 16) {
          outline.lineBetween(-154, y, -154, Math.min(y + 8, row.y + 44));
          outline.lineBetween(-10, y, -10, Math.min(y + 8, row.y + 44));
        }
      }
    };
    text(-145, row.y - 36, row.number, 11, "#91c9a8");
    const iconKey = prepareInventoryIcon(scene, getInventoryItem(row.id), 128);
    add(scene.add.image(-82, row.y - 5, iconKey)).setDisplaySize(34, 34).setAlpha(0.26);
    const status = text(-82, row.y + 28, row.name.toUpperCase(), 11, "#9dcdb0").setOrigin(0.5);
    const piece = add(scene.add.image(-312, row.sourceY, iconKey)).setDisplaySize(42, 42)
      .setName(`generator-piece:${row.id}`);
    visuals.push({ ...row, iconKey, source, quantity, slot, drawSlot, status, piece });
  }
  // A peça arrastada permanece acima de todo o circuito.
  const ghost = add(scene.add.image(0, 0, visuals[0].iconKey))
    .setDisplaySize(48, 48).setVisible(false).setName("generator-drag");

  const ready = () => installed.size === 2 && ROWS.every(row => inventory.getQuantity(row.id) >= 1);
  const refresh = (force = false) => {
    if (!activating) {
      for (const row of ROWS) if (inventory.getQuantity(row.id) < 1) installed.delete(row.id);
    }
    const next = `${activating}:${[...installed]}:${ROWS.map(row => inventory.getQuantity(row.id))}:${drag?.id}:${drag?.hover}`;
    if (!force && next === signature) return;
    signature = next;
    for (const visual of visuals) {
      const connected = installed.has(visual.id);
      const available = inventory.getQuantity(visual.id) >= 1;
      const dragging = drag?.id === visual.id;
      visual.quantity.setText(connected ? "CONECTADO" : available ? "DISPONÍVEL" : "NÃO COLETADO")
        .setColor(available ? "#9dcdb0" : "#e3b891");
      visual.source.setAlpha(connected ? 0.45 : available ? 1 : 0.35);
      visual.piece.setPosition(connected ? -82 : -312, connected ? visual.y - 5 : visual.sourceY)
        .setAlpha(connected || available ? 1 : 0.3).setVisible(!dragging);
      visual.drawSlot(connected || (dragging && drag.hover) ? GREEN : DIM, connected);
      visual.status.setText(connected ? "✓ CONECTADO" : visual.name.toUpperCase())
        .setColor(connected ? "#adffd4" : "#9dcdb0");
      visual.source.disableInteractive();
      visual.slot.disableInteractive();
      if (!activating && available) {
        (connected ? visual.slot : visual.source).setInteractive({ cursor: "grab" });
      }
    }
    drawWires();
    power.setStrokeStyle(1, ready() || activating ? GREEN : DIM)
      .setFillStyle(ready() || activating ? 0x10432b : 0x071b12)
      .setData("ready", ready() && !activating);
    if (ready() && !activating) power.setInteractive({ useHandCursor: true });
    else power.disableInteractive();
    powerLabel.setText(activating ? "⏻  INICIANDO..." : "⏻  LIGAR")
      .setColor(ready() || activating ? "#d4ffeb" : "#92b6a0");
    generator.setAlpha(ready() || activating ? 1 : 0.8);
    state.setText(activating ? "● GERADOR INICIANDO" : ready() ? "● CIRCUITO PRONTO" : "● SEM ENERGIA")
      .setColor(ready() || activating ? "#baffd6" : "#a3c5ae");
  };
  const layout = () => {
    if (opened) hideDOM();
    const zoomX = camera.zoomX || camera.zoom || 1;
    const zoomY = camera.zoomY || camera.zoom || 1;
    const originX = camera.width * camera.originX;
    const originY = camera.height * camera.originY;
    root.setPosition(originX + (camera.width / 2 - originX) / zoomX,
      originY + (camera.height / 2 - originY) / zoomY).setScale(1 / zoomX, 1 / zoomY);
    backdrop.setSize(camera.width, camera.height);
    scale = Math.min(1, (camera.width - 24) / WIDTH, (camera.height - 24) / HEIGHT);
    panel.setScale(scale);
    display?.render(camera, scale, opened);
  };
  const point = pointer => ({
    x: (pointer.x - camera.x - camera.width / 2) / scale,
    y: (pointer.y - camera.y - camera.height / 2) / scale,
  });
  const cancelDrag = () => { drag = null; pressed = null; ghost.setVisible(false); refresh(true); };
  const down = pointer => {
    if (!opened || activating || drag || pressed) return;
    const p = point(pointer);
    if (inside(p, 343, -171, 32, 32)) { pressed = { id: pointer.id, action: "close" }; return; }
    if (ready() && inside(p, 204, 131, 270, 46)) {
      pressed = { id: pointer.id, action: "activate" }; return;
    }
    const visual = visuals.find(v => inventory.getQuantity(v.id) >= 1 &&
      (installed.has(v.id) ? inside(p, -82, v.y, 144, 88) : inside(p, -267, v.sourceY, 144, 65)));
    if (!visual) return;
    drag = { id: visual.id, pointerId: pointer.id, hover: false };
    ghost.setTexture(visual.iconKey).setPosition(p.x, p.y).setVisible(true);
    feedback.setText(`Solte ${visual.name.toLowerCase()} no encaixe correspondente.`).setColor("#8ceac0");
    refresh(true);
  };
  const move = pointer => {
    if (!opened || !drag || drag.pointerId !== pointer.id) return;
    const p = point(pointer);
    const visual = visuals.find(v => v.id === drag.id);
    drag.hover = inside(p, -82, visual.y, 144, 88);
    ghost.setPosition(p.x, p.y);
    refresh();
  };
  const up = pointer => {
    if (!opened || activating) return;
    const p = point(pointer);
    if (drag?.pointerId === pointer.id) {
      const visual = visuals.find(v => v.id === drag.id);
      if (inside(p, -82, visual.y, 144, 88) && inventory.getQuantity(visual.id) >= 1) {
        installed.add(visual.id);
        feedback.setText(installed.size === 2 ? "Circuito completo. Pressione LIGAR para iniciar." : "Peça conectada. Arraste o próximo item.");
      } else if (inside(p, -267, 36, 164, 258)) {
        installed.delete(visual.id);
        feedback.setText("Peça devolvida ao inventário.");
      } else {
        feedback.setText("Encaixe inválido. Arraste para o espaço com o mesmo item.");
      }
      cancelDrag();
    } else if (pressed?.id === pointer.id) {
      const action = pressed.action;
      pressed = null;
      if (action === "close" && inside(p, 343, -171, 32, 32)) onClose();
      if (action === "activate" && inside(p, 204, 131, 270, 46) && ready()) onActivate();
    }
  };
  const outside = pointer => { if (drag?.pointerId === pointer?.id || pressed?.id === pointer?.id) cancelDrag(); };
  const blur = () => { if (opened) cancelDrag(); };
  scene.input.on("pointerdown", down);
  scene.input.on("pointermove", move);
  scene.input.on("pointerup", up);
  scene.input.on("pointerupoutside", outside);
  scene.input.on("gameout", blur);
  scene.game.events.on("blur", blur);
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, layout);
  layout();
  refresh(true);
  const restoreDOM = () => {
    for (const [element, display] of hiddenDOM) element.style.display = display;
    hiddenDOM.clear();
  };

  return {
    ready,
    refresh,
    open() {
      installed.clear(); activating = false; opened = true; cancelDrag(); layout();
      hideDOM();
      feedback.setText("Arraste a bateria e a gasolina para conectar o circuito.").setColor("#b1dec3");
      root.setVisible(true);
    },
    close() { opened = false; cancelDrag(); installed.clear(); root.setVisible(false); display?.hide(); restoreDOM(); },
    message(label) { feedback.setText(label).setColor("#d4a17c"); },
    start() {
      activating = true; drag = null; pressed = null; ghost.setVisible(false); refresh(true);
      feedback.setText("Motor iniciando. A energia está estabilizando...").setColor("#8dffbf");
      close.setAlpha(0.3).disableInteractive();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      display?.destroy();
      restoreDOM();
      scene.input.off("pointerdown", down);
      scene.input.off("pointermove", move);
      scene.input.off("pointerup", up);
      scene.input.off("pointerupoutside", outside);
      scene.input.off("gameout", blur);
      scene.game.events.off("blur", blur);
      scene.events.off(Phaser.Scenes.Events.PRE_RENDER, layout);
      root.destroy();
    },
  };
}
