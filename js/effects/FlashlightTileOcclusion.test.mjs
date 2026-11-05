import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { obterRegiaoFrenteLanterna } from "./FlashlightTileOcclusion.js";

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
});

test("sem gatilho ou personagem não aplica a sobreposição da sala", () => {
  assert.equal(obterRegiaoFrenteLanterna({}, { x: 0, y: 0 }), null);
  assert.equal(obterRegiaoFrenteLanterna({ regiaoTrocaCamada: {} }, null), null);
});
