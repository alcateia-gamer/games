/**
 * @file Integra o núcleo do boss ao efeito de rachaduras permanentes no chão e reexporta sua
 * API de combate.
 */

// =====================================================
// BOSS FINAL - INTEGRAÇÃO DOS SISTEMAS
// =====================================================
//
// Mantém todas as funções originais do Boss.
//
// Adiciona somente o sistema de rachaduras
// permanentes no chão.
//
// Não altera:
// - Inteligência artificial.
// - Animações.
// - Ataques.
// - Dano.
// - Hitboxes.
// - Sons.
// - Sistema de morte.
// =====================================================

import {
  causarDanoBoss,
  solicitarAtaqueBoss,
  atualizarIABoss,
  vincularIABoss as vincularIABossOriginal,
} from "./BossFinalCore.js";

// =====================================================
// NOVO: SISTEMA DE CHÃO QUEBRADO
// =====================================================

import { prepararEntradaBoss } from "./BossEntrada.js";

import { configurarChaoQuebradoBoss } from "./BossChaoQuebrado.js";

// =====================================================
// VINCULAR O BOSS À CENA
// =====================================================

/**
 * Cria e vincula o boss pelo núcleo e acrescenta os listeners que desenham as rachaduras de
 * impacto.
 */
function vincularIABoss(scene) {
  // Criar e configurar o Boss normalmente.
  const boss = vincularIABossOriginal(scene);

  if (!boss) {
    return null;
  }

  // ===================================================
  // ATIVAR CONTROLE DAS RACHADURAS
  // ===================================================
  //
  // O novo sistema apenas escuta os eventos
  // de impacto que o Boss já produz.
  //
  // Não interfere no funcionamento da IA.
  // ===================================================

  configurarChaoQuebradoBoss(scene, boss);

  return boss;
}

// =====================================================
// EXPORTAÇÕES ORIGINAIS
// =====================================================

function prepararIABoss(scene) {
  prepararEntradaBoss(scene, vincularIABoss);
}

export { causarDanoBoss, solicitarAtaqueBoss, atualizarIABoss, vincularIABoss, prepararIABoss };
