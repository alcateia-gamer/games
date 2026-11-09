import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { criarRoboBola, atualizarRoboBola, registrarAnimacoesRoboBola, ROBO_BOLA_CONFIG } from "./RoboBola.js";
import { caminhoMovimentoBloqueado } from "./EnemyPathfinding.js";
import { destruirInimigoTeste } from "./EnemyHealth.js";
import { criarBrilhoOlho, suavizarTexturasRoboBola } from "./RoboBolaEffects.js";

globalThis.Phaser = { Geom: { Rectangle: class {
  constructor(x, y, width, height) { this.setTo(x, y, width, height); }
  setTo(x, y, width, height) { Object.assign(this, { x, y, width, height }); }
} }, BlendModes: { ADD: 1 }, Textures: { FilterMode: { LINEAR: 0 } }, Math: {
  Distance: { Between: (x, y, a, b) => Math.hypot(a - x, b - y) },
  Angle: { Between: (x, y, a, b) => Math.atan2(b - y, a - x) },
  Clamp: (n, min, max) => Math.max(min, Math.min(n, max)),
} };

function preparar() {
  const clips = new Map();
  const tiros = [];
  const efeitos = [];
  const robo = Object.assign(new EventEmitter(), {
    active: true, tipoRobo: "bola", x: 100, y: 200,
    scaleX: 0.56, scaleY: 0.56, originX: 0.5, originY: 0.5,
    direcaoAtual: "down", frame: { name: 0 }, tempoOnda: 0,
    ultimoTiro: 0, danoLaser: 10, velocidadeLaser: 280,
    configBola: { ...ROBO_BOLA_CONFIG }, velocidade: ROBO_BOLA_CONFIG.velocidade,
    body: { enable: true, velocity: { x: 0, y: 0 },
      width: 33.6, height: 33.6, offset: { x: 33.5, y: 33.5 },
      setOffset(x, y) { this.offset = { x, y }; return this; },
    },
    hitboxDano: { setTo(x, y, width, height) { Object.assign(this, { x, y, width, height }); } },
    anims: {
      stop() {},
      play(key) { this.clip = clips.get(key); },
    },
    setVelocity(x, y) { this.body.velocity = { x, y }; },
    setOrigin(x, y) { this.originX = x; this.originY = y; return this; },
    setScale(scale) { this.scaleX = scale; this.scaleY = scale; return this; },
    setFlipX(value) { this.flipX = value; },
    setFrame(name) { this.frame = { name }; },
    setDepth() {},
    clearTint() {},
    setTexture(key, name) { this.texture = key; this.setFrame(name); },
  });
  Object.defineProperties(robo.body, {
    x: { get: () => robo.x - robo.originX * 127 * robo.scaleX + robo.body.offset.x * robo.scaleX },
    y: { get: () => robo.y - robo.originY * 127 * robo.scaleY + robo.body.offset.y * robo.scaleY },
  });
  const scene = {
    inimigos: [robo], inimigoTeste: robo,
    player: { x: 100, y: 335, active: true, body: { velocity: { x: 0, y: 0 } } },
    sound: { play() {} }, time: { now: 0, delayedCall() {} }, events: new EventEmitter(),
    anims: {
      exists: (key) => clips.has(key),
      create: (clip) => clips.set(clip.key, clip),
      generateFrameNumbers: (key, { start, end }) =>
        Array.from({ length: end - start + 1 }, (_, i) => ({ key, frame: start + i })),
    },
    lasersInimigo: { add: (tiro) => tiros.push(tiro) },
    add: { graphics() {
      const g = { active: true, destroy() { this.active = false; } };
      for (const method of ["setBlendMode", "clear", "setDepth", "fillStyle", "fillCircle", "lineStyle", "lineBetween", "strokeCircle"]) {
        g[method] = function () { return this; };
      }
      efeitos.push(g);
      return g;
    }, rectangle(x, y, width, height) {
      return Object.assign(new EventEmitter(), {
        active: true, x, y, width, height,
        setRotation(value) { this.rotation = value; return this; },
        setDepth() { return this; }, setStrokeStyle() { return this; },
        setOrigin() { return this; }, setPosition(x, y) { this.x = x; this.y = y; return this; },
        destroy() { this.emit("destroy"); this.active = false; },
      });
    } },
    physics: {
      moveTo(robo, x, y, speed) {
        const d = Math.max(1, Math.hypot(x - robo.x, y - robo.y));
        robo.setVelocity((x - robo.x) / d * speed, (y - robo.y) / d * speed);
      },
      add: { existing(tiro) {
        tiro.body = { velocity: {}, setAllowGravity() {}, setSize() {}, updateFromGameObject() {} };
      } },
      velocityFromRotation(angle, speed, velocity) {
        velocity.x = Math.cos(angle) * speed;
        velocity.y = Math.sin(angle) * speed;
      },
    },
  };
  registrarAnimacoesRoboBola(scene);
  return { scene, robo, tiros, efeitos };
}

