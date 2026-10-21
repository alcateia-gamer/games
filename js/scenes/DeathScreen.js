/**
 * @file Sequência visual de morte: bloqueia o jogo, mostra falhas de sistema e oferece
 * um botão para jogar novamente após a animação.
 */

/**
 * Substitui os erros animados pela tela de derrota e aguarda o clique para voltar ao menu.
 */
function mostrarOpcaoJogarNovamente(scene, camada) {
  for (const objeto of camada.list) {
    scene.tweens.killTweensOf(objeto);
  }
  camada.removeAll(true);

  const { width, height } = scene.cameras.main;
  const centroX = width / 2;
  const centroY = height / 2;

  const fundo = scene.add.rectangle(centroX, centroY, width, height, 0x000000, 1)
    .setScrollFactor(0)
    .setInteractive();
  const titulo = scene.add.text(centroX, centroY - 70, "VOCÊ MORREU", {
    fontFamily: "monospace",
    fontSize: "38px",
    fontStyle: "bold",
    color: "#dc143c",
    shadow: { blur: 18, color: "#8b0000", fill: true },
  }).setOrigin(0.5);
  const mensagem = scene.add.text(centroX, centroY - 10, "Tente novamente.", {
    fontFamily: "monospace",
    fontSize: "18px",
    color: "#b5b5b5",
  }).setOrigin(0.5);
  const botao = scene.add.rectangle(centroX, centroY + 65, 280, 58, 0x350812, 1)
    // O hit test usa o scroll do próprio botão, mesmo dentro de um container fixo.
    .setScrollFactor(0)
    .setStrokeStyle(2, 0xdc143c)
    .setInteractive({ useHandCursor: true });
  const textoBotao = scene.add.text(centroX, centroY + 65, "Jogar novamente", {
    fontFamily: "monospace",
    fontSize: "22px",
    fontStyle: "bold",
    color: "#ffffff",
  }).setOrigin(0.5);

  camada.add([fundo, titulo, mensagem, botao, textoBotao]);

  botao.on("pointerover", () => botao.setFillStyle(0x73132a));
  botao.on("pointerout", () => botao.setFillStyle(0x350812));
  botao.once("pointerdown", () => {
    botao.disableInteractive();
    if (scene.multiplayer) {
      scene.multiplayerManager?.leaveRoom();
    }
    scene.scene.start("Start", { abrirMenu: true });
  });
}

/**
 * Inicia a morte uma única vez, para sons e física e monta o overlay com a sequência de falha.
 */
function mostrarTelaMorte(scene) {
  if (scene.morteEmAndamento) {
    return;
  }

  scene.morteEmAndamento = true;
  scene.movimentoBloqueado = true;
  scene.sound?.stopAll();
  scene.limparPainelStatusFixo?.();
  scene.player.invulneravel = true;
  scene.player.setVelocity(0, 0);
  scene.physics.pause();

  // =====================================================
  // TELA DE MORTE FIXA, INDEPENDENTE DO ZOOM
  // =====================================================

  const camera = scene.cameras.main;

  const camada = scene.add.container(0, 0).setDepth(1000000).setScrollFactor(0);

  /**
   * Compensa posição e escala do overlay para mantê-lo fixo mesmo durante mudanças de zoom.
   */
  const atualizarTelaFixa = () => {
    if (!camada.scene) return;

    const cameraAtual = scene.cameras.main;
    if (!cameraAtual) return;

    const zoomX = cameraAtual.zoomX || cameraAtual.zoom || 1;
    const zoomY = cameraAtual.zoomY || cameraAtual.zoom || 1;

    const centroX = cameraAtual.width * cameraAtual.originX;
    const centroY = cameraAtual.height * cameraAtual.originY;

    // Compensa a transformação da câmera.
    // Assim, o conteúdo mantém o tamanho e a posição
    // originais mesmo durante o afastamento da câmera.
    camada.setPosition(centroX - centroX / zoomX, centroY - centroY / zoomY);

    camada.setScale(1 / zoomX, 1 / zoomY);
  };

  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, atualizarTelaFixa);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, atualizarTelaFixa);
  });

  // =====================================================
  // FUNDO PRETO
  // =====================================================

  const telaPreta = scene.add.rectangle(
    camera.width / 2,
    camera.height / 2,
    camera.width,
    camera.height,
    0x000000,
    1,
  ).setScrollFactor(0).setInteractive();

  camada.add(telaPreta);

  // Aplica a compensação imediatamente.
  atualizarTelaFixa();

  // =====================================================
  // TEXTOS E SÍMBOLOS
  // =====================================================

  const simbolos = "09#@$%&!?<>[]{}\/\\|+=-_ERROR_SYSTEM_FAILURE_NULL";

  const mensagens = [
    "SYSTEM ERROR",
    "MEMORY CORRUPTED",
    "PLAYER NOT FOUND",
    "CRITICAL FAILURE",
    "REBOOT REQUIRED",
  ];

  const erro = scene.add
    .text(camera.width / 2, camera.height / 2, "SYSTEM ERROR", {
      color: "#dc143c",
      fontFamily: "monospace",
      fontSize: "24px",
      fontStyle: "bold",
      shadow: {
        blur: 18,
        color: "#8b0000",
        fill: true,
      },
    })
    .setOrigin(0.5)
    .setAlpha(0);

  camada.add(erro);

  // =====================================================
  // ANIMAÇÃO DOS ERROS
  // =====================================================

  /**
   * Cria uma mensagem aleatória de falha com símbolos, deslocamento e desaparecimento gradual.
   */
  const criarFalha = () => {
    const mensagem = mensagens[Phaser.Math.Between(0, mensagens.length - 1)];

    const texto = Array.from(
      {
        length: Phaser.Math.Between(4, 14),
      },
      () => simbolos[Phaser.Math.Between(0, simbolos.length - 1)],
    ).join("");

    const falha = scene.add
      .text(
        Phaser.Math.Between(12, camera.width - 12),
        Phaser.Math.Between(20, camera.height - 20),
        `${mensagem} // ${texto}`,
        {
          color: Phaser.Math.Between(0, 1) ? "#dc143c" : "#8b0000",
          fontFamily: "monospace",
          fontSize: Phaser.Math.Between(10, 19) + "px",
          fontStyle: "bold",
          shadow: {
            blur: 8,
            color: "#ff1744",
            fill: true,
          },
        },
      )
      .setOrigin(0.5)
      .setAlpha(Phaser.Math.FloatBetween(0.45, 1));

    camada.add(falha);

    scene.tweens.add({
      targets: falha,
      x: falha.x + Phaser.Math.Between(-80, 80),
      alpha: 0,
      duration: Phaser.Math.Between(700, 1500),
      ease: "Sine.easeIn",
      onComplete: () => falha.destroy(),
    });
  };

  // =====================================================
  // SEQUÊNCIA ORIGINAL DA TELA DE MORTE
  // =====================================================

  scene.time.delayedCall(1000, () => {
    scene.tweens.add({
      targets: erro,
      alpha: 1,
      scale: {
        from: 0.7,
        to: 3.2,
      },
      duration: 6000,
      ease: "Quad.easeIn",
    });

    const poluicao = scene.time.addEvent({
      delay: 180,
      repeat: 30,
      callback: () => {
        const quantidade = Phaser.Math.Between(2, 5);

        for (let index = 0; index < quantidade; index += 1) {
          criarFalha();
        }
      },
    });

    scene.time.delayedCall(6200, () => {
      poluicao.remove();

      mostrarOpcaoJogarNovamente(scene, camada);
    });
  });
}

export default mostrarTelaMorte;
