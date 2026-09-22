// Volume máximo do passo do robô. A distância reduz este valor até zero.
const VOLUME_PASSO_ROBO_MAXIMO = 0.3;
const DISTANCIA_FADE_PASSO_ROBO = 240;

// Volume fixo do disparo de laser dos inimigos.
const VOLUME_TIRO_LASER = 0.02;
const VOLUME_MORTE_ROBO = 0.3;

function carregarSonsInimigos(loader) {
  loader.audio("tiro-laser", "sounds.mp3/tiro_laser.mp3");
  loader.audio("robot-walk", "sounds.mp3/robot_walk_3.mp3");
  loader.audio("robo-explodindo", "sounds.mp3/robo_explodindo.mp3");
}

function atualizarSomPassoRobo(
  scene,
  inimigo,
  viuPlayer,
  distancia,
  estaSeMovendo,
) {
  const podeTocar = estaSeMovendo;
  const distanciaInicioFade = inimigo.distanciaDeteccao;
  const distanciaFimFade = distanciaInicioFade + DISTANCIA_FADE_PASSO_ROBO;
  const volumeRelativo =
    distancia <= distanciaInicioFade
      ? Math.max(1 - distancia / distanciaInicioFade, 0.2)
      : Phaser.Math.Clamp(
          0.2 * ((distanciaFimFade - distancia) / DISTANCIA_FADE_PASSO_ROBO),
          0,
          0.2,
        );
  const volume = volumeRelativo * VOLUME_PASSO_ROBO_MAXIMO;
  const podeOuvir = volume > 0;

  inimigo.podeTocarPasso = podeTocar;
  inimigo.volumePasso = volume;

  if (inimigo.somPassoRobo) {
    if (!podeTocar || !podeOuvir) {
      inimigo.somPassoRobo.stop();
    } else if (!inimigo.somPassoRobo.isPlaying) {
      inimigo.somPassoRobo.play({ volume });
    } else if (inimigo.somPassoRobo.isPlaying) {
      inimigo.somPassoRobo.setVolume(volume);
    }
  }
}

function configurarSomPassoRobo(scene, inimigo) {
  // Cada robô possui uma instância própria para que todos possam caminhar
  // e tocar seus passos simultaneamente sem bloquear os demais.
  inimigo.somPassoRobo = scene.sound.add("robot-walk", { loop: true });

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    if (!inimigo.somPassoRobo) {
      return;
    }

    inimigo.somPassoRobo.stop();
    inimigo.somPassoRobo.destroy();
    inimigo.somPassoRobo = null;
  });
}

function tocarSomTiroLaser(scene) {
  scene.sound.play("tiro-laser", { volume: VOLUME_TIRO_LASER });
}

function tocarSomMorteRobo(scene, inimigo) {
  if (!scene?.sound || !inimigo || inimigo.somMorteTocado) {
    return;
  }

  inimigo.somMorteTocado = true;
  scene.sound.play("robo-explodindo", { volume: VOLUME_MORTE_ROBO });
}

export {
  carregarSonsInimigos,
  configurarSomPassoRobo,
  atualizarSomPassoRobo,
  tocarSomTiroLaser,
  tocarSomMorteRobo,
};
