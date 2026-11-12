import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { novoBossConfig } from "./NovoBossConfig.js";
import { criarAtaquesIlusoriosNovoBoss } from "./NovoBossAtaquesIlusorios.js";
import { prepararAtaquesNovoBoss } from "./NovoBossAtaques.js";
import { criarChuvaRaios } from "./ataques/ChuvaRaios.js";

function preparar() {
  const objetos = [];
  const proibido = () => { throw new Error("Um holograma chamou um sistema ofensivo."); };
  function visual(x = 0, y = 0, textura = null, frame = 0) {
    const objeto = { x, y, textura, frame, active: true, alpha: 1, destruicoes: 0,
      setDepth(depth) { this.depth = depth; return this; },
      setName(name) { this.name = name; return this; },
      setAlpha(alpha) { this.alpha = alpha; return this; },
      setTint(tint) { this.tint = tint; return this; },
      setOrigin() { return this; }, setScale() { return this; },
      setFrame(frame) { this.frame = frame; return this; },
      setTexture(chave, frame) { this.texture = { key: chave }; this.textura = chave; this.frame = frame; return this; },
      setRotation(rotation) { this.rotation = rotation; return this; },
      setVisible(visible) { this.visible = visible; return this; },
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      clear() { return this; }, lineStyle() { return this; }, fillStyle() { return this; },
      fillCircle() { return this; }, strokeCircle() { return this; },
      beginPath() { return this; }, moveTo() { return this; }, lineTo() { return this; },
      lineBetween() { return this; }, strokePath() { return this; },
      destroy() { this.active = false; this.destruicoes++; },
    };
    objetos.push(objeto);
    return objeto;
  }
  const scene = {
    vida: 100, player: { active: true, x: 150, y: 0, invulneravel: false,
      body: { x: 142, y: -8, width: 16, height: 16, velocity: { x: 0, y: 0 }, setVelocity: proibido } },
    textures: { exists: () => true },
    add: { graphics: () => visual(), circle: (x, y) => visual(x, y), sprite: visual },
    physics: { add: { existing: proibido } },
    collisionGroup: { getChildren: () => [] },
    tentarInterceptarLaserEspecial: proibido, acertarHologramaEspecial: proibido,
    events: new EventEmitter(), inimigos: [{ active: true, vida: 40 }],
  };
  const config = { ...novoBossConfig, arena: { xMin: -500, xMax: 500, yMin: -400, yMax: 400, entradaY: 350 } };
  const alvo = { id: "teste", active: true, config, x: 0, y: 0, sprite: { x: 0, y: 0 } };
  const encontro = { config, sprite: { active: true, x: -200, y: 0 }, x: -200, y: 0,
    jogadorNaArena: true, vida: 1000, projeteisBoss: [], obstaculosTeleporte: [],
    relogioCombate: 0, tempoAtaque: 0, rng: proibido, alvosIlusorios: [alvo] };
  const sistema = alvo.ataquesIlusorios = criarAtaquesIlusoriosNovoBoss(scene, encontro, alvo);
  const avancar = delta => {
    sistema.avancar(delta);
    encontro.relogioCombate += delta;
    sistema.atualizarEfeitos();
  };
  function semConsequencias() {
    assert.equal(scene.vida, 100);
    assert.equal(scene.player.invulneravel, false);
    assert.deepEqual(scene.player.body.velocity, { x: 0, y: 0 });
    assert.equal(scene.restricaoControleNovoBoss, undefined);
    assert.equal(encontro.vida, 1000);
    assert.equal(scene.inimigos[0].vida, 40);
    assert.deepEqual(encontro.projeteisBoss, []);
    for (const objeto of objetos) {
      assert.ok(objeto.novoBossAtaqueIlusorio);
      assert.equal(objeto.body, undefined);
      assert.ok(objeto.depth >= 51 && objeto.depth <= 53);
      if (objeto.textura === "novo-boss-area-ataque") {
        assert.ok(objeto.alpha >= 0.4 && objeto.alpha <= 0.600001);
        assert.equal(objeto.tint, 0xff6078);
      } else {
        assert.equal(objeto.alpha, 1);
        assert.equal(objeto.tint, undefined);
      }
    }
  }
  return { scene, encontro, alvo, sistema, objetos, avancar, semConsequencias };
}

test("pulso completo mantém raio e todos os oito quadros da explosão, sem dano ou repulsão", () => {
  const { sistema, objetos, avancar, semConsequencias } = preparar();
  assert.equal(sistema.iniciar("pulso", {}), true);
  assert.equal(sistema.snapshot().execucao.duracao, 1950);
  avancar(1499);
  assert.equal(objetos.filter(o => o.textura === "novo-boss-explosao").length, 0);
  avancar(1);
  const explosao = objetos.find(o => o.textura === "novo-boss-explosao");
  assert.ok(explosao);
  const quadros = [explosao.frame];
  avancar(80); quadros.push(explosao.frame);
  avancar(80); quadros.push(explosao.frame);
  avancar(80); quadros.push(explosao.frame);
  avancar(80); quadros.push(explosao.frame);
  avancar(80); quadros.push(explosao.frame);
  avancar(50); // Fim natural do pulso em 1950 ms.
  sistema.encerrar();
  assert.equal(explosao.active, true);
  avancar(30); quadros.push(explosao.frame);
  avancar(80); quadros.push(explosao.frame);
  assert.deepEqual(quadros, [0, 1, 2, 3, 4, 5, 6, 7]);
  avancar(80);
  assert.equal(explosao.active, false);
  assert.equal(sistema.snapshot().objetos, 0);
  semConsequencias();
});

