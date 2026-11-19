import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { CoopWorld } from "./CoopWorld.js";
import { CoopRuntime } from "./CoopRuntime.js";
import { criarPreparacaoBoss } from "../core/BossAssetLoading.js";
import { ASSETS_BOSS } from "../core/FactoryAssetPack.js";
import { novoBossConfig, configurarZonasNovoBoss, jogadorNaArenaNovoBoss } from "../enemies/novoBoss/NovoBossConfig.js";
import { retanguloLivreDoMapa } from "../enemies/EnemyPathfinding.js";
import { mergeBossPreparation } from "./CoopProtocol.js";
import { iniciarRelogioCoop, tempoPartida } from "../core/RelogioPartida.js";
import { executarSpawnDev } from "../controls/DeveloperSpawns.js";
import { criarRoboBola } from "../enemies/RoboBola.js";
import { VisualReceiver } from "./CoopVisuals.js";

const clone = value => structuredClone(value);
const raw = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
function actor(x, y) {
  const p = { active: true, x, y, setPosition(x, y) { Object.assign(this, { x, y }); return this; },
    setVelocity() {}, anims: { pause() {}, resume() {} } };
  p.body = { get x() { return p.x - 15; }, get y() { return p.y + 11; }, width: 30, height: 15,
    reset(x, y) { p.setPosition(x, y); }, updateFromGameObject() {} };
  return p;
}
function room(count = 2, roomCode = "TEST") {
  const messages = [], nodes = [], sent = [];
  const players = Array.from({ length: count }, (_, i) => ({ id: `p${i}`, character: "kai-mercer", mapKey: "Level1Parte2",
    health: 100, dead: false, coop: { sceneSession: `session${i}`, accessCard: i === 0 } }));
  const map = { getObjectLayer: name => raw.layers.find(l => l.name === name) };
  const config = configurarZonasNovoBoss(map, novoBossConfig);
  const walls = map.getObjectLayer("collision").objects.filter(o => o.width > 0 && o.height > 0)
    .map(o => ({ body: { x: o.x, y: o.y, width: o.width, height: o.height, enable: true } }));
  function makeNode(index, saved) {
    const id = `p${index}`, events = new EventEmitter(), registry = new Map(); registry.events = new EventEmitter();
    const scene = { multiplayer: true, movimentoBloqueado: false, generatorMenuOpen: false,
      map, registry, game: { registry, getTime: () => clock }, events, time: { now: 0 },
      inventory: { getQuantity: key => key === "card" && index === 0 ? 1 : 0, hasCollected: () => false },
      luzFabricaAcesa: true, player: actor(-1100, -5250), vida: 100, remotePlayers: new Map(),
      input: { enabled: true, keyboard: { enabled: true, resetKeys() {} } },
      collisionGroup: { getChildren: () => walls }, itensColetaveis: [],
      novoBoss: { config, x: -1080, y: -5810 },
      cameras: { main: { zoom: 1, originX: .5, originY: .5, width: 800, height: 450,
        midPoint: { x: -1100, y: -5250 },
        centerOn(x, y) { this.midPoint = { x, y }; return this; }, stopFollow() {}, startFollow() {},
        setZoom(value) { this.zoom = value; return this; } } },
      leitorCartaoFabrica: { area: { x: -1120, y: -5270, width: 64, height: 64 } },
    };
    const texts = [];
    scene.add = { text(x, y, value) {
      const o = new EventEmitter();
      for (const name of ["setOrigin", "setScrollFactor", "setDepth", "setInteractive", "setPosition", "setScale"])
        o[name] = () => o;
      o.setText = value => { o.text = value; return o; };
      o.setVisible = value => { o.visible = value; return o; };
      o.destroy = () => o.removeAllListeners(); o.text = value; texts.push(o); return o;
    } };
    const textures = new Map(), audio = new Map(), anims = new Map(), calls = [], load = scene.load = new EventEmitter();
    scene.textures = { exists: key => textures.has(key) };
    scene.cache = { audio: { exists: key => audio.has(key) } };
    scene.anims = { exists: key => anims.has(key), create: c => anims.set(c.key, c), generateFrameNumbers: () => [] };
    load.maxParallelDownloads = 2; load.isLoading = () => false; load.setPath = () => load;
    for (const tipo of ["spritesheet", "atlas", "audio"]) load[tipo] = key => { calls.push({ tipo, key }); return load; };
    load.start = () => { load.starts = (load.starts || 0) + 1; };
    scene.portasFabrica = ["porta02", "porta03"].map((nome, i) => ({ nome, estado: "fechada", progresso: 0,
      area: { x: -1248 + i * 192, y: -5328, width: 144, height: 96 }, fechamentos: 0,
      fecharParaBoss() { if (this.bloqueadaPorBoss) return; this.bloqueadaPorBoss = true; this.estado = "fechando"; this.fechamentos++; },
      aplicarEstadoRede(value) { Object.assign(this, value); },
    }));
    // A fixture do carregamento recebe a autorização já validada; o gate real é testado em FactoryDoor.
    scene.liberarPortasArenaAutorizadas = () => true;
    scene.abrirPortasArenaAposCartao = () => {
      if (scene.portasFabrica.some(p => p.estado !== "fechada" || p.bloqueadaPorBoss)) return false;
      scene.portasFabrica.forEach(p => { p.estado = "abrindo"; }); return true;
    };
    const manager = { playerId: id, room: saved ? clone(saved) : { roomCode, hostId: "p0", players: clone(players),
      coopMap: { id: 1, key: "Level1Parte2" }, coopProgress: { flags: {}, collected: {} } },
      sendCoopAction(kind, payload, options = {}) {
        const action = { kind, payload: clone(payload), playerId: id, ...options };
        sent.push(action); messages.push(action); return true;
      },
      publishState() { messages.push({ kind: "state", room: clone(this.room), playerId: id }); },
    };
    const remotes = new Map();
    for (const p of manager.room.players) if (p.id !== id) {
      const a = actor(98, -1040);
      remotes.set(p.id, { actor: a, data: p, context: { player: a, vida: 100, coopRemotePlayerId: p.id } });
    }
    const r = { scene, manager, mapKey: "Level1Parte2", streamId: `session${index}`, host: manager.room.hostId === id,
      localContext: scene, players: { remotes, contexts: () => [...remotes.values()].map(p => p.context) },
      playerContexts: () => [scene, ...r.players.contexts()], inArena: p => jogadorNaArenaNovoBoss(p, config.arena),
      revival: { participants: () => manager.room.players.map(p => ({ dead: p.dead })) },
      teleports: 0, teleport(x, y) { r.teleports++; scene.player.body.reset(x, y); },
      prepareBossAssets: () => CoopRuntime.prototype.prepareBossAssets.call(r),
      prepareBossEncounter() { r.encounterPreparations = (r.encounterPreparations || 0) + 1;
        r.visualPrepared = r.systemsReady !== false; return r.visualPrepared; },
      bossVisualsReady() { return (r.host ? r.visualPrepared : r.world.bossLoading.state?.systemsPrepared) === true && !r.visualDelayed; },
    };
    criarPreparacaoBoss(scene);
    const world = r.world = new CoopWorld(r);
    const node = { r, scene, manager, world, calls, texts, anims,
      finish(missing = []) {
        for (const a of ASSETS_BOSS) if (!missing.includes(a.chave)) (a.tipo === "audio" ? audio : textures).set(a.chave, {});
        calls.length = 0; load.emit("complete");
      },
    };
    world.bossLoading.now = () => clock;
    return node;
  }
  let clock = Date.now();
  for (let i = 0; i < count; i++) nodes.push(makeNode(i));
  function flush() {
    let limit = 200;
    while (messages.length && --limit) {
      const action = messages.shift();
      for (const n of nodes) {
        if (action.kind === "state") {
          if (n.manager.playerId !== action.playerId) {
            n.manager.room.coopBossPreparation = mergeBossPreparation(n.manager.room, n.manager.room.coopBossPreparation, action.room.coopBossPreparation);
            n.world.bossLoading.apply(n.manager.room.coopBossPreparation);
          }
        } else if (action.authority || n.r.host) n.world.receive(action);
      }
    }
    assert.ok(limit, "mensagens de controle não entram em ciclo");
  }
  function tick() {
    for (const n of nodes) { n.scene.preparacaoBoss.atualizar(); n.world.bossLoading.update(); }
    flush();
  }
  function open() { for (const n of nodes) n.scene.portasFabrica.forEach(p => { p.estado = "aberta"; }); }
  function close() { for (const n of nodes) n.scene.portasFabrica.forEach(p => { p.estado = "fechada"; }); }
  function enter() { nodes[0].scene.player.setPosition(-1100, -5500); tick(); }
  return { nodes, sent, messages, flush, tick, open, close, enter, advance: ms => { clock += ms; },
    settle() { for (let i = 0; i < 6; i++) tick(); },
    disconnect(id, nextHost) {
      const index = nodes.findIndex(n => n.manager.playerId === id);
      const removed = nodes.splice(index, 1)[0]; removed.world.destroy(); removed.scene.events.emit("shutdown");
      for (const n of nodes) {
        n.manager.room.players = n.manager.room.players.filter(p => p.id !== id);
        n.r.players.remotes.delete(id);
        if (nextHost) {
          n.manager.room.hostId = nextHost;
          if (n.manager.playerId === nextHost) {
            Object.assign(n.r, { replica: { destroy() {} }, receiver: { destroy() {} }, music: { changeAuthority() {} },
              prepareAuthority() {} });
            CoopRuntime.prototype.changeAuthority.call(n.r, true);
          }
        }
      }
    },
    dispose() { for (const n of nodes) { n.world.destroy(); n.scene.events.emit("shutdown"); } },
    remake(index) { const old = nodes[index]; old.world.destroy(); old.scene.events.emit("shutdown");
      const fresh = makeNode(index, old.manager.room); nodes[index] = fresh; return fresh; } };
}

