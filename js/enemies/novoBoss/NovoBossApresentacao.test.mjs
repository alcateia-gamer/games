import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { assetsNovoBoss, criarAnimacoesNovoBoss } from "./NovoBossAssets.js";
import { novoBossConfig, areaCorpoNovoBoss } from "./NovoBossConfig.js";
import { COMBAT_FEEL } from "../../combat/CombatEffects.js";
import { causarDanoNovoBoss, inicializarCombateNovoBoss } from "./NovoBossEstados.js";
import { destinoValidoNovoBoss } from "./NovoBossTeleporte.js";
import {
  prepararApresentacaoNovoBoss,
  aplicarPoseNovoBoss,
  pontoNucleoNovoBoss,
  sincronizarAnimacoesAtaqueNovoBoss,
} from "./NovoBossApresentacao.js";

function preparar({ ataque = true } = {}) {
  const texturas = new Set([assetsNovoBoss.idle.chave]);
  const animacoes = new Set([assetsNovoBoss.idle.animacao]);
  if (ataque) {
    texturas.add(assetsNovoBoss.ataque.chave);
    animacoes.add(assetsNovoBoss.ataque.animacao);
  }
  const graficos = [];
  const scene = {
    vida: 100,
    events: new EventEmitter(),
    textures: { exists: chave => texturas.has(chave) },
    anims: { exists: chave => animacoes.has(chave) },
    add: { graphics() {
      const g = { visible: true, active: true, chamadas: [], destruicoes: 0,
        setName(nome) { this.nome = nome; return this; },
        setDepth(depth) { this.depth = depth; return this; },
        setVisible(valor) { this.visible = valor; return this; },
        clear() { this.chamadas = []; return this; },
        destroy() { this.active = false; this.destruicoes++; },
      };
      for (const metodo of ["lineStyle", "strokeCircle", "beginPath", "moveTo", "lineTo", "strokePath", "lineBetween"]) {
        g[metodo] = function (...args) { this.chamadas.push({ metodo, args }); return this; };
      }
      graficos.push(g);
      return g;
    } },
  };
  const sprite = {
    x: -1080, y: -5810, active: true, visible: true, alpha: 0.7,
    width: 288, height: 288, originX: 0.5, originY: 0.5,
    scaleX: novoBossConfig.visual.escala, scaleY: novoBossConfig.visual.escala,
    texturas: [], animacoes: [], limpezasTint: 0,
    setTexture(chave, frame) {
      this.texturas.push({ chave, frame });
      this.width = this.height = chave === assetsNovoBoss.ataque.chave ? 336 : 288;
      return this;
    },
    play(chave, ignorarSeTocando) { this.animacoes.push({ chave, ignorarSeTocando }); return this; },
    setOrigin(x, y) { this.originX = x; this.originY = y; return this; },
    setFlipX(valor) { this.flipX = valor; return this; },
    setTint(cor) { this.tint = cor; return this; },
    setTintMode(modo) { this.tintMode = modo; return this; },
    clearTint() { this.tint = null; this.limpezasTint++; return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; },
    setVisible(visible) { this.visible = visible; return this; },
  };
  sprite.body = {
    setSize(width, height) { this.widthLocal = width; this.heightLocal = height; return this; },
    setOffset(x, y) { this.offsetX = x; this.offsetY = y; return this; },
    updateFromGameObject() {
      Object.assign(this, {
        x: sprite.x + (this.offsetX - sprite.width * sprite.originX) * sprite.scaleX,
        y: sprite.y + (this.offsetY - sprite.height * sprite.originY) * sprite.scaleY,
        width: this.widthLocal * sprite.scaleX,
        height: this.heightLocal * sprite.scaleY,
      });
    },
  };
  const hitboxDano = { setTo(x, y, width, height) { Object.assign(this, { x, y, width, height }); } };
  const encontro = {
    config: { ...novoBossConfig, visual: { ...novoBossConfig.visual, efeitosGeometricosLegados: true } }, sprite, hitboxDano, estado: "preparando",
    jogadorNaArena: true, vida: 1000, vidaMaxima: 1000,
  };
  const sistema = prepararApresentacaoNovoBoss(scene, encontro);
  return { scene, encontro, sprite, sistema, graficos, texturas, animacoes };
}

function retangulo(objeto) {
  return Object.fromEntries(["x", "y", "width", "height"].map(chave => [chave, objeto[chave]]));
}

