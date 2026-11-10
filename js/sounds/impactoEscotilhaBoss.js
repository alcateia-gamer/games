const CHAVE = "boss-impacto-escotilha";
const CHAVE_EXPLOSAO = "boss-explosao-escotilha";

export function carregarSomImpactoEscotilhaBoss(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/BATENDO_ESCOTILHA.mp3");
}

export function criarSomImpactoEscotilhaBoss(scene, ponto) {
  return criarSomLocalizadoEscotilha(scene, ponto, CHAVE, 0.07);
}

export function carregarSomExplosaoEscotilhaBoss(loader) {
  loader.audio(CHAVE_EXPLOSAO, "sounds.mp3/SONS PARA BOTAR AINDA/ESCOTILHA_EXPLODINDO.mp3");
}

export function criarSomExplosaoEscotilhaBoss(scene, ponto) {
  return criarSomLocalizadoEscotilha(scene, ponto, CHAVE_EXPLOSAO, 0.65, 800);
}

function criarSomLocalizadoEscotilha(scene, ponto, chave, volumeBase, alcance = 400) {
  let som = null;
  let destruido = false;
  return {
    tocar() {
      if (destruido || !scene.cache?.audio?.exists(chave) || !scene.sound?.add) return;
      const jogador = scene.player?.body?.center ?? scene.player;
      const distancia = Math.hypot(ponto.x - (jogador?.x ?? ponto.x),
        ponto.y - (jogador?.y ?? ponto.y));
      const volume = volumeBase / (1 + (distancia / alcance) ** 2);
      som ??= scene.sound.add(chave, { volume, loop: false });
      // Uma instância por escotilha: novos acertos não acumulam vozes sobrepostas.
      som.play({ volume, loop: false, rate: 1, detune: 0, seek: 0 });
    },
    parar() { som?.stop(); },
    destruir() {
      if (destruido) return;
      destruido = true;
      som?.stop();
      som?.destroy();
      som = null;
    },
  };
}
