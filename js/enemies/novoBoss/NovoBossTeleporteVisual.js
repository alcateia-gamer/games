/** Arte pré-processada; usa o progresso da viagem, sem timers ou física própria. */
import { assetsNovoBoss } from "./NovoBossAssets.js";

export function quadroTeleporteNovoBoss(asset, progresso) {
  const duracao = asset.duracoesMs.reduce((a, b) => a + b, 0);
  const tempo = Math.max(0, Math.min(1, progresso)) * duracao;
  let acumulado = 0;
  for (let i = 0; i < asset.duracoesMs.length; i++) {
    acumulado += asset.duracoesMs[i];
    if (tempo < acumulado) return i;
  }
  return asset.ultimoFrame;
}

export function criarTeleporteVisualNovoBoss(scene, encontro) {
  let efeito = null;
  let ocultouCorpo = false;
  function liberarCorpo() {
    // Em espera, restaura a silhueta sem habilitar a física nem escolher destino.
    if (ocultouCorpo && encontro.sprite?.active && !encontro.morto) {
      const viagem = encontro.teleporte;
      if (!viagem) encontro.sprite.setAlpha(1);
      else if (viagem.etapa === "aguardando-destino") encontro.sprite.setAlpha(0.35);
    }
    ocultouCorpo = false;
  }
  return {
    atualizar(visivel) {
      const viagem = encontro.teleporte;
      const saida = viagem?.etapa === "desaparecendo";
      const entrada = viagem?.etapa === "reaparecendo";
      const asset = saida ? assetsNovoBoss.teleporteSaida : assetsNovoBoss.teleporteEntrada;
      if (!visivel || (!saida && !entrada) || !scene.textures?.exists?.(asset.chave) || !scene.add?.sprite) {
        efeito?.setVisible(false);
        liberarCorpo();
        return false;
      }
      if (!efeito) {
        efeito = scene.add.sprite(0, 0, asset.chave, 0)
          .setName("novo-boss-teleporte-visual").setDepth(50.6);
        efeito.novoBossTeleporteVisual = true;
      }
      const duracao = saida ? encontro.config.teleporte.desaparecerMs : encontro.config.teleporte.reaparecerMs;
      const frame = quadroTeleporteNovoBoss(asset, viagem.decorrido / Math.max(1, duracao));
      const ponto = saida ? viagem.origem : viagem.destino;
      const visual = encontro.config.visual;
      const flip = Boolean(encontro.sprite.flipX);
      // Mesmo pivô da célula idle; o padding pertence apenas à energia.
      efeito.setTexture(asset.chave, frame)
        .setOrigin(flip ? 1 - asset.origemX : asset.origemX, asset.origemY)
        .setPosition(ponto.x, ponto.y).setScale(visual.escala)
        .setFlipX(flip).setVisible(true);
      encontro.sprite.setAlpha(0);
      ocultouCorpo = true;
      return true;
    },
    destruir() {
      liberarCorpo();
      efeito?.destroy();
      efeito = null;
    },
  };
}
