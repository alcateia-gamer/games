/** Preserva toda a composição do GIF, incluindo a TV e o feixe de luz. */
export const CUTSCENE_LAYOUT = Object.freeze({
  width: 800, height: 600,
  screen: Object.freeze({ x: 226, y: 190, width: 286, height: 199 }),
  source: "assets/efeitos/televisao.gif",
  still: "assets/efeitos/derivados/televisao-estatica.png",
  holdFrame: 71,
  duration: 2880,
});

export function fitCutscene(width, height, layout = CUTSCENE_LAYOUT) {
  const scale = Math.max(0, Math.min(width / layout.width, height / layout.height));
  return { width: layout.width * scale, height: layout.height * scale,
    x: (width - layout.width * scale) / 2,
    y: (height - layout.height * scale) / 2, scale };
}

/** As duas condições são independentes: terminar o vídeo nunca ignora o loader. */
export class CutsceneGate {
  constructor() { this.assetsReady = false; this.videoFinished = false; this.completed = false; }
  ready() { return this.assetsReady && this.videoFinished && !this.completed; }
  complete() {
    if (!this.ready()) return false;
    this.completed = true;
    return true;
  }
}
