/**
 * @file Testes integrados de porta, gerador e coleta usando o mapa real com substitutos leves
 * do Phaser. Os métodos simulados abaixo não desenham nem executam física real.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { FACTORY_DOOR_STATE_KEY, chaveEstadoPorta, criarInteracaoPortaFabrica } from "./FactoryDoor.js";
import { criarSistemaInventario } from "../inventory/ItemPickup.js";
import { criarInteracaoGeradorFabrica, findGeneratorInteraction } from "./FactoryGenerator.js";
import DoorLightingZones from "../effects/DoorLightingZones.js";
import { lerLuzesFabrica } from "../effects/FactoryLighting.js";

globalThis.Phaser = {
  Scenes: { Events: { PRE_RENDER: "prerender", SHUTDOWN: "shutdown" } },
  Input: { Keyboard: {
    KeyCodes: { E: 69, ESC: 27 },
    JustDown(key) {
      const pressed = key.pressed;
      key.pressed = false;
      return pressed;
    },
  } },
  Math: {
    Distance: { Between: (x, y, a, b) => Math.hypot(x - a, y - b) },
    Vector2: class {
      /**
       * Inicializa o vetor simulado usado para consultar a posição do jogador nos testes.
       */
      constructor(x = 0, y = 0) { this.x = x; this.y = y; }
      /**
       * Copia as coordenadas para o vetor simulado sem depender da implementação real do
       * Phaser.
       */
      copy(other) { this.x = other.x; this.y = other.y; return this; }
    },
  },
};

class DisplayObject extends EventEmitter {
  /**
   * Inicializa o objeto visual simulado e seu emissor de eventos.
   */
  constructor(x, y) { super(); this.x = x; this.y = y; this.visible = true; }
  /**
   * Mantém a interface encadeável de origem; o teste não calcula transformações de desenho.
   */
  setOrigin() { return this; }
  /**
   * Simula a chamada de fixação da interface sem executar uma câmera real.
   */
  setScrollFactor() { return this; }
  /**
   * Mantém o encadeamento de escala sem alterar o tamanho físico simulado.
   */
  setScale() { return this; }
  /**
   * Simula a configuração de transparência usada pelos componentes visuais.
   */
  setAlpha() { return this; }
  /**
   * Simula o contorno de elementos sem desenhá-los.
   */
  setStrokeStyle() { return this; }
  /**
   * Aceita atualizações de texto do modal sem renderização de fontes.
   */
  setText(text) { this.text = text; this.width = text.length * 7 + 12; this.height = 24; return this; }
  setFixedSize(width, height) {
    this.width = width || (this.text ?? "").length * 7 + 12;
    this.height = height || 24;
    return this;
  }
  /**
   * Aceita mudanças de cor do texto no substituto usado pelo teste.
   */
  setColor() { return this; }
  setName(name) { this.name = name; return this; }
  setFontStyle() { return this; }
  setFillStyle() { return this; }
  setData() { return this; }
  setTexture() { return this; }
  clear() { return this; }
  lineStyle() { return this; }
  beginPath() { return this; }
  arc() { return this; }
  moveTo() { return this; }
  lineTo() { return this; }
  strokePath() { return this; }
  fillTriangle() { return this; }
  fillRoundedRect() { return this; }
  strokeRoundedRect() { return this; }
  strokeRect() { return this; }
  lineBetween() { return this; }
  fillStyle() { return this; }
  fillRect() { return this; }
  /**
   * Mantém a interface de redimensionamento necessária aos elementos do modal.
   */
  setSize() { return this; }
  /**
   * Simula a remoção dos filhos de um container sem criar objetos de renderização.
   */
  removeAll() { return this; }
  /**
   * Aceita a inclusão de elementos no container simulado.
   */
  add() { return this; }
  /**
   * Simula a ativação da entrada; os testes disparam os eventos diretamente.
   */
  setInteractive() { return this; }
  /**
   * Simula a desativação da área interativa sem usar o sistema de entrada real.
   */
  disableInteractive() { return this; }
  /**
   * Recria as dimensões do corpo simulado após mudar o tamanho da colisão.
   */
  refreshBody() { this.body = { width: this.width, height: this.height }; return this; }
  /**
   * Guarda largura e altura para verificar as dimensões da porta sem física real.
   */
  setDisplaySize(w, h) { this.width = w; this.height = h; return this; }
  /**
   * Guarda a visibilidade para que o teste confira quando avisos e sprites aparecem.
   */
  setVisible(value) { this.visible = value; return this; }
  /**
   * Guarda a profundidade atribuída para permitir verificações de sobreposição.
   */
  setDepth(value) { this.depth = value; return this; }
  /**
   * Atualiza o Y simulado durante a animação de abertura da porta.
   */
  setY(value) { this.y = value; return this; }
  /**
   * Guarda as coordenadas usadas no posicionamento dos objetos simulados.
   */
  setPosition(x, y) { this.x = x; this.y = y; return this; }
  /**
   * Guarda o recorte aplicado para verificar que a folha da porta sobe sem mover a moldura.
   */
  setCrop(...rect) { this.crop = rect; return this; }
  /**
   * Marca o objeto simulado como destruído e emite o evento usado pela limpeza do grupo.
   */
  destroy() { this.destroyed = true; this.emit("destroy"); }
}

/**
 * Monta uma cena simulada com tiles reais da porta e inicializa inventário, gerador e
 * interação da porta.
 */
function createScene(registry = new Map(), alterarMapa = () => {}) {
  const raw = JSON.parse(readFileSync(new URL("../../assets/map/parte2-fase1.json", import.meta.url)));
  alterarMapa(raw);
  const doorLayer = raw.layers.find((layer) => layer.name === "Portas");
  const atlas = raw.tilesets.find((tileset) => tileset.name === "A5_SciFi_Industrial_Rasak");
  const texture = { key: "industrialA5", has: () => false,
    add(...args) { this.frame = args; } };
  const tileset = { image: texture, getTileTextureCoordinates(gid) {
    const index = gid - atlas.firstgid;
    return { x: index % atlas.columns * 48, y: Math.floor(index / atlas.columns) * 48 };
  } };
  const tiles = [];
  for (const chunk of doorLayer.chunks) {
    const data = Buffer.from(chunk.data, "base64");
    for (let i = 0; i < chunk.width * chunk.height; i++) {
      const x = (chunk.x + i % chunk.width) * 48;
      const y = (chunk.y + Math.floor(i / chunk.width)) * 48;
      if (data.readUInt32LE(i * 4)) {
        tiles.push({ x, y, index: data.readUInt32LE(i * 4), tileset, alpha: 1 });
      }
    }
  }
  const layer = { depth: 13, getTilesWithinWorldXY: (x, y, width, height) =>
    tiles.filter(tile => tile.x >= x && tile.x < x + width && tile.y >= y && tile.y < y + height),
    getTileAtWorldXY: (x, y) => tiles.find((tile) => tile.x === x && tile.y === y) };
  const bodies = new Set();
  const scene = {
    events: new EventEmitter(), game: { registry, events: new EventEmitter(), domContainer: { style: { display: "block" } } },
    scene: { key: "Level1Parte2" },
    player: {
      active: true, x: -1076, y: -1445,
      getCenter(out) { return out.copy(this); },
      setVelocity() {},
    },
    map: { objects: raw.layers, getLayer: () => ({ tilemapLayer: layer }),
      getObjectLayer: (name) => raw.layers.find((item) => item.name === name) },
    texts: [],
    add: Object.fromEntries(["image", "text", "container", "rectangle", "graphics"].map((type) =>
      [type, (x, y, text, style) => {
        const visual = new DisplayObject(x, y);
        if (type === "text") { visual.setText(text); visual.style = style; scene.texts.push(visual); }
        return visual;
      }])),
    textures: { exists: () => true, getFrame: () => ({ cutWidth: 16, cutHeight: 16 }) },
    cameras: { main: { x: 0, y: 0, width: 800, height: 450, zoom: 1, originX: 0.5, originY: 0.5 } },
    input: Object.assign(new EventEmitter(), {
      keyboard: { addKey: () => Object.assign(new DisplayObject(), { pressed: false }) },
    }),
    time: { now: 0, delayedCall(delay, callback) {
      scene.finishActivation = callback;
      return { remove() {} };
    } },
    acenderLuzFabrica() { this.luzFabricaAcesa = true; },
    collisionGroup: { create(x, y) {
      const body = new DisplayObject(x, y);
      bodies.add(body);
      body.on("destroy", () => bodies.delete(body));
      return body;
    } },
    animations: [],
    tweens: { add(config) { scene.animation = config; scene.animations.push(config); return { stop() { config.stopped = true; } }; },
      killTweensOf() {} },
  };
  criarSistemaInventario(scene);
  criarInteracaoGeradorFabrica(scene);
  criarInteracaoPortaFabrica(scene);
  scene.revelarFalas = () => { scene.time.now += 10000; scene.events.emit("prerender"); };
  return { scene, bodies, tiles: layer.getTilesWithinWorldXY(-1152, -1584, 144, 96), texture, layer };
}

