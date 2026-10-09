// =====================================================
// FIXAR DEV E ANALÓGICO NA TELA
// =====================================================

function configurarControlesFixos(scene) {
  scene.limparControlesInputFixos?.();

  const botaoDev = scene.botaoDesenvolvedor;
  const textoDev = scene.textoBotaoDesenvolvedor;
  const joystick = scene.joystick;

  const atualizarPosicao = () => {
    const camera = scene.cameras.main;

    if (
      !camera ||
      !botaoDev?.scene ||
      !textoDev?.scene ||
      !joystick.base?.scene ||
      !joystick.thumb?.scene
    ) {
      return;
    }

    const zoomX = camera.zoomX || camera.zoom || 1;
    const zoomY = camera.zoomY || camera.zoom || 1;

    const origemX = camera.width * camera.originX;
    const origemY = camera.height * camera.originY;

    // =================================================
    // BOTÃO DEV
    // =================================================

    const devTelaX = camera.width - 40;
    const devTelaY = 24;

    const devX = origemX + (devTelaX - origemX) / zoomX;
    const devY = origemY + (devTelaY - origemY) / zoomY;

    botaoDev.setPosition(devX, devY);
    textoDev.setPosition(devX, devY);

    botaoDev.setScale(1 / zoomX, 1 / zoomY);
    textoDev.setScale(1 / zoomX, 1 / zoomY);

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

  const atualizarEstadoBotaoDesenvolvedor = () => {
    const ligado = !!scene.developerMode;

    scene.botaoDesenvolvedor.setFillStyle(ligado ? 0x166534 : 0x1f2937, 0.9);

    scene.botaoDesenvolvedor.setStrokeStyle(2, ligado ? 0x86efac : 0x6ee7b7, 1);

    scene.textoBotaoDesenvolvedor.setText(ligado ? "DEV ON" : "DEV");
  };

  scene.botaoDesenvolvedor.on("pointerdown", () => {
    scene.developerMode = !scene.developerMode;
    atualizarEstadoBotaoDesenvolvedor();
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

function criarControleFullscreen(scene) {
  const eTouch =
    typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  if (!eTouch) {
    return;
  }

  const elementoFullscreen = () => document.documentElement;
  const obterElementoFullscreen = () =>
    document.fullscreenElement || document.webkitFullscreenElement;
  const podeEntrarFullscreen = () => {
    const elemento = elementoFullscreen();
    return !!(elemento.requestFullscreen || elemento.webkitRequestFullscreen);
  };

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
