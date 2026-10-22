/**
 * @file Testes da sobreposição de PcAdm e DepthPerso e da ordenação de personagens e robôs.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import {
  atualizarDepthComputadoresPcAdm,
  atualizarDepthObjetosDepthPerso,
} from "./ProfundidadeMapa.js";
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
    getBounds: () => ({ centerY }),
    getData: (key) => (key === "objectLayerName" ? layerName : undefined),
    setDepth(depth) {
      this.depth = depth;
    },
  };
}

test("PcAdm depth uses inverted Y and the visual centers", () => {
  const behind = criarVisual("PcAdm", 10);
  const inFront = criarVisual("PcAdm", 20);
  const otherLayer = criarVisual("ObjetosArmazem", 10);
  const scene = {
    player: {
      active: true,
      depth: 16.5,
      getBounds: () => ({ centerY: 15 }),
    },
    objetosMapaParte2: [behind, inFront, otherLayer],
  };

  atualizarDepthComputadoresPcAdm(scene);

  assert.equal(behind.depth, 16.49);
  assert.equal(inFront.depth, 16.51);
  assert.equal(otherLayer.depth, 0);
});

test("PcAdm depth update safely skips a missing player", () => {
  assert.doesNotThrow(() =>
    atualizarDepthComputadoresPcAdm({ objetosMapaParte2: [] }),
  );
});

test("DepthPerso sorts every object from the map using negative visual centers", () => {
  const map = JSON.parse(readFileSync(
    new URL("../../assets/map/parte2-fase1.json", import.meta.url), "utf8",
  ));
  const layer = map.layers.find(({ name }) => name === "DepthPerso");
  assert.ok(layer?.objects.length > 0);
  const visuals = layer.objects.map(object =>
    criarVisual(layer.name, object.y - object.height / 2),
  );
  let centerY;
  const scene = {
    player: {
      active: true, depth: 16.5,
      // Pés e origem diferentes do centro garantem que só o centro decide a ordem.
      y: 0, body: { bottom: 100 },
      getBounds: () => ({ centerY }),
    },
    objetosMapaParte2: visuals,
  };

  for (const visual of visuals) {
    const objectCenterY = visual.getBounds().centerY;
    assert.ok(objectCenterY < 0);
    centerY = objectCenterY - 1;
    atualizarDepthObjetosDepthPerso(scene);
    assert.equal(visual.depth, 16.51, "objeto à frente quando jogador está acima");
    centerY = objectCenterY + 1;
    atualizarDepthObjetosDepthPerso(scene);
    assert.equal(visual.depth, 16.49, "objeto atrás quando jogador está abaixo");
    centerY = objectCenterY;
    atualizarDepthObjetosDepthPerso(scene);
    assert.equal(visual.depth, 16.51, "empate mantém a ordem estável");
  }

  scene.player.depth = 25.5;
  centerY = 0;
  atualizarDepthObjetosDepthPerso(scene);
  for (const visual of visuals) assert.equal(visual.depth, 25.49);
});

test("DepthPerso updates objects independently and leaves other layers unchanged", () => {
  const behind = criarVisual("DepthPerso", -1300);
  const inFront = criarVisual("DepthPerso", -1200);
  const inactive = criarVisual("DepthPerso", -1300);
  inactive.active = false;
  const otherLayer = criarVisual("PcAdm", -1300);
  const scene = {
    player: {
      active: true, depth: 16.5,
      getBounds: () => ({ centerY: -1250 }),
    },
    objetosMapaParte2: [behind, inFront, inactive, otherLayer],
  };

  atualizarDepthObjetosDepthPerso(scene);

  assert.equal(behind.depth, 16.49);
  assert.equal(inFront.depth, 16.51);
  assert.equal(inactive.depth, 0);
  assert.equal(otherLayer.depth, 0);
  scene.player.active = false;
  scene.player.depth = 25.5;
  atualizarDepthObjetosDepthPerso(scene);
  assert.equal(behind.depth, 16.49);
});

test("DepthPerso safely skips a missing player or object list", () => {
  assert.doesNotThrow(() => atualizarDepthObjetosDepthPerso({}));
  assert.doesNotThrow(() => atualizarDepthObjetosDepthPerso({
    player: { active: true },
  }));
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
