function mostrarTelaMorte(scene) {
  if (scene.morteEmAndamento) {
    return;
  }

  scene.morteEmAndamento = true;
  scene.sound?.stopAll();
  scene.player.invulneravel = true;
  scene.player.setVelocity(0, 0);
  scene.physics.pause();

  const camada = scene.add.container(0, 0).setDepth(1000).setScrollFactor(0);
  const telaPreta = scene.add.rectangle(
    scene.scale.width / 2,
    scene.scale.height / 2,
    scene.scale.width,
    scene.scale.height,
    0x000000,
    1,
  );
  camada.add(telaPreta);

  const simbolos = "09#@$%&!?<>[]{}\/\\|+=-_ERROR_SYSTEM_FAILURE_NULL";
  const mensagens = [
    "SYSTEM ERROR",
    "MEMORY CORRUPTED",
    "PLAYER NOT FOUND",
    "CRITICAL FAILURE",
    "REBOOT REQUIRED",
  ];
  const erro = scene.add
    .text(scene.scale.width / 2, scene.scale.height / 2, "SYSTEM ERROR", {
      color: "#dc143c",
      fontFamily: "monospace",
      fontSize: "24px",
      fontStyle: "bold",
      shadow: { blur: 18, color: "#8b0000", fill: true },
    })
    .setOrigin(0.5)
    .setAlpha(0);
  camada.add(erro);

  const criarFalha = () => {
    const mensagem = mensagens[Phaser.Math.Between(0, mensagens.length - 1)];
    const texto = Array.from(
      { length: Phaser.Math.Between(4, 14) },
      () => simbolos[Phaser.Math.Between(0, simbolos.length - 1)],
    ).join("");
    const falha = scene.add
      .text(
        Phaser.Math.Between(12, scene.scale.width - 12),
        Phaser.Math.Between(20, scene.scale.height - 20),
        `${mensagem} // ${texto}`,
        {
          color: Phaser.Math.Between(0, 1) ? "#dc143c" : "#8b0000",
          fontFamily: "monospace",
          fontSize: Phaser.Math.Between(10, 19) + "px",
          fontStyle: "bold",
          shadow: { blur: 8, color: "#ff1744", fill: true },
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

  scene.time.delayedCall(1000, () => {
    scene.tweens.add({
      targets: erro,
      alpha: 1,
      scale: { from: 0.7, to: 3.2 },
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
      window.location.reload();
    });
  });
}

export default mostrarTelaMorte;