test("the requested door blocks passage until its opening animation finishes", () => {
  const { scene, bodies, tiles, texture } = createScene();
  scene.acenderLuzFabrica();
  assert.equal(tiles.length, 6);
  assert.deepEqual(texture.frame.slice(2), [240, 288, 144, 96]);
  assert.equal(scene.portaFabrica.estado, "fechada");
  assert.deepEqual(scene.portaFabrica.colisao.body, { width: 144, height: 96 });
  assert.equal(bodies.size, 5);

  scene.atualizarColetaItens();
  assert.equal(scene.botaoColetarItem.visible, true);
  scene.botaoColetarItem.emit("pointerdown");
  assert.equal(scene.portaFabrica.estado, "abrindo");
  assert.equal(bodies.size, 5);
  assert.equal(scene.botaoColetarItem.visible, false);
  scene.portaFabrica.progresso = 0.5;
  scene.animation.onUpdate();
  assert.equal(scene.portaFabrica.visual.y, -1632);
  assert.deepEqual(scene.portaFabrica.visual.crop, [0, 48, 144, 48]);
  scene.portaFabrica.progresso = 1;
  scene.animation.onUpdate();
  scene.animation.onComplete();
  assert.equal(scene.portaFabrica.estado, "aberta");
  assert.equal(scene.portaFabrica.visual.visible, false);
  assert.equal(bodies.size, 4);
  assert.equal(scene.game.registry.get(FACTORY_DOOR_STATE_KEY), true);
  scene.events.emit("shutdown");
  assert.ok(tiles.every((tile) => tile.alpha === 1));
});

test("E opens the door, while out-of-range interaction and generator menus cannot", () => {
  const { scene } = createScene();
  scene.acenderLuzFabrica();
  const interact = scene.interacaoMundoProxima.interact;
  scene.player.y = -1200;
  assert.equal(interact(), false);
  scene.player.y = -1445;
  scene.generatorMenuOpen = true;
  assert.equal(interact(), false);
  scene.generatorMenuOpen = false;
  scene.teclaColetarItem.pressed = true;
  scene.atualizarColetaItens();
  assert.equal(scene.portaFabrica.estado, "abrindo");
  assert.equal(interact(), false);
  scene.events.emit("shutdown");
});

function registrarSonsPortas(scene) {
  const reproducoes = [], sons = [];
  scene.cache = { audio: { exists: () => true } };
  scene.sound = { add(chave) {
    const som = {
      totalDuration: 6.7, addMarker() {},
      play(nome, config) { reproducoes.push({ chave, config: typeof nome === "object" ? nome : config }); this.tocando = true; return true; },
      stop() { this.tocando = false; }, destroy() { this.destruido = true; },
    };
    sons.push(som);
    return som;
  } };
  return { reproducoes, sons, portas: () => reproducoes.filter(som => som.chave === "porta-fabrica") };
}

test("cada porta individual toca uma vez ao abrir, nunca ao negar acesso ou restaurar estado", () => {
  for (const nome of ["porta01", "porta04", "porta05"]) {
    const { scene } = createScene();
    const audio = registrarSonsPortas(scene);
    const porta = scene.portasFabrica.find(porta => porta.nome === nome);
    scene.player.x = porta.area.x + porta.area.width / 2;
    scene.player.y = porta.area.y + porta.area.height / 2;
    scene.atualizarInteracaoPortaFabrica();
    const abrir = scene.interacaoMundoProxima.interact;
    if (nome !== "porta05") {
      assert.equal(abrir(), false);
      assert.equal(audio.portas().length, 0);
    }
    scene.luzFabricaAcesa = true;
    assert.equal(abrir(), true);
    assert.equal(audio.portas().length, 1);
    assert.equal(abrir(), false);
    assert.equal(audio.portas().length, 1);
    scene.events.emit("shutdown");
    assert.ok(audio.sons.every(som => som.destruido && !som.tocando));
    const retorno = createScene(scene.game.registry);
    const audioRetorno = registrarSonsPortas(retorno.scene);
    retorno.scene.atualizarInteracaoPortaFabrica();
    assert.equal(audioRetorno.portas().length, 0);
    retorno.scene.events.emit("shutdown");
  }
});

test("as duas persianas do leitor tocam só após a confirmação e param se o boss interromper", () => {
  const { scene } = createScene();
  const audio = registrarSonsPortas(scene);
  liberarAcesso(scene); aproximarLeitor(scene); abrirComE(scene);
  animarCartao(scene);
  assert.equal(audio.portas().length, 0);
  scene.finishActivation();
  assert.equal(audio.portas().length, 2);
  for (const porta of scene.portasFabrica.filter(porta => ["porta02", "porta03"].includes(porta.nome))) {
    porta.fecharParaBoss();
  }
  assert.ok(audio.sons.every(som => !som.tocando));
  scene.events.emit("shutdown");
});

test("atualizações de rede não repetem o som em cada pacote da abertura", () => {
  const { scene } = createScene();
  const audio = registrarSonsPortas(scene);
  scene.portaFabrica.aplicarEstadoRede({ estado: "abrindo", progresso: 0.3 });
  scene.portaFabrica.aplicarEstadoRede({ estado: "abrindo", progresso: 0.5 });
  assert.equal(audio.portas().length, 1);
  assert.equal(audio.portas()[0].config.seek, (650 + 0.3 * 5050) / 1000);
  scene.portaFabrica.aplicarEstadoRede({ estado: "fechando", progresso: 0.5 });
  assert.ok(audio.sons.every(som => !som.tocando));
  scene.events.emit("shutdown");
});

test("o tween real do Phaser acompanha o mecanismo e libera a colisão no impacto acelerado de 2,5 s", async () => {
  const { default: vm } = await import("node:vm");
  const bundle = readFileSync(new URL("../libs/phaser.min.js", import.meta.url), "utf8");
  const contexto = { module: { exports: {} }, exports: {}, importScripts() {}, window: {}, navigator: {} };
  vm.runInNewContext(bundle.replace("i(85454)})());", "i})());"), contexto);
  const TweenManager = contexto.module.exports(40382);
  const manager = new TweenManager({ sys: { events: new EventEmitter() } });
  const { scene } = createScene();
  const audio = registrarSonsPortas(scene);
  scene.acenderLuzFabrica();
  scene.interacaoMundoProxima.interact();
  const config = scene.animations.at(-1);
  const tween = manager.add(config);
  const porta = scene.portaFabrica;
  tween.update(0);
  let terminouEm = null;
  for (let tempo = 1; tempo <= 5800; tempo++) {
    tween.update(1);
    if (tempo === Math.floor(600 / 2.28)) assert.equal(porta.progresso, 0, "aguarda o mecanismo começar");
    if (tempo === Math.round(3200 / 2.28)) {
      assert.ok(porta.progresso > 0.49 && porta.progresso < 0.52);
      assert.ok(porta.colisao, "o movimento ainda mantém a passagem bloqueada");
    }
    if (porta.estado === "aberta") { terminouEm = tempo; break; }
  }
  assert.ok(terminouEm >= 2500 && terminouEm <= 2502, `fim em ${terminouEm} ms`);
  assert.equal(porta.colisao, null);
  assert.equal(audio.portas().length, 1);
  assert.equal(audio.portas()[0].config.seek, 0);
  assert.equal(audio.portas()[0].config.rate, 2.28);
  assert.ok(audio.sons[0].tocando, "a cauda do áudio continua sem corte após o impacto");
  scene.events.emit("shutdown");
  manager.destroy();
});

test("as duas portas próximas ao atalho O usam seis tiles e preservam a coluna de parede", () => {
  const { scene, layer } = createScene();
  assert.deepEqual(scene.portasFabrica.map(porta => porta.nome), ["porta01", "porta02", "porta03", "porta04", "porta05"]);
  const novas = scene.portasFabrica.filter(porta => ["porta02", "porta03"].includes(porta.nome));
  assert.deepEqual(novas.map(({ area }) => [area.x, area.y, area.width, area.height]), [
    [-1248, -5328, 144, 96], [-1056, -5328, 144, 96],
  ]);
  for (const { area, colisao } of novas) {
    assert.deepEqual(layer.getTilesWithinWorldXY(area.x, area.y, area.width, area.height)
      .map(tile => tile.index), [678, 679, 680, 686, 687, 688]);
    assert.deepEqual(colisao.body, { width: 144, height: 96 });
  }
  assert.equal(novas[1].area.x - (novas[0].area.x + novas[0].area.width), 48);
  const parede = scene.map.getObjectLayer("ParedePortaBoss");
  assert.equal(parede.objects.length, 2);
  const colisoesNaParede = scene.map.getObjectLayer("collision").objects.filter(object =>
    object.x < -1056 && object.x + object.width > -1104 &&
    object.y < -5232 && object.y + object.height > -5328);
  assert.deepEqual(colisoesNaParede.map(({ x, y, width, height }) => [x, y, width, height]),
    [[-1104.5, -5240.75, 47.25, 8]], "preserva a colisão desenhada no Tiled, sem acrescentar outra à parede inteira");
  scene.events.emit("shutdown");
});

function aproximarPorta(scene, porta) {
  scene.player.x = porta.area.x + porta.area.width / 2;
  scene.player.y = porta.area.y + porta.area.height + 30;
  scene.atualizarInteracaoPortaFabrica();
}

function aproximarLeitor(scene) {
  const area = scene.leitorCartaoFabrica.area;
  scene.player.x = area.x + area.width / 2;
  scene.player.y = area.y + area.height + 30;
  scene.atualizarInteracaoPortaFabrica();
}

function abrirComE(scene) {
  scene.teclaColetarItem.pressed = true;
  scene.atualizarColetaItens();
  return scene.animation;
}

function liberarAcesso(scene) {
  scene.luzFabricaAcesa = true;
  scene.inventory.addItem("card", 1);
}

