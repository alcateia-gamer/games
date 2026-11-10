/** Terminal de acesso com a mesma apresentação do gerador e passagem automática do crachá. */
import { criarDisplayGerador } from "./FactoryGeneratorDisplay.js";
import { getInventoryItem } from "../inventory/InventoryItems.js";
import { prepareInventoryIcon } from "../inventory/InventoryUI.js";

const WIDTH = 740, HEIGHT = 390;
const GREEN = 0x64f5ba, DIM = 0x347958;
const TRILHO_CARTAO = Object.freeze({ inicio: -85, fim: 275, y: 45 });
const inside = (p, x, y, w, h) => Math.abs(p.x - x) <= w / 2 && Math.abs(p.y - y) <= h / 2;

export function criarPainelLeitorCartao(scene, { onRead, onClose, onSwipe }) {
  const camera = scene.cameras.main;
  const display = criarDisplayGerador(scene, WIDTH, HEIGHT, "cardReaderDisplay");
  const root = scene.add.container(0, 0).setDepth(1000).setScrollFactor(0)
    .setName("card-reader-modal").setVisible(false);
  const backdrop = scene.add.rectangle(0, 0, camera.width, camera.height, 0x010805, 0.82).setInteractive();
  const panel = scene.add.container(0, 0);
  root.add([backdrop, panel]);
  const add = object => { panel.add(object); display?.track(object); return object; };
  const rect = (x, y, w, h, color = 0x04110c, alpha = 1) =>
    add(scene.add.rectangle(x, y, w, h, color, alpha));
  const text = (x, y, label, size = 12, color = "#83e8b9") => add(scene.add.text(x, y, label, {
    fontFamily: "monospace", fontSize: `${size}px`, color,
  }));
  rect(0, 0, WIDTH, HEIGHT, 0x020b07, 0.98).setStrokeStyle(1, GREEN, 0.8);
  rect(0, 0, WIDTH - 12, HEIGHT - 12, 0x03100a, 0.4).setStrokeStyle(1, DIM, 0.6);
  for (let y = -143; y < 180; y += 4) rect(0, y, WIDTH - 16, 1, 0x39ad76, 0.018);
  text(-348, -183, "N", 28, "#52d497").setFontStyle("bold");
  text(-316, -181, "NULLBORNS", 14);
  text(-316, -162, "SISTEMA INDUSTRIAL v2.4", 10, "#87bb9e");
  rect(0, -149, WIDTH - 2, 1, DIM);
  rect(343, -171, 32, 32, 0x092117).setStrokeStyle(1, DIM)
    .setName("card-reader-close").setInteractive({ useHandCursor: true });
  text(343, -171, "×", 24).setOrigin(0.5);
  text(-156, -138, "ACESSO À ARENA", 24, "#c2ffe3").setFontStyle("bold");
  text(-155, -105, "AUTENTICAÇÃO POR CARTÃO", 12, "#9edcba");
  text(343, -119, "● TERMINAL ONLINE", 10, "#9edcba").setOrigin(1, 0.5);
  rect(0, 164, 700, 1, DIM, 0.45);
  rect(-267, 31, 164, 250).setStrokeStyle(1, DIM);
  rect(-267, -79, 162, 30, 0x09251a);
  text(-338, -87, "INVENTÁRIO", 14, "#c5ffe2").setFontStyle("bold");
  text(-267, -43, "CARTÃO DE ACESSO", 11).setOrigin(0.5);
  const source = rect(-267, 24, 144, 120, 0x061b12).setStrokeStyle(1, 0x286d4b)
    .setName("card-reader-source");
  const icon = prepareInventoryIcon(scene, getInventoryItem("card"), 128);
  const card = add(scene.add.image(-267, 24, icon)).setDisplaySize(108, 108)
    .setName("card-reader-card");
  const availability = text(-267, 108, "DISPONÍVEL", 11, "#a4d5b9").setOrigin(0.5);
  text(-267, 132, "LEITURA AUTOMÁTICA", 11, "#a4d5b9").setOrigin(0.5);
  rect(-172, 31, 1, 250, DIM, 0.5);

  rect(95, 32, 462, 234, 0x04150e).setStrokeStyle(1, DIM);
  for (const x of [-124, 314]) for (const y of [-73, 137]) {
    rect(x, y, 5, 5, DIM);
  }
  text(-113, -68, "LEITOR MAGNÉTICO / B-02", 12, "#a4d5b9");
  rect(95, -21, 400, 42, 0x020c08).setStrokeStyle(1, 0x24563e);
  const status = text(95, -21, "AGUARDANDO CARTÃO", 15, "#a4d5b9").setOrigin(0.5)
    .setName("card-reader-status");
  rect(95, 45, 400, 48, 0x010805).setStrokeStyle(1, DIM);
  rect(95, 45, 380, 8, 0x112a20);
  rect(-85, 45, 4, 38, GREEN);
  rect(275, 45, 4, 38, GREEN);
  for (let x = -65; x < 270; x += 28) rect(x, 80, 1, 8, DIM, 0.75);
  const progress = rect(-85, 45, 1, 4, GREEN).setOrigin(0, 0.5).setVisible(false)
    .setName("card-reader-progress");
  text(-85, 101, "01  INÍCIO", 11).setOrigin(0.5);
  text(95, 101, "LEITURA  →", 12, "#c2ffe3").setOrigin(0.5);
  text(275, 101, "02  FIM", 11).setOrigin(0.5);
  const feedback = text(0, 178, "O cartão passa automaticamente. Aguarde a confirmação de acesso.", 11, "#b1dec3")
    .setOrigin(0.5).setName("card-reader-feedback");
  const ghost = add(scene.add.image(0, 0, icon)).setDisplaySize(108, 108).setVisible(false)
    .setName("card-reader-animation");

  let opened = false, accepted = false, destroyed = false, scale = 1;
  let animation = null, pressed = null;
  const hiddenDOM = new Map();
  const hideDOM = () => {
    for (const element of [scene.game.domContainer, scene.hudStatus?.elemento]) {
      if (!element || hiddenDOM.has(element)) continue;
      hiddenDOM.set(element, element.style.display);
      element.style.display = "none";
    }
  };
  const restoreDOM = () => {
    for (const [element, previous] of hiddenDOM) element.style.display = previous;
    hiddenDOM.clear();
  };
  const refresh = () => {
    const available = scene.inventory?.getQuantity("card") > 0;
    source.setAlpha(available && !accepted ? 1 : 0.35);
    card.setVisible(!opened).setAlpha(available ? 1 : 0.25);
    availability.setText(accepted ? "CARTÃO LIDO" : opened ? "EM LEITURA" : available ? "DISPONÍVEL" : "NÃO COLETADO");
  };
  const stopAnimation = () => {
    animation?.stop(); animation = null;
    pressed = null; ghost.setVisible(false); progress.setVisible(false);
  };
  const message = (label, error = false) => feedback.setText(label).setColor(error ? "#e3b891" : "#b1dec3");
  const layout = () => {
    if (opened) hideDOM();
    const zx = camera.zoomX || camera.zoom || 1, zy = camera.zoomY || camera.zoom || 1;
    const ox = camera.width * camera.originX, oy = camera.height * camera.originY;
    root.setPosition(ox + (camera.width / 2 - ox) / zx, oy + (camera.height / 2 - oy) / zy)
      .setScale(1 / zx, 1 / zy);
    backdrop.setSize(camera.width, camera.height);
    scale = Math.min(1, (camera.width - 24) / WIDTH, (camera.height - 24) / HEIGHT);
    panel.setScale(scale);
    display?.render(camera, scale, opened);
  };
  const point = pointer => ({ x: (pointer.x - camera.x - camera.width / 2) / scale,
    y: (pointer.y - camera.y - camera.height / 2) / scale });
  const startAnimation = () => {
    const rail = TRILHO_CARTAO;
    ghost.setPosition(-267, 24).setVisible(true);
    status.setText("POSICIONANDO CARTÃO...").setColor("#a4d5b9");
    animation = scene.tweens.add({
      targets: ghost, x: rail.inicio, y: rail.y, duration: 300, ease: "Sine.easeInOut",
      onComplete() {
        if (!opened || destroyed) return;
        status.setText("LENDO CARTÃO...").setColor("#baffd6");
        const duracaoPassagem = onSwipe?.() ?? 700;
        animation = scene.tweens.add({
          targets: ghost, x: rail.fim, y: rail.y, duration: duracaoPassagem, ease: "Linear",
          onUpdate() {
            const fraction = Math.max(0, Math.min(1, (ghost.x - rail.inicio) / (rail.fim - rail.inicio)));
            progress.setSize(Math.max(1, fraction * (rail.fim - rail.inicio)), 4).setVisible(fraction > 0);
          },
          onComplete() {
            animation = null;
            if (!opened || destroyed) return;
            if (!onRead()) {
              status.setText("LEITURA INTERROMPIDA").setColor("#e3b891");
              message("Verifique o cartão e a energia da fábrica.", true);
              return;
            }
            accepted = true;
            status.setText("✓ ACESSO AUTORIZADO").setColor("#c2ffe3");
            message("Cartão aceito. Liberando as portas da arena...");
            progress.setSize(rail.fim - rail.inicio, 4).setVisible(true);
            refresh();
          },
        });
      },
    });
  };
  const down = pointer => {
    if (opened && pressed === null && inside(point(pointer), 343, -171, 32, 32)) pressed = pointer.id;
  };
  const up = pointer => {
    if (!opened || pressed !== pointer.id) return;
    pressed = null;
    if (inside(point(pointer), 343, -171, 32, 32)) onClose();
  };
  const outside = pointer => { if (pressed === pointer?.id) pressed = null; };
  const bindings = [["pointerdown", down], ["pointerup", up], ["pointerupoutside", outside]];
  for (const [event, handler] of bindings) scene.input.on(event, handler);
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, layout);
  layout();

  return {
    open() {
      opened = true; accepted = false; stopAnimation(); refresh();
      message("O cartão passa automaticamente. Aguarde a confirmação de acesso.");
      hideDOM(); layout(); root.setVisible(true); startAnimation();
    },
    close() {
      opened = false; accepted = false; stopAnimation(); root.setVisible(false);
      display?.hide(); restoreDOM();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; opened = false; stopAnimation();
      for (const [event, handler] of bindings) scene.input.off(event, handler);
      scene.events.off(Phaser.Scenes.Events.PRE_RENDER, layout);
      display?.destroy(); restoreDOM(); root.destroy();
    },
  };
}
