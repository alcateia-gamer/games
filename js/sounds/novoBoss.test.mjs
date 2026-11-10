import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { carregarMusicaNovoBoss, prepararMusicaNovoBoss } from "./novoBoss.js";

function criarCena(duracao = 128) {
  const eventos = new EventEmitter();
  const eventosSom = new EventEmitter();
  const chamadas = [];
  const musica = {
    totalDuration: duracao,
    marcadores: [],
    volumes: [],
    on: (...args) => eventosSom.on(...args),
    off: (...args) => eventosSom.off(...args),
    addMarker(marcador) { this.marcadores.push(marcador); },
    play(...args) { chamadas.push(["play", ...args]); },
    setLoop(valor) { chamadas.push(["loop", valor]); },
    setVolume(valor) { this.volumes.push(valor); },
    stop() { chamadas.push(["stop"]); },
    destroy() { chamadas.push(["destroy"]); },
  };
  return {
    eventos,
    eventosSom,
    chamadas,
    musica,
    scene: {
      events: eventos,
      cache: { audio: { exists: () => true, get: () => ({ duration: duracao }) } },
      sound: { add: (...args) => { chamadas.push(["add", ...args]); return musica; } },
    },
  };
}

test("carrega a faixa de combate do boss a partir do diretório de músicas", () => {
  const carregados = [];
  carregarMusicaNovoBoss({ audio: (...args) => carregados.push(args) });
  assert.deepEqual(carregados, [[
    "musica-novo-boss",
    "sounds.mp3/MUSICAIS BOSS/24. Punk Croc Theme.mp3",
  ]]);
});

test("inclui a introdução e agenda o loop antes do encerramento da faixa", () => {
  const { scene, eventosSom, chamadas, musica } = criarCena();
  const encontro = {};
  const controle = prepararMusicaNovoBoss(scene, encontro);

  controle.atualizar(0.34);
  assert.equal(chamadas.some(([tipo]) => tipo === "add"), false);

  controle.atualizar(0.35);
  assert.equal(chamadas.some(([tipo]) => tipo === "add"), true);
  assert.equal(musica.volumes.at(-1), 0);

  controle.atualizar(0.675);
  assert.ok(musica.volumes.at(-1) > 0.09 && musica.volumes.at(-1) < 0.11);
  controle.atualizar(1);
  assert.equal(musica.volumes.at(-1), 0.2);
  assert.deepEqual(chamadas.find(([tipo]) => tipo === "play"), [
    "play", "boss-continuo", { volume: 0, seek: -48 },
  ]);
  assert.equal(chamadas.filter(([tipo]) => tipo === "play").length, 1,
    "o áudio deve ser agendado uma única vez");
  assert.deepEqual(musica.marcadores[0], {
    name: "boss-continuo",
    start: 48,
    duration: 160 * 60 / 172,
    config: { volume: 0, loop: true },
  });
  eventosSom.emit("complete");
  assert.equal(chamadas.filter(([tipo]) => tipo === "play").length, 1);
  assert.equal(eventosSom.listenerCount("complete"), 0);
  const marcador = musica.marcadores[0];
  assert.ok(marcador.start + marcador.duration < 110, "não toca o encerramento durante o combate");
});

test("interrompe a música na derrota e no encerramento da cena", () => {
  for (const motivo of ["derrota", "shutdown"]) {
    const { scene, eventos, eventosSom, chamadas } = criarCena();
    const encontro = {};
    const controle = prepararMusicaNovoBoss(scene, encontro);
    controle.atualizar(1);

    if (motivo === "derrota") eventos.emit("novo-boss:derrotada", { encontro });
    else eventos.emit("shutdown");

    const reproducoes = chamadas.filter(([tipo]) => tipo === "play").length;
    eventosSom.emit("complete");
    controle.atualizar(1);
    assert.equal(chamadas.filter(([tipo]) => tipo === "play").length, reproducoes);
    assert.ok(chamadas.some(([tipo]) => tipo === "stop"));
    assert.ok(chamadas.some(([tipo]) => tipo === "destroy"));
    assert.equal(eventosSom.listenerCount("complete"), 0);
    assert.equal(eventos.listenerCount("novo-boss:derrotada"), 0);
    assert.equal(eventos.listenerCount("shutdown"), 0);
  }
});

test("a derrota de outro encontro não interrompe a música", () => {
  const { scene, eventos, chamadas } = criarCena();
  const controle = prepararMusicaNovoBoss(scene, {});
  controle.atualizar(1);
  eventos.emit("novo-boss:derrotada", { encontro: {} });
  assert.equal(chamadas.some(([tipo]) => tipo === "stop"), false);
  controle.destruir();
});

test("mantém os marcadores dentro da duração disponível", () => {
  for (const duracao of [1, 10, 60]) {
    const { scene, musica, chamadas } = criarCena(duracao);
    const controle = prepararMusicaNovoBoss(scene, {});
    controle.atualizar(1);
    if (duracao <= 2) {
      assert.deepEqual(chamadas.find(([tipo]) => tipo === "play"),
        ["play", { volume: 0, loop: true, seek: 0 }]);
    } else {
      const marcador = musica.marcadores[0];
      assert.ok(marcador.start >= 0 && marcador.duration > 0);
      assert.ok(marcador.start + marcador.duration <= duracao);
    }
    controle.destruir();
  }
});
