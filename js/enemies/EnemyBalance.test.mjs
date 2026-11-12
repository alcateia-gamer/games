/** Testa valores finais através dos construtores, projéteis, ataques e protocolo reais. */
import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { obterBalanceamentoInimigos } from "./EnemyBalance.js";
import { criarInimigoTeste } from "./EnemyTest.js";
import { criarRoboBola, atualizarRoboBola } from "./RoboBola.js";
import { tentarDispararLaser, verificarLasersNoPlayer, causarDanoPlayer } from "./EnemyLaser.js";
import { atualizarIAInimigo } from "./EnemyAI.js";
import { prepararBoss } from "./BossPrincipal.js";
import { novoBossConfig } from "./novoBoss/NovoBossConfig.js";
import { criarTorreNovoBoss } from "./novoBoss/NovoBossTorres.js";
import { criarAlvoIlusorio } from "./novoBoss/NovoBossIlusoes.js";
import { criarServicosAtaques } from "./novoBoss/NovoBossServicosAtaques.js";
import { criarLasersEspiral } from "./novoBoss/ataques/LasersEspiral.js";
import { criarPulsoRepulsao } from "./novoBoss/ataques/PulsoRepulsao.js";
import { criarChuvaRaios } from "./novoBoss/ataques/ChuvaRaios.js";
import { soloContext } from "../multiplayer/CoopContext.js";
import { RecentActions } from "../multiplayer/CoopProtocol.js";
import { BossReplica, describeCombatTarget } from "../multiplayer/CoopBossReplica.js";
import { CoopPlayers } from "../multiplayer/CoopPlayers.js";

class Rectangle {
  constructor(x, y, width, height) { this.setTo(x, y, width, height); }
  setTo(x, y, width, height) { Object.assign(this, { x, y, width, height }); return this; }
  get left() { return this.x; } get right() { return this.x + this.width; }
  get top() { return this.y; } get bottom() { return this.y + this.height; }
  get centerX() { return this.x + this.width / 2; } get centerY() { return this.y + this.height / 2; }
  static Contains(r, x, y) { return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; }
}
globalThis.Phaser = {
  Scene: class {}, Events: { EventEmitter }, Scenes: { Events: { SHUTDOWN: "shutdown" } },
  BlendModes: { ADD: 1, NORMAL: 0 }, TintModes: { FILL: 1, MULTIPLY: 0 },
  Textures: { FilterMode: { LINEAR: 0 } },
  Math: { Clamp: (n, min, max) => Math.max(min, Math.min(max, n)),
    Distance: { Between: (x, y, a, b) => Math.hypot(x - a, y - b) },
    Angle: { Between: (x, y, a, b) => Math.atan2(b - y, a - x) },
  },
  Geom: { Rectangle, Line: class { constructor(...args) { this.args = args; } },
    Intersects: { RectangleToRectangle: (a, b) =>
      a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y,
      LineToRectangle: () => false } },
};
const { CoopRuntime } = await import("../multiplayer/CoopRuntime.js");
const { default: MultiplayerManager } = await import("../multiplayer/multiplayerManager.js");