for (const count of [2, 3, 4]) test(`${count} jogadores: cartão inicia carga local; portas e último cliente retêm a câmera`, t => {
  const h = room(count); t.after(() => h.dispose());
  const host = h.nodes[0];
  Object.assign(host.scene, { coopRuntime: host.r, multiplayerManager: host.manager });
  iniciarRelogioCoop(host.scene);
  h.advance(20000);
  for (let i = 0; i < 5; i++) h.tick();
  assert.ok(h.nodes.every(n => n.calls.length === 0 && !n.r.bossAssetsPrepared));
  assert.equal(host.world.confirmarCartao(), true); h.flush();
  assert.ok(h.nodes.every(n => n.calls.length === 28 && n.scene.load.starts === 1));
  assert.ok(h.sent.some(a => a.kind === "bossPreparation"));
  h.open(); h.enter();
  assert.equal(host.world.bossLoading.state.phase, "assembling");
  const points = Object.values(host.world.bossAssembly.jogadores);
  assert.equal(new Set(points.map(p => p.y)).size, 1);
  for (let i = 0; i < points.length; i++) {
    assert.ok(jogadorNaArenaNovoBoss({ active: true, ...points[i] }, host.scene.novoBoss.config.arena));
    assert.ok(retanguloLivreDoMapa(host.scene, { x: points[i].x - 15, y: points[i].y + 11, width: 30, height: 15 }));
    if (i) assert.ok(Math.abs(points[i].x - points[i-1].x) >= 64);
  }
  assert.ok(h.nodes.every(n => n.scene.movimentoBloqueado && n.r.teleports === 1));
  for (const n of h.nodes.slice(0, -1)) n.finish();
  h.close(); h.tick();
  assert.ok(!h.sent.some(a => a.kind === "bossIntro"));
  assert.equal(host.world.iniciarIntroducaoBoss(), false);
  assert.ok(h.nodes.every(n => n.texts.filter(t => t.visible).every(t => t.text === "CARREGANDO...")));
  h.nodes.at(-1).finish(); h.settle();
  assert.equal(h.sent.filter(a => a.kind === "bossIntro").length, 1);
  assert.ok(h.nodes.every(n => n.r.bossAssetsPrepared && n.anims.size === 2));
  assert.ok(h.nodes.every(n => !n.world.bossLoading.canStart()));
  h.advance(350); h.tick();
  assert.ok(h.nodes.every(n => n.world.bossLoading.canStart()));
  assert.equal(tempoPartida(host.scene), 20350);
  assert.equal(host.world.iniciarIntroducaoBoss(), true);
  for (let i = 0; i < 5; i++) h.tick();
  assert.equal(h.sent.filter(a => a.kind === "bossIntro").length, 1);
  assert.ok(h.nodes.every(n => n.r.teleports === 1 && n.scene.portasFabrica.every(p => p.fechamentos === 1)));
});

