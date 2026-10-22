/**
 * Controles do jogador:
 * movimento, ataque, dash e habilidades especiais.
 */

import { criarControlesInput } from "./PlayerInput.js";

import { criarControlesAtaque } from "./PlayerAttackControls.js";

import { criarMovimento, atualizarMovimento } from "./PlayerMovement.js";

import { criarControlesDash } from "./PlayerDashControls.js";

import { criarControlesEspecial } from "./PlayerSpecialControls.js";

import {
  criarSistemaEspeciais,
  atualizarSistemaEspeciais,
} from "../combat/PlayerSpecialAbilities.js";

// =====================================================
// CRIAR CONTROLES
// =====================================================

function criarControles(scene) {
  criarControlesInput(scene);

  criarMovimento(scene);

  criarControlesAtaque(scene);

  // Sandevistan original.
  criarControlesDash(scene);

  // Botão especial original.
  criarControlesEspecial(scene);

  // Mecânicas exclusivas.
  criarSistemaEspeciais(scene);
}

// =====================================================
// UPDATE
// =====================================================

function atualizarControles(scene) {
  atualizarMovimento(scene);

  // Atualizar habilidades, projéteis refletidos
  // e efeitos especiais ativos.
  atualizarSistemaEspeciais(scene);
}

export { criarControles, atualizarControles };
