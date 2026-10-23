/**
 * Regressões do joystick e sua integração com caminhada, dash e multitoque.
 * Os eventos e visuais são simulados; não executa um navegador ou a física do Phaser.
 */
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { criarJoystick } from "./PlayerJoystick.js";
import { obterDirecaoMovimento } from "./PlayerMovementInput.js";
import { atualizarMovimento } from "./PlayerMovement.js";
import { iniciarDash, CONFIG_DASH } from "./PlayerDashControls.js";
import { criarControlesAtaque } from "./PlayerAttackControls.js";

class Vector2 {
  constructor(x, y) { Object.assign(this, { x, y }); }
  copy({ x, y }) { Object.assign(this, { x, y }); return this; }
  clone() { return new Vector2(this.x, this.y); }
}
class Circle {
  constructor(x, y, radius) { Object.assign(this, { x, y, radius }); }
  static Contains() { return true; }
}
globalThis.Phaser = {
  Geom: { Circle, Rectangle: class {} },
  Math: { Vector2, Distance: { Between: (x, y, a, b) => Math.hypot(a - x, b - y) } },
};

function criarVisual(scene) {
  const visual = Object.assign(new EventEmitter(), { scene, x: 0, y: 0, active: true });
  visual.setPosition = function (x, y) {
    this.posicionamentos = (this.posicionamentos || 0) + 1;
    Object.assign(this, { x, y }); return this;
  };
  visual.setScale = function (scaleX, scaleY = scaleX) {
    Object.assign(this, { scaleX, scaleY }); return this;
  };
  for (const nome of ["setScrollFactor", "setDepth", "setInteractive", "setStrokeStyle",
    "setAlpha", "setAngle", "fillStyle", "lineStyle", "beginPath", "moveTo", "lineTo",
    "closePath", "fillPath", "strokePath", "fillRoundedRect", "fillCircle"]) {
    visual[nome] = function () { return this; };
  }
  visual.destroy = function () { this.active = false; this.scene = null; this.removeAllListeners(); };
  return visual;
}

function criarCena(t) {
  const scene = {
    cameras: { main: {
      x: 0, y: 0, width: 850, height: 405, originX: 0.5, originY: 0.5,
      zoomX: 1, zoomY: 1, scrollX: 0, scrollY: 0,
    } },
    input: new EventEmitter(), events: new EventEmitter(),
    game: { events: new EventEmitter() }, scale: new EventEmitter(),
    teclasWASD: Object.fromEntries(["cima", "baixo", "esquerda", "direita"]
      .map(nome => [nome, { isDown: false }])),
    player: {
      active: true, body: { velocity: { x: 0, y: 0 } },
      anims: { play() {}, stop() {} },
      setVelocity(x, y) { Object.assign(this.body.velocity, { x, y }); },
    },
    speed: 200, time: { now: 1000 }, tweens: { add() {} },
    estamina: 100, estaminaMaxima: 100, direcaoAtual: "down",
    ultimaDirecaoDash: new Vector2(0, 1),
  };
  scene.add = Object.fromEntries(["circle", "graphics"].map(nome =>
    [nome, () => criarVisual(scene)]));
  criarJoystick(scene);
  t.after(() => scene.joystick.destroy());
  return scene;
}

function pressionar(scene, x = 100, y = 305, id = 1) {
  const pointer = { id, x, y, isDown: true, wasTouch: true };
  scene.joystick.base.emit("pointerdown", pointer);
  return pointer;
}
function mover(scene, pointer, x, y) {
  Object.assign(pointer, { x, y });
  scene.input.emit("pointermove", pointer);
}
function conferirDirecao(scene, x, y) {
  const direcao = obterDirecaoMovimento(scene);
  assert.ok(Math.abs(direcao.x - x) < 1e-10, `x: ${direcao.x}, esperado ${x}`);
  assert.ok(Math.abs(direcao.y - y) < 1e-10, `y: ${direcao.y}, esperado ${y}`);
}
function prepararDash(scene) {
  scene.estadoDash = {
    ativo: false, direcao: new Vector2(0, 1), proximoDash: 0,
    rastros: new Set(), efeitos: new Set(),
  };
}

test("dedo parado não oscila enquanto a câmera acompanha o jogador", t => {
  const scene = criarCena(t);
  const pointer = pressionar(scene, 130, 305);
  // Coordenadas de mundo antigas permanecem no ponteiro entre eventos do navegador.
  Object.assign(pointer, { worldX: -1400, worldY: 475 });
  for (let quadro = 0; quadro < 200; quadro++) {
    Object.assign(scene.cameras.main, { scrollX: quadro * 7, scrollY: -quadro * 3 });
    scene.joystick.layout(scene.cameras.main);
    scene.events.emit("preupdate");
    atualizarMovimento(scene);
    assert.deepEqual(scene.player.body.velocity, { x: 200, y: 0 });
    assert.equal(scene.joystick.thumb.x, 130);
    assert.equal(scene.joystick.thumb.y, 305);
  }
});

