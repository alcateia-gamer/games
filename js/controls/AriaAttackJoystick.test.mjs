/** Eventos simulados com o combate real; a validação de entrada Phaser fica no teste de navegador. */
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { criarControlesAtaque } from "./PlayerAttackControls.js";
import { AriaAttackJoystick } from "./AriaAttackJoystick.js";
import { criarJoystick } from "./PlayerJoystick.js";
import { ARIA_ATTACK_CONFIG, calcularCargaAria, direcaoVisualAria, tempoEntradaAria } from "./AriaAttackConfig.js";
import { atualizarMovimento } from "./PlayerMovement.js";
import { iniciarDash, CONFIG_DASH } from "./PlayerDashControls.js";
import { criarPlayer, respawnPlayer } from "../player/Player.js";
import { dispararProjetil, atualizarProjeteis } from "../player/PlayerProjectiles.js";

class Vector2 {
  constructor(x = 0, y = 0) { Object.assign(this, { x, y }); }
  copy(v) { Object.assign(this, v); return this; }
  clone() { return new Vector2(this.x, this.y); }
  normalize() { const d = Math.hypot(this.x, this.y); if (d) { this.x /= d; this.y /= d; } return this; }
}
class Rectangle {
  constructor(x, y, width, height) { this.setTo(x, y, width, height); }
  setTo(x, y, width, height) { Object.assign(this, { x, y, width, height }); return this; }
}
globalThis.Phaser = {
  BlendModes: { NORMAL: 0 }, TintModes: { MULTIPLY: 0, FILL: 1 },
  Geom: { Rectangle, Circle: class { static Contains() { return true; } } },
  Math: { Vector2, Clamp: (n, min, max) => Math.max(min, Math.min(max, n)),
    Distance: { Between: (x, y, a, b) => Math.hypot(a - x, b - y) } },
};

function visual(scene, x = 0, y = 0) {
  const obj = Object.assign(new EventEmitter(), { scene, x, y, active: true });
  for (const metodo of ["setScrollFactor", "setDepth", "setInteractive", "setStrokeStyle", "setAlpha",
    "setVisible", "clearTint", "setTint", "setTintMode", "setBlendMode", "setVertexRoundMode", "clear", "lineStyle",
    "beginPath", "arc", "strokePath", "moveTo", "lineTo", "fillStyle", "closePath", "fillPath",
    "fillRoundedRect", "fillCircle", "setAngle"]) obj[metodo] = () => obj;
  obj.setPosition = (x, y) => { Object.assign(obj, { x, y }); return obj; };
  obj.setScale = (scaleX, scaleY = scaleX) => { Object.assign(obj, { scaleX, scaleY }); return obj; };
  obj.setRotation = rotation => { obj.rotation = rotation; return obj; };
  obj.destroy = () => { obj.active = false; obj.removeAllListeners(); };
  return obj;
}

function sprite(scene, x, y, texture, frame = 0) {
  const obj = visual(scene, x, y);
  obj.setTexture = (key, name = 0) => {
    obj.texture = { key }; obj.width = obj.height = key === "personagem3-walk" ? 128 : 64;
    obj.frame = { name }; return obj;
  };
  obj.setFrame = name => { obj.frame = { name }; return obj; };
  obj.setOrigin = (originX, originY) => { Object.assign(obj, { originX, originY }); return obj; };
  obj.setDisplayOrigin = (x, y) => obj.setOrigin(x / obj.width, y / obj.height);
  Object.defineProperties(obj, {
    displayOriginX: { get: () => obj.width * obj.originX },
    displayOriginY: { get: () => obj.height * obj.originY },
  });
  obj.body = {
    velocity: { x: 0, y: 0 }, offset: { x: 0, y: 0 },
    setSize(width, height) { Object.assign(this, { width, height }); return this; },
    setOffset(x, y) { Object.assign(this.offset, { x, y }); return this; },
    setVelocity(x, y) { Object.assign(this.velocity, { x, y }); return this; },
    setAllowGravity() {}, setImmovable() {}, updateFromGameObject() {},
    get x() { return obj.x - obj.displayOriginX + this.offset.x; },
    get y() { return obj.y - obj.displayOriginY + this.offset.y; },
    get bottom() { return this.y + this.height; },
  };
  obj.setVelocity = (x, y) => { obj.body.setVelocity(x, y); return obj; };
  obj.anims = { timeScale: 1, stop() {}, play(key) {
    this.currentAnim = { key };
    obj.setTexture(/^(walk|idle)-/.test(key) ? "personagem3-walk" : "personagem3-attack");
  } };
  return obj.setTexture(texture, frame).setOrigin(0.5, 0.5);
}

