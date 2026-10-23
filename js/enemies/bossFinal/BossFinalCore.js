/**
 * @file Núcleo do boss. Monta sprite, IA, vida, estamina, câmera de arena e HUD e coordena
 * atualização e liberação dos sistemas.
 */

import { criarHudBoss } from "./BossHud.js";

import {
  bossBaseY,
  bossDepth,
  bossVidaMaxima,
  estadosAnimacao,
  localizarPecasBoss,
} from "./BossConfig.js";

import {
  criarAnimacoesBoss,
  registrarListenersBoss,
  exibirEstadoBoss,
} from "./BossAnimacoes.js";

import {
  criarHitboxesBoss,
  removerColisaoBoss,
  atualizarHitboxesBoss,
} from "./BossHitboxes.js";

import {
  preverPosicaoJogador,
  observarEsquivaLaser,
  atualizarIABoss,
  solicitarAtaqueBoss as solicitarAtaqueOriginal,
} from "./BossIA.js";

import {
  aplicarCuraDoFrame,
  aplicarDanoDoAtaque,
  causarDanoBoss,
  processarAtaquesJogadorContraBoss,
} from "./BossCombate.js";

import {
  limparRaioZona,
  inicializarDebugZonasRaio,
  destruirDebugZonasRaio,
} from "./BossRaioZonas.js";

// =====================================================
// NOVO: CONTROLE DO SOM DO RAIO
// =====================================================

import { pararSomRaioBoss } from "../../sounds/bossRaio.js";
import {
  ARENA_X_MIN,
  ARENA_X_MAX,
  ENTRADA_ARENA_Y,
  jogadorNaEntradaArena,
} from "./BossEntrada.js";

// =====================================================
// POSIÇÃO E TAMANHO DO BOSS
// =====================================================

const POSICAO_BOSS_X = -1080;
const ESCALA_BOSS = 1.4;

// =====================================================
// ÁREA DE ZOOM DA ARENA
// =====================================================

// Margens para não sair da arena só por encostar
// nas paredes laterais ou oscilar perto da entrada.
const MARGEM_SAIDA_X = 70;
const MARGEM_SAIDA_Y = 80;

const FATOR_ZOOM_ARENA = 0.8;
const VELOCIDADE_ZOOM = 5;

// =====================================================
// NOVO: ATIVAÇÃO DO COMBATE NA ARENA
// =====================================================
//
// A IA utiliza a mesma propriedade dentroArena
// que já controla o zoom da câmera.
//
// ANTES DE ENTRAR:
// - Boss permanece em idle.
// - Não executa ataques.
// - Não reproduz sons de ataques.
//
// DENTRO DA ARENA:
// - IA funciona normalmente.
// - Ataques e animações são liberados.
//
// AO SAIR:
// - Ataque atual é cancelado.
// - Raios são removidos.
// - Áudio do raio é interrompido.
// - Boss retorna ao idle.
//
// A vida do Boss NÃO é reiniciada.
// =====================================================

// Tempo que o Boss aguarda antes de começar
// a decidir ataques ao entrar na arena.
const TEMPO_INICIAL_COMBATE = 1200;

// =====================================================
// VIDA E ESTAMINA
// =====================================================

const MULTIPLICADOR_VIDA = 2;
const ESTAMINA_MAXIMA = 100;

const CUSTO_ESTAMINA = {
  chao: 20,
  raio: 20,
  laser: 20,
  rec: 20,
};

const PAUSA_ESTAMINA_MS = 250;
const RECUPERACAO_ESTAMINA_MS = 3250;

// =====================================================
// NOVO: INTERROMPER COMBATE FORA DA ARENA
// =====================================================

/**
 * Cancela o combate ao sair da arena, limpa raios e observações antigas e prepara a próxima
 * entrada.
 */