test("erro de áudio retém todos; retry local só baixa o pendente e não repete reunião ou portas", t => {
  const h = room(3); t.after(() => h.dispose());
  h.nodes[0].world.confirmarCartao(); h.flush(); h.open(); h.enter();
  h.nodes[0].finish(); h.nodes[1].finish(); h.nodes[2].finish(["musica-novo-boss"]);
  h.close(); h.settle();
  assert.ok(!h.sent.some(a => a.kind === "bossIntro"));
  assert.equal(h.nodes[2].r.bossAssetsPrepared, undefined);
  assert.ok(h.nodes[2].texts[1].visible);
  assert.ok(h.nodes[0].texts[0].text.includes("Aguardando jogador"));
  h.nodes[2].texts[1].emit("pointerdown");
  assert.deepEqual(h.nodes[2].calls.map(a => a.key), ["musica-novo-boss"]);
  h.nodes[2].finish(); h.settle();
  assert.equal(h.sent.filter(a => a.kind === "bossIntro").length, 1);
  assert.ok(h.nodes.every(n => n.r.teleports === 1 && n.scene.portasFabrica.every(p => p.fechamentos === 1)));
});

test("todos podem falhar e tentar novamente antes de entrar sem ficar presos na fábrica", t => {
  const h = room(2); t.after(() => h.dispose());
  h.nodes[0].world.confirmarCartao(); h.flush();
  h.nodes.forEach(n => n.finish(["novo-boss-tentaculo"])); h.tick();
  h.nodes.forEach(n => { n.texts[1].emit("pointerdown"); n.finish(); });
  h.settle(); h.tick();
  assert.ok(h.nodes.every(n => !n.scene.movimentoBloqueado));
  assert.equal(h.nodes[0].world.bossLoading.state.phase, "loading");
});