// A implementação anterior continua coberta isoladamente; o jogo usa o botão padrão.
function criarJoystickAtaqueLegado(scene) {
  scene.limparControlesAtaqueFixos?.();
  const joystick = new AriaAttackJoystick(scene, () => criarControlesAtaque(scene));
  scene.limparControlesAtaqueFixos = joystick.destruir;
}

function cena(t, usarBotao = false) {
  const scene = {
    personagemSelecionada: "aria-kade", respawnX: 300, respawnY: 200,
    vida: 100, estamina: 100, estaminaMaxima: 100, custoAtaque: 5, speed: 200,
    time: { now: 1000, delayedCall: () => ({ remove() {} }) },
    events: new EventEmitter(), input: new EventEmitter(), scale: new EventEmitter(),
    game: { events: new EventEmitter(), canvas: new EventTarget() },
    cache: { audio: { exists: () => false } }, tweens: { add() {} },
    cameras: { main: { x: 0, y: 0, width: 800, height: 450, originX: 0.5, originY: 0.5, zoomX: 1, zoomY: 1 } },
    teclasWASD: Object.fromEntries(["cima", "baixo", "esquerda", "direita"].map(k => [k, { isDown: false }])),
    physics: { add: {} },
  };
  scene.add = { graphics: () => visual(scene), circle: (x, y) => visual(scene, x, y) };
  scene.physics.add.sprite = (...args) => sprite(scene, ...args);
  scene.physics.add.group = () => ({ active: true, children: { entries: [] },
    add(obj) { this.children.entries.push(obj); }, getChildren() { return this.children.entries; } });
  criarPlayer(scene);
  criarJoystick(scene);
  if (usarBotao) criarControlesAtaque(scene);
  else criarJoystickAtaqueLegado(scene);
  t.after(() => { scene.limparControlesAtaqueFixos?.(); scene.joystick.destroy(); });
  return scene;
}
function dedo(id, x = 720, y = 350) { return { id, x, y, isDown: true, wasTouch: true }; }
function pressionar(scene, pointer = dedo(2)) { scene.botaoAtaque.emit("pointerdown", pointer); return pointer; }
function soltar(scene, pointer, tempo = 100) {
  scene.time.now += tempo; pointer.isDown = false; scene.input.emit("pointerup", pointer);
}
function flechas(scene) { return scene.projeteisPlayer?.getChildren() ?? []; }
function concluir(scene) { scene.player.emit("animationcomplete", scene.player.anims.currentAnim); }
function geometria(scene) {
  const p = scene.player; return [p.body.x - p.x, p.body.y - p.y, p.body.width, p.body.height];
}

test("A/B: toque rápido e carga completa têm dano e velocidade limitados e um só disparo", t => {
  for (const [duracao, dano, velocidade] of [[0, 25, 420], [180, 25, 420], [600, 35, 510], [1200, 45, 600], [9000, 45, 600]]) {
    const scene = cena(t), pointer = pressionar(scene);
    soltar(scene, pointer, duracao);
    scene.input.emit("pointerupoutside", pointer);
    assert.equal(flechas(scene).length, 1);
    assert.equal(flechas(scene)[0].dano, dano);
    assert.equal(flechas(scene)[0].velocidade, velocidade);
    assert.equal(scene.ariaAtaqueCarregando, false);
    assert.equal(scene.pointerAtaque, null);
  }
});

