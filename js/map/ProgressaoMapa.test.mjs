import test from "node:test";
import assert from "node:assert/strict";
import { descarregarCidade, descarregarFabricaParaBoss } from "./ProgressaoMapa.js";

function objeto(y, extra = {}) {
  return { y, active: true, setVisible(visible) { this.visible = visible; }, setActive(active) { this.active = active; }, destroy() { this.active = false; }, ...extra };
}
function criarCena() {
  const removidos = [];
  const tiles = [{ x: 0, y: -5808 }, { x: 0, y: -5232 }, { x: 0, y: -5184 }];
  const layer = {
    forEachTile(fn) { tiles.forEach(fn); }, tileToWorldY(y) { return y; },
    removeTileAt(x, y, replaceWithNull) {
      assert.equal(replaceWithNull, true, "libera o tile em vez de criar outro tile vazio");
      removidos.push(y);
    },
  };
  const paredes = [objeto(-5800, { body: { top: -5810 } }), objeto(-1500, { body: { top: -1510 } })];
  const entradas = ["porta02", "porta03"].map((nome, i) => ({ nome,
    area: { x: -1248 + i * 192, y: -5328, width: 144, height: 96 },
    estado: "aberta", fecharParaBoss() { this.bloqueadaPorBoss = true; },
  }));
  const cidade = { map: { destroy() { cidade.destruida = true; } } };
  const scene = {
    player: { active: true, x: -1080, y: -5400, body: { bottom: -5370 } },
    novoBoss: { config: { arena: { xMin: -1621, xMax: -537, yMin: -6144, yMax: -5394, entradaY: -5470,
      zonas: [{ x: -1634, y: -6344, width: 1106, height: 1016, cos: 1, sin: 0 }] } } },
    portasFabrica: entradas,
    map: { layers: [{ tilemapLayer: layer }] },
    cache: { tilemap: { remove(key) { removidos.push(key); } } },
    scene: { get() { return cidade; }, isActive() { return false; } },
    inimigos: [], objetosMapaParte2: [objeto(-5800), objeto(-1000)],
    itensColetaveis: [-5800, -1000].map(y => objeto(y, { image: objeto(y) })),
    collisionGroup: { getChildren() { return paredes; }, create(x, y) {
      scene.barreira = { x, y, setDisplaySize() { return this; }, setVisible() { return this; }, refreshBody() { return this; } };
      return scene.barreira;
    } },
    spawnAreasRoboBola: { destruir() { scene.spawnEncerrado = true; } },
    removerInteracaoGerador() { scene.geradorEncerrado = true; },
  };
  return { scene, removidos, paredes, cidade };
}

test("ligar o gerador libera o mapa da cidade somente uma vez", () => {
  const { scene, removidos, cidade } = criarCena();
  descarregarCidade(scene);
  descarregarCidade(scene);
  assert.deepEqual(removidos, ["mapa"]);
  assert.equal(scene.cidadeDescarregada, true);
  assert.equal(cidade.map, null);
  assert.equal(cidade.destruida, true);
});

test("o início da cutscene descarrega a fábrica e preserva arena, sala final e colisões", () => {
  const { scene, removidos, paredes } = criarCena();
  descarregarFabricaParaBoss(scene);
  assert.equal(scene.fabricaDescarregada, true);
  assert.deepEqual(removidos, [-5184, "mapaParte2"]);
  assert.deepEqual(scene.objetosMapaParte2.map(o => o.y), [-5800]);
  assert.deepEqual(scene.itensColetaveis.map(o => o.y), [-5800]);
  assert.equal(paredes[0].active, true);
  assert.equal(paredes[1].active, false);
  assert.ok(scene.portasFabrica.every(p => p.bloqueadaPorBoss));
  assert.equal(scene.spawnEncerrado, true);
  assert.equal(scene.geradorEncerrado, true);
  assert.ok(scene.barreira);
  descarregarFabricaParaBoss(scene);
  assert.equal(removidos.length, 2);
});

test("a limpeza da cutscene não espera os antigos pacotes de posição dos aliados", () => {
  const { scene } = criarCena();
  scene.multiplayer = true;
  const remoto = { active: true, x: -1080, y: -5200, body: { bottom: -5180 } };
  scene.remotePlayers = new Map([["remoto", remoto]]);
  descarregarFabricaParaBoss(scene);
  assert.equal(scene.fabricaDescarregada, true);
});

test("remove robôs nascidos fora mesmo que tenham seguido o jogador até a arena", () => {
  const { scene } = criarCena();
  const invasor = objeto(-5800, { x: -1080, origemSpawn: { x: -1080, y: -2000 } });
  const invasorLateral = objeto(-5800, { x: -1080, origemSpawn: { x: 500, y: -5800 } });
  const nativo = objeto(-5800, { x: -1080, origemSpawn: { x: -1080, y: -5800 } });
  const invocado = objeto(-5800, { x: -1080, prologoEncontroId: "boss-1" });
  scene.inimigos = [invasor, invasorLateral, nativo, invocado];
  descarregarFabricaParaBoss(scene);
  assert.deepEqual(scene.inimigos, [nativo, invocado]);
  assert.equal(invasor.active, false);
  assert.equal(invasorLateral.active, false);
  assert.equal(nativo.active, true);
  assert.equal(invocado.active, true);
});
