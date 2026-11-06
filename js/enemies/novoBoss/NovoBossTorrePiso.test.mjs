import test from "node:test";
import assert from "node:assert/strict";
import { aplicarPisoNaBase, prepararPisoTorre } from "./NovoBossTorrePiso.js";

test("o piso mantém a armadura, os raios, as setas e a transparência em todos os quadros", () => {
  const asset = { larguraFrame: 4, alturaFrame: 70 };
  const largura = 8;
  const pixels = new Uint8ClampedArray(largura * 140 * 4);
  const colocar = (x, y, rgba) => pixels.set(rgba, (y * largura + x) * 4);
  const ler = (x, y) => Array.from(pixels.slice((y * largura + x) * 4, (y * largura + x + 1) * 4));
  const piso = { width: 2, height: 2,
    data: new Uint8ClampedArray([40, 40, 40, 255, 80, 80, 80, 255,
      120, 120, 120, 255, 160, 160, 160, 255]) };
  const controles = [[170, 179, 173, 255], [64, 168, 255, 255], [10, 231, 0, 255],
    [47, 75, 75, 0]];
  for (const inicioX of [0, 4]) for (const inicioY of [0, 70]) {
    colocar(inicioX, inicioY + 66, [47, 75, 75, 255]);
    colocar(inicioX + 1, inicioY + 66, [16, 25, 25, 255]);
    colocar(inicioX, inicioY + 65, [47, 75, 75, 255]);
    controles.forEach((rgba, x) => colocar(inicioX + x, inicioY + 67, rgba));
  }
  aplicarPisoNaBase(pixels, largura, asset, piso, 1, -1, -1);
  for (const inicioX of [0, 4]) for (const inicioY of [0, 70]) {
    assert.deepEqual(ler(inicioX, inicioY + 66), [160, 160, 160, 255]);
    assert.deepEqual(ler(inicioX + 1, inicioY + 66), [40, 40, 40, 255], "a sombra fica abaixo do tom do piso");
    assert.deepEqual(ler(inicioX, inicioY + 65), [47, 75, 75, 255], "a área acima da base não muda");
    controles.forEach((rgba, x) => assert.deepEqual(ler(inicioX + x, inicioY + 67), rgba));
  }
});

test("mapas sem piso disponível mantêm as texturas existentes", () => {
  const poses = { idle: { chave: "idle" } };
  assert.equal(prepararPisoTorre({}, { x: 0, y: 0 }, poses), poses);
});

test("as quatro poses usam o tile do mapa e reutilizam as folhas já preparadas", t => {
  const criadas = new Map(), chamadas = [];
  const piso = { width: 1, height: 1, data: new Uint8ClampedArray([52, 52, 52, 255]) };
  const fonte = { width: 1, height: 70, data: new Uint8ClampedArray(70 * 4) };
  fonte.data.set([47, 75, 75, 255], 66 * 4);
  const documento = globalThis.document;
  t.after(() => {
    if (documento === undefined) delete globalThis.document;
    else globalThis.document = documento;
  });
  globalThis.document = { createElement: () => {
    const canvas = { width: 0, height: 0 };
    canvas.getContext = () => ({
      drawImage(imagem) { canvas.data = new Uint8ClampedArray(imagem.data); },
      getImageData() { return { width: canvas.width, height: canvas.height, data: canvas.data }; },
      putImageData(imagem) { canvas.data = imagem.data; },
    });
    return canvas;
  } };
  const scene = {
    map: {
      getTileAtWorldXY(x, y, vazio, camera, camada) {
        assert.equal(camada, "chão");
        return { index: 2532 };
      },
      tilesets: [{ name: "piso-arena", tileWidth: 1, tileHeight: 1,
        containsTileIndex: index => index === 2532,
        getTileTextureCoordinates: () => ({ x: 0, y: 0 }),
        image: { getSourceImage: () => piso } }],
    },
    textures: {
      exists: chave => criadas.has(chave),
      get: () => ({ getSourceImage: () => fonte }),
      addSpriteSheet(chave, canvas, config) {
        chamadas.push({ chave, canvas, config });
        criadas.set(chave, canvas);
      },
    },
  };
  const poses = Object.fromEntries(["summon", "idle", "attacked", "death"].map((estado, i) =>
    [estado, { chave: estado, larguraFrame: 1, alturaFrame: 70, ultimoFrame: i, frameMs: 100 }]));
  const ponto = { x: 96, y: 96, width: 192, height: 192 };
  const resultado = prepararPisoTorre(scene, ponto, poses);
  assert.equal(chamadas.length, 4);
  chamadas.forEach(({ canvas, config }, i) => {
    assert.deepEqual(Array.from(canvas.data.slice(66 * 4, 67 * 4)), [52, 52, 52, 255]);
    assert.equal(config.endFrame, i);
  });
  assert.deepEqual(prepararPisoTorre(scene, { ...ponto, x: ponto.x + 48 }, poses), resultado);
  assert.equal(chamadas.length, 4, "outra torre no mesmo piso reutiliza as texturas");
  assert.deepEqual(Array.from(fonte.data.slice(66 * 4, 67 * 4)), [47, 75, 75, 255]);
});
