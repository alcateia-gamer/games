import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { novoBossConfig, areaCorpoNovoBoss } from "./NovoBossConfig.js";
import { prepararAtaquesNovoBoss } from "./NovoBossAtaques.js";
import { inicializarCombateNovoBoss, atualizarCombateNovoBoss } from "./NovoBossEstados.js";
import { sincronizarCorpoNovoBoss } from "./NovoBossTeleporte.js";
import { prepararIlusoesNovoBoss } from "./NovoBossIlusoes.js";
import { atualizarFasesNovoBoss } from "./NovoBossFases.js";

function preparar() {
  const objetos = [];
  function visual(x = 0, y = 0) {
    const objeto = { x, y, active: true, visible: true,
      setPosition(x, y) { Object.assign(this, { x, y }); return this; },
      setAlpha(alpha) { this.alpha = alpha; return this; },
      setVisible(visible) { this.visible = visible; return this; },
      setDepth() { return this; }, setName() { return this; },
      setOrigin() { return this; }, setScale() { return this; }, play() { return this; },
      clear() { return this; }, fillStyle() { return this; }, lineStyle() { return this; },
      fillCircle() { return this; }, strokeCircle() { return this; }, lineBetween() { return this; },
      beginPath() { return this; }, moveTo() { return this; }, lineTo() { return this; }, strokePath() { return this; },
      destroy() { this.active = false; },
    };
    objetos.push(objeto);
    return objeto;
  }
  const config = { ...novoBossConfig, ataques: { ...novoBossConfig.ataques, automatico: false } };
  const scene = { player: { active: true, x: -650, y: -5700 }, vida: 100,
    textures: { exists: () => false }, events: new EventEmitter(),
    collisionGroup: { getChildren: () => [] },
    physics: { add: { existing(objeto) {
      objeto.body = { moves: false, setAllowGravity() {}, setVelocity() {}, updateFromGameObject() {} };
    } } },
    add: { graphics: () => visual(), sprite: visual, circle: visual },
  };
  const sprite = visual(-1400, -5770);
  sprite.body = { enable: true, reset(x, y) { sprite.setPosition(x, y); },
    updateFromGameObject() { Object.assign(this, areaCorpoNovoBoss(config, sprite)); } };
  const encontro = { config, sprite, jogadorNaArena: true, estado: "posicionada",
    hitboxDano: { setTo(x, y, width, height) { Object.assign(this, { x, y, width, height }); } },
    rng: () => 0, obstaculosTeleporte: [] };
  Object.defineProperties(encontro, {
    x: { get: () => sprite.x }, y: { get: () => sprite.y },
    alvosIlusorios: { get: () => encontro.sistemaIlusoes?.alvos ?? [] },
  });
  prepararAtaquesNovoBoss(scene, encontro);
  inicializarCombateNovoBoss(scene, encontro);
  const inicios = [];
  scene.events.on("novo-boss:ataque-iniciado", evento => inicios.push(evento));
  return { scene, encontro, sprite, objetos, inicios,
    atualizar: delta => atualizarCombateNovoBoss(scene, encontro, delta) };
}

test("pulso padrão tem raio 310, aviso de 1500 ms e expansão de 450 ms", () => {
  const c = preparar();
  const pulso = c.encontro.config.ataques.pulsoRepulsao;
  assert.equal(pulso.raio, 310);
  assert.ok((pulso.raio / 145) ** 2 > 4);
  assert.equal(pulso.avisoMs, 1500);
  assert.equal(pulso.expansaoMs, 450);
  sincronizarCorpoNovoBoss(c.encontro, novoBossConfig.posicaoInicial);
  assert.equal(c.encontro.executarAtaque("pulso"), true);
  assert.equal(c.encontro.teleporte, null);
  assert.equal(c.encontro.ataqueAtual.duracao, 1950);
});

