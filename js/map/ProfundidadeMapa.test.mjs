/**
 * @file Testes da sobreposição de PcAdm e DepthPerso e da ordenação de personagens e robôs.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  atualizarDepthComputadoresPcAdm,
  atualizarDepthObjetosDepthPerso,
  atualizarDepthParedePortaBoss,
  atualizarDepthGarras, atualizarDepthAtores, atualizarDepthCercaFabrica2,
  obterFootYAtor,
} from "./ProfundidadeMapa.js";
import { atualizarDepthCompanionPet } from "../player/CompanionPet.js";
import { atualizarDepthPlayer } from "../player/Player.js";
import { atualizarInimigoTeste } from "../enemies/EnemyTest.js";

/**
 * Cria um visual simulado com camada e centro configuráveis para testar a regra de
 * profundidade.
 */
function criarVisual(layerName, centerY) {
  return {
    active: true,
    depth: 0,
    getBounds: () => ({ centerY, bottom: centerY }),
    getData: (key) => ({ objectLayerName: layerName, worldY: centerY })[key],
    setDepth(depth) {
      this.depth = depth;
    },
  };
}

test("objetos intercalam jogador, amigo e inimigos em lados opostos pela base", () => {
  for (const layer of ["PcAdm", "DepthPerso", "Garras"]) {
    const object = criarVisual(layer, -5250);
    const scene = {
      profundidadePersonagemParte2: 16.5,
      player: criarAtor(-5300), companionPet: criarAtor(-5200),
      inimigos: [criarAtor(-5270), criarAtor(-5230, "serra")],
      objetosMapaParte2: [object],
    };
    atualizarDepthAtores(scene);
    atualizarDepthComputadoresPcAdm(scene);
    atualizarDepthObjetosDepthPerso(scene);
    atualizarDepthGarras(scene);
    assert.ok(scene.player.depth < object.depth);
    assert.ok(scene.inimigos[0].depth < object.depth);
    assert.ok(scene.companionPet.depth > object.depth);
    assert.ok(scene.inimigos[1].depth > object.depth);
    // Mover o jogador não pode inverter a relação de outro ator com o objeto.
    scene.player.body.bottom = -5100;
    atualizarDepthAtores(scene);
    atualizarDepthComputadoresPcAdm(scene);
    atualizarDepthObjetosDepthPerso(scene);
    atualizarDepthGarras(scene);
    assert.ok(scene.inimigos[0].depth < object.depth);
    assert.ok(scene.inimigos[1].depth > object.depth);
    assert.ok(scene.companionPet.depth > object.depth);
  }
});

test("DepthPerso usa as bases reais do mapa para atores de tamanhos diferentes", () => {
  const map = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const layer = map.layers.find(({ name }) => name === "DepthPerso");
  assert.ok(layer?.objects.length > 0);
  for (const object of layer.objects) {
    const visual = criarVisual(layer.name, object.y);
    const scene = { profundidadePersonagemParte2: 16.5, player: criarAtor(object.y - 1),
      companionPet: criarAtor(object.y + 1), objetosMapaParte2: [visual] };
    atualizarDepthAtores(scene);
    atualizarDepthObjetosDepthPerso(scene);
    assert.ok(scene.player.depth < visual.depth);
    assert.ok(scene.companionPet.depth > visual.depth);
    scene.player.body.bottom = object.y;
    atualizarDepthAtores(scene);
    atualizarDepthObjetosDepthPerso(scene);
    assert.ok(scene.player.depth > visual.depth, "empate usa a base do chão, sem depender da altura visual");
  }
});

test("ordenação ignora visuais inativos, outras camadas e cenas incompletas", () => {
  const inactive = criarVisual("DepthPerso", -5200);
  inactive.active = false;
  const other = criarVisual("ObjetosArmazem", -5200);
  const scene = { profundidadePersonagemParte2: 16.5,
    player: criarAtor(-5300), objetosMapaParte2: [inactive, other] };
  atualizarDepthObjetosDepthPerso(scene);
  assert.equal(inactive.depth, 0);
  assert.equal(other.depth, 0);
  for (const update of [atualizarDepthComputadoresPcAdm, atualizarDepthObjetosDepthPerso,
    atualizarDepthGarras, atualizarDepthParedePortaBoss, atualizarDepthAtores]) {
    assert.doesNotThrow(() => update({}));
  }
});