function objeto(x = 0, y = 0, width = 64, height = 64) {
  const o = Object.assign(new EventEmitter(), { x, y, width, height, active: true, visible: true,
    scaleX: 1, scaleY: 1, originX: .5, originY: .5, depth: 0, alpha: 1,
    texture: { key: "test" }, frame: { name: 0 },
    setPosition(x, y) { Object.assign(this, { x, y }); return this; },
    setScale(x, y = x) { this.scaleX = x; this.scaleY = y; return this; },
    setOrigin(x, y = x) { this.originX = x; this.originY = y; return this; },
    setVisible(v) { this.visible = v; return this; },
    setTexture(key, frame = 0) { this.texture = { key }; this.frame = { name: frame }; return this; },
    setFrame(name) { this.frame = { name }; return this; },
    setVelocity(x, y) { this.body.setVelocity(x, y); return this; },
    setDepth(depth) { this.depth = depth; return this; },
    getBounds() { return new Rectangle(this.x - 5, this.y - 5, 10, 10); },
    destroy() { this.active = false; this.emit("destroy"); },
  });
  o.body = { x, y, width: 30, height: 15, enable: true, velocity: { x: 0, y: 0 },
    blocked: {}, touching: {}, offset: { x: 0, y: 0 },
    setVelocity(x, y) { Object.assign(this.velocity, { x, y }); return this; },
    setSize(width, height) { Object.assign(this, { width, height }); return this; },
    setOffset(x, y) { this.offset = { x, y }; return this; },
    setAllowGravity() { return this; }, setCircle() { return this; }, setImmovable() { return this; },
    updateFromGameObject() {},
  };
  for (const method of ["setRotation", "setAlpha", "setTint", "setTintMode", "clearTint", "setName",
    "setFlipX", "setFlipY", "setBlendMode", "setStrokeStyle", "setFillStyle", "clear", "lineStyle", "fillStyle", "fillCircle",
    "strokeCircle", "beginPath", "arc", "strokePath", "lineBetween", "moveTo", "lineTo", "strokePath"]) {
    o[method] = () => o;
  }
  o.anims = { play() {}, playReverse() {}, stop() {} }; o.play = () => o;
  return o;
}
function cena(jogadores = 0) {
  const lasers = [], timers = [];
  const scene = { multiplayer: jogadores > 0, isMultiplayerHost: true,
    player: objeto(0, 0), vida: 100, vidaMaxima: 100, estamina: 100, estaminaMaxima: 100,
    hitboxDanoPlayer: new Rectangle(-10, -10, 20, 20), inimigos: [], events: new EventEmitter(),
    time: { now: 1000, delayedCall(ms, callback) { timers.push(callback); return { remove() {} }; } },
    anims: { exists: () => true }, textures: { exists: key => key === "municao-vermelha-metralhadora-robo" },
    cache: { audio: { exists: () => false } },
    sound: { add: () => ({ stop() {}, destroy() {} }), play() {} },
    add: { sprite: objeto, image: objeto, circle: objeto, rectangle: objeto, graphics: () => objeto() },
    lasersInimigo: { add(o) { lasers.push(o); }, getChildren: () => lasers },
    collisionGroup: { getChildren: () => [] },
    physics: { add: { sprite: objeto, existing() {}, collider: () => ({ destroy() {} }) },
      velocityFromRotation(a, s, v) { v.x = Math.cos(a) * s; v.y = Math.sin(a) * s; },
      moveTo(o, x, y, s) { const d = Math.hypot(x - o.x, y - o.y) || 1; o.setVelocity((x - o.x) / d * s, (y - o.y) / d * s); } },
    lasers, timers,
  };
  if (jogadores) {
    const manager = Object.assign(Object.create(MultiplayerManager.prototype), {
      playerId: "p0", coopEnabled: true,
      room: { hostId: "p0", players: Array.from({ length: jogadores }, (_, i) => ({ id: `p${i}` })) },
      emit() {},
    });
    scene.multiplayerManager = manager;
    scene.coopRuntime = Object.assign(Object.create(CoopRuntime.prototype), {
      manager, scene, host: true, players: { contexts: () => [] },
      playerContexts: () => [scene],
    });
  }
  return scene;
}
const perto = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);
function prepararEncontro(scene) {
  // Começa fora da arena, como na cena real, sem iniciar a apresentação gráfica.
  const ctx = scene.multiplayer ? soloContext(scene) : scene;
  const e = prepararBoss(ctx);
  return { ctx, e };
}
function liberarDano(scene) { scene.vida = 100; scene.player.invulneravel = false; }
function acertarProjetil(scene, laser) {
  laser.setPosition(0, 0);
  verificarLasersNoPlayer(scene);
  verificarLasersNoPlayer(scene);
}

