import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { criarMenuColetaveisDev } from "./DeveloperItemMenu.js";
import { Inventory } from "../inventory/Inventory.js";
import { listInventoryItems, registerInventoryItem } from "../inventory/InventoryItems.js";

globalThis.Phaser = {
  Input: { Keyboard: { KeyCodes: { I: 73, ESC: 27 } } },
  Scenes: { Events: { PRE_RENDER: "prerender", SHUTDOWN: "shutdown" } },
};

function fixture({ maxSlots = 20 } = {}) {
  const teclas = new Map();
  const visuais = [];
  const scene = {
    developerMode: true, events: new EventEmitter(),
    inventory: new Inventory({ slots: [], collectedItemIds: [] }, { maxSlots }),
    inventoryItems: new Map(listInventoryItems().map(item => [item.id, item])),
    player: { active: true, setVelocity(x, y) { this.velocity = { x, y }; } },
    estadoDash: { ativo: true },
    cameras: { main: { width: 800, height: 450, zoomX: 1, zoomY: 1, originX: 0.5, originY: 0.5 } },
    textures: { exists: () => true },
    input: { keyboard: { addKey(code) {
      if (!teclas.has(code)) teclas.set(code, new EventEmitter());
      return teclas.get(code);
    } } },
  };
  const visual = (tipo, x, y, conteudo) => {
    const objeto = Object.assign(new EventEmitter(), {
      tipo, x, y, scene, active: true, text: tipo === "text" ? conteudo : "", list: [],
      setPosition(x, y) { Object.assign(this, { x, y }); return this; },
      setScale(x, y = x) { Object.assign(this, { scaleX: x, scaleY: y }); return this; },
      setName(name) { this.name = name; return this; },
      setText(text) { this.text = text; return this; },
      setColor(color) { this.color = color; return this; },
      add(child) { this.list.push(child); return this; },
      destroy() { this.active = false; this.list.forEach(child => child.destroy()); this.removeAllListeners(); },
    });
    for (const metodo of ["setScrollFactor", "setDepth", "setStrokeStyle", "setInteractive",
      "setOrigin", "setDisplaySize", "setWordWrapWidth"]) objeto[metodo] = () => objeto;
    visuais.push(objeto);
    return objeto;
  };
  scene.add = Object.fromEntries(["container", "rectangle", "text", "image"]
    .map(tipo => [tipo, (...args) => visual(tipo, ...args)]));
  criarMenuColetaveisDev(scene);
  const tecla = code => teclas.get(code).emit("down");
  const botao = nome => visuais.find(visual => visual.active && visual.name === nome);
  const clicar = nome => {
    const alvo = botao(nome);
    assert.ok(alvo, `botão ${nome} disponível`);
    let bloqueado = false;
    alvo.emit("pointerdown", {}, 0, 0, { stopPropagation() { bloqueado = true; } });
    assert.equal(bloqueado, true, "clique não chega ao ataque do jogador");
  };
  const textos = () => visuais.filter(visual => visual.active && visual.tipo === "text").map(visual => visual.text);
  return { scene, visuais, teclas, tecla, botao, clicar, textos };
}

test("I só abre o menu com DEV ativo, inventário disponível e jogador vivo", () => {
  for (const bloqueio of [{ developerMode: false }, { morteEmAndamento: true },
    { transicaoEmAndamento: true }, { transicaoRetornoEmAndamento: true },
    { generatorMenuOpen: true }, { inventory: null }, { player: { active: false } }]) {
    const { scene, tecla, visuais } = fixture();
    Object.assign(scene, bloqueio);
    tecla(73);
    assert.equal(scene.devItemMenuOpen, false);
    assert.equal(visuais.length, 0, "menu é criado apenas quando autorizado");
    scene.events.emit("shutdown");
  }
});

test("o catálogo permite pegar todos os coletáveis e atualiza as quantidades", () => {
  const { scene, tecla, clicar, textos } = fixture();
  tecla(73);
  assert.equal(scene.devItemMenuOpen, true);
  assert.equal(scene.movimentoBloqueado, true);
  assert.equal(scene.estadoDash.ativo, false);
  assert.deepEqual(scene.player.velocity, { x: 0, y: 0 });
  for (const item of listInventoryItems()) {
    clicar(`dev-item:${item.id}:1`);
    assert.equal(scene.inventory.getQuantity(item.id), 1);
    assert.ok(textos().includes(`No inventário: 1`));
    if (item.maxStack > 1) {
      clicar(`dev-item:${item.id}:10`);
      assert.equal(scene.inventory.getQuantity(item.id), 11);
    }
  }
  assert.deepEqual(scene.inventory.state.collectedItemIds, [], "itens do mapa continuam coletáveis");
  scene.events.emit("shutdown");
});

test("inventário cheio mostra feedback sem conceder parcialmente ou perder itens", () => {
  const { scene, tecla, clicar, textos } = fixture({ maxSlots: 1 });
  scene.inventory.addItem("sucata", 95);
  tecla(73);
  clicar("dev-item:sucata:10");
  assert.equal(scene.inventory.getQuantity("sucata"), 95);
  assert.ok(textos().some(text => text.includes("Inventário cheio")));
  clicar("dev-item:card:1");
  assert.equal(scene.inventory.getQuantity("card"), 0);
  clicar("dev-item:sucata:1");
  assert.equal(scene.inventory.getQuantity("sucata"), 96);
  scene.events.emit("shutdown");
});

