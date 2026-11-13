import { criarStatusPlayer } from "../player/PlayerStatus.js";
/** Exercita os ataques reais; o encontro substituto só registra seu contrato de dano. */
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { criarPlayer, atacar, soltarAtaque } from "../player/Player.js";
import { dispararProjetil, atualizarProjeteis } from "../player/PlayerProjectiles.js";
import { criarSistemaEspeciais, atualizarSistemaEspeciais } from "./PlayerSpecialAbilities.js";

class Rectangle {
  constructor(x, y, width, height) { this.setTo(x, y, width, height); }
  setTo(x, y, width, height) { Object.assign(this, { x, y, width, height }); return this; }
  get left() { return this.x; }
  get right() { return this.x + this.width; }
  get top() { return this.y; }
  get bottom() { return this.y + this.height; }
}
globalThis.Phaser = {
  BlendModes: { ADD: 1, NORMAL: 0 }, TintModes: { FILL: 1, MULTIPLY: 0 },
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
  Math: { Clamp: (v, min, max) => Math.min(max, Math.max(min, v)),
    FloatBetween: (a, b) => (a + b) / 2, Between: (a, b) => Math.floor((a + b) / 2),
    Angle: { Between: (x, y, a, b) => Math.atan2(b - y, a - x) } },
  Geom: { Rectangle, Intersects: { RectangleToRectangle: (a, b) =>
    a.x <= b.x + b.width && a.x + a.width >= b.x &&
    a.y <= b.y + b.height && a.y + a.height >= b.y } },
};

function objeto(x = 0, y = 0) {
  const obj = new EventEmitter();
  Object.assign(obj, { x, y, active: true, visible: true, alpha: 1, depth: 0,
    width: 128, height: 128, displayOriginX: 32, displayOriginY: 32,
    setPosition(x, y) { Object.assign(this, { x, y }); return this; },
    setScale(x, y = x) { Object.assign(this, { scaleX: x, scaleY: y }); return this; },
    setOrigin(x, y) { Object.assign(this, { originX: x, originY: y }); return this; },
    setDisplayOrigin(x, y) { Object.assign(this, { displayOriginX: x, displayOriginY: y }); return this; },
    setRotation(rotation) { this.rotation = rotation; return this; },
    setFlipY(flipY) { this.flipY = flipY; return this; },
    setFlipX(flipX) { this.flipX = flipX; return this; },
    setTexture(key, frame) { this.texture = { key }; this.frame = { name: frame }; return this; },
    setDepth(depth) { this.depth = depth; return this; },
    setVisible(visible) { this.visible = visible; return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; },
    setTint() { return this; }, setTintMode() { return this; }, clearTint() { return this; },
    setStrokeStyle() { return this; }, setFillStyle() { return this; }, setBlendMode() { return this; },
    setVertexRoundMode() { return this; },
    clear() { return this; }, lineStyle() { return this; }, fillStyle() { return this; },
    fillTriangle() { return this; }, lineBetween() { return this; }, strokeCircle() { return this; },
    fillCircle() { return this; }, beginPath() { return this; }, arc() { return this; },
    strokePath() { return this; },
    setVelocity(x, y) { this.body.setVelocity(x, y); return this; },
    destroy() { this.active = false; },
  });
  obj.body = { enable: true, velocity: { x: 0, y: 0 }, x, y, width: 30, height: 15,
    get bottom() { return this.y + this.height; },
    setVelocity(x, y) { Object.assign(this.velocity, { x, y }); return this; },
    setSize(width, height) { Object.assign(this, { width, height }); return this; },
    setOffset() { return this; }, setAllowGravity() { return this; },
    setImmovable() { return this; }, updateFromGameObject() {},
  };
  obj.anims = { play() {}, stop() {} };
  return obj;
}

function encontro(x, y) {
  return { active: true, visible: true, morto: false, x, y,
    vida: 1000, vidaMaxima: 1000, body: { enable: true },
    hitboxDano: new Rectangle(x - 10, y - 10, 20, 20), acertos: [],
    receberDano(quantidade, area) {
      this.acertos.push({ quantidade, area });
      if (this.invulneravel) return false;
      this.vida -= quantidade;
      return true;
    },
  };
}

