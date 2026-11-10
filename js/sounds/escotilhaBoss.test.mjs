import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { carregarSomEscotilhaBoss, criarSomEscotilhaBoss } from "./escotilhaBoss.js";

function criarCena() {
  const sons = [];
  const scene = { player: { x: 0, y: 0 }, cache: { audio: { exists: () => true } },
    sound: { add() {
      const som = { totalDuration: 0.916, reproducoes: [], volume: 0,
        play(config) { this.reproducoes.push(config); this.tocando = true; return true; },
        setVolume(volume) { this.volume = volume; }, setPan(pan) { this.pan = pan; },
        stop() { this.tocando = false; }, destroy() { this.destruido = true; },
      };
      sons.push(som);
      return som;
    } } };
  return { scene, sons };
}

test("efeito inteiro acompanha só os quadros da tampa, incluindo a velocidade da cutscene", () => {
  carregarSomEscotilhaBoss({ audio(chave, path) {
    assert.equal(chave, "boss-escotilha");
    assert.ok(existsSync(new URL(`../../assets/${path}`, import.meta.url)));
  } });
  const { scene, sons } = criarCena();
  const controle = criarSomEscotilhaBoss(scene, { x: 0, y: 0 }, 1600);
  controle.atualizar(0, false);
  assert.equal(sons.length, 0);
  controle.atualizar(0, true, false, 1.5);
  const audio = sons[0];
  assert.equal(audio.reproducoes[0].seek, 0);
  assert.ok(Math.abs(audio.totalDuration / audio.reproducoes[0].rate - 0.6) < 1e-9);
  controle.atualizar(400, true, false, 1.5);
  assert.equal(audio.reproducoes.length, 1);
  controle.atualizar(900, true, false, 1.5);
  assert.equal(audio.tocando, false);
  controle.atualizar(1500, true, false, 1.5);
  assert.equal(audio.reproducoes.length, 1, "montar a cabeça não toca a escotilha novamente");
  controle.destruir();
});

test("descida toca quando a torre atravessa o piso e interromper/resumir preserva a posição", () => {
  const { scene, sons } = criarCena();
  const controle = criarSomEscotilhaBoss(scene, { x: 0, y: 0 }, 1600);
  controle.atualizar(600, true, true);
  assert.equal(sons.length, 0, "recolher a cabeça ainda não move a tampa");
  controle.atualizar(700, true, true);
  assert.equal(sons[0].reproducoes[0].seek, 0);
  assert.ok(Math.abs(sons[0].totalDuration / sons[0].reproducoes[0].rate - 0.9) < 1e-9);
  controle.atualizar(1000, false, true);
  assert.equal(sons[0].tocando, false);
  controle.atualizar(1000, true, true);
  assert.ok(Math.abs(sons[0].reproducoes[1].seek - 0.916 / 3) < 1e-9);
  controle.atualizar(1600, true, true);
  assert.equal(sons[0].tocando, false);
  controle.destruir();
  controle.destruir();
  controle.atualizar(700, true, true);
  assert.equal(sons.length, 1);
  assert.equal(sons[0].destruido, true);
});

test("quatro escotilhas têm atenuação contínua, estéreo e limite de volume conjunto", () => {
  const { scene, sons } = criarCena();
  const controles = [0, 50, 100, 150].map(x => criarSomEscotilhaBoss(scene, { x, y: 0 }, 1600));
  controles.forEach(controle => controle.atualizar(0, true));
  assert.ok(sons.reduce((soma, som) => soma + som.volume, 0) <= 0.612001);
  for (let i = 1; i < 4; i++) assert.ok(sons[i].volume < sons[i - 1].volume);
  const antes = sons[0].volume;
  scene.player.x = -800;
  controles.forEach(controle => controle.atualizar(200, true));
  assert.ok(sons[0].volume < antes);
  assert.ok(sons[0].pan > 0);
  controles.forEach(controle => controle.destruir());
});

test("na apresentação o ouvinte acompanha o foco da câmera", () => {
  const { scene, sons } = criarCena();
  scene.player.x = -1000;
  scene.cameras = { main: { midPoint: { x: 0, y: 0 } } };
  const controle = criarSomEscotilhaBoss(scene, { x: 0, y: 0 }, 1600);
  controle.atualizar(0, true);
  const distante = sons[0].volume;
  scene.cenaEntradaBossAtiva = true;
  controle.atualizar(100, true);
  assert.ok(sons[0].volume > distante * 5);
  assert.equal(sons[0].pan, 0);
  assert.equal(sons[0].reproducoes.length, 1, "mover a câmera ajusta volume sem reiniciar");
  controle.destruir();
});
