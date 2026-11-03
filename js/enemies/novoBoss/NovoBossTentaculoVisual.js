/** Arte RGBA ancorada ao chão; sombra, abertura e borda integram a base ao piso. */
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
  const solo = scene.add.graphics?.().setName("novo-boss-tentaculo-solo").setDepth(51.8).setVisible(false);
  const borda = scene.add.graphics?.().setName("novo-boss-tentaculo-borda").setDepth(52.1).setVisible(false);
  for (const efeito of [solo, borda]) if (efeito) efeito.novoBossTentaculoBase = true;
  let destruido = false;
  let baseX, baseY;
  return {
    sprite,
    atualizar({ idade = 0, visivel = false, segurando = false, idadeCaptura = 0, alturaAlvo = 46, x, y }) {
      if (destruido || !Number.isFinite(idade) || idade < 0) return;
      sprite.setVisible(visivel);
      solo?.setVisible(visivel); borda?.setVisible(visivel);
      if (visivel && (baseX !== x || baseY !== y)) {
        baseX = x; baseY = y;
        solo?.clear(); borda?.clear();
        // A abertura é achatada na perspectiva do piso, sem reaproveitar o aviso circular.
        solo?.fillStyle(0x17141b, 0.75);
        solo?.fillEllipse?.(x, y + 2, raio * 2.5, raio * 0.8);
        solo?.fillStyle(0x08090e, 0.95);
        solo?.fillEllipse?.(x, y, raio * 2.1, raio * 0.5);
        borda?.fillStyle(0x211b20, 1);
        borda?.fillEllipse?.(x, y + 2, raio * 1.9, raio * 0.3);
        borda?.fillStyle(0x383338, 1);
        borda?.fillRect?.(x - raio, y + 1, 4, 2);
        borda?.fillRect?.(x + raio - 5, y, 5, 2);
        borda?.fillRect?.(x + raio * 0.4, y + 3, 3, 1);
      }
      if (!visivel) return;
      const asset = segurando ? grab : base;
      const altura = Number.isFinite(alturaAlvo) && alturaAlvo > 0 ? alturaAlvo : 46;
      // O agarrão original usa o centro do corpo; no mundo, ambos usam a base medida (499px).
      const origemY = segurando ? grab.origemY + grab.alturaEnvolvimento / 2 / grab.alturaFrame : base.origemY;
      sprite.setOrigin(asset.origemX, origemY).setScale(segurando
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
    destruir() { if (!destruido) { destruido = true; sprite.destroy(); solo?.destroy(); borda?.destroy(); } },
  };
}