test("animações usam todos os quadros fornecidos e ataque toca uma vez a 16 fps", () => {
  const criadas = [];
  const existentes = new Set();
  const scene = {
    textures: { exists: () => true },
    anims: {
      exists: chave => existentes.has(chave),
      generateFrameNumbers: (chave, { start, end }) => Array.from({ length: end - start + 1 }, (_, frame) => ({ chave, frame: start + frame })),
      create(config) { existentes.add(config.key); criadas.push(config); },
    },
  };
  assert.equal(criarAnimacoesNovoBoss(scene), true);
  assert.equal(criadas.length, 2);
  assert.deepEqual(criadas.map(a => [a.frames.length, a.frameRate, a.repeat]), [[16, 10, -1], [48, 16, 0]]);
  assert.deepEqual(criadas[1].frames.at(-1), { chave: assetsNovoBoss.ataque.chave, frame: 47 });
  criarAnimacoesNovoBoss(scene);
  assert.equal(criadas.length, 2, "registros existentes são preservados");
});

test("troca idle/ataque mantém corpo e hitbox no mundo com margens diferentes", () => {
  const { scene, encontro, sprite } = preparar();
  const esperado = areaCorpoNovoBoss(encontro.config, sprite);
  const hitboxOriginal = encontro.hitboxDano;
  assert.equal(aplicarPoseNovoBoss(scene, encontro), "idle");
  assert.deepEqual(retangulo(sprite.body), esperado);
  assert.deepEqual(retangulo(encontro.hitboxDano), esperado);
  assert.equal(aplicarPoseNovoBoss(scene, encontro, {}), "ataque");
  assert.equal(sprite.originX * sprite.width, 162);
  assert.equal(sprite.originY * sprite.height, 192);
  assert.deepEqual([sprite.body.offsetX, sprite.body.offsetY], [106, 124]);
  assert.deepEqual(retangulo(sprite.body), esperado);
  assert.deepEqual(retangulo(encontro.hitboxDano), esperado);
  assert.equal(encontro.hitboxDano, hitboxOriginal, "armas mantêm a referência da hitbox");
  aplicarPoseNovoBoss(scene, encontro);
  assert.deepEqual([sprite.body.offsetX, sprite.body.offsetY], [88, 76]);
  assert.deepEqual(retangulo(sprite.body), esperado);
});

test("segue o jogador dos dois lados sem mover corpo ou hitbox, em idle e ataque", () => {
  const { scene, encontro, sprite } = preparar();
  const esperado = areaCorpoNovoBoss(encontro.config, sprite);
  const ataque = {};
  scene.player = { active: true, x: sprite.x + 100 };
  for (const execucao of [null, ataque, null, ataque]) {
    for (const esquerda of [false, true, false]) {
      scene.player.x = sprite.x + (esquerda ? -100 : 100);
      aplicarPoseNovoBoss(scene, encontro, execucao);
      assert.equal(sprite.flipX, esquerda);
      assert.ok(Math.abs(sprite.originX * sprite.width -
        (execucao ? (esquerda ? 174 : 162) : 144)) < 1e-8);
      assert.equal(sprite.body.offsetX, execucao ? (esquerda ? 118 : 106) : 88);
      assert.deepEqual(retangulo(sprite.body), esperado);
      assert.deepEqual(retangulo(encontro.hitboxDano), esperado);
      const nucleo = pontoNucleoNovoBoss(encontro);
      assert.equal(nucleo.x, sprite.x + (esquerda ? -3.3 : 3.3));
      assert.equal(nucleo.y, sprite.y - 13.2);
    }
  }
});

test("virar durante a mesma execução preserva a animação e seus quadros", () => {
  const { scene, encontro, sprite } = preparar();
  const ataque = {};
  scene.player = { active: true, x: sprite.x + 100 };
  aplicarPoseNovoBoss(scene, encontro, ataque);
  for (let i = 0; i < 12; i++) {
    scene.player.x = sprite.x + (i % 2 === 0 ? -100 : 100);
    aplicarPoseNovoBoss(scene, encontro, ataque);
  }
  assert.equal(sprite.texturas.length, 1);
  assert.equal(sprite.animacoes.length, 1);
});