test("host valida cartão, energia e proximidade; leitor remoto pode autorizar com host afastado", t => {
  const h = room(2); t.after(() => h.dispose());
  const [host, client] = h.nodes;
  host.scene.inventory.getQuantity = () => 0;
  assert.equal(host.world.confirmarCartao(), false);
  host.manager.room.players[1].coop.accessCard = false;
  host.r.players.remotes.get("p1").actor.setPosition(-1100, -5250);
  client.world.confirmarCartao(); h.flush();
  assert.equal(host.world.bossLoading.state, null);
  host.manager.room.players[1].coop.accessCard = true;
  host.scene.luzFabricaAcesa = false;
  client.world.confirmarCartao(); h.flush();
  assert.equal(host.world.bossLoading.state, null);
  host.scene.luzFabricaAcesa = true;
  host.r.players.remotes.get("p1").actor.setPosition(98, -1040);
  client.world.confirmarCartao(); h.flush();
  assert.equal(host.world.bossLoading.state, null);
  host.scene.player.setPosition(98, -1040);
  host.r.players.remotes.get("p1").actor.setPosition(-1100, -5250);
  client.world.confirmarCartao(); h.flush();
  assert.ok(host.world.bossLoading.state);
  assert.ok(h.nodes.every(n => n.scene.load.starts === 1));
});

test("confirmações antigas, de outra sala, sessão e duplicadas não liberam a introdução", t => {
  const h = room(2); t.after(() => h.dispose());
  const host = h.nodes[0]; host.world.confirmarCartao(); h.flush();
  const c = host.world.bossLoading, s = c.state;
  const report = { id: s.id, roomCode: s.roomCode, mapId: s.mapId, session: "session1", status: "ready", placed: true, sequence: 1 };
  const revision = c.state.revision;
  for (const changed of [{ id: "antigo" }, { roomCode: "OUTRA" }, { mapId: 0 }, { session: "sessao-anterior" }])
    c.acceptStatus("p1", { ...report, ...changed });
  assert.equal(c.state.revision, revision);
  c.acceptStatus("p1", report);
  const accepted = c.state.revision;
  c.acceptStatus("p1", report);
  assert.equal(c.state.revision, accepted);
  assert.ok(!h.sent.some(a => a.kind === "bossIntro"));
});

test("desconectar um cliente lento atualiza a barreira e migração preserva a preparação e a reunião", t => {
  const h = room(4); t.after(() => h.dispose());
  h.nodes[0].world.confirmarCartao(); h.flush(); h.open(); h.enter();
  const attempt = h.nodes[0].world.bossLoading.state.id;
  h.nodes[0].finish(); h.nodes[1].finish(); h.nodes[2].finish(); h.close(); h.tick();
  h.disconnect("p0", "p1");
  h.tick();
  assert.equal(h.nodes[0].world.bossLoading.state.id, attempt);
  assert.ok(!h.sent.some(a => a.kind === "bossIntro"));
  h.disconnect("p3"); h.settle();
  assert.equal(h.sent.filter(a => a.kind === "bossIntro").length, 1);
  assert.equal(h.sent.find(a => a.kind === "bossIntro").playerId, "p1");
  assert.ok(h.nodes.every(n => n.r.teleports === 1 && n.scene.load.starts === 1 && n.scene.portasFabrica.every(p => p.fechamentos === 1)));
});