function interromperCombateForaArena(boss) {
  if (!boss?.active) {
    return;
  }

  // ===================================================
  // INTERROMPER SOM DO RAIO
  // ===================================================

  // Para o áudio imediatamente, mesmo quando
  // o ataque ainda não terminou sua animação.
  pararSomRaioBoss(boss);

  // ===================================================
  // REMOVER RAIOS DO CHÃO
  // ===================================================

  // Remove os efeitos das zonas e da base do Boss.
  // Também desativa as áreas de dano dos raios.
  limparRaioZona(boss);

  if (boss.morto || !boss.iaCombate) {
    return;
  }

  const ia = boss.iaCombate;

  // ===================================================
  // CANCELAR ATAQUE ATUAL
  // ===================================================

  ia.ataqueAtual = null;
  ia.ataqueSolicitado = null;

  ia.frame = 0;

  ia.frameMiraTravada = null;
  ia.direcaoLaser = null;
  ia.posicaoNoDisparo = null;

  ia.zonasRaio = [];
  ia.areaRaio = null;

  ia.jogadorAtingidoNesteAtaque = false;

  // Cancelar qualquer cura que estava sendo
  // processada durante a animação.
  ia.framesCuraAplicados.clear();

  // ===================================================
  // LIMPAR OBSERVAÇÕES DO JOGADOR
  // ===================================================

  // Impede que a IA reutilize informações antigas
  // de movimentação ao entrar novamente na sala.
  ia.posicaoAnterior = null;
  ia.distanciaAnterior = null;

  ia.velocidadeX = 0;
  ia.velocidadeY = 0;

  ia.aproximacaoRadial = 0;

  ia.aproximando = false;
  ia.afastando = false;
  ia.correndo = false;
  ia.parado = true;

  ia.atacandoPerto = false;

  ia.distancia = Infinity;

  ia.pertoPor = 0;
  ia.longePor = 0;
  ia.pressaoPerto = 0;
  ia.paradoPor = 0;

  ia.regiaoAtual = null;
  ia.tempoNaRegiao = 0;

  ia.jogadorAtual = null;

  // ===================================================
  // REINICIAR CONTROLE DOS ATAQUES DO JOGADOR
  // ===================================================

  ia.ataqueJogadorAnterior = false;
  ia.janelaKatanaRestante = 0;
  ia.katanaAtingiuBoss = false;

  // ===================================================
  // RETORNAR BOSS PARA ANIMAÇÃO PARADA
  // ===================================================

  // Troca para o frame original de idle.
  exibirEstadoBoss(boss, "idle");

  // Garante que nenhuma animação continue tocando.
  boss.sprite.anims.stop();

  // ===================================================
  // PREPARAR A IA PARA A PRÓXIMA ENTRADA
  // ===================================================

  // Mantém a recuperação de estamina, caso
  // ela já estivesse acontecendo.
  if (boss.recuperandoEstamina) {
    ia.estado = "RECUPERANDO_ESTAMINA";
  } else {
    ia.estado = "IDLE";
  }

  ia.tempoAteDecidir = TEMPO_INICIAL_COMBATE;
}

// =====================================================
// CONTROLE DO ZOOM
// =====================================================

/**
 * Conecta o zoom de aproximação da arena e guarda a câmera e o zoom anteriores para
 * restauração.
 */
function configurarCameraArena(scene, boss) {
  let dentroArena = false;
  let controlandoZoom = false;
  let cameraControlada = null;
  let zoomNormal = 1;

  // ===================================================
  // BOSS COMEÇA FORA DO COMBATE
  // ===================================================

  boss.dentroArena = false;

  /**
   * Detecta a entrada e saída da arena e interpola o zoom conforme o delta, interrompendo
   * combate fora da área.
   */
  const atualizarCamera = (_tempo, delta = 16.67) => {
    const camera = scene.cameras.main;
    const player = scene.player;

    if (!camera) return;

    // Guardar estado anterior para detectar
    // quando o jogador SAIU da arena.
    const estavaDentroArena = dentroArena;

    if (cameraControlada && cameraControlada !== camera) {
      if (controlandoZoom) {
        cameraControlada.setZoom(zoomNormal);
      }

      dentroArena = false;
      controlandoZoom = false;
      cameraControlada = null;
    }

    const podeEntrar = boss.active && !boss.morto && player?.active;

    if (podeEntrar) {
      // Área com folga para permanecer.
      const dentroDaLarguraPermanencia =
        player.x >= ARENA_X_MIN - MARGEM_SAIDA_X &&
        player.x <= ARENA_X_MAX + MARGEM_SAIDA_X;

      if (!dentroArena) {
        const entrouNaArena = jogadorNaEntradaArena(player);

        if (entrouNaArena) {
          dentroArena = true;

          if (!controlandoZoom) {
            zoomNormal = camera.zoom;
            cameraControlada = camera;
            controlandoZoom = true;
          }
        }
      } else {
        const saiuPelosLados = !dentroDaLarguraPermanencia;

        const saiuPelaEntrada = player.y > ENTRADA_ARENA_Y + MARGEM_SAIDA_Y;

        if (saiuPelosLados || saiuPelaEntrada) {
          dentroArena = false;
        }
      }
    } else {
      dentroArena = false;
    }

    // =================================================
    // ATUALIZAR O ESTADO DA ARENA
    // =================================================

    // Esta propriedade controla tanto o zoom
    // quanto a ativação da inteligência do Boss.
    boss.dentroArena = dentroArena;

    // =================================================
    // NOVO: DETECTAR SAÍDA DO COMBATE
    // =================================================

    // Quando o jogador estava dentro e saiu,
    // interrompe o combate imediatamente.
    if (estavaDentroArena && !dentroArena) {
      interromperCombateForaArena(boss);
    }

    // =================================================
    // ZOOM ORIGINAL DA ARENA
    // =================================================

    if (!controlandoZoom) return;

    const destino = dentroArena ? zoomNormal * FATOR_ZOOM_ARENA : zoomNormal;

    const deltaSeguro = Number.isFinite(delta) ? Math.max(0, delta) : 16.67;

    const suavidade = 1 - Math.exp((-VELOCIDADE_ZOOM * deltaSeguro) / 1000);

    const novoZoom = camera.zoom + (destino - camera.zoom) * suavidade;

    if (Math.abs(novoZoom - destino) < 0.001) {
      camera.setZoom(destino);

      if (!dentroArena) {
        controlandoZoom = false;
        cameraControlada = null;
      }
    } else {
      camera.setZoom(novoZoom);
    }
  };

  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, atualizarCamera);

  /**
   * Remove a atualização de câmera e restaura o zoom e o estado de visibilidade da arena.
   */
  boss.limparCameraArena = () => {
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, atualizarCamera);

    if (controlandoZoom && cameraControlada) {
      cameraControlada.setZoom(zoomNormal);
    }

    dentroArena = false;
    boss.dentroArena = false;

    boss.hudVida?.setVisible(false);

    controlandoZoom = false;
    cameraControlada = null;
  };
}

