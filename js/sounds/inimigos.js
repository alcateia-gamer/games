// Volume máximo do passo do robô. A distância reduz este valor até zero.
const VOLUME_PASSO_ROBO_MAXIMO = 0.4;

// Volume fixo do disparo de laser dos inimigos.
const VOLUME_TIRO_LASER = 0.02;

function carregarSonsInimigos(loader) {
  loader.audio("tiro-laser", "sounds.mp3/tiro_laser.mp3");
  loader.audio("robot-walk", "sounds.mp3/robot_walk_2.mp3");
}

function atualizarSomPassoRobo(
  scene,
  inimigo,
  viuPlayer,
  distancia,
  estaSeMovendo,
) {
  const podeTocar = viuPlayer && estaSeMovendo;
  const volume =
    Phaser.Math.Clamp(1 - distancia / inimigo.distanciaDeteccao, 0, 1) *
    VOLUME_PASSO_ROBO_MAXIMO;

  inimigo.podeTocarPasso = podeTocar;
  inimigo.volumePasso = volume;

  if (inimigo.somPassoRobo) {
    if (!podeTocar) {
      inimigo.somPassoRobo.stop();
    } else if (inimigo.somPassoRobo.isPlaying) {
      inimigo.somPassoRobo.setVolume(volume);
    }
  }
}

function configurarSomPassoRobo(scene, inimigo) {
  // Cada robô possui uma instância própria para que todos possam caminhar
  // e tocar seus passos simultaneamente sem bloquear os demais.
  inimigo.somPassoRobo = scene.sound.add("robot-walk", { loop: false });

  const tocarPasso = (animation) => {
    if (!animation.key.startsWith("robo-") || !inimigo.podeTocarPasso) {
      return;
    }

    // Um disparo no início e em cada repetição mantém um passo por ciclo.
    // O volume é calculado pela distância em atualizarSomPassoRobo().
    inimigo.somPassoRobo.play({ volume: inimigo.volumePasso });
  };

  inimigo.on("animationstart", tocarPasso);
  inimigo.on("animationrepeat", tocarPasso);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    inimigo.off("animationstart", tocarPasso);
    inimigo.off("animationrepeat", tocarPasso);
    inimigo.somPassoRobo.stop();
    inimigo.somPassoRobo.destroy();
  });
}

function tocarSomTiroLaser(scene) {
  scene.sound.play("tiro-laser", { volume: VOLUME_TIRO_LASER });
}

export {
  carregarSonsInimigos,
  configurarSomPassoRobo,
  atualizarSomPassoRobo,
  tocarSomTiroLaser,
};
