import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { prepararGeradoresNovoBoss } from "./NovoBossGeradores.js";
import { novoBossConfig } from "./NovoBossConfig.js";
import { readFileSync } from "node:fs";
import { assetsNovoBoss } from "./NovoBossAssets.js";
import { alvosAdicionaisCombate, causarDanoAlvoAdicional } from "../../combat/CombatTargets.js";
import { atualizarDepthAtores } from "../../map/ProfundidadeMapa.js";
import BossEnergyLighting from "../../effects/BossEnergyLighting.js";

globalThis.Phaser = { Geom: { Rectangle: class {
  constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); }
  get left() { return this.x; } get right() { return this.x + this.width; }
  get top() { return this.y; } get bottom() { return this.y + this.height; }
} } };

function criarCena(opcoes = {}) {
  const criados = [];
  const colliders = [];
  const objetosMapa = [];
  const criarVisual = (x = 0, y = 0, width = 1, height = 1) => {
    const objeto = Object.assign(new EventEmitter(), {
      x, y, width, height, active: true, visible: true, alpha: 1,
      setDepth(depth) { this.depth = depth; return this; },
      setName(name) { this.name = name; return this; },
      setOrigin() { return this; },
      setScale(scale) { this.scaleX = this.scaleY = scale; return this; },
      setTexture(key, frame) { this.texture = key; this.frame = frame; return this; },
      setFrame(frame) { this.frame = frame; return this; },
      setInteractive() { this.interactive = true; return this; },
      setVisible(visible) { this.visible = visible; return this; },
      setAlpha(alpha) { this.alpha = alpha; return this; },
      setFillStyle(color) { this.color = color; return this; },
      setStrokeStyle() { return this; },
      clear() { this.limpo = true; return this; },
      lineStyle() { return this; }, fillStyle() { return this; },
      fillCircle() { return this; }, strokeCircle() { return this; },
      destroy() { this.active = false; this.destroyed = true; this.removeAllListeners(); },
    });
    criados.push(objeto);
    return objeto;
  };
  const config = {
    ...novoBossConfig,
    geradores: {
      ativo: true, distanciaInteracao: 72, tamanho: 36,
      pontos: [
        { id: "superior-esquerdo", x: -1460, y: -5920 },
        { id: "superior-direito", x: -740, y: -5920 },
        { id: "inferior-esquerdo", x: -1450, y: -5620 },
        { id: "inferior-direito", x: -720, y: -5620 },
      ],
    },
  };
  const scene = {
    events: new EventEmitter(), input: { keyboard: new EventEmitter() },
    player: { active: true, x: -1080, y: -5520 }, vida: 100,
    add: {
      graphics: () => criarVisual(),
      sprite: (x, y, key, frame) => criarVisual(x, y, 192, 258).setTexture(key, frame),
      rectangle: (x, y, width, height) => criarVisual(x, y, width, height),
      circle: (x, y, raio) => criarVisual(x, y, raio * 2, raio * 2),
      text: (x, y) => criarVisual(x, y),
    },
    physics: { add: {
      existing(visual) {
        visual.body = {
          x: visual.x - visual.width / 2, y: visual.y - visual.height / 2,
          width: visual.width, height: visual.height, enable: true,
          setSize(width, height) { this.width = width; this.height = height; },
          setCircle(radius) { this.radius = radius; this.isCircle = true; },
          updateFromGameObject() {
            this.x = visual.x - visual.width / 2;
            this.y = visual.y - visual.height / 2;
          },
        };
      },
      collider(a, b) {
        const collider = { a, b, destroy() { this.destroyed = true; } };
        colliders.push(collider);
        return collider;
      },
    } },
    collisionGroup: { getChildren: () => objetosMapa },
    ...opcoes,
  };
  const obstaculoExtra = { x: -1600, y: -6100, width: 4, height: 4 };
  const encontro = {
    config, sprite: { x: -1080, y: -5810, visible: true },
    jogadorNaArena: true, morto: false, suspenso: false, encerrado: false,
    obstaculosTeleporte: [obstaculoExtra],
  };
  return { scene, encontro, config, criados, colliders, objetosMapa, obstaculoExtra };
}

