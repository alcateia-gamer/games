import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { carregarSomRaioEscotilhaBoss, criarSomRaioEscotilhaBoss, criarSomCargaEscudoBoss } from "./raioEscotilhaBoss.js";

function criarCena() {
  const sons = [];
  const scene = { player: { x: 0, y: 0 }, cache: { audio: { exists: () => true } },
    sound: { add() {
      const som = { totalDuration: 4, reproducoes: [],
        play(config) { this.reproducoes.push(config); this.tocando = true; return true; },
        setVolume(volume) { this.volume = volume; }, setPan(pan) { this.pan = pan; },
        stop() { this.tocando = false; }, destroy() { this.destruido = true; },
      };
      sons.push(som); return som;
    } } };
  return { scene, sons };
}

test("o feixe de carga chega a 37,5%, acompanha sua força e reutiliza um loop nas recargas", () => {
  const { scene, sons } = criarCena();
  const controle = criarSomCargaEscudoBoss(scene);
  controle.atualizar(0);
  assert.equal(sons.length, 0);
  for (let ciclo = 0; ciclo < 4; ciclo++) {
    controle.atualizar(0.2);
    assert.equal(sons[0].volume, 0.375 * 0.2);
    controle.atualizar(0.5);
    assert.equal(sons[0].volume, 0.375 * 0.5);
    controle.atualizar(1);
    assert.equal(sons[0].volume, 0.375);
    assert.equal(sons[0].reproducoes.length, ciclo + 1);
    controle.atualizar(0);
    assert.equal(sons[0].tocando, false);
  }
  assert.equal(sons.length, 1);
  assert.ok(sons[0].reproducoes.every(config => config.loop && config.rate === 1));
  controle.destruir();
  controle.atualizar(1);
  assert.equal(sons[0].destruido, true);
  assert.equal(sons[0].reproducoes.length, 4);
});

test("pulsa a gravação contínua pela intensidade visual sem reiniciar em cada faísca", () => {
  carregarSomRaioEscotilhaBoss({ audio(chave, path) {
    assert.equal(chave, "boss-raio-escotilha");
    assert.ok(existsSync(new URL(`../../assets/${path}`, import.meta.url)));
  } });
  const { scene, sons } = criarCena();
  const controle = criarSomRaioEscotilhaBoss(scene, { id: 1, x: 0, y: 0 });
  controle.atualizar(0);
  assert.equal(sons.length, 0);
  controle.atualizar(0.361);
  assert.equal(sons[0].volume, 0.27 * 0.361);
  controle.atualizar(1);
  assert.equal(sons[0].volume, 0.27);
  controle.atualizar(0);
  assert.equal(sons[0].volume, 0, "quadros sem raio silenciam o loop");
  controle.atualizar(0.78);
  assert.equal(sons[0].reproducoes.length, 1);
  assert.equal(sons[0].reproducoes[0].loop, true);
  assert.equal(sons[0].reproducoes[0].rate, 1);
  controle.atualizar(1, false);
  assert.equal(sons[0].tocando, false);
  controle.destruir();
  controle.atualizar(1);
  assert.equal(sons.length, 1);
  assert.equal(sons[0].destruido, true);
});

test("reduz volume com distância e limita as quatro vozes, mantendo fases diferentes", () => {
  const { scene, sons } = criarCena();
  const controles = [1, 2, 3, 4].map(id => criarSomRaioEscotilhaBoss(scene, { id, x: 0, y: 0 }));
  controles.forEach(controle => controle.atualizar(1));
  assert.ok(Math.abs(sons.reduce((total, som) => total + som.volume, 0) - 0.33) < 1e-9);
  assert.equal(new Set(sons.map(som => som.reproducoes[0].seek)).size, 4);
  scene.player.x = 500;
  controles.forEach(controle => controle.atualizar(1));
  assert.ok(sons.every(som => som.volume < 0.02));
  scene.player.x = 700;
  controles.forEach(controle => controle.atualizar(1));
  assert.ok(sons.every(som => !som.tocando));
  controles.forEach(controle => controle.destruir());
});

test("a câmera da cutscene permite ouvir de perto a torre apresentada", () => {
  const { scene, sons } = criarCena();
  scene.player.x = 1000;
  scene.cenaEntradaBossAtiva = true;
  scene.cameras = { main: { midPoint: { x: 0, y: 0 } } };
  const controle = criarSomRaioEscotilhaBoss(scene, { x: 0, y: 0 });
  controle.atualizar(1);
  assert.equal(sons[0].volume, 0.27);
  scene.cenaEntradaBossAtiva = false;
  controle.atualizar(1);
  assert.equal(sons[0].tocando, false);
  controle.destruir();
});
