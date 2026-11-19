import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { obterRegiaoFrenteLanterna, ocultarLanternaAtrasCamada, ocultarLanternaAtrasSala } from "./FlashlightTileOcclusion.js";

test("a fachada do gerador fica diante da lanterna dentro e acima do gatilho real", () => {
  const map = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const area = map.layers.find(l => l.name === "trocadecamada").objects.find(o => o.name === "trocadecamada01");
  const regiao = { left: area.x, top: area.y, right: area.x + area.width, bottom: area.y + area.height };
  const scene = { regiaoTrocaCamada: regiao };
  const x = (regiao.left + regiao.right) / 2;
  assert.equal(obterRegiaoFrenteLanterna(scene, { x, y: regiao.top + 10 }), regiao);
  assert.equal(obterRegiaoFrenteLanterna(scene, { x, y: regiao.top - 80 }), regiao);
  assert.equal(obterRegiaoFrenteLanterna(scene, { x, y: regiao.bottom }), null);
  assert.equal(obterRegiaoFrenteLanterna(scene, { x: regiao.left - 1, y: regiao.top }), null);
  assert.equal(obterRegiaoFrenteLanterna(scene, { x: regiao.right, y: regiao.top }), null);
  const actor = { x: 0, y: 0, body: { x: regiao.left - 20, y: regiao.top + 20, width: 20, height: 10 } };
  assert.equal(obterRegiaoFrenteLanterna(scene, actor), null, "tocar a lateral não entra");
  actor.body.x++;
  assert.equal(obterRegiaoFrenteLanterna(scene, actor), regiao, "a entrada parcial segue a hitbox da troca de camada");
  actor.body.y = regiao.bottom;
  assert.equal(obterRegiaoFrenteLanterna(scene, actor), null);
  const remote = { x, y: regiao.bottom, coopBody: { ...actor.body, y: regiao.bottom - 1 } };
  assert.equal(obterRegiaoFrenteLanterna(scene, remote), regiao, "a réplica usa sua hitbox interpolada");
});

test("fachada restringe o culling e ainda lê a geometria e o quadro atuais", t => {
  const anterior = globalThis.Phaser;
  t.after(() => { globalThis.Phaser = anterior; });
  const tile = { index: 1, pixelX: 100, pixelY: 100, rotation: Math.PI / 4, flipX: true };
  const tileset = { tileWidth: 48, tileHeight: 48, tileOffset: { x: 10, y: 0 },
    getAnimatedTileId: (id, time) => id + time, getTileTextureCoordinates: x => ({ x, y: 0 }),
    image: { getSourceImage: () => ({}) } };
  const view = { x: 0, y: 0, right: 1200, bottom: 900 };
  const regiao = { left: 100, top: 100, right: 145, bottom: 145 };
  const layer = { scrollFactorX: 1, scrollFactorY: 1, scaleX: 1, scaleY: 1,
    gidMap: { 1: tileset }, timeElapsed: 0,
    cull() { assert.fail("a fachada usa o culling com área reduzida"); } };
  layer.cullCallback = (_, camera, saida) => {
    assert.ok(camera.worldView.right < 250 && camera.worldView.bottom < 250);
    assert.equal(saida.length, 0);
    saida.push(tile);
    return saida;
  };
  globalThis.Phaser = { Tilemaps: { Components: { CullTiles: layer.cullCallback } } };
  const scene = { map: { tilesets: [tileset] }, camadasMapaParte2: [layer] };
  const quadros = [];
  const context = { save() {}, restore() {}, transform() {}, drawImage(_, x) { quadros.push(x); } };
  ocultarLanternaAtrasSala(context, scene, { worldView: view }, regiao);
  layer.timeElapsed = 1;
  ocultarLanternaAtrasSala(context, scene, { worldView: view }, regiao);
  tile.index = -1;
  ocultarLanternaAtrasSala(context, scene, { worldView: view }, regiao);
  assert.deepEqual(quadros, [1, 2]);
  assert.deepEqual(view, { x: 0, y: 0, right: 1200, bottom: 900 });
});

test("sem gatilho ou personagem não aplica a sobreposição da sala", () => {
  assert.equal(obterRegiaoFrenteLanterna({}, { x: 0, y: 0 }), null);
  assert.equal(obterRegiaoFrenteLanterna({ regiaoTrocaCamada: {} }, null), null);
});


test("carimbo descarta só tiles que não alcançam nenhum pixel da lanterna, incluindo rotações", t => {
  const tiles = Array.from({ length: 40 }, (_, i) => ({ index: 1, pixelX: i * 48, pixelY: 0 }));
  const tileset = { tileWidth: 48, tileHeight: 48, tileOffset: { x: 0, y: 0 },
    getAnimatedTileId: id => id, getTileTextureCoordinates: () => ({ x: 0, y: 0 }),
    image: { getSourceImage: () => ({}) } };
  const layer = { gidMap: { 1: tileset }, cull: () => tiles };
  let desenhos = 0;
  const context = { save() {}, restore() {}, transform() {}, drawImage() { desenhos++; },
    canvas: { width: 96, height: 96 }, getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) };
  ocultarLanternaAtrasCamada(context, layer, {});
  assert.equal(desenhos, 3, "duas colunas e a margem de rasterização são preservadas");
  const otimizados = desenhos;
  delete context.getTransform;
  desenhos = 0;
  ocultarLanternaAtrasCamada(context, layer, {});
  assert.equal(desenhos, 40, "o caminho sem a consulta geométrica mantém o comportamento anterior");
  t.diagnostic(`tiles no carimbo: ${desenhos} → ${otimizados}, sem mudança na resolução`);
  // O centro está fora do canvas, mas a quina do tile rotacionado ainda é visível.
  tiles.splice(0, tiles.length, { index: 1, pixelX: 80, pixelY: 0, rotation: Math.PI / 4, flipX: true });
  context.getTransform = () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  desenhos = 0;
  ocultarLanternaAtrasCamada(context, layer, {});
  assert.equal(desenhos, 1);
  // Transformações da camada/câmera podem trazer um tile distante para o carimbo.
  tiles[0].pixelX = 1000;
  context.getTransform = () => ({ a: 0, b: 0.5, c: -0.5, d: 0, e: 50, f: -500 });
  desenhos = 0;
  ocultarLanternaAtrasCamada(context, layer, {});
  assert.equal(desenhos, 1);
});