test("galões vazios e cheios ficam junto das quantidades e preservam os galões anteriores", () => {
  const { scene, tecla, clicar, botao, textos } = fixture();
  scene.inventory.addItem("gasolina");
  scene.inventory.fillFuel(0.35);
  tecla(73);
  assert.equal(botao("dev-item:gasolina:1").y, botao("dev-item:gasolina:1:cheio").y);
  assert.ok(textos().includes("+1 vazio"));
  assert.ok(textos().includes("+1 cheio"));
  clicar("dev-item:gasolina:1:cheio");
  clicar("dev-item:gasolina:1");
  assert.deepEqual(scene.inventory.getSlots().map(slot => slot.fuel), [0.35, 1, 0]);
  assert.equal(scene.inventory.getQuantity("gasolina", { minFuel: 1 }), 1);
  scene.events.emit("shutdown");
});

test("pegar galão cheio com inventário lotado não abastece os galões existentes", () => {
  const { scene, tecla, clicar, textos } = fixture({ maxSlots: 1 });
  scene.inventory.addItem("gasolina");
  tecla(73);
  clicar("dev-item:gasolina:1:cheio");
  assert.deepEqual(scene.inventory.getSlots(), [{ itemId: "gasolina", quantity: 1, fuel: 0 }]);
  assert.ok(textos().some(text => text.includes("Inventário cheio")));
  scene.events.emit("shutdown");
});

test("I, Esc e Fechar restauram o bloqueio anterior e removem a assinatura", () => {
  for (const modo of ["I", "Esc", "Fechar"]) {
    const { scene, tecla, clicar, visuais } = fixture();
    scene.movimentoBloqueado = true;
    tecla(73);
    assert.equal(scene.inventory.listeners.size, 1);
    if (modo === "Fechar") clicar("dev-items-close");
    else tecla(modo === "I" ? 73 : 27);
    assert.equal(scene.devItemMenuOpen, false);
    assert.equal(scene.movimentoBloqueado, true, "preserva bloqueio de outro sistema");
    assert.equal(scene.inventory.listeners.size, 0);
    assert.ok(visuais.every(visual => !visual.active));
    scene.events.emit("shutdown");
  }
  const { scene, tecla } = fixture();
  scene.movimentoBloqueado = false;
  tecla(73);
  tecla(73);
  assert.equal(scene.movimentoBloqueado, false);
});

test("desativar DEV impede a concessão imediatamente e fecha o menu", () => {
  const { scene, tecla, clicar } = fixture();
  tecla(73);
  scene.developerMode = false;
  clicar("dev-item:card:1");
  assert.equal(scene.inventory.getQuantity("card"), 0);
  assert.equal(scene.devItemMenuOpen, false);
});

test("o menu acompanha zoom e resize e fecha durante morte sem liberar movimento", () => {
  const { scene, tecla, visuais } = fixture();
  tecla(73);
  Object.assign(scene.cameras.main, { zoomX: 2, zoomY: 1.5, width: 640, height: 360 });
  scene.events.emit("prerender");
  const modal = visuais.find(visual => visual.active && visual.tipo === "container");
  assert.equal(modal.scaleX, 0.5);
  assert.equal(modal.scaleY, 1 / 1.5);
  assert.equal(modal.x, 320);
  assert.equal(modal.y, 180);
  scene.morteEmAndamento = true;
  scene.events.emit("prerender");
  assert.equal(scene.devItemMenuOpen, false);
  assert.equal(scene.movimentoBloqueado, true);
});

test("encerrar e recriar os controles não deixa teclas ou objetos duplicados", () => {
  const { scene, tecla, teclas, visuais } = fixture();
  tecla(73);
  scene.events.emit("shutdown");
  assert.equal(teclas.get(73).listenerCount("down"), 0);
  assert.equal(teclas.get(27).listenerCount("down"), 0);
  assert.equal(scene.events.listenerCount("prerender"), 0);
  assert.ok(visuais.every(visual => !visual.active));
  criarMenuColetaveisDev(scene);
  assert.equal(teclas.get(73).listenerCount("down"), 1);
  tecla(73);
  assert.equal(scene.devItemMenuOpen, true);
  scene.events.emit("shutdown");
});

test("novos itens registrados também aparecem no catálogo com paginação", () => {
  const item = registerInventoryItem({ id: "dev-menu-test-item", name: "Item de teste", image: "test-icon" });
  const { scene, tecla, clicar, botao } = fixture();
  tecla(73);
  assert.equal(botao(`dev-item:${item.id}:1`), undefined);
  clicar("dev-items-next");
  clicar(`dev-item:${item.id}:1`);
  assert.equal(scene.inventory.getQuantity(item.id), 1);
  clicar("dev-items-prev");
  assert.ok(botao("dev-item:card:1"));
  scene.events.emit("shutdown");
});