test("reconexão durante preparação confirma a nova sessão sem repetir a reunião nos demais", t => {
  const h = room(3); t.after(() => h.dispose());
  h.nodes[0].world.confirmarCartao(); h.flush(); h.open(); h.enter(); h.close();
  h.nodes[0].finish(); h.nodes[1].finish(); h.tick();
  for (const n of h.nodes) n.manager.room.players.find(p => p.id === "p1").coop.sceneSession = "reconectado";
  const novo = h.remake(1); novo.r.streamId = "reconectado";
  h.tick();
  assert.equal(novo.scene.load.starts, 1);
  assert.equal(novo.r.teleports, 1);
  assert.ok(!h.sent.some(a => a.kind === "bossIntro"));
  novo.finish(); h.nodes[2].finish(); h.close(); h.settle();
  assert.equal(h.sent.filter(a => a.kind === "bossIntro").length, 1);
  assert.ok(h.nodes.every(n => n.r.teleports === 1));
});

test("duas salas independentes não compartilham tentativas, caches ou confirmações", t => {
  const a = room(2, "SALA1"), b = room(4, "SALA2"); t.after(() => { a.dispose(); b.dispose(); });
  a.nodes[0].world.confirmarCartao(); a.flush();
  assert.ok(b.nodes.every(n => !n.scene.load.starts && !n.world.bossLoading.state));
  b.nodes[0].world.confirmarCartao(); b.flush();
  const state = a.nodes[0].world.bossLoading.state;
  b.nodes[0].world.bossLoading.apply(state);
  assert.notEqual(b.nodes[0].world.bossLoading.state.id, state.id);
  a.open(); a.enter(); a.close(); a.nodes.forEach(n => n.finish()); a.settle();
  assert.equal(a.sent.filter(a => a.kind === "bossIntro").length, 1);
  assert.ok(!b.sent.some(a => a.kind === "bossIntro"));
});

test("download e animações completos ainda aguardam a réplica visual antes de autorizar câmera", t => {
  const h = room(2); t.after(() => h.dispose());
  const [host, client] = h.nodes;
  host.world.confirmarCartao(); h.flush(); h.open(); h.enter(); h.close();
  client.r.visualDelayed = true;
  h.nodes.forEach(n => n.finish()); h.settle();
  assert.ok(h.nodes.every(n => n.r.bossAssetsPrepared && n.anims.size === 2));
  assert.ok(host.world.bossLoading.state.systemsPrepared);
  assert.ok(!h.sent.some(a => a.kind === "bossIntro"));
  client.r.visualDelayed = false; h.settle();
  assert.equal(h.sent.filter(a => a.kind === "bossIntro").length, 1);
});

test("mensagem de câmera antes do último frame da espera não conserva o bloqueio de movimento ao terminar", t => {
  const h = room(2); t.after(() => h.dispose());
  h.nodes[0].world.confirmarCartao(); h.flush(); h.open(); h.enter(); h.close();
  h.nodes.forEach(n => n.finish()); h.settle(); h.advance(350);
  const client = h.nodes[1];
  client.world.update(16);
  assert.ok(!client.world.introLock, "o lock cinematográfico espera o controlador devolver o lock de carregamento");
  client.scene.preparacaoBoss.atualizar();
  assert.ok(client.world.introLock);
  assert.equal(client.world.savedIntro.lock, false);
  client.world.restoreIntro();
  assert.equal(client.scene.movimentoBloqueado, false);
});

test("uma confirmação antiga da mesma sessão não desfaz um erro mais recente", t => {
  const h = room(2); t.after(() => h.dispose());
  const host = h.nodes[0]; host.world.confirmarCartao(); h.flush();
  const c = host.world.bossLoading, s = c.state;
  const common = { id: s.id, roomCode: s.roomCode, mapId: s.mapId, session: "session1", placed: true };
  c.acceptStatus("p1", { ...common, sequence: 3, status: "failed" });
  c.acceptStatus("p1", { ...common, sequence: 2, status: "ready" });
  assert.equal(c.state.clients.p1.status, "failed");
});

test("nenhum preparo incompleto de animações ou sistemas do host libera o encontro", t => {
  const h = room(2); t.after(() => h.dispose());
  h.nodes[0].world.confirmarCartao(); h.flush(); h.open(); h.enter(); h.close();
  h.nodes[0].r.systemsReady = false;
  h.nodes.forEach(n => n.finish()); h.settle();
  assert.ok(!h.sent.some(a => a.kind === "bossIntro"));
  assert.equal(h.nodes[0].scene.preparacaoBoss.estado, "falhou");
  h.nodes[0].r.systemsReady = true;
  h.nodes[0].texts[1].emit("pointerdown"); h.settle();
  assert.equal(h.sent.filter(a => a.kind === "bossIntro").length, 1);
});

