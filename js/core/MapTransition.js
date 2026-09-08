function criarTransicaoParaParte2(scene) {
  const camadaTransicao =
    scene.map.getObjectLayer("Transitions") ||
    scene.map.getObjectLayer("Transicoes") ||
    scene.map.getObjectLayer("Portas");

  const entrada = camadaTransicao?.objects.find(
    (obj) => obj.name === "EntradaFabrica" || obj.type === "EntradaFabrica",
  );

  if (!entrada) {
    console.warn(
      'Transição ausente: crie no Tiled um objeto chamado "EntradaFabrica" em uma camada "Transitions", "Transicoes" ou "Portas".',
    );
    return;
  }

  const largura = entrada.width || scene.map.tileWidth;
  const altura = entrada.height || scene.map.tileHeight;

  scene.entradaFabrica = scene.add.zone(
    entrada.x + largura / 2,
    entrada.y + altura / 2,
    largura,
    altura,
  );

  scene.physics.world.enable(
    scene.entradaFabrica,
    Phaser.Physics.Arcade.STATIC_BODY,
  );
  scene.entradaFabrica.body.setSize(largura, altura);
  scene.entradaFabrica.body.setAllowGravity(false);

  scene.physics.add.overlap(scene.player, scene.entradaFabrica, () => {
    if (scene.transicaoEmAndamento) {
      return;
    }

    scene.transicaoEmAndamento = true;
    scene.physics.pause();
    scene.cameras.main.fadeOut(250, 0, 0, 0);

    scene.cameras.main.once("camerafadeoutcomplete", () => {
      scene.scene.start("Level1Parte2", {
        spawnX: 240,
        spawnY: 240,
      });
    });
  });
}

export default criarTransicaoParaParte2;
