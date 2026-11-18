import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  concluirPartida, definirPausaRelogioSolo, formatarTempoPartida, iniciarRelogioSolo,
  reiniciarRelogioPartida, resultadoPartida, tempoPartida,
} from "./RelogioPartida.js";

test("formata minutos e segundos e acrescenta horas sem arredondar", () => {
  assert.equal(formatarTempoPartida(0), "00:00");
  assert.equal(formatarTempoPartida(3599999), "59:59");
  assert.equal(formatarTempoPartida(3600000), "01:00:00");
});

test("usa o tempo do jogo, conserva pausas sobrepostas e reinicia só em uma nova partida", () => {
  let agora = 1000;
  const registry = new Map();
  registry.remove = key => registry.delete(key);
  const game = { getTime: () => agora, events: new EventEmitter() };
  const cidade = { registry, game, events: new EventEmitter() };
  iniciarRelogioSolo(cidade);
  assert.equal(tempoPartida(cidade), 0);
  agora = 3500;
  cidade.events.emit("pause");
  definirPausaRelogioSolo(cidade, "registro", true);
  agora = 9500;
  cidade.events.emit("resume");
  agora = 11000;
  assert.equal(tempoPartida(cidade), 2500);
  definirPausaRelogioSolo(cidade, "registro", false);
  cidade.events.emit("shutdown");
  agora = 11500;
  const fabrica = { ...cidade, events: new EventEmitter() };
  iniciarRelogioSolo(fabrica);
  assert.equal(tempoPartida(fabrica), 3000);
  const resultado = concluirPartida(fabrica);
  assert.equal(resultado.tempoMs, 3000);
  assert.match(resultado.recompensa.partida, /^solo:/);
  assert.deepEqual(resultado.recompensa.participantes, ["solo"]);
  agora = 65000;
  assert.equal(concluirPartida(fabrica), null);
  assert.equal(tempoPartida(fabrica), 3000);
  assert.equal(resultadoPartida(fabrica), resultado);
  fabrica.events.emit("shutdown");
  reiniciarRelogioPartida(registry);
  iniciarRelogioSolo(cidade);
  assert.equal(tempoPartida(cidade), 0);
  assert.equal(resultadoPartida(cidade), null);
});