test("C/D: mira diagonal exata, caminhada oposta e hitbox estável na carga e soltura", t => {
  const scene = cena(t), antes = geometria(scene);
  const pointer = pressionar(scene, dedo(2, 750, 320));
  const inicio = scene.ariaCargaInicio;
  scene.teclasWASD.esquerda.isDown = true;
  for (const tempo of [0, 599, 600, 900, 2000]) {
    scene.time.now = inicio + tempo;
    atualizarMovimento(scene);
    assert.equal(scene.player.body.velocity.x, tempo < 600 ? -200 : -180);
    assert.deepEqual(geometria(scene), antes);
    assert.ok(Math.abs(scene.ariaMira.x - Math.SQRT1_2) < 1e-12);
  }
  soltar(scene, pointer, 0);
  assert.ok(Math.abs(flechas(scene)[0].direcaoDisparo.x - Math.SQRT1_2) < 1e-12);
  assert.ok(Math.abs(flechas(scene)[0].direcaoDisparo.y + Math.SQRT1_2) < 1e-12);
  atualizarMovimento(scene);
  assert.equal(scene.player.body.velocity.x, -200);
  assert.deepEqual(geometria(scene), antes);
  concluir(scene);
  assert.deepEqual(geometria(scene), antes);
});

test("quatro dedos preservam a captura e soltar movimento/dash/especial não dispara", t => {
  const scene = cena(t);
  const movimento = dedo(1, 135, 350), ataque = dedo(2, 760, 350);
  scene.joystick.base.emit("pointerdown", movimento);
  pressionar(scene, ataque);
  for (const pointer of [movimento, dedo(3, 630, 370), dedo(4, 650, 290)]) {
    scene.input.emit("pointerdown", pointer, []);
    pressionar(scene, pointer);
    scene.input.emit("pointerup", pointer);
    assert.equal(scene.pointerAtaque, 2);
    assert.equal(flechas(scene).length, 0);
  }
  soltar(scene, ataque);
  assert.equal(flechas(scene).length, 1);
});

test("E: Sandevistan mantém velocidade, duração, mira e início da carga", t => {
  const scene = cena(t);
  const pointer = pressionar(scene, dedo(2, 750, 320));
  scene.player.texture = null; // O efeito visual é verificado no Phaser real pelo teste de navegador.
  scene.teclasWASD.esquerda.isDown = true;
  scene.estadoDash = { ativo: false, proximoDash: 0, direcao: new Vector2(), rastros: new Set(), efeitos: new Set() };
  scene.ultimaDirecaoDash = new Vector2(-1, 0);
  const inicio = scene.ariaCargaInicio, mira = { ...scene.ariaMira };
  assert.equal(iniciarDash(scene), true);
  assert.equal(scene.estadoDash.fim, scene.time.now + CONFIG_DASH.duracao);
  atualizarMovimento(scene);
  assert.equal(scene.player.body.velocity.x, -CONFIG_DASH.velocidade);
  assert.deepEqual(scene.ariaMira, mira);
  assert.equal(scene.ariaCargaInicio, inicio);
  soltar(scene, pointer);
  assert.equal(flechas(scene).length, 1);
});

test("arrastar fora da base e mudar direção não reinicia carga, nem troca de ponteiro", t => {
  const scene = cena(t), pointer = pressionar(scene);
  const inicio = scene.ariaCargaInicio;
  Object.assign(pointer, { x: 1000, y: -100 });
  scene.input.emit("pointermove", pointer);
  assert.equal(scene.ariaCargaInicio, inicio);
  assert.equal(Math.hypot(...Object.values(scene.ariaAttackJoystick.deslocamento)), 45);
  soltar(scene, pointer, 1200);
  assert.equal(flechas(scene).length, 1);
});

for (const [emissor, evento] of [["events", "pause"], ["events", "sleep"], ["scale", "resize"], ["game", "blur"], ["game", "hidden"]]) {
  test(`H: ${evento} cancela sem flecha e libera a penalidade`, t => {
    const scene = cena(t), pointer = pressionar(scene);
    scene.time.now += 800;
    (emissor === "game" ? scene.game.events : scene[emissor]).emit(evento);
    soltar(scene, pointer);
    assert.equal(flechas(scene).length, 0);
    assert.equal(scene.ariaAtaqueCarregando, false);
    assert.equal(scene.ariaCargaInicio, null);
    scene.teclasWASD.esquerda.isDown = true;
    atualizarMovimento(scene);
    assert.equal(scene.player.body.velocity.x, -200);
  });
}

