/** Ciclo de vida do terminal: trava os controles e só autoriza a porta após a leitura. */
import { criarPainelLeitorCartao } from "./FactoryCardReaderPanel.js";

export function criarInteracaoLeitorCartao(scene, { podeUsar, abrirPortas }) {
  let opened = false, destroyed = false, previousMovement = false;
  let confirmation = null;
  const close = () => {
    if (!opened) return;
    opened = false;
    confirmation?.remove(false); confirmation = null;
    scene.cardReaderMenuOpen = false;
    // Os consoles industriais compartilham o bloqueio já usado por ataques, HUD e coleta.
    scene.generatorMenuOpen = false;
    if (!scene.morteEmAndamento) scene.movimentoBloqueado = previousMovement;
    scene.player?.setVelocity(0, 0);
    panel.close();
  };
  const panel = criarPainelLeitorCartao(scene, {
    onClose: close,
    onRead() {
      if (!opened || confirmation || !podeUsar(true)) return false;
      confirmation = scene.time.delayedCall(650, () => {
        confirmation = null;
        const valid = opened && podeUsar(true);
        close();
        if (valid && !destroyed) abrirPortas();
      });
      return true;
    },
  });
  const escape = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  const onEscape = () => close();
  escape.on("down", onEscape);
  const update = () => {
    if (opened && !podeUsar(true)) close();
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, update);
  return {
    get aberto() { return opened; },
    open() {
      if (destroyed || opened || scene.generatorMenuOpen || scene.devItemMenuOpen || !podeUsar()) return false;
      previousMovement = !!scene.movimentoBloqueado;
      opened = true;
      scene.cardReaderMenuOpen = true;
      scene.generatorMenuOpen = true;
      scene.movimentoBloqueado = true;
      scene.interacaoMundoProxima = null;
      scene.player?.setVelocity(0, 0);
      panel.open();
      return true;
    },
    close,
    destroy() {
      if (destroyed) return;
      destroyed = true; close();
      scene.events.off(Phaser.Scenes.Events.PRE_RENDER, update);
      escape.off("down", onEscape);
      panel.destroy();
    },
  };
}
