/** Textos dos menus na resolução nativa da tela, sem ampliar o framebuffer do jogo. */
class MenuText extends Phaser.GameObjects.DOMElement {
  constructor(scene, x, y, text, style = {}) {
    const node = document.createElement("span");
    Object.assign(node.style, {
      color: style.color || "#9dffb9",
      fontFamily: style.fontFamily || "monospace",
      fontSize: style.fontSize || "14px",
      fontWeight: style.fontStyle === "bold" ? "700" : "400",
      lineHeight: "1.25",
      whiteSpace: "pre",
      userSelect: "none",
    });
    if (style.shadow?.fill) {
      node.style.textShadow = `0 0 ${Math.min(5, style.shadow.blur || 0)}px ${style.shadow.color}`;
    }
    node.className = "menu-text";
    node.textContent = text;
    super(scene, x, y, node);
    this.setOrigin(0);
    // Os fundos Phaser continuam recebendo mouse e multitoque.
    this.pointerEvents = "none";
  }

  setColor(color) {
    this.node.style.color = color;
    return this;
  }

  setText(text) {
    this.node.textContent = text;
    return this.updateSize();
  }

  updateSize() {
    // Textos de painéis ocultos também podem mudar (status e personagem).
    // Mede sem display:none para preservar a centralização quando reaparecerem.
    const display = this.node.style.display;
    if (display === "none") this.node.style.display = "inline";
    super.updateSize();
    this.node.style.display = display;
    return this;
  }

  setFontSize(size) {
    this.node.style.fontSize = typeof size === "number" ? `${size}px` : size;
    return this.updateSize();
  }

  preRender() {
    // Um botão pode estar dentro de um painel oculto. O DOM está fora do canvas,
    // por isso também precisa acompanhar todos os ancestrais do container.
    for (let parent = this.parentContainer; parent; parent = parent.parentContainer) {
      if (!parent.visible) {
        this.node.style.display = "none";
        return;
      }
    }
    super.preRender();
  }

  renderWebGL(renderer, src, camera, parentMatrix) {
    super.renderWebGL(renderer, src, camera, parentMatrix);
    // Phaser chama o renderizador como função; o objeto é recebido em src.
    let alpha = src.alpha * (camera.camera || camera).alpha;
    for (let parent = src.parentContainer; parent; parent = parent.parentContainer) {
      alpha *= parent.alpha;
    }
    src.node.style.opacity = alpha;
  }

  renderCanvas(renderer, src, camera, parentMatrix) {
    MenuText.prototype.renderWebGL(renderer, src, camera, parentMatrix);
  }
}

export function criarTextoMenu(scene, x, y, text, style) {
  return scene.add.existing(new MenuText(scene, x, y, text, style));
}
