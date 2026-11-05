/** Os halos são suaves; em rajadas grandes, compõe só esses efeitos com metade da resolução. */
export default class BossEnergyLightBuffer {
  constructor(pintar) {
    this.pintar = pintar;
    this.mascara = document.createElement("canvas");
    this.cor = document.createElement("canvas");
    this.contextMascara = this.mascara.getContext("2d");
    this.contextCor = this.cor.getContext("2d");
  }

  preparar(fontes, camera, width, height) {
    const w = Math.ceil(width / 2), h = Math.ceil(height / 2);
    if (this.mascara.width !== w || this.mascara.height !== h) {
      this.mascara.width = this.cor.width = w;
      this.mascara.height = this.cor.height = h;
    }
    const m = camera.matrix, sx = w / width, sy = h / height;
    for (const [c, colorido] of [[this.contextMascara, false], [this.contextCor, true]]) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, w, h);
      c.globalCompositeOperation = "source-over";
      c.setTransform(m.a * sx, m.b * sy, m.c * sx, m.d * sy, m.e * sx, m.f * sy);
      for (const fonte of fontes) {
        c.globalAlpha = fonte.intensidade * (colorido ? fonte.branca ? 0.08 : 0.45 : 1);
        this.pintar(c, fonte, colorido);
      }
    }
  }

  desenhar(context, colorido, width, height) {
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    // Evita borrar novamente as bordas ao ampliar os halos suaves.
    context.imageSmoothingEnabled = false;
    context.drawImage(colorido ? this.cor : this.mascara, 0, 0, width, height);
    context.restore();
  }

  destroy() {
    this.mascara.width = this.mascara.height = this.cor.width = this.cor.height = 0;
    this.pintar = null;
  }
}
