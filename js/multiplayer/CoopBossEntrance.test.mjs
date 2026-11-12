import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { EventEmitter } from "node:events";
import { planejarEntradaBoss } from "./CoopBossEntrance.js";
import { CoopWorld } from "./CoopWorld.js";
import { configurarZonasNovoBoss, jogadorNaArenaNovoBoss, novoBossConfig } from "../enemies/novoBoss/NovoBossConfig.js";
import { retanguloLivreDoMapa } from "../enemies/EnemyPathfinding.js";

function actor(x, y) {
  const p = { active: true, x, y, setVelocity() {}, setPosition(x, y) { Object.assign(this, { x, y }); } };
  p.body = { reset(x, y) { p.setPosition(x, y); }, updateFromGameObject() {} };
  return p;
}
function fixture() {
  const raw = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  const map = { getObjectLayer: name => raw.layers.find(l => l.name === name) };
  const paredes = map.getObjectLayer("collision").objects.filter(o => o.width > 0 && o.height > 0)
    .map(o => ({ body: { x: o.x, y: o.y, width: o.width, height: o.height, enable: true } }));
  const host = actor(98, -1040), origem = actor(-1080, -5500), outro = actor(-600, -2000);
  const encontro = { config: configurarZonasNovoBoss(map, novoBossConfig), x: -1080, y: -5810, barreiraAtiva: true };
  const registro = new Map(); registro.events = new EventEmitter();
  const camera = { zoom: 1, midPoint: { x: 98, y: -1040 },
    centerOn(x, y) { this.midPoint = { x, y }; } };
  const ordem = [], enviados = [];
  const scene = { map, player: host, cameras: { main: camera }, game: { registry: registro }, time: { now: 0 },
    novoBoss: encontro, collisionGroup: { getChildren: () => paredes },
    portasFabrica: [{ nome: "porta02", area: { y: -5328 } }],
    descarregarFabricaParaBoss() { ordem.push("limpar"); },
  };
  const participantes = [
    { player: host, vida: 100, estadoDash: { ativo: true } },
    { player: origem, vida: 100, coopRemotePlayerId: "origem" },
    { player: outro, vida: 100, coopRemotePlayerId: "outro" },
  ];
  const manager = { playerId: "host", room: {}, sendCoopAction(...args) { enviados.push(args); } };
  const runtime = { host: true, mapKey: "Level1Parte2", scene, manager,
    playerContexts: () => participantes,
    players: { remotes: new Map([["origem", { actor: origem }], ["outro", { actor: outro }]]) },
    teleport(x, y) { ordem.push("teleportar"); host.body.reset(x, y); },
  };
  const world = new CoopWorld(runtime);
  return { scene, encontro, origem, host, outro, runtime, world, ordem, enviados, participantes };
}

test("aliado inicia a cutscene e reúne o host e os demais antes de limpar", () => {
  const { scene, encontro, origem, host, outro, world, ordem, enviados, participantes } = fixture();
  assert.equal(world.iniciarIntroducaoBoss(encontro, origem), true);
  assert.deepEqual(ordem, ["teleportar", "limpar"]);
  assert.deepEqual([origem.x, origem.y], [-1080, -5500], "quem entrou mantém sua posição");
  for (const p of [host, outro]) {
    assert.equal(jogadorNaArenaNovoBoss(p, encontro.config.arena), true);
    assert.ok(retanguloLivreDoMapa(scene, { x: p.x - 18, y: p.y + 10, width: 36, height: 20 }));
    assert.ok(Math.hypot(p.x - origem.x, p.y - origem.y) >= 56);
  }
  assert.ok(Math.hypot(host.x - outro.x, host.y - outro.y) >= 56);
  assert.equal(participantes[0].estadoDash.ativo, false);
  assert.equal(enviados[0][0], "bossIntro");
  assert.equal(enviados[0][2].authority, true);
  assert.deepEqual(world.snapshot().bossAssembly, enviados[0][1].entrada);
  world.iniciarIntroducaoBoss(encontro, origem);
  assert.equal(enviados.length, 1, "não repete o puxão");
  world.destroy();
});

