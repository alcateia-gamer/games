import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { carregarMusicaFabrica, iniciarMusicaFabrica } from "./musicaFabrica.js";

function fixture(adiarPlay = false) {
  const sons = [], entradas = [];
  const boss = { isPlaying: false, isPaused: false };
  const scene = { events: new EventEmitter(),
    cache: { audio: { exists: () => true } },
    sound: {
      get: key => key === "musica-novo-boss" ? boss : null,
      add(key, config) {
        const som = Object.assign(new EventEmitter(), { key, config, volume: config.volume,
          totalDuration: 167, plays: [], parado: false, destruido: false,
          play(options) { this.plays.push(options); if (!adiarPlay) this.emit("play"); return true; },
          stop() { this.parado = true; }, destroy() { this.destruido = true; },
        });
        sons.push(som); return som;
      },
    },
    tweens: { add(config) { entradas.push(config); return { remove() { config.removida = true; } }; } },
  };
  return { scene, sons, entradas, boss };
}

test("carrega a faixa da fábrica e toca o arquivo inteiro em loop, começando sem volume", () => {
  carregarMusicaFabrica({ audio(key, path) {
    assert.equal(key, "musica-fabrica");
    assert.equal(path, "sounds.mp3/SONS AMBIENETE/04. You Will Never Know.mp3");
    assert.ok(existsSync(new URL(`../../assets/${path}`, import.meta.url)));
  } });
  const { scene, sons, entradas } = fixture();
  const controle = iniciarMusicaFabrica(scene);
  assert.equal(iniciarMusicaFabrica(scene), controle);
  scene.events.emit("update");
  assert.equal(sons.length, 1);
  assert.deepEqual(sons[0].config, { volume: 0, loop: true });
  assert.deepEqual(sons[0].plays, [{ volume: 0, loop: true }]);
  assert.equal(entradas[0].delay, 500);
  assert.equal(entradas[0].duration, 6000);
  assert.equal(entradas[0].volume, 0.06);
  controle.destruir();
});
test("bloqueio de autoplay não consome a entrada gradual antes do play", () => {
  const { scene, sons, entradas } = fixture(true);
  const controle = iniciarMusicaFabrica(scene);
  scene.events.emit("update", 10000, 10000);
  assert.equal(entradas.length, 0);
  assert.equal(sons[0].volume, 0);
  sons[0].emit("play");
  assert.equal(entradas.length, 1);
  assert.equal(entradas[0].delay + entradas[0].duration, 6500);
  assert.equal(entradas[0].volume, 0.06);
  controle.destruir();
});
test("boss tem prioridade e fim da luta retorna a trilha da fábrica com nova entrada", () => {
  const { scene, sons, entradas, boss } = fixture();
  const controle = iniciarMusicaFabrica(scene);
  boss.isPlaying = true; scene.events.emit("update");
  assert.ok(sons[0].parado && sons[0].destruido && entradas[0].removida);
  scene.events.emit("update"); assert.equal(sons.length, 1);
  boss.isPlaying = false; boss.isPaused = true; scene.events.emit("update");
  assert.equal(sons.length, 1);
  boss.isPaused = false; scene.events.emit("update");
  assert.equal(sons.length, 2);
  assert.equal(sons[1].volume, 0);
  assert.equal(entradas[1].volume, 0.06);
  assert.equal(entradas[1].duration, 6000);
  controle.destruir();
});
test("morte e saída encerram a música e seus listeners; retorno não acumula sons", () => {
  const { scene, sons } = fixture();
  iniciarMusicaFabrica(scene);
  scene.morteEmAndamento = true; scene.events.emit("update");
  assert.equal(sons[0].destruido, true);
  scene.events.emit("update"); assert.equal(sons.length, 1);
  scene.events.emit("shutdown");
  for (const key of ["update", "shutdown", "destroy"]) assert.equal(scene.events.listenerCount(key), 0);
  scene.morteEmAndamento = false;
  iniciarMusicaFabrica(scene); assert.equal(sons.length, 2);
  scene.events.emit("destroy"); assert.ok(sons.every(s => s.destruido));
});
