import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { criarAnimacoesInimigo, obterPoseMorteRoboSerra } from "./EnemyAnimations.js";
import { destruirInimigoTeste } from "./EnemyHealth.js";

function fixture(frame, direcaoAtual = "down") {
  const clips = new Map(), passos = [], mortos = [], plays = [], sons = [], tweensCancelados = [];
  const descartavel = () => ({ destroy() { mortos.push(this); } });
  const r = Object.assign(new EventEmitter(), {
    tipoRobo: "serra", active: true, visible: true, x: 235, y: -186,
    scaleX: 0.36, scaleY: 0.36, baseScaleX: 0.36, baseScaleY: 0.36,
    originX: 0.5, originY: 0.5, flipX: false, depth: 42, alpha: 1,
    direcaoAtual, frame: { name: frame }, body: { enable: true },
    hitboxDano: {}, estado: "atacando", combatKnockbackUntil: 400,
    debugHitboxDano: descartavel(), fundoVida: descartavel(), barraVida: descartavel(), bordaVida: descartavel(),
    somPassoRobo: { stop() { passos.push("stop"); }, destroy() { passos.push("destroy"); } },
    anims: { stop() {}, play(key) { plays.push(key); } },
    setTexture(key, frame) { this.texture = { key }; this.frame = { name: frame }; },
    setScale(x, y) { this.scaleX = x; this.scaleY = y; },
    setVelocity(x, y) { this.body.velocity = { x, y }; },
    clearTint() { this.isTinted = false; }, setAlpha(v) { this.alpha = v; },
    setVisible(v) { this.visible = v; }, setActive(v) { this.active = v; },
    destroy() { this.destroyed = true; this.emit("destroy"); },
  });
  const scene = { inimigos: [r], inimigoTeste: r,
    sound: { play: (...args) => sons.push(args) },
    anims: { exists: key => clips.has(key), create: clip => clips.set(clip.key, clip),
      generateFrameNumbers: (key, { start, end }) => Array.from({ length: end - start + 1 }, (_, i) => ({ key, frame: start + i })) },
    tweens: { killTweensOf: object => tweensCancelados.push(object), add() { assert.fail("morte da serra usa a folha, sem fade prematuro"); } },
    registry: { set() {} },
  };
  return { r, scene, clips, passos, mortos, plays, sons, tweensCancelados };
}

test("folha da morte tem 16 células inteiras de 278 × 270, com quatro fileiras direcionais", () => {
  const png = readFileSync(new URL("../../assets/PERSONAGENS/INIMIGOS PRINCIPAIS/ROBO_DE_SERRA/robo_serra_morte.png", import.meta.url));
  assert.equal(png.readUInt32BE(16), 278 * 4);
  assert.equal(png.readUInt32BE(20), 270 * 4);
  const { scene, clips } = fixture(0); criarAnimacoesInimigo(scene);
  for (const [dir, start] of [["down", 0], ["up", 4], ["left", 8], ["right", 12]]) {
    const clip = clips.get(`robo-serra-morte-${dir}`);
    assert.deepEqual(clip.frames.map(f => f.frame), [start, start + 1, start + 2, start + 3]);
    assert.ok(clip.frames.every(f => f.key === "robo-serra-morte"));
    assert.equal(clip.repeat, 0);
  }
  const quantidade = clips.size; criarAnimacoesInimigo(scene); assert.equal(clips.size, quantidade);
});
test("destruição mantém todos os quadros; serra fica mais 10% mais curta e guerra mantém seu ritmo", () => {
  const { scene, clips } = fixture(0); criarAnimacoesInimigo(scene);
  for (const dir of ["down", "up", "left", "right"]) {
    for (const [prefixo, esperado, quadros] of [["robo-morte", 330, 3], ["robo-serra-morte", 595 * 0.9, 4]]) {
      const clip = clips.get(`${prefixo}-${dir}`);
      const duracao = clip.frames.reduce((total, f) => total + (f.duration ?? 1000 / clip.frameRate), 0);
      assert.equal(clip.frames.length, quadros);
      assert.equal(duracao, esperado);
      assert.equal(clip.repeat, 0);
    }
  }
});
test("as vinte poses vivas escolhem a direção que estava visível, inclusive durante ataques", () => {
  for (let frame = 0; frame < 20; frame++) {
    const direcao = ["up", "down", "left", "right"][Math.floor(frame / 5)];
    const primeiro = { down: 0, up: 4, left: 8, right: 12 }[direcao];
    const { r, scene, plays, passos, mortos, sons } = fixture(frame, direcao === "down" ? "up" : "down");
    const antes = [r.x, r.y, r.scaleX, r.scaleY, r.originX, r.originY, r.flipX, r.depth];
    destruirInimigoTeste(scene, r);
    assert.equal(r.direcaoMorte, direcao);
    assert.equal(r.texture.key, "robo-serra-morte"); assert.equal(r.frame.name, primeiro);
    assert.deepEqual(plays, [`robo-serra-morte-${direcao}`]);
    assert.deepEqual([r.x, r.y, r.scaleX, r.scaleY, r.originX, r.originY, r.flipX, r.depth], antes);
    assert.equal(r.morto, true); assert.equal(r.body.enable, false); assert.equal(r.hitboxDano, null);
    assert.deepEqual(r.body.velocity, { x: 0, y: 0 });
    assert.equal(r.combatKnockbackUntil, 0); assert.equal(scene.inimigos.length, 0);
    assert.deepEqual(passos, ["stop", "destroy"]); assert.equal(mortos.length, 4);
    assert.equal(r.active, true, "sprite continua ativo até mostrar toda a animação");
    r.emit("animationcomplete-robo-serra-ataque-down"); assert.equal(r.destroyed, undefined);
    destruirInimigoTeste(scene, r); assert.equal(plays.length, 1);
    assert.deepEqual(sons, [["robo-explodindo", { volume: 0.13 }]], "explosão toca uma vez, no mesmo volume dos outros robôs");
    r.direcaoAtual = "right";
    r.emit(`animationcomplete-robo-serra-morte-${direcao}`);
    assert.equal(r.destroyed, true); assert.equal(r.active, false);
  }
});
test("golpe fatal cancela a deformação e restaura o tamanho normal sem mover a explosão", () => {
  const { r, scene, tweensCancelados } = fixture(12, "down");
  r.combatSquashBody = {}; r.scaleX *= 0.86; r.scaleY *= 1.12; r.isTinted = true;
  destruirInimigoTeste(scene, r);
  assert.deepEqual(tweensCancelados, [r]);
  assert.equal(r.combatSquashBody, null); assert.equal(r.isTinted, false);
  assert.equal(r.scaleX, 0.36); assert.equal(r.scaleY, 0.36);
  assert.equal(r.x, 235); assert.equal(r.y, -186);
  assert.equal(r.originX, 0.5); assert.equal(r.originY, 0.5);
});
test("preserva escala personalizada e espelhamento; pose inválida usa direção conhecida", () => {
  const { r, scene } = fixture(15);
  r.flipX = true; r.scaleX = 0.5; r.scaleY = 0.4;
  destruirInimigoTeste(scene, r);
  assert.equal(r.flipX, true); assert.equal(r.scaleX, 0.5); assert.equal(r.scaleY, 0.4);
  assert.deepEqual(obterPoseMorteRoboSerra({ frame: { name: "__BASE" }, direcaoAtual: "left" }), { direcao: "left", frame: 8 });
  assert.deepEqual(obterPoseMorteRoboSerra({ direcaoAtual: "invalida" }), { direcao: "down", frame: 0 });
});
