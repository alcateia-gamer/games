/** Quadros extraídos dos GIFs; relógios visuais independentes do dano. */
import { assetsNovoBoss } from "./NovoBossAssets.js";

function criarSprite(scene, asset, x, y, raio, nome) {
  if (!scene.textures?.exists?.(asset.chave) || !scene.add?.sprite) return null;
  return scene.add.sprite(x, y, asset.chave, 0)
    .setName(nome).setOrigin(asset.origemX, asset.origemY)
    .setScale(raio * 2 / asset.diametro).setDepth(52);
}

/** A proteção acompanha a boss e repete os cinco quadros a cada 500 ms. */
export function criarEscudoEnergia(scene, raio) {
  const asset = assetsNovoBoss.escudoEnergia;
  const sprite = criarSprite(scene, asset, 0, 0, raio, "novo-boss-escudo-energia");
  if (!sprite) return null;
  let tempo = 0;
  let destruido = false;
  return {
    sprite,
    atualizar(delta, x, y, visivel, alpha = 1) {
      if (destruido) return;
      if (visivel && Number.isFinite(delta) && delta >= 0) tempo += delta;
      sprite.setPosition(x, y).setVisible(visivel).setAlpha(Math.max(0, Math.min(1, alpha)) * 0.7);
      sprite.setFrame(Math.floor(tempo / asset.frameMs) % (asset.ultimoFrame + 1));
    },
    destruir() { if (!destruido) { destruido = true; sprite.destroy(); } },
  };
}

/** A cauda da explosão termina em 640 ms, sem prolongar a área de dano. */
export function criarExplosaoEnergia(scene, origem, raio, idadeInicial = 0) {
  const asset = assetsNovoBoss.explosao;
  const duracao = (asset.ultimoFrame + 1) * asset.frameMs;
  if (!Number.isFinite(idadeInicial) || idadeInicial < 0 || idadeInicial >= duracao) return null;
  const sprite = criarSprite(scene, asset, origem.x, origem.y, raio, "novo-boss-explosao");
  if (!sprite) return null;
  let destruida = false;
  sprite.setFrame(Math.floor(idadeInicial / asset.frameMs));
  const efeito = {
    sprite,
    atualizarIdade(tempo) {
      if (destruida) return true;
      if (!Number.isFinite(tempo) || tempo < 0) return false;
      if (tempo >= duracao) { efeito.destruir(); return true; }
      sprite.setFrame(Math.floor(tempo / asset.frameMs));
      return false;
    },
    destruir() { if (!destruida) { destruida = true; sprite.destroy(); } },
  };
  return efeito;
}
