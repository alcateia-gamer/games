import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { carregarSomPortaFabrica, criarSomPortaFabrica } from "./portaFabrica.js";

function cena() {
  const chamadas = [], rampas = [];
  const som = {
    totalDuration: 6.7,
    manager: { context: { currentTime: 10 } },
    volumeNode: { gain: Object.fromEntries(["cancelScheduledValues", "setValueAtTime", "linearRampToValueAtTime"]
      .map(nome => [nome, (...args) => rampas.push([nome, ...args])])) },
    addMarker: marcador => chamadas.push(["marker", marcador]),
    play: (...args) => { chamadas.push(["play", ...args]); return true; },
    stop: () => chamadas.push(["stop"]),
    destroy: () => chamadas.push(["destroy"]),
  };
  return { chamadas, rampas, scene: {
    player: { x: 50, y: 50 }, cache: { audio: { exists: () => true } },
    sound: { add: () => som },
  } };
}
const area = { name: "porta01", x: 0, y: 0, width: 100, height: 100 };

test("reproduz o arquivo original inteiro, sem recortes, com aceleração suave e sem envelope", () => {
  carregarSomPortaFabrica({ audio(chave, path) {
    assert.equal(chave, "porta-fabrica");
    assert.ok(existsSync(new URL(`../../assets/${path}`, import.meta.url)));
  } });
  const { scene, chamadas, rampas } = cena();
  const controle = criarSomPortaFabrica(scene, area, true);
  controle.tocar();
  const reproducao = chamadas.find(([tipo]) => tipo === "play");
  assert.equal(reproducao.length, 2);
  assert.deepEqual(reproducao[1], { loop: false, rate: 2.28, detune: 0, volume: 0.38, seek: 0 });
  assert.equal(chamadas.some(([tipo]) => tipo === "marker"), false);
  assert.deepEqual(rampas, []);
  controle.destruir();
  assert.equal(chamadas.at(-1)[0], "destroy");
});

test("a porta instantânea toca o impacto até o final do arquivo e o par da arena tem volume reduzido", () => {
  const instantanea = cena();
  criarSomPortaFabrica(instantanea.scene, area, false).tocar();
  assert.equal(instantanea.chamadas.some(([tipo]) => tipo === "marker"), false);
  assert.equal(instantanea.chamadas.find(([tipo]) => tipo === "play")[1].seek, 5.68);
  assert.equal(instantanea.chamadas.find(([tipo]) => tipo === "play")[1].rate, 2.28);
  const persiana = cena(), arena = cena();
  criarSomPortaFabrica(persiana.scene, area, true).tocar();
  criarSomPortaFabrica(arena.scene, { ...area, name: "porta02" }, true).tocar();
  const volume = fixture => fixture.chamadas.find(([tipo]) => tipo === "play")[1].volume;
  assert.ok(volume(arena) * 2 <= volume(persiana) * 1.21);
});

test("estado recebido retoma o som no progresso correto e portas distantes ficam silenciosas", () => {
  const { scene, chamadas, rampas } = cena();
  const controle = criarSomPortaFabrica(scene, area, true);
  controle.tocar(0.5);
  assert.ok(Math.abs(chamadas.find(([tipo]) => tipo === "play")[1].seek - 3.175) < 1e-9);
  assert.deepEqual(rampas, []);
  const quantidade = chamadas.length;
  scene.player.x = 2000;
  controle.tocar();
  assert.equal(chamadas.length, quantidade);
  controle.destruir();
});
