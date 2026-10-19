import { criarControlesInput } from "./PlayerInput.js";
import { criarControlesAtaque } from "./PlayerAttackControls.js";
import { criarMovimento, atualizarMovimento } from "./PlayerMovement.js";
import { criarControlesDash } from "./PlayerDashControls.js";

function criarControles(scene) {
  criarControlesInput(scene);
  criarMovimento(scene);
  criarControlesAtaque(scene);

  // DASH - criado após o ataque para usar sua posição.
  criarControlesDash(scene);
}

function atualizarControles(scene) {
  atualizarMovimento(scene);
}

export { criarControles, atualizarControles };