test("resgate continua obrigatório antes de reunir a equipe e a desconexão de um caído não prende a sala", t => {
  const h = room(3); t.after(() => h.dispose());
  h.nodes[0].world.confirmarCartao(); h.flush(); h.open();
  for (const n of h.nodes) n.manager.room.players.find(p => p.id === "p2").dead = true;
  h.enter();
  assert.equal(h.nodes[0].world.bossLoading.state.phase, "loading");
  assert.ok(h.nodes.every(n => n.r.teleports === 0));
  h.disconnect("p2"); h.tick();
  assert.equal(h.nodes[0].world.bossLoading.state.phase, "assembling");
  h.close(); h.nodes.forEach(n => n.finish()); h.settle();
  assert.equal(h.sent.filter(a => a.kind === "bossIntro").length, 1);
});

test("retomada depois da introdução prepara o cliente sem repetir câmera, portas ou posições dos aliados", t => {
  const h = room(2); t.after(() => h.dispose());
  h.nodes[0].world.confirmarCartao(); h.flush(); h.open(); h.enter(); h.close();
  h.nodes.forEach(n => n.finish()); h.settle(); h.advance(350); h.tick();
  h.nodes[0].scene.novoBoss.introducao = { snapshot: () => ({ concluida: true }) }; h.tick();
  assert.equal(h.nodes[1].world.bossLoading.state.phase, "complete");
  for (const n of h.nodes) {
    const p = n.manager.room.players.find(p => p.id === "p1");
    Object.assign(p, { x: -1200, y: -5750 }); p.coop.sceneSession = "retomada";
  }
  const novo = h.remake(1); novo.r.streamId = "retomada";
  const remoto = novo.r.players.remotes.get("p0").actor, posicao = { x: remoto.x, y: remoto.y };
  h.tick();
  assert.equal(novo.scene.load.starts, 1);
  assert.ok(novo.scene.movimentoBloqueado);
  assert.deepEqual({ x: novo.scene.player.x, y: novo.scene.player.y }, { x: -1200, y: -5750 });
  assert.deepEqual({ x: remoto.x, y: remoto.y }, posicao);
  assert.ok(novo.scene.portasFabrica.every(p => p.fechamentos === 0 && p.estado === "fechada"));
  novo.finish(); h.settle();
  assert.equal(novo.scene.movimentoBloqueado, false);
  assert.ok(!novo.world.introCamera && !novo.world.introLock);
  assert.equal(h.sent.filter(a => a.kind === "bossIntro").length, 1);
});

test("migração depois da autorização, antes da câmera, reutiliza o evento e o prazo sem repetir a entrada", t => {
  const h = room(3); t.after(() => h.dispose());
  h.nodes[0].world.confirmarCartao(); h.flush(); h.open(); h.enter(); h.close();
  h.nodes.forEach(n => n.finish()); h.settle();
  const id = h.nodes[0].world.bossLoading.state.id;
  h.advance(100); h.disconnect("p0", "p1"); h.settle();
  assert.equal(h.nodes[0].world.bossLoading.state.id, id);
  assert.ok(h.nodes.every(n => !n.world.bossLoading.canStart()));
  h.advance(250); h.settle();
  assert.ok(h.nodes.every(n => n.world.bossLoading.canStart()));
  assert.equal(h.sent.filter(a => a.kind === "bossIntro").length, 1);
  assert.ok(h.nodes.every(n => n.r.teleports === 1 && n.scene.portasFabrica.every(p => p.fechamentos === 1)));
});

test("cache quente evita todos os downloads e animações ausentes nunca contam como cliente pronto", t => {
  const h = room(2); t.after(() => h.dispose());
  h.nodes.forEach(n => n.finish());
  h.nodes[1].scene.anims.create = () => {}; // Download completo com preparação de animação ainda falhando.
  h.nodes[0].world.confirmarCartao(); h.flush(); h.open(); h.enter(); h.close(); h.settle();
  assert.ok(h.nodes.every(n => !n.scene.load.starts && n.calls.length === 0));
  assert.equal(h.nodes[1].scene.preparacaoBoss.estado, "falhou");
  assert.ok(!h.sent.some(a => a.kind === "bossIntro"));
  h.nodes[1].scene.anims.create = c => h.nodes[1].anims.set(c.key, c);
  h.nodes[1].texts[1].emit("pointerdown"); h.settle();
  assert.equal(h.sent.filter(a => a.kind === "bossIntro").length, 1);
  assert.ok(h.nodes.every(n => !n.scene.load.starts));
});

