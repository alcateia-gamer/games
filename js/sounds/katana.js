// Volume do som quando a katana acerta um inimigo.
const VOLUME_KATANA_ACERTO = 0.15;

// Volume do som quando o golpe da katana não acerta nada.
const VOLUME_KATANA_ERRO = 0.15;

function carregarSonsKatana(loader) {
  loader.audio("katana-ataque", "sounds.mp3/katana_ataque.mp3");
  loader.audio("ataque-no-ar", "sounds.mp3/ataque_no_ar.mp3");
}

function tocarSomKatanaAcerto(scene) {
  if (scene.morteEmAndamento) {
    return;
  }

  scene.sound.play("katana-ataque", { volume: VOLUME_KATANA_ACERTO });
}

function tocarSomKatanaErro(scene) {
  if (scene.morteEmAndamento) {
    return;
  }

  scene.sound.play("ataque-no-ar", { volume: VOLUME_KATANA_ERRO });
}

export { carregarSonsKatana, tocarSomKatanaAcerto, tocarSomKatanaErro };