function aproximar(scene, gerador, distancia = 60) {
  scene.player.x = gerador.x;
  scene.player.y = gerador.y - distancia;
  scene.player.body = { center: { x: gerador.x, y: gerador.y - distancia } };
}

test("prepara quatro corpos próprios e barreira sem alterar o mapa nem o gerador da fábrica", () => {
  const { scene, encontro, colliders, objetosMapa, obstaculoExtra } = criarCena();
  const factoryState = { energia: true };
  scene.factoryGenerator = factoryState;
  scene.luzFabricaAcesa = true;
  const sistema = prepararGeradoresNovoBoss(scene, encontro);
  assert.equal(sistema, encontro.sistemaGeradores);
  assert.equal(sistema.snapshot().restantes, 4);
  assert.equal(encontro.barreiraAtiva, true);
  assert.equal(colliders.length, 5);
  assert.equal(objetosMapa.length, 0);
  assert.equal(encontro.obstaculosTeleporte[0], obstaculoExtra);
  assert.equal(encontro.obstaculosTeleporte.length, 5);
  assert.ok(encontro.geradores.every(g => g.body.enable && g.body.width === 36 && g.body.height === 36));
  assert.equal(scene.factoryGenerator, factoryState);
  assert.equal(scene.luzFabricaAcesa, true);
  assert.equal(prepararGeradoresNovoBoss(scene, encontro), sistema);
  assert.equal(colliders.length, 5);
});

test("E e toque desativam permanentemente só o gerador próximo; barreira cai no quarto", () => {
  const { scene, encontro } = criarCena();
  const desligados = [];
  let quedas = 0;
  scene.events.on("novo-boss:gerador-desativado", ({ gerador }) => desligados.push(gerador.id));
  scene.events.on("novo-boss:barreira-desativada", () => quedas++);
  const sistema = prepararGeradoresNovoBoss(scene, encontro);
  for (let indice = 0; indice < 4; indice++) {
    const gerador = encontro.geradores[indice];
    aproximar(scene, gerador);
    sistema.atualizar(16);
    assert.equal(gerador.label.visible, true);
    assert.equal(sistema.snapshot().proximo, gerador.id);
    if (indice < 3) scene.input.keyboard.emit("keydown-E", { repeat: false });
    else gerador.label.emit("pointerdown");
    assert.equal(gerador.ligado, false);
    assert.equal(gerador.label.visible, false);
    assert.equal(sistema.snapshot().restantes, 3 - indice);
    assert.equal(encontro.barreiraAtiva, indice < 3);
    assert.equal(sistema.interagir(gerador.id), false);
  }
  sistema.atualizar(120000);
  assert.equal(sistema.snapshot().restantes, 0);
  assert.equal(quedas, 1);
  assert.equal(new Set(desligados).size, 4);
});

test("não permite interação remota, repetição automática nem clique em outro gerador", () => {
  const { scene, encontro } = criarCena();
  const sistema = prepararGeradoresNovoBoss(scene, encontro);
  assert.equal(sistema.interagir(), false);
  aproximar(scene, encontro.geradores[0]);
  sistema.atualizar(0);
  scene.input.keyboard.emit("keydown-E", { repeat: true });
  assert.equal(sistema.snapshot().restantes, 4);
  encontro.geradores[1].label.emit("pointerdown");
  assert.equal(sistema.snapshot().restantes, 4);
  assert.equal(sistema.interagir(encontro.geradores[1].id), false);
  assert.equal(sistema.interagir(encontro.geradores[0].id), true);
});

test("proximidade considera o centro físico deslocado do sprite do jogador", () => {
  const { scene, encontro } = criarCena();
  const sistema = prepararGeradoresNovoBoss(scene, encontro);
  const gerador = encontro.geradores[0];
  scene.player.x = gerador.x + 500;
  scene.player.y = gerador.y + 500;
  scene.player.body = { center: { x: gerador.x, y: gerador.y - 65 } };
  assert.equal(sistema.interagir(), true);
});