test("Heavens Fury reproduz quinze marcas ampliadas, aviso, impacto e animação completa sem dano", () => {
  const { sistema, objetos, avancar, semConsequencias } = preparar();
  sistema.iniciar("chuva", {}, [0.2, 0.3, 0.7, 0.6]);
  assert.equal(sistema.snapshot().execucao.marcas.length, 15);
  assert.equal(sistema.snapshot().execucao.raio, 96);
  assert.equal(sistema.snapshot().execucao.escala, 1.28);
  avancar(1000);
  const raio = objetos.find(o => o.textura === "novo-boss-heavens-fury");
  assert.equal(raio.frame, 0);
  avancar(400);
  assert.equal(raio.frame, 4);
  avancar(6500);
  sistema.encerrar();
  assert.equal(sistema.snapshot().objetos, 0);
  semConsequencias();
});

test("espiral emite cem projéteis por dez segundos sem corpos, parry ou registro ofensivo", () => {
  const { sistema, objetos, avancar, semConsequencias } = preparar();
  sistema.iniciar("lasers", {});
  avancar(700);
  const primeiro = sistema.snapshot().execucao.projeteis[0];
  assert.deepEqual([primeiro.x, primeiro.y, primeiro.dx, primeiro.dy], [0, 0, 1, 0]);
  avancar(100);
  assert.equal(sistema.snapshot().execucao.emitidos, 2);
  assert.ok(Math.abs(sistema.snapshot().execucao.projeteis[0].x - 16) < 0.001);
  // Mesmo uma marcação externa indevida de reflexão não libera serviços de dano.
  const laser = objetos.find(o => o.name.includes("novo-boss-laser"));
  assert.equal(laser.especialLaserInimigo, false);
  assert.equal(laser.especialAtirador, null);
  laser.especialRefletido = true;
  laser.danoEspecial = 999;
  avancar(9899);
  assert.equal(sistema.snapshot().execucao.emitidos, 100);
  assert.equal(sistema.snapshot().execucao.emitindo, true);
  avancar(1);
  assert.equal(sistema.snapshot().execucao.emitindo, false);
  avancar(5500);
  sistema.encerrar();
  assert.equal(sistema.snapshot().objetos, 0);
  semConsequencias();
});

test("tentáculos reproduzem a quantidade local de armadilhas e nunca capturam nem liberam o jogador", () => {
  const { sistema, avancar, semConsequencias } = preparar();
  sistema.iniciar("tentaculos", {}, [0.2, 0.3, 0.7, 0.6]);
  assert.equal(sistema.snapshot().execucao.armadilhas.length, 5);
  avancar(1000);
  assert.ok(sistema.snapshot().execucao.armadilhas.every(a => a.ativa && !a.capturou && !a.segurando));
  avancar(17999);
  assert.ok(sistema.snapshot().execucao.armadilhas.every(a => !a.capturou && !a.segurando));
  avancar(1);
  sistema.encerrar();
  assert.equal(sistema.snapshot().objetos, 0);
  semConsequencias();
});

test("cancelamento e destruição removem só os recursos da cópia, inclusive explosões pendentes", () => {
  const { sistema, objetos, avancar, scene } = preparar();
  const outro = scene.add.graphics();
  sistema.iniciar("pulso", {});
  avancar(1500);
  sistema.cancelar();
  sistema.cancelar();
  sistema.destruir();
  sistema.destruir();
  assert.equal(outro.active, true);
  assert.ok(objetos.filter(o => o !== outro).every(o => !o.active && o.destruicoes === 1));
  assert.equal(sistema.snapshot().objetos, 0);
  assert.equal(sistema.snapshot().explosoes, 0);
  assert.equal(sistema.iniciar("chuva", {}), false);
});

test("frames longos e deltas inválidos não deixam efeitos expirados nem avançam fora do relógio", () => {
  for (const tipo of ["pulso", "chuva", "lasers", "tentaculos"]) {
    const { sistema, avancar, semConsequencias } = preparar();
    sistema.iniciar(tipo, {});
    for (const delta of [-1, NaN, Infinity]) sistema.avancar(delta);
    assert.equal(sistema.snapshot().tempo, 0);
    avancar(30000);
    sistema.encerrar();
    assert.equal(sistema.snapshot().objetos, 0);
    semConsequencias();
  }
});

