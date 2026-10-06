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

  // BOTÃO DE DESENVOLVEDOR
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

  // JOYSTICK
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
