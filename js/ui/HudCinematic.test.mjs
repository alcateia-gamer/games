import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { ocultarHUDDuranteCena } from "./HudCinematic.js";

test("oculta HUD Phaser/HTML e elementos tardios sem apagar luzes ou alterar visibilidade dos controles", () => {
  const camera = { id: 1 };
  const objeto = (depth, cameraFilter = 0) => ({ depth, cameraFilter, visible: true,
    scrollFactorX: 0, scrollFactorY: 0 });
  const botao = objeto(100, 2), minimapa = objeto(100100), barraBoss = objeto(100010);
  const luz = objeto(50), torre = { ...objeto(53), scrollFactorX: 1, scrollFactorY: 1 };
  const oculto = { ...objeto(200, 1), visible: false };
  const status = { style: { visibility: "visible" } };
  const radarDOM = { ...objeto(100100), node: { style: { visibility: "" } } };
  const aliados = { style: { visibility: "" } };
  const scene = { events: new EventEmitter(), hudStatus: { elemento: status }, hudAliados: { elemento: aliados },
    children: { list: [botao, minimapa, barraBoss, luz, torre, oculto, radarDOM] } };
  const hud = ocultarHUDDuranteCena(scene, camera);
  assert.equal(botao.cameraFilter, 3); assert.equal(botao.visible, true);
  assert.equal(minimapa.cameraFilter, 1); assert.equal(barraBoss.cameraFilter, 1);
  assert.equal(luz.cameraFilter, 0); assert.equal(torre.cameraFilter, 0);
  assert.equal(aliados.style.visibility, "hidden");
  assert.equal(status.style.visibility, "hidden"); assert.equal(radarDOM.node.style.visibility, "hidden");
  // Atualizações normais dos botões/minimapa não podem reexibir a interface na câmera.
  botao.visible = minimapa.visible = true;
  const novo = { ...objeto(232), node: { style: {} } };
  const novoStatus = { style: {} };
  scene.children.list.push(novo);
  scene.hudStatus.elemento = novoStatus;
  scene.events.emit("prerender");
  assert.equal(novo.cameraFilter, 1); assert.equal(novoStatus.style.visibility, "hidden");
  botao.cameraFilter |= 4; // Preserva alterações de outra câmera durante a cena.
  hud.restaurar(); hud.restaurar();
  assert.equal(botao.cameraFilter, 6); assert.equal(minimapa.cameraFilter, 0);
  assert.equal(oculto.visible, false); assert.equal(oculto.cameraFilter, 1);
  assert.equal(aliados.style.visibility, "");
  assert.equal(status.style.visibility, "visible"); assert.equal(radarDOM.node.style.visibility, "");
  assert.equal(novoStatus.style.visibility, ""); assert.equal(novo.cameraFilter, 0);
  assert.equal(scene.events.listenerCount("prerender"), 0);
});
