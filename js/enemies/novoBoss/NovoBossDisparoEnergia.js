/** Reproduz os 61 quadros originais pelo tempo de vida de cada projétil. */
import { assetsNovoBoss } from "./NovoBossAssets.js";

const inicio = assetsNovoBoss.disparoEnergia;
const final = assetsNovoBoss.disparoEnergiaFinal;

export function criarVisualDisparoEnergia(scene, x, y, raio, dx, dy) {
  if (!scene.add?.sprite || !scene.textures?.exists?.(inicio.chave) ||
      !scene.textures.exists(final.chave)) return null;
  const sprite = scene.add.sprite(x, y, inicio.chave, 0)
    .setOrigin(inicio.origemX, inicio.origemY).setScale(raio / inicio.raioNativo).setDepth(53);
  sprite.novoBossDisparoEnergia = true;
  // A defesa compartilhada do Kai recebe o mesmo projétil e usa a API de
  // estilo do círculo antigo. Adapta só este sprite, sem alterar o sistema.
  sprite.setFillStyle = (cor, alfa = 1) => { sprite.setTint(cor).setAlpha(alfa); return sprite; };
  // Os anéis já fornecem o contorno; não desenha uma borda sobre o GIF.
  sprite.setStrokeStyle = () => sprite;
  atualizarVisualDisparoEnergia(sprite, 0, dx, dy);
  return sprite;
}

/** O alfa está no PNG; não usa blend aditivo nem recolore a arte original. */
export function atualizarVisualDisparoEnergia(sprite, idade, dx, dy) {
  if (!sprite?.novoBossDisparoEnergia || sprite.active === false ||
      !Number.isFinite(idade) || idade < 0) return;
  const quadro = Math.floor(idade / inicio.frameMs) % inicio.totalQuadros;
  const paginaFinal = quadro > inicio.ultimoFrame;
  const chave = paginaFinal ? final.chave : inicio.chave;
  const frame = paginaFinal ? quadro - inicio.ultimoFrame - 1 : quadro;
  if (sprite.texture?.key !== chave) sprite.setTexture(chave, frame);
  else if (sprite.frame?.name !== frame) sprite.setFrame(frame);
  sprite.novoBossQuadroEnergia = quadro;
  sprite.setRotation?.(Math.atan2(dy, dx) + Math.PI);
}

/** O corpo continua com o raio de dano; as margens transparentes não viram colisão. */
export function configurarCorpoDisparoEnergia(sprite) {
  if (!sprite?.novoBossDisparoEnergia || !sprite.body) return;
  sprite.body.setCircle(inicio.raioNativo,
    inicio.origemX * inicio.larguraFrame - inicio.raioNativo,
    inicio.origemY * inicio.alturaFrame - inicio.raioNativo);
  sprite.body.updateFromGameObject();
}
