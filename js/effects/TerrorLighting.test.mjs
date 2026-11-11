import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import criarIluminacaoTerror from "./TerrorLighting.js";

test("flashlight updates on movement and direction changes only while factory power is off", t => {
  const previousPhaser = globalThis.Phaser;
  const previousDocument = globalThis.document;
  globalThis.Phaser = {
    Math: { Vector2: class {
      constructor(x = 0, y = 0) { this.set(x, y); }
      set(x, y) { Object.assign(this, { x, y }); }
    } },
    Textures: { FilterMode: { LINEAR: 0 } },
    Renderer: { Events: { RENDER: "render" } },
    Scenes: { Events: { PRE_RENDER: "prerender", SHUTDOWN: "shutdown" } },
  };
  globalThis.document = { createElement: () => ({ getContext: () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
  }) }) };
  t.after(() => { globalThis.Phaser = previousPhaser; globalThis.document = previousDocument; });
  let uploads = 0;
  let recortes = 0;
  let dimensions;
  const context = Object.fromEntries(["setTransform", "scale", "clearRect", "fillRect", "save", "restore",
    "transform", "drawImage", "translate", "beginPath", "arc", "fill", "moveTo", "lineTo", "closePath"]
    .map(name => [name, () => {}]));
  context.clip = () => { recortes++; };
  context.createRadialGradient = () => ({ addColorStop() {} });
  const texture = { getContext: () => context, setFilter() {}, refresh() { uploads++; } };
  const overlay = { visible: true };
  for (const name of ["setOrigin", "setScrollFactor", "setDepth", "setDisplaySize", "setPosition", "setRotation", "setScale"])
    overlay[name] = () => overlay;
  overlay.setAlpha = alpha => { overlay.alpha = alpha; return overlay; };
  overlay.setVisible = visible => { overlay.visible = visible; return overlay; };
  overlay.destroy = () => {};
  const scene = {
    game: { renderer: new EventEmitter() },
    map: { getObjectLayer: name => ({ objects: name === "collision"
      ? [{ x: 200, y: 0, width: 10, height: 300, type: "" }] : [] }) },
    sys: { game: { device: { input: { touch: true } } } },
    cameras: { main: { width: 850, height: 405, originX: 0.5, originY: 0.5,
      zoom: 1, scrollX: 0, scrollY: 0,
      matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } } },
    textures: { exists: () => false, createCanvas(key, w, h) {
      dimensions = [w, h]; return texture;
    } },
    events: new EventEmitter(), time: { now: 0 },
    player: { active: true, x: 100, y: 100, body: { velocity: { x: 0, y: 0 } },
      getCenter(point) { point.set(this.x, this.y); } },
    add: { image: () => overlay },
  };
  const cleanup = criarIluminacaoTerror(scene);
  t.after(cleanup);
  const render = () => scene.game.renderer.emit("render", scene, scene.cameras.main);
  assert.deepEqual(dimensions, [850, 405]);
  render();
  assert.equal(recortes, 1, "o desenho da lanterna é recortado pelas colisões sem tipo do mapa");
  const stationaryUploads = uploads;
  for (let i = 0; i < 120; i++) render();
  assert.equal(uploads, stationaryUploads);
  scene.player.body.velocity.x = 100;
  render();
  assert.equal(uploads, stationaryUploads + 1, "mudar direção atualiza o cone");
  const recortesSemEnergia = recortes;
  scene.definirIluminacaoFabrica(true);
  render();
  assert.equal(uploads, stationaryUploads + 2, "ligar a fábrica apaga a lanterna");
  assert.equal(recortes, recortesSemEnergia, "o bloqueio da lanterna não recorta as lâmpadas da fábrica");
  scene.player.x += 40;
  scene.player.body.velocity.x = -100;
  render();
  assert.equal(uploads, stationaryUploads + 2, "personagem não invalida a máscara com a fábrica ligada");
  scene.definirIluminacaoFabrica(false);
  render();
  assert.equal(uploads, stationaryUploads + 3);
  scene.player.x += 10;
  render();
  assert.equal(uploads, stationaryUploads + 4, "lanterna acompanha o personagem sem energia");
  Object.assign(scene.player, { texture: { key: "walk" }, frame: { name: 18 },
    displayOriginX: 64, displayOriginY: 64 });
  render();
  const animationUploads = uploads;
  scene.player.frame.name = 21;
  render();
  assert.equal(uploads, animationUploads, "o movimento dos braços não desloca a origem na barriga");
  scene.player.body.velocity.x = 0;
  render();
  assert.equal(uploads, animationUploads, "parar preserva a mira e reutiliza a máscara");
  cleanup();
  assert.equal(scene.game.renderer.listenerCount("render"), 0);
});

