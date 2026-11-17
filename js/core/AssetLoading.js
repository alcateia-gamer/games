/** Evita recarregar recursos prontos e repetir entradas na mesma fila do Phaser. */
const operacoes = new WeakMap();
const texturas = new Set(["image", "spritesheet", "atlas"]);
const caches = { audio: "audio", json: "json", tilemapTiledJSON: "tilemap" };

export function recursoDisponivel(scene, tipo, chave) {
  if (texturas.has(tipo)) return scene.textures.exists(chave);
  if (tipo === "audio") {
    const game = scene.game ?? scene.sys?.game ?? scene.load?.systems?.game;
    const audio = game?.device?.audio;
    // Mesma regra do AudioFile do Phaser: áudio desativado/indisponível não bloqueia a fase.
    if (game?.config?.audio?.noAudio || audio && !audio.webAudio && !audio.audioData) return true;
  }
  const cache = scene.cache?.[caches[tipo]];
  return cache?.exists?.(chave) ?? cache?.has?.(chave) ?? false;
}

// Buffer PCM é somente leitura para os consumidores; instâncias de som continuam independentes.
// HTML Audio mantém seu carregamento normal, sem compartilhar tags mutáveis.
const aliasesAudio = { "boss-disparo-laser": ["tiro-laser", "sounds.mp3/tiro_laser.mp3"] };

export function criarCarregadorCacheavel(scene) {
  const loader = scene.load;
  const anterior = operacoes.get(loader);
  if (anterior) return anterior.proxy;
  const pendentes = new Set();
  const limpar = () => {
    pendentes.clear();
    loader.off("complete", limpar);
    scene.events?.off("shutdown", limpar);
    operacoes.delete(loader);
  };
  loader.once("complete", limpar);
  scene.events?.once("shutdown", limpar);
  const proxy = new Proxy(loader, { get(alvo, nome) {
    if (texturas.has(nome) || Object.hasOwn(caches, nome)) return (chave, ...args) => {
      const categoria = texturas.has(nome) ? "texture" : nome;
      const id = `${categoria}:${chave}`;
      if (recursoDisponivel(scene, nome, chave) || pendentes.has(id)) return proxy;
      const alias = nome === "audio" && aliasesAudio[chave];
      const buffer = alias && args[0] === alias[1] && scene.cache.audio.get?.(alias[0]);
      if (buffer?.getChannelData) {
        scene.cache.audio.add(chave, buffer);
        return proxy;
      }
      pendentes.add(id);
      try { alvo[nome](chave, ...args); }
      catch (error) { pendentes.delete(id); throw error; }
      return proxy;
    };
    const valor = alvo[nome];
    return typeof valor === "function" ? valor.bind(alvo) : valor;
  } });
  operacoes.set(loader, { proxy });
  return proxy;
}
