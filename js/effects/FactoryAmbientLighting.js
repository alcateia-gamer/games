/** Um único compositor: ambiente leve na fábrica e efeitos originais restritos ao boss. */
import criarIluminacaoTerror from "./TerrorLighting.js";

export default function criarIluminacaoBasicaFabrica(scene) {
  return criarIluminacaoTerror(scene, { ambienteBasico: true });
}
