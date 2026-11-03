import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { obterSocketTeste, SOCKETS_TESTE_2, transformarPontoArma, camadaArmaTeste } from "./WeaponSocketsTeste.js";
import { PERSONAGEM_TESTE, FLORETE_PERSONAGEM_TESTE, ARMA_DOURADA_TESTE,
  ESPADA_PERSONAGEM_TESTE } from "./PersonagemTeste.js";
import { calcularPoseArmaTeste, criarArmaPersonagemTeste, atualizarArmaPersonagemTeste,
  atacarComArmaPersonagemTeste, dispararLaserPersonagemTeste } from "./ArmaPersonagemTeste.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`);
globalThis.Phaser = { BlendModes: { ADD: 1 } };

function cena() {
  const objeto = (x = 0, y = 0) => {
    const o = { x, y, active: true, visible: true, alpha: 1, depth: 0 };
    for (const method of ["setBlendMode", "setStrokeStyle", "clear", "lineStyle", "fillStyle", "fillTriangle", "lineBetween"])
      o[method] = () => o;
    o.setPosition = (x, y) => (Object.assign(o, { x, y }), o);
    o.setScale = (x, y = x) => (Object.assign(o, { scaleX: x, scaleY: y }), o);
    o.setOrigin = (x, y) => (Object.assign(o, { originX: x, originY: y }), o);
    for (const [m, k] of [["setRotation", "rotation"], ["setFlipX", "flipX"], ["setFlipY", "flipY"],
      ["setDepth", "depth"], ["setVisible", "visible"], ["setAlpha", "alpha"]]) o[m] = v => (o[k] = v, o);
    o.destroy = () => { o.active = false; };
    o.setTexture = () => o;
    return o;
  };
  const s = { personagemSelecionada: "personagem-teste-2", direcaoAtual: "right", vida: 100,
    player: Object.assign(objeto(50, 70), { displayOriginX: 120, displayOriginY: 130.5,
      scaleX: 64 / 240, scaleY: 64 / 240, rotation: 0, frame: { name: 0 },
      texture: { key: "personagem-teste-2-idle" }, body: { velocity: { x: 0, y: 0 } } }),
    time: { now: 0 }, events: new EventEmitter(), input: { keyboard: new EventEmitter() },
    game: { registry: new Map([["personagem-teste-2-arma-equipada", PERSONAGEM_TESTE.arma.id]]) },
    textures: { get: () => ({ has: () => true }) },
    add: { image: objeto, circle: objeto, rectangle: objeto, graphics: objeto } };
  criarArmaPersonagemTeste(s);
  return s;
}

test("24 poses medidas espelham a mão pela origem fixa da célula, incluindo escala e rotação", () => {
  const s = cena(), p = s.player;
  for (const tipo of ["idle", "walk"]) {
    p.texture.key = `personagem-teste-2-${tipo}`;
    for (let i = 0; i < (tipo === "idle" ? 8 : 16); i++) {
      p.frame.name = i;
      const local = SOCKETS_TESTE_2[tipo].quadros[i] ?? SOCKETS_TESTE_2[tipo].padrao;
      const direita = obterSocketTeste(s, false, PERSONAGEM_TESTE.arma);
      const esquerda = obterSocketTeste(s, true, PERSONAGEM_TESTE.arma);
      near(direita.x, p.x + (local.x - 120) * p.scaleX);
      near(esquerda.x, p.x + (120 - local.x) * p.scaleX);
      near(direita.y, p.y + (local.y - 130.5) * p.scaleY);
      near(esquerda.y, direita.y);
    }
  }
  p.rotation = Math.PI / 2;
  const a = obterSocketTeste(s, false, PERSONAGEM_TESTE.arma);
  p.rotation = 0;
  const b = obterSocketTeste(s, false, PERSONAGEM_TESTE.arma);
  near(a.x - p.x, -(b.y - p.y)); near(a.y - p.y, b.x - p.x);
  s.limparArmaPersonagemTeste();
});

test("as quatro armas giram pelo grip e suas pontas respeitam orientação e espelhamento", () => {
  for (const config of [PERSONAGEM_TESTE.arma, ESPADA_PERSONAGEM_TESTE, FLORETE_PERSONAGEM_TESTE, ARMA_DOURADA_TESTE]) {
    for (let i = 0; i < 16; i++) {
      const angulo = i * Math.PI / 8, s = cena();
      const pose = calcularPoseArmaTeste(s.player, { x: Math.cos(angulo), y: Math.sin(angulo) },
        null, 0, config, null, { obterMao: lado => obterSocketTeste(s, lado, config) });
      const grip = transformarPontoArma(config, pose, config.empunhadura);
      const ponta = transformarPontoArma(config, pose, config.cano);
      near(grip.x, pose.mao.x); near(grip.y, pose.mao.y);
      near(ponta.x, pose.cano.x); near(ponta.y, pose.cano.y);
      s.limparArmaPersonagemTeste();
    }
  }
});

