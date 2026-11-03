import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { novoBossConfig, areaCorpoNovoBoss } from "./NovoBossConfig.js";
import { prepararFasesNovoBoss, atualizarFasesNovoBoss } from "./NovoBossFases.js";
import {
  inicializarCombateNovoBoss, atualizarCombateNovoBoss, causarDanoNovoBoss,
} from "./NovoBossEstados.js";
import { sincronizarCorpoNovoBoss } from "./NovoBossTeleporte.js";
import { prepararAtaquesNovoBoss } from "./NovoBossAtaques.js";

function preparar(opcoes = {}) {
  const config = { ...novoBossConfig,
    // Isola a ordem dos eventos da fase com o limite mínimo configurável.
    combate: { ...novoBossConfig.combate, janelaVulneravelMs: 2500, acertosPorAbertura: 1, intervaloAcertosMs: 0 },
    ataques: { ...novoBossConfig.ataques, ativo: false },
    geradores: { ...novoBossConfig.geradores, ativo: false },
    fase2: { ativo: true, limiarVida: 0.5, ...opcoes.fase2 },
  };
  const scene = { player: { active: true, x: -1080, y: -5500 }, vida: 100,
    events: new EventEmitter(), collisionGroup: { getChildren: () => [] } };
  const sprite = { ...config.posicaoInicial, active: true, visible: true, alpha: 1,
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; },
    anims: { pause() {} },
    body: { enable: true,
      reset(x, y) { sprite.x = x; sprite.y = y; },
      updateFromGameObject() { Object.assign(this, areaCorpoNovoBoss(config, sprite)); },
    },
  };
  const hitbox = { setTo(x, y, width, height) { Object.assign(this, { x, y, width, height }); return this; } };
  const chamadas = { iniciar: 0, cancelarAtaque: 0, encerrarQuatro: 0, mover: [], fases: [] };
  let permitirClones = true;
  const encontro = { config, sprite, active: true, estado: "posicionada", jogadorNaArena: true,
    hitboxDano: hitbox, hitbox, barreiraAtiva: false,
    sistemaIlusoes: { encerrarQuatro() { chamadas.encerrarQuatro++; }, destruir() {} },
    sistemaClones: { ativo: false,
      moverVerdadeira(delta) {
        // O contrato do módulo Clones também recusa movimento durante a viagem.
        if (encontro.teleporte) return false;
        chamadas.mover.push(delta);
        sincronizarCorpoNovoBoss(encontro, { x: sprite.x + delta * 0.01, y: sprite.y });
      },
      cancelar() { this.ativo = false; },
      destruir() { this.ativo = false; },
    },
    cancelarAtaque() {
      chamadas.cancelarAtaque++;
      this.ataqueAtual = null;
      scene.restricaoControleNovoBoss = null;
      if (this.estado === "atacando") { this.estado = "preparando"; this.tempoEstado = 0; }
    },
    iniciarClones() {
      chamadas.iniciar++;
      if (!permitirClones || this.teleporte || this.ataqueAtual) return false;
      this.sistemaClones.ativo = true;
      return true;
    },
    iniciarAtaqueAutomatico: () => false,
  };
  Object.defineProperties(encontro, { x: { get: () => sprite.x }, y: { get: () => sprite.y } });
  scene.novoBoss = encontro;
  scene.events.on("novo-boss:fase-alterada", evento => chamadas.fases.push(evento));
  inicializarCombateNovoBoss(scene, encontro);
  prepararFasesNovoBoss(scene, encontro);
  return { scene, encontro, sprite, chamadas,
    permitirClones: valor => { permitirClones = valor; },
    atualizar: delta => atualizarFasesNovoBoss(scene, encontro, delta),
    atualizarCombate: delta => atualizarCombateNovoBoss(scene, encontro, delta),
  };
}

