import { MULTIPLICADOR_ALCANCE_FABRICA } from "./FactoryLighting.js";
import { ocultarBrilhoAtrasSprite } from "./SpriteLightOcclusion.js";

export const CAMPOS_POSE_AURA = ["frame", "scaleX", "scaleY", "rotation", "flipX", "flipY",
  "displayOriginX", "displayOriginY", "alpha"];

/** Dois carimbos locais por emissor visível; só a mudança de pose refaz o recorte. */
export default class BossAuraLightCache {
  constructor(mascara) {
    this.mascara = mascara;
    this.carimbos = new Map();
    this.visiveis = new Set();
  }

  sincronizar(fontes) {
    this.visiveis.clear();
    for (const fonte of fontes) if (fonte.vermelha) this.visiveis.add(fonte.emissor);
    for (const [sprite, carimbo] of this.carimbos) {
      if (this.visiveis.has(sprite)) continue;
      carimbo.mascara.width = carimbo.mascara.height = carimbo.cor.width = carimbo.cor.height = 0;
      this.carimbos.delete(sprite);
    }
  }

  obter(fonte) {
    const sprite = fonte.emissor;
    let carimbo = this.carimbos.get(sprite);
    if (!carimbo) {
      const mascara = document.createElement("canvas"), cor = document.createElement("canvas");
      mascara.width = mascara.height = cor.width = cor.height = this.mascara.width;
      carimbo = { mascara, cor, pose: {}, raio: null, dx: null, dy: null };
      this.carimbos.set(sprite, carimbo);
    }
    // A posição absoluta não participa do cache: mover o boss só move o carimbo.
    const dx = sprite.x - fonte.luz.x, dy = sprite.y - fonte.luz.y;
    let mudou = carimbo.raio !== fonte.luz.raio || carimbo.dx !== dx || carimbo.dy !== dy;
    for (const campo of CAMPOS_POSE_AURA) {
      if (carimbo.pose[campo] !== sprite[campo]) mudou = true;
      carimbo.pose[campo] = sprite[campo];
    }
    if (!mudou) return carimbo;
    carimbo.raio = fonte.luz.raio; carimbo.dx = dx; carimbo.dy = dy;
    const tamanho = carimbo.mascara.width;
    const escala = tamanho / (2 * fonte.luz.raio * MULTIPLICADOR_ALCANCE_FABRICA);
    const c = carimbo.mascara.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, tamanho, tamanho);
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    c.drawImage(this.mascara, 0, 0);
    c.setTransform(escala, 0, 0, escala, tamanho / 2, tamanho / 2);
    ocultarBrilhoAtrasSprite(c, sprite, dx, dy);
    // A mesma silhueta recorta a cor e a abertura da sombra: a aura não ilumina o emissor.
    const cor = carimbo.cor.getContext("2d");
    cor.setTransform(1, 0, 0, 1, 0, 0);
    cor.clearRect(0, 0, tamanho, tamanho);
    cor.globalAlpha = 1;
    cor.globalCompositeOperation = "source-over";
    cor.drawImage(carimbo.mascara, 0, 0);
    cor.globalCompositeOperation = "source-in";
    cor.fillStyle = "#FF1028";
    cor.fillRect(0, 0, tamanho, tamanho);
    return carimbo;
  }

  destroy() {
    for (const carimbo of this.carimbos.values()) {
      carimbo.mascara.width = carimbo.mascara.height = carimbo.cor.width = carimbo.cor.height = 0;
    }
    this.carimbos.clear();
    this.visiveis.clear();
    this.mascara.width = this.mascara.height = 0;
  }
}
