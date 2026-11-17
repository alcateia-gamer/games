import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import criarIluminacaoBasicaFabrica from "./FactoryAmbientLighting.js";
import { obterPiscadasPartida } from "../sounds/luzFabrica.js";
import { QUEDAS_LUZ_FABRICA } from "./FactoryLighting.js";

for (const desktop of [true, false]) test(`ambiente básico e lanterna original: ${desktop ? "computador" : "celular"}`, async t => {
  const previousPhaser = globalThis.Phaser;
  const previousDocument = globalThis.document;
  globalThis.Phaser = {
    Scene: class {},
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
  const { default: Level1Parte2 } = await import("../scenes/Level1Parte2.js");
  let uploads = 0;
  const reproducoes = [];
  const som = {
    totalDuration: 4, addMarker() {}, stop() {}, destroy() {}, setVolume() {},
    play(nome) { reproducoes.push({ nome, tempo: scene.time.now / 1000 }); return true; },
  };
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
  const mascaras = [];
  const scene = {
    developerMode: true, cidadeDescarregada: true,
    acenderLuzFabrica: Level1Parte2.prototype.acenderLuzFabrica,
    apagarLuzFabrica: Level1Parte2.prototype.apagarLuzFabrica,
    portasFabrica: [{ nome: "porta01", estado: "fechada", area: { x: 300, y: 240, width: 80, height: 10 } }],
    cache: { audio: { exists: () => true } },
    sound: { add: () => som },
    game: { renderer: new EventEmitter(), registry: new Map() },
    map: { getObjectLayer: name => ({ objects: name === "collision"
      ? [{ x: 200, y: 0, width: 10, height: 300, type: "" }]
      : name === "LuzApagada" ? [{ id: 7, x: 300, y: 180, width: 80, height: 60, rotation: 15 }] : [] }) },
    sys: { game: { device: { os: { desktop }, input: { touch: !desktop } } } },
    cameras: { main: { width: 850, height: 405, originX: 0.5, originY: 0.5,
      zoom: 1, scrollX: 0, scrollY: 0,
      matrix: { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 } } },
    textures: { exists: () => false, createCanvas(key, w, h) {
      dimensions = [w, h]; return texture;
    } },
    events: new EventEmitter(), time: { now: 0 },
    player: { active: true, x: 100, y: 100, body: { velocity: { x: 0, y: 0 } },
      getCenter(point) { point.set(this.x, this.y); } },
    add: { image: () => overlay, rectangle(x, y, width, height, color) {
      const sprite = { x, y, width, height, color };
      for (const name of ["setOrigin", "setDepth", "setVisible", "setAlpha", "setRotation"]) {
        sprite[name] = value => { sprite[name.slice(3).toLowerCase()] = value; return sprite; };
      }
      sprite.destroy = () => { sprite.destroyed = true; };
      mascaras.push(sprite);
      return sprite;
    } },
  };
  const cleanup = criarIluminacaoBasicaFabrica(scene);
  t.after(cleanup);
  assert.equal(scene.game.renderer.listenerCount("render"), 1, "somente um compositor");
  const render = () => scene.game.renderer.emit("render", scene, scene.cameras.main);
  assert.deepEqual(dimensions, [850, 405]);
  assert.equal(scene.iluminacaoFabrica.energia, false, "a fábrica começa sem energia");
  render();
  assert.equal(recortes, 1, "o desenho da lanterna é recortado pelas colisões sem tipo do mapa");
  const stationaryUploads = uploads;
  for (let i = 0; i < 120; i++) render();
  assert.equal(uploads, stationaryUploads);
  scene.generatorMenuOpen = true;
  scene.player.body.velocity.x = 100;
  render();
  assert.equal(uploads, stationaryUploads, "o menu conserva a iluminação já desenhada");
  scene.generatorMenuOpen = false;
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
  assert.equal(reproducoes.length, 0, "nenhuma oscilação sonora antes de ligar o gerador");
  // Partida usa o relógio fornecido pelo gerador e não muda a lanterna original.
  let progresso = 0;
  scene.acenderLuzFabrica(() => progresso);
  render();
  const uploadsPartida = uploads;
  const recortesPartida = recortes;
  assert.equal(overlay.alpha, 0.75, "a partida conserva a visibilidade inicial");
  // Mesmo que o render avance, aguarda o relógio do motor confirmar o início da partida.
  for (let i = 0; i < 10; i++) { scene.time.now += 100; render(); }
  assert.equal(overlay.alpha, 0.75);
  assert.equal(reproducoes.length, 0, "não antecipa áudio nem piscadas enquanto o motor não começou");
  let anterior = false;
  const piscadas = [];
  let alphaPartidaAnterior = overlay.alpha;
  for (let ms = 0; ms < 5000; ms += 10) {
    scene.time.now = ms;
    progresso = ms / 5000;
    render();
    assert.ok(overlay.alpha >= 0.4 && overlay.alpha <= 0.75, "partida sempre mantém visibilidade");
    assert.ok(Math.abs(overlay.alpha - alphaPartidaAnterior) < 0.04, "partida sem saltos de brilho");
    if (ms <= 1200) assert.equal(overlay.alpha, 0.75, "aguarda a ativação antes de clarear");
    if (ms < 4800) assert.ok(overlay.alpha > 0.4, "brilho final só após a terceira oscilação");
    const acesa = overlay.alpha > alphaPartidaAnterior + 1e-9;
    if (acesa && !anterior) piscadas.push(ms / 1000);
    alphaPartidaAnterior = overlay.alpha;
    anterior = acesa;
  }
  const partidaAnterior = scene.iluminacaoFabrica.partida;
  scene.acenderLuzFabrica();
  scene.definirIluminacaoFabrica(true);
  assert.equal(scene.iluminacaoFabrica.partida, partidaAnterior, "energia ligada não reinicia a sequência");
  assert.equal(piscadas.length, 3, "exatamente três piscadas");
  assert.equal(reproducoes.length, 3, "três reproduções de TZZK original");
  const horarios = obterPiscadasPartida(QUEDAS_LUZ_FABRICA, { consecutivas: true });
  for (let i = 0; i < 3; i++) {
    if (i > 0) assert.equal(horarios[i].inicioSom,
      horarios[i - 1].inicioSom + horarios[i - 1].duracaoOscilacao, "três oscilações consecutivas, sem intervalos");
    assert.equal(horarios[i].duracaoOscilacao, 1, "cada ciclo completo dura um segundo");
    assert.equal(reproducoes[i].nome, `mau-contato-${i}`);
    assert.ok(Math.abs(piscadas[i] - reproducoes[i].tempo) <= 0.061, "a queda suave acompanha o início do áudio");
    assert.ok(Math.abs(piscadas[i] - horarios[i].inicioSom) < 0.061);
  }
  progresso = 1;
  render();
  assert.equal(overlay.alpha, 0.4, "acesa ao terminar a partida");
  scene.player.x += 100;
  scene.cameras.main.matrix.e += 40;
  for (let i = 0; i < 120; i++) render();
  assert.equal(overlay.alpha, 0.4, "permanece acesa");
  assert.equal(uploads, uploadsPartida, "ambiente não redesenha nem envia máscaras na partida ou depois");
  assert.equal(recortes, recortesPartida, "nenhum recorte pesado de ambiente é executado");
  assert.equal(reproducoes.length, 3, "não repete os estalos");
  const mascara = mascaras[0], zona = scene.zonasLuzApagada.zonas[0];
  assert.deepEqual([mascara.x, mascara.y, mascara.width, mascara.height, mascara.rotation],
    [zona.x, zona.y, zona.largura, zona.altura, Math.atan2(zona.sin, zona.cos)]);
  assert.equal(mascara.alpha, 1, "máscara da porta é opaca mesmo com ambiente aceso");
  scene.portasFabrica[0].estado = "abrindo";
  render();
  assert.equal(mascara.alpha, 1, "aguarda o fim da abertura original");
  assert.equal(reproducoes.length, 3, "nenhum estalo durante a abertura");
  scene.portasFabrica[0].estado = "aberta";
  scene.time.now = 6000;
  render();
  scene.time.now = 6075;
  render();
  assert.equal(mascara.alpha, zona.opacidade, "transição conserva a opacidade original");
  assert.ok(mascara.alpha > 0 && mascara.alpha < 1);
  scene.time.now = 6150;
  render();
  const sonsAntesDaPorta = reproducoes.length;
  for (const estado of ["aberta", "fechada", "abrindo", "aberta"]) {
    scene.portasFabrica[0].estado = estado;
    for (let ms = 0; ms <= 5000; ms += 10) {
      scene.time.now += 10;
      render();
      assert.equal(overlay.alpha, 0.4, "abrir, fechar e reabrir portas não oscila o ambiente");
    }
  }
  assert.equal(reproducoes.length, sonsAntesDaPorta, "portas não disparam TZZK");
  assert.equal(mascara.alpha, 0, "a máscara da área revelada mantém o comportamento original");
  assert.equal(uploads, uploadsPartida, "portas não recriam a textura ambiente");
  // Mesmo acionamento usado pelo botão DEV: relógio da cena, sem callback do gerador.
  for (let repeticao = 0; repeticao < 2; repeticao++) {
    scene.apagarLuzFabrica();
    scene.acenderLuzFabrica();
    const inicio = scene.time.now;
    let anterior = false, flashes = 0, alphaAnterior = 0.75;
    const sonsAntes = reproducoes.length;
    for (let ms = 0; ms < 5000; ms += 10) {
      scene.time.now = inicio + ms;
      render();
      const acesa = overlay.alpha > alphaAnterior + 1e-9;
      alphaAnterior = overlay.alpha;
      if (acesa && !anterior) flashes++;
      anterior = acesa;
    }
    scene.time.now = inicio + 5000;
    render();
    assert.equal(flashes, 3, "DEV repete exatamente três piscadas após desligar e religar");
    assert.equal(reproducoes.length - sonsAntes, 3, "DEV repete os três estalos originais");
    assert.equal(overlay.alpha, 0.4);
    scene.acenderLuzFabrica();
    assert.equal(scene.iluminacaoFabrica.partida, null, "DEV ligado não repete a partida");
  }
  scene.apagarLuzFabrica();
  render();
  assert.equal(overlay.alpha, 1, "restaura a composição original da lanterna");
  assert.ok(recortes > recortesPartida, "a lanterna retorna com seus recortes originais");
  cleanup();
  assert.ok(mascaras.every(sprite => sprite.destroyed));
  assert.equal(scene.game.renderer.listenerCount("render"), 0);
});