test("todos os pontos chegam ao centro antes de anunciar, preservando corpo e entidade", () => {
  for (const origem of novoBossConfig.teleporte.pontos) {
    const c = preparar();
    sincronizarCorpoNovoBoss(c.encontro, origem);
    const sprite = c.sprite, hitbox = c.encontro.hitboxDano;
    assert.equal(c.encontro.executarAtaque("pulso"), true);
    if (origem.id !== "centro") {
      assert.equal(c.encontro.estado, "teletransportando");
      assert.equal(c.encontro.ataqueAtual, null);
      assert.equal(c.inicios.length, 0);
      c.atualizar(249);
      assert.deepEqual([sprite.x, sprite.y], [origem.x, origem.y]);
      c.atualizar(250);
      assert.equal(sprite.body.enable, false);
      assert.equal(c.inicios.length, 0);
      c.atualizar(1);
    }
    assert.deepEqual([sprite.x, sprite.y], [-1080, -5810]);
    assert.equal(c.encontro.estado, "atacando");
    assert.equal(c.encontro.tempoAtaque, 0);
    assert.equal(c.encontro.ataquePendente, null);
    assert.equal(c.inicios.length, 1);
    assert.equal(c.encontro.sprite, sprite);
    assert.equal(c.encontro.hitboxDano, hitbox);
    for (const key of ["x", "y", "width", "height"]) assert.equal(sprite.body[key], hitbox[key]);
  }
});

test("centro ocupado não cria pulso nem teleporte parcial e mantém a boss visível", () => {
  const c = preparar();
  Object.assign(c.scene.player, novoBossConfig.posicaoInicial);
  assert.equal(c.encontro.executarAtaque("pulso"), false);
  assert.equal(c.encontro.teleporte, null);
  assert.equal(c.encontro.ataquePendente, null);
  assert.equal(c.inicios.length, 0);
  assert.equal(c.sprite.visible, true);
  assert.deepEqual([c.sprite.x, c.sprite.y], [-1400, -5770]);
});

test("centro ocupado durante desaparecimento ou reaparecimento cancela o pulso sem disparo fora do centro", () => {
  for (const antes of [200, 300]) {
    const c = preparar();
    c.encontro.executarAtaque("pulso");
    c.atualizar(antes);
    Object.assign(c.scene.player, novoBossConfig.posicaoInicial);
    c.atualizar(1000);
    assert.equal(c.encontro.ataqueAtual, null);
    assert.equal(c.encontro.ataquePendente, null);
    assert.equal(c.encontro.teleporte, null);
    assert.equal(c.encontro.teleportePendente, null);
    assert.equal(c.inicios.length, 0);
    assert.equal(c.sprite.body.enable, true);
    assert.equal(c.sprite.alpha, 1);
  }
});

test("cancelar o pedido durante a viagem impede uma explosão tardia", () => {
  const c = preparar();
  c.encontro.executarAtaque("pulso");
  c.atualizar(100);
  c.encontro.cancelarAtaque();
  c.atualizar(1000);
  assert.equal(c.encontro.ataquePendente, null);
  assert.equal(c.encontro.ataqueAtual, null);
  assert.equal(c.encontro.teleporte, null);
  assert.equal(c.inicios.length, 0);
});

test("delta grande conserva o excedente após a viagem e termina na abertura normal", () => {
  const grande = preparar(), pequeno = preparar();
  for (const c of [grande, pequeno]) c.encontro.executarAtaque("pulso");
  grande.atualizar(1000);
  for (let i = 0; i < 50; i++) pequeno.atualizar(20);
  for (const key of ["estado", "tempoAtaque", "relogioCombate"]) {
    assert.equal(grande.encontro[key], pequeno.encontro[key]);
  }
  assert.equal(grande.encontro.tempoAtaque, 500);
  grande.atualizar(1450);
  assert.equal(grande.encontro.estado, "vulneravel");
  assert.equal(grande.encontro.ataqueAtual, null);
});

