import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { novoBossConfig, areaCorpoNovoBoss } from "./NovoBossConfig.js";
import {
  inicializarCombateNovoBoss,
  atualizarCombateNovoBoss,
  causarDanoNovoBoss,
} from "./NovoBossEstados.js";
import {
  escolherDestinoNovoBoss,
  destinoValidoNovoBoss,
  iniciarTeleporteNovoBoss,
  atualizarTeleporteNovoBoss,
  sincronizarCorpoNovoBoss,
} from "./NovoBossTeleporte.js";

function criarEncontro(opcoes = {}) {
  const config = {
    ...novoBossConfig,
    // Casos de viagem isolam o limite configurável de um acerto; combos usam a configuração de produção abaixo.
    combate: { ...novoBossConfig.combate, janelaVulneravelMs: 2500, acertosPorAbertura: 1, intervaloAcertosMs: 0, ...opcoes.combate },
    teleporte: { ...novoBossConfig.teleporte, ...opcoes.teleporte },
  };
  const scene = {
    player: { active: true, x: -1080, y: -5500 },
    vida: 100,
    events: new EventEmitter(),
    collisionGroup: { getChildren: () => opcoes.blocos || [] },
  };
  const sprite = {
    ...config.posicaoInicial, active: true, visible: true, alpha: 1,
    setPosition(x, y) { this.x = x; this.y = y; return this; },
    setAlpha(alpha) { this.alpha = alpha; return this; },
    anims: { pause() { this.pausada = true; } },
    body: {
      enable: true,
      resets: 0,
      reset(x, y) { sprite.x = x; sprite.y = y; this.resets++; },
      updateFromGameObject() { Object.assign(this, areaCorpoNovoBoss(config, sprite)); },
    },
  };
  const hitbox = {
    setTo(x, y, width, height) { Object.assign(this, { x, y, width, height }); return this; },
  };
  const encontro = {
    config, sprite, hitboxDano: hitbox, hitbox,
    estado: "posicionada", suspenso: false, active: true, encerrado: false,
  };
  scene.novoBoss = encontro;
  inicializarCombateNovoBoss(scene, encontro);
  return { scene, encontro, sprite, config, atualizar: (delta) => atualizarCombateNovoBoss(scene, encontro, delta) };
}

function abrir(encontroCriado) {
  encontroCriado.atualizar(encontroCriado.config.combate.preparacaoMs);
  assert.equal(encontroCriado.encontro.estado, "vulneravel");
}

function corpoBloqueador(config, ponto) {
  return { body: { ...areaCorpoNovoBoss(config, ponto), enable: true } };
}

test("acertos consecutivos não ganham imunidade e não interrompem o ataque em curso", () => {
  for (const estado of ["posicionada", "preparando", "atacando", "teletransportando", "vulneravel"]) {
    const c = criarEncontro({ combate: novoBossConfig.combate });
    const ataque = { tipo: "chuvaRaios" };
    Object.assign(c.encontro, { estado, ataqueAtual: ataque, tempoAtaque: 123,
      invulneravelClonesAte: Infinity, proximoAcertoEm: Infinity });
    assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true, estado);
    assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true, estado);
    assert.equal(c.encontro.vida, 950);
    assert.equal(c.encontro.estado, estado);
    assert.equal(c.encontro.ataqueAtual, ataque);
    assert.equal(c.encontro.tempoAtaque, 123);
  }
});

test("produção entrega quatro segundos e só reage ao acerto isolado quando a janela termina", () => {
  const c = criarEncontro({ combate: novoBossConfig.combate });
  abrir(c);
  c.encontro.teleportePendente = "preventivo";
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
  c.atualizar(3999);
  assert.equal(c.encontro.estado, "vulneravel");
  assert.equal(c.encontro.teleporte, null);
  c.atualizar(1);
  assert.equal(c.encontro.teleporte.motivo, "reativo");
  assert.equal(c.encontro.vida, 975);
});

test("retorno dos clones e antigo prazo de clonagem não bloqueiam dano", () => {
  const c = criarEncontro({ combate: novoBossConfig.combate });
  abrir(c);
  c.encontro.teleportePendente = "retorno-clones";
  c.encontro.invulneravelClonesAte = c.encontro.relogioCombate + 2000;
  c.atualizar(1999);
  assert.equal(c.encontro.teleporte, null);
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
  assert.equal(c.encontro.acertosNaAbertura, 1);
  c.atualizar(1);
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
  assert.equal(c.encontro.estado, "vulneravel");
  assert.equal(c.encontro.acertosNaAbertura, 2);
});

