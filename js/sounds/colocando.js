/** Feedback de acesso, encaixe e coleta, sempre disparado pela confirmação da ação. */
const CHAVE = "colocando-item";
const controles = new WeakMap();

export function carregarSomColocando(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/colocando.mp3");
}

export function tocarSomColocando(scene, acao = "coleta") {
  if (scene.morteEmAndamento || !scene.cache?.audio?.exists(CHAVE) || !scene.sound?.add) return;
  let som = controles.get(scene);
  if (!som) {
    som = scene.sound.add(CHAVE);
    controles.set(scene, som);
    scene.events.once("shutdown", () => {
      som.destroy();
      controles.delete(scene);
    });
  }
  // Uma única voz evita acumular transientes em cliques/coletas muito próximos.
  if (som.isPlaying) som.stop();
  som.play({ volume: acao === "acesso" ? 0.28 : 0.55,
    rate: 1, detune: 0, seek: 0, loop: false });
}
