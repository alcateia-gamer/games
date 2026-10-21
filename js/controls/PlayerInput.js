/**
 * @file Cria WASD, controles de desenvolvedor, joystick e tela cheia; mantém os elementos
 * fixos durante o zoom.
 */

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

    if (scene.botaoFullscreen?.scene) {
      const fullscreenTelaX = camera.width - (botaoLuzFabrica.visible ? 210 : 100);
      const fullscreenX = origemX + (fullscreenTelaX - origemX) / zoomX;
      scene.botaoFullscreen.setPosition(fullscreenX, devY).setScale(1 / zoomX, 1 / zoomY);
      scene.textoBotaoFullscreen?.setPosition(fullscreenX, devY).setScale(1 / zoomX, 1 / zoomY);
    }

    // =================================================
    // ANALÓGICO
    // =================================================

    // Preserva a posição original na tela de 800 x 450:
    // X = 100 e Y = 350.
    const analogicoTelaX = 100;
    const analogicoTelaY = camera.height - 100;

    const analogicoX = origemX + (analogicoTelaX - origemX) / zoomX;

    const analogicoY = origemY + (analogicoTelaY - origemY) / zoomY;

    // Mantém o tamanho visual da base e do botão central.
    joystick.base.setScale(1 / zoomX, 1 / zoomY);
    joystick.thumb.setScale(1 / zoomX, 1 / zoomY);

    // O zoom da arena é uniforme.
    // Compensa também o limite de deslocamento do analógico.
    joystick.setRadius(50 / zoomX);

    // Atualiza o centro usado pelo próprio plugin.
    joystick.setPosition(analogicoX, analogicoY);

    // Atualiza o deslocamento do botão central mesmo
    // quando o dedo está parado e a câmera muda de zoom.
    joystick.forceUpdateThumb();
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
 * Registra teclas, joystick e botões de desenvolvedor, incluindo o comando que acende a
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
  const atualizarEstadoBotaoDesenvolvedor = () => {
    const ligado = !!scene.developerMode;

    scene.botaoDesenvolvedor.setFillStyle(ligado ? 0x166534 : 0x1f2937, 0.9);

    scene.botaoDesenvolvedor.setStrokeStyle(2, ligado ? 0x86efac : 0x6ee7b7, 1);

    scene.textoBotaoDesenvolvedor.setText(ligado ? "DEV ON" : "DEV");
    scene.botaoLuzFabrica.setVisible(ligado);
    scene.textoBotaoLuzFabrica.setVisible(ligado);
  };

  scene.botaoDesenvolvedor.on("pointerdown", () => {
    scene.developerMode = !scene.developerMode;
    atualizarEstadoBotaoDesenvolvedor();
  });

  scene.botaoLuzFabrica.on("pointerdown", () => {
    scene.acenderLuzFabrica?.();
    scene.botaoLuzFabrica.disableInteractive();
    scene.botaoLuzFabrica.setFillStyle(0x166534, 0.9);
    scene.botaoLuzFabrica.setStrokeStyle(2, 0x86efac, 1);
    scene.textoBotaoLuzFabrica.setText("FAB ON");
  });

  atualizarEstadoBotaoDesenvolvedor();

  // ANALÓGICO
  scene.joystick = scene.plugins.get("rexvirtualjoystickplugin").add(scene, {
    x: 100,
    y: 350,
    radius: 50,
    base: scene.add.circle(0, 0, 50, 0xcccccc, 0.7),
    thumb: scene.add.circle(0, 0, 25, 0x666666, 0.9),
  });

  scene.joystick.base.setScrollFactor(0).setDepth(100);

  scene.joystick.thumb.setScrollFactor(0).setDepth(101);

  scene.joystickPointerId = null;
  scene.joystick.on("pointerdown", (pointer) => {
    scene.joystickPointerId = pointer.id;
  });
  scene.input.on("pointerup", (pointer) => {
    if (pointer.id === scene.joystickPointerId) {
      scene.joystickPointerId = null;
    }
  });

  criarControleFullscreen(scene);
  configurarControlesFixos(scene);
}

/**
 * Cria o botão de tela cheia para dispositivos com toque e detecta suporte do navegador.
 */
function criarControleFullscreen(scene) {
  const eTouch =
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  if (!eTouch) {
    return;
  }

  /**
   * Retorna o elemento da página que será apresentado em tela cheia.
   */
  const elementoFullscreen = () => document.documentElement;
  /**
   * Consulta o elemento atualmente em tela cheia, incluindo a variante WebKit.
   */
  const obterElementoFullscreen = () =>
    document.fullscreenElement || document.webkitFullscreenElement;
  /**
   * Verifica se o navegador oferece uma das APIs de entrada em tela cheia.
   */
  const podeEntrarFullscreen = () => {
    const elemento = elementoFullscreen();
    return !!(elemento.requestFullscreen || elemento.webkitRequestFullscreen);
  };

  /**
   * Solicita tela cheia e trata a rejeição da API do navegador.
   */
  const entrarFullscreen = async () => {
    const elemento = elementoFullscreen();

    try {
      if (elemento.requestFullscreen) {
        await elemento.requestFullscreen({ navigationUI: "hide" });
      } else {
        await elemento.webkitRequestFullscreen?.();
      }
    } catch (erro) {
      console.warn("Fullscreen não disponível:", erro);
    }
  };

  /**
   * Encerra a tela cheia usando a API disponível no navegador.
   */
  const sairFullscreen = async () => {
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else {
        await document.webkitExitFullscreen?.();
      }
    } catch (erro) {
      console.warn("Não foi possível sair do fullscreen:", erro);
    }
  };

  /**
   * Alterna entre entrar e sair de tela cheia conforme o estado atual.
   */
  const alternarFullscreen = async () => {
    if (obterElementoFullscreen()) {
      await sairFullscreen();
    } else {
      await entrarFullscreen();
    }
  };

  scene.botaoFullscreen = scene.add
    .rectangle(700, 24, 40, 30, 0x1f2937, 0.9)
    .setStrokeStyle(2, 0x6ee7b7, 1)
    .setScrollFactor(0)
    .setDepth(200)
    .setInteractive();

  scene.textoBotaoFullscreen = scene.add
    .text(700, 24, "[]", {
      fontSize: "14px",
      color: "#e5e7eb",
      fontStyle: "bold",
      fontFamily: "monospace",
    })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(201);

  scene.botaoFullscreen.on("pointerdown", (pointer) => {
    pointer.event?.preventDefault?.();
    void alternarFullscreen();
  });

  if (!podeEntrarFullscreen()) {
    scene.botaoFullscreen.setAlpha(0.45);
    scene.textoBotaoFullscreen.setAlpha(0.45);
  }
}

export { criarControlesInput };