function disparar(scene) {
  atualizarRoboBola(scene, 1100, 16);
  atualizarRoboBola(scene, 1340, 16);
}

test("cada pose viva explode apenas na linha correspondente, mesmo com direção lógica alterada", () => {
  for (const [direcao, x, y, vivo, morte] of [
    ["down", 0, 135, 1, 0], ["left", -135, 0, 3, 8],
    ["right", 135, 0, 4, 12], ["up", 0, -135, 2, 4],
  ]) {
    const { scene, robo } = preparar();
    scene.player.x = robo.x + x;
    scene.player.y = robo.y + y;
    robo.direcaoAtual = direcao;
    disparar(scene);
    assert.equal(robo.frame.name, vivo, direcao);
    assert.equal(robo.flipX, false);
    robo.direcaoAtual = "down"; // Simula uma alteração lógica antes de redesenhar.
    destruirInimigoTeste(scene, robo);
    assert.equal(robo.direcaoMorte, direcao);
    assert.equal(robo.frame.name, morte);
    assert.deepEqual(robo.anims.clip.frames.map((f) => f.frame), [morte, morte + 1, morte + 2, morte + 3]);
    atualizarRoboBola(scene, 1200, 16);
    assert.equal(robo.frame.name, morte, "a IA não altera a pose após morrer");
    assert.equal(robo.scaleX, 0.56);
    assert.equal(robo.body.enable, false);
  }
});

test("ruído nas diagonais não faz a pose oscilar, mas a mira acompanha mudanças reais", () => {
  const { scene, robo } = preparar();
  robo.direcaoAtual = "right";
  function mirar(graus) {
    scene.player.x = robo.x + Math.cos(graus * Math.PI / 180) * 230;
    scene.player.y = robo.y + Math.sin(graus * Math.PI / 180) * 230;
    atualizarRoboBola(scene, 100, 16);
  }
  for (const angulo of [43, 46, 44, 48, 45, 54]) {
    mirar(angulo);
    assert.equal(robo.direcaoAtual, "right");
  }
  mirar(60);
  assert.equal(robo.direcaoAtual, "down");
  for (const angulo of [48, 44, 46, 40]) {
    mirar(angulo);
    assert.equal(robo.direcaoAtual, "down");
  }
  mirar(20);
  assert.equal(robo.direcaoAtual, "right");
  const lembranca = { ...robo.iaUltimaPosicao };
  mirar(180);
  assert.deepEqual(robo.iaUltimaPosicao, lembranca, "não revela o alvo que saiu do campo frontal");
});

test("tiro fino e alongado nasce no olho de cada pose e aponta para o alvo", () => {
  for (const [dx, dy, olhoX, olhoY] of [
    [0, 135, 63, 59], [-135, 0, 40, 56], [135, 0, 87, 56], [0, -135, 63, 43],
  ]) {
    const { scene, robo, tiros } = preparar();
    scene.player.x = robo.x + dx;
    scene.player.y = robo.y + dy;
    robo.direcaoAtual = dx > 0 ? "right" : dx < 0 ? "left" : dy < 0 ? "up" : "down";
    disparar(scene);
    const tiro = tiros[0];
    const x = robo.x + (olhoX - 63.5) * 0.56;
    const y = robo.y + (olhoY - robo.originY * 127) * 0.56 + 2;
    assert.equal(tiro.width, 16);
    assert.equal(tiro.height, 3);
    assert.ok(Math.abs(tiro.x - Math.cos(tiro.rotation) * 8 - x) < 1e-9);
    assert.ok(Math.abs(tiro.y - Math.sin(tiro.rotation) * 8 - y) < 1e-9);
    assert.ok(Math.abs(tiro.rotation - Math.atan2(scene.player.y - y, scene.player.x - x)) < 1e-9);
    const frame = robo.frame.name;
    atualizarRoboBola(scene, 1440, 16);
    assert.equal(robo.frame.name, frame, "mantém o pulso frontal por 150ms e as demais poses fixas");
  }
});