test("fase inicial e limiar são estritos: 500 permanece em 1; 499 inicia a fase 2 uma vez", () => {
  const c = preparar();
  assert.equal(c.encontro.fase, 1);
  assert.equal(c.encontro.transicaoFase2Pendente, false);
  assert.equal(c.encontro.clonesFase2Executados, false);
  assert.equal(typeof c.encontro.verificarFase, "function");
  c.encontro.vida = 500;
  c.atualizar(0);
  assert.equal(c.encontro.fase, 1);
  assert.equal(c.chamadas.fases.length, 0);
  c.encontro.vida = 499;
  c.atualizar(0);
  assert.equal(c.encontro.fase, 2);
  assert.equal(c.encontro.clonesFase2Executados, true);
  assert.equal(c.encontro.transicaoFase2Pendente, false);
  assert.equal(c.chamadas.iniciar, 1);
  assert.equal(c.chamadas.fases.length, 1);
  c.atualizar(50);
  c.encontro.verificarFase();
  assert.equal(c.chamadas.iniciar, 1);
  assert.equal(c.chamadas.fases.length, 1);
});

test("transição cancela ataque e contenção anteriores e encerra as quatro aparições", () => {
  const c = preparar();
  c.scene.restricaoControleNovoBoss = { fonte: "tentaculo", restanteMs: 2000 };
  c.encontro.ataqueAtual = { tipo: "tentaculos" };
  c.encontro.vida = 499;
  c.atualizar(0);
  assert.equal(c.encontro.ataqueAtual, null);
  assert.equal(c.scene.restricaoControleNovoBoss, null);
  assert.equal(c.chamadas.cancelarAtaque, 1);
  assert.equal(c.chamadas.encerrarQuatro, 1);
  assert.equal(c.chamadas.fases.length, 1);
  assert.equal(c.encontro.vida, 499);
  c.atualizar(100);
  assert.equal(c.chamadas.cancelarAtaque, 1);
});

test("falha temporária ao iniciar clones mantém a transição pendente e tenta novamente", () => {
  const c = preparar();
  c.permitirClones(false);
  c.encontro.vida = 499;
  c.atualizar(0);
  assert.equal(c.encontro.fase, 2);
  assert.equal(c.encontro.transicaoFase2Pendente, true);
  assert.equal(c.encontro.clonesFase2Executados, false);
  assert.equal(c.chamadas.iniciar, 1);
  c.permitirClones(true);
  c.atualizarCombate(500);
  c.atualizar(0);
  assert.equal(c.chamadas.iniciar, 2);
  assert.equal(c.encontro.transicaoFase2Pendente, false);
  assert.equal(c.encontro.clonesFase2Executados, true);
  assert.equal(c.chamadas.fases.length, 1);
});

test("acerto que cruza o limiar conserva o teletransporte reativo antes dos clones", () => {
  const c = preparar();
  const hitbox = c.encontro.hitboxDano;
  c.atualizarCombate(1500);
  assert.equal(c.encontro.estado, "vulneravel");
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 501), true);
  assert.equal(c.encontro.vida, 499);
  assert.equal(c.encontro.teleporte?.motivo, "reativo");
  assert.equal(c.encontro.estado, "teletransportando");
  c.atualizar(0);
  assert.equal(c.chamadas.iniciar, 0);
  assert.equal(c.encontro.transicaoFase2Pendente, true);
  c.atualizarCombate(500);
  assert.equal(c.encontro.teleporte, null);
  assert.equal(c.encontro.estado, "preparando");
  c.atualizar(0);
  assert.equal(c.encontro.teleporte?.motivo, "clones-centro");
  assert.equal(c.chamadas.iniciar, 0);
  c.atualizarCombate(500);
  c.atualizar(0);
  assert.equal(c.chamadas.iniciar, 1);
  assert.equal(c.encontro.hitboxDano, hitbox);
  assert.equal(c.encontro.sprite, c.sprite);
  assert.equal(c.chamadas.fases.length, 1);
  assert.equal(c.encontro.vida, 499);
});

test("clones e movimento da fase 2 mantêm aberturas reais e dano continua possível", () => {
  const c = preparar();
  c.encontro.vida = 499;
  c.atualizar(0);
  const vidaAntes = c.encontro.vida;
  c.atualizarCombate(1500);
  assert.equal(c.encontro.estado, "vulneravel");
  c.atualizar(50);
  assert.deepEqual(c.chamadas.mover, [], "A verdadeira permanece parada durante a abertura.");
  assert.equal(c.encontro.vida, vidaAntes, "movimentar os clones não cura a verdadeira");
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), false);
  c.atualizarCombate(500);
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
  assert.equal(c.encontro.vida, vidaAntes - 25);
  assert.equal(c.encontro.teleporte?.motivo, "reativo");
  const quantidadeMovimentos = c.chamadas.mover.length;
  c.atualizar(50);
  assert.equal(c.chamadas.mover.length, quantidadeMovimentos, "a verdadeira não caminha durante o teletransporte");
});

