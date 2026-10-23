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
// ATUALIZAR CONTROLES
// =====================================================

function atualizarControles(scene) {
  // Movimento normal e dash.
  atualizarMovimento(scene);

  // Delta real do loop do Phaser.
  const delta = scene.game?.loop?.delta ?? 16.67;

  // Habilidades especiais e seus efeitos.
  atualizarSistemaEspeciais(scene, delta);
}

// =====================================================
// EXPORTAÇÕES
// =====================================================

export { criarControles, atualizarControles };
