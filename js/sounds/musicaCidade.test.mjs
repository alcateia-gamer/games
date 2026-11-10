import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import { carregarMusicaCidade, iniciarMusicaCidade } from "./musicaCidade.js";

function criarCena(duracao = 98.71, adiarPlay = false) {
  const chamadas = [], marcadores = [], entradas = [];
  const eventosSom = new EventEmitter();
  const scene = { events: new EventEmitter(),
    cache: { audio: { exists: () => true } },
    sound: { add(chave, config) {
      chamadas.push(["add", chave, config]);
      return { volume: config.volume,
        totalDuration: duracao,
        addMarker: marcador => marcadores.push(marcador),
        play: (...args) => {
          chamadas.push(["play", ...args]);
          if (!adiarPlay) eventosSom.emit("play");
          return true;
        },
        stop: () => chamadas.push(["stop"]),
        destroy: () => chamadas.push(["destroy"]),
        on: (...args) => eventosSom.on(...args),
        once: (...args) => eventosSom.once(...args),
        off: (...args) => eventosSom.off(...args),
      };
    } },
    tweens: { add(config) {
      entradas.push(config);
      return { remove() { config.removida = true; } };
    } },
  };
  return { scene, chamadas, marcadores, eventosSom, entradas };
}

test("carrega a música solicitada e mantém a introdução antes do loop principal", () => {
  carregarMusicaCidade({ audio(chave, caminho) {
    assert.equal(chave, "musica-cidade");
    assert.equal(caminho, "sounds.mp3/SONS AMBIENETE/01 - The Street of Rage.mp3");
    assert.ok(existsSync(new URL(`../../assets/${caminho}`, import.meta.url)));
  } });
  const { scene, chamadas, marcadores, eventosSom } = criarCena();
  const controle = iniciarMusicaCidade(scene);
  assert.deepEqual(chamadas[0], ["add", "musica-cidade", { volume: 0, loop: true }]);
  assert.deepEqual(chamadas[1], ["play", "cidade-continua", { seek: -43.2, volume: 0 }]);
  const marcador = marcadores[0];
  assert.equal(marcador.start, 43.2);
  assert.ok(Math.abs(marcador.duration - 19.2) < 1e-9);
  assert.ok(marcador.start + marcador.duration < 76);
  assert.deepEqual(marcador.config, { volume: 0, loop: true });
  eventosSom.emit("complete");
  assert.equal(chamadas.filter(([tipo]) => tipo === "play").length, 1);
  assert.equal(eventosSom.listenerCount("complete"), 0, "as voltas são agendadas pelo áudio");
  controle.destruir();
});

test("sair da cidade interrompe e remove a música, sem duplicar ao retornar", () => {
  for (const evento of ["shutdown", "destroy"]) {
    const { scene, chamadas, entradas } = criarCena();
    const primeiro = iniciarMusicaCidade(scene);
    assert.equal(iniciarMusicaCidade(scene), primeiro);
    assert.equal(chamadas.filter(([tipo]) => tipo === "add").length, 1);
    scene.events.emit(evento);
    assert.equal(entradas[0].removida, true, "sair durante a entrada cancela a subida do volume");
    assert.deepEqual(chamadas.slice(-2), [["stop"], ["destroy"]]);
    const quantidade = chamadas.length;
    primeiro.destruir();
    assert.equal(chamadas.length, quantidade);
    assert.equal(scene.events.listenerCount("shutdown"), 0);
    assert.equal(scene.events.listenerCount("destroy"), 0);
    const retorno = iniciarMusicaCidade(scene);
    assert.notEqual(retorno, primeiro);
    assert.equal(chamadas.filter(([tipo]) => tipo === "add").length, 2);
    retorno.destruir();
  }
});

test("cache ausente não inicia som e durações curtas usam um loop válido", () => {
  const ausente = criarCena();
  ausente.scene.cache.audio.exists = () => false;
  assert.equal(iniciarMusicaCidade(ausente.scene), null);
  assert.equal(ausente.chamadas.length, 0);
  const curta = criarCena(2);
  const controle = iniciarMusicaCidade(curta.scene);
  assert.equal(curta.marcadores.length, 0);
  assert.deepEqual(curta.chamadas[1], ["play", { volume: 0, loop: true }]);
  controle.destruir();
});

