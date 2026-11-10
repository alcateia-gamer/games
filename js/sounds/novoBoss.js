const CHAVE_MUSICA = "musica-novo-boss";
const NOME_MARCADOR_LOOP = "boss-continuo";
const ATRASO_ENTRADA = 0.35;
const VOLUME_MAXIMO = 0.1;
// Pontos correspondentes da faixa: um ciclo de 160 batidas a 172 BPM.
// O salto acontece antes do encerramento/fade da gravação (~110 s).
const INICIO_LOOP = 48;
const FIM_LOOP = INICIO_LOOP + 160 * 60 / 172;

export function carregarMusicaNovoBoss(loader) {
  loader.audio(CHAVE_MUSICA, "sounds.mp3/MUSICAIS BOSS/24. Punk Croc Theme.mp3");
}

export function prepararMusicaNovoBoss(scene, encontro) {
  let musica = null;
  let destruida = false;
  let volumeAtual = 0;

  function iniciar() {
    if (musica || destruida || !scene.cache?.audio?.exists(CHAVE_MUSICA)) return;

    musica = scene.sound.add(CHAVE_MUSICA, { volume: 0 });
    const duracao = musica.totalDuration;

    if (Number.isFinite(duracao) && duracao > 2) {
      const inicioLoop = Math.min(INICIO_LOOP, duracao - 1);
      const fimLoop = Math.min(FIM_LOOP, duracao);
      musica.addMarker({
        name: NOME_MARCADOR_LOOP,
        start: inicioLoop,
        duration: fimLoop - inicioLoop,
        config: { volume: 0, loop: true },
      });
      // O seek relativo negativo inclui a introdução só na primeira passagem.
      // O Phaser agenda a volta no relógio do áudio, sem esperar por "complete".
      musica.play(NOME_MARCADOR_LOOP, { volume: volumeAtual, seek: -inicioLoop });
    } else {
      musica.play({ volume: volumeAtual, loop: true, seek: 0 });
    }
  }

  function parar() {
    if (!musica) return;
    musica.stop();
    musica.destroy();
    musica = null;
  }

  function destruir() {
    if (destruida) return;
    destruida = true;
    scene.events?.off("novo-boss:derrotada", aoDerrotar);
    scene.events?.off("shutdown", destruir);
    parar();
  }

  const aoDerrotar = evento => {
    if (evento?.encontro === encontro) destruir();
  };

  scene.events?.on("novo-boss:derrotada", aoDerrotar);
  scene.events?.once("shutdown", destruir);

  return {
    atualizar(progresso) {
      const p = Math.max(0, Math.min(1, Number.isFinite(progresso) ? progresso : 0));
      if (p < ATRASO_ENTRADA) return;
      iniciar();
      if (!musica) return;

      const entrada = Math.max(0, Math.min(1, (p - ATRASO_ENTRADA) / (1 - ATRASO_ENTRADA)));
      const suavizada = entrada * entrada * (3 - 2 * entrada);
      volumeAtual = VOLUME_MAXIMO * suavizada;
      musica.setVolume(volumeAtual);
    },
    parar,
    destruir,
  };
}