function animarCartao(scene) {
  for (let etapa = 0; etapa < 2; etapa++) {
    const tween = scene.animations.at(-1);
    assert.equal(tween.targets.name, "card-reader-animation");
    tween.targets.setPosition(tween.x, tween.y);
    tween.onUpdate?.();
    tween.onComplete();
  }
}

function lerCartao(scene) {
  assert.equal(scene.leitorCartaoFabrica.terminal.aberto, true);
  animarCartao(scene);
  scene.finishActivation();
}

test("porta05 abre por E ou toque sem animação e revela seus dois retângulos LuzApagada", () => {
  for (const entrada of ["teclado", "toque"]) {
    const { scene, layer, bodies } = createScene();
    const porta = scene.portasFabrica.find(porta => porta.nome === "porta05");
    assert.deepEqual([porta.area.x, porta.area.y, porta.area.width, porta.area.height], [-480, -5904, 48, 144]);
    assert.deepEqual(porta.colisao.body, { width: 48, height: 144 });
    assert.equal(porta.visual, null, "os tiles preservam as inversões desenhadas no Tiled");
    const tiles = layer.getTilesWithinWorldXY(-480, -5904, 48, 144);
    assert.equal(tiles.length, 3);
    assert.ok(tiles.every(tile => tile.alpha === 1));
    const zonas = new DoorLightingZones(scene.map, lerLuzesFabrica(scene.map));
    zonas.atualizar(0, scene.portasFabrica, false);
    const sala = zonas.zonas.filter(zona => zona.porta === porta);
    assert.deepEqual(sala.map(zona => zona.id), [1310, 1311]);
    assert.ok(sala.every(zona => zona.opacidade === 1));
    aproximarPorta(scene, porta);
    assert.equal(scene.interacaoMundoProxima.distance, 30);
    const animacoes = scene.animations.length;
    if (entrada === "teclado") abrirComE(scene);
    else {
      scene.atualizarColetaItens();
      assert.equal(scene.botaoColetarItem.visible, true);
      scene.botaoColetarItem.emit("pointerdown");
    }
    assert.equal(porta.estado, "aberta");
    assert.equal(porta.progresso, 1);
    assert.equal(porta.colisao, null);
    assert.equal(bodies.size, 4);
    assert.equal(scene.animations.length, animacoes, "a porta não cria tween");
    assert.ok(tiles.every(tile => tile.alpha === 0));
    assert.equal(scene.game.registry.get(chaveEstadoPorta("porta05")), true);
    zonas.atualizar(100, scene.portasFabrica, false);
    zonas.atualizar(250, scene.portasFabrica, false);
    assert.ok(sala.every(zona => zona.opacidade === 0));
    assert.ok(zonas.zonas.filter(zona => zona.porta !== porta).every(zona => zona.opacidade === 1));
    scene.acenderLuzFabrica();
    zonas.atualizar(300, scene.portasFabrica, true);
    const lampadasSala = sala.flatMap(zona => [...zona.indices.keys()]);
    assert.equal(lampadasSala.length, 16);
    assert.ok(lampadasSala.every(luz => zonas.fatorLuz(luz, 300) === 0));
    zonas.atualizar(1700, scene.portasFabrica, true);
    assert.ok(lampadasSala.every(luz => luz.ligada && zonas.fatorLuz(luz, 1700) === 1),
      "as novas lâmpadas da sala ligam mesmo com a camada LuzApagada oculta");
    const registry = scene.game.registry;
    zonas.destroy();
    scene.events.emit("shutdown");
    assert.ok(tiles.every(tile => tile.alpha === 1), "a limpeza restaura o mapa");
    assert.equal(bodies.size, 0);

    const { scene: retorno, layer: camadaRetorno } = createScene(registry);
    const restauradas = new DoorLightingZones(retorno.map, lerLuzesFabrica(retorno.map));
    restauradas.atualizar(0, retorno.portasFabrica, false);
    assert.equal(retorno.portasFabrica.find(porta => porta.nome === "porta05").colisao, null);
    assert.ok(camadaRetorno.getTilesWithinWorldXY(-480, -5904, 48, 144).every(tile => tile.alpha === 0));
    assert.ok(restauradas.zonas.filter(zona => zona.porta.nome === "porta05").every(zona => zona.opacidade === 0));
    restauradas.destroy();
    retorno.events.emit("shutdown");
  }
});

test("porta05 revalida alcance, morte e menus antes de abrir instantaneamente", () => {
  const { scene, layer } = createScene();
  const porta = scene.portasFabrica.find(porta => porta.nome === "porta05");
  aproximarPorta(scene, porta);
  const interagir = scene.interacaoMundoProxima.interact;
  for (const campo of ["morteEmAndamento", "generatorMenuOpen", "devItemMenuOpen"]) {
    scene[campo] = true;
    assert.equal(interagir(), false);
    scene[campo] = false;
  }
  scene.player.y += 100;
  assert.equal(interagir(), false);
  assert.equal(porta.estado, "fechada");
  assert.ok(layer.getTilesWithinWorldXY(-480, -5904, 48, 144).every(tile => tile.alpha === 1));
  scene.events.emit("shutdown");
});

test("abrir a porta04 libera as duas zonas pareadas e restaura a iluminação ao voltar ao mapa", () => {
  const { scene } = createScene();
  const registry = scene.game.registry;
  const lampadas = lerLuzesFabrica(scene.map);
  const zonas = new DoorLightingZones(scene.map, lampadas);
  zonas.atualizar(0, scene.portasFabrica, true);
  const zona04 = zonas.zonas.find(zona => zona.porta.nome === "porta04");
  const zona01 = zonas.zonas.find(zona => zona.porta.nome === "porta01");
  const luz = [...zona04.indices.keys()][0];
  scene.acenderLuzFabrica();
  aproximarPorta(scene, zona04.porta);
  const animation = abrirComE(scene);
  zonas.atualizar(400, scene.portasFabrica, true);
  assert.equal(zona04.opacidade, 1, "a sala permanece escura enquanto a persiana abre");
  assert.equal(zonas.fatorLuz(luz, 400), 0);
  zona04.porta.progresso = 1;
  animation.onUpdate();
  animation.onComplete();
  zonas.atualizar(850, scene.portasFabrica, true);
  assert.equal(zona04.inicioLampadas, 850);
  zonas.atualizar(1200, scene.portasFabrica, true);
  assert.equal(zona04.opacidade, 0);
  zonas.atualizar(3200, scene.portasFabrica, true);
  assert.equal(zonas.fatorLuz(luz, 3200), 1);
  assert.equal(zona01.opacidade, 0);
  assert.ok([...zona01.indices.keys()].every(luz => zonas.fatorLuz(luz, 3200) === 1));
  zonas.destroy();
  scene.events.emit("shutdown");

  const { scene: retorno } = createScene(registry);
  const restauradas = new DoorLightingZones(retorno.map, lerLuzesFabrica(retorno.map));
  restauradas.atualizar(0, retorno.portasFabrica, true);
  const aberta = restauradas.zonas.find(zona => zona.porta.nome === "porta04");
  const pareada = restauradas.zonas.find(zona => zona.porta.nome === "porta01");
  assert.equal(aberta.opacidade, 0);
  assert.ok([...aberta.indices.keys()].every(luz => restauradas.fatorLuz(luz, 0) === 1));
  assert.equal(pareada.opacidade, 0);
  assert.ok([...pareada.indices.keys()].every(luz => restauradas.fatorLuz(luz, 0) === 1));
  restauradas.destroy();
  retorno.events.emit("shutdown");
});

test("a porta perto de X322/Y-1887 exige somente energia e usa a mesma animação das persianas", () => {
  const { scene, bodies, layer } = createScene();
  const porta = scene.portasFabrica.find(porta => porta.nome === "porta04");
  assert.ok(porta);
  assert.deepEqual([porta.area.x, porta.area.y, porta.area.width, porta.area.height], [240, -1920, 144, 96]);
  const tiles = layer.getTilesWithinWorldXY(240, -1920, 144, 96);
  assert.deepEqual(tiles.map(tile => tile.index), [678, 679, 680, 686, 687, 688]);
  aproximarPorta(scene, porta);
  const aviso = porta.marcador;
  assert.equal(aviso.visible, true);
  assert.equal(aviso.name, "door-marker-porta04");
  assert.equal(aviso.text, undefined);
  assert.equal(scene.texts.some(text => text.x === 312 && text.y === -1932), false);
  const quantidadeAnimacoes = scene.animations.length;
  abrirComE(scene);
  assert.equal(porta.estado, "fechada");
  assert.equal(scene.animations.length, quantidadeAnimacoes);
  scene.inventory.addItem("card", 1);
  abrirComE(scene);
  assert.equal(porta.estado, "fechada", "cartão não substitui energia");
  scene.inventory.removeItem("card", 1);
  scene.acenderLuzFabrica();
  scene.atualizarInteracaoPortaFabrica();
  assert.equal(aviso.visible, true);
  const animation = abrirComE(scene);
  assert.equal(porta.estado, "abrindo");
  assert.equal(aviso.visible, false);
  assert.equal(scene.inventory.getQuantity("card"), 0, "abre sem precisar do cartão ou leitor");
  assert.equal(animation.delay, 650 / 2.28);
  assert.equal(animation.duration, 5050 / 2.28);
  assert.equal(animation.ease, "Linear");
  assert.equal(bodies.size, 5);
  porta.progresso = 0.5;
  animation.onUpdate();
  assert.equal(porta.visual.y, -1968);
  assert.deepEqual(porta.visual.crop, [0, 48, 144, 48]);
  assert.equal(bodies.size, 5, "mantém a colisão durante toda a animação");
  porta.progresso = 1;
  animation.onUpdate();
  animation.onComplete();
  assert.equal(porta.estado, "aberta");
  assert.equal(porta.visual.visible, false);
  assert.equal(porta.colisao, null);
  assert.equal(bodies.size, 4);
  const registry = scene.game.registry;
  assert.equal(registry.get(chaveEstadoPorta("porta04")), true);
  assert.ok(scene.portasFabrica.filter(item => item !== porta).every(item => item.estado === "fechada"));
  scene.events.emit("shutdown");
  assert.ok(tiles.every(tile => tile.alpha === 1));
  const returned = createScene(registry);
  assert.equal(returned.scene.portasFabrica.find(item => item.nome === "porta04").estado, "aberta");
  assert.equal(returned.bodies.size, 4);
  returned.scene.events.emit("shutdown");
});

