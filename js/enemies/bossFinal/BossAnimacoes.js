/**
 * @file Sincronização de animações e combate do boss. Eventos de frame controlam mira,
 * impacto, cura e efeitos; a conclusão devolve a IA ao repouso.
 */

import {
  ataquePorEstado,
  duracaoFrame,
  estadosAnimacao,
  emitirEventoBoss,
  intervaloEntreAtaques,
  obterNumeroFrameAnimacao,

  // Frames de contato definidos no próprio Boss.
  framesImpactoChao,
} from "./BossConfig.js";

import { atualizarHitboxesBoss, socoComDanoAtivo } from "./BossHitboxes.js";

import {
  atualizarRaioZona,
  limparRaioZona,
  raioPodeDarDano,
} from "./BossRaioZonas.js";

// =====================================================
// CONTROLE DO SOM DO RAIO - ORIGINAL
// =====================================================

import {
  ativarMonitorSomRaioBoss,
  atualizarSomRaioBoss,
  pararSomRaioBoss,
} from "../../sounds/bossRaio.js";

// =====================================================
// NOVO: CONTROLE DO SOM DOS SOCOS
// =====================================================

import { tocarSomSocoBoss, pararSomSocoBoss } from "../../sounds/inimigos.js";

// =====================================================
// IDENTIFICAR FRAMES DA ANIMAÇÃO DO BOSS
// =====================================================

/**
 * Conta os frames numéricos de uma textura carregada, desconsiderando nomes auxiliares.
 */
function obterTotalFramesTextura(scene, chave) {
  if (!scene.textures.exists(chave)) {
    return 0;
  }

  return scene.textures
    .get(chave)
    .getFrameNames()
    .filter((nome) => /^\d+$/.test(String(nome))).length;
}

// =====================================================
// CRIAR ANIMAÇÕES
// =====================================================

/**
 * Registra as animações por estado e ajusta o fim da sequência do raio ao número de quadros
 * disponível.
 */
export function criarAnimacoesBoss(scene) {
  for (const [estado, dados] of Object.entries(estadosAnimacao)) {
    if (estado === "idle") continue;

    const chave = `boss-final-${estado}`;

    let frameFinal = dados.frameFinal;

    if (estado === "raioChao") {
      const total = obterTotalFramesTextura(scene, dados.textura);

      if (total > 0) {
        frameFinal = total - 1;
      }

      if (scene.anims.exists(chave)) {
        const anterior = scene.anims.get(chave);

        if (anterior.frames.length !== frameFinal + 1) {
          scene.anims.remove(chave);
        }
      }
    }

    if (scene.anims.exists(chave)) {
      continue;
    }

    scene.anims.create({
      key: chave,

      frames: scene.anims.generateFrameNumbers(dados.textura, {
        start: 0,
        end: frameFinal,
      }),

      frameRate: 1000 / duracaoFrame,
      repeat: 0,
    });
  }
}

// =====================================================
// EXIBIR ESTADO DO BOSS
// =====================================================

/**
 * Troca textura, posição e animação do estado, atualizando hitboxes e o controle de sons de
 * soco e raio.
 */
export function exibirEstadoBoss(boss, estado) {
  const dados = estadosAnimacao[estado];

  if (!dados) {
    throw new RangeError(`Estado de animação do Boss desconhecido: ${estado}`);
  }

  if (boss.bossEstadoAtual === estado) {
    return;
  }

  // ===================================================
  // CONTROLAR SOM DO RAIO - ORIGINAL
  // ===================================================

  if (estado === "raioChao") {
    ativarMonitorSomRaioBoss(boss);
  } else {
    pararSomRaioBoss(boss);
  }

  // ===================================================
  // NOVO: CONTROLAR SOM DO SOCO
  // ===================================================

  if (estado === "ataqueChao") {
    // Início de uma nova sequência de socos.
    //
    // Permite tocar novamente os sons nos
    // frames 6 e 12 do novo ataque.
    boss.ultimoFrameSocoComSom = null;
  } else {
    // Ao mudar para outro estado, interromper
    // qualquer som de impacto ainda ativo.
    pararSomSocoBoss(boss);

    boss.ultimoFrameSocoComSom = null;
  }

  // ===================================================
  // ANIMAÇÃO ORIGINAL
  // ===================================================

  boss.sprite.anims.stop();

  boss.bossEstadoAtual = estado;
  boss.iaCombate.frame = 0;

  boss.sprite
    .setTexture(dados.textura, 0)
    .setPosition(dados.offsetX, dados.offsetY);

  atualizarHitboxesBoss(boss);

  if (estado !== "idle") {
    boss.sprite.anims.play(`boss-final-${estado}`);
  }
}

