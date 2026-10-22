/**
 * @file Pontos de luz da fábrica, partida sincronizada com o gerador e falhas elétricas.
 * Não cria sprites nem altera coordenadas do Tiled: fornece luzes à máscara compartilhada.
 */

import { GENERATOR_LOOP_START_SECONDS } from "../sounds/gerador.js";

const ESCURIDAO_AMBIENTE_FABRICA = 0.55;
const MULTIPLICADOR_ALCANCE_FABRICA = 1.5;
const PADROES_LUZ_FABRICA = Object.freeze({
  raio: 170, intensidade: 1, cor: "#FFD27A", piscando: false, ligada: true,
  orientacao: "horizontal",
});
const PARTIDA_GERADOR = [
  [0, 0], [0.06, 0.025], [0.13, 0.09], [0.18, 0.03],
  [0.28, 0.22], [0.34, 0.08], [0.46, 0.4], [0.5, 0.14],
  [0.62, 0.56], [0.66, 0.28], [0.78, 0.78], [0.83, 0.69],
  [0.92, 0.94], [1, 1],
];
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

/** Tiled exporta cores com alpha como #AARRGGBB, não #RRGGBBAA. */
function lerCorTiled(valor) {
  if (typeof valor !== "string") valor = PADROES_LUZ_FABRICA.cor;
  let hex = valor.replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex)) hex = [...hex].map(c => c + c).join("");
  if (!/^(?:[\da-f]{6}|[\da-f]{8})$/i.test(hex)) hex = "FFD27A";
  const alpha = hex.length === 8 ? parseInt(hex.slice(0, 2), 16) / 255 : 1;
  const rgb = hex.slice(-6).toUpperCase();
  return { css: `#${rgb}`, phaser: parseInt(rgb, 16), alpha };
}

function lerPropriedade(objeto, nome) {
  const propriedades = objeto.properties;
  return Array.isArray(propriedades)
    ? propriedades.find(propriedade => propriedade.name === nome)?.value
    : propriedades?.[nome];
}

/** Só valores dos tipos esperados substituem os padrões; false e zero são válidos. */
function lerLuzesFabrica(map, avisar = console.warn) {
  const camada = map.getObjectLayer("LuzesFabrica");
  if (!camada) {
    avisar('[Iluminação da fábrica] Camada de objetos "LuzesFabrica" ausente. Nenhuma lâmpada foi criada.');
    return [];
  }
  return (camada.objects ?? []).flatMap(objeto => {
    if (objeto.point !== true || !Number.isFinite(objeto.x) || !Number.isFinite(objeto.y)) {
      avisar(`[Iluminação da fábrica] Objeto ${objeto.id} ignorado: use Point com X/Y válidos em LuzesFabrica.`);
      return [];
    }
    const raio = lerPropriedade(objeto, "Raio");
    const intensidade = lerPropriedade(objeto, "Intensidade");
    const piscando = lerPropriedade(objeto, "Piscando");
    const ligada = lerPropriedade(objeto, "Ligada");
    const orientacaoConfigurada = lerPropriedade(objeto, "Orientacao");
    const orientacao = typeof orientacaoConfigurada === "string"
      ? orientacaoConfigurada.toLowerCase()
      : null;
    return [{
      id: objeto.id, x: objeto.x, y: objeto.y,
      raio: Number.isInteger(raio) && raio > 0 ? raio : PADROES_LUZ_FABRICA.raio,
      intensidade: typeof intensidade === "number" && Number.isFinite(intensidade) && intensidade >= 0
        ? intensidade : PADROES_LUZ_FABRICA.intensidade,
      cor: lerCorTiled(lerPropriedade(objeto, "Cor")),
      piscando: typeof piscando === "boolean" ? piscando : PADROES_LUZ_FABRICA.piscando,
      ligada: (typeof ligada === "boolean" ? ligada : PADROES_LUZ_FABRICA.ligada) &&
        camada.visible !== false && objeto.visible !== false,
      orientacao: ["horizontal", "vertical"].includes(orientacao)
        ? orientacao : PADROES_LUZ_FABRICA.orientacao,
    }];
  });
}