test("a porta de energia revalida alcance, menus e energia ao pressionar E ou tocar", () => {
  const { scene } = createScene();
  const porta = scene.portasFabrica.find(porta => porta.nome === "porta04");
  scene.luzFabricaAcesa = true;
  aproximarPorta(scene, porta);
  const interagir = scene.interacaoMundoProxima.interact;
  scene.player.x += 300;
  assert.equal(interagir(), false);
  aproximarPorta(scene, porta);
  for (const flag of ["morteEmAndamento", "generatorMenuOpen", "devItemMenuOpen"]) {
    scene[flag] = true;
    assert.equal(interagir(), false);
    scene[flag] = false;
  }
  scene.atualizarColetaItens();
  scene.luzFabricaAcesa = false;
  scene.botaoColetarItem.emit("pointerdown");
  assert.equal(porta.estado, "fechada");
  scene.luzFabricaAcesa = true;
  scene.botaoColetarItem.emit("pointerdown");
  assert.equal(porta.estado, "abrindo");
  assert.equal(interagir(), false, "não inicia duas animações para a mesma porta");
  scene.events.emit("shutdown");
});

test("as duas portas iniciais mostram as oito falas de energia por E e toque, mesmo sem leitor", () => {
  for (const nome of ["porta01", "porta04"]) {
    const { scene } = createScene(new Map(), raw => {
      raw.layers = raw.layers.filter(layer => layer.name !== "Leitordecartão");
    });
    const porta = scene.portasFabrica.find(porta => porta.nome === nome);
    const texto = scene.texts.find(text => text.name === "player-speech-bubble");
    assert.equal(porta.marcador.name, `door-marker-${nome}`);
    assert.equal(porta.marcador.visible, true);
    assert.equal(porta.marcador.text, undefined);
    for (const flag of ["morteEmAndamento", "generatorMenuOpen", "devItemMenuOpen"]) {
      scene[flag] = true;
      scene.atualizarInteracaoPortaFabrica();
      assert.equal(porta.marcador.visible, false);
      scene[flag] = false;
      scene.atualizarInteracaoPortaFabrica();
      assert.equal(porta.marcador.visible, true);
    }
    scene.luzFabricaAcesa = false;
    aproximarPorta(scene, porta);
    const frases = new Set();
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) abrirComE(scene);
      else {
        scene.atualizarColetaItens();
        scene.botaoColetarItem.emit("pointerdown");
      }
      scene.revelarFalas();
      assert.equal(texto.visible, true);
      assert.equal(porta.estado, "fechada");
      assert.ok(porta.colisao);
      assert.notEqual(scene.movimentoBloqueado, true);
      assert.notEqual(scene.generatorMenuOpen, true);
      if (i === 0) assert.equal(texto.text, "Preciso ligar a energia antes.");
      frases.add(texto.text);
      scene.finishActivation();
      assert.equal(texto.visible, false);
    }
    assert.equal(frases.size, 8);
    assert.ok([...frases].every(frase => !/cartão|leitor/.test(frase)));
    scene.acenderLuzFabrica();
    abrirComE(scene);
    assert.equal(porta.estado, "abrindo");
    assert.equal(porta.marcador.visible, false);
    assert.equal(scene.inventory.getQuantity("card"), 0);
    assert.equal(texto.visible, false);
    scene.events.emit("shutdown");
    assert.equal(texto.destroyed, true);
    assert.equal(porta.marcador.destroyed, true);
  }
});

test("o leitor exige cartão e energia juntos para abrir as duas portas, inclusive no modo dev", () => {
    for (const energia of [false, true]) {
      for (const cartao of [false, true]) {
        const { scene, bodies } = createScene();
        scene.developerMode = true;
        scene.luzFabricaAcesa = energia;
        if (cartao) scene.inventory.addItem("card", 1);
        const portas = scene.portasFabrica.filter(porta => ["porta02", "porta03"].includes(porta.nome));
        aproximarLeitor(scene);
        const prompt = scene.leitorCartaoFabrica.marcador;
        assert.equal(prompt.visible, true);
        assert.equal(prompt.name, "card-reader-marker");
        assert.equal(prompt.text, undefined, "o leitor usa só a exclamação, sem avisos escritos");
        const contarPortas = () => scene.animations.filter(animation => scene.portasFabrica.includes(animation.targets)).length;
        const antes = contarPortas();
        abrirComE(scene);
        assert.equal(scene.leitorCartaoFabrica.terminal.aberto, energia && cartao);
        assert.ok(portas.every(porta => porta.estado === "fechada"), "interagir apenas abre o terminal");
        if (energia && cartao) lerCartao(scene);
        assert.ok(portas.every(porta => porta.estado === (energia && cartao ? "abrindo" : "fechada")));
        assert.equal(contarPortas(), antes + (energia && cartao ? 2 : 0));
        assert.equal(bodies.size, 5, "a colisão permanece até a abertura terminar");
        for (const porta of portas) assert.notEqual(scene.game.registry.get(chaveEstadoPorta(porta.nome)), true);
        assert.equal(scene.inventory.getQuantity("card"), cartao ? 1 : 0);
        scene.events.emit("shutdown");
      }
    }
});

test("o leitor usa os limites do objeto do mapa e revalida alcance, morte e menus", () => {
  const { scene } = createScene();
  liberarAcesso(scene);
  const objeto = scene.map.getObjectLayer("Leitordecartão").objects[0];
  const leitor = scene.leitorCartaoFabrica;
  assert.deepEqual(leitor.area, { x: objeto.x, y: objeto.y - objeto.height,
    width: objeto.width, height: objeto.height });
  aproximarLeitor(scene);
  const interagir = scene.interacaoMundoProxima.interact;
  scene.player.x += 300;
  assert.equal(interagir(), false);
  aproximarLeitor(scene);
  for (const flag of ["morteEmAndamento", "generatorMenuOpen", "devItemMenuOpen"]) {
    scene[flag] = true;
    assert.equal(interagir(), false);
    scene[flag] = false;
  }
  assert.ok(scene.portasFabrica.every(porta => porta.estado === "fechada"));
  // O leitor está ao alcance, mas a porta direita fica a mais de 64 px do jogador.
  scene.player.x = leitor.area.x - 63;
  scene.player.y = leitor.area.y + leitor.area.height / 2;
  scene.atualizarInteracaoPortaFabrica();
  scene.atualizarColetaItens();
  scene.botaoColetarItem.emit("pointerdown");
  lerCartao(scene);
  assert.deepEqual(scene.portasFabrica.map(porta => porta.estado), ["fechada", "abrindo", "abrindo", "fechada", "fechada"]);
  scene.events.emit("shutdown");
});

test("sem o leitor as persianas continuam bloqueadas e não abrem diretamente por E", () => {
  const { scene, bodies } = createScene(new Map(), raw => {
    raw.layers = raw.layers.filter(layer => layer.name !== "Leitordecartão");
  });
  liberarAcesso(scene);
  assert.equal(scene.leitorCartaoFabrica, null);
  assert.equal(bodies.size, 5, "reconhece as portas no mapa mesmo sem áreas porta02/03");
  aproximarPorta(scene, scene.portasFabrica.find(porta => porta.nome === "porta02"));
  assert.equal(scene.interacaoMundoProxima, null);
  abrirComE(scene);
  assert.ok(scene.portasFabrica.every(porta => porta.estado === "fechada"));
  scene.events.emit("shutdown");
});

test("o leitor abre apenas a porta restante quando a outra já está salva como aberta", () => {
  const { scene, bodies } = createScene(new Map([[chaveEstadoPorta("porta02"), true]]));
  liberarAcesso(scene);
  aproximarLeitor(scene);
  abrirComE(scene);
  lerCartao(scene);
  assert.deepEqual(scene.portasFabrica.map(porta => porta.estado), ["fechada", "aberta", "abrindo", "fechada", "fechada"]);
  assert.equal(bodies.size, 4);
  assert.equal(scene.inventory.getQuantity("card"), 1);
  scene.events.emit("shutdown");
});

test("o cartão real coletado no mapa libera o acesso após ligar a energia", () => {
  const { scene } = createScene();
  const cartao = scene.itensColetaveis.find(item => item.itemId === "card");
  assert.ok(cartao);
  scene.player.x = cartao.x;
  scene.player.y = cartao.y;
  scene.atualizarInteracaoPortaFabrica();
  abrirComE(scene);
  assert.equal(scene.inventory.getQuantity("card"), 1);
  assert.ok(!scene.itensColetaveis.includes(cartao));
  const porta = scene.portasFabrica.find(porta => porta.nome === "porta02");
  aproximarLeitor(scene);
  abrirComE(scene);
  assert.equal(porta.estado, "fechada", "só o cartão não fornece energia à porta");
  scene.acenderLuzFabrica();
  scene.atualizarInteracaoPortaFabrica();
  abrirComE(scene);
  lerCartao(scene);
  assert.equal(porta.estado, "abrindo");
  assert.equal(scene.portasFabrica.find(porta => porta.nome === "porta03").estado, "abrindo");
  assert.equal(scene.inventory.getQuantity("card"), 1);
  scene.events.emit("shutdown");
});