test("cruzar 50% durante a recarga aguarda também o teletransporte reativo pendente", () => {
  const c = preparar();
  c.atualizarCombate(1500);
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 500), true);
  assert.equal(c.encontro.vida, 500);
  assert.equal(c.encontro.fase, 1);
  c.atualizarCombate(500);
  c.atualizarCombate(1500);
  assert.equal(c.encontro.estado, "vulneravel");
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
  assert.equal(c.encontro.vida, 475);
  assert.equal(c.encontro.fase, 2);
  assert.equal(c.encontro.teleporte, null);
  assert.equal(c.encontro.teleportePendente, "reativo");
  c.atualizar(0);
  assert.equal(c.chamadas.iniciar, 0);
  c.atualizarCombate(399);
  c.atualizar(0);
  assert.equal(c.chamadas.iniciar, 0);
  c.atualizarCombate(1);
  assert.equal(c.encontro.teleporte?.motivo, "reativo");
  c.atualizar(0);
  assert.equal(c.chamadas.iniciar, 0);
  c.atualizarCombate(500);
  c.atualizar(0);
  assert.equal(c.encontro.teleporte?.motivo, "clones-centro");
  c.atualizarCombate(500);
  c.atualizar(0);
  assert.equal(c.chamadas.iniciar, 1);
  assert.equal(c.chamadas.fases.length, 1);
});

test("fim da onda agenda retorno e não repete antes do intervalo de combate", () => {
  const c = preparar();
  c.encontro.vida = 499;
  c.atualizar(0);
  assert.equal(c.encontro.sistemaClones.ativo, true);
  c.encontro.sistemaClones.cancelar();
  c.atualizar(16);
  assert.equal(c.encontro.teleportePendente, "retorno-clones");
  assert.equal(c.encontro.clonesFase2Executados, true);
  assert.equal(c.encontro.transicaoFase2Pendente, false);
  for (let i = 0; i < 20; i++) c.atualizar(1000);
  assert.equal(c.chamadas.iniciar, 1);
  assert.equal(c.chamadas.fases.length, 1);
  assert.equal(c.encontro.vida, 499);
  c.atualizarCombate(500);
  assert.equal(c.encontro.teleporte, null);
  assert.ok(c.encontro.config.teleporte.pontos.some(ponto => ponto.x === c.sprite.x && ponto.y === c.sprite.y));
});

test("sair durante a onda permite retomar ao reentrar, preservando fase e vida", () => {
  const c = preparar();
  c.encontro.vida = 499;
  c.atualizar(0);
  // Contrato do ciclo principal: registra a onda interrompida antes de limpar.
  c.encontro.transicaoFase2Pendente = c.encontro.sistemaClones.ativo;
  c.encontro.sistemaClones.cancelar();
  c.encontro.jogadorNaArena = false;
  c.scene.player.y = -5350;
  c.atualizar(5000);
  assert.equal(c.chamadas.iniciar, 1);
  assert.equal(c.encontro.transicaoFase2Pendente, true);
  assert.equal(c.encontro.vida, 499);
  c.encontro.jogadorNaArena = true;
  c.scene.player.y = -5500;
  c.atualizar(0);
  assert.equal(c.chamadas.iniciar, 2);
  assert.equal(c.encontro.transicaoFase2Pendente, false);
  assert.equal(c.chamadas.fases.length, 1);
  assert.equal(c.encontro.vida, 499);
});

test("morte, arena, suspensão e multiplayer não iniciam ou movimentam a fase", () => {
  for (const bloquear of [
    c => { c.scene.multiplayer = true; },
    c => { c.scene.morteEmAndamento = true; },
    c => { c.scene.player.active = false; },
    c => { c.scene.player.morto = true; },
    c => { c.scene.vida = 0; },
    c => { c.encontro.morto = true; },
    c => { c.encontro.encerrado = true; },
    c => { c.encontro.suspenso = true; },
    c => { c.encontro.jogadorNaArena = false; },
    c => { c.encontro.vida = 0; },
  ]) {
    const c = preparar();
    c.encontro.vida = 499;
    bloquear(c);
    c.atualizar(100);
    assert.equal(c.encontro.fase, 1);
    assert.equal(c.chamadas.iniciar, 0);
    assert.deepEqual(c.chamadas.mover, []);
    assert.equal(c.chamadas.fases.length, 0);
  }
});

