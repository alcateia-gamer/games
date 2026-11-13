/** Obstáculo da pose de morte; não participa de dano, IA ou recompensas. */
import { assetsNovoBoss } from "./NovoBossAssets.js";
import { invalidarCacheNavegacao } from "../EnemyPathfinding.js";

export function criarColisaoCorpoDerrotado(scene, encontro) {
  if (encontro.colisaoCadaver || !scene.collisionGroup?.create || !encontro.sprite) return;
  const sprite = encontro.sprite, asset = assetsNovoBoss.morte;
  const morte = sprite.texture?.key === asset.chave;
  // Colisão baixa na base da túnica, como os pés dos personagens top-down.
  // Exclui capuz, sombra projetada e fitas laterais da silhueta de morte.
  const pixels = morte ? { x: 91, y: 177, width: 64, height: 28 } : null;
  const largura = pixels ? pixels.width * Math.abs(sprite.scaleX) : encontro.hitboxDano.width;
  const altura = pixels ? pixels.height * Math.abs(sprite.scaleY) : encontro.hitboxDano.height;
  const x = pixels ? sprite.x + ((sprite.flipX ? asset.larguraFrame - pixels.x - pixels.width : pixels.x) -
    asset.larguraFrame * sprite.originX) * Math.abs(sprite.scaleX) : encontro.hitboxDano.x;
  const y = pixels ? sprite.y + (pixels.y - asset.alturaFrame * sprite.originY) * Math.abs(sprite.scaleY)
    : encontro.hitboxDano.y;
  const corpo = scene.collisionGroup.create(x + largura / 2, y + altura / 2);
  // StaticBody atualiza suas dimensões pelo displaySize, não pelo setSize do corpo.
  corpo.setName("novo-boss-cadaver-colisao").setVisible(false).setDisplaySize(largura, altura);
  corpo.body.updateFromGameObject();
  encontro.colisaoCadaver = corpo;
  invalidarCacheNavegacao(scene);
}

export function destruirColisaoCorpoDerrotado(scene, encontro) {
  if (!encontro.colisaoCadaver) return;
  encontro.colisaoCadaver.destroy();
  encontro.colisaoCadaver = null;
  invalidarCacheNavegacao(scene);
}
