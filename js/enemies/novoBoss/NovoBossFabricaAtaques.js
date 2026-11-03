/** Definições comuns à verdadeira e às reproduções visuais das cópias. */
import { criarChuvaRaios } from "./ataques/ChuvaRaios.js";
import { criarPulsoRepulsao } from "./ataques/PulsoRepulsao.js";
import { criarLasersEspiral } from "./ataques/LasersEspiral.js";
import { criarTentaculos } from "./ataques/Tentaculos.js";

const tipos = Object.freeze({
  pulso: [criarPulsoRepulsao, "pulsoRepulsao"],
  chuva: [criarChuvaRaios, "chuvaRaios"],
  lasers: [criarLasersEspiral, "lasersEspiral"],
  tentaculos: [criarTentaculos, "tentaculos"],
});

export function definicaoAtaqueNovoBoss(tipo) {
  return tipos[tipo] ?? null;
}
