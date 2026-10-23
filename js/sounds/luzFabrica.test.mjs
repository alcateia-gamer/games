import test from "node:test";
import assert from "node:assert/strict";
import { intensidadeLuzPartida, QUEDAS_LUZ_FABRICA } from "../effects/TerrorLighting.js";
import { criarSomLuzFabrica, carregarSomLuzFabrica, criarSomPiscadasAmbiente } from "./luzFabrica.js";

function criarAudioSimulado(audioBuffer, automacao = null) {
  const reproducoes = [];
  const volumes = [];
  const marcadores = new Map();
  const som = {
    totalDuration: 0.78,
    audioBuffer,
    ...(automacao ? { volumeNode: { gain: automacao }, manager: { context: { currentTime: 10 } } } : {}),
    isPlaying: false,
    destruido: false,
    addMarker(marker) { marcadores.set(marker.name, marker); },
    play(nome, config) {
      reproducoes.push({ nome, ...config });
      this.isPlaying = true;
      return true;
    },
    setVolume(volume) { volumes.push(volume); },
    stop() { this.isPlaying = false; },
    destroy() { this.destruido = true; },
  };
  const scene = {
    cache: { audio: { exists: () => true } },
    sound: { add: () => som },
  };
  return {
    som, reproducoes, volumes, marcadores,
    controle: criarSomLuzFabrica(scene, QUEDAS_LUZ_FABRICA),
  };
}

test("carrega o TZZK original", () => {
  carregarSomLuzFabrica({
    audio(chave, caminho) { assert.equal(caminho, "sounds.mp3/TZZK!.mp3"); },
  });
});

test("partida completa tem três estalos mais longos, em volume moderado e velocidade original", () => {
  const { controle, reproducoes, volumes, marcadores, som } = criarAudioSimulado();
  for (let quadro = 0; quadro <= 300; quadro += 1) {
    const progresso = quadro / 300;
    const antes = reproducoes.length;
    controle.update(progresso);
    if (reproducoes.length > antes) {
      assert.ok(intensidadeLuzPartida(progresso) > 0);
      assert.ok(intensidadeLuzPartida(progresso) < 1);
    }
  }
  assert.equal(reproducoes.length, 3);
  for (const { nome, rate, volume, loop } of reproducoes) {
    assert.equal(rate, 1);
    assert.equal(loop, false);
    assert.ok(volume >= 0 && volume <= 0.12);
    assert.ok(marcadores.get(nome).duration >= 0.5);
    assert.ok(marcadores.get(nome).duration <= 0.6);
  }
  assert.ok(volumes.some((volume) => volume > 0.08));
  assert.ok(volumes.every((volume) => volume >= 0 && volume <= 0.12));
  assert.equal(som.isPlaying, false);
});

test("antes das piscadas, nos intervalos e após estabilizar fica silencioso", () => {
  const { controle, reproducoes } = criarAudioSimulado();
  for (const progresso of [0, 0.05, 0.1299, 0.28, 0.3, 0.4, 0.6, 0.7, 0.92, 1]) {
    controle.update(progresso);
  }
  assert.equal(reproducoes.length, 0);
});

test("aguarda a queda ficar perceptível sem alterar as três durações", () => {
  const { controle, reproducoes, marcadores, som } = criarAudioSimulado();
  const inicios = [0.8, 2.42, 4.05];
  const quedas = [QUEDAS_LUZ_FABRICA[0], QUEDAS_LUZ_FABRICA[2], QUEDAS_LUZ_FABRICA.at(-1)];
  const duracoes = [0.6, 0.53, 0.51];
  for (const [indice, inicio] of inicios.entries()) {
    const queda = quedas[indice];
    controle.update(queda.inicio);
    controle.update((queda.inicio + queda.fim) / 2);
    assert.equal(reproducoes.length, indice);
    controle.update((inicio - 0.001) / 5);
    assert.equal(reproducoes.length, indice);
    controle.update((inicio + 0.02) / 5);
    assert.equal(reproducoes.length, indice + 1);
    assert.ok(Math.abs(marcadores.get(reproducoes[indice].nome).duration - duracoes[indice]) < 1e-10);
    assert.ok(intensidadeLuzPartida((inicio + 0.02) / 5) < intensidadeLuzPartida(inicio / 5));
    const intensidadeMedia = (intensidadeLuzPartida(queda.inicio) + intensidadeLuzPartida(queda.fim)) / 2;
    assert.ok(intensidadeLuzPartida(inicio / 5) < intensidadeMedia);
    if (indice > 0) assert.equal(som.isPlaying, true);
    controle.update((inicio + 0.1) / 5);
    controle.update((inicio + 0.61) / 5);
    assert.equal(som.isPlaying, false);
    if (indice < 2) {
      assert.ok(inicio + marcadores.get(reproducoes[indice].nome).duration < inicios[indice + 1]);
    }
  }
  assert.ok(marcadores.get(reproducoes[2].nome).duration < marcadores.get(reproducoes[1].nome).duration);
});