test("zona morta e histerese impedem movimento involuntário perto do centro", t => {
  const scene = criarCena(t);
  const pointer = pressionar(scene);
  for (const x of [100.2, 99.7, 102, 109, 110]) {
    mover(scene, pointer, x, 305);
    conferirDirecao(scene, 0, 0);
  }
  mover(scene, pointer, 111, 305);
  conferirDirecao(scene, 1, 0);
  for (const x of [109, 108, 107.1]) {
    mover(scene, pointer, x, 305);
    conferirDirecao(scene, 1, 0);
  }
  mover(scene, pointer, 107, 305);
  conferirDirecao(scene, 0, 0);
  mover(scene, pointer, 109, 305);
  conferirDirecao(scene, 0, 0);
});

for (const evento of ["pointerup", "pointerupoutside"]) {
  test(`${evento}: encerra o movimento e recentraliza o botão`, t => {
    const scene = criarCena(t);
    const pointer = pressionar(scene, 130, 305);
    atualizarMovimento(scene);
    pointer.isDown = false;
    scene.input.emit(evento, pointer);
    atualizarMovimento(scene);
    assert.deepEqual(scene.player.body.velocity, { x: 0, y: 0 });
    assert.equal(scene.joystick.pointer, null);
    assert.equal(scene.joystickPointerId, null);
    assert.equal(scene.joystick.thumb.x, scene.joystick.base.x);
  });
}

test("soltura perdida e toque cancelado não deixam uma direção presa", t => {
  const scene = criarCena(t);
  const pointer = pressionar(scene, 130, 305);
  pointer.isDown = false;
  pointer.wasCanceled = true;
  // Sem emitir pointerup: a checagem de estado precisa detectar a soltura.
  conferirDirecao(scene, 0, 0);
  pointer.isDown = true;
  mover(scene, pointer, 150, 305);
  conferirDirecao(scene, 0, 0);
});

test("outros dedos não alteram nem soltam o joystick e arrastar sobre ele não captura", t => {
  const scene = criarCena(t);
  const pointer = pressionar(scene, 130, 305);
  const ataque = pressionar(scene, 100, 330, 2);
  mover(scene, ataque, 100, 350);
  scene.input.emit("pointerup", ataque);
  conferirDirecao(scene, 1, 0);
  assert.equal(scene.joystick.pointer, pointer);
  scene.input.emit("pointerup", pointer);
  scene.joystick.base.emit("pointerover", ataque);
  mover(scene, ataque, 130, 305);
  conferirDirecao(scene, 0, 0);
});

for (const [emissor, evento] of [
  ["game", "blur"], ["game", "hidden"], ["scene", "pause"],
  ["scene", "sleep"], ["scale", "resize"],
]) {
  test(`${evento}: cancela a captura e exige um novo toque`, t => {
    const scene = criarCena(t);
    const pointer = pressionar(scene, 130, 305);
    const eventos = emissor === "game" ? scene.game.events :
      emissor === "scene" ? scene.events : scene.scale;
    eventos.emit(evento);
    mover(scene, pointer, 140, 305);
    conferirDirecao(scene, 0, 0);
    pressionar(scene, 130, 305);
    conferirDirecao(scene, 1, 0);
  });
}

test("menu, morte e bloqueio de movimento cancelam o toque até pressionar novamente", t => {
  const scene = criarCena(t);
  for (const flag of ["generatorMenuOpen", "morteEmAndamento", "movimentoBloqueado"]) {
    const pointer = pressionar(scene, 130, 305);
    scene[flag] = true;
    scene.events.emit("preupdate");
    scene[flag] = false;
    mover(scene, pointer, 150, 305);
    conferirDirecao(scene, 0, 0);
  }
});

test("zoom uniforme ou por eixo mantém direção, centro e raio visual", t => {
  const scene = criarCena(t);
  const pointer = pressionar(scene, 130, 345);
  for (const [zoomX, zoomY] of [[0.6, 0.6], [2, 2], [1.5, 0.8], [1, 1]]) {
    Object.assign(scene.cameras.main, { zoomX, zoomY });
    scene.joystick.layout(scene.cameras.main);
    conferirDirecao(scene, 0.6, 0.8);
    const { base, thumb } = scene.joystick;
    assert.ok(Math.abs((thumb.x - base.x) * zoomX - 30) < 1e-10);
    assert.ok(Math.abs((thumb.y - base.y) * zoomY - 40) < 1e-10);
    assert.equal(base.scaleX * zoomX, 1);
    assert.equal(base.scaleY * zoomY, 1);
    mover(scene, pointer, 130, 345);
    conferirDirecao(scene, 0.6, 0.8);
  }
});

test("o botão fica no raio máximo e a velocidade diagonal continua normalizada", t => {
  const scene = criarCena(t);
  const pointer = pressionar(scene);
  mover(scene, pointer, 400, 705);
  assert.equal(Math.hypot(scene.joystick.forceX, scene.joystick.forceY), 50);
  atualizarMovimento(scene);
  assert.equal(Math.hypot(...Object.values(scene.player.body.velocity)), 200);
});