test("neon fica atrás do boss e das cópias mesmo sem jogador visível, com clareamento separado", t => {
  const previousPhaser = globalThis.Phaser, previousDocument = globalThis.document;
  let limpar;
  const chamadas = [];
  function canvas(width = 256, height = 256) {
    const pilha = [];
    const context = {
      globalAlpha: 1, globalCompositeOperation: "source-over",
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData() {},
      save() { pilha.push([this.globalAlpha, this.globalCompositeOperation]); },
      restore() { [this.globalAlpha, this.globalCompositeOperation] = pilha.pop(); },
      drawImage(...args) { chamadas.push({ context, args, alpha: this.globalAlpha, op: this.globalCompositeOperation }); },
    };
    for (const nome of ["setTransform", "transform", "clearRect", "fillRect", "translate", "beginPath",
      "rect", "clip", "moveTo", "lineTo", "closePath"]) context[nome] = () => {};
    return { width, height, getContext: () => context };
  }
  globalThis.document = { createElement: () => canvas() };
  globalThis.Phaser = {
    Math: { Vector2: class { constructor() { this.x = this.y = 0; } } },
    Textures: { FilterMode: { LINEAR: 0 } },
    Renderer: { Events: { RENDER: "render" } }, Scenes: { Events: { SHUTDOWN: "shutdown" } },
  };
  t.after(() => {
    limpar?.();
    globalThis.Phaser = previousPhaser; globalThis.document = previousDocument;
  });
  let uploads = 0;
  const texture = Object.assign(canvas(800, 450), {
    setFilter() {}, refresh() { uploads++; },
  });
  const overlay = {};
  for (const nome of ["setOrigin", "setScrollFactor", "setDepth", "setPosition", "setRotation", "setScale", "destroy"])
    overlay[nome] = () => overlay;
  const imagemBoss = {}, imagemCopia = {};
  const sprite = imagem => ({ x: 100, y: 100, active: true, visible: true, alpha: 1,
    scaleX: 0.55, scaleY: 0.55, displayOriginX: 144, displayOriginY: 144,
    frame: { source: { image: imagem }, cutX: 0, cutY: 0, cutWidth: 288, cutHeight: 288 } });
  const boss = sprite(imagemBoss), copia = sprite(imagemCopia);
  const scene = {
    game: { renderer: new EventEmitter() }, events: new EventEmitter(), time: { now: 0 },
    map: { getObjectLayer: name => ({ objects: name === "Luzedeemergencia" ? [{
      id: 1, point: true, x: 100, y: 100, name: "neon vermelho vertical",
      properties: { Raio: 48, Intensidade: 1 },
    }] : [] }) },
    cameras: { main: { width: 800, height: 450, zoom: 1, scrollX: 0, scrollY: 0,
      matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } } },
    textures: { exists: () => false, createCanvas: () => texture },
    add: { image: () => overlay }, luzFabricaAcesa: true,
    player: { active: false, visible: false },
    novoBoss: { jogadorNaArena: true, sprite: boss,
      alvosIlusorios: [{ active: true, visible: true, sprite: copia }] },
  };
  limpar = criarIluminacaoTerror(scene);
  const render = () => scene.game.renderer.emit("render", scene, scene.cameras.main);
  chamadas.length = 0;
  render();
  const composicao = chamadas.find(ch => ch.context === texture.getContext() && ch.args.length === 3 &&
    ch.args[0]?.width === 800 && ch.args[0]?.height === 450);
  assert.ok(composicao, "a cor é composta separadamente mesmo sem jogador visível");
  const corContext = composicao.args[0].getContext();
  for (const imagem of [imagemBoss, imagemCopia]) {
    const recorte = chamadas.find(ch => ch.context === corContext && ch.args[0] === imagem);
    assert.ok(recorte, "o corpo oculta o neon antes de compor a luz");
    assert.equal(recorte.op, "destination-out");
    assert.equal(recorte.alpha, 1, "remove a faixa inteira, não só parte do brilho");
    assert.ok(chamadas.indexOf(recorte) < chamadas.indexOf(composicao));
    const clareamento = chamadas.find(ch => ch.context === texture.getContext() && ch.args[0] === imagem);
    assert.equal(clareamento.op, "destination-out");
    assert.equal(clareamento.alpha, 0.55, "a sombra conserva o clareamento pedido para o sprite");
    assert.ok(chamadas.indexOf(clareamento) > chamadas.indexOf(composicao));
  }
  assert.ok(chamadas.some(ch => ch.context === corContext && ch.op === "source-over" &&
    chamadas.indexOf(ch) < chamadas.indexOf(composicao)), "a luz continua desenhada fora das silhuetas");
  const antes = uploads;
  for (let i = 0; i < 120; i++) render();
  assert.equal(uploads, antes, "a correção preserva o cache com poses paradas");
  boss.flipX = true;
  render();
  assert.equal(uploads, antes + 1, "o recorte acompanha o espelhamento");
  copia.frame = { ...copia.frame, cutX: 288 };
  render();
  assert.equal(uploads, antes + 2, "o recorte acompanha a animação das cópias");
  const imagemBola = {};
  const bola = { ...sprite(imagemBola), tipoRobo: "bola" };
  scene.inimigos = [bola]; chamadas.length = 0;
  render();
  assert.ok(chamadas.some(ch => ch.context === corContext && ch.args[0] === imagemBola && ch.op === "destination-out"));
  const comBola = uploads;
  render(); assert.equal(uploads, comBola, "bola parada preserva o cache");
  bola.y += 2; render(); assert.equal(uploads, comBola + 1, "recorte acompanha a flutuação");
  bola.active = false; render(); assert.equal(uploads, comBola + 2, "remoção limpa a silhueta antiga");
});
