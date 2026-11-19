import assert from "node:assert/strict";
import test from "node:test";
import { atualizarAnimacaoCaminhada } from "./PlayerAnimations.js";
import { prepararPetNoTerminal } from "../interactions/HackingPetDock.js";
import criarAnimacoesPlayer, { criarAnimacoesPersonagensRemotos } from "../player/PlayerAnimations.js";

const texturas = {
  "kai-mercer": "walk", "magnus-force": "personagem2-walk",
  "aria-kade": "personagem3-walk", nyx: "personagem4-walk",
};

for (const [host, operador] of [
  ["kai-mercer", "magnus-force"], ["kai-mercer", "nyx"], ["magnus-force", "aria-kade"],
  ["nyx", "kai-mercer"], ["aria-kade", "magnus-force"], ["kai-mercer", "kai-mercer"],
  ["magnus-force", "kai-mercer"],
]) {
  test(`terminal cooperativo conserva ${operador} na tela de ${host}`, () => {
    const animacoes = new Map();
    const scene = {
      personagemSelecionada: host,
      anims: {
        exists: key => animacoes.has(key),
        remove: key => animacoes.delete(key),
        create: animacao => animacoes.set(animacao.key, animacao),
        generateFrameNumbers: (key, { start, end }) =>
          Array.from({ length: end - start + 1 }, (_, i) => ({ key, frame: start + i })),
      },
    };
    criarAnimacoesPlayer(scene);
    criarAnimacoesPersonagensRemotos(scene);
    const player = {
      active: true, coopPlayer: true, mapCharacter: operador, x: 0, y: 0, texture: texturas[operador],
      body: { moves: true, reset() {}, updateFromGameObject() {} },
      setVelocity() {}, setFrame(frame) { this.frame = frame; },
      anims: {
        stop() { this.isPlaying = false; },
        play(key) {
          const animacao = animacoes.get(key);
          assert.ok(animacao, key);
          this.currentAnim = animacao;
          this.isPlaying = true;
          player.texture = animacao.frames[0].key;
        },
      },
    };
    const context = { player, personagemSelecionada: operador };
    for (const concluir of [false, true]) {
      const dock = prepararPetNoTerminal(scene, context, { x: 25, y: 0 },
        { destino: { x: 50, y: 0 }, criarPet: false });
      dock.atualizar(100);
      assert.equal(player.anims.currentAnim.key, `remote-${operador}-walk-right`);
      assert.equal(player.texture, texturas[operador]);
      if (concluir) {
        for (let i = 0; i < 6; i++) dock.atualizar(100);
        assert.equal(dock.pronto, true);
        if (operador === "nyx") assert.equal(player.anims.currentAnim.key, "remote-nyx-idle-right");
        if (operador === "magnus-force") assert.equal(player.frame, 27);
      }
      dock.destruir();
      assert.equal(player.texture, texturas[operador]);
      assert.equal(player.body.moves, true);
      atualizarAnimacaoCaminhada(context, "left");
      assert.equal(player.anims.currentAnim.key, `remote-${operador}-walk-left`);
      assert.equal(player.texture, texturas[operador]);
      assert.equal(scene.personagemSelecionada, host);
    }
  });
}
