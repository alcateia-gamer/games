import { limparGrupoRobos } from "../enemies/EnemyTest.js";

function criarTransicaoParaParte2(scene) {
  const camadaTransicao =
    scene.map.getObjectLayer("Transitions") ||
    scene.map.getObjectLayer("Transicoes") ||
    scene.map.getObjectLayer("Portas");

  if (!camadaTransicao || !Array.isArray(camadaTransicao.objects)) {
    return;
  }

  const entrada = camadaTransicao.objects.find(
    (obj) => obj.name === "EntradaFabrica" || obj.type === "EntradaFabrica",
  );

  if (!entrada) {
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
      limparGrupoRobos(scene);
      scene.scene.start("Level1Parte2", {
        spawnX: 97,
        spawnY: -995,
        personagem: scene.personagemSelecionada,
      });
    });
  });
}

export default criarTransicaoParaParte2;