function cena(personagem = "kai-mercer", xBoss = 40, yBoss = 0) {
  const eventosHitbox = [], scene = {
    personagemSelecionada: personagem, player: objeto(), respawnX: 0, respawnY: 0,
    inimigos: [], direcaoAtual: "right", vida: 100, estamina: 100, custoAtaque: 20,
    events: new EventEmitter(), input: { keyboard: new EventEmitter() },
    time: { now: 0, delayedCall() {}, addEvent(config) {
      eventosHitbox.push(config.callback); return { remove() {} };
    } },
    add: { graphics: objeto, image: objeto, circle: objeto, rectangle: objeto },
    textures: { get: () => ({ has: () => true }) },
    cache: { audio: { exists: () => false } }, sound: { play() {} },
    tweens: { add() {}, killTweensOf() {} },
    physics: { add: { sprite: objeto, group: () => ({ active: true,
      children: { entries: [] }, add(p) { this.children.entries.push(p); },
      getChildren() { return this.children.entries; } }) } },
    novoBoss: encontro(xBoss, yBoss), eventosHitbox,
  };
  return scene;
}


test("golpes normais Kai, Magnus e Nyx atingem o contrato do novo boss uma vez", () => {
  for (const [personagem, dano] of [["kai-mercer", 25], ["magnus-force", 33.3], ["nyx", 28]]) {
    const scene = cena(personagem);
    criarPlayer(scene);
    const sons = [];
    scene.sound.play = (key, config) => sons.push({key,...config});
    scene.direcaoAtual = "right";
    assert.equal(atacar(scene), true);
    assert.equal(sons.length, 0, "som aguarda o contato da arma");
    for (let i = 0; i < 10; i++) scene.eventosHitbox.forEach(callback => callback());
    assert.deepEqual(sons, [{key: personagem === "magnus-force"
      ? "magnus-martelo-impacto" : "katana-ataque", volume: 0.15}],
      "impacto toca uma vez e só Magnus usa o novo som");
    assert.equal(scene.novoBoss.acertos.length, 1);
    assert.equal(scene.novoBoss.acertos[0].quantidade, dano);
    assert.ok(scene.novoBoss.acertos[0].area instanceof Rectangle);
    assert.equal(scene.novoBoss.vida, 1000 - dano);
    assert.deepEqual(scene.inimigos, []);
    assert.equal(scene.bossFinal, undefined);
  }
});

test("flecha Aria atinge boss pelo primeiro impacto e mantém valor configurado", () => {
  const scene = cena("aria-kade", 150, 0);
  const flecha = dispararProjetil(scene, { damage: 47, speed: 900 });
  atualizarProjeteis(scene, 500);
  atualizarProjeteis(scene, 500);
  assert.equal(flecha.active, false);
  assert.equal(scene.novoBoss.vida, 953);
  assert.deepEqual(scene.novoBoss.acertos, [{ quantidade: 47, area: null }]);
});

test("parede vence empate com boss na varredura da flecha", () => {
  const scene = cena("aria-kade", 150, 0);
  scene.collisionGroup = { getChildren: () => [{ active: true,
    body: { ...scene.novoBoss.hitboxDano, enable: true } }] };
  const flecha = dispararProjetil(scene);
  atualizarProjeteis(scene, 500);
  assert.equal(flecha.active, false);
  assert.equal(scene.novoBoss.acertos.length, 0);
});

test("teletransporte invisível ou com corpo desabilitado não intercepta flechas", () => {
  for (const mutacao of [b => { b.visible = false; }, b => { b.body.enable = false; }]) {
    const scene = cena("aria-kade", 150, 0);
    mutacao(scene.novoBoss);
    const flecha = dispararProjetil(scene);
    atualizarProjeteis(scene, 500);
    assert.equal(scene.novoBoss.acertos.length, 0);
    assert.equal(flecha.active, true);
  }
});

test("Magnus causa 90 de dano próximo ao boss, sem empurrão ou atordoamento", () => {
  const scene = cena("magnus-force", 50, 0);
  criarSistemaEspeciais(scene);
  scene.events.emit("player:especial");
  scene.time.now = 390;
  atualizarSistemaEspeciais(scene);
  atualizarSistemaEspeciais(scene);
  assert.equal(scene.novoBoss.vida, 910);
  assert.equal(scene.novoBoss.acertos.length, 1);
  assert.ok(scene.novoBoss.acertos[0].area instanceof Rectangle);
  assert.equal(scene.novoBoss.especialEmpurraoAte, undefined);
  assert.equal(scene.novoBoss.especialAtordoadoAte, undefined);
});

