import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import DoorLightingZones, { lerZonasLuzApagada, DURACAO_PARTIDA_ZONA, ATRASO_ENTRE_LAMPADAS } from "./DoorLightingZones.js";
import { lerLuzesFabrica } from "./FactoryLighting.js";

const mapa = objects => ({ tileWidth: 48,
  getObjectLayer: name => name === "LuzApagada" ? { objects } : null });
const zona = (id = 1, x = 0) => ({ id, x, y: 0, width: 100, height: 100 });
const porta = (nome = "a", x = 0, estado = "fechada") => ({ nome, estado,
  area: { x, y: 100, width: 100, height: 20 } });

test("as quatro zonas reais associam suas lâmpadas às portas, incluindo duas zonas para a porta05", () => {
  const raw = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const map = { tileWidth: raw.tilewidth, getObjectLayer: name => raw.layers.find(l => l.name === name) };
  const antes = JSON.stringify(raw);
  const lampadas = lerLuzesFabrica(map);
  const original = raw.layers.flatMap(l => l.objects ?? []).find(o => o.name === "porta01");
  const portas = [
    { nome: "porta01", estado: "fechada", area: original },
    { nome: "porta04", estado: "fechada", area: { x: 240, y: -1920, width: 144, height: 96 } },
    { nome: "porta05", estado: "fechada", area: { x: -480, y: -5904, width: 48, height: 144 } },
  ];
  const zonas = new DoorLightingZones(map, lampadas);
  zonas.atualizar(0, portas, true);
  assert.deepEqual(zonas.zonas.map(z => z.porta.nome), ["porta01", "porta04", "porta05", "porta05"]);
  assert.deepEqual(zonas.zonas.map(z => [...z.indices.keys()].map(l => l.id).sort()), [
    [1139, 1164], [1181],
    [1314, 1315, 1316, 1319, 1320, 1321, 1322, 1323, 1324, 1325, 1326, 1327, 1328, 1329, 1330, 1331], [],
  ]);
  assert.ok(zonas.zonas.every(z => z.opacidade === 1));
  assert.equal(JSON.stringify(raw), antes);
});

test("cada porta revela só sua zona após terminar de abrir, com partida escalonada das lâmpadas", () => {
  const perto = { x: 50, y: 90 }, longe = { x: 50, y: 20 }, outra = { x: 350, y: 50 };
  const fora = { x: 200, y: 200 };
  const zonas = new DoorLightingZones(mapa([zona(), zona(2, 300)]), [longe, perto, outra, fora]);
  const a = porta(), b = porta("b", 300);
  zonas.atualizar(0, [], true);
  assert.ok(zonas.zonas.every(z => z.porta === null && z.opacidade === 1));
  zonas.atualizar(0, [b, a], true);
  assert.equal(zonas.fatorLuz(perto, 0), 0);
  assert.equal(zonas.fatorLuz(fora, 0), 1);
  const revisao = zonas.revisao;
  zonas.atualizar(0, [b, a], true);
  assert.equal(zonas.revisao, revisao, "uma zona fechada não invalida a máscara a cada quadro");
  a.estado = "abrindo";
  zonas.atualizar(50, [b, a], true);
  assert.equal(zonas.zonas[0].opacidade, 1);
  a.estado = "aberta";
  zonas.atualizar(100, [b, a], true);
  assert.equal(zonas.fatorLuz(perto, 100), 0);
  assert.ok(zonas.fatorLuz(perto, 100 + ATRASO_ENTRE_LAMPADAS) > 0);
  assert.equal(zonas.fatorLuz(longe, 100 + ATRASO_ENTRE_LAMPADAS), 0, "a lâmpada mais próxima da porta parte primeiro");
  assert.ok(zonas.fatorLuz(perto, 100 + DURACAO_PARTIDA_ZONA * 0.13) >
    zonas.fatorLuz(perto, 100 + DURACAO_PARTIDA_ZONA * 0.18), "a partida inclui tentativas e piscadas");
  zonas.atualizar(450, [b, a], true);
  assert.equal(zonas.zonas[0].opacidade, 0);
  assert.equal(zonas.zonas[1].opacidade, 1);
  assert.equal(zonas.fatorLuz(outra, 450), 0);
  zonas.atualizar(850, [b, a], true);
  assert.equal(zonas.fatorLuz(perto, 850), 1);
  assert.equal(zonas.fatorLuz(longe, 850), 1);
});