test("menus, bloqueios e agarrão impedem a interação sem modificar esses sistemas", () => {
  for (const bloqueio of ["movimentoBloqueado", "generatorMenuOpen", "agarrado"]) {
    const { scene, encontro } = criarCena();
    const sistema = prepararGeradoresNovoBoss(scene, encontro);
    aproximar(scene, encontro.geradores[0]);
    if (bloqueio === "agarrado") scene.restricaoControleNovoBoss = { fonte: "tentaculo-1", restanteMs: 1000 };
    else scene[bloqueio] = true;
    sistema.atualizar(0);
    assert.equal(sistema.interagir(), false, bloqueio);
    assert.ok(encontro.geradores.every(g => !g.label.visible), bloqueio);
    if (bloqueio === "agarrado") assert.equal(scene.restricaoControleNovoBoss.restanteMs, 1000);
    else assert.equal(scene[bloqueio], true);
  }
});

test("saída, morte, suspensão e multiplayer ocultam recursos e impedem ações", () => {
  for (const bloquear of [
    (s, e) => { e.jogadorNaArena = false; },
    (s, e) => { e.morto = true; },
    (s, e) => { e.suspenso = true; },
    (s) => { s.vida = 0; },
    (s) => { s.morteEmAndamento = true; },
    (s) => { s.player.active = false; },
    (s) => { s.multiplayer = true; },
  ]) {
    const { scene, encontro, criados } = criarCena();
    const sistema = prepararGeradoresNovoBoss(scene, encontro);
    aproximar(scene, encontro.geradores[0]);
    bloquear(scene, encontro);
    sistema.atualizar(0);
    assert.equal(sistema.interagir(), false);
    assert.ok(encontro.geradores.every(g => !g.visual.visible && !g.nucleo.visible && !g.label.visible && !g.body.enable));
    assert.equal(criados.find(objeto => objeto.name === "novo-boss-barreira").visible, false);
  }
});

test("reentrada conserva geradores desligados e torna os demais interativos", () => {
  const { scene, encontro } = criarCena();
  const sistema = prepararGeradoresNovoBoss(scene, encontro);
  aproximar(scene, encontro.geradores[0]);
  assert.equal(sistema.interagir(), true);
  encontro.jogadorNaArena = false;
  sistema.atualizar(16000);
  encontro.jogadorNaArena = true;
  aproximar(scene, encontro.geradores[1]);
  sistema.atualizar(0);
  assert.equal(encontro.geradores[0].ligado, false);
  assert.equal(sistema.snapshot().restantes, 3);
  assert.equal(sistema.interagir(), true);
  assert.equal(sistema.snapshot().restantes, 2);
});

test("limpeza idempotente remove somente seus colliders, obstáculos e listener", () => {
  const { scene, encontro, criados, colliders, obstaculoExtra } = criarCena();
  let alheio = 0;
  const eventoAlheio = () => alheio++;
  scene.input.keyboard.on("keydown-E", eventoAlheio);
  const sistema = prepararGeradoresNovoBoss(scene, encontro);
  assert.equal(scene.input.keyboard.listenerCount("keydown-E"), 2);
  sistema.destruir();
  sistema.destruir();
  assert.equal(scene.input.keyboard.listenerCount("keydown-E"), 1);
  scene.input.keyboard.emit("keydown-E", {});
  assert.equal(alheio, 1);
  assert.deepEqual(encontro.obstaculosTeleporte, [obstaculoExtra]);
  assert.equal(encontro.sistemaGeradores, null);
  assert.deepEqual(encontro.geradores, []);
  assert.equal(encontro.barreiraAtiva, false);
  assert.ok(criados.every(objeto => objeto.destroyed));
  assert.ok(colliders.every(collider => collider.destroyed));
  assert.equal(sistema.interagir(), false);
});

