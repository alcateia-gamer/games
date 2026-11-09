import test from "node:test";
import assert from "node:assert/strict";
import GiroflexLightCache from "./GiroflexLightCache.js";

test("giroflex reutiliza recortes e carimbos entre passagens, limita resolução e libera fontes invisíveis", t => {
  const anterior = globalThis.document;
  const canvases = [];
  globalThis.document = { createElement() {
    const chamadas = [];
    const c = { chamadas, globalCompositeOperation: "source-over" };
    for (const nome of ["setTransform", "clearRect", "save", "restore", "beginPath", "rect", "clip", "fillRect"])
      c[nome] = (...args) => chamadas.push({ nome, args });
    c.drawImage = (...args) => chamadas.push({ nome: "drawImage", args, op: c.globalCompositeOperation });
    const canvas = { width: 300, height: 150, getContext: () => c };
    canvases.push(canvas);
    return canvas;
  } };
  t.after(() => { globalThis.document = anterior; });
  let paredesRecortadas = 0, estatuasRecortadas = 0;
  const paredes = { revisao: 0, recortarFonte() { paredesRecortadas++; } };
  const estatuas = { revisao: 0, recortar() { estatuasRecortadas++; } };
  const cache = new GiroflexLightCache(paredes, estatuas, 256);
  t.after(() => cache.destroy());
  const fonte = { luz: { x: -100, y: -4000, raio: 160, parede: "direita" }, angulo: 0, intensidade: 1 };
  const perfil = {}, destino = { drawImage() {} };
  cache.sincronizar([fonte]);
  for (let i = 0; i < 120; i++) {
    fonte.angulo = i / 120 * Math.PI * 2;
    cache.desenhar(destino, fonte, perfil);
    const carimbo = cache.carimbos.get(fonte.luz);
    const antes = carimbo.mascara.getContext("2d").chamadas.length;
    cache.desenhar(destino, fonte, perfil);
    assert.equal(carimbo.mascara.getContext("2d").chamadas.length, antes,
      "a cor usa o recorte pronto, sem recalcular a máscara");
  }
  assert.equal(paredesRecortadas, 1, "girar o feixe não recalcula paredes");
  assert.equal(estatuasRecortadas, 1, "as estátuas são desenhadas só ao invalidar a silhueta");
  assert.equal(canvases.length, 2, "o mesmo carimbo atende máscara e cor, sem canvas por quadro ou ângulo");
  const carimbo = cache.carimbos.get(fonte.luz);
  assert.ok(canvases.every(canvas => canvas.width === 256 && canvas.height === 256));
  assert.ok(carimbo.recorte.getContext("2d").chamadas.some(ch => ch.nome === "rect"),
    "a luz lateral conserva o recorte para o interior da sala");
  assert.ok(carimbo.mascara.getContext("2d").chamadas.some(ch => ch.op === "destination-in"));
  const mudancas = [() => paredes.revisao++, () => estatuas.revisao++, () => fonte.luz.x++,
    () => { fonte.luz.raio = 4000; }, () => { fonte.luz.parede = "esquerda"; }];
  for (const mudar of mudancas) {
    const antes = paredesRecortadas;
    mudar();
    cache.obter(fonte, perfil);
    assert.equal(paredesRecortadas, antes + 1, "porta, estátua ou fonte alterada invalida o recorte");
  }
  assert.equal(carimbo.mascara.width, 256, "um raio gigante não cria uma textura gigante");
  cache.sincronizar([{ luz: { neon: true } }]);
  assert.equal(cache.carimbos.size, 0);
  assert.ok(canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
  cache.sincronizar([fonte]);
  cache.obter(fonte, perfil);
  cache.destroy();
  assert.ok(canvases.every(canvas => canvas.width === 0 && canvas.height === 0));
});