test("cartão confirmado enquanto host termina a fábrica é reenviado sem exigir outra leitura", t => {
  const h = room(2); t.after(() => h.dispose());
  const [host, client] = h.nodes;
  host.manager.room.players[1].coop.accessCard = true;
  host.r.players.remotes.get("p1").actor.setPosition(-1100, -5250);
  client.scene.inventory.getQuantity = key => key === "card" ? 1 : 0;
  const receive = host.world.bossLoading.receive;
  host.world.bossLoading.receive = () => true; // Intervalo sem runtime durante o preload do host.
  client.world.confirmarCartao(); h.flush();
  assert.ok(!host.world.bossLoading.state);
  host.world.bossLoading.receive = receive;
  client.world.bossLoading.accessRequestedAt = Date.now() - 1001;
  h.tick();
  assert.ok(host.world.bossLoading.state);
  assert.ok(h.nodes.every(n => n.scene.load.starts === 1));
  assert.equal(h.sent.filter(a => a.kind === "bossAccess").length, 2);
});


test('migração após vitória preserva SENTINEL derrotado sem repetir combate ou evento', () => {
  const events = new EventEmitter(); let limpezas = 0, preparacoes = 0, restores = 0;
  const scene = { events, registry: new Map(), game: { getTime: () => 1 }, novoBoss: { morto: true } };
  const r = { scene, manager: {}, players: { remotes: new Map() }, music: { changeAuthority() {} },
    replica: { encounter: scene.novoBoss, destroy() { scene.novoBoss = null; } }, receiver: { destroy() {} },
    world: { restoreIntro() {}, restore() { restores++; }, bossLoading: { now: () => 1, state: { phase: 'complete' }, retimeAfterMigration() {} } },
    prepareAuthority() { scene.novoBoss = { config: {}, limpar() { limpezas++; scene.novoBoss = null; } }; },
    prepareBossEncounter() { preparacoes++; } };
  CoopRuntime.prototype.changeAuthority.call(r, true);
  assert.equal(scene.novoBoss.morto, true); assert.equal(scene.novoBoss.encerrado, true); assert.equal(scene.novoBoss.vida, 0);
  assert.equal(limpezas, 1); assert.equal(preparacoes, 0); assert.equal(restores, 1);
});

for (const quantidade of [0, 18]) test(`limpeza em ambos os clientes ocorre antes do download (${quantidade} robôs)`, t => {
  const h = room(2); t.after(() => h.dispose());
  for (const n of h.nodes) {
    const s = n.scene;
    let removidos = 0, lasers = 0, grupos = 0, spawns = 0, efeitos = 0, sons = 0;
    s.spawnAreasRoboBola = { destruir() { spawns++; } };
    s.inimigos = Array.from({ length: quantidade }, (_, i) => {
      const robo = Object.assign(new EventEmitter(), { active: true, tipoRobo: ["bola", "olhao", "serra", "padrao"][i % 4],
        body: { enable: true }, setActive(active) { this.active = active; }, setVisible() {},
        destroy() { removidos++; this.emit("destroy"); },
        somPassoRobo: { stop() { sons++; }, destroy() { sons++; } } });
      robo.once("destroy", () => efeitos++);
      return robo;
    });
    if (quantidade) s.lasersInimigo = { clear(destruir, remover) { assert.ok(destruir && remover); lasers++; }, destroy() { grupos++; } };
    const start = s.load.start;
    s.load.start = () => {
      assert.equal(s.robosFabricaDescarregados, true);
      assert.equal(s.inimigos.length, 0);
      assert.equal(removidos, quantidade);
      assert.equal(efeitos, quantidade);
      assert.equal(sons, quantidade * 2);
      assert.equal(lasers, Number(quantidade > 0));
      assert.equal(grupos, lasers);
      assert.equal(spawns, 1);
      start();
    };
  }
  h.nodes[0].world.confirmarCartao(); h.settle();
  for (const n of h.nodes) {
    assert.equal(n.scene.load.starts, 1);
    assert.equal(executarSpawnDev(n.scene, "bola"), null);
    assert.equal(criarRoboBola(n.scene, { x: -1000, y: -5720 }), null);
    assert.equal(n.scene.player.active, true);
    assert.equal(n.scene.inimigoTeste, null);
  }
});