test("somente a barreira bloqueia dano; pendência dos geradores não cria proteção invisível", () => {
  const c = criarEncontro();
  abrir(c);
  c.encontro.barreiraAtiva = true;
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), false);
  assert.equal(c.encontro.vida, 1000);
  assert.equal(c.encontro.estado, "vulneravel");
  c.encontro.barreiraAtiva = false;
  c.encontro.pendencia = "posicoes-geradores-bloqueadas";
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
  c.encontro.pendencia = null;
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
  assert.equal(c.encontro.vida, 950);
});

test("vida e estados têm abertura temporizada e não iniciam fase 2 abaixo de 50%", () => {
  const c = criarEncontro();
  assert.equal(c.encontro.vida, 1000);
  assert.equal(c.encontro.estado, "posicionada");
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
  c.atualizar(1499);
  assert.equal(c.encontro.estado, "preparando");
  c.atualizar(1);
  assert.equal(c.encontro.estado, "vulneravel");
  c.atualizar(2499);
  assert.equal(c.encontro.estado, "vulneravel");
  c.atualizar(1);
  assert.equal(c.encontro.estado, "preparando");
  c.atualizar(1500);
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 501), true);
  assert.equal(c.encontro.vida, 474);
  assert.equal(c.encontro.fase, undefined);
  assert.equal(c.encontro.clones, undefined);
  assert.equal(c.encontro.estado, "teletransportando");
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
});

test("acerto reativo fecha a janela e respeita o intervalo mínimo antes da próxima viagem", () => {
  const c = criarEncontro();
  abrir(c);
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
  assert.equal(c.encontro.estado, "teletransportando");
  assert.equal(c.sprite.body.enable, false);
  c.atualizar(500);
  assert.equal(c.encontro.estado, "preparando");
  c.atualizar(1500);
  assert.equal(c.encontro.estado, "vulneravel");
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
  assert.equal(c.encontro.estado, "preparando");
  assert.equal(c.encontro.teleportePendente, "reativo");
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
  c.atualizar(399);
  assert.equal(c.encontro.teleporte, null);
  c.atualizar(1);
  assert.equal(c.encontro.estado, "teletransportando");
  assert.equal(c.encontro.ultimoTeleporteEm, 3900);
  assert.equal(c.encontro.vida, 925);
});

test("teletransporte preventivo só ocorre após dez segundos sem aproximação", () => {
  const c = criarEncontro();
  c.atualizar(9999);
  assert.equal(c.encontro.teleporte, null);
  c.atualizar(1);
  assert.equal(c.encontro.teleporte, null, "O preventivo espera a abertura terminar.");
  c.atualizar(2000);
  assert.equal(c.encontro.teleporte.motivo, "preventivo");
  assert.equal(c.encontro.ultimoTeleporteEm, 12000);

  const perto = criarEncontro();
  perto.scene.player.y = perto.sprite.y + 100;
  perto.atualizar(30000);
  assert.equal(perto.encontro.teleporte, null);
  assert.equal(perto.encontro.tempoSemAproximacao, 0);
  perto.scene.player.y = -5500;
  perto.atualizar(9999);
  assert.equal(perto.encontro.teleporte, null);
  perto.atualizar(1);
  assert.equal(perto.encontro.teleporte.motivo, "preventivo");
});

