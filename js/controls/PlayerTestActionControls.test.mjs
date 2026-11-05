/** Integra os controles reais de ataque/coleta com objetos Phaser simulados. */
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { criarControlesAcaoTeste } from "./PlayerTestActionControls.js";
import { criarControlesAtaque } from "./PlayerAttackControls.js";
import { criarSistemaInventario } from "../inventory/ItemPickup.js";
import { criarArmaPersonagemTeste } from "../player/ArmaPersonagemTeste.js";
import { PERSONAGEM_TESTE, PERSONAGEM_TESTE_2, ESPADA_PERSONAGEM_TESTE, FLORETE_PERSONAGEM_TESTE,
  ARMAS_PERSONAGEM_TESTE } from "../player/PersonagemTeste.js";

globalThis.Phaser = {
  BlendModes: { ADD: 1 },
  Geom: { Rectangle: class { static Contains() { return true; } } },
  Math: { Distance: { Between: (x, y, a, b) => Math.hypot(a - x, b - y) } },
  Input: { Keyboard: { KeyCodes: { E: 69 }, JustDown: () => false } },
  Scenes: { Events: { PRE_RENDER: "prerender", SHUTDOWN: "shutdown" } },
};

function visual(scene, x = 0, y = 0, key = "", frame) {
  const obj = Object.assign(new EventEmitter(), {
    x, y, scene, active: true, visible: true, alpha: 1, depth: 0, scaleX: 1, scaleY: 1,
    width: 32, height: 32, list: [],
    setTexture(key, frame) {
      this.texture = { key }; this.frame = { name: frame };
      const arma = [...ARMAS_PERSONAGEM_TESTE, ...PERSONAGEM_TESTE_2.armas]
        .find(arma => arma.textura === key);
      const r = arma?.recorte ?? (key === PERSONAGEM_TESTE.botaoAtaque.textura
        ? { largura: 454, altura: 454 } : key === PERSONAGEM_TESTE.botaoTroca.textura
        ? PERSONAGEM_TESTE.botaoTroca.recorte : { largura: 250, altura: 250 });
      this.width = r.largura; this.height = r.altura; return this;
    },
    setText(text) { this.text = text; return this; },
    setName(name) { this.name = name; return this; },
    setPosition(x, y) { Object.assign(this, { x, y }); return this; },
    setScale(x, y = x) { Object.assign(this, { scaleX: x, scaleY: y }); return this; },
    setDisplaySize(x, y) { return this.setScale(x / this.width, y / this.height); },
    setVisible(visible) { this.visible = visible; return this; },
    setDepth(depth) { this.depth = depth; return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; },
    setInteractive() { this.input = { enabled: true }; return this; },
    disableInteractive() { this.input.enabled = false; return this; },
    add(items) { this.list.push(...[items].flat()); return this; },
    removeAll() { this.list = []; return this; },
    destroy() { this.active = false; this.removeAllListeners(); },
  });
  for (const method of ["setScrollFactor", "setOrigin", "setRotation", "setFlipY", "setFlipX",
    "setStrokeStyle", "setBlendMode", "setAngle", "setTint", "clearTint", "fillStyle", "lineStyle",
    "beginPath", "moveTo", "lineTo", "closePath", "fillPath", "strokePath", "fillRoundedRect", "fillCircle"]) {
    obj[method] = () => obj;
  }
  if (key) obj.setTexture(key, frame);
  return obj;
}

function fixture(t, personagem = PERSONAGEM_TESTE.id) {
  const s = {
    personagemSelecionada: personagem, direcaoAtual: "right", vida: 100, vidaMaxima: 100, estamina: 100, estaminaMaxima: 100, inimigos: [],
    events: new EventEmitter(), input: Object.assign(new EventEmitter(), {
      keyboard: Object.assign(new EventEmitter(), { addKey: () => ({}) }) }),
    game: { registry: new Map(), events: new EventEmitter() },
    time: { now: 0, delayedCall: () => ({ remove() {} }) },
    cameras: { main: { width: 800, height: 450, originX: 0.5, originY: 0.5, zoomX: 1, zoomY: 1 } },
    map: { getObjectLayer: () => null },
    textures: { exists: () => true, get: () => ({ has: () => true }) },
  };
  s.add = Object.fromEntries(["image", "circle", "rectangle", "graphics", "container", "text"]
    .map(type => [type, (...args) => visual(s, ...args)]));
  s.player = visual(s); s.player.body = { velocity: { x: 0, y: 0 } };
  criarArmaPersonagemTeste(s);
  criarControlesAtaque(s);
  criarControlesAcaoTeste(s);
  criarSistemaInventario(s);
  t.after(() => s.events.emit("shutdown"));
  return s;
}
const pointer = id => ({ id, wasTouch: true, leftButtonDown: () => true });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);
function click(s, button, id = 1) {
  const p = pointer(id);
  button.emit("pointerdown", p);
  // O evento global recebe o objeto interativo que consumiu o toque.
  s.input.emit("pointerdown", p, [button]);
  s.input.emit("pointerup", p);
}
function colocarItem(s, x = 10) {
  s.itensColetaveis.push({ uniqueId: "teste:item", itemId: "sucata", quantity: 1,
    x, y: 0, range: 64, image: visual(s) });
}

