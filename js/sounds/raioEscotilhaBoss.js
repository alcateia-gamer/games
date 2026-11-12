const CHAVE = "boss-raio-escotilha";
const grupos = new WeakMap();

export function carregarSomRaioEscotilhaBoss(loader) {
  loader.audio(CHAVE, "sounds.mp3/SONS PARA BOTAR AINDA/RAIO_ESCOTILHA.mp3");
}

function ajustarVolumeSuave(som, volume) {
  const gain = som.volumeNode?.gain, contexto = som.manager?.context;
  const anterior = gain?.value;
  som.setVolume(volume);
  if (gain && contexto) {
    const agora = contexto.currentTime;
    gain.cancelScheduledValues(agora);
    gain.setValueAtTime(anterior, agora);
    gain.linearRampToValueAtTime(volume, agora + 0.008);
  }
}

/** Um único loop para o conjunto de feixes, crescendo junto da energia visível. */
export function criarSomCargaEscudoBoss(scene) {
  let som = null, tocando = false, destruido = false, ultimoVolume = null;
  function parar() {
    if (!tocando) return;
    const contexto = som.manager?.context;
    if (contexto) som.volumeNode?.gain.cancelScheduledValues(contexto.currentTime);
    som.stop(); tocando = false; ultimoVolume = null;
  }
  return {
    atualizar(intensidade) {
      if (destruido) return;
      const forca = Number.isFinite(intensidade) ? Math.max(0, Math.min(1, intensidade)) : 0;
      if (forca === 0) { parar(); return; }
      if (!scene.cache?.audio?.exists(CHAVE) || !scene.sound?.add) return;
      som ??= scene.sound.add(CHAVE, { volume: 0, loop: true });
      if (!tocando) tocando = !!som.play({ volume: 0, loop: true, rate: 1, detune: 0, seek: 0 });
      const volume = 0.375 * forca;
      if (tocando && volume !== ultimoVolume) {
        ajustarVolumeSuave(som, volume);
        ultimoVolume = volume;
      }
    },
    parar,
    destruir() {
      if (destruido) return;
      parar(); som?.destroy(); som = null; destruido = true;
    },
  };
}

export function criarSomRaioEscotilhaBoss(scene, ponto) {
  let som = null, tocando = false, destruido = false, ultimoVolume = null;
  const grupo = grupos.get(scene) ?? new Set();
  grupos.set(scene, grupo);
  const fonte = { volume: 0, aplicar(volume) {
    if (!som || volume === ultimoVolume) return;
    ultimoVolume = volume;
    ajustarVolumeSuave(som, volume);
  } };
  function distribuir() {
    let total = 0;
    for (const item of grupo) total += item.volume;
    const fator = total > 0.33 ? 0.33 / total : 1;
    for (const item of grupo) item.aplicar(item.volume * fator);
  }
  function parar() {
    if (!tocando) return;
    const contexto = som.manager?.context;
    if (contexto) som.volumeNode?.gain.cancelScheduledValues(contexto.currentTime);
    som.stop();
    tocando = false;
    ultimoVolume = null;
    grupo.delete(fonte);
    distribuir();
  }
  return {
    atualizar(intensidade, ativo = true) {
      if (destruido) return;
      if (!ativo) { parar(); return; }
      const camera = scene.cameras?.main;
      const ouvinte = scene.cenaEntradaBossAtiva && camera?.midPoint ? camera.midPoint
        : scene.player?.body?.center ?? scene.player;
      const dx = ponto.x - (ouvinte?.x ?? ponto.x);
      const distancia = Math.hypot(dx, ponto.y - (ouvinte?.y ?? ponto.y));
      if (distancia >= 650) { parar(); return; }
      const forca = Number.isFinite(intensidade) ? Math.max(0, Math.min(1, intensidade)) : 0;
      // Não cria uma voz para torres paradas em quadros sem faíscas.
      if (!tocando && forca === 0) return;
      if (!scene.cache?.audio?.exists(CHAVE) || !scene.sound?.add) return;
      som ??= scene.sound.add(CHAVE, { volume: 0, loop: true });
      const pan = Math.max(-0.6, Math.min(0.6, dx / 450));
      if (!tocando) {
        // Desloca a fase entre torres para não somar quatro cópias idênticas.
        const seek = Number.isFinite(som.totalDuration) && som.totalDuration > 0
          ? (Math.abs(ponto.id ?? ponto.x) * 0.113) % som.totalDuration : 0;
        tocando = !!som.play({ volume: 0, loop: true, rate: 1, detune: 0, seek, pan });
      }
      if (!tocando) return;
      som.setPan(pan);
      fonte.volume = 0.27 * forca * (1 - distancia / 650) ** 2;
      grupo.add(fonte);
      distribuir();
    },
    parar,
    destruir() {
      if (destruido) return;
      parar(); som?.destroy(); som = null; destruido = true;
    },
  };
}
