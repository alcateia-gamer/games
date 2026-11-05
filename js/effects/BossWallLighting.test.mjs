import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import BossWallLighting, { lerLuzesParedeBoss, calcularPerfilLuzParede, calcularEmissorLuzParede,
  CAMADA_LUZ_BOSS } from "./BossWallLighting.js";

const mapa = (objects, visible = true) => ({ getObjectLayer: name => name === CAMADA_LUZ_BOSS ? { objects, visible } : null });
const ponto = (properties = {}) => ({ id: 1, point: true, x: 400, y: 225, properties });
const camera = () => ({ width: 800, height: 450, matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } });

test("lê as 16 arandelas amarelas reais e a direção para dentro da sala sem alterar o mapa", () => {
  const raw = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const layer = raw.layers.find(layer => layer.name === CAMADA_LUZ_BOSS);
  const antes = JSON.stringify(layer);
  const luzes = lerLuzesParedeBoss(mapa(layer.objects));
  assert.equal(luzes.length, 16);
  assert.ok(luzes.every(luz => luz.cor.css === "#FFD35A" && luz.ligada));
  assert.deepEqual(luzes.map(({ id, x, y }) => ({ id, x, y })), layer.objects.map(({ id, x, y }) => ({ id, x, y })));
  assert.equal(luzes.find(luz => luz.id === 1390).angulo, Math.PI);
  assert.equal(luzes.find(luz => luz.id === 1397).angulo, 0);
  assert.equal(luzes.find(luz => luz.id === 1394).angulo, Math.PI / 2);
  assert.equal(luzes.find(luz => luz.id === 1402).angulo, -Math.PI / 2);
  assert.equal(JSON.stringify(layer), antes);
});

test("respeita cor, alpha, alcance e ligação em propriedades Tiled e Phaser", () => {
  const valores = { Direita: true, Amarelo: true, Cor: "#8000AAFF", Raio: 180, Intensidade: 0.6, Ligada: false };
  for (const properties of [valores, Object.entries(valores).map(([name, value]) => ({ name, value }))]) {
    const [luz] = lerLuzesParedeBoss(mapa([ponto(properties)]));
    assert.equal(luz.cor.css, "#00AAFF");
    assert.equal(luz.cor.alpha, 128 / 255);
    assert.equal(luz.raio, 180);
    assert.equal(luz.intensidade, 0.6);
    assert.equal(luz.ligada, false);
  }
  assert.equal(lerLuzesParedeBoss(mapa([ponto({ Cima: true, Azul: true })]))[0].cor.css, "#579BFF");
  assert.equal(lerLuzesParedeBoss(mapa([ponto({ Baixo: true })], false))[0].ligada, false);
  const avisos = [];
  assert.deepEqual(lerLuzesParedeBoss(mapa([
    ponto({ Direita: "true" }), ponto({ Cima: true, Baixo: true }), { ...ponto({ Direita: true }), x: NaN },
  ]), aviso => avisos.push(aviso)), []);
  assert.equal(avisos.length, 3);
  assert.deepEqual(lerLuzesParedeBoss({ getObjectLayer: () => null }), []);
});

test("perfil forma uma faixa estreita com halo difuso e não emite atrás da parede", () => {
  assert.ok(calcularEmissorLuzParede(0, 0) > 0.99);
  assert.ok(calcularEmissorLuzParede(0.03, 0) < 0.01);
  assert.ok(calcularEmissorLuzParede(0.005, 0.05) > 0.8);
  assert.equal(calcularEmissorLuzParede(0.005, 0.1), 0);
  assert.ok(calcularPerfilLuzParede(0.2, 0) > calcularPerfilLuzParede(0.6, 0));
  assert.ok(calcularPerfilLuzParede(0.4, 0.2) > 0.1, "a luz se espalha suavemente pela sala");
  for (const y of [-0.5, 0, 0.5]) {
    assert.equal(calcularPerfilLuzParede(-0.01, y), 0);
    assert.equal(calcularEmissorLuzParede(-0.01, y), 0);
  }
  assert.equal(calcularPerfilLuzParede(1, 0), 0);
});

test("arandelas são fixas, acompanham câmera e zonas escuras e reutilizam os estados", () => {
  const luzes = new BossWallLighting(mapa([ponto({ Esquerda: true })]));
  const cam = camera();
  const fontes = luzes.atualizar(0, cam);
  assert.equal(fontes.length, 1);
  const revisao = luzes.revisao;
  luzes.atualizar(60000, cam);
  assert.equal(fontes[0].angulo, Math.PI);
  assert.equal(luzes.revisao, revisao, "não gira nem pisca com a passagem do tempo");
  assert.equal(luzes.atualizar(0, cam, { fatorLuz: () => 0 }).length, 0);
  assert.equal(luzes.atualizar(0, cam, { fatorLuz: () => 0.5 })[0].intensidade, 0.45);
  cam.matrix.e = 10000;
  assert.equal(luzes.atualizar(0, cam).length, 0);
  cam.matrix.e = 0;
  assert.equal(luzes.atualizar(0, cam)[0].intensidade, 0.9);
  assert.equal(luzes.fontesVisiveis, fontes);
  luzes.destroy();
  assert.equal(luzes.luzes.length, 0);
  assert.equal(luzes.estados.length, 0);
  assert.equal(luzes.fontesVisiveis.length, 0);
});