test("E e o botão de interação revalidam cartão e energia no instante de abrir", () => {
  const { scene } = createScene();
  liberarAcesso(scene);
  const porta = scene.portasFabrica.find(porta => porta.nome === "porta03");
  aproximarLeitor(scene);
  scene.atualizarColetaItens();
  scene.inventory.removeItem("card", 1);
  scene.botaoColetarItem.emit("pointerdown");
  assert.equal(porta.estado, "fechada");
  scene.inventory.addItem("card", 1);
  scene.luzFabricaAcesa = false;
  abrirComE(scene);
  assert.equal(porta.estado, "fechada");
  scene.luzFabricaAcesa = true;
  scene.atualizarColetaItens();
  scene.botaoColetarItem.emit("pointerdown");
  lerCartao(scene);
  assert.equal(porta.estado, "abrindo");
  scene.events.emit("shutdown");
});

test("passar o cartão abre as duas portas com movimento sincronizado ao áudio e colisão até o fim", () => {
  const { scene, bodies } = createScene();
  liberarAcesso(scene);
  const [original, esquerda, direita] = scene.portasFabrica;
  aproximarLeitor(scene);
  abrirComE(scene);
  assert.equal(esquerda.estado, "fechada");
  assert.equal(scene.movimentoBloqueado, true);
  lerCartao(scene);
  assert.equal(scene.cardReaderMenuOpen, false);
  assert.equal(scene.movimentoBloqueado, false);
  const esquerdaTween = scene.animations.find(animation => animation.targets === esquerda);
  const direitaTween = scene.animations.find(animation => animation.targets === direita);
  assert.equal(esquerda.estado, "abrindo");
  assert.equal(direita.estado, "abrindo");
  assert.equal(original.estado, "fechada");
  assert.equal(esquerdaTween.delay, 650 / 2.28);
  assert.equal(esquerdaTween.duration, 5050 / 2.28);
  assert.equal(esquerdaTween.ease, "Linear");
  esquerda.progresso = 0.5;
  esquerdaTween.onUpdate();
  assert.equal(esquerda.visual.y, -5376);
  assert.deepEqual(esquerda.visual.crop, [0, 48, 144, 48]);
  assert.equal(bodies.size, 5);

  assert.notEqual(direitaTween.targets, esquerdaTween.targets);
  for (const [porta, animation] of [[esquerda, esquerdaTween], [direita, direitaTween]]) {
    porta.progresso = 1;
    animation.onUpdate();
    animation.onComplete();
    assert.equal(porta.estado, "aberta");
    assert.equal(porta.visual.visible, false);
    assert.equal(porta.colisao, null);
  }
  assert.equal(bodies.size, 3, "a porta original segue bloqueando passagem");
  assert.equal(scene.game.registry.get(chaveEstadoPorta("porta02")), true);
  assert.equal(scene.game.registry.get(chaveEstadoPorta("porta03")), true);
  assert.notEqual(scene.game.registry.get(FACTORY_DOOR_STATE_KEY), true);
  assert.equal(scene.inventory.getQuantity("card"), 1, "o mesmo crachá abre as duas portas sem ser consumido");
  scene.events.emit("shutdown");
});

test("o leitor usa uma exclamação e só exibe falas sobre o cartão, mesmo sem energia", () => {
  const { scene } = createScene();
  scene.luzFabricaAcesa = false;
  aproximarLeitor(scene);
  const { marcador, fala } = scene.leitorCartaoFabrica;
  assert.equal(marcador.name, "card-reader-marker");
  assert.equal(marcador.visible, true);
  assert.equal(marcador.text, undefined);
  assert.equal(scene.texts.some(text => text.text === "E - PASSAR CARTÃO"), false);
  scene.player.getTopCenter = () => ({ x: scene.player.x, y: scene.player.y - 100 });
  scene.hitboxDanoPlayer = { y: scene.player.y - 20 };
  abrirComE(scene);
  scene.revelarFalas();
  assert.equal(fala.texto.visible, true);
  assert.equal(fala.texto.text, "Preciso encontrar o cartão de acesso.");
  assert.equal(fala.texto.style.color, "#102b3b");
  assert.equal(fala.texto.style.backgroundColor, undefined, "o fundo arredondado é desenhado separadamente");
  assert.equal(fala.texto.y, scene.hitboxDanoPlayer.y + 10, "o balão fica ao lado da cabeça, sem considerar a margem vazia");
  assert.notEqual(scene.movimentoBloqueado, true);
  assert.notEqual(scene.generatorMenuOpen, true);
  scene.player.x += 10;
  scene.player.y -= 10;
  scene.hitboxDanoPlayer.y -= 10;
  scene.atualizarInteracaoPortaFabrica();
  assert.equal(fala.texto.x, scene.player.x + 16);
  assert.ok(fala.texto.y < scene.player.y);
  const frases = new Set([fala.texto.text]);
  for (let i = 0; i < 7; i++) {
    scene.finishActivation();
    assert.equal(fala.texto.visible, false);
    abrirComE(scene);
    scene.revelarFalas();
    frases.add(fala.texto.text);
  }
  assert.equal(frases.size, 8);
  assert.ok([...frases].every(frase => /cartão/.test(frase) && !/energia|gerador|ligar/.test(frase)));
  assert.ok(scene.portasFabrica.every(porta => porta.estado === "fechada"));
  scene.events.emit("shutdown");
  assert.equal(fala.texto.destroyed, true);
  assert.equal(marcador.destroyed, true);
});

test("com energia mas sem cartão, a fala explica o requisito e some ao iniciar a leitura", () => {
  const { scene } = createScene();
  scene.luzFabricaAcesa = true;
  aproximarLeitor(scene); abrirComE(scene);
  scene.revelarFalas();
  const { fala, marcador } = scene.leitorCartaoFabrica;
  assert.equal(fala.texto.text, "Preciso encontrar o cartão de acesso.");
  const frases = new Set([fala.texto.text]);
  for (let i = 0; i < 7; i++) {
    scene.finishActivation();
    abrirComE(scene);
    scene.revelarFalas();
    frases.add(fala.texto.text);
  }
  assert.equal(frases.size, 8);
  scene.inventory.addItem("card", 1);
  scene.atualizarColetaItens();
  abrirComE(scene);
  scene.atualizarInteracaoPortaFabrica();
  assert.equal(fala.texto.visible, false);
  assert.equal(marcador.visible, false);
  lerCartao(scene);
  scene.events.emit("shutdown");
});

test("o acesso pelo leitor mantém as duas portas abertas ao voltar ao mapa", () => {
  const { scene } = createScene();
  liberarAcesso(scene);
  aproximarLeitor(scene);
  abrirComE(scene);
  lerCartao(scene);
  for (const porta of scene.portasFabrica.filter(porta => ["porta02", "porta03"].includes(porta.nome))) {
    const animation = scene.animations.find(animation => animation.targets === porta);
    porta.progresso = 1;
    animation.onUpdate();
    animation.onComplete();
  }
  const registry = scene.game.registry;
  scene.events.emit("shutdown");
  const returned = createScene(registry);
  assert.deepEqual(returned.scene.portasFabrica.map(porta => porta.estado), ["fechada", "aberta", "aberta", "fechada", "fechada"]);
  assert.equal(returned.bodies.size, 3);
  aproximarLeitor(returned.scene);
  assert.equal(returned.scene.leitorCartaoFabrica.marcador.visible, false);
  assert.equal(returned.scene.interacaoMundoProxima, null);
  returned.scene.events.emit("shutdown");
});

test("o cartão passa sozinho ao abrir o terminal e libera as portas após a confirmação", () => {
  const { scene } = createScene();
  liberarAcesso(scene); aproximarLeitor(scene); abrirComE(scene);
  const status = scene.texts.find(text => text.name === "card-reader-status");
  assert.equal(status.text, "POSICIONANDO CARTÃO...");
  assert.equal(scene.finishActivation, undefined);
  assert.ok(scene.portasFabrica.every(porta => porta.estado === "fechada"));
  animarCartao(scene);
  assert.ok(status.text.includes("ACESSO AUTORIZADO"));
  assert.ok(scene.portasFabrica.every(porta => porta.estado === "fechada"), "a confirmação aparece antes da abertura");
  scene.finishActivation();
  assert.equal(scene.portasFabrica.find(porta => porta.nome === "porta02").estado, "abrindo");
  assert.equal(scene.inventory.getQuantity("card"), 1);
  scene.events.emit("shutdown");
});