for (const flag of ["morteEmAndamento", "generatorMenuOpen", "movimentoBloqueado"]) {
  test(`H: ${flag} cancela mesmo se a soltura chegar antes do próximo frame`, t => {
    const scene = cena(t), pointer = pressionar(scene);
    scene[flag] = true;
    soltar(scene, pointer);
    assert.equal(flechas(scene).length, 0);
  });
}

test("touchcancel, perda de evento de soltura e respawn não deixam carga presa", t => {
  const scene = cena(t);
  const pointer = pressionar(scene);
  scene.game.canvas.dispatchEvent(new Event("touchcancel"));
  soltar(scene, pointer);
  assert.equal(flechas(scene).length, 0);
  const segundo = pressionar(scene);
  segundo.isDown = false;
  scene.events.emit("preupdate");
  assert.equal(scene.ariaAtaqueCarregando, false);
  pressionar(scene);
  respawnPlayer(scene);
  assert.equal(scene.pointerAtaque, null);
  assert.equal(scene.ariaAtaqueCarregando, false);
});

test("cooldown de 250ms limita toques rápidos, mas permite uma carga legítima", t => {
  const scene = cena(t);
  soltar(scene, pressionar(scene), 0);
  concluir(scene);
  soltar(scene, pressionar(scene), 100);
  assert.equal(flechas(scene).length, 1);
  soltar(scene, pressionar(scene), 200);
  assert.equal(flechas(scene).length, 2);
});

test("mouse tradicional e joystick compartilham captura e não duplicam projétil", t => {
  const scene = cena(t), mouse = { id: 0, isDown: true, leftButtonDown: () => true };
  scene.input.emit("pointerdown", mouse, []);
  pressionar(scene);
  assert.equal(scene.pointerAtaque, 0);
  soltar(scene, mouse, 1200);
  assert.equal(flechas(scene).length, 1);
});

test("J: zoom por eixo e viewport deslocado preservam posição, direção e área lógica", t => {
  const scene = cena(t), camera = scene.cameras.main;
  Object.assign(camera, { x: 30, y: 20, zoomX: 2, zoomY: 0.6, originX: 0.2, originY: 0.7 });
  scene.events.emit("prerender");
  pressionar(scene, dedo(2, 780, 340));
  assert.ok(Math.abs(scene.ariaMira.x - Math.SQRT1_2) < 1e-12);
  const { base, thumb } = scene.ariaAttackJoystick;
  assert.equal(base.scaleX * camera.zoomX, 1);
  assert.equal(base.scaleY * camera.zoomY, 1);
  assert.ok(Math.abs((thumb.x - base.x) * camera.zoomX - 30) < 1e-8);
  assert.ok(Math.abs((thumb.y - base.y) * camera.zoomY + 30) < 1e-8);
});

test("reconstrução, troca de personagem e shutdown removem objetos e listeners", t => {
  const scene = cena(t), anterior = scene.ariaAttackJoystick;
  pressionar(scene);
  criarJoystickAtaqueLegado(scene);
  assert.equal(anterior.base.active, false);
  assert.equal(scene.input.listenerCount("pointerdown"), 1);
  scene.personagemSelecionada = "kai-mercer";
  scene.events.emit("preupdate");
  assert.equal(scene.ariaAttackJoystick, null);
  assert.equal(scene.input.listenerCount("pointermove"), 1); // Apenas movimento.
  scene.events.emit("shutdown");
  for (const emissor of [scene.input, scene.events, scene.game.events, scene.scale]) {
    assert.equal(emissor.eventNames().length, 0);
  }
});

test("Aria usa o botão de ataque padrão: pressionar carrega e soltar dispara uma flecha", t => {
  const scene = cena(t, true);
  assert.equal(scene.ariaAttackJoystick, undefined);
  assert.ok(scene.iconeAtaque?.active);
  const pointer = pressionar(scene);
  assert.equal(scene.ariaAtaqueCarregando, true);
  assert.equal(flechas(scene).length, 0);
  soltar(scene, pointer, 1200);
  assert.equal(flechas(scene).length, 1);
  assert.equal(scene.ariaAtaqueCarregando, false);
  assert.equal(scene.pointerAtaque, null);
});

