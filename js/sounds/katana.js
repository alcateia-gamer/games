/**
 * @file Sons de golpe com e sem acerto. As funções de reprodução respeitam o bloqueio de morte
 * da cena.
 */

// Volume do som quando a katana acerta um inimigo.
const VOLUME_KATANA_ACERTO = 0.15;

// Volume do som quando o golpe da katana não acerta nada.
const VOLUME_KATANA_ERRO = 0.15;

/**
 * Enfileira os áudios da katana e do golpe no ar com as chaves usadas pelo combate.
 */
function carregarSonsKatana(loader) {
  loader.audio("katana-ataque", "sounds.mp3/katana_ataque.mp3");
  loader.audio("ataque-no-ar", "sounds.mp3/ataque_no_ar.mp3");
}

/**
 * Reproduz o som de impacto da katana enquanto o jogador não está na sequência de morte.
 */
function tocarSomKatanaAcerto(scene) {
  if (scene.morteEmAndamento) {
    return;
  }

  scene.sound.play("katana-ataque", { volume: VOLUME_KATANA_ACERTO });
}

/**
 * Reproduz o som de golpe no ar enquanto o jogador não está na sequência de morte.
 */
function tocarSomKatanaErro(scene) {
  if (scene.morteEmAndamento) {
    return;
  }

  scene.sound.play("ataque-no-ar", { volume: VOLUME_KATANA_ERRO });
}

export { carregarSonsKatana, tocarSomKatanaAcerto, tocarSomKatanaErro };