test("o cliente aplica a reunião uma vez e recupera o estado pelos quadros seguintes", () => {
  const { host, runtime, world, ordem } = fixture();
  runtime.host = false;
  const entrada = { id: 1, jogadores: { host: { x: -1080, y: -5500 } } };
  world.aplicarEntradaBoss(entrada);
  assert.deepEqual([host.x, host.y], [-1080, -5500]);
  host.setPosition(-1100, -5520);
  world.aplicarEntradaBoss(entrada);
  assert.deepEqual([host.x, host.y], [-1100, -5520], "quadros repetidos não prendem o jogador após a cena");
  assert.equal(ordem.filter(o => o === "teleportar").length, 1);
  world.receive({ authority: true, kind: "bossIntro", payload: { entrada, camera: { x: 0, y: 0, zoom: 1 } } });
  assert.equal(world.introCamera, undefined, "mensagem atrasada não reinicia a câmera");
  world.destroy();
});

test("sem destino seguro, o plano recusa a reunião inteira antes de mover jogadores", () => {
  const { scene, encontro, origem, participantes } = fixture();
  scene.collisionGroup = { getChildren: () => [{ body: { x: -3000, y: -7000, width: 6000, height: 3000 } }] };
  const plano = planejarEntradaBoss(scene, encontro, origem, participantes.map((c, i) => ({ id: String(i), player: c.player })));
  assert.equal(plano, null);
});

test("pacotes antigos não devolvem aliados à fábrica durante a cutscene", async t => {
  const previousPhaser = globalThis.Phaser;
  globalThis.Phaser = { Geom: { Rectangle: class {
    constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); }
  } } };
  t.after(() => { globalThis.Phaser = previousPhaser; });
  const { CoopPlayers } = await import("./CoopPlayers.js");
  for (const host of [true, false]) {
    const aliado = actor(-1080, -5500);
    Object.assign(aliado.body, {
      setSize() { return this; }, setOffset() { return this; },
    });
    const scene = { cenaEntradaBossAtiva: true, remotePlayers: new Map([["aliado", aliado]]) };
    const runtime = { host, scene, mapKey: "Level1Parte2", manager: { playerId: "local" },
      world: { bossAssembly: { jogadores: { aliado: { x: -1080, y: -5500 } } } } };
    const players = new CoopPlayers(runtime);
    players.remotes.set("aliado", { actor: aliado, speeches: new Map() });
    players.effects.set("aliado", { receive() {} });
    const data = { id: "aliado", character: "nyx", mapKey: "Level1Parte2", x: 98, y: -1040, health: 100 };
    players.receive([data]);
    assert.deepEqual([aliado.coopTargetX, aliado.coopTargetY], [-1080, -5500]);
    if (host) assert.deepEqual([aliado.x, aliado.y], [-1080, -5500]);
    assert.equal(data.x, 98, "o pacote original da sala não é modificado");
    scene.cenaEntradaBossAtiva = false;
    players.receive([{ ...data, x: -1100, y: -5520 }]);
    assert.deepEqual([aliado.coopTargetX, aliado.coopTargetY], [-1100, -5520], "movimento remoto volta ao normal após a cena");
  }
});

test("cutscene espera o resgate de aliados caídos antes de descarregar a fábrica", () => {
  const { runtime, world, encontro, origem, ordem, enviados } = fixture();
  runtime.revival = { participants: () => [{ dead: true }] };
  assert.equal(world.iniciarIntroducaoBoss(encontro, origem), false);
  assert.deepEqual(ordem, []);
  assert.equal(enviados.length, 0);
  runtime.revival.participants = () => [{ dead: false }];
  assert.equal(world.iniciarIntroducaoBoss(encontro, origem), true);
  world.destroy();
});