test("deslocamento central conserva as três falsas e troca a ocupante do centro pela origem", () => {
  for (const cancelar of [false, true]) {
    const c = preparar();
    sincronizarCorpoNovoBoss(c.encontro, novoBossConfig.posicaoInicial);
    const sistema = c.encontro.sistemaIlusoes = prepararIlusoesNovoBoss(c.scene, c.encontro);
    assert.equal(sistema.iniciarQuatro(), true);
    const falsos = [...sistema.alvos];
    const origem = { x: c.encontro.x, y: c.encontro.y };
    c.encontro.executarAtaque("pulso");
    if (cancelar) c.encontro.cancelarAtaque();
    sistema.atualizar(100);
    assert.equal(sistema.ativo, true);
    c.atualizar(500);
    assert.deepEqual(sistema.alvos, falsos);
    assert.equal(sistema.snapshot().pontoVerdadeiro, "centro");
    assert.ok(falsos.some(alvo => alvo.x === origem.x && alvo.y === origem.y));
    assert.equal(new Set([`${c.encontro.x},${c.encontro.y}`,
      ...falsos.map(alvo => `${alvo.x},${alvo.y}`)]).size, 4);
    assert.ok(falsos.every(alvo => alvo.ataquesIlusorios.ativo === !cancelar));
  }
});

test("segunda fase segura a verdadeira durante o pulso e permanece parada na abertura", () => {
  const c = preparar();
  let movimentos = 0;
  Object.assign(c.encontro, { fase: 2, vida: 499,
    sistemaClones: { ativo: true, moverVerdadeira: () => movimentos++ } });
  c.encontro.executarAtaque("pulso");
  c.atualizar(500);
  atualizarFasesNovoBoss(c.scene, c.encontro, 20);
  assert.equal(movimentos, 0);
  c.atualizar(1950);
  atualizarFasesNovoBoss(c.scene, c.encontro, 20);
  assert.equal(movimentos, 0);
});

test("prioridade de pulso com centro ocupado usa o ataque previsto e não trava a sequência", () => {
  const c = preparar();
  c.encontro.config.ataques = { ...c.encontro.config.ataques, automatico: true, sequencia: ["chuva"] };
  sincronizarCorpoNovoBoss(c.encontro, { x: -1140, y: -5810 });
  Object.assign(c.scene.player, novoBossConfig.posicaoInicial);
  assert.equal(c.encontro.iniciarAtaqueAutomatico(), true);
  assert.equal(c.encontro.ataqueAtual.tipo, "chuvaRaios");
  assert.equal(c.encontro.ataquePendente, null);
});

test("espiral aguarda a chegada ao centro a partir dos quatro pontos antes de avisar ou emitir", () => {
  for (const origem of novoBossConfig.teleporte.pontos) {
    const c = preparar();
    sincronizarCorpoNovoBoss(c.encontro, origem);
    assert.equal(c.encontro.executarAtaque("lasers"), true);
    if (origem.id !== "centro") {
      assert.equal(c.encontro.ataquePendente.tipo, "lasers");
      c.atualizar(499);
      assert.equal(c.encontro.ataqueAtual, null);
      assert.equal(c.inicios.length, 0);
      c.atualizar(1);
    }
    assert.deepEqual([c.encontro.x, c.encontro.y], [-1080, -5810]);
    assert.equal(c.encontro.tempoAtaque, 0);
    assert.equal(c.encontro.ataqueAtual.tipo, "lasers");
    assert.equal(c.encontro.ataqueAtual.snapshot().emitidos, 0);
    assert.equal(c.inicios.length, 1);
    for (const key of ["x", "y", "width", "height"]) {
      assert.equal(c.sprite.body[key], c.encontro.hitboxDano[key]);
    }
  }
});