test("os quatro pontos são destinos funcionais e mantêm sprite, corpo e hitbox sincronizados", () => {
  for (const destino of novoBossConfig.teleporte.pontos) {
    const c = criarEncontro();
    const origem = c.config.teleporte.pontos.find((ponto) => ponto.id !== destino.id);
    sincronizarCorpoNovoBoss(c.encontro, origem);
    const hitboxOriginal = c.encontro.hitboxDano;
    c.encontro.obstaculosTeleporte = c.config.teleporte.pontos
      .filter((ponto) => ponto.id !== destino.id)
      .map((ponto) => corpoBloqueador(c.config, ponto));
    assert.equal(escolherDestinoNovoBoss(c.scene, c.encontro)?.id, destino.id);
    assert.equal(iniciarTeleporteNovoBoss(c.scene, c.encontro, "teste"), true);
    assert.equal(c.sprite.body.enable, false);
    atualizarTeleporteNovoBoss(c.scene, c.encontro, 125);
    assert.equal(c.sprite.alpha, 0.5);
    assert.equal(c.sprite.x, origem.x);
    atualizarTeleporteNovoBoss(c.scene, c.encontro, 125);
    assert.equal(c.sprite.x, destino.x);
    assert.equal(c.sprite.y, destino.y);
    const area = areaCorpoNovoBoss(c.config, destino);
    for (const chave of ["x", "y", "width", "height"]) {
      assert.equal(c.sprite.body[chave], area[chave]);
      assert.equal(c.encontro.hitboxDano[chave], area[chave]);
    }
    assert.equal(c.encontro.hitboxDano, hitboxOriginal);
    assert.equal(c.encontro.hitbox, hitboxOriginal);
    assert.equal(c.encontro.sprite, c.sprite);
    atualizarTeleporteNovoBoss(c.scene, c.encontro, 250);
    assert.equal(c.sprite.body.enable, true);
    assert.equal(c.sprite.alpha, 1);
    assert.equal(c.encontro.teleporte, null);
  }
});

test("destinos rejeitam paredes, limites, jogador e geradores, e escolhem o mais distante", () => {
  const ponto = novoBossConfig.teleporte.pontos[1];
  const bloco = corpoBloqueador(novoBossConfig, ponto);
  const c = criarEncontro({ blocos: [bloco] });
  assert.equal(destinoValidoNovoBoss(c.scene, c.encontro, ponto), false);
  bloco.body.enable = false;
  assert.equal(destinoValidoNovoBoss(c.scene, c.encontro, ponto), true);
  assert.equal(destinoValidoNovoBoss(c.scene, c.encontro, { x: -2000, y: -5800 }), false);
  assert.equal(destinoValidoNovoBoss(c.scene, c.encontro, { x: NaN, y: -5800 }), false);
  c.scene.player.x = ponto.x;
  c.scene.player.y = ponto.y;
  assert.equal(destinoValidoNovoBoss(c.scene, c.encontro, ponto), false);
  c.scene.player.x = -1500;
  c.scene.player.y = -5600;
  assert.equal(escolherDestinoNovoBoss(c.scene, c.encontro).id, "direita");
  c.encontro.obstaculosTeleporte = [corpoBloqueador(c.config, c.config.teleporte.pontos[2])];
  assert.notEqual(escolherDestinoNovoBoss(c.scene, c.encontro).id, "direita");
});

test("sem destino válido mantém janelas e reavalia o teletransporte sem sumir", () => {
  const c = criarEncontro();
  c.encontro.obstaculosTeleporte = c.config.teleporte.pontos.map((ponto) => corpoBloqueador(c.config, ponto));
  abrir(c);
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), true);
  assert.equal(c.encontro.pendencia, "teleporte-sem-destino");
  assert.equal(c.encontro.estado, "preparando");
  assert.equal(c.sprite.alpha, 1);
  assert.equal(c.sprite.body.enable, true);
  c.atualizar(1500);
  assert.equal(c.encontro.estado, "vulneravel");
  c.encontro.obstaculosTeleporte = [];
  c.atualizar(2500);
  assert.equal(c.encontro.estado, "teletransportando");
  assert.equal(c.encontro.teleporte.motivo, "reativo");
  assert.equal(c.encontro.pendencia, null);
});

test("sem nenhum ponto seguro aguarda visível e sem corpo, recuperando quando um destino é liberado", () => {
  const c = criarEncontro();
  abrir(c);
  causarDanoNovoBoss(c.scene, c.encontro, 25);
  c.encontro.obstaculosTeleporte = c.config.teleporte.pontos.map((ponto) => corpoBloqueador(c.config, ponto));
  c.atualizar(250);
  assert.equal(c.encontro.teleporte.etapa, "aguardando-destino");
  assert.equal(c.encontro.estado, "teletransportando");
  assert.equal(c.sprite.alpha, 0.35);
  assert.equal(c.sprite.body.enable, false);
  assert.equal(c.sprite.x, c.config.posicaoInicial.x);
  assert.equal(c.sprite.y, c.config.posicaoInicial.y);
  c.atualizar(5000);
  assert.equal(c.sprite.alpha, 0.35);
  assert.equal(c.sprite.body.enable, false);
  assert.equal(c.encontro.teleporte.etapa, "aguardando-destino");
  c.encontro.obstaculosTeleporte = [];
  c.atualizar(500);
  assert.equal(c.encontro.teleporte.etapa, "reaparecendo");
  assert.equal(c.sprite.body.enable, false);
  c.atualizar(250);
  assert.equal(c.encontro.teleporte, null);
  assert.equal(c.encontro.estado, "preparando");
  assert.equal(c.sprite.alpha, 1);
  assert.equal(c.sprite.body.enable, true);
  assert.equal(destinoValidoNovoBoss(c.scene, c.encontro, c.sprite), true);
});

