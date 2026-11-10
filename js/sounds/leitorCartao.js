const SONS = {
  passagem: ["cartao-passando", "PASSANDO_CARTAO.mp3", 0.35],
  acesso: ["cartao-acesso-concedido", "ACESSO_CONCEDIDO_CARTAO.mp3", 0.3],
};

export function carregarSonsLeitorCartao(loader) {
  for (const [chave, arquivo] of Object.values(SONS)) {
    loader.audio(chave, `sounds.mp3/SONS PARA BOTAR AINDA/${arquivo}`);
  }
}

// Recorta apenas o silêncio nas bordas; preserva velocidade e timbre originais.
function trechoAudivel(som) {
  const buffer = som.audioBuffer;
  if (!buffer?.getChannelData) return { inicio: 0, duracao: som.totalDuration };
  const canais = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  let pico = 0;
  for (const canal of canais) for (const valor of canal) pico = Math.max(pico, Math.abs(valor));
  if (!pico) return { inicio: 0, duracao: som.totalDuration };
  const audivel = i => canais.some(canal => Math.abs(canal[i]) > pico * 0.02);
  let inicio = 0, fim = buffer.length - 1;
  while (inicio < fim && !audivel(inicio)) inicio++;
  while (fim > inicio && !audivel(fim)) fim--;
  const margem = Math.ceil(buffer.sampleRate * 0.015);
  inicio = Math.max(0, inicio - margem);
  fim = Math.min(buffer.length, fim + margem + 1);
  return { inicio: inicio / buffer.sampleRate, duracao: (fim - inicio) / buffer.sampleRate };
}

export function criarSonsLeitorCartao(scene) {
  const sons = new Map();
  function parar() {
    for (const { som } of sons.values()) som.stop();
  }
  return {
    tocar(tipo, duracaoPadrao) {
      parar();
      const [chave, , volume] = SONS[tipo];
      if (!scene.cache?.audio?.exists(chave) || !scene.sound?.add) return duracaoPadrao;
      if (!sons.has(tipo)) {
        const som = scene.sound.add(chave, { volume, loop: false });
        const trecho = trechoAudivel(som);
        if (!Number.isFinite(trecho.duracao) || trecho.duracao <= 0) {
          som.destroy();
          return duracaoPadrao;
        }
        som.addMarker({ name: "efeito", start: trecho.inicio, duration: trecho.duracao });
        sons.set(tipo, { som, duracao: trecho.duracao * 1000 });
      }
      const { som, duracao } = sons.get(tipo);
      return som.play("efeito", { volume, loop: false, rate: 1 }) ? duracao : duracaoPadrao;
    },
    parar,
    destruir() {
      parar();
      for (const { som } of sons.values()) som.destroy();
      sons.clear();
    },
  };
}