/** Usa a matriz já atualizada da câmera, inclusive scroll negativo, zoom e viewport. */
function luzAfetaCamera(luz, camera) {
  const matriz = camera.matrix;
  const x = matriz.a * luz.x + matriz.c * luz.y + matriz.e;
  const y = matriz.b * luz.x + matriz.d * luz.y + matriz.f;
  const alcance = luz.raio * MULTIPLICADOR_ALCANCE_FABRICA;
  const raioX = alcance * Math.hypot(matriz.a, matriz.c);
  const raioY = alcance * Math.hypot(matriz.b, matriz.d);
  return x + raioX > 0 && x - raioX < camera.width &&
    y + raioY > 0 && y - raioY < camera.height;
}

class FactoryLighting {
  constructor(map, { aleatorio = Math.random, avisar = console.warn } = {}) {
    this.lampadas = lerLuzesFabrica(map, avisar);
    this.aleatorio = aleatorio;
    this.energia = false;
    this.partida = null;
    this.fontesVisiveis = [];
    this.revisao = 0;
    // Estados separados dos dados do mapa: nada é escrito nos objetos do Tiled.
    this.estados = this.lampadas.map((luz, indice) => ({
      luz, indice, intensidade: 0, proximaFalha: null, falha: null,
    }));
  }

  definirEnergia(ligada, obterProgresso = null, agora = 0) {
    this.energia = ligada === true;
    this.partida = this.energia && typeof obterProgresso === "function"
      ? { obterProgresso, inicio: agora } : null;
    for (const estado of this.estados) {
      estado.proximaFalha = null;
      estado.falha = null;
    }
  }

  /** Piscadas breves e visíveis, com recuperação suave e intervalos irregulares. */
  calcularFalha(estado, agora) {
    if (estado.proximaFalha === null) {
      estado.proximaFalha = agora + 2000 + this.aleatorio() * 3000;
    }
    if (!estado.falha && agora >= estado.proximaFalha) {
      estado.falha = {
        inicio: agora, duracao: 900 + this.aleatorio() * 300,
        queda: 0.45 + this.aleatorio() * 0.35,
      };
    }
    const falha = estado.falha;
    if (!falha) return 1;
    const p = (agora - falha.inicio) / falha.duracao;
    if (p >= 1) {
      estado.falha = null;
      estado.proximaFalha = agora + 2000 + this.aleatorio() * 3000;
      return 1;
    }
    return 1 - falha.queda * Math.sin(Math.PI * p) ** 2;
  }

  atualizar(agora, camera) {
    let progresso = 1;
    if (this.partida) {
      const medido = this.partida.obterProgresso();
      progresso = typeof medido === "number" && Number.isFinite(medido)
        ? limitar(medido)
        : limitar((agora - this.partida.inicio) / (GENERATOR_LOOP_START_SECONDS * 1000));
      if (progresso >= 1) this.partida = null;
    }
    const energia = this.energia ? intensidadeLuzPartida(progresso) : 0;
    let quantidade = 0;
    let alteradas = false;
    for (const estado of this.estados) {
      const luz = estado.luz;
      if (!energia || !luz.ligada || !luz.intensidade || !luz.cor.alpha || !luzAfetaCamera(luz, camera)) {
        continue;
      }
      const oscilacao = this.partida
        ? 1 - (1 - progresso) * 0.12 * Math.sin(progresso * 15 + estado.indice) ** 2
        : luz.piscando ? this.calcularFalha(estado, agora) : 1;
      // Limita e quantiza em passos de alpha: evita saturação e uploads sem mudança visível.
      const intensidade = Math.round(limitar(luz.intensidade * luz.cor.alpha) * energia * oscilacao * 255) / 255;
      if (this.fontesVisiveis[quantidade] !== estado || estado.intensidade !== intensidade) alteradas = true;
      estado.intensidade = intensidade;
      this.fontesVisiveis[quantidade++] = estado;
    }
    if (quantidade !== this.fontesVisiveis.length) alteradas = true;
    this.fontesVisiveis.length = quantidade;
    if (alteradas) this.revisao++;
    return this.fontesVisiveis;
  }

  destroy() {
    this.partida = null;
    this.energia = false;
    this.fontesVisiveis.length = 0;
    this.estados.length = 0;
    this.lampadas.length = 0;
  }
}

export {
  ESCURIDAO_AMBIENTE_FABRICA, MULTIPLICADOR_ALCANCE_FABRICA, PADROES_LUZ_FABRICA, lerCorTiled,
  lerLuzesFabrica, luzAfetaCamera, intensidadeLuzPartida,
};
export default FactoryLighting;
