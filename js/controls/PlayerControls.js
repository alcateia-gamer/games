/**
 * @file Integra os controles de entrada,
 * movimento, ataque, dash e especial.
 */

import { criarControlesInput } from "./PlayerInput.js";

import { criarControlesAtaque } from "./PlayerAttackControls.js";

import { criarMovimento, atualizarMovimento } from "./PlayerMovement.js";

import { criarControlesDash } from "./PlayerDashControls.js";

import { criarControlesEspecial } from "./PlayerSpecialControls.js";

// =====================================================
// CRIAR TODOS OS CONTROLES
// =====================================================

function criarControles(scene) {
  criarControlesInput(scene);

  criarMovimento(scene);

  criarControlesAtaque(scene);

  // Sandevistan original
  criarControlesDash(scene);

  // Novo botão de ataque especial
  criarControlesEspecial(scene);
}

// =====================================================
// ATUALIZAR CONTROLES
// =====================================================

function atualizarControles(scene) {
  atualizarMovimento(scene);
}

// =====================================================
// EXPORTAÇÕES
// =====================================================

export { criarControles, atualizarControles };
