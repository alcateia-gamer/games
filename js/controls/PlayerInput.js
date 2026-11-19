/**
 * @file Cria WASD e o joystick; mantém os elementos fixos durante o zoom.
 */

import { criarJoystick } from "./PlayerJoystick.js";

// =====================================================
// FIXAR O ANALÓGICO NA TELA
// =====================================================

/**
 * Registra o reposicionamento dos controles fixos e remove listeners anteriores para evitar
 * duplicação.
 */
function configurarControlesFixos(scene) {
  scene.limparControlesInputFixos?.();

  const joystick = scene.joystick;

  /**
   * Compensa o zoom para preservar posição e tamanho dos controles na tela.
   */
  const atualizarPosicao = () => {
    const camera = scene.cameras.main;

    if (
      !camera ||
      !joystick.base?.scene ||
      !joystick.thumb?.scene
    ) {
      return;
    }

    const zoomX = camera.zoomX || camera.zoom || 1;
    const zoomY = camera.zoomY || camera.zoom || 1;

    const origemX = camera.width * camera.originX;
    const origemY = camera.height * camera.originY;
    scene.minimap?.layout(camera);

    // =================================================
    // ANALÓGICO
    // =================================================

    joystick.layout(camera);
  };

  /**
   * Remove os listeners de reposicionamento quando a cena é encerrada ou os controles são
   * recriados.
   */
  const limpar = () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, atualizarPosicao);

    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, limpar);

    if (scene.limparControlesInputFixos === limpar) {
      scene.limparControlesInputFixos = null;
    }
  };

  scene.limparControlesInputFixos = limpar;

  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, atualizarPosicao);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, limpar);

  atualizarPosicao();
}

// =====================================================
// CRIAÇÃO DOS CONTROLES
// =====================================================

/**
 * Registra as teclas normais e o joystick.
 */
function criarControlesInput(scene) {
  // TECLAS WASD
  scene.teclasWASD = scene.input.keyboard.addKeys({
    cima: Phaser.Input.Keyboard.KeyCodes.W,
    baixo: Phaser.Input.Keyboard.KeyCodes.S,
    esquerda: Phaser.Input.Keyboard.KeyCodes.A,
    direita: Phaser.Input.Keyboard.KeyCodes.D,
  });

  scene.teclaShift = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.SHIFT,
  );
  scene.teclaEspaco = scene.input.keyboard.addKey(
    Phaser.Input.Keyboard.KeyCodes.SPACE,
  );

  // ANALÓGICO
  criarJoystick(scene);
  configurarControlesFixos(scene);

}

export { criarControlesInput };