test("centro ocupado ou cancelamento durante viagem não disparam a espiral fora do centro", () => {
  for (const tempo of [0, 200, 300]) {
    const c = preparar();
    if (tempo) {
      c.encontro.executarAtaque("lasers");
      c.atualizar(tempo);
    }
    Object.assign(c.scene.player, novoBossConfig.posicaoInicial);
    if (!tempo) assert.equal(c.encontro.executarAtaque("lasers"), false);
    c.atualizar(1000);
    assert.equal(c.encontro.ataqueAtual, null);
    assert.equal(c.encontro.ataquePendente, null);
    assert.equal(c.inicios.length, 0);
    assert.equal(c.sprite.body.enable, true);
  }
  const c = preparar();
  c.encontro.executarAtaque("lasers");
  c.atualizar(100);
  c.encontro.cancelarAtaque();
  c.atualizar(1000);
  assert.equal(c.inicios.length, 0);
  assert.equal(c.encontro.teleporte, null);
  assert.equal(c.encontro.ataqueAtual, null);
});

test("espiral central preserva as três falsas sem sobreposição e compartilha o relógio", () => {
  const c = preparar();
  sincronizarCorpoNovoBoss(c.encontro, novoBossConfig.posicaoInicial);
  const sistema = c.encontro.sistemaIlusoes = prepararIlusoesNovoBoss(c.scene, c.encontro);
  assert.equal(sistema.iniciarQuatro(), true);
  const alvos = [...sistema.alvos];
  c.encontro.executarAtaque("lasers");
  sistema.atualizar(100);
  c.atualizar(1000);
  assert.equal(c.encontro.tempoAtaque, 500);
  assert.deepEqual(sistema.alvos, alvos);
  assert.equal(new Set([`${c.encontro.x},${c.encontro.y}`,
    ...alvos.map(a => `${a.x},${a.y}`)]).size, 4);
  for (const alvo of alvos) {
    const copia = alvo.ataquesIlusorios.snapshot();
    assert.equal(copia.tempo, 500);
    assert.equal(copia.execucao.duracaoDisparosMs, 10000);
    assert.equal(copia.execucao.quantidade, 156);
  }
});

test("segunda fase segura a verdadeira durante a espiral longa e preserva a abertura seguinte", () => {
  const c = preparar();
  let movimentos = 0;
  Object.assign(c.encontro, { fase: 2, vida: 499,
    sistemaClones: { ativo: true, moverVerdadeira: () => movimentos++ } });
  c.encontro.executarAtaque("lasers");
  c.atualizar(500);
  atualizarFasesNovoBoss(c.scene, c.encontro, 20);
  assert.equal(movimentos, 0);
  c.atualizar(c.encontro.ataqueAtual.duracao);
  assert.equal(c.encontro.estado, "vulneravel");
  atualizarFasesNovoBoss(c.scene, c.encontro, 20);
  assert.equal(movimentos, 0);
  assert.equal(c.encontro.projeteisBoss.length, 0);
});

test("invocar cinco tentáculos inicia outro ataque no mesmo turno e conserva os 18 segundos", () => {
  const c = preparar();
  c.encontro.config.ataques = { ...c.encontro.config.ataques,
    automatico: true, sequencia: ["tentaculos", "chuva"] };
  c.atualizar(c.encontro.config.combate.preparacaoMs);
  const armadilhas = c.encontro.tentaculosAtivos;
  assert.equal(armadilhas.snapshot().armadilhas.length, 5);
  assert.equal(armadilhas.snapshot().decorrido, 0);
  assert.equal(c.encontro.ataqueAtual.tipo, "chuvaRaios");
  assert.deepEqual(c.inicios.map(e => e.tipo), ["tentaculos", "chuva"]);
  c.encontro.config.ataques.automatico = false;
  c.atualizar(1000);
  assert.ok(armadilhas.snapshot().armadilhas.every(a => a.ativa));
  assert.equal(c.encontro.tempoAtaque, 1000);
  c.atualizar(17999);
  assert.equal(c.encontro.tentaculosAtivos, armadilhas);
  assert.equal(armadilhas.snapshot().decorrido, 18999);
  c.atualizar(1);
  assert.equal(c.encontro.tentaculosAtivos, null);
  assert.equal(armadilhas.snapshot().terminado, true);
});

