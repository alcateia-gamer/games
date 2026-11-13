import { CUTSCENE_LAYOUT } from "./CutsceneLayout.js";

/** Encaixa vídeo e diálogo no contorno do vidro CRT da arte industrial. */
export class CutsceneTelevision {
  constructor(image, screen, backdrop) {
    this.image = image;
    this.screen = screen;
    this.backdrop = backdrop;
    this.duration = CUTSCENE_LAYOUT.duration;
    this.looping = false;
    this.destroyed = false;
    this.setScreen(CUTSCENE_LAYOUT.screen);
    this.ready = this.load();
  }

  async load() {
    try {
      await this.loadImage(CUTSCENE_LAYOUT.source);
      if (this.destroyed || this.frozen) return;
      this.frozen = true;
    } catch {
      if (this.destroyed) return;
      try { await this.loadImage(CUTSCENE_LAYOUT.still); this.frozen = true; }
      catch { /* O vídeo e o diálogo continuam disponíveis mesmo sem a arte. */ }
    }
  }

  loadImage(source) {
    return new Promise((resolve, reject) => {
      this.image.onload = resolve;
      this.image.onerror = reject;
      this.backdrop.src = source;
      this.image.src = source;
    });
  }

  setScreen(rect) {
    this.screen.style.clipPath = rect.clipPath || "none";
    for (const [property, value] of Object.entries({ left: rect.x / CUTSCENE_LAYOUT.width,
      top: rect.y / CUTSCENE_LAYOUT.height, width: rect.width / CUTSCENE_LAYOUT.width,
      height: rect.height / CUTSCENE_LAYOUT.height })) this.screen.style[property] = `${value * 100}%`;
  }

  freeze() {
    if (this.destroyed) return;
    this.frozen = true;
    this.looping = false;
    this.image.src = this.backdrop.src = CUTSCENE_LAYOUT.still;
    this.frame = CUTSCENE_LAYOUT.holdFrame;
  }

  destroy() {
    this.destroyed = true;
    this.image.onload = this.image.onerror = null;
  }
}
