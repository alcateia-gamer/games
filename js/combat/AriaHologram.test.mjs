import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { criarSistemaEspeciais } from "./PlayerSpecialAbilities.js";

globalThis.Phaser = { Scenes: { Events: { SHUTDOWN: "shutdown" } } };

test("holograma usa quadros da Aria mesmo com animações locais do Magnus", () => {
  for (const [direcao, start] of Object.entries({ up: 0, left: 9, down: 18, right: 27 })) {
    const animations = new Map([[`walk-${direcao}`, { frames: [{ key: "personagem2-walk" }] }]]);
    const visual = () => {
      const obj = { active: true };
      for (const k of ["setOrigin", "setScale", "setTint", "setAlpha", "setDepth", "setStrokeStyle"]) obj[k] = () => obj;
      obj.play = key => { obj.texture = animations.get(key).frames[0].key; obj.animation = key; };
      return obj;
    };
    const s = { personagemSelecionada: "aria-kade", direcaoAtual: direcao, vida: 100,
      player: { active: true, x: 0, y: 0, depth: 10, scaleX: 1, scaleY: 1 },
      time: { now: 0 }, events: new EventEmitter(),
      add: { sprite: visual, circle: visual }, tweens: { add() {} },
      anims: { exists: key => animations.has(key), create: config => animations.set(config.key, config),
        generateFrameNumbers: (key, { start, end }) => Array.from({ length: end - start + 1 }, (_, i) => ({ key, frame: start + i })) } };
    criarSistemaEspeciais(s);
    s.events.emit("player:especial");
    const holo = s.estadoEspecial.holograma;
    assert.equal(holo.texture, "personagem3-walk");
    assert.equal(animations.get(holo.animation).frames[0].frame, start);
    assert.equal(animations.get(holo.animation).frames.length, 9);
    assert.equal(animations.get(`walk-${direcao}`).frames[0].key, "personagem2-walk");
  }
});
