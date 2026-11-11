import test from "node:test";
import assert from "node:assert/strict";
import { AllyStatusHud, obterAliadosHUD } from "./AllyStatusHud.js";

function cena() {
  const players = [
    { id: "local", character: "kai-mercer", health: 100, maxHealth: 100 },
    { id: "aria", character: "aria-kade", health: 70, maxHealth: 100 },
    { id: "nyx", character: "nyx", health: 120, maxHealth: 150, mapKey: "Level1Parte2" },
  ];
  return { multiplayer: true, coopRuntime: { manager: { playerId: "local", room: { players } },
    players: { remotes: new Map() } } };
}

test("exibe apenas aliados multiplayer, incluindo outro mapa, dano, cura e morte", () => {
  const scene = cena();
  assert.deepEqual(obterAliadosHUD(scene).map(a => a.id), ["aria", "nyx"]);
  scene.coopRuntime.players.remotes.set("aria", { health: 25 });
  assert.equal(obterAliadosHUD(scene)[0].vida, 25);
  scene.coopRuntime.players.remotes.get("aria").health = 50;
  assert.equal(obterAliadosHUD(scene)[0].vida, 50);
  scene.coopRuntime.manager.room.players[1].dead = true;
  assert.equal(obterAliadosHUD(scene)[0].vida, 0);
  assert.equal(obterAliadosHUD(scene)[0].morto, true);
  scene.multiplayer = false;
  assert.deepEqual(obterAliadosHUD(scene), []);
});

test("reutiliza arte, atualiza vida e escala, remove desconectados e limpa o overlay", t => {
  const previousDocument = globalThis.document, previousWindow = globalThis.window;
  t.after(() => { globalThis.document = previousDocument; globalThis.window = previousWindow; });
  globalThis.window = { devicePixelRatio: 2 };
  const desenhos = [], textos = [], elementos = [];
  const ctx = { drawImage: (...args) => desenhos.push(args), fillText: text => textos.push(text) };
  for (const name of ["setTransform", "save", "restore", "beginPath", "rect", "clip"]) ctx[name] = () => {};
  globalThis.document = { createElement: () => ({ style: {}, setAttribute() {},
    getContext: () => ctx, remove() { this.removed = true; } }) };
  const scene = cena();
  scene.hudStatus = { elemento: { style: { width: "350px", height: "42px", top: "10px", left: "10px" },
    parentElement: { appendChild: e => elementos.push(e) } } };
  const arte = { base: {}, preenchimentoVida: {}, largura: 1500, altura: 180,
    estamina: { x: 185 }, vida: { x: 185, y: 110, width: 1300, height: 40 } };
  const hud = new AllyStatusHud(scene, () => arte);
  hud.atualizar();
  assert.equal(elementos.length, 1);
  assert.equal(hud.elemento.style.top, "56px");
  assert.equal(hud.elemento.width, 312);
  assert.ok(desenhos.some(args => args[0] === arte.preenchimentoVida));
  const antes = desenhos.length;
  hud.atualizar(); assert.equal(desenhos.length, antes, "estado estável não repinta");
  scene.coopRuntime.manager.room.players[1].health = 30;
  hud.atualizar(); assert.ok(!textos.some(text => /\d+\/\d+/.test(text)), "vida aparece só na barra");
  scene.coopRuntime.manager.room.players[1].dead = true;
  hud.atualizar(); assert.ok(textos.includes("CAÍDO"));
  scene.hudStatus.elemento.style.width = "175px";
  hud.atualizar(); assert.equal(hud.elemento.width, 156);
  scene.coopRuntime.manager.room.players.pop();
  hud.atualizar(); assert.equal(hud.elemento.height, 33);
  const elemento = hud.elemento;
  scene.multiplayer = false; hud.atualizar();
  assert.equal(elemento.removed, true); assert.equal(hud.elemento, null);
  hud.destruir();
});
