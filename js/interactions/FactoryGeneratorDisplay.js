/** Desenha o painel na densidade da tela; os objetos Phaser mantêm a interação. */
export function criarDisplayGerador(scene, width, height, dataset = "generatorDisplay", { manualInvalidation = false } = {}) {
  const gameCanvas = scene.game.canvas;
  if (!gameCanvas?.parentElement) return null;

  const canvas = document.createElement("canvas");
  canvas.dataset[dataset] = "";
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "absolute", display: "none", pointerEvents: "none", zIndex: "101",
    imageRendering: "auto",
  });
  gameCanvas.parentElement.appendChild(canvas);
  const context = canvas.getContext("2d");
  const objects = [];
  const drawings = new Map();
  let revision = 0;
  let lastSignature = "";
  let layoutKey = "", layout = null;
  const color = (value, alpha = 1) =>
    `rgba(${value >> 16 & 255},${value >> 8 & 255},${value & 255},${alpha})`;

  return {
    track(object) {
      objects.push(object);
      // A exibição fica neste canvas; hit areas, estados e medidas continuam no Phaser.
      object.renderWebGL = object.renderCanvas = () => {};
      return object;
    },
    drawing(object, draw) { drawings.set(object, draw); revision++; },
    invalidate() { revision++; },
    hide() { canvas.style.display = "none"; layoutKey = ""; },
    render(camera, scale, visible) {
      if (!visible) { canvas.style.display = "none"; return; }
      // Leitura do DOM só quando a área de exibição muda; arrastar peças não precisa de reflow.
      const density = Math.min(window.devicePixelRatio || 1,
        scene.sys?.game?.device?.os?.desktop === false || scene.sys?.game?.device?.input?.touch ? 1.5 : 2);
      const nextLayout = [camera.x, camera.y, camera.width, camera.height, scale, density,
        scene.scale.gameSize.width, scene.scale.gameSize.height, window.innerWidth, window.innerHeight].join(":");
      if (layoutKey !== nextLayout) {
        layoutKey = nextLayout;
        const bounds = gameCanvas.getBoundingClientRect();
        const parentBounds = canvas.parentElement.getBoundingClientRect();
        const cssX = bounds.width / scene.scale.gameSize.width;
        const cssY = bounds.height / scene.scale.gameSize.height;
        const cssWidth = width * scale * cssX, cssHeight = height * scale * cssY;
        layout = { pixelWidth: Math.max(1, Math.round(cssWidth * density)),
          pixelHeight: Math.max(1, Math.round(cssHeight * density)) };
        Object.assign(canvas.style, { width: `${cssWidth}px`, height: `${cssHeight}px`,
          left: `${bounds.left - parentBounds.left + (camera.x + camera.width / 2) * cssX - cssWidth / 2}px`,
          top: `${bounds.top - parentBounds.top + (camera.y + camera.height / 2) * cssY - cssHeight / 2}px` });
      }
      canvas.style.display = "block";
      const { pixelWidth, pixelHeight } = layout;
      const resized = canvas.width !== pixelWidth || canvas.height !== pixelHeight;
      if (resized) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
      const signature = manualInvalidation ? `${revision}` : `${revision}:` + objects.map(o => [o.visible, o.alpha, o.x, o.y,
        o.displayWidth, o.displayHeight, o.originX, o.originY, o.text, o.style?.color,
        o.style?.fontStyle, o.fillColor, o.strokeColor, o.texture?.key].join(",")).join(";");
      if (!resized && signature === lastSignature) return;
      lastSignature = signature;
      context.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
      context.clearRect(0, 0, width, height);
      context.translate(width / 2, height / 2);
      for (const object of objects) {
        if (!object.visible || object.alpha <= 0) continue;
        context.save();
        context.globalAlpha = object.alpha;
        if (drawings.has(object)) drawings.get(object)(context);
        else if (object.type === "Text") {
          const style = object.style;
          const fontSize = parseFloat(style.fontSize);
          context.font = `${style.fontStyle || "normal"} ${fontSize}px ${style.fontFamily}`;
          context.fillStyle = style.color;
          context.textBaseline = "top";
          const lines = object.text.split("\n");
          const lineHeight = fontSize * 1.2;
          const textWidth = Math.max(...lines.map(line => context.measureText(line).width));
          lines.forEach((line, index) => context.fillText(line,
            object.x - textWidth * object.originX,
            object.y - lines.length * lineHeight * object.originY + index * lineHeight));
        } else if (object.type === "Rectangle") {
          const x = object.x - object.width * object.originX;
          const y = object.y - object.height * object.originY;
          if (object.isFilled) {
            context.fillStyle = color(object.fillColor, object.fillAlpha);
            context.fillRect(x, y, object.width, object.height);
          }
          if (object.isStroked) {
            context.strokeStyle = color(object.strokeColor, object.strokeAlpha);
            context.lineWidth = object.lineWidth;
            context.strokeRect(x, y, object.width, object.height);
          }
        } else if (object.type === "Image") {
          const frame = object.frame;
          context.imageSmoothingEnabled = true;
          context.imageSmoothingQuality = "high";
          context.drawImage(frame.source.image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
            object.x - object.displayWidth * object.originX,
            object.y - object.displayHeight * object.originY, object.displayWidth, object.displayHeight);
        }
        context.restore();
      }
    },
    destroy() { canvas.remove(); objects.length = 0; drawings.clear(); },
  };
}