test("CercaFabrica2 ordena a camada inteira pelas duas posições Y do personagem", () => {
  const camadaCercaFabrica2 = {
    depth: 11.5,
    setDepth(depth) {
      this.depth = depth;
      this.ordens = (this.ordens ?? 0) + 1;
    },
  };
  const scene = {
    player: { y: -2205, depth: 20, body: { bottom: -2100 } },
    camadaCercaFabrica2,
  };

  atualizarDepthCercaFabrica2(scene);
  assert.ok(
    camadaCercaFabrica2.depth > scene.player.depth,
    "com y <= -2204, a camada toda da cerca fica na frente",
  );

  scene.player.y = -2190;
  scene.player.depth = 21;
  atualizarDepthCercaFabrica2(scene);
  assert.ok(
    camadaCercaFabrica2.depth > scene.player.depth,
    "entre os limites a ordenação anterior é mantida",
  );

  scene.player.y = -2177;
  scene.player.depth = 22;
  atualizarDepthCercaFabrica2(scene);
  assert.ok(
    camadaCercaFabrica2.depth < scene.player.depth,
    "com y >= -2177, o personagem fica na frente da camada toda",
  );

  scene.player.y = -2190;
  scene.player.depth = 23;
  atualizarDepthCercaFabrica2(scene);
  assert.ok(camadaCercaFabrica2.depth < scene.player.depth);

  scene.player.y = -2204;
  scene.player.depth = 24;
  atualizarDepthCercaFabrica2(scene);
  assert.ok(camadaCercaFabrica2.depth > scene.player.depth);
  assert.equal(camadaCercaFabrica2.ordens, 5, "a camada inteira recebe o depth em cada atualização");
  assert.doesNotThrow(() => atualizarDepthCercaFabrica2({}));
});

test("ParedePortaBoss mantém blocos e leitor juntos entre TODOS os atores, sem mover o mapa", () => {
  const map = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const layer = map.layers.find(layer => layer.name === "ParedePortaBoss");
  const visuais = layer.objects.map(object => ({
    active: true, x: object.x, y: object.y, depth: 0,
    getData: key => ({ objectLayerName: layer.name, worldY: object.y })[key],
    setDepth(depth) { this.depth = depth; },
  }));
  const leitor = criarVisual("Leitordecartão", -5268.875);
  const scene = { profundidadePersonagemParte2: 16.5,
    player: criarAtor(-5350), companionPet: criarAtor(-5180),
    inimigos: [criarAtor(-5300), criarAtor(-5232), criarAtor(-5200, "serra")],
    objetosMapaParte2: [...visuais, leitor] };
  atualizarDepthAtores(scene);
  atualizarDepthParedePortaBoss(scene);
  assert.equal(visuais[0].depth, visuais[1].depth);
  for (const actor of [scene.player, scene.inimigos[0]]) {
    assert.ok(actor.depth < visuais[0].depth);
    assert.ok(actor.depth < leitor.depth);
  }
  for (const actor of [scene.companionPet, ...scene.inimigos.slice(1)]) {
    assert.ok(actor.depth > leitor.depth);
  }
  assert.ok(leitor.depth > visuais[0].depth);
  scene.player.body.bottom = -5100;
  atualizarDepthAtores(scene);
  atualizarDepthParedePortaBoss(scene);
  assert.ok(scene.inimigos[0].depth < visuais[0].depth, "andar com o jogador não traz o inimigo para cima da parede");
  assert.ok(scene.companionPet.depth > leitor.depth);
  assert.deepEqual(visuais.map(({ x, y }) => [x, y]), layer.objects.map(({ x, y }) => [x, y]));
});