test("HTML Audio espera o play, fica meio segundo em silêncio e sobe gradualmente até 6%", () => {
  const bundle = readFileSync(new URL("../libs/phaser.min.js", import.meta.url), "utf8");
  const contexto = { module: { exports: {} }, exports: {}, importScripts() {}, window: {}, navigator: {} };
  vm.runInNewContext(bundle.replace("i(85454)})());", "i})());"), contexto);
  const TweenManager = contexto.module.exports(40382);
  const manager = new TweenManager({ sys: { events: new EventEmitter() } });
  const { scene, entradas, eventosSom } = criarCena(98.71, true);
  const controle = iniciarMusicaCidade(scene);
  assert.equal(entradas.length, 0, "áudio bloqueado não deve consumir a entrada de volume");
  eventosSom.emit("play");
  const entrada = entradas[0];
  const musica = entrada.targets;
  const tween = manager.add(entrada);
  assert.equal(musica.volume, 0);
  tween.update(0);
  let anterior = 0;
  for (let tempo = 0; tempo < 6600; tempo++) {
    tween.update(1);
    assert.ok(musica.volume >= anterior && musica.volume <= 0.06);
    if (tempo === 400) assert.equal(musica.volume, 0);
    if (tempo === 3500) assert.ok(musica.volume > 0.029 && musica.volume < 0.031);
    anterior = musica.volume;
  }
  assert.equal(musica.volume, 0.06);
  controle.destruir();
  manager.destroy();
});

test("WebAudioSound real começa com ganho zero mesmo se o navegador liberar o áudio mais tarde", () => {
  const bundle = readFileSync(new URL("../libs/phaser.min.js", import.meta.url), "utf8");
  const modulo = { module: { exports: {} }, exports: {}, importScripts() {}, window: {}, navigator: {} };
  vm.runInNewContext(bundle.replace("i(85454)})());", "i})());"), modulo);
  const WebAudioSound = modulo.module.exports(71741);
  const contexto = { currentTime: 0, state: "suspended" };
  function parametro() {
    let eventos = [];
    return {
      get value() {
        let anterior = { instante: 0, valor: 1 };
        for (const evento of [...eventos].sort((a, b) => a.instante - b.instante)) {
          if (evento.instante > contexto.currentTime) {
            return evento.rampa ? anterior.valor + (evento.valor - anterior.valor)
              * (contexto.currentTime - anterior.instante) / (evento.instante - anterior.instante)
              : anterior.valor;
          }
          anterior = evento;
        }
        return anterior.valor;
      },
      setValueAtTime(valor, instante) { eventos.push({ valor, instante, rampa: false }); },
      linearRampToValueAtTime(valor, instante) { eventos.push({ valor, instante, rampa: true }); },
      cancelScheduledValues(instante) { eventos = eventos.filter(e => e.instante < instante); },
    };
  }
  contexto.createGain = () => ({ gain: parametro(), connect() {}, disconnect() {} });
  contexto.createBufferSource = () => ({ playbackRate: parametro(), connect() {}, disconnect() {},
    start(...args) { this.inicio = args; }, stop() {},
  });
  const manager = { context: contexto, destination: {}, rate: 1, detune: 0,
    game: { cache: { audio: { get: () => ({ duration: 98.71 }) } } },
  };
  let musica;
  const scene = { events: new EventEmitter(), cache: { audio: { exists: () => true } },
    sound: { add(chave, config) { musica = new WebAudioSound(manager, chave, config); return musica; } },
    tweens: { add() { assert.fail("o fade Web Audio deve usar o relógio do áudio"); } },
  };
  const controle = iniciarMusicaCidade(scene);
  assert.equal(musica.volumeNode.gain.value, 0);
  assert.equal(musica.source.inicio[1], 0, "o arquivo começa na introdução");
  scene.events.emit("update", 10000, 10000);
  assert.equal(musica.volumeNode.gain.value, 0, "tempo de jogo não consome a entrada com áudio suspenso");
  contexto.state = "running";
  contexto.currentTime = 0.49;
  assert.equal(musica.volumeNode.gain.value, 0);
  contexto.currentTime = 1;
  assert.ok(musica.volumeNode.gain.value > 0 && musica.volumeNode.gain.value < 0.0015);
  contexto.currentTime = 3.5;
  assert.equal(musica.volumeNode.gain.value, 0.03);
  musica.pause();
  musica.resume();
  assert.equal(musica.volumeNode.gain.value, 0.03, "retomar não salta para o teto");
  contexto.currentTime = 6.5;
  assert.equal(musica.volumeNode.gain.value, 0.06);
  contexto.currentTime = 70;
  assert.equal(musica.volumeNode.gain.value, 0.06);
  scene.events.emit("shutdown");
  assert.equal(musica.pendingRemove, true);
  controle.destruir();
});
