import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import EmergencyLighting, { lerLuzesEmergencia, calcularPerfilGiroflex, calcularPerfilNeon,
  CAMADA_LUZ_EMERGENCIA, PADROES_GIROFLEX } from "./EmergencyLighting.js";

const camera = () => ({ width: 800, height: 450, matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } });
const mapa = (objects, visible = true) => ({ getObjectLayer: name =>
  name === CAMADA_LUZ_EMERGENCIA ? { objects, visible } : null });
const ponto = (properties = {}) => ({ id: 1, point: true, x: 400, y: 225, properties });

test("lê todos os pontos reais de Luzedeemergencia sem modificar o mapa", () => {
  const raw = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const layer = raw.layers.find(l => l.name === CAMADA_LUZ_EMERGENCIA);
  const antes = JSON.stringify(layer);
  const luzes = lerLuzesEmergencia({ getObjectLayer: name => name === layer.name ? layer : null });
  assert.ok(luzes.length > 0);
  assert.equal(luzes.length, layer.objects.length);
  assert.deepEqual(luzes.map(({ id, x, y }) => ({ id, x, y })),
    layer.objects.map(({ id, x, y }) => ({ id, x, y })));
  assert.ok(luzes.every(l => l.ligada && l.periodo === PADROES_GIROFLEX.periodo));
  assert.ok(luzes.every(luz => luz.parede === null), "os giroflex restantes pertencem às outras salas");
  const neons = luzes.filter(luz => luz.neon);
  assert.equal(neons.length, 182, "cada marca do chão recebe um neon");
  assert.equal(neons.filter(luz => luz.cor.phaser === 0xFF101C).length, 48, "preserva os neons vermelhos");
  assert.equal(neons.filter(luz => luz.cor.phaser === 0xFFD35A).length, 134, "os novos pontos recebem amarelo");
  assert.ok(neons.every(luz => luz.raio === 18));
  assert.equal(neons.filter(luz => luz.fase === Math.PI / 2).length, 71);
  assert.equal(luzes.filter(luz => !luz.neon).length, 10, "preserva os giroflex existentes");
  assert.equal(JSON.stringify(layer), antes);
});

test("Lateral, Esquerda, Direita e Cima aceitam booleanos raw e Phaser e priorizam a montagem do teto", () => {
  for (const [valores, parede] of [
    [{ Lateral: true, Esquerda: true }, "esquerda"],
    [{ Lateral: true, Direita: true }, "direita"],
    [{ Lateral: true, Direita: true, Cima: true }, null],
    [{ Lateral: false, Esquerda: true }, null],
    [{ Lateral: "true", Direita: true }, null],
    [{ Lateral: true, Direita: "true" }, null],
    [{ Lateral: true, Direita: true, Esquerda: true }, null],
    [{ Lateral: true }, null],
  ]) {
    for (const properties of [valores, Object.entries(valores).map(([name, value]) => ({ name, value }))]) {
      assert.equal(lerLuzesEmergencia(mapa([ponto(properties)]))[0].parede, parede);
    }
  }
});

test("as paredes esquerda e direita varrem para cima e para baixo, sempre para o interior da sala", () => {
  const lights = new EmergencyLighting(mapa([
    ponto({ Lateral: true, Esquerda: true }), ponto({ Lateral: true, Direita: true }),
  ]));
  const cam = camera();
  const angulos = [[0, 0, Math.PI], [500, -Math.PI / 2, Math.PI * 1.5],
    [1500, Math.PI / 2, Math.PI / 2], [2000, 0, Math.PI]];
  for (const [tempo, esquerda, direita] of angulos) {
    const fontes = lights.atualizar(tempo, cam);
    assert.ok(Math.abs(fontes[0].angulo - esquerda) < 1e-12);
    assert.ok(Math.abs(fontes[1].angulo - direita) < 1e-12);
  }
  for (let tempo = 0; tempo <= 2000; tempo += 16) {
    const fontes = lights.atualizar(tempo, cam);
    assert.ok(Math.cos(fontes[0].angulo) >= -1e-12, "parede esquerda aponta para a direita");
    assert.ok(Math.cos(fontes[1].angulo) <= 1e-12, "parede direita aponta para a esquerda");
  }
  const revisao = lights.revisao;
  lights.atualizar(2000, cam);
  assert.equal(lights.revisao, revisao, "o mesmo instante reutiliza a orientação");
  const [rotacionada] = new EmergencyLighting(mapa([
    { ...ponto({ Lateral: true, Esquerda: true }), rotation: 90 },
  ])).atualizar(0, cam);
  assert.equal(rotacionada.angulo, -Math.PI / 2);
});

