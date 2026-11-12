import { cenaSomCompartilhado } from "../multiplayer/CoopAudio.js";
const CHAVE = "boss-escotilha";
// Quadros 0–8 do summon: a tampa abre e fecha enquanto a torre atravessa o piso.
// O restante do summon monta a cabeça da torre, sem movimento da escotilha.
const JANELA_TAMPA_MS = 900;
const grupos = new WeakMap();

export function carregarSomEscotilhaBoss(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/ESCOTILHA_BOSS.mp3");
}

export function criarSomEscotilhaBoss(scene, ponto, duracaoAnimacao) {
  scene = cenaSomCompartilhado(scene, ponto, { curve: "hatch" });
  let som = null;
  let tocando = false;
  let destruido = false;
  const grupo = grupos.get(scene.coopSoundRoot ?? scene) ?? new Map();
  grupos.set(scene.coopSoundRoot ?? scene, grupo);
  const distribuirVolume = () => {
    let total = 0;
    for (const volume of grupo.values()) total += volume;
    const fator = total > 0.612 ? 0.612 / total : 1;
    for (const [audio, volume] of grupo) audio.setVolume(volume * fator);
  };
  const parar = () => {
    if (!tocando) return;
    som.stop();
    tocando = false;
    grupo.delete(som);
    distribuirVolume();
  };
  return {
    atualizar(tempo, visivel, descendo = false, velocidade = 1) {
      if (destruido) return;
      const janela = Math.min(JANELA_TAMPA_MS, duracaoAnimacao);
      const inicio = descendo ? duracaoAnimacao - janela : 0;
      const decorrido = tempo - inicio;
      if (!visivel || decorrido < 0 || decorrido >= janela) { parar(); return; }
      if (!scene.cache?.audio?.exists(CHAVE) || !scene.sound?.add) return;
      if (!som) {
        som = scene.sound.add(CHAVE, { volume: 0, loop: false });
        if (!(som.totalDuration > 0)) { som.destroy(); som = null; return; }
      }
      const camera = scene.cameras?.main;
      const ouvinte = scene.cenaEntradaBossAtiva && camera?.midPoint ? camera.midPoint
        : scene.player?.body?.center ?? scene.player;
      const dx = ponto.x - (ouvinte?.x ?? ponto.x);
      const dy = ponto.y - (ouvinte?.y ?? ponto.y);
      const distancia = Math.hypot(dx, dy);
      const volume = 0.396 / (1 + (distancia / 340) ** 2)
        * Math.max(0, 1 - distancia / 1400);
      const rate = som.totalDuration * 1000 / janela * velocidade;
      const pan = Math.max(-0.6, Math.min(0.6, dx / 550));
      if (!tocando) {
        // Usa o efeito inteiro: não corta a identidade do som nem alonga a animação.
        tocando = !!som.play({ volume: 0, loop: false, rate, detune: 0, pan,
          seek: som.totalDuration * decorrido / janela });
      }
      if (tocando) {
        som.setPan(pan);
        grupo.set(som, volume);
        distribuirVolume();
      }
    },
    parar,
    destruir() {
      if (destruido) return;
      parar();
      som?.destroy();
      som = null;
      destruido = true;
    },
  };
}