test("configuração desativada preserva o combate; limiar configurado segue comparação estrita", () => {
  const desativada = preparar({ fase2: { ativo: false } });
  desativada.encontro.vida = 1;
  desativada.atualizar(100);
  assert.equal(desativada.encontro.fase, 1);
  assert.equal(desativada.chamadas.iniciar, 0);
  const customizada = preparar({ fase2: { limiarVida: 0.25 } });
  customizada.encontro.vida = 250;
  customizada.atualizar(0);
  assert.equal(customizada.encontro.fase, 1);
  customizada.encontro.vida = 249;
  customizada.atualizar(0);
  assert.equal(customizada.encontro.fase, 2);
});

test("vida zero impede movimento de uma fase 2 já ativa antes do processamento da derrota", () => {
  const c = preparar();
  c.encontro.vida = 499;
  c.atualizar(0);
  const movimentosAntes = c.chamadas.mover.length;
  c.encontro.vida = 0;
  c.atualizar(50);
  assert.equal(c.chamadas.mover.length, movimentosAntes);
  assert.equal(c.chamadas.iniciar, 1);
});

test("deltas inválidos não são encaminhados ao movimento da verdadeira", () => {
  const c = preparar();
  c.encontro.vida = 499;
  c.atualizar(0);
  for (const delta of [NaN, Infinity, -1, undefined]) c.atualizar(delta);
  assert.ok(c.chamadas.mover.every(delta => Number.isFinite(delta) && delta >= 0));
});

test("proteção da clonagem recusa dano em 1999 ms e libera exatamente em 2000 ms", () => {
  const c = preparar();
  c.encontro.vida = 499;
  c.atualizar(0);
  let eventosVida = 0;
  c.scene.events.on("novo-boss:vida", () => eventosVida++);
  assert.equal(c.encontro.invulneravelClonesAte, 2000);
  c.atualizarCombate(1999);
  assert.equal(c.encontro.estado, "vulneravel");
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), false);
  assert.equal(c.encontro.vida, 499);
  assert.equal(eventosVida, 0);
  c.atualizarCombate(1);
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
  assert.equal(c.encontro.vida, 474);
  assert.equal(eventosVida, 1);
});

function expirarOnda(c) {
  c.encontro.relogioCombate += 18000;
  c.encontro.sistemaClones.cancelar();
  c.atualizar(0);
  c.atualizarCombate(500);
}

test("três ondas nascem no centro com proteção renovada e apenas uma transição de fase", () => {
  const c = preparar();
  c.encontro.vida = 499;
  c.atualizar(0);
  for (let onda = 1; onda <= 3; onda++) {
    assert.equal(c.encontro.ondasClonesFase2, onda);
    assert.equal(c.chamadas.iniciar, onda);
    assert.deepEqual([c.encontro.x, c.encontro.y], [-1080, -5810]);
    assert.equal(c.encontro.invulneravelClonesAte, c.encontro.inicioOndaClonesEm + 2000);
    assert.equal(c.encontro.vida, 499);
    if (onda === 3) break;
    expirarOnda(c);
    const proxima = c.encontro.proximaOndaClonesEm;
    assert.equal(proxima, c.encontro.relogioCombate - 500 + 10000);
    c.encontro.estado = "preparando"; c.encontro.tempoEstado = 0;
    c.encontro.relogioCombate = proxima - 1;
    c.atualizar(0);
    assert.equal(c.chamadas.iniciar, onda);
    c.encontro.relogioCombate++;
    c.atualizar(0);
    assert.equal(c.encontro.teleporte?.motivo, "clones-centro");
    c.atualizarCombate(500);
    c.atualizar(0);
  }
  assert.equal(c.chamadas.fases.length, 1);
});

