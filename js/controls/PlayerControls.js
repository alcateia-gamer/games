import { criarControlesInput } from "./PlayerInput.js";
import { criarControlesAtaque } from "./PlayerAttackControls.js";
import { criarMovimento, atualizarMovimento } from "./PlayerMovement.js";

function criarControles(scene) {
  criarControlesInput(scene);
  criarMovimento(scene);
  criarControlesAtaque(scene);
}

function atualizarControles(scene) {
  atualizarMovimento(scene);
}

export { criarControles, atualizarControles };
