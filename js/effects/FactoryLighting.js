/** Estado uniforme de energia e perfil da partida do gerador. */
import { GENERATOR_LOOP_START_SECONDS } from "../sounds/gerador.js";

const ESCURIDAO_AMBIENTE_FABRICA = 0.75;
const MULTIPLICADOR_ALCANCE_FABRICA = 1.5;
const PARTIDA_GERADOR = [
  [0, 0], [0.06, 0.025], [0.13, 0.09], [0.18, 0.03],
  [0.28, 0.22], [0.34, 0.08], [0.46, 0.4], [0.5, 0.14],
  [0.62, 0.56], [0.66, 0.28], [0.78, 0.78], [0.83, 0.69],
  [0.92, 0.94], [1, 1],
];
// Quedas da partida usadas pelo som; as falhas aleatórias não participam desta sequência.
const QUEDAS_LUZ_FABRICA = PARTIDA_GERADOR.flatMap(([inicio, luz], indice) => {
  const proximo = PARTIDA_GERADOR[indice + 1];
  return proximo && luz > proximo[1]
    ? [{
      inicio,
      inicioOscilacao: PARTIDA_GERADOR[indice - 1]?.[0] ?? inicio,
      fim: proximo[0],
      intensidade: luz - proximo[1],
    }]
    : [];
});
const limitar = valor => Math.max(0, Math.min(1, valor));
function suavizar(valor) {
  const p = limitar(valor);
  return p * p * (3 - 2 * p);
}

function intensidadeLuzPartida(progresso) {
  const p = limitar(progresso);
  for (let i = 1; i < PARTIDA_GERADOR.length; i += 1) {
    const [fim, luzFim] = PARTIDA_GERADOR[i];
    if (p > fim) continue;
    const [inicio, luzInicio] = PARTIDA_GERADOR[i - 1];
    return luzInicio + (luzFim - luzInicio) * suavizar((p - inicio) / (fim - inicio));
  }
  return 1;
}

/** Usa a matriz já atualizada da câmera, inclusive scroll negativo, zoom e viewport. */
function luzAfetaCamera(luz, camera, escalaX, escalaY) {
  const matriz = camera.matrix;
  if (luz.area) {
    const cos = Math.cos(luz.rotacao), sin = Math.sin(luz.rotacao);
    const cx = luz.x + cos * luz.largura / 2 - sin * luz.altura / 2;
    const cy = luz.y + sin * luz.largura / 2 + cos * luz.altura / 2;
    const x = matriz.a * cx + matriz.c * cy + matriz.e;
    const y = matriz.b * cx + matriz.d * cy + matriz.f;
    const rx = (Math.abs(matriz.a * cos + matriz.c * sin) * luz.largura +
      Math.abs(-matriz.a * sin + matriz.c * cos) * luz.altura) / 2;
    const ry = (Math.abs(matriz.b * cos + matriz.d * sin) * luz.largura +
      Math.abs(-matriz.b * sin + matriz.d * cos) * luz.altura) / 2;
    return x + rx > 0 && x - rx < camera.width && y + ry > 0 && y - ry < camera.height;
  }
  const x = matriz.a * luz.x + matriz.c * luz.y + matriz.e;
  const y = matriz.b * luz.x + matriz.d * luz.y + matriz.f;
  const alcance = luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
  const raioX = alcance * (escalaX ?? Math.hypot(matriz.a, matriz.c));
  const raioY = alcance * (escalaY ?? Math.hypot(matriz.b, matriz.d));
  return x + raioX > 0 && x - raioX < camera.width &&
    y + raioY > 0 && y - raioY < camera.height;
}

/** Estado de energia e relógio da partida; não lê nem armazena fontes do mapa. */
class FactoryLighting {
  constructor() { this.energia = false; this.partida = null; this.progressoPartida = null; }
  definirEnergia(ligada, obterProgresso = null, agora = 0) {
    this.energia = ligada === true;
    this.progressoPartida = null;
    this.partida = this.energia && typeof obterProgresso === 'function' ? { obterProgresso, inicio: agora } : null;
  }
  atualizarPartida(agora) {
    this.progressoPartida = null;
    if (!this.partida) return 1;
    const medido = this.partida.obterProgresso();
    const p = Number.isFinite(medido) ? limitar(medido) : limitar((agora-this.partida.inicio)/(GENERATOR_LOOP_START_SECONDS*1000));
    this.progressoPartida = p;
    if (p >= 1) this.partida = null;
    return p;
  }
  destroy() { this.partida = null; this.progressoPartida = null; }
}
export { ESCURIDAO_AMBIENTE_FABRICA, MULTIPLICADOR_ALCANCE_FABRICA, luzAfetaCamera, intensidadeLuzPartida, QUEDAS_LUZ_FABRICA };
export default FactoryLighting;