test("configuração desligada e multiplayer não criam recursos nem bloqueiam combate", () => {
  for (const multiplayer of [false, true]) {
    const { scene, encontro, criados } = criarCena({ multiplayer });
    if (!multiplayer) encontro.config.geradores.ativo = false;
    assert.equal(prepararGeradoresNovoBoss(scene, encontro), null);
    assert.equal(encontro.barreiraAtiva, false);
    assert.deepEqual(encontro.geradores, []);
    assert.equal(criados.length, 0);
    assert.equal(encontro.pendencia, undefined);
  }
});

test("pontos inválidos não deixam recursos parciais nem barreira impossível de derrubar", () => {
  for (const invalidar of [
    (e) => { e.config.geradores.pontos = []; },
    (e) => { e.config.geradores.tamanho = 0; },
    (e) => { e.config.geradores.pontos[0].x = NaN; },
    (e) => { e.config.geradores.pontos[0].x = e.config.arena.xMin; },
    (e) => { Object.assign(e.config.geradores.pontos[0], e.config.teleporte.pontos[0]); },
    (e) => { e.config.geradores.pontos[1] = { ...e.config.geradores.pontos[0] }; },
  ]) {
    const { scene, encontro, criados } = criarCena();
    invalidar(encontro);
    assert.equal(prepararGeradoresNovoBoss(scene, encontro), false);
    assert.equal(encontro.pendencia, "posicoes-geradores-bloqueadas");
    assert.equal(criados.length, 0);
    assert.equal(encontro.sistemaGeradores, undefined);
  }
});

test("ponto coberto por colisão do mapa aguarda preparação sem criar gerador inacessível", () => {
  const { scene, encontro, objetosMapa, criados } = criarCena();
  const ponto = encontro.config.geradores.pontos[0];
  objetosMapa.push({ body: { x: ponto.x - 20, y: ponto.y - 20, width: 40, height: 40, enable: true } });
  assert.equal(prepararGeradoresNovoBoss(scene, encontro), false);
  assert.equal(criados.length, 0);
  objetosMapa.length = 0;
  assert.ok(prepararGeradoresNovoBoss(scene, encontro));
  assert.equal(encontro.pendencia, null);
});

test("colisão circular acompanha o escudo e desliga em teleporte, saída e queda da barreira", () => {
  const { scene, encontro, criados, colliders } = criarCena();
  scene.player.body = { enable: true };
  const sistema = prepararGeradoresNovoBoss(scene, encontro);
  const escudo = criados.find(o => o.name === "novo-boss-barreira-colisao");
  assert.ok(escudo.body.isCircle && escudo.body.enable);
  assert.equal(escudo.body.radius, 95);
  assert.ok(colliders.some(c => Array.isArray(c.object1 ?? c.a) &&
    (c.object1 ?? c.a).includes(scene.player) && c.b === escudo));
  assert.ok(!encontro.obstaculosTeleporte.includes(escudo));
  encontro.sprite.x -= 70; encontro.sprite.y -= 40;
  sistema.atualizar(16);
  assert.equal(escudo.x, encontro.sprite.x);
  assert.equal(escudo.body.y + 95, encontro.sprite.y + 16);
  for (const ocultar of [
    () => { encontro.teleporte = {}; },
    () => { encontro.sprite.alpha = 0; },
    () => { encontro.jogadorNaArena = false; },
    () => { encontro.barreiraAtiva = false; },
  ]) {
    ocultar(); sistema.atualizar(0); assert.equal(escudo.body.enable, false);
    encontro.teleporte = null; encontro.sprite.alpha = 1;
    encontro.jogadorNaArena = true; encontro.barreiraAtiva = true;
    sistema.atualizar(0); assert.equal(escudo.body.enable, true);
  }
  for (const g of encontro.geradores) { aproximar(scene, g); assert.ok(sistema.interagir(g.id)); }
  assert.equal(escudo.body.enable, false);
  sistema.destruir(); assert.ok(escudo.destroyed);
});