test("mesmo X e jogador ausente, inválido ou morto conservam a última direção", () => {
  const { scene, encontro, sprite } = preparar();
  for (const esquerda of [true, false]) {
    scene.player = { active: true, x: sprite.x + (esquerda ? -1 : 1) };
    aplicarPoseNovoBoss(scene, encontro);
    for (const jogador of [
      { active: true, x: sprite.x }, undefined, { active: false, x: sprite.x + (esquerda ? 100 : -100) },
      { active: true, morto: true, x: sprite.x + (esquerda ? 100 : -100) },
      { active: true, x: NaN }, { active: true, x: Infinity },
    ]) {
      scene.player = jogador;
      aplicarPoseNovoBoss(scene, encontro);
      assert.equal(sprite.flipX, esquerda);
    }
  }
});

test("a mesma execução não reinicia a animação a cada atualização", () => {
  const { encontro, sprite, sistema } = preparar();
  encontro.estado = "atacando";
  encontro.ataqueAtual = {};
  for (let i = 0; i < 20; i++) sistema.atualizar(33);
  assert.equal(sprite.animacoes.length, 1);
  assert.equal(sprite.texturas.length, 1);
  assert.deepEqual(sprite.animacoes[0], { chave: assetsNovoBoss.ataque.animacao, ignorarSeTocando: false });
  encontro.ataqueAtual = {};
  sistema.atualizar(16);
  assert.equal(sprite.animacoes.length, 2, "outra execução reinicia o ataque mesmo sem pose intermediária");
  encontro.estado = "vulneravel";
  sistema.atualizar(16);
  assert.equal(sprite.animacoes.at(-1).chave, assetsNovoBoss.idle.animacao);
});

test("cópias acompanham quadro, relógio e fim do ataque sem reiniciar a animação", () => {
  const { scene, encontro, sprite } = preparar();
  const animacao = { key: assetsNovoBoss.ataque.animacao };
  sprite.anims = { currentAnim: animacao };
  encontro.estado = "atacando";
  encontro.ataqueAtual = {};
  const copias = Array.from({ length: 3 }, () => {
    const { encontro: alvo } = preparar();
    alvo.active = alvo.visible = true;
    alvo.sprite.anims = { currentAnim: animacao, currentFrame: null,
      setCurrentFrame(frame) { this.currentFrame = frame; } };
    return alvo;
  });
  encontro.alvosIlusorios = copias;
  for (const indice of [0, 1, 8, 25, 47]) {
    Object.assign(sprite.anims, { currentFrame: { index: indice }, accumulator: 17,
      nextTick: 62.5, isPlaying: indice < 47 });
    sincronizarAnimacoesAtaqueNovoBoss(scene, encontro);
    for (const alvo of copias) {
      const anims = alvo.sprite.anims;
      assert.equal(anims.currentFrame, sprite.anims.currentFrame);
      assert.equal(anims.accumulator, 17);
      assert.equal(anims.nextTick, 62.5);
      assert.equal(anims.isPlaying, indice < 47);
      assert.equal(alvo.sprite.animacoes.length, 1);
      assert.deepEqual(retangulo(alvo.sprite.body), areaCorpoNovoBoss(alvo.config, alvo.sprite));
    }
  }
  // Uma cópia que entra durante o ataque adota imediatamente o quadro atual.
  const { encontro: tardia } = preparar();
  Object.assign(tardia, { active: true, visible: true });
  tardia.sprite.anims = { currentAnim: animacao, setCurrentFrame(frame) { this.currentFrame = frame; } };
  encontro.alvosIlusorios.push(tardia);
  sincronizarAnimacoesAtaqueNovoBoss(scene, encontro);
  assert.equal(tardia.sprite.anims.currentFrame, sprite.anims.currentFrame);
  assert.equal(tardia.sprite.anims.isPlaying, false);
});

test("sincronização ignora alvos removidos, ocultos e encontros sem ataque", () => {
  const { scene, encontro, sprite } = preparar();
  const animacao = { key: assetsNovoBoss.ataque.animacao };
  sprite.anims = { currentAnim: animacao, currentFrame: { index: 5 } };
  const { encontro: alvo } = preparar();
  encontro.alvosIlusorios = [alvo];
  encontro.estado = "atacando";
  encontro.ataqueAtual = {};
  for (const valores of [{ active: false, visible: true }, { active: true, visible: false }]) {
    Object.assign(alvo, valores);
    sincronizarAnimacoesAtaqueNovoBoss(scene, encontro);
    assert.equal(alvo.sprite.animacoes.length, 0);
  }
  Object.assign(alvo, { active: true, visible: true });
  encontro.ataqueAtual = null;
  sincronizarAnimacoesAtaqueNovoBoss(scene, encontro);
  assert.equal(alvo.sprite.animacoes.length, 0);
});

