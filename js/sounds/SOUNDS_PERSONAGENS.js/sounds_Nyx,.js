/** Loops da invocação e da cura, limitados à duração de cada etapa. */
const SONS = { invocacao: ["nyx-aura-invocacao", "AURA.mp3", 0.35],
  cura: ["nyx-aura-cura", "AURA_NYX.mp3", 0.15] };
const sons = new WeakMap();

export function carregarSomAuraNyx(loader) {
  for (const [chave, arquivo] of Object.values(SONS)) {
    loader.audio(chave, `sounds.mp3/SONS PARA BOTAR AINDA/${arquivo}`);
  }
}

export function pararSomAuraNyx(scene, id) {
  const controle = sons.get(scene);
  if (controle?.id === id) {
    controle.som.stop();
    controle.fim = null;
  }
}

export function tocarSomAuraNyx(scene, { id, duracaoMs, idadeMs = 0, fase = "invocacao" }) {
  if (idadeMs >= duracaoMs) return;
  const [chave, , volume] = SONS[fase] ?? SONS.invocacao;
  if (!scene.cache?.audio?.exists(chave) || !scene.sound?.add) return;
  let controle = sons.get(scene);
  if (!controle) {
    const som = scene.sound.add(chave, { volume, loop: true });
    controle = { som, chave, id, fim: null };
    sons.set(scene, controle);
    const atualizar = () => {
      if (controle.fim !== null && scene.time.now >= controle.fim) pararSomAuraNyx(scene, controle.id);
    };
    scene.events.on("preupdate", atualizar);
    const limpar = () => {
      scene.events.off("preupdate", atualizar);
      scene.events.off("shutdown", limpar);
      scene.events.off("destroy", limpar);
      controle.som.stop();
      controle.som.destroy();
      sons.delete(scene);
    };
    scene.events.once("shutdown", limpar);
    scene.events.once("destroy", limpar);
  }
  if (controle.chave !== chave) {
    controle.som.stop();
    controle.som.destroy();
    controle.som = scene.sound.add(chave, { volume, loop: true });
    controle.chave = chave;
  }
  const som = controle.som;
  if (som.isPlaying) som.stop();
  controle.id = id;
  controle.fim = scene.time.now + duracaoMs - idadeMs;
  // Repete o arquivo inteiro na velocidade original; atrasos entram na mesma fase do loop.
  const idade = Math.max(0, idadeMs) / 1000;
  const seek = Number.isFinite(som.totalDuration) && som.totalDuration > 0 ? idade % som.totalDuration : 0;
  som.play({ volume, loop: true, rate: 1, detune: 0, seek });
  return () => pararSomAuraNyx(scene, id);
}
