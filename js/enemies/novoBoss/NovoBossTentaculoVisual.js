/** Arte RGBA original recolorida e agarrão adicional sem alterar a captura. */
import { assetsNovoBoss } from "./NovoBossAssets.js";

const base = assetsNovoBoss.tentaculo;
const grab = assetsNovoBoss.tentaculoAgarrao;
const nomeFrame = (asset, indice) => `${asset.prefixo}${String(indice).padStart(3, "0")}`;

export function criarVisualTentaculo(scene, x, y, raio) {
  if (!scene.add?.sprite || !scene.textures?.exists?.(base.chave) ||
      !scene.textures.exists(grab.chave)) return null;
  const sprite = scene.add.sprite(x, y, base.chave, nomeFrame(base, 0))
    .setName("novo-boss-tentaculo-visual").setOrigin(base.origemX, base.origemY)
    .setScale(raio * 2 / base.diametroBase).setDepth(52).setVisible(false);
  sprite.novoBossTentaculoVisual = true;
  let destruido = false;
  return {
    sprite,
    atualizar({ idade = 0, visivel = false, segurando = false, idadeCaptura = 0, alturaAlvo = 46, x, y }) {
      if (destruido || !Number.isFinite(idade) || idade < 0) return;
      sprite.setVisible(visivel);
      if (!visivel) return;
      const asset = segurando ? grab : base;
      const altura = Number.isFinite(alturaAlvo) && alturaAlvo > 0 ? alturaAlvo : 46;
      sprite.setOrigin(asset.origemX, asset.origemY).setScale(segurando
        ? altura * grab.proporcaoAlvo / grab.alturaEnvolvimento : raio * 2 / base.diametroBase);
      let indice = Math.floor(idade / base.frameMs) % (base.ultimoFrame + 1);
      if (segurando) {
        const tempo = Math.max(0, Number.isFinite(idadeCaptura) ? idadeCaptura : 0);
        indice = tempo < 320 ? Math.floor(tempo / grab.frameMs) : 8 + Math.floor((tempo - 320) / 160) % 4;
      }
      const frame = nomeFrame(asset, indice);
      if (sprite.texture?.key !== asset.chave) sprite.setTexture(asset.chave, frame);
      else if (sprite.frame?.name !== frame) sprite.setFrame(frame);
      sprite.novoBossQuadroTentaculo = indice;
      sprite.novoBossTentaculoSegurando = segurando;
      sprite.setPosition(x, y);
    },
    destruir() { if (!destruido) { destruido = true; sprite.destroy(); } },
  };
}