test("o contato oscila dentro dos três trechos com perfis diferentes e final mais suave", () => {
  const { controle, volumes, reproducoes } = criarAudioSimulado();
  const perfis = [];
  for (const inicio of [0.8, 2.42, 4.05]) {
    const valores = [];
    for (let t = 0.02; t <= 0.48; t += 0.01) {
      controle.update((inicio + t) / 5);
      valores.push(volumes.at(-1) ?? reproducoes.at(-1).volume);
    }
    perfis.push(valores);
  }
  for (const perfil of perfis) {
    let subidas = 0;
    let descidas = 0;
    for (let i = 1; i < perfil.length; i += 1) {
      if (perfil[i] > perfil[i - 1]) subidas += 1;
      if (perfil[i] < perfil[i - 1]) descidas += 1;
    }
    assert.ok(subidas > 5 && descidas > 5);
  }
  assert.notDeepEqual(perfis[0], perfis[1]);
  assert.notDeepEqual(perfis[1], perfis[2]);
  assert.ok(Math.max(...perfis[2]) < Math.max(...perfis[1]));
  assert.equal(reproducoes.length, 3);
});

test("Web Audio agenda transições suaves até silêncio sem depender dos quadros seguintes", () => {
  const rampas = [];
  const cancelamentos = [];
  const valores = [];
  const { controle, volumes, reproducoes } = criarAudioSimulado(undefined, {
    cancelScheduledValues(tempo) { cancelamentos.push(tempo); },
    setValueAtTime(volume, tempo) { valores.push([volume, tempo]); },
    linearRampToValueAtTime(volume, tempo) { rampas.push([volume, tempo]); },
  });
  controle.update(0.164);
  assert.equal(reproducoes.length, 1);
  assert.ok(rampas.length > 50);
  assert.ok(rampas.every(([volume]) => volume >= 0 && volume <= 0.12));
  assert.equal(rampas.at(-1)[0], 0);
  assert.ok(Math.abs(rampas.at(-1)[1] - 10.58) < 1e-10);
  assert.ok(rampas.every(([, tempo], i) => i === 0 || tempo > rampas[i - 1][1]));
  const quantidade = rampas.length;
  controle.update(0.17);
  assert.equal(rampas.length, quantidade);
  assert.equal(volumes.length, 0);
  controle.destroy();
  assert.equal(cancelamentos.length, 2);
  assert.deepEqual(valores.at(-1), [0, 10]);
});

test("atraso de quadro compensa só o início e não fica reposicionando o áudio", () => {
  const { controle, reproducoes, som } = criarAudioSimulado();
  Object.defineProperty(som, "seek", { set() { assert.fail("não deve reposicionar o som"); } });
  controle.update(2.46 / 5);
  assert.equal(reproducoes.length, 1);
  assert.ok(Math.abs(reproducoes[0].seek - 0.04) < 1e-10);
  controle.update(2.48 / 5);
  controle.update(2.5 / 5);
  assert.equal(reproducoes.length, 1);
});

test("descarta estalos já passados e não repete um trecho concluído", () => {
  const { controle, reproducoes, som } = criarAudioSimulado();
  controle.update(0.6);
  assert.equal(reproducoes.length, 0);
  controle.update(0.82);
  assert.equal(reproducoes.length, 1);
  som.isPlaying = false;
  controle.update(0.83);
  controle.update(1);
  controle.update(0.82);
  assert.equal(reproducoes.length, 1);
});