// =====================================================
// NOVO: SINCRONIZAR SOM COM OS FRAMES DE IMPACTO
// =====================================================
//
// A configuração original do Boss informa:
//
// framesImpactoChao = [6, 12]
//
// O áudio só será executado nesses frames.
//
// Não toca nos frames de preparação.
// Não toca nos frames em que o braço está descendo.
// Não toca nos frames de recuperação.
//
// Cada frame de impacto dispara apenas uma vez.
//
// Não depende de o jogador receber dano.
// O impacto produz som mesmo quando o soco erra.
// =====================================================

/**
 * Dispara o som nos frames de impacto do soco, sem depender de acertar o jogador e sem
 * duplicar o mesmo frame.
 */
function atualizarSomImpactoChao(boss) {
  if (!boss?.active || boss.morto) {
    return;
  }

  const ia = boss.iaCombate;

  // Apenas o ataque de soco.
  if (ia.ataqueAtual !== "ataqueChao") {
    return;
  }

  const frameAtual = ia.frame;

  // ===================================================
  // VERIFICAR SE O FRAME É REALMENTE DE IMPACTO
  // ===================================================

  if (!framesImpactoChao.includes(frameAtual)) {
    return;
  }

  // ===================================================
  // EVITAR REPETIR O SOM NO MESMO FRAME
  // ===================================================

  if (boss.ultimoFrameSocoComSom === frameAtual) {
    return;
  }

  // Registrar o frame antes de tocar.
  boss.ultimoFrameSocoComSom = frameAtual;

  // ===================================================
  // EXECUTAR SOM EXATAMENTE NO FRAME DE IMPACTO
  // ===================================================

  tocarSomSocoBoss(boss);
}

// =====================================================
// MIRA DO LASER ORIGINAL
// =====================================================

/**
 * Atualiza a previsão de mira na preparação do laser antes de travar sua direção para o
 * disparo.
 */
function atualizarMiraDurantePreparacao(boss, player, frame, callbacks) {
  const ia = boss.iaCombate;

  if (
    !player?.active ||
    ia.ataqueAtual !== "tiroLaser" ||
    frame < 8 ||
    frame > 12
  ) {
    return;
  }

  if (frame < 12) {
    const previsao = callbacks.preverPosicaoJogador(ia, player, 0.12);

    const dx = previsao.x - boss.x;
    const dy = previsao.y - (boss.y - 175);

    const comprimento = Math.hypot(dx, dy) || 1;

    ia.direcaoLaser = {
      x: dx / comprimento,
      y: dy / comprimento,
    };

    return;
  }

  if (ia.frameMiraTravada !== null) {
    return;
  }

  ia.frameMiraTravada = frame;

  ia.posicaoNoDisparo = {
    x: player.x,
    y: player.y,
  };

  emitirEventoBoss(boss, "boss:laser-disparado", {
    direcao: ia.direcaoLaser,
    frame,
    danoAtivo: false,
  });
}

// =====================================================
// FINALIZAR ANIMAÇÃO DO BOSS
// =====================================================

/**
 * Encerra o ataque correspondente, limpa sons e áreas temporárias e agenda a próxima decisão
 * da IA.
 */
export function finalizarAnimacaoBoss(boss, animacao, callbacks) {
  if (boss.morto) return;

  const ia = boss.iaCombate;

  const estadoTerminado = Object.keys(ataquePorEstado).find(
    (estado) => `boss-final-${estado}` === animacao.key,
  );

  if (!estadoTerminado || boss.bossEstadoAtual !== estadoTerminado) {
    return;
  }

  // ===================================================
  // FINALIZAR LASER ORIGINAL
  // ===================================================

  if (estadoTerminado === "tiroLaser") {
    callbacks.observarEsquivaLaser(boss, ia.jogadorAtual);
  }

  // ===================================================
  // FINALIZAR RAIO ORIGINAL
  // ===================================================

  if (estadoTerminado === "raioChao") {
    limparRaioZona(boss);

    pararSomRaioBoss(boss);
  }

  // ===================================================
  // NOVO: FINALIZAR SOM DO SOCO
  // ===================================================

  if (estadoTerminado === "ataqueChao") {
    // Garante que o áudio não permaneça
    // reproduzindo após o fim do ataque.
    pararSomSocoBoss(boss);
  }

  // ===================================================
  // REINICIAR ESTADO DA IA
  // ===================================================

  ia.ataqueAtual = null;
  ia.frameMiraTravada = null;
  ia.direcaoLaser = null;
  ia.zonasRaio = [];
  ia.areaRaio = null;
  ia.jogadorAtingidoNesteAtaque = false;

  ia.framesCuraAplicados.clear();

  ia.estado = "IDLE";
  ia.tempoAteDecidir = intervaloEntreAtaques;

  exibirEstadoBoss(boss, "idle");

  emitirEventoBoss(boss, "boss:ataque-finalizado", {
    ataque: ataquePorEstado[estadoTerminado],
  });
}

