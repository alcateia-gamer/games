import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { carregarMusicaFabrica, iniciarMusicaFabrica } from "./musicaFabrica.js";
import { desvanecerMusicaAmbiente, DURACAO_SAIDA_MUSICA_MS } from "./musicaAmbiente.js";
import { prepararMusicaNovoBoss } from "./novoBoss.js";

function fixture(adiarPlay = false) {
  const sons = [], entradas = [];
  const boss = { isPlaying: false, isPaused: false };
  const scene = { events: new EventEmitter(),
    cache: { audio: { exists: () => true } },
    sound: {
      get: key => key === "musica-novo-boss" ? boss : null,
      add(key, config) {
        const som = Object.assign(new EventEmitter(), { key, config, volume: config.volume,
          totalDuration: 195.72, plays: [], marcadores: [], parado: false, destruido: false,
          addMarker(marker) { this.marcadores.push(marker); },
          setVolume(volume) { this.volume = volume; },
          play(...options) { this.plays.push(options); if (!adiarPlay) this.emit("play"); return true; },
          stop() { this.parado = true; }, destroy() { this.destruido = true; },
        });
        sons.push(som); return som;
      },
    },
    tweens: { add(config) { entradas.push(config); return { remove() { config.removida = true; } }; } },
  };
  return { scene, sons, entradas, boss };
}

test("preserva a introdução e repete uma frase da fábrica antes do encerramento da faixa", () => {
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
  assert.deepEqual(sons[0].plays, [["fabrica-continua", { seek: -64 / 3, volume: 0 }]]);
  assert.deepEqual(sons[0].marcadores, [{ name: "fabrica-continua", start: 64 / 3,
    duration: 64 - 64 / 3, config: { volume: 0, loop: true } }]);
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

test("troca de mapa cancela a entrada e reduz o volume até zero antes da limpeza", () => {
  const { scene, sons, entradas } = fixture();
  iniciarMusicaFabrica(scene);
  const som = sons[0]; som.volume = 0.06;
  desvanecerMusicaAmbiente(scene);
  const saida = entradas.at(-1);
  assert.equal(saida.duration, DURACAO_SAIDA_MUSICA_MS);
  assert.equal(entradas[0].removida, true);
  saida.targets.progresso = 0.5; saida.onUpdate();
  assert.equal(som.volume, 0.03);
  assert.equal(som.coopMusicVolume(), 0.03, "cooperativo publica o volume da saída");
  som.emit("resume");
  assert.equal(som.volume, 0.03);
  saida.targets.progresso = 1; saida.onComplete();
  assert.equal(som.volume, 0);
  scene.events.emit("shutdown");
  assert.equal(som.destruido, true);
});

test("apresentação silencia a fábrica antes de tocar o boss e cancelamento restaura a entrada", () => {
  const { scene, sons, entradas } = fixture();
  iniciarMusicaFabrica(scene);
  sons[0].volume = 0.06;
  const boss = prepararMusicaNovoBoss(scene, {});
  boss.atualizar(0);
  boss.atualizar(0.175);
  assert.equal(sons[0].volume, 0.03);
  assert.equal(sons.length, 1, "boss aguarda a saída da fábrica");
  boss.atualizar(0.35);
  assert.equal(sons[0].volume, 0);
  assert.equal(sons.length, 2);
  boss.parar();
  assert.equal(entradas.at(-1).volume, 0.06);
  assert.equal(entradas.at(-1).removida, undefined);
  boss.destruir();
  scene.events.emit("shutdown");
});

test("morte individual no cooperativo não interrompe a trilha compartilhada", () => {
  const { scene, sons } = fixture();
  scene.coopRuntime = { host: true };
  const controle = iniciarMusicaFabrica(scene);
  scene.morteEmAndamento = true; scene.events.emit("update");
  assert.equal(sons.length, 1);
  assert.equal(sons[0].destruido, false);
  controle.destruir();
  assert.equal(sons[0].destruido, true);
});
