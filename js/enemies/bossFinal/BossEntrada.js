/**
 * @file Adia a criação do boss até o jogador entrar na área que afasta a câmera.
 */
import { localizarPecasBoss } from "./BossConfig.js";

export const ARENA_X_MIN = -1606;
export const ARENA_X_MAX = -550;
export const ENTRADA_ARENA_Y = -5470;

export function jogadorNaEntradaArena(player) {
  return Boolean(
    player?.active &&
    player.x >= ARENA_X_MIN && player.x <= ARENA_X_MAX &&
    player.y <= ENTRADA_ARENA_Y,
  );
}

export function prepararEntradaBoss(scene, criarBoss) {
  // As peças do mapa servem de referência para a montagem do boss.
  // Permanecem ativas para serem localizadas, mas sem renderização ou colisão.
  const pecas = localizarPecasBoss(scene).map((peca) => {
    const estado = { peca, visible: peca.visible, bodyEnable: peca.body?.enable };
    peca.setVisible(false);
    if (peca.body) peca.body.enable = false;
    return estado;
  });

  const limpar = () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, verificarEntrada);
    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, limpar);
  };

  const verificarEntrada = () => {
    if (!jogadorNaEntradaArena(scene.player)) return;

    // Retira o gatilho antes da criação: sair e voltar não reinicia o boss.
    limpar();
    for (const { peca, visible, bodyEnable } of pecas) {
      if (!peca.active) continue;
      peca.setVisible(visible);
      if (peca.body) peca.body.enable = bodyEnable;
    }
    criarBoss(scene);
  };

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, verificarEntrada);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, limpar);
}