// =====================================================
// ATUALIZAÇÃO DA ANIMAÇÃO DO BOSS
// =====================================================

/**
 * Processa o frame de ataque e sincroniza dano, cura, mira e eventos consumidos pelos efeitos
 * auxiliares.
 */
export function tratarAnimationUpdate(boss, animacao, frame, callbacks) {
  if (boss.morto) return;

  const ia = boss.iaCombate;

  if (!ia.ataqueAtual || animacao.key !== `boss-final-${ia.ataqueAtual}`) {
    return;
  }

  // ===================================================
  // OBTER FRAME REAL DO PHASER
  // ===================================================

  ia.frame = obterNumeroFrameAnimacao(frame);

  ia.jogadorAtual = boss.scene.player;

  // ===================================================
  // NOVO: SINCRONIZAR ÁUDIO DO SOCO
  // ===================================================
  //
  // Primeiro identificamos o frame.
  //
  // Se for o frame 6 ou 12, o som começa
  // imediatamente neste evento.
  //
  // Isso evita iniciar o som no começo do
  // movimento dos braços.
  // ===================================================

  if (ia.ataqueAtual === "ataqueChao") {
    atualizarSomImpactoChao(boss);
  }

  // ===================================================
  // HITBOXES ORIGINAIS
  // ===================================================

  atualizarHitboxesBoss(boss);

  // ===================================================
  // MIRA DO LASER ORIGINAL
  // ===================================================

  atualizarMiraDurantePreparacao(boss, ia.jogadorAtual, ia.frame, callbacks);

  // ===================================================
  // CURA E DANO ORIGINAIS
  // ===================================================

  callbacks.aplicarCuraDoFrame(boss);
  callbacks.aplicarDanoDoAtaque(boss);

  // ===================================================
  // RAIO SINCRONIZADO COM O BOSS - ORIGINAL
  // ===================================================

  if (ia.ataqueAtual === "raioChao") {
    atualizarRaioZona(boss);

    atualizarSomRaioBoss(boss);
  }

  const ataqueRaio = ia.ataqueAtual === "raioChao";

  // ===================================================
  // EVENTO ORIGINAL DE ATAQUE
  // ===================================================

  emitirEventoBoss(boss, "boss:ataque-frame", {
    ataque: ataquePorEstado[ia.ataqueAtual],

    estado: ia.ataqueAtual,

    frame: ia.frame,

    zonas: ia.zonasRaio,

    area: ataqueRaio
      ? ia.areaRaio
      : socoComDanoAtivo(boss)
        ? boss.areaDanoChao
        : null,

    direcao: ia.direcaoLaser,

    danoAtivo: ataqueRaio ? raioPodeDarDano(boss) : socoComDanoAtivo(boss),
  });
}

// =====================================================
// REGISTRAR LISTENERS DAS ANIMAÇÕES
// =====================================================

/**
 * Registra uma única vez os listeners de avanço e conclusão das animações do boss.
 */
export function registrarListenersBoss(boss, callbacks) {
  if (boss.listenersRegistrados) {
    return;
  }

  /**
   * Encaminha o avanço da animação ao processamento de frames de combate.
   */
  boss.onAnimationUpdate = (animacao, frame) =>
    tratarAnimationUpdate(boss, animacao, frame, callbacks);

  /**
   * Encaminha a conclusão da animação para a restauração do estado de repouso.
   */
  boss.onAnimationComplete = (animacao) =>
    finalizarAnimacaoBoss(boss, animacao, callbacks);

  boss.sprite.on("animationupdate", boss.onAnimationUpdate);

  boss.sprite.on("animationcomplete", boss.onAnimationComplete);

  boss.listenersRegistrados = true;
}
