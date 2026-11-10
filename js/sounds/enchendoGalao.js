const CHAVE = "enchendo-galao";
const VOLUME = 0.08;

export function carregarSomEnchendoGalao(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/enchendo_galao.mp3");
}

export function criarSomEnchendoGalao(scene) {
  let som = null;
  let tocando = false;
  const parar = () => {
    if (!tocando) return;
    som.stop();
    tocando = false;
  };
  return {
    iniciar() {
      if (tocando || !scene.cache?.audio?.exists(CHAVE) || !scene.sound?.add) return;
      som ??= scene.sound.add(CHAVE, { volume: VOLUME, loop: false });
      tocando = !!som.play({ volume: VOLUME, loop: false, rate: 1, detune: 0, seek: 0 });
    },
    parar,
    destruir() { parar(); som?.destroy(); som = null; },
  };
}