function criarArenaTorres() {
  const mapa = JSON.parse(readFileSync(new URL("../../../assets/map/parte2-fase1.json", import.meta.url)));
  const camada = mapa.layers.find(l => l.name === "TorreBoss");
  camada.visible = false; // Gatilhos ocultos no editor continuam funcionando.
  const contexto = criarCena({
    map: { getObjectLayer: nome => mapa.layers.find(l => l.name === nome) },
    textures: { exists: key => key.startsWith("novo-boss-torre-") },
  });
  const { scene, encontro, objetosMapa } = contexto;
  for (const o of mapa.layers.find(l => l.name === "collision").objects) {
    if (o.width > 0 && o.height > 0 && !o.polygon && !o.ellipse && !o.polyline) {
      objetosMapa.push({ body: { x: o.x, y: o.y, width: o.width, height: o.height, enable: true } });
    }
  }
  Object.defineProperty(encontro, "active", { get: () => !encontro.encerrado &&
    !encontro.morto && !encontro.suspenso && encontro.jogadorNaArena && !encontro.introducaoBloqueada });
  scene.novoBoss = encontro;
  return { ...contexto, camada };
}

test("torres usam colisões desenhadas no mapa, sem criar corpos ou colliders adicionais pelo sprite", () => {
  const { scene, encontro, camada, colliders, objetosMapa, criados, obstaculoExtra } = criarArenaTorres();
  const colisoesAntes = JSON.stringify(objetosMapa);
  const sistema = prepararGeradoresNovoBoss(scene, encontro);
  assert.ok(sistema);
  assert.equal(encontro.geradores.length, 4);
  assert.equal(colliders.length, 1, "somente o escudo tem collider próprio");
  assert.equal(JSON.stringify(objetosMapa), colisoesAntes, "mantém as colisões do Tiled intactas");
  assert.deepEqual(encontro.obstaculosTeleporte, [obstaculoExtra]);
  assert.ok(criados.every(o => !o.name?.startsWith("novo-boss-torre-colisao-")));
  scene.profundidadePersonagemParte2 = 16.5;
  scene.player.setDepth = function (depth) { this.depth = depth; return this; };
  const idsColisoes = { 1593: 1598, 1594: 1599, 1596: 1600, 1597: 1601 };
  for (const [i, t] of encontro.geradores.entries()) {
    const o = camada.objects[i];
    assert.ok(t.torre);
    assert.equal(t.x, o.x + o.width / 2);
    assert.equal(t.visual.y, o.y + o.height);
    assert.equal(t.visual.body, undefined, "o sprite não recebe corpo Arcade");
    assert.equal(t.body, t.hitboxDano, "conserva o alvo de dano sem adicionar física");
    assert.equal(t.body.x, t.visual.x - t.body.width / 2);
    assert.equal(t.body.y, t.visual.y - t.body.height);
    assert.equal(t.visual.texture, assetsNovoBoss.torreSummon.chave);
    const colisao = scene.map.getObjectLayer("collision").objects.find(o => o.id === idsColisoes[t.id]);
    const centroY = colisao.y + colisao.height / 2;
    for (const deslocamento of [-10, 0, 10]) {
      scene.player.body = { bottom: centroY + deslocamento };
      scene.player.y = centroY - 1000; // A origem do sprite não pode substituir o pé físico.
      sistema.atualizar(0);
      atualizarDepthAtores(scene);
      if (deslocamento < 0) assert.ok(scene.player.depth < t.visual.depth, "pé acima do centro: atrás da torre");
      else assert.ok(scene.player.depth > t.visual.depth, "pé no centro ou abaixo: à frente da torre");
    }
  }
  assert.equal(scene.input.keyboard.listenerCount("keydown-E"), 0);
  aproximar(scene, encontro.geradores[0]);
  assert.equal(sistema.interagir(), false);
  assert.deepEqual(alvosAdicionaisCombate(scene), []);
  sistema.atualizar(1600);
  assert.equal(causarDanoAlvoAdicional(scene, encontro.geradores[0], 40), true);
  assert.equal(JSON.stringify(objetosMapa), colisoesAntes, "receber dano não modifica colisões do mapa");
});

