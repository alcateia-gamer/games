import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { carregarSomEspecialAria, iniciarSomCloneAria, tocarSomTrocaAria } from "./ariaEspecial.js";

function preparar() {
  const sons = [];
  const scene = { player: { x: 0, y: 0 }, time: { now: 0 }, events: new EventEmitter(),
    cache: { audio: { exists: () => true } }, sound: { add(key) {
      const som = Object.assign(new EventEmitter(), { key, isPlaying: false, plays: 0, volume: 0,
        play(config) { Object.assign(this, config); this.isPlaying = true; this.plays++; return true; },
        setVolume(value) { this.volume = value; }, setPan(value) { this.pan = value; },
        stop() { this.isPlaying = false; }, destroy() { this.isPlaying = false; this.destroyed = true; } });
      if (key === "aria-clone-passos") {
        const canal = new Float32Array(1000);
        canal[500] = 1;
        som.audioBuffer = { numberOfChannels: 1, sampleRate: 1000, length: 1000,
          getChannelData: () => canal };
      }
      sons.push(som); return som;
    } } };
  const clone = Object.assign(new EventEmitter(), { active: true, x: 0, y: 0, parado: false });
  const limpar = iniciarSomCloneAria(scene, clone);
  const mover = (x, agora) => { clone.x = x; scene.time.now = agora; scene.events.emit("postupdate"); };
  return { scene, clone, sons, limpar, mover };
}

test("Aria: som a 50% nasce com o clone e passos diminuem conforme ele se afasta", () => {
  const arquivos = [];
  carregarSomEspecialAria({ audio(key, path) {
    assert.ok(existsSync(new URL(`../../assets/${path}`, import.meta.url)));
    arquivos.push(key);
  } });
  assert.deepEqual(arquivos, ["aria-especial", "aria-clone-passos"]);
  const { scene, sons, mover, limpar } = preparar();
  const [especial, passos] = sons;
  assert.equal(especial.volume, 0.5);
  assert.equal(especial.plays, 1);
  assert.equal(passos.plays, 0);
  mover(10, 16); assert.equal(passos.plays, 1, "passos começam no primeiro movimento");
  mover(20, 160); assert.equal(passos.plays, 1);
  assert.equal(passos.seek, 0.497, "pula o silêncio e começa no primeiro passo audível");
  const perto = passos.volume;
  assert.equal(perto, 0.65, "passos próximos mantêm presença sem precisar seguir o clone");
  mover(200, 170);
  assert.equal(passos.volume, perto, "volume preservado nos primeiros 225 pixels");
  scene.time.now = 180; scene.events.emit("postupdate");
  assert.equal(passos.plays, 1, "um quadro sem deslocamento não reinicia o loop");
  mover(300, 220);
  assert.ok(passos.volume < perto);
  assert.ok(passos.pan > 0, "som vem do lado do clone");
  mover(900, 280); assert.equal(passos.volume, 0);
  scene.player.x = 850; mover(920, 340);
  assert.ok(passos.volume > 0, "ouvinte que se aproxima volta a ouvir");
  assert.equal(passos.plays, 1, "movimento contínuo não reinicia o loop");
  assert.equal(especial.plays, 1);
  limpar();
});

test("passos param na parede; troca, destruição e saída liberam ambos os sons", () => {
  for (const motivo of ["parede", "destroy", "shutdown", "troca"]) {
    const { scene, clone, sons, mover, limpar } = preparar();
    mover(30, 200);
    assert.equal(sons[1].isPlaying, true);
    if (motivo === "parede") {
      clone.parado = true; scene.events.emit("postupdate");
      assert.equal(sons[1].isPlaying, false);
      limpar();
    } else if (motivo === "troca") limpar();
    else if (motivo === "destroy") clone.emit("destroy");
    else scene.events.emit("shutdown");
    assert.ok(sons.every(s => s.destroyed && !s.isPlaying));
    assert.equal(scene.events.listenerCount("postupdate"), 0);
    assert.equal(clone.listenerCount("destroy"), 0);
  }
});

test("troca da Aria toca o áudio inteiro a 2× sem ser cortada ao consumir o clone", () => {
  const { scene, clone, sons, limpar } = preparar();
  tocarSomTrocaAria(scene, { x: 200, y: 30 });
  const troca = sons[2];
  assert.equal(troca.marker, undefined, "sem marcador que corte o áudio");
  assert.equal(troca.seek, 0, "começa no início do arquivo inteiro");
  assert.equal(troca.volume, 0.5);
  assert.equal(troca.rate, 2);
  assert.equal(troca.detune, 400);
  assert.equal(troca.loop, false);
  clone.emit("destroy");
  assert.equal(troca.isPlaying, true, "destruir o clone não interrompe o novo som");
  troca.emit("complete");
  assert.equal(troca.destroyed, true);
  assert.equal(scene.events.listenerCount("shutdown"), 0);
  limpar();
});
