/** Um único compositor: ambiente leve e luminárias do Tiled na fábrica, efeitos próprios na arena. */
import criarIluminacaoTerror from "./TerrorLighting.js";

export default function criarIluminacaoBasicaFabrica(scene) {
  return criarIluminacaoTerror(scene, { ambienteBasico: true });
}