test("mudanças de direção respondem no mesmo evento, sem suavização que atrase a soltura", t => {
  const scene = criarCena(t);
  const pointer = pressionar(scene);
  for (const [x, y] of [[1, 0], [0, -1], [-1, 0], [0, 1], [0, 0]]) {
    mover(scene, pointer, 100 + x * 40, 305 + y * 40);
    conferirDirecao(scene, x, y);
  }
});

test("botão direito e entrada desabilitada não iniciam movimento", t => {
  const scene = criarCena(t);
  const pointer = { id: 0, x: 130, y: 305, isDown: true,
    wasTouch: false, leftButtonDown: () => false };
  scene.joystick.base.emit("pointerdown", pointer);
  conferirDirecao(scene, 0, 0);
  pointer.leftButtonDown = () => true;
  scene.joystick.base.emit("pointerdown", pointer);
  conferirDirecao(scene, 1, 0);
  scene.input.enabled = false;
  scene.events.emit("preupdate");
  conferirDirecao(scene, 0, 0);
});

test("câmera com viewport deslocado e origem diferente usa coordenadas relativas", t => {
  const scene = criarCena(t);
  Object.assign(scene.cameras.main, { x: 50, y: 30, originX: 0.2, originY: 0.7, zoomX: 2 });
  scene.joystick.layout(scene.cameras.main);
  pressionar(scene, 180, 335);
  conferirDirecao(scene, 1, 0);
});

test("WASD tem prioridade, inclusive com teclas opostas, e reutiliza o vetor", t => {
  const scene = criarCena(t);
  pressionar(scene, 130, 305);
  const vetor = obterDirecaoMovimento(scene);
  scene.teclasWASD.esquerda.isDown = true;
  conferirDirecao(scene, -1, 0);
  scene.teclasWASD.direita.isDown = true;
  conferirDirecao(scene, 0, 0);
  scene.teclasWASD.esquerda.isDown = false;
  scene.teclasWASD.cima.isDown = true;
  conferirDirecao(scene, Math.SQRT1_2, -Math.SQRT1_2);
  assert.equal(obterDirecaoMovimento(scene), vetor);
});

test("dash usa a mesma direção da caminhada e ignora o toque já solto", t => {
  const scene = criarCena(t);
  const pointer = pressionar(scene, 130, 345);
  atualizarMovimento(scene);
  prepararDash(scene);
  assert.equal(iniciarDash(scene), true);
  assert.deepEqual(scene.player.body.velocity,
    { x: CONFIG_DASH.velocidade * 0.6, y: CONFIG_DASH.velocidade * 0.8 });

  scene.time.now += CONFIG_DASH.recarga;
  scene.estadoDash.ativo = false;
  scene.ultimaDirecaoDash = new Vector2(-1, 0);
  pointer.isDown = false; // A soltura não precisa de um evento para invalidar a direção.
  assert.equal(iniciarDash(scene), true);
  assert.deepEqual(scene.player.body.velocity, { x: -CONFIG_DASH.velocidade, y: 0 });
});

test("soltar o dedo do joystick não libera o ataque de outro dedo no Phaser", t => {
  const scene = criarCena(t);
  criarControlesAtaque(scene);
  const pointer = pressionar(scene, 130, 305);
  scene.pointerAtaque = 2;
  scene.botaoAtaque.setScale(0.92);
  scene.input.emit("pointerup", pointer);
  assert.equal(scene.pointerAtaque, 2);
  assert.equal(scene.botaoAtaque.scaleX, 0.92);
});

test("layout estável não reposiciona objetos a cada quadro", t => {
  const scene = criarCena(t);
  const antes = scene.joystick.base.posicionamentos;
  for (let i = 0; i < 100; i++) scene.joystick.layout(scene.cameras.main);
  assert.equal(scene.joystick.base.posicionamentos, antes);
});

test("recriar e encerrar a cena remove listeners e referências de toque antigos", t => {
  const scene = criarCena(t);
  const anterior = scene.joystick;
  const pointer = pressionar(scene, 130, 305);
  criarJoystick(scene);
  assert.equal(anterior.base.active, false);
  assert.equal(anterior.pointer, null);
  assert.equal(scene.input.listenerCount("pointermove"), 1);
  assert.equal(scene.game.events.listenerCount("blur"), 1);
  mover(scene, pointer, 150, 305);
  conferirDirecao(scene, 0, 0);
  scene.events.emit("shutdown");
  for (const emissor of [scene.input, scene.events, scene.game.events, scene.scale]) {
    assert.equal(emissor.eventNames().length, 0);
  }
  assert.equal(scene.joystick.base.active, false);
  assert.equal(scene.joystickPointerId, null);
});

test("um toque mínimo solicita o primeiro passo sem repetir por evento de movimento", t => {
  const scene = criarCena(t);
  let passos = 0;
  scene.solicitarPasso = () => passos++;
  const pointer = pressionar(scene);
  assert.equal(passos, 0);
  mover(scene, pointer, 100.1, 305);
  assert.equal(passos, 1);
  mover(scene, pointer, 100.2, 305);
  mover(scene, pointer, 130, 305);
  assert.equal(passos, 1);
  scene.input.emit("pointerup", pointer);
  pressionar(scene, 101, 305, 2);
  assert.equal(passos, 2);
});
