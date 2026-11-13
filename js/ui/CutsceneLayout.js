/** Coordenadas da tela verde na arte industrial; contorno medido com margem de 3 px. */
export const CUTSCENE_LAYOUT = Object.freeze({
  width: 1671, height: 941,
  screen: Object.freeze({ x: 470, y: 241, width: 587, height: 414,
    // Segmentos subpixel acompanham o vidro convexo, inclusive a curvatura das bordas.
    clipPath: "polygon(39.353% 0.000%, 19.421% 0.725%, 9.199% 1.449%, 4.600% 2.174%, 3.026% 3.140%, 2.345% 4.106%, 1.733% 5.797%, 0.681% 18.116%, 0.000% 34.541%, 0.000% 65.217%, 0.681% 83.333%, 1.363% 92.754%, 2.074% 96.377%, 3.026% 97.585%, 4.429% 98.309%, 8.177% 98.792%, 33.901% 100.000%, 68.825% 100.000%, 86.882% 99.275%, 96.082% 98.309%, 97.314% 97.585%, 98.608% 95.169%, 99.489% 83.816%, 100.000% 69.565%, 100.000% 29.952%, 99.319% 13.285%, 98.807% 7.246%, 98.267% 4.589%, 96.803% 2.657%, 93.697% 1.691%, 75.639% 0.242%, 63.373% 0.000%)",
  }),
  source: "assets/efeitos/Televisor CRT Verde Neon em Ambiente Industrial.png",
  still: "assets/efeitos/Televisor CRT Verde Neon em Ambiente Industrial.png",
  holdFrame: 0,
  duration: 0,
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