// =====================================================
// RECUPERAÇÃO DE ESTAMINA
// =====================================================

/**
 * Interrompe o ataque ao esgotar estamina e coloca o boss em recuperação sem capacidade
 * ofensiva.
 */
function iniciarRecuperacaoEstamina(boss) {
  if (boss.morto || boss.recuperandoEstamina) return;

  boss.estamina = 0;
  boss.recuperandoEstamina = true;
  boss.tempoRecuperacaoEstamina = 0;

  const ia = boss.iaCombate;

  limparRaioZona(boss);

  ia.ataqueAtual = null;
  ia.ataqueSolicitado = null;
  ia.frameMiraTravada = null;
  ia.direcaoLaser = null;
  ia.posicaoNoDisparo = null;
  ia.zonasRaio = [];
  ia.areaRaio = null;
  ia.jogadorAtingidoNesteAtaque = false;
  ia.framesCuraAplicados.clear();
  ia.tempoAteDecidir = 0;

  exibirEstadoBoss(boss, "idle");
  boss.sprite.anims.stop();

  ia.estado = "RECUPERANDO_ESTAMINA";
}

/**
 * Avança a recuperação pelo tempo decorrido e libera novas decisões quando a estamina foi
 * restaurada.
 */
function atualizarRecuperacaoEstamina(boss, delta) {
  if (!boss.recuperandoEstamina) return;

  const deltaSeguro = Number.isFinite(delta) ? Math.max(0, delta) : 16.67;

  boss.tempoRecuperacaoEstamina += deltaSeguro;

  const ia = boss.iaCombate;

  ia.ataqueSolicitado = null;
  ia.tempoAteDecidir = 0;
  ia.estado = "RECUPERANDO_ESTAMINA";

  ia.cooldownRecVidaRestante = Math.max(
    0,
    ia.cooldownRecVidaRestante - deltaSeguro,
  );

  const tempoEnchendo = Math.max(
    0,
    boss.tempoRecuperacaoEstamina - PAUSA_ESTAMINA_MS,
  );

  const progresso = Phaser.Math.Clamp(
    tempoEnchendo / RECUPERACAO_ESTAMINA_MS,
    0,
    1,
  );

  boss.estamina = boss.estaminaMaxima * progresso;

  if (progresso >= 1) {
    boss.estamina = boss.estaminaMaxima;
    boss.recuperandoEstamina = false;
    boss.tempoRecuperacaoEstamina = 0;

    ia.estado = "IDLE";
    ia.tempoAteDecidir = 0;
    ia.posicaoAnterior = null;
    ia.distanciaAnterior = null;
  }
}

// =====================================================
// CRIAÇÃO DO BOSS
// =====================================================

/**
 * Monta o boss a partir das peças do mapa e inicializa sprite, combate, estamina, câmera e
 * interface.
 */
