/**
 * @file Cria WASD, controles de desenvolvedor, joystick e teleportes de desenvolvimento; mantém os elementos
 * fixos durante o zoom.
 */

import { aplicarEstaminaInfinitaDev } from "../player/PlayerStatus.js";
import { criarJoystick } from "./PlayerJoystick.js";
import { criarBotaoHUDNitido } from "../ui/HudCanvas.js";
import { criarTeleporteDevBoss } from "./DeveloperTeleport.js";
import { criarBotoesTeleporteDev } from "./DeveloperTeleportButtons.js";
import { criarMenuColetaveisDev } from "./DeveloperItemMenu.js";

// =====================================================
// FIXAR DEV E ANALÓGICO NA TELA
// =====================================================

/**
 * Registra o reposicionamento dos controles fixos e remove listeners anteriores para evitar
 * duplicação.
 */
function configurarControlesFixos(scene) {
  scene.limparControlesInputFixos?.();

  const botaoDev = scene.botaoDesenvolvedor;
  const textoDev = scene.textoBotaoDesenvolvedor;
  const botaoLuzFabrica = scene.botaoLuzFabrica;
  const textoLuzFabrica = scene.textoBotaoLuzFabrica;
  const joystick = scene.joystick;

  /**
   * Compensa o zoom para preservar posição e tamanho dos controles na tela.
   */
  const atualizarPosicao = () => {
    const camera = scene.cameras.main;

    if (
      !camera ||
      !botaoDev?.scene ||
      !textoDev?.scene ||
      !botaoLuzFabrica?.scene ||
      !textoLuzFabrica?.scene ||
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
    // BOTÃO DEV
    // =================================================

    const devTelaX = camera.width - 40;
    const devTelaY = scene.minimap?.devScreenY ?? 24;

    const devX = origemX + (devTelaX - origemX) / zoomX;
    const devY = origemY + (devTelaY - origemY) / zoomY;

    botaoDev.setPosition(devX, devY);
    textoDev.setPosition(devX, devY);

    botaoDev.setScale(1 / zoomX, 1 / zoomY);
    textoDev.setScale(1 / zoomX, 1 / zoomY);

    const luzTelaX = camera.width - 130;
    const luzX = origemX + (luzTelaX - origemX) / zoomX;
    const luzY = origemY + (devTelaY - origemY) / zoomY;

    botaoLuzFabrica.setPosition(luzX, luzY);
    textoLuzFabrica.setPosition(luzX, luzY);
    botaoLuzFabrica.setScale(1 / zoomX, 1 / zoomY);
    textoLuzFabrica.setScale(1 / zoomX, 1 / zoomY);

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
 * Registra teclas, joystick e botões de desenvolvedor, incluindo o comando que alterna a
 * fábrica.
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

  scene.developerMode = !!scene.developerMode;
  criarTeleporteDevBoss(scene);
  criarMenuColetaveisDev(scene);

  // BOTÃO DEV
  scene.botaoDesenvolvedor = scene.add
    .rectangle(760, 24, 80, 30, 0x1f2937, 0.9)
    .setStrokeStyle(2, 0x6ee7b7, 1)
    .setScrollFactor(0)
    .setDepth(200)
    .setInteractive({ useHandCursor: true });

  scene.textoBotaoDesenvolvedor = scene.add
    .text(760, 24, "DEV", {
      fontSize: "14px",
      color: "#e5e7eb",
      fontStyle: "bold",
      fontFamily: "monospace",
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(201);

  scene.botaoLuzFabrica = scene.add
    .rectangle(670, 24, 100, 30, 0x1f2937, 0.9)
    .setStrokeStyle(2, 0xfbbf24, 1)
    .setScrollFactor(0)
    .setDepth(200)
    .setInteractive({ useHandCursor: true })
    .setVisible(false);

  scene.textoBotaoLuzFabrica = scene.add
    .text(670, 24, "LUZ FAB", {
      fontSize: "12px",
      color: "#e5e7eb",
      fontStyle: "bold",
      fontFamily: "monospace",
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(201)
    .setVisible(false);

  /**
   * Atualiza cores, rótulos e visibilidade dos botões conforme o modo desenvolvedor.
   */
  let ultimoEstadoDev = "";
  const atualizarEstadoBotaoDesenvolvedor = () => {
    const ligado = !!scene.developerMode;
    const luzAcesa = !!scene.luzFabricaAcesa;
    const estado = `${ligado}:${luzAcesa}`;
    if (estado === ultimoEstadoDev) return;
    ultimoEstadoDev = estado;

    scene.botaoDesenvolvedor.setFillStyle(ligado ? 0x166534 : 0x1f2937, 0.9);

    scene.botaoDesenvolvedor.setStrokeStyle(2, ligado ? 0x86efac : 0x6ee7b7, 1);

    scene.textoBotaoDesenvolvedor.setText(ligado ? "DEV ON" : "DEV");
    scene.botaoLuzFabrica.setVisible(ligado);
    scene.textoBotaoLuzFabrica.setVisible(ligado);
    scene.botaoLuzFabrica.setFillStyle(luzAcesa ? 0x166534 : 0x1f2937, 0.9);
    scene.botaoLuzFabrica.setStrokeStyle(2, luzAcesa ? 0x86efac : 0xfbbf24, 1);
    scene.textoBotaoLuzFabrica.setText(luzAcesa ? "FAB ON" : "FAB OFF");
  };

  scene.botaoDesenvolvedor.on("pointerdown", () => {
    scene.developerMode = !scene.developerMode;
    if (!scene.developerMode) scene.fecharMenuColetaveisDev?.();
    aplicarEstaminaInfinitaDev(scene);
    atualizarEstadoBotaoDesenvolvedor();
  });

  scene.botaoLuzFabrica.on("pointerdown", () => {
    if (!scene.developerMode || (scene.generatorMenuOpen || scene.upgradeMenuOpen) || scene.devItemMenuOpen ||
        scene.morteEmAndamento) return;
    if (scene.coopRuntime) {
      scene.coopRuntime.manager.sendCoopAction("devLighting", { on: !scene.luzFabricaAcesa });
      return;
    }
    if (scene.luzFabricaAcesa) scene.apagarLuzFabrica?.();
    else scene.acenderLuzFabrica?.();
    atualizarEstadoBotaoDesenvolvedor();
  });

  atualizarEstadoBotaoDesenvolvedor();
  // A partida pelo gerador e o estado restaurado do mapa também atualizam o botão DEV.
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, atualizarEstadoBotaoDesenvolvedor);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, atualizarEstadoBotaoDesenvolvedor);
  });

  // ANALÓGICO
  criarJoystick(scene);

  criarBotoesTeleporteDev(scene);
  configurarControlesFixos(scene);
  criarBotaoHUDNitido(scene, scene.botaoDesenvolvedor, scene.textoBotaoDesenvolvedor);
  criarBotaoHUDNitido(scene, scene.botaoLuzFabrica, scene.textoBotaoLuzFabrica);

}

export { criarControlesInput };