test("ataque normal vira mão ao se aproximar e volta ao se afastar", t => {
  const s = fixture(t);
  colocarItem(s, 200);
  s.atualizarColetaItens();
  assert.equal(s.botaoAtaque.visible, true);
  assert.equal(s.botaoColetarItem.visible, false);
  s.player.x = 180;
  s.atualizarColetaItens();
  assert.equal(s.botaoAtaque.visible, false);
  assert.equal(s.iconeAtaque.visible, false);
  assert.equal(s.botaoColetarItem.visible, true);
  s.player.x = 0;
  s.atualizarColetaItens();
  assert.equal(s.botaoAtaque.visible, true);
  assert.equal(s.botaoColetarItem.visible, false);
});

test("mão coleta sem disparar e o próximo toque no ataque dispara um único laser", t => {
  const s = fixture(t);
  colocarItem(s);
  s.atualizarColetaItens();
  click(s, s.botaoColetarItem);
  assert.equal(s.inventory.getQuantity("sucata"), 1);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
  assert.equal(s.botaoAtaque.visible, true);
  click(s, s.botaoAtaque, 2);
  assert.equal(s.armaPersonagemTeste.lasers.length, 1);
});

test("inventário cheio mantém a mão disponível sem deixar o toque disparar", t => {
  const s = fixture(t);
  colocarItem(s);
  s.inventory.addItem = () => false;
  s.atualizarColetaItens();
  click(s, s.botaoColetarItem);
  assert.equal(s.itensColetaveis.length, 1);
  assert.equal(s.botaoColetarItem.visible, true);
  assert.equal(s.botaoAtaque.visible, false);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
});

test("porta e gerador usam o mesmo botão sem disparo acidental", t => {
  const s = fixture(t);
  let porta = 0, gerador = 0;
  s.interacaoMundoProxima = { distance: 20, interact: () => {
    porta++; s.interacaoMundoProxima = null; return true;
  } };
  s.atualizarColetaItens();
  click(s, s.botaoColetarItem);
  assert.equal(porta, 1);
  assert.equal(s.botaoAtaque.visible, true);
  s.geradorInteracaoDisponivel = true;
  s.interagirGerador = () => { gerador++; s.generatorMenuOpen = true; return true; };
  s.atualizarColetaItens();
  click(s, s.botaoColetarItem);
  s.events.emit("prerender");
  assert.equal(gerador, 1);
  assert.equal(s.botaoAtaque.visible, false);
  assert.equal(s.botaoColetarItem.visible, false);
  assert.equal(s.botaoTrocaArma.visible, false);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
});

test("troca é clicável no centro, exibe o PNG da arma e não ataca", t => {
  const s = fixture(t);
  assert.equal(s.botaoTrocaArma.texture.key, PERSONAGEM_TESTE.botaoTroca.textura);
  assert.equal(s.iconeTrocaArma.texture.key, PERSONAGEM_TESTE.arma.textura);
  assert.equal(s.iconeTrocaArma.frame.name, "arma");
  near(s.botaoTrocaArma.x, 730); near(s.botaoTrocaArma.y, 260);
  near(s.iconeTrocaArma.x, 730); near(s.iconeTrocaArma.y, 260);
  near(s.iconeTrocaArma.width * s.iconeTrocaArma.scaleX, 32);
  assert.ok(s.iconeTrocaArma.height * s.iconeTrocaArma.scaleY <= 24);
  click(s, s.botaoTrocaArma);
  assert.equal(s.armaPersonagemTeste.config, ESPADA_PERSONAGEM_TESTE);
  assert.equal(s.iconeTrocaArma.texture.key, ESPADA_PERSONAGEM_TESTE.textura);
  assert.ok(s.iconeTrocaArma.width * s.iconeTrocaArma.scaleX <= 32);
  assert.ok(s.iconeTrocaArma.height * s.iconeTrocaArma.scaleY <= 24);
  assert.equal(s.armaPersonagemTeste.lasers.length, 0);
});

test("troca atualiza tanto a arma equipada quanto o PNG central", t => {
  const extra = { ...PERSONAGEM_TESTE.arma, id: "extra", textura: "arma-extra" };
  ARMAS_PERSONAGEM_TESTE.push(extra);
  t.after(() => ARMAS_PERSONAGEM_TESTE.pop());
  const s = fixture(t);
  click(s, s.botaoTrocaArma);
  click(s, s.botaoTrocaArma);
  assert.equal(s.armaPersonagemTeste.config, extra);
  assert.equal(s.iconeTrocaArma.texture.key, extra.textura);
  assert.equal(s.game.registry.get("personagem-teste-arma-equipada"), extra.id);
});

