import { luzDentroCampoVisao } from "../effects/FactoryLighting.js";
/** Três falhas de contato acompanhando o início, o meio e o fim das piscadas. */
import { GENERATOR_LOOP_START_SECONDS } from "./gerador.js";

const CHAVE_SOM_LUZ = "luz-fabrica-oscilando";
const VOLUME_SOM_LUZ = 0.12;
// Durações aprovadas, independentes do instante em que cada queda começa.
const DURACOES_ESTALO = [0.6, 0.53, 0.51];
// O início da curva é quase imperceptível: espera 60% da queda antes do som.
const FRACAO_QUEDA_ANTES_DO_SOM = 0.6;

// Variações irregulares de contato dentro de cada reprodução, sem novos disparos.
// A primeira tenta firmar, a segunda falha com mais força e a última se dissipa.
const PERFIS_CONTATO = [
  [[0, 0.85], [0.12, 0.55], [0.24, 1], [0.37, 0.4], [0.53, 0.8], [0.67, 0.52], [0.82, 1], [1, 0.5]],
  [[0, 0.95], [0.1, 0.48], [0.22, 0.8], [0.35, 1], [0.48, 0.46], [0.61, 0.9], [0.76, 0.57], [1, 0.6]],
  [[0, 0.8], [0.18, 1], [0.3, 0.5], [0.43, 0.95], [0.62, 0.4], [0.8, 0.65], [1, 0.25]],
];

function calcularVolumeContato(estalo, decorrido) {
  const posicao = Math.max(0, Math.min(1, decorrido / estalo.duracao));
  let contato = estalo.perfil.at(-1)[1];
  for (let i = 1; i < estalo.perfil.length; i += 1) {
    const [fim, valorFim] = estalo.perfil[i];
    if (posicao > fim) continue;
    const [inicio, valorInicio] = estalo.perfil[i - 1];
    const t = (posicao - inicio) / (fim - inicio);
    contato = valorInicio + (valorFim - valorInicio) * t * t * (3 - 2 * t);
    break;
  }
  const queda = Math.max(0, Math.min(1,
    (estalo.inicio + decorrido - estalo.inicioQueda) / estalo.duracaoQueda));
  // Mais energia no meio da queda de tensão, onde a luz muda mais rapidamente.
  const tensao = 0.78 + 0.22 * 4 * queda * (1 - queda);
  const envelope = Math.max(0, Math.min(1, decorrido / 0.018, (estalo.duracao - decorrido) / 0.12));
  return estalo.volume * contato * tensao * envelope;
}

function agendarDinamica(som, estalo, decorrido) {
  const gain = som.volumeNode?.gain;
  const contexto = som.manager?.context;
  if (!gain || !contexto) return false;
  const agora = contexto.currentTime;
  gain.cancelScheduledValues(agora);
  gain.setValueAtTime(calcularVolumeContato(estalo, decorrido), agora);
  // O relógio de áudio interpola a dinâmica mesmo quando o jogo perde quadros.
  for (let t = decorrido + 0.008; t < estalo.duracao; t += 0.008) {
    gain.linearRampToValueAtTime(calcularVolumeContato(estalo, t), agora + t - decorrido);
  }
  gain.linearRampToValueAtTime(0, agora + estalo.duracao - decorrido);
  return true;
}

function carregarSomLuzFabrica(loader) {
  loader.audio(CHAVE_SOM_LUZ, "sounds.mp3/TZZK!.mp3");
}

// Descarta silêncio inicial do MP3 para o estalo audível coincidir com a queda.
// O backend HTML Audio, que não expõe PCM, usa o início do arquivo.
function encontrarInicioEstalo(buffer) {
  if (!buffer?.getChannelData) return 0;
  const canais = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i));
  let pico = 0;
  for (const canal of canais) {
    for (const amostra of canal) pico = Math.max(pico, Math.abs(amostra));
  }
  if (pico === 0) return 0;
  for (let i = 0; i < buffer.length; i += 1) {
    if (canais.some((canal) => Math.abs(canal[i]) >= pico * 0.18)) {
      return Math.max(0, i / buffer.sampleRate - 0.003);
    }
  }
  return 0;
}