test("armadilhas não acumulam outra onda nem bloqueiam a seleção do próximo ataque", () => {
  const c = preparar();
  assert.equal(c.encontro.executarAtaque("tentaculos"), true);
  const armadilhas = c.encontro.tentaculosAtivos;
  assert.equal(c.encontro.ataqueAtual, null);
  assert.equal(c.encontro.executarAtaque("tentaculos"), false);
  c.encontro.config.ataques = { ...c.encontro.config.ataques,
    automatico: true, sequencia: ["tentaculos", "chuva"] };
  assert.equal(c.encontro.iniciarAtaqueAutomatico(), true);
  assert.equal(c.encontro.ataqueAtual.tipo, "chuvaRaios");
  assert.equal(c.encontro.tentaculosAtivos, armadilhas);
  assert.equal(c.inicios.filter(e => e.tipo === "tentaculos").length, 1);
});

test("tentáculos reais e ilusórios continuam sincronizados durante e após outro ataque", () => {
  const c = preparar();
  sincronizarCorpoNovoBoss(c.encontro, novoBossConfig.posicaoInicial);
  const ilusoes = c.encontro.sistemaIlusoes = prepararIlusoesNovoBoss(c.scene, c.encontro);
  assert.equal(ilusoes.iniciarQuatro(), true);
  assert.equal(c.encontro.executarAtaque("tentaculos"), true);
  assert.equal(c.encontro.executarAtaque("chuva"), true);
  c.atualizar(1000);
  for (const alvo of ilusoes.alvos) {
    const s = alvo.ataquesIlusorios.snapshot();
    assert.equal(s.execucao.tipo, "chuvaRaios");
    assert.equal(s.persistentes.length, 1);
    assert.equal(s.persistentes[0].decorrido, c.encontro.tentaculosAtivos.snapshot().decorrido);
    assert.equal(s.persistentes[0].armadilhas.length, 5);
    assert.ok(s.persistentes[0].armadilhas.every(a => !a.capturou && !a.segurando));
  }
  c.atualizar(c.encontro.ataqueAtual.duracao - c.encontro.tempoAtaque);
  assert.equal(c.encontro.ataqueAtual, null);
  for (const alvo of ilusoes.alvos) {
    const s = alvo.ataquesIlusorios.snapshot();
    assert.equal(s.ativo, false);
    assert.equal(s.persistentes[0].decorrido, c.encontro.tentaculosAtivos.snapshot().decorrido);
  }
  c.encontro.cancelarAtaque();
  assert.equal(c.encontro.tentaculosAtivos, null);
  assert.ok(ilusoes.alvos.every(a => a.ataquesIlusorios.snapshot().objetos === 0));
});

test("teleporte e transição preservam armadilhas; cancelamento final limpa seus recursos", () => {
  const c = preparar();
  c.encontro.executarAtaque("tentaculos");
  const armadilhas = c.encontro.tentaculosAtivos;
  c.encontro.executarAtaque("pulso");
  assert.ok(c.encontro.teleporte);
  c.atualizar(500);
  assert.equal(armadilhas.snapshot().decorrido, 500);
  c.encontro.cancelarAtaque({ preservarTentaculos: true });
  assert.equal(c.encontro.tentaculosAtivos, armadilhas);
  assert.equal(armadilhas.snapshot().terminado, false);
  c.encontro.cancelarAtaque();
  c.encontro.cancelarAtaque();
  assert.equal(c.encontro.tentaculosAtivos, null);
  assert.ok(c.objetos.every(o => o === c.sprite || !o.active));
});
