/**
 * @file Integra os controles de entrada, movimento, ataque e dash usados pelas cenas de jogo.
 */

import { criarControlesInput } from "./PlayerInput.js";
import { criarControlesAtaque } from "./PlayerAttackControls.js";
import { criarMovimento, atualizarMovimento } from "./PlayerMovement.js";
import { criarControlesDash } from "./PlayerDashControls.js";

/**
 * Inicializa entrada, movimento e ataque antes do dash, que usa a posição do botão de ataque.
 */
function criarControles(scene) {
  criarControlesInput(scene);
  criarMovimento(scene);
  criarControlesAtaque(scene);

  // DASH - criado após o ataque para usar sua posição.
  criarControlesDash(scene);
}

/**
 * Executa a atualização de movimento do jogador a cada quadro da cena.
 */
function atualizarControles(scene) {
  atualizarMovimento(scene);
}

export { criarControles, atualizarControles };