function criarSomLuzFabrica(scene, quedas) {
  if (!scene.cache?.audio?.exists(CHAVE_SOM_LUZ)) {
    return { update() {}, stop() {}, destroy() {} };
  }

  const som = scene.sound.add(CHAVE_SOM_LUZ, { volume: 0, loop: false });
  const maiorQueda = Math.max(0, ...quedas.map(({ intensidade }) => intensidade));
  const inicioAudio = encontrarInicioEstalo(som.audioBuffer);
  // Distribui três trechos pela sequência inteira e aguarda a queda ficar
  // perceptível antes de disparar, sem alterar a duração dos trechos.
  const ordenadas = quedas
    .filter(({ intensidade }) => intensidade > 0)
    .sort((a, b) => a.inicio - b.inicio);
  const selecionadas = [...new Set([
    ordenadas[0],
    ordenadas[Math.floor((ordenadas.length - 1) / 2)],
    ordenadas.at(-1),
  ])].filter(Boolean);
  const estalos = selecionadas
    .map(({ inicio, fim, intensidade }, indice) => {
      const inicioSom = (inicio + (fim - inicio) * FRACAO_QUEDA_ANTES_DO_SOM)
        * GENERATOR_LOOP_START_SECONDS;
      const inicioTrecho = inicioAudio + indice * 0.025;
      const duracao = Math.min(
        DURACOES_ESTALO[indice],
        som.totalDuration - inicioTrecho,
      );
      const nome = `mau-contato-${indice}`;
      if (duracao > 0) {
        som.addMarker({ name: nome, start: inicioTrecho, duration: duracao });
      }
      return {
        nome,
        inicio: inicioSom,
        duracao,
        inicioQueda: inicio * GENERATOR_LOOP_START_SECONDS,
        duracaoQueda: (fim - inicio) * GENERATOR_LOOP_START_SECONDS,
        perfil: PERFIS_CONTATO[indice],
        volume: VOLUME_SOM_LUZ * Math.max(0.85, intensidade / maiorQueda) * (indice === 2 ? 0.9 : 1),
      };
    })
    .filter(({ duracao }) => duracao > 0);
  const reproduzidos = new Set();
  let ativo = null;
  let dinamicaAgendada = false;

  const interromper = () => {
    const contexto = som.manager?.context;
    if (som.volumeNode?.gain && contexto) {
      som.volumeNode.gain.cancelScheduledValues(contexto.currentTime);
      som.volumeNode.gain.setValueAtTime(0, contexto.currentTime);
    }
    som.stop();
    ativo = null;
    dinamicaAgendada = false;
  };

  const stop = () => {
    interromper();
    reproduzidos.clear();
  };

  return {
    update(progresso) {
      const tempo = progresso * GENERATOR_LOOP_START_SECONDS;
      if (ativo && (tempo < ativo.inicio || tempo >= ativo.inicio + ativo.duracao)) {
        interromper();
      }
      const estalo = estalos.find(({ inicio, duracao }) =>
        tempo >= inicio && tempo < inicio + duracao);
      if (!estalo) return;

      const decorrido = tempo - estalo.inicio;
      const volume = calcularVolumeContato(estalo, decorrido);
      if (!reproduzidos.has(estalo)) {
        if (som.play(estalo.nome, { seek: decorrido, rate: 1, volume, loop: false })) {
          reproduzidos.add(estalo);
          ativo = estalo;
          dinamicaAgendada = agendarDinamica(som, estalo, decorrido);
        }
      } else if (ativo === estalo && !dinamicaAgendada) {
        som.setVolume(volume);
      }
    },
    stop,
    destroy() {
      stop();
      som.destroy();
    },
  };
}

/** Estalos de fundo das falhas ocasionais, atenuados pela distância ao jogador. */
function criarSomPiscadasAmbiente(scene) {
  if (!scene.cache?.audio?.exists(CHAVE_SOM_LUZ)) {
    return { update() {}, stop() {}, destroy() {} };
  }
  const som = scene.sound.add(CHAVE_SOM_LUZ, { volume: 0, loop: false });
  const inicio = encontrarInicioEstalo(som.audioBuffer);
  const duracao = Math.min(0.51, som.totalDuration - inicio);
  if (duracao > 0) som.addMarker({ name: "piscada-distante", start: inicio, duration: duracao });
  let ativo = null;
  let agendado = false;
  const stop = () => {
    const gain = som.volumeNode?.gain;
    if (gain) {
      gain.cancelScheduledValues(som.manager.context.currentTime);
      gain.setValueAtTime(0, som.manager.context.currentTime);
    }
    som.stop();
    ativo = null;
  };
  return {
    update(luzes) {
      if (ativo) {
        const decorrido = (scene.time.now - ativo.tempo) / 1000;
        if (decorrido >= duracao || !luzDentroCampoVisao(ativo.luz, scene.cameras?.main)) stop();
        else if (!agendado) som.setVolume(calcularVolumeContato(ativo, decorrido));
      }
      const player = scene.player;
      if (!player?.active || duracao <= 0) return;
      const posicao = player.body?.center ?? player;
      for (const luz of luzes) {
        if (!luzDentroCampoVisao(luz, scene.cameras?.main)) continue;
        const distancia = Math.hypot(luz.x - posicao.x, luz.y - posicao.y);
        const proximidade = Math.max(0, 1 - distancia / 900);
        const volume = 0.025 * proximidade * proximidade;
        if (volume <= 0) continue;
        stop();
        const estalo = {
          luz, tempo: scene.time.now, inicio: 0, inicioQueda: 0, duracaoQueda: duracao,
          duracao, volume, perfil: PERFIS_CONTATO[2],
        };
        if (som.play("piscada-distante", { volume: 0, loop: false, rate: 1 })) {
          ativo = estalo;
          agendado = agendarDinamica(som, estalo, 0);
        }
      }
    },
    stop,
    destroy() { stop(); som.destroy(); },
  };
}

export { carregarSomLuzFabrica, criarSomLuzFabrica, criarSomPiscadasAmbiente };
