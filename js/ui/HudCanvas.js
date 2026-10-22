/** Pequenos elementos da HUD na densidade da tela, sem ampliar o canvas do mundo. */
export function criarCanvasHUDNitido(scene, width, height, depth) {
  if (!scene.add.dom) return null;
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, {
    width: `${width}px`, height: `${height}px`, imageRendering: "auto",
    pointerEvents: "none",
  });
  canvas.setAttribute("aria-hidden", "true");
  const object = scene.add.dom(0, 0, canvas).setOrigin(0).setScrollFactor(0).setDepth(depth);
  object.pointerEvents = "none";
  const context = canvas.getContext("2d");
  return {
    canvas, context, object, width, height,
    atualizarResolucao() {
      const displayScale = scene.scale.displaySize.width / scene.scale.gameSize.width;
      const density = Math.min(3, Math.max(1, displayScale * (window.devicePixelRatio || 1)));
      const pixelWidth = Math.round(width * density), pixelHeight = Math.round(height * density);
      if (canvas.width === pixelWidth && canvas.height === pixelHeight) return false;
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
      return true;
    },
    limpar() { context.clearRect(0, 0, width, height); },
    destroy() { object.destroy(); canvas.width = 0; canvas.height = 0; },
  };
}

const cssColor = (color, alpha = 1) =>
  `rgba(${(color >> 16) & 255},${(color >> 8) & 255},${color & 255},${alpha})`;

/** Operações de desenho compartilhadas pelos marcadores Phaser e pelo canvas da HUD. */
export class GraficosCanvasHUD {
  constructor(context) { this.context = context; }
  clear() { return this; }
  fillStyle(color, alpha = 1) { this.context.fillStyle = cssColor(color, alpha); return this; }
  lineStyle(width, color, alpha = 1) {
    this.context.lineWidth = width;
    this.context.strokeStyle = cssColor(color, alpha);
    return this;
  }
  fillRect(...args) { this.context.fillRect(...args); return this; }
  fillCircle(x, y, radius) {
    this.context.beginPath(); this.context.arc(x, y, radius, 0, Math.PI * 2);
    this.context.fill(); return this;
  }
  strokeCircle(x, y, radius) {
    this.context.beginPath(); this.context.arc(x, y, radius, 0, Math.PI * 2);
    this.context.stroke(); return this;
  }
  path(points, close = true) {
    this.context.beginPath();
    points.forEach(({ x, y }, index) => {
      if (index === 0) this.context.moveTo(x, y);
      else this.context.lineTo(x, y);
    });
    if (close) this.context.closePath();
  }
  fillPoints(points) { this.path(points); this.context.fill(); return this; }
  strokePoints(points) { this.path(points); this.context.stroke(); return this; }
  fillTriangle(x1, y1, x2, y2, x3, y3) {
    return this.fillPoints([{ x: x1, y: y1 }, { x: x2, y: y2 }, { x: x3, y: y3 }]);
  }
  lineBetween(x1, y1, x2, y2) {
    this.path([{ x: x1, y: y1 }, { x: x2, y: y2 }], false);
    this.context.stroke(); return this;
  }
}

/** Preserva a área de toque e o estado do botão; melhora fundo, contorno e rótulo. */
export function criarBotaoHUDNitido(scene, background, label) {
  if (!background || !label) return;
  const padding = 2;
  const view = criarCanvasHUDNitido(scene, background.width + padding * 2,
    background.height + padding * 2, background.depth + 2);
  if (!view) return;
  label.setAlpha(0);
  let lastStyle;
  const update = () => {
    const resized = view.atualizarResolucao();
    view.object.setPosition(background.x - view.width * background.scaleX / 2,
      background.y - view.height * background.scaleY / 2)
      .setScale(background.scaleX, background.scaleY)
      .setVisible(background.visible).setAlpha(background.alpha);
    if (!background.visible) return;
    const style = [background.fillColor, background.strokeColor, label.text].join(":");
    if (!resized && style === lastStyle) return;
    lastStyle = style;
    view.limpar();
    const ctx = view.context;
    ctx.fillStyle = cssColor(background.fillColor, background.fillAlpha);
    ctx.fillRect(padding, padding, background.width, background.height);
    ctx.strokeStyle = cssColor(background.strokeColor, background.strokeAlpha);
    ctx.lineWidth = background.lineWidth;
    ctx.strokeRect(padding, padding, background.width, background.height);
    const fontSize = typeof label.style.fontSize === "number"
      ? `${label.style.fontSize}px` : label.style.fontSize;
    ctx.font = `bold ${fontSize} monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = label.style.color;
    ctx.fillText(label.text, view.width / 2, view.height / 2);
  };
  const cleanup = () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, update);
    view.destroy();
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, update);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
  update();
}