test("órbita mantém distância e velocidade limitadas sem trocas repetidas na mesma diagonal", () => {
  const { scene, robo } = preparar();
  robo.ultimoTiro = Infinity;
  const trocas = [];
  let direcaoAnterior;
  for (let time = 0; time < 12000; time += 16) {
    atualizarRoboBola(scene, time, 16);
    const v = robo.body.velocity;
    assert.equal(robo.hitboxDano.width, 60 * robo.scaleX);
    assert.equal(robo.hitboxDano.height, 60 * robo.scaleY);
    assert.ok(Math.abs(robo.hitboxDano.x + robo.hitboxDano.width / 2 - robo.x) < 1e-9);
    assert.ok(Math.hypot(v.x, v.y) <= 145.001);
    robo.x += v.x * 0.016;
    robo.y += v.y * 0.016;
    const distancia = Math.hypot(robo.x - scene.player.x, robo.y - scene.player.y);
    assert.ok(distancia > 115 && distancia < 155, `distância ${distancia}`);
    if (direcaoAnterior !== robo.direcaoAtual) {
      trocas.push(time);
      direcaoAnterior = robo.direcaoAtual;
    }
  }
  assert.ok(trocas.length >= 3 && trocas.length <= 8);
  for (let i = 1; i < trocas.length; i++) {
    assert.ok(trocas[i] - trocas[i - 1] > 500, "não troca de pose em sequência rápida");
  }
});

test("cenário da imagem: alvo à direita e abaixo usa o olho da borda direita", () => {
  const { scene, robo, tiros } = preparar();
  scene.player.x = robo.x + 135;
  scene.player.y = robo.y + 45;
  disparar(scene);
  assert.equal(robo.frame.name, 4, "não usa o perfil esquerdo (frame 3)");
  const tiro = tiros[0];
  assert.ok(tiro.body.velocity.x > 0 && tiro.body.velocity.y > 0);
  assert.ok(tiro.x - Math.cos(tiro.rotation) * 8 > robo.x, "origem na face voltada ao alvo");
});

test("recua assim que o jogador avança e mantém o olho no alvo em qualquer direção", () => {
  for (const [dx, dy, frame] of [[1, 0, 4], [-1, 0, 3], [0, 1, 0], [0, -1, 2]]) {
    const { scene, robo } = preparar();
    robo.ultimoTiro = Infinity;
    scene.player.x = robo.x + dx * 135;
    scene.player.y = robo.y + dy * 135;
    robo.direcaoAtual = dx > 0 ? "right" : dx < 0 ? "left" : dy < 0 ? "up" : "down";
    scene.player.body.velocity = { x: -dx * 200, y: -dy * 200 };
    // Mesmo que estivesse aproximando, cancela o avanço e inicia a fuga.
    robo.body.velocity = { x: dx * 145, y: dy * 145 };
    for (let time = 0; time < 300; time += 16) {
      atualizarRoboBola(scene, time, 16);
      assert.equal(robo.recuando, true);
      assert.ok(robo.body.velocity.x * dx + robo.body.velocity.y * dy <= 1e-9);
      assert.equal(robo.frame.name, frame);
    }
    const recuo = -(robo.body.velocity.x * dx + robo.body.velocity.y * dy);
    assert.ok(recuo > 100 && recuo <= 175, `recuo moderado: ${recuo}`);
  }
});

test("carrega antes de atirar, cancela a carga atrás de parede e não atira além do alcance", () => {
  const { scene, robo, tiros } = preparar();
  atualizarRoboBola(scene, 1100, 16);
  assert.equal(robo.estadoBola, "mirando");
  atualizarRoboBola(scene, 1220, 16);
  assert.equal(robo.cargaTiro, 0.5);
  assert.equal(tiros.length, 0);
  scene.collisionGroup = { getChildren: () => [{ body: { x: 50, y: 250, width: 100, height: 10 } }] };
  atualizarRoboBola(scene, 1340, 16);
  assert.equal(tiros.length, 0);
  assert.equal(robo.inicioCarga, null);
  scene.collisionGroup = null;
  atualizarRoboBola(scene, 1400, 16);
  atualizarRoboBola(scene, 1640, 16);
  assert.equal(tiros.length, 1);
  scene.player.y = robo.y + 500;
  atualizarRoboBola(scene, 5000, 16);
  assert.equal(robo.estadoBola, "aproximando");
  assert.equal(tiros.length, 1);
});

test("muda a órbita ao encontrar parede, sem alternar a cada atualização", () => {
  const { scene, robo } = preparar();
  robo.sentidoOrbita = 1;
  robo.proximaManobra = 9000;
  robo.body.blocked = { left: true };
  atualizarRoboBola(scene, 100, 16);
  assert.equal(robo.sentidoOrbita, -1);
  atualizarRoboBola(scene, 116, 16);
  assert.equal(robo.sentidoOrbita, -1);
});

