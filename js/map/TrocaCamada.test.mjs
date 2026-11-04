import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { configurarTrocaCamada, atorNaRegiaoTroca } from "./TrocaCamada.js";
import { atualizarDepthAtores } from "./ProfundidadeMapa.js";

test("trocadecamada01 considera jogador e companheiro independentemente, sem reordenar o mapa", () => {
  const map = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const area = map.layers.find(l => l.name === "trocadecamada").objects.find(o => o.name === "trocadecamada01");
  const layers = [["chão", 1, true], ["Sujeira", 5, true], ["ChãoProdução", 24, false],
    ["ObjetoAbaixoParede", 6, false], ["ParedeAbaixoPerso", 8, true], ["Objetos1", 16, true]]
    .map(([name, depth, painted]) => ({ layer: { name }, depth,
      getTilesWithinWorldXY: () => painted ? [{ index: 1 }] : [],
      setDepth() { assert.fail("entrar no gatilho não deve mudar nenhuma camada do mapa"); } }));
  const actor = () => ({ active: true, x: area.x, y: area.y,
    body: { x: area.x, y: area.y, width: 22, height: 10, get bottom() { return this.y + this.height; } },
    setDepth(depth) { this.depth = depth; } });
  const scene = { profundidadePersonagemParte2: 16.5, player: actor(), companionPet: actor(),
    camadasMapaParte2: layers, map: { getObjectLayer: () => ({ objects: [area] }) } };
  configurarTrocaCamada(scene);
  for (const playerInside of [false, true]) for (const petInside of [false, true]) {
    scene.player.body.y = area.y + (playerInside ? 20 : -100);
    scene.companionPet.body.y = area.y + (petInside ? 50 : -100);
    atualizarDepthAtores(scene);
    assert.equal(atorNaRegiaoTroca(scene, scene.player), playerInside);
    assert.equal(atorNaRegiaoTroca(scene, scene.companionPet), petInside);
    assert.equal(scene.player.depth < 6, playerInside);
    assert.equal(scene.companionPet.depth < 6, petInside);
    assert.ok(scene.player.depth > 5 && scene.companionPet.depth > 5, "ninguém desaparece sob o piso");
  }
  scene.companionPet.body.x = area.x - 22;
  assert.equal(atorNaRegiaoTroca(scene, scene.companionPet), false, "só tocar a borda não entra");
  scene.companionPet.body.x += 1;
  scene.companionPet.body.y = area.y + 20;
  assert.equal(atorNaRegiaoTroca(scene, scene.companionPet), true, "entrada parcial usa a própria hitbox");
});

test("sem gatilho preserva a profundidade normal", () => {
  const scene = { map: { getObjectLayer: () => null } };
  configurarTrocaCamada(scene);
  assert.equal(scene.regiaoTrocaCamada, null);
  assert.equal(scene.profundidadeRegiaoTroca, null);
  assert.equal(atorNaRegiaoTroca(scene, { x: 0, y: 0 }), false);
});
