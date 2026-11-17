import { obterPiscadasPartida } from "../sounds/luzFabrica.js";
import { QUEDAS_LUZ_FABRICA } from "./FactoryLighting.js";
import { GENERATOR_LOOP_START_SECONDS } from "../sounds/gerador.js";

const ESCURIDAO_AMBIENTE_BASICO = 0.4;
const piscadas = obterPiscadasPartida(QUEDAS_LUZ_FABRICA, { consecutivas: true });

const INICIO_TRANSICAO = 1.2;
const INICIO_OSCILACOES = piscadas[0].inicioSom;
const FIM_OSCILACOES = piscadas.at(-1).inicioSom + piscadas.at(-1).duracaoOscilacao;
const suavizar = t => t * t * (3 - 2 * t);

/** Espera a ativação; acende gradualmente e só atinge o brilho final após os três ciclos. */
function alphaOscilacaoFabrica(progresso, partida = false) {
  if (!partida) return ESCURIDAO_AMBIENTE_BASICO;
  const tempo = Math.max(0, Math.min(1, progresso)) * GENERATOR_LOOP_START_SECONDS;
  if (tempo <= INICIO_TRANSICAO) return 0.75;
  if (tempo < INICIO_OSCILACOES) {
    return 0.75 - 0.2 * suavizar((tempo - INICIO_TRANSICAO) / (INICIO_OSCILACOES - INICIO_TRANSICAO));
  }
  if (tempo >= FIM_OSCILACOES) return ESCURIDAO_AMBIENTE_BASICO;
  const avanco = (tempo - INICIO_OSCILACOES) / (FIM_OSCILACOES - INICIO_OSCILACOES);
  const base = 0.55 + (ESCURIDAO_AMBIENTE_BASICO - 0.55) * suavizar(avanco);
  let queda = 0;
  for (const piscada of piscadas) {
    const fase = (tempo - piscada.inicioSom) / piscada.duracaoOscilacao;
    if (fase > 0 && fase < 1) queda = Math.sin(Math.PI * fase) ** 2;
  }
  return base + 0.12 * queda;
}

export { ESCURIDAO_AMBIENTE_BASICO, alphaOscilacaoFabrica };