const cenarios = [
  [0, [100, 120, 85, 1000, 120], [6.24, 12, 10, 20, 30, 40]],
  [1, [125, 150, 106, 1100, 140], [7, 13.5, 11.25, 25, 35, 45]],
  [2, [150, 180, 128, 2000, 140], [8, 15, 12.5, 30, 40, 50]],
  [3, [175, 210, 149, 3000, 140], [9, 16.5, 13.75, 35, 45, 55]],
  [4, [200, 240, 170, 4000, 140], [10, 18, 15, 40, 50, 60]],
];
for (const [n, vidas, danos] of cenarios) {
  const nome = n ? `online ${n}` : "single player";
  test(`${nome}: todos os inimigos nascem com a vida cheia, sem multiplicadores extras`, () => {
    const s = cena(n);
    const atirador = criarInimigoTeste(s, { x: 100, y: 0, vidaMaxima: 999, danoLaser: 999 });
    const serra = criarInimigoTeste(s, { tipoRobo: "serra", x: 200, y: 0, vidaMaxima: 999, danoContato: 999 });
    const bola = criarRoboBola(s, { x: 300, y: 0 });
    assert.ok(bola);
    const { ctx, e } = prepararEncontro(s);
    const torre = criarTorreNovoBoss(ctx, e, { id: 1, x: 500, y: 500, width: 192, height: 258 }, () => {});
    const copias = ["clone", "ilusao"].map(tipo => criarAlvoIlusorio(ctx, e, { x: 500, y: 500 }, tipo, tipo));
    for (const [enemy, health] of [[atirador, vidas[0]], [serra, vidas[1]], [bola, vidas[2]],
      [e, vidas[3]], [torre, vidas[4]], ...copias.map(c => [c, 1])]) {
      assert.equal(enemy.vida, health);
      assert.equal(enemy.vidaMaxima, health);
      // O snapshot transmitido conserva a vida e o teto do host, por entidade.
      const state = JSON.parse(JSON.stringify(describeCombatTarget(enemy, "id", { id: () => "visual" })));
      assert.equal(state.vida, health); assert.equal(state.vidaMaxima, health);
      if (n) {
        const replica = Object.assign(Object.create(BossReplica.prototype), {
          runtime: { receiver: { get: () => objeto() } },
        }).target(state);
        assert.equal(replica.vida, health); assert.equal(replica.vidaMaxima, health);
      }
    }
    // Torres e cópias continuam sem dano ofensivo, inclusive no cooperativo.
    torre.atualizar(10000, true);
    e.sprite = objeto(100, 0); e.jogadorNaArena = true;
    for (const copia of copias) {
      for (const tipo of ["lasers", "pulso", "chuva"]) {
        assert.equal(copia.ataquesIlusorios.iniciar(tipo, {}), true);
        copia.ataquesIlusorios.avancar(10000);
        copia.ataquesIlusorios.encerrar();
        assert.equal(s.vida, 100);
      }
    }
    assert.equal(e.config.prologo.lasers.dano, danos[3]);
    assert.equal(novoBossConfig.combate.vidaMaxima, 1000, "configuração base não é multiplicada nem mutada");
  });

  test(`${nome}: tiros reais do atirador e da bola descontam uma vez o dano do emissor`, () => {
    const s = cena(n);
    // Primeiro inimigo tem outro dano: não pode determinar o dano dos tiros seguintes.
    criarInimigoTeste(s, { tipoRobo: "serra", x: 500, y: 0 });
    const atirador = criarInimigoTeste(s, { x: 100, y: 0 });
    tentarDispararLaser(s, 2000, atirador);
    const tiro = s.lasers.at(-1);
    assert.equal(tiro.danoLaser, danos[0]);
    acertarProjetil(s, tiro);
    perto(s.vida, 100 - danos[0]);
    liberarDano(s);
    const bola = criarRoboBola(s, { x: 150, y: 0 });
    bola.ultimoTiro = -Infinity; bola.direcaoAtual = "left";
    atualizarRoboBola(s, 2000, 16);
    atualizarRoboBola(s, 2300, 16);
    const plasma = s.lasers.at(-1);
    assert.notEqual(plasma, tiro, "a bola dispara pela sua própria IA");
    assert.equal(plasma.danoLaser, danos[2]);
    acertarProjetil(s, plasma);
    perto(s.vida, 100 - danos[2]);
    if (n === 3) assert.equal(s.vida, 86.25);
  });

  test(`${nome}: golpe real da serra desconta uma vez o dano configurado`, () => {
    const s = cena(n), serra = criarInimigoTeste(s, { tipoRobo: "serra", x: 20, y: 0 });
    serra.direcaoAtual = "left";
    atualizarIAInimigo(s, 2000, serra);
    atualizarIAInimigo(s, 2000, serra);
    perto(s.vida, 100 - danos[1]);
  });

  for (const [tipo, criar, indice] of [["laser", criarLasersEspiral, 3], ["pulso", criarPulsoRepulsao, 4], ["chuva", criarChuvaRaios, 5]]) {
    test(`${nome}: ${tipo} real do boss desconta seu próprio dano uma única vez`, () => {
      const s = cena(n), { ctx, e } = prepararEncontro(s);
      // Mesmos serviços de colisão e dano da produção; somente o relógio é avançado pelo teste.
      e.sprite = objeto(100, 0); e.jogadorNaArena = true;
      const servicos = criarServicosAtaques(ctx, e);
      let config = tipo === "laser" ? e.config.ataques.lasersEspiral :
        tipo === "pulso" ? e.config.ataques.pulsoRepulsao : e.config.ataques.chuvaRaios;
      if (tipo === "laser") config = { ...config, quantidade: 1, duracaoDisparosMs: 0, anguloInicial: 180 };
      if (tipo === "chuva") config = { ...config, quantidade: 1, mirarJogador: true };
      // Geometria local desta arena de teste, preservando os valores reais dos ataques.
      e.config = { ...e.config, arena: { xMin: -1000, xMax: 1000, yMin: -1000, yMax: 1000, entradaY: 1000 } };
      const ataque = criar(ctx, e, config, servicos);
      const duracao = tipo === "laser" ? config.avisoMs + 1000 :
        tipo === "pulso" ? config.avisoMs + config.expansaoMs : config.avisoMs + config.frameMs * config.frameImpacto + 100;
      for (let elapsed = 0; elapsed < duracao; elapsed += 20) ataque.atualizar(20);
      perto(s.vida, 100 - danos[indice]);
      ataque.atualizar(20);
      perto(s.vida, 100 - danos[indice]);
    });
  }
}