test("núcleo permanece no mesmo ponto do capuz ao trocar folha e acompanha o mundo", () => {
  const { scene, encontro, sprite } = preparar();
  aplicarPoseNovoBoss(scene, encontro);
  const idle = pontoNucleoNovoBoss(encontro);
  assert.deepEqual(idle, { x: sprite.x + 6 * 0.55, y: sprite.y - 24 * 0.55 });
  aplicarPoseNovoBoss(scene, encontro, {});
  assert.deepEqual(pontoNucleoNovoBoss(encontro), idle);
  sprite.x += 50;
  sprite.y -= 70;
  assert.deepEqual(pontoNucleoNovoBoss(encontro), { x: idle.x + 50, y: idle.y - 70 });
});

test("ausência da folha ou da animação de ataque mantém idle funcional", () => {
  for (const ausencia of ["textura", "animacao"]) {
    const { scene, encontro, sprite, texturas, animacoes } = preparar();
    if (ausencia === "textura") texturas.delete(assetsNovoBoss.ataque.chave);
    else animacoes.delete(assetsNovoBoss.ataque.animacao);
    assert.equal(aplicarPoseNovoBoss(scene, encontro, {}), "idle");
    assert.equal(sprite.texturas[0].chave, assetsNovoBoss.idle.chave);
    assert.deepEqual(retangulo(sprite.body), areaCorpoNovoBoss(encontro.config, sprite));
  }
  const { scene } = preparar();
  scene.textures.exists = () => false;
  assert.equal(criarAnimacoesNovoBoss(scene), false);
});

test("flash de dano preenche de branco pelo mesmo tempo dos outros inimigos", t => {
  const anterior = globalThis.Phaser;
  globalThis.Phaser = { TintModes: { FILL: 1 } };
  t.after(() => { globalThis.Phaser = anterior; });
  const { scene, encontro, sprite, sistema } = preparar();
  scene.events.emit("novo-boss:vida", { encontro: {}, anterior: 1000, vida: 900 });
  scene.events.emit("novo-boss:vida", { encontro, anterior: 900, vida: 1000 });
  assert.equal(sistema.snapshot().flashRestante, 0);
  scene.events.emit("novo-boss:vida", { encontro, anterior: 1000, vida: 900 });
  assert.equal(sprite.tint, 0xffffff);
  assert.equal(sprite.tintMode, globalThis.Phaser.TintModes.FILL);
  sistema.atualizar(COMBAT_FEEL.hitFlashDuration - 1);
  assert.equal(sistema.snapshot().flashRestante, 1);
  assert.equal(sprite.tint, 0xffffff);
  sistema.atualizar(1);
  assert.equal(sistema.snapshot().flashRestante, 0);
  assert.equal(sprite.tint, null);
  encontro.morto = true;
  scene.events.emit("novo-boss:vida", { encontro, anterior: 900, vida: 0 });
  assert.equal(sistema.snapshot().flashRestante, 0);
});

test("golpe aceito recua para longe do jogador e mantém corpo e hitbox sincronizados", () => {
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const { scene, encontro, sprite, sistema } = preparar();
    scene.player = { active: true, x: sprite.x - dx * 200, y: sprite.y - dy * 200 };
    aplicarPoseNovoBoss(scene, encontro);
    inicializarCombateNovoBoss(scene, encontro);
    const origem = { x: sprite.x, y: sprite.y }, hitbox = encontro.hitboxDano;
    encontro.barreiraAtiva = true;
    assert.equal(causarDanoNovoBoss(scene, encontro, 25), false);
    assert.equal(sistema.snapshot().recuoRestante, 0, "o escudo não provoca reação de dano");
    encontro.barreiraAtiva = false;
    assert.equal(causarDanoNovoBoss(scene, encontro, 25), true);
    assert.equal(encontro.vida, 975);
    sistema.atualizarRecuo(30);
    sistema.atualizarRecuo(30);
    sistema.atualizarRecuo(1000);
    const distancia = COMBAT_FEEL.knockback * COMBAT_FEEL.knockbackDuration / 1000 * encontro.config.combate.fatorRecuo;
    assert.ok(distancia < 2, "o peso do boss limita o recuo a menos de dois pixels");
    assert.ok(Math.abs(sprite.x - origem.x - dx * distancia) < 1e-8);
    assert.ok(Math.abs(sprite.y - origem.y - dy * distancia) < 1e-8);
    assert.equal(sistema.snapshot().recuoRestante, 0);
    assert.equal(sistema.recuouNesteQuadro, true, "a caminhada não anula o último quadro do impulso");
    sistema.atualizarRecuo(30);
    assert.equal(sistema.recuouNesteQuadro, false);
    assert.equal(encontro.hitboxDano, hitbox);
    assert.deepEqual(retangulo(sprite.body), retangulo(hitbox));
    assert.equal(encontro.estado, "preparando", "o recuo não troca o estado do combate");
  }
});