test("efeitos seguem a reflexão e são removidos com projétil, robô e cena", () => {
  const { scene, robo, tiros, efeitos } = preparar();
  criarBrilhoOlho(scene, robo, () => ({ x: 100, y: 200 }));
  disparar(scene);
  assert.equal(scene.events.listenerCount("postupdate"), 2);
  tiros[0].body.velocity = { x: -530, y: 0 };
  scene.events.emit("postupdate");
  assert.equal(tiros[0].rotation, Math.PI);
  tiros[0].destroy();
  assert.equal(scene.events.listenerCount("postupdate"), 1);
  assert.equal(efeitos[1].active, false);
  destruirInimigoTeste(scene, robo);
  assert.equal(scene.events.listenerCount("postupdate"), 0);
  assert.equal(efeitos[0].active, false);
  assert.equal(scene.events.listenerCount("shutdown"), 0);
});

test("suavização é local e não altera texturas de outros personagens", () => {
  const alteradas = [];
  suavizarTexturasRoboBola({ textures: {
    exists: () => true,
    get: (key) => ({ setFilter: (filter) => alteradas.push([key, filter]) }),
  } });
  assert.deepEqual(alteradas, [["robo-bola", 0], ["robo-bola-morte", 0]]);
});

test("afasta-se se o jogador estiver perto demais, mesmo parado ou sobreposto", () => {
  for (const distancia of [70, 0]) {
    const { scene, robo } = preparar();
    scene.player.y = robo.y + distancia;
    atualizarRoboBola(scene, 100, 16);
    assert.equal(robo.recuando, true);
    assert.ok(robo.body.velocity.y < 0);
    assert.ok(Number.isFinite(robo.body.velocity.x));
  }
});

function iniciarVigia(scene, robo) {
  // Inicializa o mesmo estado de patrulha dos outros robôs, sem escolher destinos aleatórios.
  scene.player.y = robo.y + 2000;
  atualizarRoboBola(scene, 0, 16);
  robo.iaProximoPatrulha = Infinity;
  robo.iaProximaVirada = Infinity;
}

test("visão frontal: não adquire jogador atrás de si, de paredes ou fora do alcance", () => {
  for (const modo of ["costas", "parede", "distante"]) {
    const { scene, robo, tiros } = preparar();
    iniciarVigia(scene, robo);
    scene.player.y = robo.y + (modo === "costas" ? -135 : modo === "distante" ? 900 : 135);
    if (modo === "parede") scene.collisionGroup = {
      getChildren: () => [{ body: { x: 30, y: 250, width: 140, height: 20, enable: true } }],
    };
    for (const time of [100, 400, 1400]) atualizarRoboBola(scene, time, 16);
    assert.equal(robo.iaEstado, "patrulha", modo);
    assert.equal(robo.iaUltimaPosicao, null, modo);
    assert.equal(tiros.length, 0, modo);
  }
});

test("busca a última posição vista por A*, sem atualizar a pista pela posição escondida", () => {
  const { scene, robo, tiros } = preparar();
  robo.direcaoAtual = "right";
  robo.ultimoTiro = Infinity;
  scene.player.x = 330;
  scene.player.y = 200;
  atualizarRoboBola(scene, 0, 16);
  const pista = { ...robo.iaUltimaPosicao };
  assert.deepEqual(pista, { x: 330, y: 200 });
  scene.collisionGroup = {
    getChildren: () => [{ body: { x: 185, y: 120, width: 30, height: 160, enable: true } }],
  };
  scene.player.y = 260;
  atualizarRoboBola(scene, 300, 16);
  assert.deepEqual(robo.iaUltimaPosicao, pista);
  assert.ok(robo.rotaAtual.length > 0, "calcula rota contornando o objeto");
  // O jogador se afasta enquanto está oculto; o robô só pode usar a pista anterior.
  scene.player.x = 2500;
  scene.player.y = 260;
  let chegou = false;
  for (let time = 316; time < 8000; time += 16) {
    atualizarRoboBola(scene, time, 16);
    const v = robo.body.velocity;
    const proximo = { x: robo.x + v.x * 0.016, y: robo.y + v.y * 0.016 };
    assert.equal(caminhoMovimentoBloqueado(scene, robo, proximo), false, "não corta quinas");
    robo.x = proximo.x;
    robo.y = proximo.y;
    assert.deepEqual(robo.iaUltimaPosicao, pista);
    if (Math.hypot(robo.x - pista.x, robo.y - pista.y) <= 22) { chegou = true; break; }
  }
  assert.ok(chegou, "chega à última posição vista");
  assert.equal(tiros.length, 0);
  atualizarRoboBola(scene, 9100, 16);
  assert.equal(robo.iaEstado, "investigar");
  atualizarRoboBola(scene, 13000, 16);
  assert.equal(robo.iaEstado, "retorno", "desiste após procurar por tempo limitado");
});