test("jogador que ocupa o destino entre 250 e 500ms força novo reaparecimento antes de habilitar corpo", () => {
  const c = criarEncontro();
  abrir(c);
  causarDanoNovoBoss(c.scene, c.encontro, 25);
  c.atualizar(250);
  const ocupado = { x: c.sprite.x, y: c.sprite.y };
  c.scene.player.x = ocupado.x;
  c.scene.player.y = ocupado.y;
  c.atualizar(249);
  assert.equal(c.sprite.body.enable, false);
  c.atualizar(1);
  assert.equal(c.encontro.teleporte.etapa, "reaparecendo");
  assert.equal(c.encontro.teleporte.decorrido, 0);
  assert.equal(c.sprite.body.enable, false);
  assert.equal(c.sprite.alpha, 0);
  assert.notDeepEqual({ x: c.sprite.x, y: c.sprite.y }, ocupado);
  assert.equal(destinoValidoNovoBoss(c.scene, c.encontro, c.sprite), true);
  c.atualizar(249);
  assert.equal(c.sprite.body.enable, false);
  c.atualizar(1);
  assert.equal(c.encontro.teleporte, null);
  assert.equal(c.sprite.body.enable, true);
  assert.equal(c.encontro.sprite, c.sprite);
});

test("destino ocupado no fim do reaparecimento recua à origem livre se os outros pontos estão bloqueados", () => {
  const c = criarEncontro();
  abrir(c);
  causarDanoNovoBoss(c.scene, c.encontro, 25);
  c.atualizar(250);
  c.scene.player.x = c.sprite.x;
  c.scene.player.y = c.sprite.y;
  c.encontro.obstaculosTeleporte = c.config.teleporte.pontos
    .filter((ponto) => ponto.id !== "centro")
    .map((ponto) => corpoBloqueador(c.config, ponto));
  c.atualizar(250);
  assert.equal(c.sprite.x, c.config.posicaoInicial.x);
  assert.equal(c.sprite.y, c.config.posicaoInicial.y);
  assert.equal(c.sprite.body.enable, false);
  assert.equal(c.encontro.teleporte.etapa, "reaparecendo");
  c.atualizar(250);
  assert.equal(c.sprite.body.enable, true);
  assert.equal(c.encontro.teleporte, null);
  assert.equal(c.encontro.teleportePendente, "reativo");
  assert.equal(destinoValidoNovoBoss(c.scene, c.encontro, c.sprite), true);
});

test("destino e origem ocupados no fim da entrada não habilitam corpo e permitem recuperação posterior", () => {
  const c = criarEncontro();
  abrir(c);
  causarDanoNovoBoss(c.scene, c.encontro, 25);
  c.atualizar(250);
  c.scene.player.x = c.sprite.x;
  c.scene.player.y = c.sprite.y;
  c.encontro.obstaculosTeleporte = c.config.teleporte.pontos.map((ponto) => corpoBloqueador(c.config, ponto));
  c.atualizar(250);
  assert.equal(c.encontro.teleporte.etapa, "aguardando-destino");
  assert.equal(c.sprite.body.enable, false);
  assert.equal(c.sprite.alpha, 0.35);
  c.atualizar(5000);
  assert.equal(c.encontro.teleporte.etapa, "aguardando-destino");
  assert.equal(c.sprite.body.enable, false);
  c.encontro.obstaculosTeleporte = [];
  c.atualizar(500);
  assert.equal(c.encontro.teleporte.etapa, "reaparecendo");
  assert.equal(c.sprite.body.enable, false);
  c.atualizar(250);
  assert.equal(c.encontro.teleporte, null);
  assert.equal(c.sprite.body.enable, true);
  assert.equal(destinoValidoNovoBoss(c.scene, c.encontro, c.sprite), true);
});