test("mão e troca mantêm posição e proporção com zoom uniforme e por eixo", t => {
  const s = fixture(t);
  colocarItem(s); s.atualizarColetaItens();
  for (const [x, y] of [[1, 1], [0.7, 0.7], [1.8, 1.8], [0.8, 1.4]]) {
    const c = s.cameras.main; c.zoomX = x; c.zoomY = y;
    s.events.emit("prerender");
    const screen = obj => ({ x: 400 + (obj.x - 400) * x, y: 225 + (obj.y - 225) * y });
    assert.deepEqual(screen(s.botaoColetarItem), screen(s.botaoAtaque));
    near(screen(s.botaoTrocaArma).x, 730); near(screen(s.botaoTrocaArma).y, 260);
    assert.deepEqual(screen(s.iconeTrocaArma), screen(s.botaoTrocaArma));
    near(s.iconeTrocaArma.width * s.iconeTrocaArma.scaleX * x, 32);
    near(s.botaoTrocaArma.width * s.botaoTrocaArma.scaleX * x, 60);
    near(s.botaoAtaque.width * s.botaoAtaque.scaleX * x, 92);
    near(s.botaoColetarItem.width * s.botaoColetarItem.scaleX * x, 92);
    near(s.botaoColetarItem.height * s.botaoColetarItem.scaleY * y, 92);
    assert.equal(s.botaoAtaque.texture.key, PERSONAGEM_TESTE.botaoAtaque.textura);
    assert.equal(s.botaoColetarItem.texture.key, PERSONAGEM_TESTE.botaoAcao.textura);
  }
});

test("outro dedo não solta o botão de troca e blur cancela o pressionamento", t => {
  const s = fixture(t), b = s.botaoTrocaArma;
  const escala = b.scaleX;
  b.emit("pointerdown", pointer(3));
  near(b.scaleX, escala * 0.92);
  s.input.emit("pointerup", pointer(9));
  near(b.scaleX, escala * 0.92);
  s.game.events.emit("blur");
  near(b.scaleX, escala);
});

test("recriar controles remove eventos e botões anteriores", t => {
  const s = fixture(t), anterior = s.botaoTrocaArma;
  const listeners = s.input.listenerCount("pointerup");
  criarControlesAcaoTeste(s);
  assert.equal(anterior.active, false);
  assert.equal(s.input.listenerCount("pointerup"), listeners);
  s.events.emit("shutdown");
  assert.equal(s.botaoTrocaArma, null);
  assert.equal(s.input.listenerCount("pointerup"), 0);
  assert.equal(s.game.events.listenerCount("blur"), 0);
});

test("nova personagem mostra as quatro armas e mantém interação contextual", t => {
  const s = fixture(t, PERSONAGEM_TESTE_2.id);
  assert.equal(s.armaPersonagemTeste.config, ESPADA_PERSONAGEM_TESTE);
  assert.equal(s.botaoTrocaArma.visible, true);
  assert.equal(s.iconeTrocaArma.visible, true);
  click(s, s.botaoTrocaArma);
  assert.equal(s.armaPersonagemTeste.config, FLORETE_PERSONAGEM_TESTE);
  assert.equal(s.iconeTrocaArma.texture.key, FLORETE_PERSONAGEM_TESTE.textura);
  assert.equal(s.game.registry.get("personagem-teste-2-arma-equipada"), FLORETE_PERSONAGEM_TESTE.id);
  assert.ok(s.iconeTrocaArma.width * s.iconeTrocaArma.scaleX <= 32);
  assert.ok(s.iconeTrocaArma.height * s.iconeTrocaArma.scaleY <= 24);
  click(s, s.botaoTrocaArma); // rifle
  click(s, s.botaoTrocaArma); // dourada
  click(s, s.botaoTrocaArma); // espada
  colocarItem(s); s.atualizarColetaItens(); s.events.emit("prerender");
  assert.equal(s.botaoAtaque.visible, false);
  click(s, s.botaoColetarItem);
  assert.equal(s.armaPersonagemTeste.golpeEspada, null);
  assert.equal(s.botaoAtaque.visible, true);
  click(s, s.botaoAtaque);
  assert.equal(s.armaPersonagemTeste.golpeEspada.config.id, "slash-3");
});

test("personagens originais mantêm ataque e mão separados e não recebem troca", t => {
  const s = fixture(t, "kai-mercer");
  colocarItem(s); s.atualizarColetaItens(); s.events.emit("prerender");
  assert.equal(s.botaoTrocaArma, undefined);
  assert.equal(s.botaoAtaque.visible, true);
  assert.equal(s.botaoColetarItem.visible, true);
  near(s.botaoColetarItem.x, 730); near(s.botaoColetarItem.y, 260);
});

test("losango mostra o custo da arma equipada e acompanha a troca sem atacar", t => {
  const s = fixture(t);
  assert.equal(s.textoCustoArmaTeste.text, "3");
  click(s, s.botaoTrocaArma); assert.equal(s.textoCustoArmaTeste.text, "1");
  assert.equal(s.estamina, 100);
  assert.equal(s.armaPersonagemTeste.golpeEspada, null);
  assert.equal(s.inventory.getQuantity("toxina-de-cura"), 1);
  assert.equal(s.inventory.getQuantity("comprimidos-de-desempenho"), 1);
});