test("entrada do cliente primeiro é autorizada pelo host mesmo sem o host na arena", t => {
  const h = room(2); t.after(() => h.dispose());
  const [host, client] = h.nodes;
  host.r.players.remotes.get("p1").actor.setPosition(-1100, -5500);
  assert.equal(host.r.inArena(host.scene.player), false);
  h.settle();
  assert.equal(host.world.bossLoading.state.phase, "assembling");
  assert.equal(client.r.teleports, 1);
  h.close();
  client.finish(); h.settle();
  assert.ok(!h.sent.some(a => a.kind === "bossIntro"), "host lento ainda bloqueia a apresentação");
  host.finish(); h.settle();
  assert.equal(h.sent.filter(a => a.kind === "bossIntro").length, 1);
  // Uma cópia atrasada da sessão de outro jogador não desfaz o compromisso do host.
  const c = client.world.bossLoading;
  client.manager.room.players.find(p => p.id === "p0").coop.sceneSession = "atrasado";
  h.advance(350);
  assert.equal(c.canStart(), true);
});

test("confirmação perdida é reenviada e download travado tem diagnóstico e recuperação", t => {
  const h = room(2); t.after(() => h.dispose());
  const [host, client] = h.nodes;
  host.world.confirmarCartao(); h.flush(); h.open(); h.enter(); h.close();
  host.finish(); h.settle();
  client.scene.load.emit("progress", 0.4);
  h.settle(); h.advance(16000); h.tick();
  assert.match(client.texts[0].text, /Download local sem avanço \(40%\)/);
  assert.equal(client.texts[1].visible, true);
  client.texts[1].emit("pointerdown");
  assert.ok(h.sent.some(a => a.kind === "keyframe" && a.playerId === "p1"));
  assert.equal(client.scene.load.starts, 1, "retry não abre outra fila durante download ativo");
  client.finish(); client.world.bossLoading.report();
  h.messages.splice(h.messages.findIndex(a => a.kind === "bossPrepared" && a.payload.status === "ready"), 1);
  h.settle();
  assert.ok(!h.sent.some(a => a.kind === "bossIntro"));
  h.advance(1200); h.settle();
  assert.equal(h.sent.filter(a => a.kind === "bossIntro").length, 1);
});

test("snapshot atrasado não recria visuais dos robôs e preserva o prólogo", () => {
  let destruicoes = 0;
  const receiver = new VisualReceiver({ add: { graphics() { return { setVisible() { return this; },
    setPosition() {}, setDepth() {}, setScale() { return this; }, setRotation() { return this; }, setAlpha() { return this; },
    setScrollFactor() { return this; }, setBlendMode() { return this; }, clear() {}, active: true,
    type: "Graphics", destroy() { destruicoes++; } }; } } });
  const antigo = { active: true, destroy() { destruicoes++; } };
  const prologo = { active: true, destroy() { assert.fail("visual do prólogo não deve ser removido"); } };
  receiver.entries.set("v1", { object: antigo, state: { t: "Graphics", factoryRobot: true } });
  receiver.entries.set("v2", { object: prologo, state: { t: "Graphics" } });
  receiver.receive({ changed: [{ id: "v1", s: { x: 4 } }, { id: "v3", s: { t: "Graphics", factoryRobot: true } }] }, true);
  assert.equal(destruicoes, 1);
  assert.equal(receiver.get("v1"), undefined);
  assert.equal(receiver.get("v3"), undefined);
  assert.equal(receiver.get("v2"), prologo);
});

test("participante novo durante a reunião recebe destino e invalida a confirmação de posicionamento antiga", t => {
  const h = room(2); t.after(() => h.dispose());
  const host = h.nodes[0];
  host.world.confirmarCartao(); h.flush(); h.open(); h.enter(); h.close();
  const loading = host.world.bossLoading;
  const antes = loading.state.entrada;
  assert.equal(antes.revision, 0);
  for (const n of h.nodes) n.manager.room.players.push({ id: "p2", health: 100, coop: { sceneSession: "session2" } });
  const player = actor(-1100, -5250);
  host.r.players.remotes.set("p2", { actor: player, context: { player, vida: 100, coopRemotePlayerId: "p2" } });
  h.settle();
  const atual = loading.state;
  assert.equal(atual.entrada.revision, 1);
  assert.ok(atual.entrada.jogadores.p2);
  loading.acceptStatus("p2", { id: atual.id, roomCode: atual.roomCode, mapId: atual.mapId,
    session: "session2", sequence: 1, placement: 0, status: "ready", placed: true });
  assert.equal(loading.state.clients.p2.placed, false);
  assert.equal(loading.ready(), false);
});
