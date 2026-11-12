import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import EmergencyLighting, { lerLuzesEmergencia, calcularPerfilNeon,
  CAMADA_LUZ_EMERGENCIA } from "./EmergencyLighting.js";

const camera = () => ({ width: 800, height: 450, matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } });
const mapa = objects => ({ getObjectLayer: name =>
  name === CAMADA_LUZ_EMERGENCIA ? { objects, visible: false } : null });
const ponto = (properties = { Neon: true }) => ({ id: 1, point: true, x: 400, y: 225, properties });
const mapaReal = () => JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));

test("mapa contém apenas os 182 neons fixos, preservando cores e orientação", () => {
  const raw = mapaReal(), layer = raw.layers.find(l => l.name === CAMADA_LUZ_EMERGENCIA);
  const antes = JSON.stringify(layer);
  const luzes = lerLuzesEmergencia({ getObjectLayer: name => raw.layers.find(l => l.name === name) });
  assert.equal(layer.objects.length, 182);
  assert.equal(luzes.length, 182);
  assert.ok(luzes.every(luz => luz.neon && luz.ligada && luz.raio === 18));
  assert.equal(luzes.filter(luz => luz.cor.phaser === 0xFF101C).length, 48);
  assert.equal(luzes.filter(luz => luz.cor.phaser === 0xFFD35A).length, 134);
  assert.equal(luzes.filter(luz => luz.fase === Math.PI / 2).length, 71);
  assert.equal(JSON.stringify(layer), antes);
});

test("pontos antigos sem Neon são ignorados, inclusive com propriedades de rotação", () => {
  const luzes = new EmergencyLighting(mapa([
    ponto({ Periodo: 2000 }), ponto({ Lateral: true, Esquerda: true }),
    ponto({ Neon: false }), ponto(),
  ]));
  assert.equal(luzes.luzes.length, 1);
  assert.ok(luzes.luzes.every(luz => luz.neon));
});

test("padrões dos IDs preservam neons reexportados; propriedades explícitas prevalecem", () => {
  const raw = mapaReal(), layer = raw.layers.find(l => l.name === CAMADA_LUZ_EMERGENCIA);
  const ler = objects => lerLuzesEmergencia({ getObjectLayer: name => name === layer.name
    ? { objects } : raw.layers.find(l => l.name === name) });
  const reexportados = layer.objects.map(({ properties, name, ...objeto }) => objeto);
  assert.deepEqual(ler(reexportados), ler(layer.objects));
  assert.equal(ler([{ ...ponto({ Neon: false }), id: 1454 }]).length, 0);
  const [editado] = ler([{ ...ponto({ Neon: true, Cor: "#00ff00", Orientacao: "Horizontal", Raio: 30 }), id: 1454 }]);
  assert.equal(editado.cor.phaser, 0x00ff00); assert.equal(editado.fase, 0); assert.equal(editado.raio, 30);
});

test("nomes de neons e propriedades raw/Phaser controlam cor, orientação, raio e intensidade", () => {
  const raw = { Neon: true, Orientacao: "Vertical", Cor: "#ffffd35a", Raio: 24, Intensidade: 0.6 };
  for (const properties of [raw, Object.entries(raw).map(([name, value]) => ({ name, value }))]) {
    const [luz] = lerLuzesEmergencia(mapa([ponto(properties)]));
    assert.equal(luz.fase, Math.PI / 2); assert.equal(luz.cor.phaser, 0xFFD35A);
    assert.equal(luz.raio, 24); assert.equal(luz.intensidade, 0.6);
  }
  const [luz] = lerLuzesEmergencia(mapa([{ ...ponto({}), name: "neon amarelo vertical" }]));
  assert.equal(luz.fase, Math.PI / 2); assert.equal(luz.cor.phaser, 0xFFD35A);
});

test("valida pontos e preserva defaults, desligamento e intensidade zero", () => {
  const [luz] = lerLuzesEmergencia(mapa([ponto({ Neon: true, Raio: "20", Intensidade: -1, Ligada: false })]));
  assert.equal(luz.raio, 18); assert.equal(luz.intensidade, 0.85); assert.equal(luz.ligada, false);
  assert.equal(lerLuzesEmergencia(mapa([ponto({ Neon: true, Intensidade: 0 })]))[0].intensidade, 0);
  assert.equal(lerLuzesEmergencia(mapa([{ ...ponto(), visible: false }]))[0].ligada, false);
  assert.deepEqual(lerLuzesEmergencia({ getObjectLayer: () => null }), []);
  const avisos = [];
  assert.deepEqual(lerLuzesEmergencia(mapa([{ ...ponto(), point: false }, { ...ponto(), x: NaN }]),
    aviso => avisos.push(aviso)), []);
  assert.equal(avisos.length, 2);
});

test("neons mantêm orientação e cache com o tempo e reagem às zonas e à câmera", () => {
  const lights = new EmergencyLighting(mapa([ponto({ Neon: true, Orientacao: "Vertical" })]));
  const cam = camera(), fontes = lights.atualizar(0, cam), revisao = lights.revisao;
  for (let time = 1; time < 5000; time += 17) {
    lights.atualizar(time, cam);
    assert.equal(fontes[0].angulo, Math.PI / 2);
    assert.equal(lights.revisao, revisao);
  }
  assert.equal(lights.atualizar(5000, cam, { fatorLuz: () => 0 }).length, 0);
  assert.equal(lights.atualizar(5001, cam).length, 1);
  cam.matrix.e = -10000;
  assert.equal(lights.atualizar(5100, cam).length, 0);
  cam.matrix.e = 0;
  assert.equal(lights.atualizar(5200, cam)[0].angulo, Math.PI / 2);
  lights.destroy();
  assert.equal(lights.luzes.length, 0); assert.equal(lights.estados.length, 0);
  assert.equal(lights.fontesVisiveis.length, 0);
});

test("perfil do neon preserva faixa emissiva, halo e limite suave", () => {
  assert.equal(calcularPerfilNeon(0, 0), 1);
  assert.ok(calcularPerfilNeon(0.05, 0) > calcularPerfilNeon(0, 0.05));
  assert.ok(calcularPerfilNeon(0.4, 0) > calcularPerfilNeon(0.8, 0));
  assert.equal(calcularPerfilNeon(1, 0), 0);
  assert.ok(calcularPerfilNeon(0.2, 0) > calcularPerfilNeon(0.2, 0, true));
});