test("onda Magnus respeita obstáculo antes do boss", () => {
  const scene = cena("magnus-force", 70, 0);
  scene.collisionGroup = { getChildren: () => [{ active: true,
    body: { x: 30, y: -30, width: 4, height: 60, enable: true } }] };
  criarSistemaEspeciais(scene);
  scene.events.emit("player:especial");
  scene.time.now = 390;
  atualizarSistemaEspeciais(scene);
  assert.equal(scene.novoBoss.acertos.length, 0);
});

test("aura Nyx substitui o corte por cura sem causar dano ao boss", () => {
  const scene = cena("nyx", 70, 0);
  scene.vida = 40; scene.vidaMaxima = 100;
  criarSistemaEspeciais(scene);
  scene.events.emit("player:especial");
  scene.time.now = 1200;
  atualizarSistemaEspeciais(scene);
  scene.time.now = 2200;
  atualizarSistemaEspeciais(scene);
  atualizarSistemaEspeciais(scene);
  assert.equal(scene.vida, 45);
  assert.equal(scene.novoBoss.vida, 1000);
  assert.equal(scene.novoBoss.acertos.length, 0);
  assert.equal(scene.estadoEspecial.cortes.size, 0);
});

test("aura Nyx dura dez segundos e respeita vinte segundos de recarga", () => {
  const scene = cena("nyx", 70, 0);
  scene.vida = 20; scene.vidaMaxima = 100;
  criarSistemaEspeciais(scene);
  scene.events.emit("player:especial");
  scene.time.now = 1200;
  atualizarSistemaEspeciais(scene);
  for (let segundo=1;segundo<=10;segundo++) {
    scene.time.now = 1200+segundo*1000;
    atualizarSistemaEspeciais(scene);
  }
  assert.equal(scene.vida,70);
  assert.equal(scene.estadoEspecial.auraNyx,null);
  scene.time.now = 19999; scene.events.emit('player:especial');
  assert.equal(scene.estadoEspecial.auraNyx,null);
  scene.time.now = 20000; scene.events.emit('player:especial');
  assert.ok(scene.estadoEspecial.auraNyx);
});

test("Kai continua refletindo lasers comuns e aplicando o dano pelo contrato do alvo", () => {
  const scene = cena("kai-mercer", 80, 0), laser = objeto(20, 0);
  scene.lasersInimigo = { getChildren: () => [laser] };
  criarSistemaEspeciais(scene);
  scene.events.emit("player:especial");
  assert.equal(scene.tentarInterceptarLaserEspecial(laser), true);
  assert.equal(laser.especialRefletido, true);
  assert.ok(laser.body.velocity.x > 0);
  laser.setPosition(75, 0);
  atualizarSistemaEspeciais(scene);
  assert.equal(laser.active, false);
  assert.equal(scene.novoBoss.vida, 970);
  assert.equal(scene.novoBoss.acertos.length, 1);
});

test('Kai mantém parry por 5,8s e respeita o raio reduzido em mais 20%',()=>{
  const scene=cena('kai-mercer',100,0),laser=objeto(49.6,0);
  const sons=[];
  scene.cache.audio.exists=key=>key==='kai-especial';
  scene.sound.play=(key,config)=>sons.push({key,...config,instante:scene.time.now});
  criarSistemaEspeciais(scene);scene.events.emit('player:especial');
  assert.deepEqual(sons,[{key:'kai-especial',volume:0.2,loop:false,instante:0}],
    'som começa junto à abertura da barreira');
  assert.equal(scene.estadoEspecial.parryAte,5800);
  assert.equal(scene.estadoEspecial.proximoUso,8000);
  assert.equal(scene.tentarInterceptarLaserEspecial(objeto(55,0)),false);
  assert.equal(scene.tentarInterceptarLaserEspecial(laser),true);
  scene.time.now=5799;assert.equal(scene.tentarBloquearDanoEspecial(null),true);
  scene.time.now=5800;assert.equal(scene.tentarBloquearDanoEspecial(null),false);
  atualizarSistemaEspeciais(scene);assert.equal(scene.estadoEspecial.parryGrafico,null);
  scene.time.now=7999;scene.events.emit('player:especial');
  assert.equal(scene.estadoEspecial.parryAte,5800);
  assert.equal(sons.length,1,'pedido durante a recarga não repete som');
  scene.time.now=8000;scene.events.emit('player:especial');
  assert.equal(scene.estadoEspecial.parryAte,13800);
  assert.equal(sons.length,2);
  assert.equal(sons[1].instante,8000);
});