test("summon toca uma vez; idle repete respeitando o quadro original de 200 ms", () => {
  const { scene, encontro } = criarArenaTorres();
  const sistema = prepararGeradoresNovoBoss(scene, encontro), t = encontro.geradores[0];
  sistema.atualizar(1599);
  assert.equal(t.estado, "summon"); assert.equal(t.visual.frame, 15);
  sistema.atualizar(1);
  assert.equal(t.estado, "idle"); assert.equal(t.visual.frame, 0);
  assert.equal(alvosAdicionaisCombate(scene).length, 4);
  sistema.atualizar(700); assert.equal(t.visual.frame, 7);
  sistema.atualizar(199); assert.equal(t.visual.frame, 7);
  sistema.atualizar(1); assert.equal(t.visual.frame, 8);
  sistema.atualizar(700); assert.equal(t.visual.frame, 0);
  sistema.atualizar(16000); assert.equal(t.estado, "idle"); assert.equal(t.visual.frame, 0);
});

test("luz azul segue as faíscas do idle, a pausa de 200 ms e o ciclo de vida da torre", () => {
  const { scene, encontro } = criarArenaTorres();
  const sistema = prepararGeradoresNovoBoss(scene, encontro), torre = encontro.geradores[0];
  const luzes = new BossEnergyLighting(scene);
  const camera = { width: 2000, height: 1600, matrix: { a: 1, b: 0, c: 0, d: 1, e: 2000, f: 6500 } };
  const choques = () => luzes.atualizar(camera).filter(fonte => fonte.choqueTorre);
  sistema.atualizar(1599);
  assert.equal(choques().length, 0, "a invocação não emite o choque de idle");
  sistema.atualizar(1);
  assert.equal(torre.visual.frame, 0);
  assert.equal(choques().length, 0, "quadro sem faísca fica apagado");
  sistema.atualizar(100);
  let fontes = choques();
  assert.equal(fontes.length, 4);
  assert.equal(torre.visual.frame, 1);
  assert.ok(Math.abs(fontes[0].luz.x - torre.visual.x) < 10);
  assert.ok(fontes[0].luz.y < torre.visual.y - 90, "a luz nasce entre as bobinas, acima da base");
  const fraca = fontes[0].intensidade, revisao = luzes.revisao;
  sistema.atualizar(99); choques();
  assert.equal(luzes.revisao, revisao, "reutiliza a composição enquanto o quadro é o mesmo");
  sistema.atualizar(1);
  assert.equal(torre.visual.frame, 2);
  assert.ok(choques()[0].intensidade > fraca, "o choque maior ilumina mais");
  sistema.atualizar(500);
  assert.equal(torre.visual.frame, 7);
  assert.equal(choques().length, 0);
  sistema.atualizar(199);
  assert.equal(torre.visual.frame, 7);
  assert.equal(choques().length, 0, "a pausa original de 200 ms permanece apagada");
  sistema.atualizar(1);
  assert.equal(torre.visual.frame, 8);
  assert.equal(choques().length, 4);
  encontro.suspenso = true;
  sistema.atualizar(5000);
  assert.equal(choques().length, 0);
  assert.equal(torre.visual.frame, 8, "suspender não avança o relógio das faíscas");
  encontro.suspenso = false;
  sistema.atualizar(0);
  assert.equal(choques().length, 4);
  assert.ok(causarDanoAlvoAdicional(scene, torre, 1));
  assert.equal(choques().length, 3, "receber dano apaga o choque imediatamente");
  sistema.atualizar(400);
  assert.equal(torre.estado, "idle");
  sistema.atualizar(100);
  assert.equal(choques().length, 4, "o idle retoma a luz pelo quadro atual");
  assert.ok(causarDanoAlvoAdicional(scene, torre, 1000));
  assert.equal(choques().length, 3, "torres destruídas deixam de emitir luz");
  sistema.destruir();
  assert.equal(choques().length, 0);
  luzes.destroy();
});

