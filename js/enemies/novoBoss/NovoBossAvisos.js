import { assetsNovoBoss } from "./NovoBossAssets.js";

/** Marcações no piso acima da sombra ambiente, abaixo das interfaces. */
export function criarAvisoNovoBoss(scene, x, y, raio) {
  const grafico = scene.add.graphics().setDepth(51);
  grafico.setName?.("novo-boss-aviso");
  const asset = assetsNovoBoss.areaAtaque;
  const sprite = scene.textures?.exists?.(asset.chave) && scene.add.sprite
    ? scene.add.sprite(x, y, asset.chave, 0).setName("novo-boss-area-aviso")
      .setOrigin(asset.origemX, asset.origemY)
      .setScale(raio * 2 / asset.larguraEfeito, raio * 2 / asset.alturaEfeito)
      .setDepth(51) : null;
  sprite?.setTint?.(0xff6078);
  const duracao = asset.duracoesMs.reduce((a, b) => a + b, 0);
  let encerrado = false;
  const aviso = {
    grafico, sprite, x, y, raio,
    posicionar(novoX, novoY) {
      x = novoX; y = novoY;
      this.x = x; this.y = y;
      sprite?.setPosition(x, y);
    },
    atualizar(progresso = 0) {
      if (encerrado) return;
      const p = Math.max(0, Math.min(1, progresso));
      if (sprite) {
        let tempo = p * duracao, frame = 0;
        while (frame < asset.ultimoFrame && tempo >= asset.duracoesMs[frame]) {
          tempo -= asset.duracoesMs[frame++];
        }
        sprite.setFrame(frame).setAlpha(0.4 + p * 0.2);
      }
      const pulso = p > 0.75 ? 0.15 * Math.sin(p * 65) : 0;
      grafico.clear();
      if (sprite) return; // A área já está representada pelo GIF, sem círculos sobrepostos.
      grafico.fillStyle(0xe2263c, 0.13 + p * 0.17 + pulso)
        .fillCircle(x, y, raio).lineStyle(2, 0xff4058, 0.95)
        .strokeCircle(x, y, raio).lineStyle(2, 0xffb2b9, 0.9)
        .strokeCircle(x, y, Math.max(1, raio * p));
    },
    destruir() {
      if (encerrado) return;
      encerrado = true;
      grafico.destroy();
      sprite?.destroy();
    },
  };
  aviso.atualizar(0);
  return aviso;
}