test("companheiro, remotos e inimigos usam o mesmo chão; profundidade fixa antiga é ignorada", () => {
  const scene = { profundidadePersonagemParte2: 16.5, player: criarAtor(-5300),
    companionPet: { ...criarAtor(-5300), getData: () => 25.5 },
    inimigos: [criarAtor(-5300)], remotePlayers: new Map([["ally", criarAtor(-5300)]]) };
  atualizarDepthPlayer(scene);
  atualizarDepthCompanionPet(scene);
  atualizarDepthAtores(scene);
  for (const actor of [scene.companionPet, ...scene.inimigos, ...scene.remotePlayers.values()]) {
    assert.equal(actor.depth, scene.player.depth);
  }
  const remote = { mapCharacter: "kai-mercer", scaleY: 1, getTopLeft: () => ({ y: -5397 }) };
  assert.equal(obterFootYAtor(remote), -5300, "margens transparentes do frame remoto não contam como pés");
  remote.remoteAttackActive = true;
  assert.equal(obterFootYAtor(remote), -5309);
});

function criarAtor(footY, tipoRobo = "padrao") {
  return {
    active: true, remoteOnly: true, tipoRobo, x: 0, y: footY - 60,
    body: { bottom: footY },
    getBounds: () => ({ bottom: footY + 100 }),
    setDepth(depth) { this.depth = depth; },
  };
}

function simularRetangulos(t) {
  const original = globalThis.Phaser;
  globalThis.Phaser = { Geom: { Rectangle: class {
    setTo(x, y, width, height) {
      Object.assign(this, { x, y, width, height });
      return this;
    }
  } } };
  t.after(() => {
    if (original === undefined) delete globalThis.Phaser;
    else globalThis.Phaser = original;
  });
}

test("city robots and player use the same physical feet and scene depth rule", t => {
  simularRetangulos(t);
  const scene = {
    player: criarAtor(-200),
    inimigos: [criarAtor(-220), criarAtor(-200, "serra"), criarAtor(-180)],
    base: 12.5,
    calcularDepthMundo(footY) { return this.base + footY * 0.0003; },
  };
  atualizarDepthPlayer(scene);
  atualizarInimigoTeste(scene, 0);
  assert.ok(scene.inimigos[0].depth < scene.player.depth);
  assert.equal(scene.inimigos[1].depth, scene.player.depth);
  assert.ok(scene.inimigos[2].depth > scene.player.depth);
  assert.equal(scene.player.depth, 12.44);
});

test("factory robots sort on the player's floor without crossing its overlay layers", t => {
  simularRetangulos(t);
  const scene = {
    profundidadePersonagemParte2: 16.5,
    player: criarAtor(-5900),
    inimigos: [criarAtor(-5920), criarAtor(-5900, "serra"), criarAtor(-5880),
      criarAtor(-100000), criarAtor(100000)],
  };
  atualizarDepthPlayer(scene);
  atualizarInimigoTeste(scene, 0);
  assert.equal(scene.player.depth, 16.5);
  assert.ok(scene.inimigos[0].depth < scene.player.depth);
  assert.equal(scene.inimigos[1].depth, scene.player.depth);
  assert.ok(scene.inimigos[2].depth > scene.player.depth);
  for (const enemy of scene.inimigos) {
    assert.ok(enemy.depth > scene.player.depth - 0.001);
    assert.ok(enemy.depth < scene.player.depth + 0.001);
  }
});

test("factory ordering follows movement and changes to the player's configured depth", t => {
  simularRetangulos(t);
  const scene = {
    profundidadePersonagemParte2: 16.5,
    player: criarAtor(-5900),
    inimigos: [criarAtor(-5890, "serra")],
  };
  atualizarDepthPlayer(scene);
  atualizarInimigoTeste(scene, 0);
  assert.ok(scene.inimigos[0].depth > scene.player.depth);
  scene.player.body.bottom = -5880;
  scene.profundidadePersonagemParte2 = 25.5;
  atualizarDepthPlayer(scene);
  // Os robôs continuam ordenados mesmo durante a animação de morte do jogador.
  scene.player.active = false;
  atualizarInimigoTeste(scene, 16);
  assert.equal(scene.player.depth, 25.5);
  assert.ok(scene.inimigos[0].depth < scene.player.depth);
  assert.ok(scene.inimigos[0].depth > 25.499);
});