test("sons do cartão acompanham a passagem e a confirmação em sua velocidade natural", () => {
  const { scene } = createScene();
  const reproducoes = [], sons = [];
  scene.cache = { audio: { exists: () => true } };
  scene.sound = { add(chave) {
    const som = {
      totalDuration: chave === "cartao-passando" ? 1.584 : 2.064,
      addMarker() {},
      play(nome, config) { reproducoes.push({ chave, config: typeof nome === "object" ? nome : config }); this.tocando = true; return true; },
      stop() { this.tocando = false; },
      destroy() { this.destruido = true; },
    };
    sons.push(som);
    return som;
  } };
  let espera;
  const delayedCall = scene.time.delayedCall;
  scene.time.delayedCall = (delay, callback) => { espera = delay; return delayedCall(delay, callback); };
  liberarAcesso(scene); aproximarLeitor(scene); abrirComE(scene);
  assert.equal(reproducoes.length, 0, "posicionar o cartão ainda não toca a passagem");
  const posicionar = scene.animations.at(-1);
  posicionar.onComplete();
  const passagem = scene.animations.at(-1);
  assert.equal(passagem.duration, 1584);
  assert.equal(reproducoes[0].chave, "cartao-passando");
  assert.equal(reproducoes[0].config.rate, 1);
  passagem.onComplete();
  assert.equal(sons[0].tocando, false, "a passagem não se sobrepõe à confirmação");
  assert.equal(reproducoes[1].chave, "cartao-acesso-concedido");
  assert.equal(espera, 2064, "a confirmação tem tempo de terminar antes de fechar o painel");
  assert.ok(scene.portasFabrica.every(porta => porta.estado === "fechada"));
  scene.finishActivation();
  assert.equal(scene.portasFabrica.find(porta => porta.nome === "porta02").estado, "abrindo");
  assert.ok(sons.slice(0, 2).every(som => !som.tocando), "os efeitos do cartão terminam antes das portas");
  assert.equal(reproducoes.filter(som => som.chave === "porta-fabrica").length, 2);
  scene.events.emit("shutdown");
  assert.ok(sons.every(som => som.destruido));
});

test("cancelar a passagem interrompe o som e não anuncia acesso concedido", () => {
  const { scene } = createScene();
  const reproducoes = [];
  let tocando = false;
  scene.cache = { audio: { exists: () => true } };
  scene.sound = { add(chave) { return {
    totalDuration: 1.584, addMarker() {},
    play() { reproducoes.push(chave); tocando = true; return true; },
    stop() { tocando = false; }, destroy() {},
  }; } };
  liberarAcesso(scene); aproximarLeitor(scene); abrirComE(scene);
  scene.animations.at(-1).onComplete();
  const passagem = scene.animations.at(-1);
  assert.equal(tocando, true);
  scene.leitorCartaoFabrica.terminal.close();
  passagem.onComplete();
  assert.equal(tocando, false);
  assert.deepEqual(reproducoes, ["cartao-passando"]);
  assert.ok(scene.portasFabrica.every(porta => porta.estado === "fechada"));
  scene.events.emit("shutdown");
});

test("movimentos do mouse e do toque não interferem na passagem automática", () => {
  const { scene } = createScene();
  liberarAcesso(scene); aproximarLeitor(scene); abrirComE(scene);
  scene.input.emit("pointerdown", { id: 7, x: 133, y: 249 });
  scene.input.emit("pointermove", { id: 7, x: 700, y: 400 });
  scene.input.emit("pointerup", { id: 8, x: 675, y: 270 });
  scene.input.emit("pointerupoutside", { id: 7 });
  scene.input.emit("gameout");
  scene.game.events.emit("blur");
  animarCartao(scene);
  assert.ok(scene.texts.find(text => text.name === "card-reader-status").text.includes("ACESSO AUTORIZADO"));
  scene.finishActivation();
  assert.equal(scene.cardReaderMenuOpen, false);
  scene.events.emit("shutdown");
});

test("fechar durante a animação interrompe a leitura sem abrir portas e permite tentar novamente", () => {
  const { scene } = createScene();
  liberarAcesso(scene); aproximarLeitor(scene); abrirComE(scene);
  const animacao = scene.animations.at(-1);
  clickGenerator(scene, 743, 54);
  assert.equal(animacao.stopped, true);
  animacao.onComplete();
  assert.equal(scene.finishActivation, undefined);
  assert.ok(scene.portasFabrica.every(porta => porta.estado === "fechada"));
  aproximarLeitor(scene); abrirComE(scene); lerCartao(scene);
  assert.equal(scene.inventory.getQuantity("card"), 1);
  scene.events.emit("shutdown");
});

test("fechar o leitor devolve o cartão, restaura HUD e movimento e cancela a confirmação", () => {
  const { scene } = createScene();
  liberarAcesso(scene); aproximarLeitor(scene); abrirComE(scene);
  assert.equal(scene.generatorMenuOpen, true);
  assert.equal(scene.game.domContainer.style.display, "none");
  assert.equal(scene.coletarItemProximo(), false);
  assert.equal(scene.interagirGerador(), false);
  scene.teclaColetarItem.pressed = true;
  scene.atualizarColetaItens();
  assert.equal(scene.teclaColetarItem.pressed, false, "E é descartado enquanto o painel está aberto");
  animarCartao(scene);
  const confirmar = scene.finishActivation;
  clickGenerator(scene, 743, 54);
  confirmar();
  assert.ok(scene.portasFabrica.every(porta => porta.estado === "fechada"));
  assert.equal(scene.movimentoBloqueado, false);
  assert.equal(scene.cardReaderMenuOpen, false);
  assert.equal(scene.generatorMenuOpen, false);
  assert.equal(scene.game.domContainer.style.display, "block");
  assert.equal(scene.inventory.getQuantity("card"), 1);
  scene.events.emit("shutdown");
});

test("o leitor revalida acesso durante o painel e na confirmação, inclusive morte e bloqueio do boss", () => {
  for (const alterar of [s => { s.luzFabricaAcesa = false; }, s => s.inventory.removeItem("card", 1),
    s => { s.player.x += 500; }, s => { s.morteEmAndamento = true; },
    s => { s.portasFabrica.find(p => p.nome === "porta02").fecharParaBoss(); }]) {
    const { scene } = createScene();
    liberarAcesso(scene); aproximarLeitor(scene); abrirComE(scene);
    animarCartao(scene);
    alterar(scene);
    scene.finishActivation();
    assert.ok(scene.portasFabrica.every(porta => porta.estado === "fechada"));
    assert.equal(scene.cardReaderMenuOpen, false);
    scene.events.emit("shutdown");
  }
  const { scene } = createScene();
  liberarAcesso(scene); aproximarLeitor(scene); abrirComE(scene);
  scene.luzFabricaAcesa = false;
  scene.events.emit("prerender");
  assert.equal(scene.cardReaderMenuOpen, false, "perder energia fecha o terminal mesmo sem tentar passar");
  scene.events.emit("shutdown");
});

test("o boss fecha as duas persianas, restaura colisões e bloqueia o leitor sem apagar o acesso salvo", () => {
  const { scene, bodies } = createScene();
  liberarAcesso(scene);
  aproximarLeitor(scene);
  abrirComE(scene);
  lerCartao(scene);
  const portas = scene.portasFabrica.filter(porta => ["porta02", "porta03"].includes(porta.nome));
  for (const porta of portas) {
    const tween = scene.animations.find(animation => animation.targets === porta);
    porta.progresso = 1;
    tween.onUpdate(); tween.onComplete();
  }
  assert.equal(bodies.size, 3);
  for (const porta of portas) {
    assert.equal(porta.fecharParaBoss(), true);
    assert.equal(porta.estado, "fechando");
    assert.equal(porta.fecharParaBoss(), false);
    const tween = scene.animations.at(-1);
    assert.equal(tween.progresso, 0);
    assert.equal(tween.duration, 850);
    porta.progresso = 0.5;
    tween.onUpdate();
    assert.equal(porta.visual.visible, true);
    assert.deepEqual(porta.visual.crop, [0, 48, 144, 48]);
    porta.progresso = 0;
    tween.onUpdate(); tween.onComplete();
    assert.equal(porta.estado, "fechada");
    assert.deepEqual(porta.colisao.body, { width: 144, height: 96 });
    assert.equal(scene.game.registry.get(chaveEstadoPorta(porta.nome)), true);
  }
  assert.equal(bodies.size, 5);
  aproximarLeitor(scene);
  assert.equal(scene.leitorCartaoFabrica.marcador.visible, false);
  const animacoes = scene.animations.length;
  abrirComE(scene);
  assert.equal(scene.animations.length, animacoes);
  assert.ok(portas.every(porta => porta.estado === "fechada"));
  for (const porta of portas) {
    assert.equal(porta.liberarAposBoss(), true);
    assert.equal(porta.estado, "aberta");
    assert.equal(porta.colisao, null);
    assert.equal(porta.visual.visible, false);
  }
  assert.equal(bodies.size, 3);
  const registry = scene.game.registry;
  scene.events.emit("shutdown");
  assert.ok(portas.every(porta => porta.liberarAposBoss() === false));
  assert.equal(bodies.size, 0);
  const retorno = createScene(registry);
  assert.ok(retorno.scene.portasFabrica.filter(porta => ["porta02", "porta03"].includes(porta.nome))
    .every(porta => porta.estado === "aberta" && porta.colisao === null));
  retorno.scene.events.emit("shutdown");
});

test("cancelar o fechamento do boss recupera a porta aberta ou preserva uma porta que já estava fechada", () => {
  for (const aberta of [false, true]) {
    const { scene } = createScene(new Map([[chaveEstadoPorta("porta02"), aberta]]));
    const porta = scene.portasFabrica.find(porta => porta.nome === "porta02");
    porta.fecharParaBoss();
    if (aberta) {
      porta.progresso = 0.5;
      scene.animations.at(-1).onUpdate();
    }
    porta.liberarAposBoss();
    assert.equal(porta.estado, aberta ? "aberta" : "fechada");
    assert.equal(porta.progresso, aberta ? 1 : 0);
    assert.equal(Boolean(porta.colisao), !aberta);
    assert.equal(porta.bloqueadaPorBoss, false);
    scene.events.emit("shutdown");
  }
});

