// Volume máximo do som de corrida do personagem.
const VOLUME_CORRIDA = 1;

function carregarSonsPersonagem(loader) {
  loader.audio("running", "sounds.mp3/running.mp3");
}

function configurarSomCorrida(scene) {
  scene.somCorrida = scene.sound.add("running", {
    loop: true,
    // Configuração do volume do áudio de corrida do personagem.
    volume: VOLUME_CORRIDA,
  });

  const iniciarSomCorrida = (event) => {
    if (scene.morteEmAndamento) {
      return;
    }

    const teclasDirecao = scene.teclasWASD;
    const teclaDirecional = Object.values(teclasDirecao || {}).some(
      (tecla) => tecla.keyCode === event.keyCode,
    );

    if (teclaDirecional && !scene.somCorrida.isPlaying) {
      scene.somCorrida.play({ volume: VOLUME_CORRIDA });
    }
  };

  scene.input.keyboard.on("keydown", iniciarSomCorrida);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.input.keyboard.off("keydown", iniciarSomCorrida);
    scene.somCorrida.stop();
  });
}

function atualizarSomCorrida(scene, estaSeMovendo) {
  if (!scene.somCorrida) {
    return;
  }

  if (scene.morteEmAndamento) {
    if (scene.somCorrida.isPlaying) {
      scene.somCorrida.stop();
    }
    return;
  }

  if (estaSeMovendo) {
    if (!scene.somCorrida.isPlaying) {
      scene.somCorrida.play({ volume: VOLUME_CORRIDA });
    }
  } else if (scene.somCorrida.isPlaying) {
    scene.somCorrida.stop();
  }
}

export { carregarSonsPersonagem, configurarSomCorrida, atualizarSomCorrida };