test("Kai absorve projéteis do boss sem refletir, causar dano de volta ou mudar seu alcance", () => {
  for (const marca of ["atirador", "energia", "registro"]) {
    const scene = cena("kai-mercer", 80, 0), laser = objeto(20, 0);
    if (marca === "atirador") laser.especialAtirador = scene.novoBoss;
    if (marca === "energia") laser.novoBossDisparoEnergia = true;
    scene.novoBoss.projeteisBoss = marca === "registro" ? [laser] : [];
    criarSistemaEspeciais(scene);
    assert.equal(scene.tentarInterceptarLaserEspecial(laser), false, "sem habilidade ativa não intercepta");
    scene.events.emit("player:especial");
    const longe = objeto(100, 0);
    longe.especialAtirador = scene.novoBoss;
    assert.equal(scene.tentarInterceptarLaserEspecial(longe), false);
    assert.equal(longe.active, true);
    assert.equal(scene.tentarInterceptarLaserEspecial(laser), true);
    assert.equal(laser.active, false);
    assert.ok(!laser.especialRefletido);
    assert.equal(laser.danoEspecial, undefined);
    atualizarSistemaEspeciais(scene);
    assert.equal(scene.vida, 100);
    assert.equal(scene.novoBoss.vida, 1000);
    assert.equal(scene.novoBoss.acertos.length, 0);
    assert.equal(scene.tentarInterceptarLaserEspecial(laser), false, "não intercepta outra vez o projétil removido");
  }
});

test("absorção do boss encerra o impacto também no cooperativo, sem atingir outros jogadores", async () => {
  const { criarServicosAtaques } = await import("../enemies/novoBoss/NovoBossServicosAtaques.js");
  const { coopBossServices } = await import("../multiplayer/CoopBossServices.js");
  for (const coop of [false, true]) {
    const scene = cena("kai-mercer", 80, 0), laser = objeto(20, 0);
    scene.hitboxDanoPlayer = new Rectangle(-15, -10, 30, 20);
    scene.novoBoss.jogadorNaArena = true;
    scene.novoBoss.projeteisBoss = [laser];
    laser.especialAtirador = scene.novoBoss;
    laser.especialLaserInimigo = true;
    criarSistemaEspeciais(scene); scene.events.emit("player:especial");
    const original = criarServicosAtaques(scene, scene.novoBoss);
    let danos = 0;
    const runtime = { playerContexts: () => [scene], inArena: () => true,
      damage() { danos++; return true; } };
    const servicos = coop ? coopBossServices(runtime, scene.novoBoss, original) : original;
    assert.equal(servicos.atingirJogadorComLaser({ x: 30, y: 0 }, { x: 20, y: 0 }, 6, 10, {}, laser), true,
      "informa ao ataque que o projétil foi consumido e encerra sua varredura");
    assert.equal(laser.active, false);
    assert.equal(danos, 0);
    assert.equal(scene.vida, 100);
  }
});

