import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { lerAreasGasolina, distanciaAreaGasolina, centroAreaGasolina } from "./FuelRefill.js";

test("o abastecimento lê o retângulo Gasolina real da cidade sem depender do nome do objeto", () => {
  const raw = JSON.parse(readFileSync(new URL("../../assets/map/InicioFase1 (1).json", import.meta.url)));
  const layer = raw.layers.find(l => l.name.toLowerCase() === "gasolina");
  assert.ok(layer);
  const [area] = lerAreasGasolina(raw);
  assert.equal(area.x, layer.objects[0].x);
  assert.equal(area.width, layer.objects[0].width);
  assert.equal(distanciaAreaGasolina({ x: area.x + area.width / 2, y: area.y + area.height / 2 }, area), 0);
  assert.equal(distanciaAreaGasolina({ x: area.x - 20, y: area.y }, area), 20);
});

test("aceita gasolina em qualquer caixa, camadas ocultas e retângulos rotacionados", () => {
  const [area] = lerAreasGasolina({ objects: [{ name: "gAsOlInA", visible: false,
    objects: [{ x: -100, y: -200, width: 60, height: 30, rotation: 90 }] }] });
  assert.ok(distanciaAreaGasolina({ x: -115, y: -170 }, area) < 1e-10);
  assert.ok(Math.abs(distanciaAreaGasolina({ x: -115, y: -120 }, area) - 20) < 1e-10);
  const centro = centroAreaGasolina(area);
  assert.ok(Math.abs(centro.x + 115) < 1e-10 && Math.abs(centro.y + 170) < 1e-10);
});

test("ignora formas inválidas e funciona em mapas sem posto", () => {
  const rect = { x: 0, y: 0, width: 10, height: 10 };
  assert.equal(lerAreasGasolina({ layers: [{ name: "gasolina", objects: [rect,
    { ...rect, point: true }, { ...rect, ellipse: true }, { ...rect, gid: 2 },
    { ...rect, visible: false }, { ...rect, width: 0 }, { ...rect, rotation: NaN }] }] }).length, 1);
  assert.deepEqual(lerAreasGasolina(null), []);
});