test("botão da Aria dispara na direção atualizada pela caminhada durante a carga", t => {
  const scene = cena(t, true);
  const pointer = pressionar(scene);
  scene.teclasWASD.esquerda.isDown = true;
  atualizarMovimento(scene);
  assert.equal(scene.direcaoAtaque, "left");
  soltar(scene, pointer, 1200);
  assert.deepEqual(flechas(scene)[0].direcaoDisparo, { x: -1, y: 0 });
});

test("botão da Aria mantém a carga ao soltar o dedo do movimento", t => {
  const scene = cena(t, true);
  const pointer = pressionar(scene);
  scene.input.emit("pointerup", dedo(1, 100, 350));
  assert.equal(scene.ariaAtaqueCarregando, true);
  assert.equal(scene.pointerAtaque, pointer.id);
  assert.equal(flechas(scene).length, 0);
  soltar(scene, pointer);
  assert.equal(flechas(scene).length, 1);
});

test("histerese estabiliza animação sem quantizar direção física e carga é limitada", () => {
  const vetor = angulo => ({ x: Math.cos(angulo), y: Math.sin(angulo) });
  assert.equal(direcaoVisualAria(vetor(Math.PI / 4 + 0.02), "right"), "right");
  assert.equal(direcaoVisualAria(vetor(Math.PI / 4 + 0.12), "right"), "down");
  assert.deepEqual(calcularCargaAria(120000), { ratio: 1, damage: 45, speed: 600 });
  assert.equal(ARIA_ATTACK_CONFIG.centerX, 720);
});

test("timestamps nativos mantêm um toque de 50ms rápido mesmo entre quadros lentos", t => {
  const scene = cena(t);
  scene.game.loop = { now: 1000 };
  const pointer = dedo(2);
  pointer.event = { timeStamp: 1100 };
  pressionar(scene, pointer);
  assert.equal(scene.ariaCargaInicio, 1100);
  scene.time.now = scene.game.loop.now = 1400;
  pointer.event = { timeStamp: 1150 };
  soltar(scene, pointer, 0);
  assert.equal(flechas(scene)[0].dano, 25);
  assert.equal(tempoEntradaAria(scene, { event: { timeStamp: 1700000000000 } }), 1400);
});

test("G: projétil usa o primeiro obstáculo e não atravessa parede fina entre frames", t => {
  const scene = cena(t);
  const p = dispararProjetil(scene, { direction: { x: 1, y: 0 } });
  scene.collisionGroup = { getChildren: () => [{ active: true, body: { x: p.x + 50, y: p.y - 10, width: 1, height: 20 } }] };
  atualizarProjeteis(scene, 500);
  assert.equal(p.active, false);
  assert.equal(p.distanciaPercorrida, 34);
});

test("G: dano carregado usa a hitbox original do boss e só é aplicado uma vez", t => {
  const scene = cena(t);
  const p = dispararProjetil(scene, { direction: { x: 1, y: 0 }, damage: 45 });
  scene.bossFinal = { active: true, vida: 100, vidaMaxima: 100,
    sprite: visual(scene), hitboxDano: { x: p.x + 60, y: p.y - 10, width: 10, height: 20 } };
  atualizarProjeteis(scene, 500);
  atualizarProjeteis(scene, 500);
  assert.equal(scene.bossFinal.vida, 55);
});

test("alcance e velocidade independem de FPS e chamadas antigas continuam cardinais", t => {
  for (const fps of [15, 30, 60, 120]) {
    const scene = cena(t), p = dispararProjetil(scene);
    const inicio = { x: p.x, y: p.y };
    for (let i = 0; i < fps; i++) atualizarProjeteis(scene, 1000 / fps);
    assert.ok(Math.abs(Math.hypot(p.x - inicio.x, p.y - inicio.y) - 420) < 1e-8);
    atualizarProjeteis(scene, 10000);
    assert.equal(p.distanciaPercorrida, 1800);
    assert.equal(p.active, false);
  }
});
