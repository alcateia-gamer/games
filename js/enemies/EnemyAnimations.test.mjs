import assert from "node:assert/strict";
import test from "node:test";

import { tocarAnimacaoInimigo } from "./EnemyAnimations.js";

function criarRobo(config = {}) {
  const chamadas = [];
  const anims = {
    isPlaying: false,
    inReverse: false,
    currentAnim: null,
    play(chave, ignorarSeTocando) {
      this.iniciar(chave, ignorarSeTocando, false);
    },
    playReverse(chave, ignorarSeTocando) {
      this.iniciar(chave, ignorarSeTocando, true);
    },
    iniciar(chave, ignorarSeTocando, reverso) {
      // Reproduz a regra do Phaser: o mesmo clip é ignorado antes de trocar o modo.
      if (ignorarSeTocando && this.isPlaying && this.currentAnim?.key === chave) {
        return;
      }
      chamadas.push({ chave, reverso });
      this.currentAnim = { key: chave };
      this.isPlaying = true;
      this.inReverse = reverso;
    },
    stop() { this.isPlaying = false; },
  };
  return {
    tipoRobo: "padrao", visualAtual: "alerta", direcaoAtual: "right",
    x: 0, y: 0, alvoAtual: { x: 100, y: 0 }, iaRecuando: true,
    body: { velocity: { x: -45, y: 0 } }, anims, chamadas,
    setFrame(frame) { this.frame = frame; },
    ...config,
  };
}

test("atirador recua com passos invertidos mantendo a direção do alvo", () => {
  for (const [direcaoAtual, alvoAtual, velocity] of [
    ["right", { x: 100, y: 0 }, { x: -45, y: 0 }],
    ["left", { x: -100, y: 0 }, { x: 45, y: 0 }],
    ["down", { x: 0, y: 100 }, { x: 0, y: -45 }],
    ["up", { x: 0, y: -100 }, { x: 0, y: 45 }],
  ]) {
    const robo = criarRobo({ direcaoAtual, alvoAtual, body: { velocity } });
    tocarAnimacaoInimigo(robo);
    assert.deepEqual(robo.chamadas, [{ chave: `robo-alerta-${direcaoAtual}`, reverso: true }]);
    assert.equal(robo.direcaoAtual, direcaoAtual);
  }
});

test("desvio lateral, aproximação e repouso não invertem os passos", () => {
  for (const velocity of [{ x: 0, y: 45 }, { x: 45, y: 15 }, { x: 0, y: 0 }]) {
    const robo = criarRobo({ body: { velocity } });
    tocarAnimacaoInimigo(robo);
    assert.equal(robo.anims.inReverse, false);
  }
  const robo = criarRobo({ iaRecuando: false });
  tocarAnimacaoInimigo(robo);
  assert.equal(robo.anims.inReverse, false);
});

test("troca o sentido no mesmo clip e retoma a caminhada normal", () => {
  const robo = criarRobo({ iaRecuando: false });
  tocarAnimacaoInimigo(robo);
  robo.iaRecuando = true;
  tocarAnimacaoInimigo(robo);
  assert.equal(robo.anims.inReverse, true);
  tocarAnimacaoInimigo(robo);
  assert.equal(robo.chamadas.length, 2, "não reinicia o clip a cada atualização");
  robo.iaRecuando = false;
  tocarAnimacaoInimigo(robo);
  assert.deepEqual(robo.chamadas, [
    { chave: "robo-alerta-right", reverso: false },
    { chave: "robo-alerta-right", reverso: true },
    { chave: "robo-alerta-right", reverso: false },
  ]);
});

test("serra mantém seus frames direcionais e preserva o ataque ativo", () => {
  const robo = criarRobo({ tipoRobo: "serra", alerta: true });
  tocarAnimacaoInimigo(robo);
  assert.equal(robo.frame, 15);
  assert.deepEqual(robo.chamadas, []);
  robo.estado = "atacando";
  robo.anims.isPlaying = true;
  robo.frame = 17;
  tocarAnimacaoInimigo(robo);
  assert.equal(robo.frame, 17);
  assert.equal(robo.anims.isPlaying, true);
});
