import assert from "node:assert/strict";
import test from "node:test";

import { atualizarDepthComputadoresPcAdm } from "./ProfundidadeMapa.js";

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