test("ataques usam vida própria e attacked temporário; último dano derruba o escudo imediatamente", () => {
  const { scene, encontro, criados } = criarArenaTorres();
  let quedas = 0, destruidas = 0;
  scene.events.on("novo-boss:barreira-desativada", () => quedas++);
  scene.events.on("novo-boss:gerador-desativado", () => destruidas++);
  const sistema = prepararGeradoresNovoBoss(scene, encontro), t = encontro.geradores[0];
  assert.equal(causarDanoAlvoAdicional(scene, t, 40), false);
  sistema.atualizar(1600);
  assert.equal(causarDanoAlvoAdicional(scene, t, 40, { x: 0, y: 0, width: 10, height: 10 }), false);
  assert.equal(causarDanoAlvoAdicional(scene, t, 40), true);
  assert.equal(t.vida, 80); assert.equal(t.estado, "attacked");
  assert.equal(t.visual.texture, assetsNovoBoss.torreAttacked.chave);
  sistema.atualizar(399); assert.equal(t.visual.frame, 3); assert.equal(t.estado, "attacked");
  sistema.atualizar(1); assert.equal(t.estado, "idle");
  assert.equal(causarDanoAlvoAdicional(scene, t, 10), true);
  sistema.atualizar(100);
  assert.equal(causarDanoAlvoAdicional(scene, t, 10), true);
  assert.equal(t.visual.frame, 0); // Outro acerto reinicia a reação.
  for (const [i, torre] of encontro.geradores.entries()) {
    assert.equal(causarDanoAlvoAdicional(scene, torre, 1000), true);
    assert.equal(torre.estado, "death");
    assert.equal(torre.visual.texture, assetsNovoBoss.torreDeath.chave);
    assert.equal(torre.body.enable, false);
    assert.equal(encontro.barreiraAtiva, i < 3);
    assert.equal(causarDanoAlvoAdicional(scene, torre, 1000), false);
  }
  assert.equal(quedas, 1); assert.equal(destruidas, 4);
  assert.equal(criados.find(o => o.name === "novo-boss-barreira-colisao").body.enable, false);
  assert.deepEqual(alvosAdicionaisCombate(scene), []);
  sistema.atualizar(50000); assert.equal(t.estado, "death"); assert.equal(t.visual.frame, 0);
});

test("cinemática espera o início; sair pausa a animação e reentrar conserva o dano", () => {
  const { scene, encontro } = criarArenaTorres();
  encontro.introducaoBloqueada = true;
  const sistema = prepararGeradoresNovoBoss(scene, encontro), t = encontro.geradores[0];
  sistema.atualizar(8000); assert.equal(t.visual.visible, true); assert.equal(t.visual.frame, 0);
  assert.equal(t.body.enable, false);
  encontro.introducaoBloqueada = false;
  sistema.atualizar(800); assert.equal(t.visual.frame, 8);
  encontro.jogadorNaArena = false;
  sistema.atualizar(5000); assert.equal(t.visual.frame, 8); assert.equal(t.visible, false);
  encontro.jogadorNaArena = true;
  sistema.atualizar(800); assert.equal(t.estado, "idle");
  causarDanoAlvoAdicional(scene, t, 40);
  encontro.suspenso = true;
  sistema.atualizar(5000); assert.equal(t.estado, "attacked");
  encontro.suspenso = false;
  sistema.atualizar(400); assert.equal(t.estado, "idle"); assert.equal(t.vida, 80);
});

test("limpeza das torres é idempotente; configuração incompleta não cria proteção impossível", () => {
  const { scene, encontro, criados, colliders, obstaculoExtra } = criarArenaTorres();
  const sistema = prepararGeradoresNovoBoss(scene, encontro);
  sistema.destruir(); sistema.destruir();
  assert.ok(criados.every(o => o.destroyed)); assert.ok(colliders.every(o => o.destroyed));
  assert.deepEqual(encontro.obstaculosTeleporte, [obstaculoExtra]);
  assert.deepEqual(alvosAdicionaisCombate(scene), []);
  const ausente = criarArenaTorres();
  ausente.scene.textures.exists = () => false;
  assert.equal(prepararGeradoresNovoBoss(ausente.scene, ausente.encontro), false);
  assert.equal(ausente.encontro.pendencia, "assets-torres-indisponiveis");
  assert.equal(ausente.criados.length, 0);
});
