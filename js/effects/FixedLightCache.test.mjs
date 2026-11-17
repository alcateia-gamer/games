import test from "node:test";
import assert from "node:assert/strict";
import FixedLightCache from "./FixedLightCache.js";

test("acender um LED recompõe só sua faixa, reaproveitando as outras luzes e os dois canvases", t => {
  const anterior = globalThis.document, canvases = [], desenhos = [];
  globalThis.document = { createElement() {
    const ctx = { clearRect(...args) { this.limpeza = args; } };
    for (const nome of ["setTransform", "save", "restore", "beginPath", "rect", "clip", "drawImage"]) ctx[nome] = () => {};
    const canvas = { getContext: () => ctx }; canvases.push(canvas); return canvas;
  } };
  t.after(() => { globalThis.document = anterior; });
  const cache = new FixedLightCache((context, perfil, fonte) => desenhos.push(fonte.luz.id));
  const a = { id: 1, x: 0, y: 0, raio: 10, ligada: true, intensidade: 1, neon: true };
  const b = { ...a, id: 2, y: 200 };
  const c = { ...a, id: 3, y: 210 };
  cache.adicionar(a, [0, 1, 2]); cache.adicionar(b, [0, 1, 2]); cache.adicionar(c, [0, 1, 2]);
  let ligada = false;
  const zonas = { fatorLuz: luz => luz === b && !ligada ? 0 : 1 };
  const obstaculos = { revisao: 0 }, camera = { width: 500, height: 500,
    matrix: { a: 1, b: 0, c: 0, d: 1, e: 100, f: 100 } };
  const destino = { save() {}, restore() {}, drawImage() {} };
  cache.atualizar(0, zonas, obstaculos, obstaculos, obstaculos);
  cache.desenhar(destino, false, camera);
  desenhos.length = 0; ligada = true;
  cache.atualizar(1, zonas, obstaculos, obstaculos, obstaculos);
  cache.desenhar(destino, false, camera);
  assert.deepEqual(desenhos, [2, 2, 2], "somente o LED recém-aceso calcula os recortes; os sobrepostos reutilizam carimbos");
  assert.equal(canvases.length, 11, "dois atlas e três carimbos pequenos por LED");
  assert.ok(cache.contextMascara.limpeza[3] < cache.area.altura);
  desenhos.length = 0;
  cache.atualizar(2, zonas, obstaculos, obstaculos, obstaculos);
  cache.desenhar(destino, true, camera); assert.equal(desenhos.length, 0);
  obstaculos.revisao++;
  cache.atualizar(3, zonas, obstaculos, obstaculos, obstaculos);
  cache.desenhar(destino, false, camera); assert.ok(desenhos.includes(1));
  desenhos.length = 0;
  const alocacoes = canvases.length;
  zonas.fatorLuz = () => 0.5;
  cache.atualizar(4, zonas, obstaculos, obstaculos, obstaculos);
  cache.desenhar(destino, false, camera);
  cache.desenhar(destino, true, camera);
  assert.deepEqual(desenhos, [], "mudar a intensidade durante a cutscene não refaz os recortes");
  assert.equal(canvases.length, alocacoes);
  const descartados = cache.fontes.find(f => f.luz === c).carimbos;
  cache.descartarAbaixo(190);
  cache.atualizar(5, zonas, obstaculos, obstaculos, obstaculos);
  cache.desenhar(destino, false, camera);
  assert.deepEqual(cache.fontes.map(f => f.luz.id), [1, 2]);
  assert.ok(descartados.every(canvas => canvas.width === 0 && canvas.height === 0));
  cache.destroy();
  assert.ok(canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
});

test("descarregar a fábrica retira luzes distantes e permite voltar ao atlas compacto", t => {
  const anterior = globalThis.document;
  const contexto = { setTransform() {}, clearRect() {}, save() {}, restore() {}, drawImage() {} };
  globalThis.document = { createElement: () => ({ getContext: () => contexto }) };
  t.after(() => { globalThis.document = anterior; });
  const cache = new FixedLightCache(() => {});
  cache.adicionar({ x: 0, y: -5800, raio: 18, ligada: true, intensidade: 1, neon: true }, [0, 1, 2]);
  cache.adicionar({ x: 0, y: 0, raio: 18, ligada: true, intensidade: 1, neon: true }, [0, 1, 2]);
  cache.atualizarArea();
  assert.equal(cache.individual, true);
  cache.descartarAbaixo(-5232);
  cache.atualizarArea();
  assert.equal(cache.individual, false);
  assert.equal(cache.fontes.length, 1);
  assert.ok(cache.canvasCor.width * cache.canvasCor.height < 4096);
  cache.destroy();
});

test("invalidar sombras reutiliza carimbos, apaga pixels antigos e libera buffers no descarte", t => {
  const anterior = globalThis.document;
  t.after(() => { globalThis.document = anterior; });
  let criados = 0, pinturas = 0;
  const canvases = [];
  globalThis.document = { createElement() {
    criados++;
    const context = { conteudo: [], setTransform() {}, clearRect() { this.conteudo = []; } };
    const canvas = { width: 300, height: 150, getContext: () => context };
    canvases.push(canvas);
    return canvas;
  } };
  const paredes = { revisao: 0 }, estatuas = { revisao: 0 }, oclusao = { revisao: 0 };
  const zonas = { fatorLuz: () => 1 };
  const cache = new FixedLightCache((ctx, perfil) => {
    pinturas++;
    ctx.conteudo.push(`${perfil}:${paredes.revisao}:${estatuas.revisao}`);
  });
  t.after(() => cache.destroy());
  const luz = { neon: true, x: 10, y: 20, raio: 18, fase: 0, ligada: true, intensidade: 1 };
  cache.adicionar(luz, ["mascara", "halo", "emissor"]);
  cache.atualizar(0, zonas, paredes, estatuas, oclusao);
  const fonte = cache.fontes[0], destino = { drawImage() {} };
  for (let i = 0; i < 3; i++) cache.desenharPerfil(destino, fonte, i);
  const carimbos = fonte.carimbos.slice(), inicial = criados;
  for (let i = 0; i < 3; i++) cache.desenharPerfil(destino, fonte, i);
  assert.equal(pinturas, 3, "recortes válidos não são repintados");
  paredes.revisao++;
  cache.atualizar(1, zonas, paredes, estatuas, oclusao);
  for (let i = 0; i < 3; i++) cache.desenharPerfil(destino, fonte, i);
  assert.equal(criados, inicial, "mudança de porta não aloca outros canvases");
  for (let i = 0; i < 3; i++) {
    assert.equal(fonte.carimbos[i], carimbos[i]);
    assert.deepEqual(carimbos[i].getContext().conteudo, [`${fonte.perfis[i]}:1:0`], "não retém o recorte antigo");
  }
  luz.x += 8; luz.raio = 22;
  estatuas.revisao++;
  cache.atualizar(2, zonas, paredes, estatuas, oclusao);
  for (let i = 0; i < 3; i++) cache.desenharPerfil(destino, fonte, i);
  assert.equal(criados, inicial);
  assert.ok(carimbos.every(c => c.width === 66 && c.height === 66));
  cache.descartarAbaixo(-100);
  assert.equal(cache.fontes.length, 0);
  assert.ok(carimbos.every(c => c.width === 0 && c.height === 0));
  cache.destroy();
  assert.ok(canvases.every(c => c.width === 0 && c.height === 0));
});