test("participantes da sala definem o cenário: inclui mortos e jogadores em outro mapa", () => {
  const s = cena(2);
  s.multiplayerManager.room.capacity = 4;
  s.multiplayerManager.room.players[1] = { id: "p1", dead: true, mapKey: "Level1Parte2" };
  assert.equal(obterBalanceamentoInimigos(s).boss.vida, 2000);
  assert.equal(obterBalanceamentoInimigos(soloContext(s)).boss.vida, 2000);
  assert.equal(obterBalanceamentoInimigos({ ...s, multiplayer: false, coopRuntime: null }).boss.vida, 1000);
});


for (const [n, vidas, danos] of cenarios.filter(([n]) => n > 0)) {
  test(`online ${n}: dano do host chega uma vez a cada participante e preserva decimais no retorno`, () => {
    const host = cena(n), runtime = host.coopRuntime, manager = host.multiplayerManager;
    const clients = Array.from({ length: n }, (_, i) => i ? cena(n) : host);
    const remotes = new Map();
    manager.roomTopic = "room/TEST"; manager.actionSequence = 0;
    // Transporte em memória entrega cada pacote duas vezes, como pode ocorrer com QoS 1.
    manager.publishAction = action => {
      const client = clients[Number(action.targetId.slice(1))];
      client.multiplayerManager.receiveAction({ ...action, clientId: "p0" });
      client.multiplayerManager.receiveAction({ ...action, clientId: "p0" });
    };
    for (let i = 1; i < n; i++) {
      const client = clients[i], id = `p${i}`;
      client.multiplayerManager.playerId = id;
      client.multiplayerManager.coopActions = new RecentActions();
      client.coopRuntime.host = false;
      client.multiplayerManager.emit = (kind, action) => {
        if (kind === "coopAction") client.coopRuntime.receiveAction(action);
      };
      const entry = { health: 100, data: { coop: {} }, invulnerableUntil: 0 };
      entry.context = { player: client.player, hitboxDanoPlayer: client.hitboxDanoPlayer,
        get vida() { return entry.health; }, coopRemotePlayerId: id };
      remotes.set(id, entry);
    }
    runtime.players = { remotes, contexts: () => [...remotes.values()].map(e => e.context) };
    runtime.playerContexts = () => [host, ...runtime.players.contexts()];
    const { ctx, e } = prepararEncontro(host);
    e.sprite = objeto(100, 0); e.jogadorNaArena = true;
    e.config = { ...e.config, arena: { xMin: -1000, xMax: 1000, yMin: -1000, yMax: 1000, entradaY: 1000 } };
    for (const [tipo, dano] of [["atirador", danos[0]], ["serra", danos[1]], ["bola", danos[2]],
      ["laser", danos[3]], ["pulso", danos[4]], ["chuva", danos[5]]]) {
      host.time.now += 1000;
      for (const client of clients) {
        liberarDano(client);
        client.player.setPosition(0, 0);
        client.hitboxDanoPlayer.setTo(-10, -10, 20, 20);
      }
      if (tipo === "laser" && n > 1) {
        // O cliente remoto é o único jogador na trajetória deste laser.
        for (const client of clients.filter((_, i) => i !== 1)) {
          client.player.setPosition(0, 200);
          client.hitboxDanoPlayer.setTo(-10, 190, 20, 20);
        }
      }
      for (const entry of remotes.values()) entry.health = 100;
      if (["atirador", "serra", "bola"].includes(tipo)) {
        // O mesmo caminho que encaminha um impacto de projétil ou serra para o jogador remoto.
        for (const context of runtime.playerContexts()) runtime.damage(context, dano, { x: 100, y: 0 });
      } else {
        const servicos = criarServicosAtaques(ctx, e);
        const config = tipo === "laser" ? { ...e.config.ataques.lasersEspiral, quantidade: 1,
          duracaoDisparosMs: 0, anguloInicial: 180 } : tipo === "pulso" ? e.config.ataques.pulsoRepulsao :
          { ...e.config.ataques.chuvaRaios, quantidade: 1 };
        const criar = tipo === "laser" ? criarLasersEspiral : tipo === "pulso" ? criarPulsoRepulsao : criarChuvaRaios;
        const ataque = criar(ctx, e, config, servicos);
        for (let elapsed = 0; elapsed < config.avisoMs + 1200; elapsed += 20) ataque.atualizar(20);
      }
      // Laser é consumido pelo primeiro jogador no trajeto; área afeta todos os atingidos.
      for (let i = 0; i < n; i++) {
        const expected = tipo === "laser" && i !== (n > 1 ? 1 : 0) ? 100 : 100 - dano;
        perto(clients[i].vida, expected);
        const state = new CoopPlayers({ scene: clients[i], mapKey: "Level1", host: false }).localState();
        manager.room.players[i].character = "kai-mercer";
        manager.receiveAction({ type: "game_state", playerId: `p${i}`, clientId: `p${i}`, x: 0, y: 0, ...state });
        perto(manager.room.players[i].health, expected);
      }
    }
  });
}
