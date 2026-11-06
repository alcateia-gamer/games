import test from "node:test";
import assert from "node:assert/strict";
import BossAuraLightCache from "./BossAuraLightCache.js";

function canvas() {
  const chamadas = [], pilha = [];
  const context = {
    globalAlpha: 1, globalCompositeOperation: "source-over", chamadas,
    save() { pilha.push([this.globalAlpha, this.globalCompositeOperation]); },
    restore() { [this.globalAlpha, this.globalCompositeOperation] = pilha.pop(); },
    setTransform(...args) { chamadas.push({ tipo: "matriz", args }); },
    transform(...args) { chamadas.push({ tipo: "sprite", args }); },
    clearRect() {},
    drawImage(...args) { chamadas.push({ tipo: "imagem", op: this.globalCompositeOperation, args }); },
    fillRect() { chamadas.push({ tipo: "cor", op: this.globalCompositeOperation, cor: this.fillStyle }); },
  };
  return { width: 256, height: 256, getContext: () => context };
}

test("recorta a silhueta da luz e da cor, reutiliza a pose e libera emissores removidos", t => {
  const anterior = globalThis.document;
  globalThis.document = { createElement: canvas };
  t.after(() => { globalThis.document = anterior; });
  const base = canvas(), cache = new BossAuraLightCache(base);
  t.after(() => cache.destroy());
  const sprite = { x: -1080, y: -5810, scaleX: 0.55, scaleY: 0.55,
    displayOriginX: 144, displayOriginY: 144, alpha: 1,
    frame: { source: { image: {} }, cutX: 288, cutY: 0, cutWidth: 288, cutHeight: 288,
      realWidth: 288, realHeight: 288 } };
  const fonte = { emissor: sprite, vermelha: true, luz: { x: sprite.x, y: sprite.y - 8, raio: 156 } };
  cache.sincronizar([fonte]);
  const carimbo = cache.obter(fonte);
  const m = carimbo.mascara.getContext("2d").chamadas;
  const c = carimbo.cor.getContext("2d").chamadas;
  assert.deepEqual(m.filter(ch => ch.tipo === "imagem").map(ch => ch.op), ["source-over", "destination-out"]);
  const recorte = m.find(ch => ch.op === "destination-out");
  assert.equal(recorte.args[0], sprite.frame.source.image);
  assert.deepEqual(recorte.args.slice(1), [288, 0, 288, 288, -144, -144, 288, 288]);
  assert.deepEqual(m.find(ch => ch.tipo === "sprite").args, [0.55, 0, -0, 0.55, 0, 8]);
  assert.equal(c.find(ch => ch.tipo === "imagem").args[0], carimbo.mascara,
    "a cor usa exatamente o mesmo recorte que a abertura da sombra");
  assert.ok(c.some(ch => ch.tipo === "cor" && ch.op === "source-in" && ch.cor === "#FF1028"));
  const chamadas = m.length + c.length;
  for (let i = 0; i < 120; i++) {
    sprite.x += 1; fonte.luz.x += 1;
    assert.equal(cache.obter(fonte), carimbo);
  }
  assert.equal(m.length + c.length, chamadas, "mover o emissor não recalcula a textura");
  sprite.frame = { ...sprite.frame, cutX: 576 };
  cache.obter(fonte);
  assert.ok(m.length + c.length > chamadas, "um novo quadro refaz a silhueta");
  sprite.flipX = true;
  cache.obter(fonte);
  assert.equal(m.filter(ch => ch.tipo === "sprite").at(-1).args[0], -0.55);
  cache.sincronizar([]);
  assert.equal(cache.carimbos.size, 0);
  assert.equal(carimbo.mascara.width, 0);
  assert.equal(carimbo.cor.width, 0);
  cache.destroy();
  assert.equal(base.width, 0);
});