function criarBoss(scene) {
  const pecas = localizarPecasBoss(scene);

  if (pecas.length === 0) {
    console.error(
      "IA do Boss: peças ausentes na camada ObjetosBoss perto da posição-base.",
    );

    return null;
  }

  criarAnimacoesBoss(scene);

  pecas.forEach((peca) => peca.destroy());

  const boss = scene.add
    .container(POSICAO_BOSS_X, bossBaseY)
    .setDepth(bossDepth)
    .setName("boss-final");

  boss.bossBaseX = POSICAO_BOSS_X;
  boss.bossBaseY = bossBaseY;

  boss.bossEstadoAtual = "idle";
  boss.morto = false;

  // ===================================================
  // VIDA
  // ===================================================

  boss.vidaMaxima = bossVidaMaxima * MULTIPLICADOR_VIDA;

  boss.vida = boss.vidaMaxima;

  // ===================================================
  // ESTAMINA
  // ===================================================

  boss.estaminaMaxima = ESTAMINA_MAXIMA;
  boss.estamina = ESTAMINA_MAXIMA;
  boss.recuperandoEstamina = false;
  boss.tempoRecuperacaoEstamina = 0;

  // ===================================================
  // SPRITE DO BOSS
  // ===================================================

  boss.sprite = scene.add
    .sprite(0, 0, estadosAnimacao.idle.textura, 0)
    .setOrigin(0.5, 1)
    .setScale(ESCALA_BOSS);

  boss.add(boss.sprite);

  boss.estadosAnimacao = estadosAnimacao;

  boss.debugDano = scene.add.graphics().setDepth(bossDepth + 2);

  // ===================================================
  // INTELIGÊNCIA ARTIFICIAL
  // ===================================================

  boss.iaCombate = {
    estado: "IDLE",
    ataqueAtual: null,
    ataqueSolicitado: null,

    tempoAteDecidir: TEMPO_INICIAL_COMBATE,

    ataquesRecentes: [],

    posicaoAnterior: null,
    distanciaAnterior: null,

    velocidadeX: 0,
    velocidadeY: 0,

    direcao: {
      x: 0,
      y: 0,
    },

    aproximacaoRadial: 0,

    aproximando: false,
    afastando: false,
    correndo: false,
    parado: true,

    atacandoPerto: false,

    distancia: Infinity,

    pertoPor: 0,
    longePor: 0,
    pressaoPerto: 0,
    paradoPor: 0,

    regiaoAtual: null,
    tempoNaRegiao: 0,

    aprendizadoEsquiva: 0,
    tendenciaEsquiva: [],

    posicaoNoDisparo: null,
    frameMiraTravada: null,

    frame: 0,

    direcaoLaser: null,

    zonasRaio: [],
    areaRaio: null,

    jogadorAtingidoNesteAtaque: false,

    framesCuraAplicados: new Set(),

    cooldownRecVidaRestante: 0,

    jogadorAtual: scene.player || null,

    ataqueJogadorAnterior: false,
    janelaKatanaRestante: 0,
    katanaAtingiuBoss: false,
  };

  criarHitboxesBoss(scene, boss);
  criarHudBoss(scene, boss);
  configurarCameraArena(scene, boss);

  inicializarDebugZonasRaio(boss);

  // ===================================================
  // CUSTO DE ESTAMINA POR ATAQUE
  // ===================================================

  /**
   * Desconta o custo de estamina ao terminar um ataque e inicia a recuperação se o saldo
   * acabou.
   */
  const aoFinalizarAtaque = (evento) => {
    if (evento?.boss !== boss || boss.morto || boss.recuperandoEstamina) {
      return;
    }

    const custo = CUSTO_ESTAMINA[evento.ataque];

    if (!Number.isFinite(custo)) return;

    boss.estamina = Phaser.Math.Clamp(
      boss.estamina - custo,
      0,
      boss.estaminaMaxima,
    );

    if (boss.estamina <= 0) {
      iniciarRecuperacaoEstamina(boss);
    }
  };

  scene.events.on("boss:ataque-finalizado", aoFinalizarAtaque);

  /**
   * Cancela a assinatura que desconta estamina na conclusão dos ataques.
   */
  boss.limparEstamina = () => {
    scene.events.off("boss:ataque-finalizado", aoFinalizarAtaque);
  };

  boss.onAnimationUpdate = null;
  boss.onAnimationComplete = null;

  // ===================================================
  // NOVO: BOSS COMEÇA SEM EXECUTAR ANIMAÇÕES
  // ===================================================

  boss.sprite.anims.stop();

  return boss;
}

// =====================================================
// VINCULAR BOSS
// =====================================================