test("recuo curto respeita paredes finas, geradores e a borda da arena", () => {
  for (const obstaculo of ["parede", "gerador", "borda"]) {
    const { scene, encontro, sprite, sistema } = preparar();
    if (obstaculo === "borda") sprite.x = encontro.config.arena.xMax - 31.8;
    scene.player = { active: true, x: sprite.x - 200, y: sprite.y };
    aplicarPoseNovoBoss(scene, encontro);
    const area = areaCorpoNovoBoss(encontro.config, sprite);
    const bloqueio = { body: { x: area.x + area.width + 0.75, y: area.y - 10,
      width: 1, height: area.height + 20, enable: true } };
    if (obstaculo === "parede") scene.collisionGroup = { getChildren: () => [bloqueio] };
    if (obstaculo === "gerador") encontro.obstaculosTeleporte = [bloqueio];
    const origemX = sprite.x;
    scene.events.emit("novo-boss:vida", { encontro, anterior: 1000, vida: 975 });
    sistema.atualizarRecuo(1000);
    assert.ok(sprite.x - origemX <= 0.75, "para antes do obstáculo mesmo com delta alto");
    assert.equal(destinoValidoNovoBoss(scene, encontro, sprite), true);
    assert.deepEqual(retangulo(sprite.body), retangulo(encontro.hitboxDano));
  }
});

test("teleporte, morte, suspensão e limpeza cancelam o impulso sem deslocamentos tardios", () => {
  for (const cancelar of [
    c => { c.encontro.teleporte = {}; },
    c => { c.encontro.suspenso = true; },
    c => { c.encontro.jogadorNaArena = false; },
    c => { c.scene.morteEmAndamento = true; },
    c => { c.encontro.morto = true; c.scene.events.emit("novo-boss:derrotada", { encontro: c.encontro }); },
    c => c.sistema.destruir(),
  ]) {
    const c = preparar();
    c.scene.player = { active: true, x: c.sprite.x - 200, y: c.sprite.y };
    c.scene.events.emit("novo-boss:vida", { encontro: c.encontro, anterior: 1000, vida: 975 });
    assert.equal(c.sistema.snapshot().recuoRestante, COMBAT_FEEL.knockbackDuration);
    const origem = { x: c.sprite.x, y: c.sprite.y };
    cancelar(c);
    c.sistema.atualizarRecuo(1000);
    assert.deepEqual({ x: c.sprite.x, y: c.sprite.y }, origem);
    assert.equal(c.sistema.snapshot().recuoRestante, 0);
  }
});

test("entrada na fase 2 desenha explosão por 900 ms sem mudar o estado de combate", () => {
  const { scene, encontro, sprite, sistema, graficos } = preparar();
  scene.events.emit("novo-boss:fase-alterada", { encontro: {}, fase: 2 });
  scene.events.emit("novo-boss:fase-alterada", { encontro, fase: 1 });
  assert.equal(sistema.snapshot().burstRestante, 0);
  scene.events.emit("novo-boss:fase-alterada", { encontro, fase: 2 });
  sistema.atualizar(0);
  assert.equal(sistema.snapshot().burstRestante, 900);
  assert.equal(graficos[0].depth, 50.5);
  assert.equal(graficos[0].chamadas.filter(c => c.metodo === "lineBetween").length, 9);
  const primeira = graficos[0].chamadas.find(c => c.metodo === "strokeCircle");
  assert.deepEqual(primeira.args, [sprite.x, sprite.y, 18]);
  sistema.atualizar(899);
  assert.equal(sistema.snapshot().burstRestante, 1);
  sistema.atualizar(1);
  assert.equal(sistema.snapshot().burstRestante, 0);
  assert.equal(graficos[0].chamadas.length, 0);
  assert.equal(sistema.snapshot().graficoVisivel, false);
  assert.equal(encontro.estado, "preparando");
  assert.equal(sprite.alpha, 0.7);
});

