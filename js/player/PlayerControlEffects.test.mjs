import assert from "node:assert/strict";
import test from "node:test";
import {
  capturarJogadorNovoBoss,
  jogadorPresoNovoBoss,
  liberarJogadorNovoBoss,
  atualizarRestricaoNovoBoss,
} from "./PlayerControlEffects.js";

function criarCena(extra = {}) {
  const velocidades = [];
  const scene = {
    player: { active: true, setVelocity: (...args) => velocidades.push(args) },
    vida: 100,
    estadoDash: { ativo: true },
    novoBoss: { jogadorNaArena: true, morto: false, encerrado: false },
    ...extra,
  };
  return { scene, velocidades };
}

test("contenção cancela o dash e zera a velocidade, com duração em milissegundos", () => {
  const { scene, velocidades } = criarCena();
  assert.equal(capturarJogadorNovoBoss(scene, "tentaculo-a", 2500), true);
  assert.deepEqual(scene.restricaoControleNovoBoss, { fonte: "tentaculo-a", restanteMs: 2500 });
  assert.equal(jogadorPresoNovoBoss(scene), true);
  assert.equal(scene.estadoDash.ativo, false);
  assert.deepEqual(velocidades, [[0, 0]]);
  atualizarRestricaoNovoBoss(scene, 2499);
  assert.equal(jogadorPresoNovoBoss(scene), true);
  assert.equal(scene.restricaoControleNovoBoss.restanteMs, 1);
  atualizarRestricaoNovoBoss(scene, 1);
  assert.equal(scene.restricaoControleNovoBoss, null);
  assert.equal(jogadorPresoNovoBoss(scene), false);
});

test("cada fonte só pode liberar sua contenção e outra captura não renova o prazo", () => {
  const { scene, velocidades } = criarCena();
  capturarJogadorNovoBoss(scene, "tentaculo-a", 2500);
  atualizarRestricaoNovoBoss(scene, 1000);
  assert.equal(capturarJogadorNovoBoss(scene, "tentaculo-b", 3000), false);
  assert.deepEqual(scene.restricaoControleNovoBoss, { fonte: "tentaculo-a", restanteMs: 1500 });
  liberarJogadorNovoBoss(scene, "tentaculo-b");
  assert.equal(jogadorPresoNovoBoss(scene), true);
  assert.equal(velocidades.length, 1);
  liberarJogadorNovoBoss(scene, "tentaculo-a");
  assert.equal(scene.restricaoControleNovoBoss, null);
  liberarJogadorNovoBoss(scene, "tentaculo-a");
  assert.equal(scene.restricaoControleNovoBoss, null);
});

test("captura e liberação preservam os bloqueios de menu ou morte", () => {
  for (const bloqueio of [false, true, "inventario", undefined]) {
    const { scene } = criarCena({ movimentoBloqueado: bloqueio });
    capturarJogadorNovoBoss(scene, "tentaculo", 2500);
    assert.equal(scene.movimentoBloqueado, bloqueio);
    atualizarRestricaoNovoBoss(scene, 2500);
    assert.equal(scene.movimentoBloqueado, bloqueio);
    capturarJogadorNovoBoss(scene, "tentaculo", 2500);
    liberarJogadorNovoBoss(scene);
    assert.equal(scene.movimentoBloqueado, bloqueio);
  }
});

test("delta longo libera; deltas inválidos não alteram o tempo restante", () => {
  const { scene } = criarCena();
  capturarJogadorNovoBoss(scene, "tentaculo", 2500);
  for (const delta of [NaN, Infinity, -1, undefined]) {
    atualizarRestricaoNovoBoss(scene, delta);
    assert.equal(scene.restricaoControleNovoBoss.restanteMs, 2500);
  }
  atualizarRestricaoNovoBoss(scene, 10000);
  assert.equal(scene.restricaoControleNovoBoss, null);
  atualizarRestricaoNovoBoss(scene, 10000);
  assert.equal(jogadorPresoNovoBoss(scene), false);
});

test("morte, derrota, encerramento e saída da arena sempre devolvem o controle", () => {
  const estados = [
    scene => { scene.player.active = false; },
    scene => { scene.morteEmAndamento = true; },
    scene => { scene.vida = 0; },
    scene => { scene.novoBoss.morto = true; },
    scene => { scene.novoBoss.encerrado = true; },
    scene => { scene.novoBoss.jogadorNaArena = false; },
    scene => { scene.novoBoss = null; },
  ];
  for (const alterar of estados) {
    const { scene } = criarCena({ movimentoBloqueado: true });
    capturarJogadorNovoBoss(scene, "tentaculo", 2500);
    alterar(scene);
    atualizarRestricaoNovoBoss(scene, 0);
    assert.equal(scene.restricaoControleNovoBoss, null);
    assert.equal(jogadorPresoNovoBoss(scene), false);
    assert.equal(scene.movimentoBloqueado, true);
  }
});

test("capturas inválidas não criam restrição, cancelam dash ou alteram velocidade", () => {
  for (const [extra, duracao] of [
    [{ morteEmAndamento: true }, 2500],
    [{ vida: 0 }, 2500],
    [{ multiplayer: true }, 2500],
    [{ player: { active: false } }, 2500],
    [{ player: null }, 2500],
    [{}, 0], [{}, -1], [{}, NaN], [{}, Infinity],
  ]) {
    const { scene, velocidades } = criarCena(extra);
    assert.equal(capturarJogadorNovoBoss(scene, "tentaculo", duracao), false);
    assert.equal(scene.restricaoControleNovoBoss, undefined);
    assert.equal(scene.estadoDash.ativo, true);
    assert.deepEqual(velocidades, []);
  }
  assert.equal(capturarJogadorNovoBoss(null, "tentaculo", 2500), false);
  assert.equal(jogadorPresoNovoBoss(null), false);
  liberarJogadorNovoBoss(null);
  atualizarRestricaoNovoBoss(null, 100);
});
