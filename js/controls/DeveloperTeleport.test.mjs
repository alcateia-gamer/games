import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { criarTeleporteDevBoss } from "./DeveloperTeleport.js";

globalThis.Phaser = {
  Scene: class {},
  Input: { Keyboard: { KeyCodes: { O: 79 } } },
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
};

function fixture(key = "Level1Parte2") {
  const tecla = new EventEmitter();
  const scene = {
    sys: { settings: { key } },
    input: { keyboard: { addKey(code) { assert.equal(code, 79); return tecla; } } },
    events: new EventEmitter(), developerMode: true,
    personagemSelecionada: "aria-kade", multiplayer: true,
    estadoDash: { ativo: true },
    player: { active: true, body: { reset(x, y) {
      scene.player.x = x; scene.player.y = y; this.velocity = { x: 0, y: 0 };
    }, velocity: { x: 400, y: 0 } } },
    companionPet: { setPosition(x, y) { this.x = x; this.y = y; } },
    physics: { pause() { this.paused = true; } },
    scene: { start(key, data) { this.destination = { key, data }; } },
  };
  criarTeleporteDevBoss(scene);
  return { scene, press: () => tecla.emit("down"), tecla };
}

test("O só teleporta com DEV ativo e sem morte ou transição", () => {
  for (const bloqueio of [{ developerMode: false }, { morteEmAndamento: true },
    { transicaoEmAndamento: true }, { transicaoRetornoEmAndamento: true }]) {
    const { scene, press } = fixture();
    Object.assign(scene, bloqueio);
    press();
    assert.equal(scene.player.x, undefined);
    assert.equal(scene.scene.destination, undefined);
  }
});

test("O na fábrica move jogador e companheiro, parando o dash e a velocidade", () => {
  const { scene, press } = fixture();
  press();
  assert.equal(scene.player.x, -1085);
  assert.equal(scene.player.y, -5169);
  assert.deepEqual(scene.player.body.velocity, { x: 0, y: 0 });
  assert.equal(scene.estadoDash.ativo, false);
  assert.equal(scene.companionPet.x, -1130);
  assert.equal(scene.companionPet.y, -5134);
  assert.equal(scene.scene.destination, undefined);
});

test("O na cidade entra no segundo mapa nas coordenadas pedidas, preservando DEV e personagem", () => {
  const { scene, press } = fixture("Level1");
  press();
  assert.equal(scene.transicaoEmAndamento, true);
  assert.equal(scene.physics.paused, true);
  assert.deepEqual(scene.scene.destination, { key: "Level1Parte2", data: {
    spawnX: -1085, spawnY: -5169, personagem: "aria-kade", multiplayer: true, developerMode: true,
  } });
});

test("o listener de O é removido ao sair da cena", () => {
  const { scene, tecla } = fixture();
  assert.equal(tecla.listenerCount("down"), 1);
  scene.events.emit("shutdown");
  assert.equal(tecla.listenerCount("down"), 0);
});

test("a fábrica recebe o destino e ativa DEV antes de criar os controles", async () => {
  const { default: Level1Parte2 } = await import("../scenes/Level1Parte2.js");
  const { scene, press } = fixture("Level1");
  press();
  const fabrica = { developerMode: false, game: { registry: new Map() } };
  Level1Parte2.prototype.init.call(fabrica, scene.scene.destination.data);
  assert.equal(fabrica.respawnX, -1085);
  assert.equal(fabrica.respawnY, -5169);
  assert.equal(fabrica.developerMode, true);
  assert.equal(fabrica.personagemSelecionada, "aria-kade");
  assert.equal(fabrica.multiplayer, true);
});