test("anéis de teleporte respeitam origem/destino sem alterar alpha nem física", () => {
  const { encontro, sprite, sistema, graficos } = preparar();
  encontro.estado = "teletransportando";
  encontro.teleporte = { etapa: "desaparecendo", decorrido: 125,
    origem: { x: -1080, y: -5810 }, destino: { x: -1400, y: -5770 } };
  sistema.atualizar(16);
  const circulos = graficos[0].chamadas.filter(c => c.metodo === "strokeCircle");
  assert.equal(circulos.length, 3);
  assert.deepEqual(circulos[0].args, [-1080, -5775, 23.5]);
  assert.deepEqual(circulos[1].args.slice(0, 2), [-1400, -5735]);
  assert.equal(sprite.alpha, 0.7);
  assert.deepEqual([sprite.x, sprite.y], [-1080, -5810]);
  assert.equal(encontro.teleporte.decorrido, 125);
  encontro.teleporte.etapa = "aguardando-destino";
  encontro.teleporte.destino = null;
  sistema.atualizar(16);
  assert.equal(graficos[0].chamadas.filter(c => c.metodo === "strokeCircle").length, 1);
});

test("concluir teleporte oculta o gráfico residual ao voltar à preparação", () => {
  const { encontro, sistema, graficos } = preparar();
  encontro.estado = "teletransportando";
  encontro.teleporte = { etapa: "reaparecendo", decorrido: 200,
    origem: { x: -1080, y: -5810 }, destino: { x: -1400, y: -5770 } };
  sistema.atualizar(16);
  assert.equal(sistema.snapshot().graficoVisivel, true);
  encontro.teleporte = null;
  encontro.estado = "preparando";
  sistema.atualizar(16);
  assert.equal(sistema.snapshot().graficoVisivel, false);
  assert.equal(graficos[0].chamadas.length, 0);
});

test("abertura e proteção dos clones não criam marcadores exclusivos no chão", () => {
  for (const protegida of [false, true]) {
    const { encontro, sistema, graficos } = preparar();
    encontro.estado = "vulneravel";
    encontro.barreiraAtiva = false;
    encontro.relogioCombate = 100;
    encontro.invulneravelClonesAte = protegida ? 2100 : 0;
    sistema.atualizar(16);
    assert.equal(graficos.length, 0);
    assert.equal(sistema.snapshot().graficoVisivel, false);
  }
});

test("efeitos ficam ocultos fora da arena, em multiplayer, suspensão ou morte do jogador", () => {
  for (const desativar of [
    ({ encontro }) => { encontro.jogadorNaArena = false; },
    ({ scene }) => { scene.multiplayer = true; },
    ({ encontro }) => { encontro.suspenso = true; },
    ({ encontro }) => { encontro.encerrado = true; },
    ({ scene }) => { scene.morteEmAndamento = true; },
    ({ scene }) => { scene.vida = 0; },
  ]) {
    const c = preparar();
    c.scene.events.emit("novo-boss:fase-alterada", { encontro: c.encontro, fase: 2 });
    c.sistema.atualizar(0);
    assert.equal(c.sistema.snapshot().graficoVisivel, true);
    desativar(c);
    c.sistema.atualizar(16);
    assert.equal(c.sistema.snapshot().graficoVisivel, false);
    assert.equal(c.graficos[0].chamadas.length, 0);
  }
});

test("derrota preserva corpo opaco mesmo sem pose própria e ignora eventos duplicados", () => {
  const { scene, encontro, sprite, sistema } = preparar();
  encontro.morto = true;
  sprite.alpha = 0.35;
  scene.events.emit("novo-boss:derrotada", { encontro: {} });
  assert.equal(sistema.snapshot().derrotaDecorrido, null);
  scene.events.emit("novo-boss:derrotada", { encontro });
  sistema.atualizar(450);
  assert.equal(sprite.alpha, 1);
  assert.equal(sprite.visible, true);
  scene.events.emit("novo-boss:derrotada", { encontro });
  sistema.atualizar(449);
  assert.equal(sistema.snapshot().derrotaDecorrido, 899);
  assert.equal(sprite.visible, true);
  sistema.atualizar(1);
  sistema.atualizar(60000);
  assert.equal(sprite.alpha, 1);
  assert.equal(sprite.visible, true);
  assert.equal(sistema.snapshot().graficoVisivel, false);
});