test("ocultar a camada LuzApagada no Tiled mantém a sombra e a partida ao abrir a porta", () => {
  const layer = { visible: false, objects: [zona()] };
  const map = { tileWidth: 48, getObjectLayer: nome => nome === "LuzApagada" ? layer : null };
  const luz = { x: 50, y: 50 };
  const zonas = new DoorLightingZones(map, [luz]);
  const p = porta();
  zonas.atualizar(0, [p], true);
  assert.equal(zonas.zonas.length, 1);
  assert.equal(zonas.zonas[0].opacidade, 1);
  assert.equal(zonas.fatorLuz(luz, 0), 0);
  p.estado = "aberta";
  zonas.atualizar(100, [p], true);
  zonas.atualizar(250, [p], true);
  assert.equal(zonas.zonas[0].opacidade, 0);
  assert.ok(zonas.fatorLuz(luz, 250) > 0 && zonas.fatorLuz(luz, 250) < 1);
  assert.equal(zonas.fatorLuz(luz, 100 + DURACAO_PARTIDA_ZONA), 1);
  assert.equal(layer.visible, false, "a configuração visual do editor é preservada");
});

test("abrir sem gerador revela a sala, mas as lâmpadas esperam energia; emergência usa seu próprio circuito", () => {
  const luz = { x: 50, y: 90 }, emergencia = { x: 50, y: 50 };
  const zonas = new DoorLightingZones(mapa([zona()]), [luz], [emergencia]);
  const p = porta();
  zonas.atualizar(0, [p], false);
  p.estado = "aberta";
  zonas.atualizar(100, [p], false);
  zonas.atualizar(2500, [p], false);
  assert.equal(zonas.zonas[0].opacidade, 0);
  assert.equal(zonas.fatorLuz(luz, 2500), 0);
  assert.equal(zonas.fatorLuz(emergencia, 2500), 1);
  zonas.atualizar(3000, [p], true);
  assert.equal(zonas.fatorLuz(luz, 3000), 0, "a partida local começa quando chega a energia");
  assert.ok(zonas.fatorLuz(luz, 3400) > 0 && zonas.fatorLuz(luz, 3400) < 1);
  zonas.atualizar(3000 + DURACAO_PARTIDA_ZONA, [p], true);
  assert.equal(zonas.fatorLuz(luz, 5000), 1);
});

test("portas restauradas abertas não repetem a sombra nem a partida local", () => {
  const luz = { x: 50, y: 50 };
  const zonas = new DoorLightingZones(mapa([zona()]), [luz]);
  zonas.atualizar(0, [porta("a", 0, "aberta")], true);
  assert.equal(zonas.zonas[0].opacidade, 0);
  assert.equal(zonas.fatorLuz(luz, 0), 1);
  zonas.destroy();
  assert.equal(zonas.zonas.length, 0);
  assert.equal(zonas.normais.size, 0);
});

test("retângulos rotacionados e luzes de área usam suas coordenadas de mundo", () => {
  const luz = { x: -20, y: 10 };
  const area = { x: -40, y: 10, area: true, largura: 20, altura: 20, rotacao: 0 };
  const fora = { x: 10, y: 10 };
  const zonas = new DoorLightingZones(mapa([{ ...zona(), width: 50, rotation: 90 }]), [luz, area, fora]);
  assert.equal(zonas.fatorLuz(luz, 0), 0);
  assert.equal(zonas.fatorLuz(area, 0), 0);
  assert.equal(zonas.fatorLuz(fora, 0), 1);
  zonas.atualizar(0, [porta("longe", 1000)], true);
  assert.equal(zonas.zonas[0].porta, null, "portas distantes não liberam outra sala");
  assert.deepEqual(lerZonasLuzApagada({ getObjectLayer: () => null }), []);
  assert.deepEqual(lerZonasLuzApagada(mapa([{ ...zona(), point: true }, { ...zona(), width: 0 }])), []);
});