test("vigia parado continua levitando sem deslocar o corpo de colisão", () => {
  const { scene, robo } = preparar();
  iniciarVigia(scene, robo);
  scene.player.y = robo.y - 200;
  atualizarRoboBola(scene, 100, 16);
  const origem = robo.originY;
  const corpo = { x: robo.body.x, y: robo.body.y };
  atualizarRoboBola(scene, 450, 16);
  assert.notEqual(robo.originY, origem);
  assert.ok(Math.abs(robo.deslocamentoFlutuacao) <= 2.5);
  assert.ok(Math.abs(robo.body.x - corpo.x) < 1e-9);
  assert.ok(Math.abs(robo.body.y - corpo.y) < 1e-9);
  assert.deepEqual(robo.body.velocity, { x: 0, y: 0 });
  assert.deepEqual({ x: robo.x, y: robo.y }, { x: 100, y: 200 });
});

test("cada spawn cria outro robô sem sobrepor aliados nem obstáculos", (t) => {
  t.mock.method(Math, "random", () => 0.5);
  const { scene } = preparar();
  scene.inimigos = [];
  scene.textures = { exists: () => true, get: () => ({ setFilter() {} }) };
  scene.collisionGroup = { getChildren: () => [
    { body: { x: -60, y: 290, width: 90, height: 90, enable: true } },
  ] };
  const colliders = [];
  scene.physics.add.collider = () => {
    const collider = { active: true, destroy() { this.active = false; } };
    colliders.push(collider);
    return collider;
  };
  scene.physics.add.sprite = (x, y) => {
    const robo = preparar().robo;
    robo.x = x; robo.y = y;
    robo.body.setAllowGravity = () => {};
    robo.body.updateFromGameObject = () => {};
    robo.body.setSize = function (w, h) { this.width = w * robo.scaleX; this.height = h * robo.scaleY; return this; };
    return robo;
  };
  const robos = Array.from({ length: 4 }, () => criarRoboBola(scene));
  assert.equal(new Set(robos).size, 4);
  assert.equal(scene.inimigos.length, 4);
  for (const robo of robos) {
    assert.equal(caminhoMovimentoBloqueado(scene, robo, robo), false);
    for (const outro of robos) {
      if (outro !== robo) assert.ok(Math.hypot(robo.x - outro.x, robo.y - outro.y) >= 50);
    }
  }
  assert.equal(colliders.length, 10, "seis pares e quatro colisores de cenário");
  for (const robo of robos) robo.emit("destroy");
  assert.ok(colliders.every(c => !c.active));
  scene.events.emit("shutdown");
});

test("posição explícita rejeita parede, jogador e aliados antes de criar recursos", () => {
  const { scene } = preparar();
  scene.collisionGroup = { getChildren: () => [
    { body: { x: 400, y: 400, width: 80, height: 80, enable: true } },
  ] };
  scene.physics.add.sprite = () => { throw new Error("Não deve criar sprite"); };
  assert.equal(criarRoboBola(scene, { x: 430, y: 430 }), null);
  assert.equal(criarRoboBola(scene, scene.player), null);
  assert.equal(criarRoboBola(scene, { x: scene.inimigos[0].x, y: scene.inimigos[0].y }), null);
  assert.equal(criarRoboBola(scene, { x: NaN, y: 0 }), null);
});

test("proteção de spawn impede movimentação e disparo instantâneos sem alterar a IA normal", () => {
  const { scene, robo, tiros } = preparar();
  const depths = [];
  robo.setDepth = depth => depths.push(depth);
  robo.prologoProtegidoAte = 2000;
  atualizarRoboBola(scene, 1999, 16);
  assert.deepEqual(robo.body.velocity, { x: 0, y: 0 });
  assert.equal(tiros.length, 0);
  assert.equal(depths.length, 1, "continua visível na profundidade correta durante a proteção");
  atualizarRoboBola(scene, 2100, 16);
  assert.ok(Math.hypot(robo.body.velocity.x, robo.body.velocity.y) > 0);
});