test("pose de morte fornecida permanece na sala com direção preservada e física desativada", () => {
  for (const flipX of [false, true]) {
    const { scene, encontro, sprite, sistema, texturas } = preparar();
    texturas.add(assetsNovoBoss.morte.chave);
    sprite.flipX = flipX;
    sprite.body.enable = false;
    encontro.morto = true;
    scene.events.emit("novo-boss:derrotada", { encontro });
    assert.equal(sprite.texturas.at(-1).chave, assetsNovoBoss.morte.chave);
    assert.equal(sprite.originX, flipX ? 1 - 105 / 216 : 105 / 216);
    assert.equal(sprite.originY, 86 / 216);
    sistema.atualizar(600);
    assert.equal(sprite.alpha, 1);
    scene.events.emit("novo-boss:derrotada", { encontro });
    sistema.atualizar(150);
    assert.equal(sprite.alpha, 1);
    assert.equal(sprite.body.enable, false);
    assert.equal(sprite.flipX, flipX);
    sistema.atualizar(150);
    sistema.atualizar(60000);
    assert.equal(sprite.visible, true);
    assert.equal(sprite.alpha, 1);
    assert.equal(sistema.snapshot().poseMorte, true);
  }
});

test("deltas inválidos e sprite inativo não avançam os relógios visuais", () => {
  const { scene, encontro, sprite, sistema } = preparar();
  scene.events.emit("novo-boss:vida", { encontro, anterior: 1000, vida: 900 });
  for (const delta of [NaN, Infinity, -1]) sistema.atualizar(delta);
  assert.equal(sistema.snapshot().flashRestante, COMBAT_FEEL.hitFlashDuration);
  sprite.active = false;
  sistema.atualizar(180);
  assert.equal(sistema.snapshot().flashRestante, COMBAT_FEEL.hitFlashDuration);
});

test("preparo e limpeza são idempotentes e removem somente recursos e listeners próprios", () => {
  const { scene, encontro, sprite, sistema, graficos } = preparar();
  assert.equal(prepararApresentacaoNovoBoss(scene, encontro), sistema);
  let chamadasExternas = 0;
  const externo = () => { chamadasExternas++; };
  for (const evento of ["novo-boss:vida", "novo-boss:fase-alterada", "novo-boss:derrotada"]) {
    scene.events.on(evento, externo);
    assert.equal(scene.events.listenerCount(evento), 2);
  }
  scene.events.emit("novo-boss:fase-alterada", { encontro, fase: 2 });
  sistema.atualizar(0);
  scene.events.emit("novo-boss:vida", { encontro, anterior: 1000, vida: 900 });
  sistema.destruir();
  sistema.destruir();
  assert.equal(encontro.apresentacao, null);
  assert.equal(sistema.snapshot().destruido, true);
  assert.equal(graficos[0].destruicoes, 1);
  assert.equal(sprite.active, true, "o dono do encontro mantém o ciclo de vida do sprite");
  assert.equal(sprite.tint, null);
  for (const evento of ["novo-boss:vida", "novo-boss:fase-alterada", "novo-boss:derrotada"]) {
    assert.deepEqual(scene.events.listeners(evento), [externo]);
    scene.events.emit(evento, { encontro, anterior: 1000, vida: 900, fase: 2 });
  }
  assert.equal(chamadasExternas, 5);
  sistema.atualizar(900);
  assert.equal(graficos[0].destruicoes, 1);
  assert.equal(sistema.snapshot().flashRestante, 0);
  assert.equal(sistema.snapshot().pose, null);
});

test("produção não desenha geometria antiga ao clonar ou teletransportar", () => {
  const { scene, encontro, sistema, graficos } = preparar();
  encontro.config = novoBossConfig;
  scene.events.emit("novo-boss:fase-alterada", { encontro, fase: 2 });
  encontro.teleporte = { etapa: "desaparecendo", decorrido: 125,
    origem: { x: -1080, y: -5810 }, destino: { x: -1400, y: -5810 } };
  sistema.atualizar(16);
  assert.equal(sistema.snapshot().graficoVisivel, false);
  assert.equal(graficos.length, 0);
});