test("dano exige quantidade positiva e interseção com a hitbox na abertura", () => {
  const c = criarEncontro();
  abrir(c);
  for (const valor of [0, -1, NaN, Infinity, "25", null]) {
    assert.equal(causarDanoNovoBoss(c.scene, c.encontro, valor), false);
  }
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25, { x: 0, y: 0, width: 10, height: 10 }), false);
  assert.equal(c.encontro.vida, 1000);
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25, { ...areaCorpoNovoBoss(c.config) }), true);
  assert.equal(c.encontro.vida, 975);
});

test("arena, morte do jogador, suspensão e multiplayer pausam o relógio e bloqueiam dano", () => {
  for (const suspender of [
    ({ scene }) => { scene.player.y = -5400; },
    ({ scene }) => { scene.morteEmAndamento = true; },
    ({ scene }) => { scene.vida = 0; },
    ({ scene }) => { scene.player.morto = true; },
    ({ scene }) => { scene.multiplayer = true; },
    ({ encontro }) => { encontro.suspenso = true; },
    ({ encontro }) => { encontro.jogadorNaArena = false; },
  ]) {
    const c = criarEncontro();
    abrir(c);
    const relogio = c.encontro.relogioCombate;
    suspender(c);
    c.atualizar(100000);
    assert.equal(c.encontro.relogioCombate, relogio);
    assert.equal(c.encontro.estado, "vulneravel");
    assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), false);
    assert.equal(c.encontro.vida, 1000);
  }
});

test("sair e retornar preserva vida e progresso; suspensão durante viagem preserva a posição", () => {
  const c = criarEncontro();
  abrir(c);
  causarDanoNovoBoss(c.scene, c.encontro, 25);
  c.atualizar(125);
  const alpha = c.sprite.alpha;
  c.scene.player.y = -5400;
  c.atualizar(10000);
  assert.equal(c.sprite.alpha, alpha);
  assert.equal(c.encontro.teleporte.decorrido, 125);
  c.scene.player.y = -5500;
  c.atualizar(375);
  assert.equal(c.encontro.estado, "preparando");
  assert.equal(c.encontro.vida, 975);
  assert.equal(c.encontro.relogioCombate, 2000);
  inicializarCombateNovoBoss(c.scene, c.encontro);
  assert.equal(c.encontro.vida, 975);
});

test("derrota emite uma vez, cancela a viagem e não muda vida ou cena do jogador", () => {
  const c = criarEncontro();
  let derrotas = 0;
  c.scene.events.on("novo-boss:derrotada", () => derrotas++);
  abrir(c);
  assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 2000), true);
  assert.equal(c.encontro.vida, 0);
  assert.equal(c.encontro.estado, "derrotada");
  assert.equal(c.encontro.morto, true);
  assert.equal(c.sprite.body.enable, false);
  assert.equal(c.sprite.alpha, 0.35);
  assert.equal(c.sprite.anims.pausada, true);
  for (let i = 0; i < 3; i++) {
    c.atualizar(10000);
    assert.equal(causarDanoNovoBoss(c.scene, c.encontro, 25), false);
  }
  assert.equal(derrotas, 1);
  assert.equal(c.scene.vida, 100);

  const emViagem = criarEncontro();
  abrir(emViagem);
  causarDanoNovoBoss(emViagem.scene, emViagem.encontro, 25);
  emViagem.atualizar(100);
  emViagem.encontro.vida = 0;
  emViagem.atualizar(100);
  assert.equal(emViagem.encontro.estado, "derrotada");
  assert.equal(emViagem.encontro.teleporte, null);
  assert.equal(emViagem.sprite.body.enable, false);
});

test("deltas grandes equivalem a frames pequenos sem perder transições ou criar entidades", () => {
  const grande = criarEncontro();
  const pequeno = criarEncontro();
  grande.atualizar(60000);
  for (let i = 0; i < 6000; i++) pequeno.atualizar(10);
  for (const chave of ["estado", "relogioCombate", "tempoEstado", "ultimoTeleporteEm", "tempoSemAproximacao"]) {
    assert.equal(grande.encontro[chave], pequeno.encontro[chave], chave);
  }
  assert.equal(grande.sprite.x, pequeno.sprite.x);
  assert.equal(grande.sprite.y, pequeno.sprite.y);
  assert.equal(grande.encontro.sprite, grande.sprite);
  assert.equal(grande.encontro.vida, 1000);
  const relogio = grande.encontro.relogioCombate;
  for (const delta of [-1, NaN, Infinity]) grande.atualizar(delta);
  assert.equal(grande.encontro.relogioCombate, relogio);
});