test("as portas da arena só recebem interação pelo leitor e a limpeza restaura os tiles", () => {
  const { scene, layer, bodies } = createScene();
  liberarAcesso(scene);
  const tiles = layer.getTilesWithinWorldXY(-1248, -5328, 336, 96);
  assert.ok(tiles.every(tile => tile.alpha === 0));
  scene.player.x = -1248;
  scene.player.y = -5202;
  scene.atualizarInteracaoPortaFabrica();
  assert.equal(scene.interacaoMundoProxima, null, "estar perto da porta não substitui o leitor");
  abrirComE(scene);
  assert.deepEqual(scene.portasFabrica.map(porta => porta.estado), ["fechada", "fechada", "fechada", "fechada", "fechada"]);
  aproximarLeitor(scene);
  abrirComE(scene);
  lerCartao(scene);
  assert.deepEqual(scene.portasFabrica.map(porta => porta.estado), ["fechada", "abrindo", "abrindo", "fechada", "fechada"]);
  const prompt = scene.leitorCartaoFabrica.marcador;
  scene.events.emit("shutdown");
  assert.ok(tiles.every(tile => tile.alpha === 1));
  assert.equal(bodies.size, 0);
  assert.equal(scene.interacaoMundoProxima, null);
  assert.equal(scene.leitorCartaoFabrica, null);
  assert.equal(prompt.destroyed, true);
  assert.equal(scene.events.listenerCount("prerender"), 0);
});

test("nearby collectibles keep priority and opened doors stay open after returning", () => {
  const { scene } = createScene();
  scene.acenderLuzFabrica();
  scene.itensColetaveis.push({ uniqueId: "test:gasolina", itemId: "gasolina", quantity: 1,
    x: scene.player.x, y: scene.player.y, range: 64, image: new DisplayObject() });
  scene.atualizarColetaItens();
  scene.botaoColetarItem.emit("pointerdown");
  assert.equal(scene.inventory.getQuantity("gasolina"), 1);
  assert.equal(scene.portaFabrica.estado, "fechada");
  scene.atualizarColetaItens();
  scene.botaoColetarItem.emit("pointerdown");
  scene.portaFabrica.progresso = 1;
  scene.animation.onUpdate();
  scene.animation.onComplete();
  const registry = scene.game.registry;
  scene.events.emit("shutdown");
  const returned = createScene(registry);
  assert.equal(returned.scene.portaFabrica.estado, "aberta");
  assert.equal(returned.bodies.size, 4);
  assert.equal(returned.scene.interacaoMundoProxima, null);
  returned.scene.events.emit("shutdown");
});

/**
 * Posiciona o jogador ao alcance do gerador real do mapa e atualiza a disponibilidade das
 * interações.
 */
function approachGenerator(scene) {
  const { object: area } = findGeneratorInteraction(scene.map);
  scene.player.x = area.x + area.width / 2;
  scene.player.y = area.y + area.height + 20;
  scene.atualizarInteracaoGeradorFabrica();
  scene.atualizarInteracaoPortaFabrica();
}

test("o menu de coletáveis DEV bloqueia coleta, portas e abertura do gerador", () => {
  const { scene } = createScene();
  scene.devItemMenuOpen = true;
  scene.atualizarInteracaoPortaFabrica();
  assert.equal(scene.interacaoMundoProxima, null);
  const cartao = scene.itensColetaveis.find(item => item.itemId === "card");
  scene.player.x = cartao.x;
  scene.player.y = cartao.y;
  scene.teclaColetarItem.pressed = true;
  scene.atualizarColetaItens();
  scene.botaoColetarItem.emit("pointerdown");
  assert.equal(scene.inventory.getQuantity("card"), 0);
  assert.equal(scene.teclaColetarItem.pressed, false, "E não fica pendente para depois do menu");
  assert.ok(scene.itensColetaveis.includes(cartao));
  approachGenerator(scene);
  assert.equal(scene.interagirGerador(), false);
  assert.notEqual(scene.generatorMenuOpen, true);
  scene.events.emit("shutdown");
});

test("E opens the generator menu in the current map and activation consumes its resources", () => {
  const { scene } = createScene();
  approachGenerator(scene);
  scene.teclaColetarItem.pressed = true;
  scene.atualizarColetaItens();
  assert.equal(scene.generatorMenuOpen, true);
  assert.equal(scene.movimentoBloqueado, true);
  assert.equal(scene.game.domContainer.style.display, "none");

  /**
   * Simula um toque no botão de ativação do gerador dentro do modal.
   */
  const activate = () => clickGenerator(scene, 604, 356);
  activate();
  assert.notEqual(scene.luzFabricaAcesa, true);
  scene.inventory.addItem("gasolina", 2);
  scene.inventory.fillFuel(1);
  scene.inventory.addItem("bateria", 1);
  activate();
  assert.notEqual(scene.luzFabricaAcesa, true, "ter os itens não substitui arrastá-los");
  dragGenerator(scene, 133, 200, 318, 205);
  activate();
  assert.notEqual(scene.luzFabricaAcesa, true, "precisa conectar as duas peças");
  dragGenerator(scene, 133, 279, 318, 315);
  assert.equal(scene.inventory.getQuantity("gasolina"), 2, "encaixar ainda não consome");
  assert.notEqual(scene.luzFabricaAcesa, true, "encaixar não liga automaticamente");
  activate();
  assert.equal(scene.luzFabricaAcesa, true);
  assert.equal(scene.inventory.getQuantity("gasolina"), 1);
  assert.equal(scene.inventory.getQuantity("bateria"), 0);
  activate();
  assert.equal(scene.inventory.getQuantity("gasolina"), 1, "cliques repetidos não consomem de novo");
  scene.finishActivation();
  assert.equal(scene.generatorMenuOpen, false);
  assert.equal(scene.movimentoBloqueado, false);
  assert.equal(scene.game.domContainer.style.display, "block");
  scene.events.emit("shutdown");
});

test("the shared touch button opens the generator and an open menu blocks collection", () => {
  const { scene } = createScene();
  approachGenerator(scene);
  scene.atualizarColetaItens();
  assert.equal(scene.botaoColetarItem.visible, true);
  scene.botaoColetarItem.emit("pointerdown");
  assert.equal(scene.generatorMenuOpen, true);
  assert.equal(scene.coletarItemProximo(), false);
  scene.events.emit("shutdown");
  assert.equal(scene.game.domContainer.style.display, "block");
});

test("collecting an item keeps priority over the nearby generator", () => {
  const { scene } = createScene();
  approachGenerator(scene);
  scene.itensColetaveis.push({
    uniqueId: "test:generator-gasolina", itemId: "gasolina", quantity: 1,
    x: scene.player.x, y: scene.player.y, range: 64, image: new DisplayObject(),
  });
  scene.teclaColetarItem.pressed = true;
  scene.atualizarColetaItens();
  assert.equal(scene.inventory.getQuantity("gasolina"), 1);
  assert.equal(scene.inventory.getSlots().find(s => s.itemId === "gasolina").fuel, 0);
  scene.revelarFalas();
  assert.match(scene.texts.find(t => t.name === "fuel-speech-bubble").text, /galão está vazio.*enchê-lo/);
  assert.notEqual(scene.generatorMenuOpen, true);
  scene.teclaColetarItem.pressed = true;
  scene.atualizarColetaItens();
  assert.equal(scene.generatorMenuOpen, true);
  scene.events.emit("shutdown");
});

test("galão vazio não encaixa no gerador nem consome a bateria; só o cheio libera a ativação", () => {
  const { scene } = createScene();
  scene.inventory.addItem("gasolina");
  scene.inventory.addItem("bateria");
  approachGenerator(scene);
  scene.interagirGerador();
  dragGenerator(scene, 133, 200, 318, 205);
  dragGenerator(scene, 133, 279, 318, 315);
  clickGenerator(scene, 604, 356);
  assert.notEqual(scene.luzFabricaAcesa, true);
  assert.equal(scene.inventory.getQuantity("bateria"), 1);
  assert.ok(scene.texts.some(t => /Encha o galão/.test(t.text)));
  scene.inventory.fillFuel(0.7);
  dragGenerator(scene, 133, 279, 318, 315);
  clickGenerator(scene, 604, 356);
  assert.notEqual(scene.luzFabricaAcesa, true);
  scene.inventory.fillFuel(0.3);
  dragGenerator(scene, 133, 279, 318, 315);
  clickGenerator(scene, 604, 356);
  assert.equal(scene.luzFabricaAcesa, true);
  assert.equal(scene.inventory.getQuantity("gasolina"), 0);
  assert.equal(scene.inventory.getQuantity("bateria"), 0);
  scene.events.emit("shutdown");
});