test("controlador real inicia, avança e cancela cópias no mesmo relógio, sem consumir RNG extra", () => {
  const criar = comCopia => {
    const ctx = preparar();
    let sorteios = 0;
    ctx.encontro.rng = () => { sorteios++; return (sorteios * 0.37) % 1; };
    if (!comCopia) ctx.encontro.alvosIlusorios = [];
    prepararAtaquesNovoBoss(ctx.scene, ctx.encontro);
    assert.equal(ctx.encontro.executarAtaque("chuva"), true);
    return { ...ctx, sorteios: () => sorteios };
  };
  const real = criar(false);
  const copia = criar(true);
  assert.equal(copia.sorteios(), real.sorteios());
  assert.deepEqual(copia.encontro.ataqueAtual.snapshot().marcas, real.encontro.ataqueAtual.snapshot().marcas);
  assert.equal(copia.sistema.snapshot().ativo, true);
  assert.deepEqual(copia.sistema.snapshot().execucao.marcas, copia.encontro.ataqueAtual.snapshot().marcas);
  copia.encontro.avancarAtaque(500);
  assert.equal(copia.sistema.snapshot().tempo, copia.encontro.tempoAtaque);
  copia.encontro.cancelarAtaque();
  assert.equal(copia.sistema.snapshot().ativo, false);
  assert.equal(copia.sistema.snapshot().objetos, 0);
  assert.equal(copia.encontro.ataqueAtual, null);
});

test("tentáculos das cópias têm ciclo próprio e encerram junto da janela real", () => {
  const { scene, encontro, sistema } = preparar();
  encontro.rng = () => 0.3;
  prepararAtaquesNovoBoss(scene, encontro);
  encontro.executarAtaque("tentaculos");
  assert.equal(encontro.ataqueAtual, null);
  assert.equal(sistema.snapshot().persistentes.length, 1);
  encontro.avancarTentaculos(19000);
  assert.equal(encontro.tentaculosAtivos, null);
  assert.equal(sistema.snapshot().persistentes.length, 0);
  assert.equal(sistema.snapshot().ativo, false);
  assert.equal(sistema.snapshot().objetos, 0);
});

test("chuva das cópias usa o alvo anunciado pela verdadeira mesmo se o jogador mudar entre atualizações", () => {
  const { scene, encontro, sistema, avancar, semConsequencias } = preparar();
  const original = criarChuvaRaios({ player: scene.player }, encontro,
    encontro.config.ataques.chuvaRaios, { pontoLivre: () => true });
  sistema.iniciar("chuva", original);
  Object.assign(scene.player, { x: 220, y: 100 });
  Object.assign(scene.player.body, { x: 212, y: 92 });
  original.atualizar(400);
  Object.assign(scene.player, { x: -300, y: -100 });
  Object.assign(scene.player.body, { x: -308, y: -108 });
  avancar(400);
  assert.deepEqual(sistema.snapshot().execucao.marcas.map(m => [m.x, m.y]),
    original.snapshot().marcas.map(m => [m.x, m.y]));
  assert.equal(sistema.snapshot().execucao.marcas[1].x, 220);
  assert.equal(sistema.snapshot().execucao.marcas[2].x, null);
  original.atualizar(7500);
  avancar(7500);
  sistema.encerrar();
  assert.equal(sistema.snapshot().objetos, 0);
  semConsequencias();
});

test("cópia não inventa um alvo quando a verdadeira não encontra área livre", () => {
  const { scene, encontro, sistema, semConsequencias } = preparar();
  const original = criarChuvaRaios({ player: scene.player }, encontro,
    encontro.config.ataques.chuvaRaios, { pontoLivre: () => false });
  sistema.iniciar("chuva", original);
  assert.equal(sistema.snapshot().execucao.marcas[0].concluida, true);
  assert.equal(sistema.snapshot().execucao.marcas[0].x, null);
  assert.equal(sistema.snapshot().objetos, 0);
  sistema.cancelar(); original.destruir();
  semConsequencias();
});

test("cópia que encerra seus projéteis antes da fonte continua no mesmo relógio até o encerramento real", () => {
  const { encontro, sistema, avancar, semConsequencias } = preparar();
  encontro.config = { ...encontro.config, ataques: { ...encontro.config.ataques,
    lasersEspiral: { ...encontro.config.ataques.lasersEspiral, quantidade: 1,
      duracaoDisparosMs: 0, avisoMs: 0, vidaProjetilMs: 0 },
  } };
  sistema.iniciar("lasers", { duracao: 1000 });
  avancar(0);
  assert.equal(sistema.snapshot().execucao, null);
  assert.equal(sistema.snapshot().ativo, true);
  avancar(500);
  assert.equal(sistema.snapshot().tempo, 500);
  assert.equal(sistema.snapshot().objetos, 0);
  sistema.encerrar();
  avancar(100);
  assert.equal(sistema.snapshot().tempo, 500);
  assert.equal(sistema.snapshot().ativo, false);
  semConsequencias();
});