test("Magnus online aplica impacto contra robôs comuns tanto no host quanto pelo comando do cliente", async () => {
  globalThis.Phaser.Scene ??= class {};
  globalThis.Phaser.Events ??= { EventEmitter };
  const { CoopRuntime } = await import("../multiplayer/CoopRuntime.js");
  const { CoopPlayers } = await import("../multiplayer/CoopPlayers.js");
  const { soloContext } = await import("../multiplayer/CoopContext.js");
  for (const remoto of [false, true]) {
    const scene = cena(remoto ? "kai-mercer" : "magnus-force", 500, 0);
    scene.textures.exists = key => key === "magnus-especial-marreta";
    scene.anims = { exists: () => false, create() {} };
    scene.player.body.offset = { x: 0, y: 0 };
    const enviados = [], sons = [];
    scene.cache.audio.exists = key => key === "magnus-especial";
    scene.sound.play = (key, config) => sons.push({ key, ...config });
    scene.multiplayer = true; scene.isMultiplayerHost = true;
    const robo = Object.assign(objeto(50, 0), { vida: 100, vidaMaxima: 100, tipoRobo: "padrao",
      hitboxDano: new Rectangle(40, -10, 20, 20) });
    scene.inimigos = [robo];
    const runtime = scene.coopRuntime = Object.assign(Object.create(CoopRuntime.prototype), {
      scene, host: true, manager: { playerId: "host", sendCoopAction(...args) { enviados.push(args); } },
      localContext: soloContext(scene), broadcastHit() {},
    });
    runtime.players = new CoopPlayers(runtime);
    criarSistemaEspeciais(scene);
    let contexto = scene;
    if (remoto) {
      const actor = objeto(0, 0);
      actor.body.offset = { x: 0, y: 0 };
      const entry = { actor, data: { id: "client", character: "magnus-force", direction: "right", health: 100 },
        health: 100, hitbox: new Rectangle(-15, 0, 30, 15), speeches: new Map() };
      runtime.players.remotes.set("client", entry);
      runtime.players.prepareContext(entry);
      contexto = entry.context;
      runtime.receiveAction({ kind: "special", playerId: "client", payload: {} });
    } else scene.events.emit("player:especial");
    assert.ok(contexto.estadoEspecial.onda, "comando inicia a onda autoritativa");
    if (remoto) {
      const onda = contexto.estadoEspecial.onda;
      assert.equal(enviados.filter(a => a[0] === "specialPose").length, 1);
      runtime.receiveAction({ kind: "special", playerId: "client", payload: {} });
      assert.equal(enviados.filter(a => a[0] === "specialPose").length, 1,
        "recusar durante a marreta não envia outra animação sem impacto");
      assert.equal(contexto.estadoEspecial.onda, onda);
    }
    scene.time.now = 390;
    if (remoto) runtime.players.update(390, 16);
    else atualizarSistemaEspeciais(scene, 16);
    assert.equal(robo.vida, 10);
    assert.ok(robo.especialEmpurraoAte > 390);
    assert.deepEqual(sons.filter(s => s.key === "magnus-especial"),
      [{ key: "magnus-especial", volume: 0.15, loop: false }],
      "host e comando remoto disparam um som por impacto");
  }
});

for (const [personagem, vida, dano, solo, multi] of [
  ["kai-mercer", 100, 25, 7, 6], ["magnus-force", 115, 33.3, 6, 5],
  ["aria-kade", 85, 25, 8, 7], ["nyx", 95, 28, 8, 6],
]) for (const multiplayer of [false, true]) {
  test(`${personagem} ${multiplayer ? "multiplayer" : "solo"}: ataques reais até esgotar a barra`, () => {
    const scene = cena(personagem, personagem === "aria-kade" ? 150 : 40);
    criarPlayer(scene);
    scene.multiplayer = multiplayer;
    // O cooperativo usa o mesmo combate local e replica seus resultados.
    if (multiplayer) scene.coopRuntime = {};
    scene.textures.exists = () => false;
    scene.load = Object.assign(new EventEmitter(), { image() {}, isLoading: () => false, start() {} });
    criarStatusPlayer(scene);
    scene.direcaoAtual = "right";
    assert.equal(scene.vida, vida);
    const ataques = multiplayer ? multi : solo;
    for (let i = 0; i < ataques; i++) {
      scene.time.now += 300;
      assert.equal(atacar(scene), true);
      if (personagem === "aria-kade") {
        soltarAtaque(scene);
        atualizarProjeteis(scene, 500);
      } else scene.eventosHitbox.forEach(callback => callback());
      scene.atacando = false;
    }
    assert.equal(atacar(scene), false);
    assert.equal(scene.estamina, 0);
    assert.equal(scene.novoBoss.acertos.length, ataques);
    assert.ok(scene.novoBoss.acertos.every(hit => hit.quantidade === dano));
    assert.ok(Math.abs(scene.novoBoss.vida - (1000 - ataques * dano)) < 1e-9);
    scene.events.emit("shutdown");
  });
}