test("onda vencida preserva a abertura e o acerto agenda sua viagem reativa normalmente", () => {
  const c = preparar(); c.encontro.vida = 499; c.atualizar(0);
  expirarOnda(c);
  c.encontro.relogioCombate = c.encontro.proximaOndaClonesEm;
  c.encontro.estado = "vulneravel"; c.encontro.tempoEstado = 0;
  c.atualizar(0);
  assert.equal(c.encontro.transicaoFase2Pendente, true);
  assert.equal(c.encontro.teleporte, null);
  assert.equal(c.encontro.ondasClonesFase2, 1);
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
  assert.equal(c.encontro.teleporte?.motivo, "reativo");
  c.atualizar(0);
  assert.equal(c.encontro.ondasClonesFase2, 1);
});

test("onda vencida não cancela um ataque em andamento", () => {
  const c = preparar(); c.encontro.vida = 499; c.atualizar(0);
  expirarOnda(c);
  c.encontro.relogioCombate = c.encontro.proximaOndaClonesEm;
  const ataque = c.encontro.ataqueAtual = { tipo: "lasers" };
  c.encontro.estado = "atacando";
  c.atualizar(20);
  assert.equal(c.encontro.ataqueAtual, ataque);
  assert.equal(c.encontro.teleporte, null);
  assert.equal(c.encontro.ondasClonesFase2, 1);
  assert.equal(c.chamadas.cancelarAtaque, 1, "Somente a transição inicial cancela o ataque anterior.");
});

test("centro ocupado antes ou durante a viagem não gera clones fora dele", () => {
  for (const durante of [false, true]) {
    const c = preparar();
    sincronizarCorpoNovoBoss(c.encontro, { x: -1400, y: -5770 });
    c.encontro.vida = 499;
    if (durante) { c.atualizar(0); c.atualizarCombate(300); }
    Object.assign(c.scene.player, novoBossConfig.posicaoInicial);
    if (!durante) c.atualizar(0);
    c.atualizarCombate(1000);
    c.atualizar(0);
    assert.equal(c.chamadas.iniciar, 0);
    assert.equal(c.encontro.invulneravelClonesAte, 0);
    assert.equal(c.encontro.ondasClonesFase2, 0);
    assert.equal(c.sprite.visible, true);
    Object.assign(c.scene.player, { x: -1080, y: -5500 });
    for (let i = 0; c.encontro.ondasClonesFase2 === 0 && i < 400; i++) {
      c.atualizarCombate(20); c.atualizar(0);
    }
    assert.equal(c.encontro.ondasClonesFase2, 1);
    assert.deepEqual([c.encontro.x, c.encontro.y], [-1080, -5810]);
  }
});

test("a seleção automática reserva a preparação para a onda sem descartar uma janela vulnerável", () => {
  const c = preparar();
  prepararAtaquesNovoBoss(c.scene, c.encontro);
  c.encontro.vida = 499; c.atualizar(0);
  expirarOnda(c);
  c.encontro.relogioCombate = c.encontro.proximaOndaClonesEm;
  c.encontro.estado = "vulneravel"; c.encontro.tempoEstado = 2499;
  c.atualizarCombate(1);
  assert.equal(c.encontro.estado, "preparando");
  c.atualizarCombate(2000);
  assert.equal(c.encontro.ondasClonesFase2, 2);
  assert.equal(c.encontro.estado, "preparando");
  assert.equal(c.encontro.tempoEstado, 0);
});

test("tentativa recusada não concede proteção nem conta uma onda que não nasceu", () => {
  const c = preparar(); c.permitirClones(false);
  c.encontro.vida = 499; c.atualizar(0);
  assert.equal(c.encontro.ondasClonesFase2, 0);
  assert.equal(c.encontro.invulneravelClonesAte, 0);
  c.permitirClones(true); c.atualizarCombate(500); c.atualizar(0);
  assert.equal(c.encontro.ondasClonesFase2, 1);
  assert.equal(c.encontro.invulneravelClonesAte, 2500);
});

test("golpe fatal limpa proteção e futuras ondas, sem repetir a fase", () => {
  const c = preparar(); c.encontro.vida = 499; c.atualizar(0);
  c.atualizarCombate(2000);
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 499), true);
  assert.equal(c.encontro.morto, true);
  assert.equal(c.encontro.invulneravelClonesAte, 0);
  assert.equal(c.encontro.proximaOndaClonesEm, Infinity);
  c.atualizar(100000);
  assert.equal(c.encontro.ondasClonesFase2, 1);
  assert.equal(c.chamadas.fases.length, 1);
});