test("identifica silêncio inicial no PCM para alinhar o estalo audível", () => {
  const amostras = new Float32Array(780);
  amostras.fill(0.8, 200, 500);
  const { marcadores } = criarAudioSimulado({
    numberOfChannels: 1, sampleRate: 1000, length: 780,
    getChannelData: () => amostras,
  });
  const trechos = [...marcadores.values()];
  assert.ok(Math.abs(trechos[0].start - 0.197) < 1e-10);
  assert.notEqual(trechos[0].start, trechos[1].start);
});

test("bloqueio de áudio só permite nova tentativa durante a própria queda", () => {
  const { controle, reproducoes, som } = criarAudioSimulado();
  const play = som.play;
  som.play = () => false;
  controle.update(0.486);
  som.play = play;
  controle.update(0.49);
  assert.equal(reproducoes.length, 1);
  controle.update(1);
  assert.equal(som.isPlaying, false);
});

test("interrupção e saída da cena param e destroem o áudio", () => {
  const { controle, som } = criarAudioSimulado();
  controle.update(0.49);
  controle.stop();
  assert.equal(som.isPlaying, false);
  controle.update(0.82);
  controle.destroy();
  assert.equal(som.isPlaying, false);
  assert.equal(som.destruido, true);
});

test("sem áudio carregado mantém o controle visual utilizável", () => {
  const controle = criarSomLuzFabrica({}, QUEDAS_LUZ_FABRICA);
  controle.update(0.5);
  controle.stop();
  controle.destroy();
});


test("piscadas ambientes usam o mesmo áudio bem baixo, atenuam distância e não repetem por quadro", () => {
  const reproducoes = [];
  const volumes = [];
  let destruido = false;
  let paradas = 0;
  const som = {
    totalDuration: 0.78, addMarker() {},
    play(nome, config) { reproducoes.push({ nome, ...config }); return true; },
    setVolume(volume) { volumes.push(volume); },
    stop() { paradas++; }, destroy() { destruido = true; },
  };
  const scene = {
    time: { now: 0 }, player: { active: true, x: 0, y: 0 },
    cameras: { main: { width: 1200, height: 600,
      matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } } },
    cache: { audio: { exists: () => true } },
    sound: { add(chave) { assert.equal(chave, "luz-fabrica-oscilando"); return som; } },
  };
  const controle = criarSomPiscadasAmbiente(scene);
  controle.update([{ x: 0, y: 0 }]);
  scene.time.now = 30;
  controle.update([]);
  const perto = volumes.at(-1);
  assert.ok(perto > 0 && perto <= 0.025);
  assert.equal(reproducoes.length, 1);
  scene.time.now = 3000;
  controle.update([{ x: 450, y: 0 }]);
  scene.time.now += 30;
  controle.update([]);
  assert.ok(Math.abs(volumes.at(-1) - perto / 4) < 1e-10);
  scene.time.now = 6000;
  controle.update([{ x: 1000, y: 0 }]);
  assert.equal(reproducoes.length, 2);
  assert.ok(reproducoes.every(som => som.loop === false && som.rate === 1));
  // Fora da tela, mas perto do personagem e com halo potencialmente visível.
  controle.update([{ x: -1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 600 }]);
  assert.equal(reproducoes.length, 2);
  // Scroll e zoom devem usar a posição projetada na tela.
  scene.cameras.main.matrix = { a: 2, b: 0, c: 0, d: 2, e: 400, f: 200 };
  scene.time.now = 7000;
  controle.update([{ x: -100, y: -50 }]);
  assert.equal(reproducoes.length, 3);
  const antes = paradas;
  scene.cameras.main.matrix.e = -500;
  scene.time.now += 30;
  controle.update([]);
  assert.equal(paradas, antes + 1, "silencia quando a luminária sai do campo de visão");
  controle.update([{ x: -100, y: -50 }]);
  assert.equal(reproducoes.length, 3);
  controle.destroy();
  assert.equal(destruido, true);
});