test("recuo mantém o grip na mão; projétil nasce no cano sem alterar velocidade, dano ou cadência", () => {
  const s = cena(), e = s.armaPersonagemTeste, c = e.config;
  const inicial = { ...e.pose.mao };
  assert.ok(dispararLaserPersonagemTeste(s));
  const l = e.lasers[0];
  near(l.sprite.x, e.pose.cano.x); near(l.sprite.y, e.pose.cano.y);
  assert.equal(l.dano, c.danoLaser); assert.equal(l.velocidade, c.velocidadeLaser);
  assert.equal(l.alcance, c.alcanceLaser);
  const rotacao = e.sprite.rotation;
  for (const t of [20, 45, 70, 90]) {
    s.time.now = t; atualizarArmaPersonagemTeste(s, 0);
    near(e.pose.mao.x, inicial.x); near(e.pose.mao.y, inicial.y);
    assert.equal(dispararLaserPersonagemTeste(s), false);
    if (t === 45) assert.notEqual(e.sprite.rotation, rotacao);
    if (t === 90) near(e.sprite.rotation, rotacao);
  }
  s.limparArmaPersonagemTeste();
});

test("dourada conserva alcance, dano, cadência e dash do florete, com grip e orientação próprios", () => {
  const a = ARMA_DOURADA_TESTE, b = FLORETE_PERSONAGEM_TESTE;
  const alcance = c => Math.hypot(c.cano.x - c.empunhadura.x, c.cano.y - c.empunhadura.y) * c.largura / c.recorte.largura;
  near(alcance(a), alcance(b));
  assert.equal(a.dano, b.dano); assert.equal(a.intervaloDisparos, b.intervaloDisparos);
  assert.deepEqual(a.estocada, b.estocada);
  assert.notDeepEqual(a.empunhadura, b.empunhadura);
  assert.notEqual(a.anguloArte, b.anguloArte);
});

test("estocada mantém mão fixa; rastro termina no mesmo alcance varrido do golpe original", () => {
  for (const config of [FLORETE_PERSONAGEM_TESTE, ARMA_DOURADA_TESTE]) {
    const s = cena(), e = s.armaPersonagemTeste;
    e.config = config; atualizarArmaPersonagemTeste(s, 0);
    const mao = { ...e.pose.mao };
    assert.ok(atacarComArmaPersonagemTeste(s));
    for (let t = 10; t < 340; t += 10) {
      s.time.now = t; atualizarArmaPersonagemTeste(s, 0);
      near(e.pose.mao.x, mao.x); near(e.pose.mao.y, mao.y);
      near(Math.hypot(e.pose.pontaAtaque.x - e.pose.maoAtaque.x,
        e.pose.pontaAtaque.y - e.pose.maoAtaque.y),
      Math.hypot(config.cano.x - config.empunhadura.x, config.cano.y - config.empunhadura.y) * e.pose.escala);
    }
    s.limparArmaPersonagemTeste();
  }
});

test("profundidade usa mira no repouso e lâmina no corte, com histerese e retorno à frente", () => {
  const e = {};
  assert.ok(camadaArmaTeste(e, { anguloMira: 0, angulo: -0.6 }) > 0);
  assert.ok(camadaArmaTeste(e, { anguloMira: -Math.PI / 2 }) < 0);
  assert.ok(camadaArmaTeste(e, { anguloMira: -0.12 }) < 0);
  assert.ok(camadaArmaTeste(e, { anguloMira: 0 }) > 0);
  e.golpeEspada = {};
  assert.ok(camadaArmaTeste(e, { anguloMira: 0, angulo: -Math.PI / 2 }) < 0);
});

test("estocadas com mão medida acertam uma vez, respeitam preparo e são barradas por parede", () => {
  for (const config of [FLORETE_PERSONAGEM_TESTE, ARMA_DOURADA_TESTE]) {
    for (const bloqueada of [false, true]) {
      const s = cena(), e = s.armaPersonagemTeste;
      e.config = config;
      atualizarArmaPersonagemTeste(s, 0);
      const mao = { ...e.pose.mao };
      s.novoBoss = { active: true, visible: true, vida: 100, hitboxDano: {
        x: mao.x + 45, y: mao.y - 2, width: 4, height: 4 },
      receberDano(n) { this.vida -= n; return true; } };
      if (bloqueada) s.collisionGroup = { getChildren: () => [{ active: true,
        body: { enable: true, x: mao.x + 30, y: mao.y - 50, width: 3, height: 100 } }] };
      assert.ok(atacarComArmaPersonagemTeste(s));
      for (let t = 10; t <= 340; t += 10) {
        s.time.now = t; atualizarArmaPersonagemTeste(s, 0);
        if (t < config.estocada.preparo) assert.equal(s.novoBoss.vida, 100);
      }
      assert.equal(s.novoBoss.vida, bloqueada ? 100 : 100 - config.dano);
      s.limparArmaPersonagemTeste();
    }
  }
});