/**
 * Cria ou reutiliza o boss e conecta animações, hitboxes e rotinas de encerramento da cena.
 */
export function vincularIABoss(scene) {
  if (scene.bossFinal?.active) {
    return scene.bossFinal;
  }

  const boss = criarBoss(scene);

  if (!boss) return null;

  registrarListenersBoss(boss, {
    preverPosicaoJogador,
    observarEsquivaLaser,
    aplicarCuraDoFrame,
    aplicarDanoDoAtaque,
  });

  scene.bossFinal = boss;

  atualizarHitboxesBoss(boss);

  let limpo = false;

  /**
   * Executa a limpeza e destrói o container do boss ao encerrar a cena.
   */
  const aoEncerrarCena = () => {
    limparBoss();

    if (boss.scene) {
      boss.destroy();
    }
  };

  /**
   * Libera listeners, câmera, HUD, sons, raios e colisões uma única vez e limpa a referência
   * na cena.
   */
  const limparBoss = () => {
    if (limpo) return;

    limpo = true;

    scene.events.off(Phaser.Scenes.Events.SHUTDOWN, aoEncerrarCena);

    if (boss.sprite?.scene) {
      boss.sprite.off("animationupdate", boss.onAnimationUpdate);

      boss.sprite.off("animationcomplete", boss.onAnimationComplete);
    }

    // =================================================
    // LIMPEZA DOS SISTEMAS DO BOSS
    // =================================================

    boss.limparCameraArena?.();
    boss.limparHudVida?.();
    boss.limparEstamina?.();

    // Interromper áudio do raio quando
    // o Boss for removido da cena.
    pararSomRaioBoss(boss);

    limparRaioZona(boss);
    destruirDebugZonasRaio(boss);

    removerColisaoBoss(boss);

    for (const hitbox of boss.hitboxesColisao || []) {
      if (hitbox.scene) {
        hitbox.destroy();
      }
    }

    if (boss.debugDano?.scene) {
      boss.debugDano.destroy();
    }

    if (scene.bossFinal === boss) {
      scene.bossFinal = null;
    }
  };

  boss.once("destroy", limparBoss);

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, aoEncerrarCena);

  return boss;
}

// =====================================================
// PEDIDO DE ATAQUE
// =====================================================

/**
 * Encaminha um pedido de ataque somente com o boss ativo, fora de recuperação e dentro da
 * arena.
 */
function solicitarAtaqueBoss(scene, ataque) {
  const boss = scene.bossFinal;

  if (!boss?.active || boss.morto || boss.recuperandoEstamina) {
    return false;
  }

  // ===================================================
  // NOVO: NÃO PERMITIR ATAQUES FORA DA ARENA
  // ===================================================

  // Usa exatamente a mesma condição do zoom.
  if (boss.dentroArena !== true) {
    return false;
  }

  return solicitarAtaqueOriginal(scene, ataque);
}

// =====================================================
// ATUALIZAÇÃO
// =====================================================

/**
 * Coordena a atualização de recuperação ou IA, os efeitos ofensivos, as hitboxes e os acertos
 * do jogador.
 */
function atualizarBoss(scene, delta = 16.67) {
  const boss = scene.bossFinal;

  if (!boss?.active || boss.morto) {
    return;
  }

  // ===================================================
  // NOVO: IA ATIVA SOMENTE DENTRO DA ARENA
  // ===================================================
  //
  // O Boss só começa a funcionar depois que
  // dentroArena ficar true.
  //
  // Essa propriedade é controlada pela mesma
  // função que ativa o zoom da câmera.
  //
  // Antes disso:
  // - Não escolhe ataques.
  // - Não executa animações.
  // - Não ativa raios.
  // - Não inicia sons de ataques.
  //
  // ===================================================

  if (boss.dentroArena !== true) {
    return;
  }

  // ===================================================
  // RECUPERAÇÃO DE ESTAMINA ORIGINAL
  // ===================================================

  if (boss.recuperandoEstamina) {
    atualizarRecuperacaoEstamina(boss, delta);

    atualizarHitboxesBoss(boss);

    processarAtaquesJogadorContraBoss(scene, delta);

    return;
  }

  // ===================================================
  // INTELIGÊNCIA ARTIFICIAL ORIGINAL
  // ===================================================

  atualizarIABoss(scene, delta);

  atualizarHitboxesBoss(boss);

  processarAtaquesJogadorContraBoss(scene, delta);
}

export {
  atualizarBoss as atualizarIABoss,
  causarDanoBoss,
  solicitarAtaqueBoss,
};
