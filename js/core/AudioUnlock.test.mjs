import test from "node:test";
import assert from "node:assert/strict";
import { registrarDesbloqueioAudio } from "./AudioUnlock.js";

function target() {
  const listeners = new Map();
  return { hidden: false, listeners,
    addEventListener(key, callback) { const set = listeners.get(key) ?? new Set(); set.add(callback); listeners.set(key, set); },
    removeEventListener(key, callback) { listeners.get(key)?.delete(callback); },
    emit(key) { return Promise.all([...(listeners.get(key) ?? [])].map(callback => callback())); },
  };
}

test("novo gesto retoma o áudio mesmo depois de uma segunda suspensão da aba", async () => {
  const window = target(), document = target();
  let unlocks = 0, resumes = 0;
  const sound = { locked: true, unlock() { unlocks++; this.locked = false; },
    context: { state: "suspended", async resume() { resumes++; this.state = "running"; } },
    resumeAll() { assert.fail("não deve retomar sons que a rede pausou"); } };
  const cleanup = registrarDesbloqueioAudio({ sound }, window, document);
  await window.emit("pointerdown");
  assert.equal(unlocks, 1); assert.equal(resumes, 1);
  sound.context.state = "suspended";
  await window.emit("pointerdown");
  assert.equal(resumes, 2, "o listener continua registrado após o primeiro clique");
  cleanup(); sound.context.state = "suspended";
  await window.emit("pointerdown"); await document.emit("visibilitychange");
  assert.equal(resumes, 2, "destruição remove todos os listeners");
});

test("voltar ao foco ou à aba tenta retomar somente o contexto visível", async () => {
  const window = target(), document = target();
  let resumes = 0;
  const game = { sound: { context: { state: "suspended", async resume() { resumes++; this.state = "running"; } } } };
  const cleanup = registrarDesbloqueioAudio(game, window, document);
  document.hidden = true; await document.emit("visibilitychange"); assert.equal(resumes, 0);
  document.hidden = false; await document.emit("visibilitychange"); assert.equal(resumes, 1);
  game.sound.context.state = "suspended"; await window.emit("focus"); assert.equal(resumes, 2);
  cleanup();
});
