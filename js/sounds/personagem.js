// Volume máximo do som de corrida do personagem.
const VOLUME_CORRIDA = 1;

function carregarSonsPersonagem(loader) {
  loader.audio("running", "sounds.mp3/running.mp3");
}

function configurarSomCorrida(scene) {
  scene.somCorrida = scene.sound.add("running", {
    loop: false,
    // Configuração do volume do áudio de corrida do personagem.
    volume: VOLUME_CORRIDA,
  });

  scene.player.on("animationupdate", (animation, frame) => {
    if (!animation.key.startsWith("walk-")) {
      return;
    }

    if (
      (frame.index === 0 || frame.index === 4) &&
      !scene.somCorrida.isPlaying
    ) {
      scene.somCorrida.play({ volume: VOLUME_CORRIDA });
    }
  });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.somCorrida.stop();
  });
}

function atualizarSomCorrida(scene, estaSeMovendo) {
  if (!scene.somCorrida || estaSeMovendo) {
    return;
  }

  if (scene.somCorrida.isPlaying) {
    scene.somCorrida.stop();
  }
}

export { carregarSonsPersonagem, configurarSomCorrida, atualizarSomCorrida };