test("respeita Raio, Intensidade, Periodo, Ligada e visibilidade em propriedades raw e Phaser", () => {
  const valores = { Raio: 200, Intensidade: 0.6, Periodo: 3000, Ligada: false };
  for (const properties of [valores, Object.entries(valores).map(([name, value]) => ({ name, value }))]) {
    const [luz] = lerLuzesEmergencia(mapa([ponto(properties)]));
    assert.equal(luz.raio, 200);
    assert.equal(luz.intensidade, 0.6);
    assert.equal(luz.periodo, 3000);
    assert.equal(luz.ligada, false);
  }
  assert.equal(lerLuzesEmergencia(mapa([ponto({ Intensidade: 0 })]))[0].intensidade, 0);
  const [invalida] = lerLuzesEmergencia(mapa([ponto({ Raio: "200", Intensidade: -1, Periodo: 0 })]));
  assert.equal(invalida.raio, PADROES_GIROFLEX.raio);
  assert.equal(invalida.intensidade, PADROES_GIROFLEX.intensidade);
  assert.equal(invalida.periodo, PADROES_GIROFLEX.periodo);
  assert.equal(lerLuzesEmergencia(mapa([ponto()], false))[0].ligada, true,
    "ocultar a camada de marcações no Tiled não apaga as luzes do jogo");
  assert.equal(lerLuzesEmergencia(mapa([{ ...ponto(), visible: false }]))[0].ligada, false);
  assert.deepEqual(lerLuzesEmergencia({ getObjectLayer: () => null }), []);
  const avisos = [];
  assert.deepEqual(lerLuzesEmergencia(mapa([{ ...ponto(), point: false }, { ...ponto(), x: NaN }]),
    aviso => avisos.push(aviso)), []);
  assert.equal(avisos.length, 2);
});

test("o giro avança pelo tempo, completa a volta e reutiliza o estado quando o relógio para", () => {
  const lights = new EmergencyLighting(mapa([ponto()]));
  const cam = camera();
  const fontes = lights.atualizar(0, cam);
  assert.equal(fontes.length, 1);
  assert.equal(fontes[0].angulo, 0);
  const revisao = lights.revisao;
  lights.atualizar(0, cam);
  assert.equal(lights.revisao, revisao);
  lights.atualizar(500, cam);
  assert.equal(fontes[0].angulo, Math.PI / 2);
  lights.atualizar(1000, cam);
  assert.equal(fontes[0].angulo, Math.PI);
  lights.atualizar(2000, cam);
  assert.equal(fontes[0].angulo, 0);
  assert.equal(lights.fontesVisiveis, fontes);
});

test("fora da câmera não redesenha; voltar retoma a fase atual e destroy limpa referências", () => {
  const lights = new EmergencyLighting(mapa([ponto(), { ...ponto(), id: 2, x: -5000 }]));
  const cam = camera();
  assert.equal(lights.atualizar(0, cam).length, 1);
  cam.matrix.e = -10000;
  assert.equal(lights.atualizar(500, cam).length, 0);
  const revisao = lights.revisao;
  lights.atualizar(1000, cam);
  assert.equal(lights.revisao, revisao);
  cam.matrix.e = 0;
  assert.equal(lights.atualizar(1500, cam)[0].angulo, 3 * Math.PI / 2);
  lights.destroy();
  assert.equal(lights.luzes.length, 0);
  assert.equal(lights.fontesVisiveis.length, 0);
  assert.equal(lights.estados.length, 0);
});

test("o perfil tem dois feixes opostos, núcleo vermelho e queda suave até a borda", () => {
  assert.ok(calcularPerfilGiroflex(0, 0) > 0.95);
  assert.ok(calcularPerfilGiroflex(0.4, 0) > calcularPerfilGiroflex(0, 0.4) * 10);
  assert.equal(calcularPerfilGiroflex(0.4, 0), calcularPerfilGiroflex(-0.4, 0));
  assert.ok(calcularPerfilGiroflex(0.5, 0) > calcularPerfilGiroflex(0.8, 0));
  assert.ok(calcularPerfilGiroflex(0.99, 0) < 0.001);
  assert.equal(calcularPerfilGiroflex(1, 0), 0);
  assert.equal(calcularPerfilGiroflex(0, -1.1), 0);
  assert.ok(calcularPerfilGiroflex(0.4, 0, true) > calcularPerfilGiroflex(-0.4, 0, true) * 10,
    "o perfil lateral emite só um facho para o interior");
});

test("Neon é fixo, pequeno e aceita orientação vertical em propriedades raw e Phaser", () => {
  for (const valores of [{ Neon: true }, { Neon: true, Orientacao: "Vertical" },
    { Neon: true, Cor: "#ffffd35a" }, { Neon: true, Orientacao: "Vertical", Cor: "#ffffd35a" }]) {
    for (const properties of [valores, Object.entries(valores).map(([name, value]) => ({ name, value }))]) {
      const lights = new EmergencyLighting(mapa([ponto(properties)]));
      const cam = camera();
      const [fonte] = lights.atualizar(0, cam);
      assert.equal(fonte.luz.neon, true);
      assert.equal(fonte.luz.raio, 18);
      assert.equal(fonte.luz.cor.phaser, valores.Cor ? 0xFFD35A : 0xFF101C);
      assert.equal(fonte.angulo, valores.Orientacao ? Math.PI / 2 : 0);
      const revisao = lights.revisao;
      lights.atualizar(500, cam);
      assert.equal(lights.revisao, revisao, "o neon não gira nem redesenha com o tempo");
      assert.equal(calcularPerfilNeon(0, 0), 1);
      assert.ok(calcularPerfilNeon(0.15, 0, true) > calcularPerfilNeon(0, 0.15, true) * 10);
      assert.ok(calcularPerfilNeon(0, 0.3) > calcularPerfilNeon(0, 0.7));
      assert.equal(calcularPerfilNeon(1, 0), 0);
    }
  }
});