test("E inicia o abastecimento, afastar cancela e o toque continua a partir do nível parcial", () => {
  const city = JSON.parse(readFileSync(new URL("../../assets/map/InicioFase1 (1).json", import.meta.url)));
  const gasLayer = city.layers.find(l => l.name.toLowerCase() === "gasolina");
  const { scene } = createScene(new Map(), raw => raw.layers.push(gasLayer));
  const area = gasLayer.objects[0];
  scene.player.x = area.x + area.width / 2;
  scene.player.y = area.y + area.height / 2;
  scene.inventory.addItem("gasolina");
  scene.atualizarAbastecimento(0);
  scene.teclaColetarItem.pressed = true;
  scene.atualizarColetaItens();
  for (let i = 0; i < 10; i++) scene.atualizarAbastecimento(100);
  const parcial = scene.inventory.getSlots()[0].fuel;
  assert.ok(Math.abs(parcial - 0.25) < 1e-9);
  scene.player.x += 500;
  scene.atualizarAbastecimento(100);
  assert.equal(scene.inventory.getSlots()[0].fuel, parcial);
  scene.player.x -= 500;
  scene.atualizarAbastecimento(100);
  assert.equal(scene.inventory.getSlots()[0].fuel, parcial, "voltar não retoma automaticamente");
  scene.atualizarColetaItens();
  scene.botaoColetarItem.emit("pointerdown");
  for (let i = 0; i < 31; i++) scene.atualizarAbastecimento(100);
  assert.equal(scene.inventory.getSlots()[0].fuel, 1);
  scene.revelarFalas();
  assert.match(scene.texts.find(t => t.name === "fuel-speech-bubble").text, /Galão cheio/);
  scene.events.emit("shutdown");
  assert.equal(scene.atualizarAbastecimento, null);
  assert.equal(scene.game.events.listenerCount("blur"), 0);
});

test("abastecimento exige galão e proximidade e é interrompido por menu, morte e perda de foco", () => {
  const { scene } = createScene(new Map(), raw => raw.layers.push({ name: "gasolina", objects: [
    { x: -2000, y: -2000, width: 80, height: 80 },
  ] }));
  scene.player.x = scene.player.y = -1960;
  scene.atualizarAbastecimento(0);
  scene.interacaoCombustivelProxima.interact();
  scene.revelarFalas();
  assert.match(scene.texts.find(t => t.name === "fuel-speech-bubble").text, /encontrar um galão/);
  scene.inventory.addItem("gasolina");
  for (const bloqueio of ["generatorMenuOpen", "devItemMenuOpen", "morteEmAndamento"]) {
    scene.atualizarAbastecimento(0);
    scene.interacaoCombustivelProxima.interact();
    scene[bloqueio] = true;
    scene.atualizarAbastecimento(100);
    scene[bloqueio] = false;
    scene.atualizarAbastecimento(100);
    assert.equal(scene.inventory.getSlots()[0].fuel, 0);
  }
  scene.interacaoCombustivelProxima.interact();
  scene.game.events.emit("blur");
  scene.atualizarAbastecimento(100);
  assert.equal(scene.inventory.getSlots()[0].fuel, 0);
  const interagir = scene.interacaoCombustivelProxima.interact;
  scene.player.x += 500;
  assert.equal(interagir(), false, "revalida o alcance no instante do toque");
  scene.events.emit("shutdown");
});

test("som baixo acompanha só o tempo restante de abastecimento, inclusive após retomar um galão parcial", () => {
  const { scene } = createScene(new Map(), raw => raw.layers.push({ name: "gasolina", objects: [
    { x: -2000, y: -2000, width: 80, height: 80 },
  ] }));
  const audio = registrarSonsPortas(scene);
  scene.player.x = scene.player.y = -1960;
  scene.atualizarAbastecimento(0);
  scene.interacaoCombustivelProxima.interact();
  assert.equal(audio.reproducoes.length, 0, "sem galão não há áudio");
  scene.inventory.addItem("gasolina");
  scene.interacaoCombustivelProxima.interact();
  scene.interacaoCombustivelProxima.interact();
  assert.equal(audio.reproducoes.length, 1, "interações repetidas não reiniciam o som");
  assert.equal(audio.reproducoes[0].chave, "enchendo-galao");
  assert.deepEqual(audio.reproducoes[0].config,
    { volume: 0.08, loop: false, rate: 1, detune: 0, seek: 0 });
  for (let i = 0; i < 10; i++) scene.atualizarAbastecimento(100);
  assert.equal(audio.sons[0].tocando, true);
  scene.player.x += 500;
  scene.atualizarAbastecimento(0);
  assert.equal(audio.sons[0].tocando, false, "afastar interrompe o áudio imediatamente");
  scene.player.x -= 500;
  scene.atualizarAbastecimento(0);
  scene.interacaoCombustivelProxima.interact();
  assert.equal(audio.reproducoes.length, 2);
  for (let i = 0; i < 29; i++) scene.atualizarAbastecimento(100);
  assert.equal(audio.sons[0].tocando, true);
  scene.atualizarAbastecimento(100);
  assert.equal(scene.inventory.getSlots()[0].fuel, 1);
  assert.equal(audio.sons[0].tocando, false, "retomada toca só os três segundos restantes");
  scene.interacaoCombustivelProxima?.interact();
  assert.equal(audio.reproducoes.length, 2, "galão cheio não dispara som");
  scene.events.emit("shutdown");
  assert.ok(audio.sons[0].destruido);
});

test("áudio de abastecimento para em menus, morte, pausa, perda de foco e encerramento", () => {
  for (const interromper of [
    s => { s.generatorMenuOpen = true; s.atualizarAbastecimento(0); },
    s => { s.devItemMenuOpen = true; s.atualizarAbastecimento(0); },
    s => { s.morteEmAndamento = true; s.atualizarAbastecimento(0); },
    s => s.events.emit("pause"), s => s.events.emit("sleep"),
    s => s.game.events.emit("blur"), s => s.events.emit("shutdown"),
  ]) {
    const { scene } = createScene(new Map(), raw => raw.layers.push({ name: "gasolina", objects: [
      { x: -2000, y: -2000, width: 80, height: 80 },
    ] }));
    const audio = registrarSonsPortas(scene);
    scene.player.x = scene.player.y = -1960;
    scene.inventory.addItem("gasolina");
    scene.atualizarAbastecimento(0);
    scene.interacaoCombustivelProxima.interact();
    assert.equal(audio.sons[0].tocando, true);
    interromper(scene);
    assert.equal(audio.sons[0].tocando, false);
    scene.events.emit("shutdown");
    assert.ok(audio.sons[0].destruido);
  }
});

function clickGenerator(scene, x, y) {
  scene.input.emit("pointerdown", { id: 0, x, y });
  scene.input.emit("pointerup", { id: 0, x, y });
}

function dragGenerator(scene, x, y, targetX, targetY, id = 0) {
  scene.input.emit("pointerdown", { id, x, y });
  scene.input.emit("pointermove", { id, x: targetX, y: targetY });
  scene.input.emit("pointerup", { id, x: targetX, y: targetY });
}

test("encaixes rejeitam peças trocadas, devolvem ao inventário e revalidam os recursos", () => {
  const { scene } = createScene();
  scene.inventory.addItem("bateria");
  scene.inventory.addItem("gasolina");
  scene.inventory.fillFuel(1);
  approachGenerator(scene);
  scene.interagirGerador();
  dragGenerator(scene, 133, 200, 318, 315);
  dragGenerator(scene, 133, 279, 318, 205);
  clickGenerator(scene, 604, 356);
  assert.notEqual(scene.luzFabricaAcesa, true);
  dragGenerator(scene, 133, 200, 318, 205);
  dragGenerator(scene, 133, 279, 318, 315);
  dragGenerator(scene, 318, 205, 133, 200);
  clickGenerator(scene, 604, 356);
  assert.notEqual(scene.luzFabricaAcesa, true, "devolver uma peça interrompe o circuito");
  dragGenerator(scene, 133, 200, 318, 205);
  scene.inventory.removeItem("bateria");
  clickGenerator(scene, 604, 356);
  assert.notEqual(scene.luzFabricaAcesa, true, "revalida o inventário antes de consumir");
  assert.equal(scene.inventory.getQuantity("gasolina"), 1);
  scene.events.emit("shutdown");
});

test("fechar e reabrir limpa reservas; cancelar um arraste e outro dedo não encaixam a peça", () => {
  const { scene } = createScene();
  scene.inventory.addItem("bateria");
  scene.inventory.addItem("gasolina");
  scene.inventory.fillFuel(1);
  approachGenerator(scene);
  scene.interagirGerador();
  dragGenerator(scene, 133, 200, 318, 205);
  clickGenerator(scene, 743, 54);
  assert.equal(scene.generatorMenuOpen, false);
  assert.equal(scene.inventory.getQuantity("bateria"), 1);
  approachGenerator(scene);
  scene.interagirGerador();
  dragGenerator(scene, 133, 279, 318, 315);
  clickGenerator(scene, 604, 356);
  assert.notEqual(scene.luzFabricaAcesa, true, "reabrir exige encaixar de novo");
  scene.input.emit("pointerdown", { id: 1, x: 133, y: 200 });
  scene.input.emit("pointerup", { id: 2, x: 318, y: 205 });
  clickGenerator(scene, 604, 356);
  assert.notEqual(scene.luzFabricaAcesa, true);
  scene.input.emit("pointerupoutside", { id: 1 });
  clickGenerator(scene, 604, 356);
  assert.notEqual(scene.luzFabricaAcesa, true);
  dragGenerator(scene, 133, 200, 318, 205);
  clickGenerator(scene, 604, 356);
  assert.equal(scene.luzFabricaAcesa, true);
  scene.events.emit("shutdown");
  for (const name of ["pointerdown", "pointermove", "pointerup", "pointerupoutside", "gameout"]) {
    assert.equal(scene.input.listenerCount(name), 0, name);
  }
  assert.equal(scene.game.events.listenerCount("blur"), 0);
});