test("Magnus: círculo de 90 de dano nos pés, queda à distância e empurrão moderado", () => {
  const scene = cena("magnus-force", 500, 0);
  scene.hitboxDanoPlayer = new Rectangle(-10, 0, 20, 30);
  const distancias = [50, 110, 145, 180, 181];
  const robos = distancias.map(d => Object.assign(objeto(d + 10, 30), {
    vida: 500, vidaMaxima: 500, tipoRobo: "padrao",
    hitboxDano: new Rectangle(d, 20, 20, 20),
  }));
  scene.inimigos = robos;
  criarSistemaEspeciais(scene);
  scene.events.emit("player:especial");
  assert.equal(scene.estadoEspecial.onda.y, 30, "centro coincide com o círculo visual nos pés");
  scene.time.now = 100;
  atualizarSistemaEspeciais(scene);
  assert.deepEqual(robos.map(r => r.vida), [500, 500, 500, 500, 500]);
  scene.time.now = 330;
  atualizarSistemaEspeciais(scene);
  assert.deepEqual(robos.map(r => r.vida), [410, 500, 500, 500, 500], "onda ainda está expandindo");
  scene.time.now = 460;
  atualizarSistemaEspeciais(scene);
  assert.deepEqual(robos.map(r => r.vida), [410, 410, 445, 480, 500]);
  assert.deepEqual(robos.slice(0, 4).map(r => r.body.velocity.x), [200, 200, 150, 100]);
  assert.ok(robos.slice(0, 4).every(r => r.body.velocity.y === 0));
  assert.equal(robos[1].especialEmpurraoAte - 460, 180);
  assert.equal(robos[4].especialEmpurraoAte, undefined, "fora da onda não recebe empurrão");
  atualizarSistemaEspeciais(scene);
  assert.deepEqual(robos.map(r => r.vida), [410, 410, 445, 480, 500], "um acerto por explosão");
});

test("nova folha Magnus: 33 quadros, mesma âncora e explosão sincronizada ao impacto", () => {
  const meta = JSON.parse(readFileSync(new URL("../../assets/efeitos/especiais/magnus.json", import.meta.url)));
  const png = readFileSync(new URL("../../assets/efeitos/especiais/magnus%20(1).png", import.meta.url));
  assert.equal(meta.quadros, 33);
  assert.equal(meta.duracoesMs.length, meta.quadros);
  assert.equal(png.readUInt32BE(16), meta.colunas * meta.larguraFrame);
  assert.equal(png.readUInt32BE(20), Math.ceil(meta.quadros / meta.colunas) * meta.alturaFrame);
  const scene = cena("magnus-force", 500, 0);
  scene.hitboxDanoPlayer = new Rectangle(-10, 0, 20, 30);
  scene.textures.exists = key => key === "especial-magnus";
  scene.cache.json = { get: () => meta };
  const sons = [];
  scene.cache.audio.exists = key => key === "magnus-especial";
  scene.sound.play = (key, config) => sons.push({ key, ...config });
  scene.add.image = (x, y, key, frame) => {
    const sprite = objeto(x, y).setTexture(key, frame);
    sprite.setFrame = n => { sprite.frame.name = n; return sprite; };
    return sprite;
  };
  const robo = Object.assign(objeto(0, 30), { vida: 100, vidaMaxima: 100, tipoRobo: "padrao",
    hitboxDano: new Rectangle(-5, 25, 10, 10) });
  scene.inimigos = [robo];
  criarSistemaEspeciais(scene);
  scene.events.emit("player:especial");
  const efeito = scene.estadoEspecial.impactoMagnus;
  assert.equal(efeito.sprite.originX, 0.5);
  assert.equal(efeito.sprite.originY, 340 / 506);
  assert.equal(efeito.sprite.scaleX, 220 / 345);
  scene.time.now = 199;
  atualizarSistemaEspeciais(scene);
  assert.equal(efeito.sprite.visible, false, "sem explosão antecipada durante a marreta");
  assert.equal(robo.vida, 100);
  assert.equal(sons.length, 0, "som aguarda o impacto, sem antecipar na preparação");
  scene.time.now = 200;
  atualizarSistemaEspeciais(scene);
  assert.equal(efeito.sprite.visible, true);
  assert.equal(efeito.sprite.frame.name, 0, "primeiro quadro coincide com o impacto");
  assert.equal(efeito.sprite.x, 0);
  assert.equal(efeito.sprite.y, 30, "mesmo local nos pés do personagem");
  assert.equal(robo.vida, 10, "dano começa junto com a explosão");
  assert.deepEqual(sons, [{ key: "magnus-especial", volume: 0.15, loop: false }]);
  scene.time.now = 230;
  atualizarSistemaEspeciais(scene);
  assert.equal(efeito.sprite.frame.name, 1);
  assert.equal(sons.length, 1, "som não repete a cada quadro");
  scene.time.now = 200 + efeito.total - 1;
  atualizarSistemaEspeciais(scene);
  assert.equal(efeito.sprite.frame.name, 32, "último quadro útil sem ler células vazias");
  scene.time.now++;
  atualizarSistemaEspeciais(scene);
  assert.equal(efeito.sprite.active, false);
  assert.equal(scene.estadoEspecial.impactoMagnus, null, "termina sem reiniciar a animação");
});
