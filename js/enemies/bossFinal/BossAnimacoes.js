import {
  ataquePorEstado,
  duracaoFrame,
  estadosAnimacao,
  emitirEventoBoss,
  intervaloEntreAtaques,
  obterNumeroFrameAnimacao,
} from "./BossConfig.js";

import { atualizarHitboxesBoss, socoComDanoAtivo } from "./BossHitboxes.js";

import {
  atualizarRaioZona,
  limparRaioZona,
  raioPodeDarDano,
} from "./BossRaioZonas.js";

// =====================================================
// NOVO: CONTROLE DO SOM DO RAIO
// =====================================================

import {
  ativarMonitorSomRaioBoss,
  atualizarSomRaioBoss,
  pararSomRaioBoss,
} from "../../sounds/bossRaio.js";

// =====================================================
// IDENTIFICAR FRAMES DA ANIMAÇÃO DO BOSS
// =====================================================

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

export function exibirEstadoBoss(boss, estado) {
  const dados = estadosAnimacao[estado];

  if (!dados) {
    throw new RangeError(`Estado de animação do Boss desconhecido: ${estado}`);
  }

  if (boss.bossEstadoAtual === estado) {
    return;
  }

  // ===================================================
  // NOVO: CONTROLAR SOM AO TROCAR DE ESTADO
  // ===================================================

  if (estado === "raioChao") {
    // Inicia o monitoramento da animação.
    //
    // O áudio só vai começar a tocar quando
    // o raio realmente aparecer no chão.
    ativarMonitorSomRaioBoss(boss);
  } else {
    // Qualquer outro estado interrompe o som.
    // Isso impede que o áudio continue tocando
    // durante ataques diferentes.
    pararSomRaioBoss(boss);
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
// MIRA DO LASER ORIGINAL
// =====================================================

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

// Restaurado:
// não existe mais temporizador adicional
// esperando o raio completar 4,7 segundos.

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
  // FINALIZAR O RAIO JUNTO COM O BOSS
  // ===================================================

  if (estadoTerminado === "raioChao") {
    // Encerrar os raios visuais originais.
    limparRaioZona(boss);

    // NOVO: interromper o áudio do raio.
    pararSomRaioBoss(boss);
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

export function tratarAnimationUpdate(boss, animacao, frame, callbacks) {
  if (boss.morto) return;

  const ia = boss.iaCombate;

  if (!ia.ataqueAtual || animacao.key !== `boss-final-${ia.ataqueAtual}`) {
    return;
  }

  ia.frame = obterNumeroFrameAnimacao(frame);

  ia.jogadorAtual = boss.scene.player;

  // Hitboxes seguem os frames originais.
  atualizarHitboxesBoss(boss);

  // Mira do laser.
  atualizarMiraDurantePreparacao(boss, ia.jogadorAtual, ia.frame, callbacks);

  // Cura e dano dos outros ataques.
  callbacks.aplicarCuraDoFrame(boss);
  callbacks.aplicarDanoDoAtaque(boss);

  // ===================================================
  // ATUALIZAR RAIO SINCRONIZADO COM O BOSS
  // ===================================================

  if (ia.ataqueAtual === "raioChao") {
    // Atualização visual original do raio.
    atualizarRaioZona(boss);

    // =================================================
    // NOVO: SINCRONIZAR VOLUME COM O RAIO
    // =================================================
    //
    // Usa o mesmo tempo de animação visual.
    //
    // O controle contínuo também ocorre pelo
    // monitor de áudio, permitindo mudanças
    // suaves entre os frames.
    //
    // =================================================

    atualizarSomRaioBoss(boss);
  }

  const ataqueRaio = ia.ataqueAtual === "raioChao";

  // ===================================================
  // EVENTO DE ATAQUE
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

export function registrarListenersBoss(boss, callbacks) {
  if (boss.listenersRegistrados) {
    return;
  }

  boss.onAnimationUpdate = (animacao, frame) =>
    tratarAnimationUpdate(boss, animacao, frame, callbacks);

  boss.onAnimationComplete = (animacao) =>
    finalizarAnimacaoBoss(boss, animacao, callbacks);

  boss.sprite.on("animationupdate", boss.onAnimationUpdate);

  boss.sprite.on("animationcomplete", boss.onAnimationComplete);

  boss.listenersRegistrados = true;
}
