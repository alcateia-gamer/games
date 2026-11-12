/** Neons fixos com alimentação de emergência, separados do gerador. */
import { lerCorTiled, luzAfetaCamera } from "./FactoryLighting.js";
import { padraoNeonFabrica } from "./FactoryNeonDefaults.js";

const CAMADA_LUZ_EMERGENCIA = "Luzedeemergencia";

function propriedade(objeto, nome) {
  return Array.isArray(objeto.properties)
    ? objeto.properties.find(item => item.name === nome)?.value
    : objeto.properties?.[nome];
}

export function lerLuzesEmergencia(map, avisar = console.warn) {
  const camada = map.getObjectLayer(CAMADA_LUZ_EMERGENCIA);
  // O Phaser pode não manter o ID da camada; ZonaBoss identifica a fábrica nesse caso.
  const fabrica = camada?.id === 53 || Boolean(map.getObjectLayer("ZonaBoss"));
  return (camada?.objects ?? []).flatMap(objeto => {
    if (objeto.point !== true || !Number.isFinite(objeto.x) || !Number.isFinite(objeto.y)) {
      avisar(`[Neon] Objeto ${objeto.id} ignorado: use Point com X/Y válidos em ${CAMADA_LUZ_EMERGENCIA}.`);
      return [];
    }
    const raio = propriedade(objeto, "Raio");
    const intensidade = propriedade(objeto, "Intensidade");
    // A substituição do mapa pode apagar nomes e propriedades. Os LEDs já configurados
    // também têm padrões externos ao JSON; propriedades explícitas prevalecem.
    const padrao = fabrica ? padraoNeonFabrica(objeto.id) : null;
    const nomeNeon = /^neon (vermelho|amarelo) (horizontal|vertical)$/i.exec(objeto.name?.trim() ?? "");
    const neon = (propriedade(objeto, "Neon") ?? Boolean(nomeNeon || padrao)) === true;
    const cor = propriedade(objeto, "Cor") ?? (nomeNeon
      ? (nomeNeon[1].toLowerCase() === "amarelo" ? "#FFD35A" : "#FF101C")
      : padrao?.cor ?? "#FF101C");
    const orientacao = propriedade(objeto, "Orientacao") ??
      (nomeNeon ? (nomeNeon[2].toLowerCase() === "vertical" ? "Vertical" : "Horizontal")
        : padrao?.orientacao ?? "Horizontal");
    if (!neon) return [];
    return [{
      id: objeto.id, x: objeto.x, y: objeto.y,
      parede: null, neon: true,
      cor: lerCorTiled(cor),
      raio: Number.isFinite(raio) && raio > 0 ? raio : 18,
      intensidade: Number.isFinite(intensidade) && intensidade >= 0
        ? Math.min(1, intensidade) : 0.85,
      fase: (Number.isFinite(objeto.rotation) ? objeto.rotation * Math.PI / 180 : 0) +
        (orientacao === "Vertical" ? Math.PI / 2 : 0),
      // A camada contém marcações: ocultá-la no Tiled não desliga os efeitos no jogo.
      ligada: propriedade(objeto, "Ligada") !== false && objeto.visible !== false,
    }];
  });
}

/** Pequeno segmento emissivo com halo local, de orientação fixa. */
export function calcularPerfilNeon(x, y, emissor = false) {
  const r = Math.hypot(x, y);
  if (r >= 1) return 0;
  // Compensa o alcance maior para conservar o tamanho da pequena faixa emissiva.
  const nx = x * 1.8, ny = y * 1.8;
  const nucleo = Math.exp(-0.5 * (Math.max(0, Math.abs(nx) - 0.12) / 0.06) ** 2 -
    0.5 * (ny / 0.055) ** 2);
  if (emissor) return nucleo;
  const fade = (1 - r) ** 2 * (1 + 2 * r);
  return Math.max(nucleo, 0.7 * Math.exp(-0.5 * (r / 0.4) ** 2) * fade);
}

export default class EmergencyLighting {
  constructor(map) {
    this.luzes = lerLuzesEmergencia(map);
    this.estados = this.luzes.map(luz => ({ luz, angulo: null, intensidade: 0 }));
    this.fontesVisiveis = [];
    this.revisao = 0;
  }

  atualizar(agora, camera, zonas = null) {
    let quantidade = 0, alteradas = false;
    for (const estado of this.estados) {
      const luz = estado.luz;
      const intensidade = luz.intensidade * (luz.cor?.alpha ?? 1) * (zonas?.fatorLuz(luz, agora) ?? 1);
      if (!luz.ligada || intensidade === 0 || !luzAfetaCamera(luz, camera)) continue;
      const angulo = luz.fase;
      if (this.fontesVisiveis[quantidade] !== estado || estado.angulo !== angulo || estado.intensidade !== intensidade) alteradas = true;
      estado.angulo = angulo;
      estado.intensidade = intensidade;
      this.fontesVisiveis[quantidade++] = estado;
    }
    if (this.fontesVisiveis.length !== quantidade) alteradas = true;
    this.fontesVisiveis.length = quantidade;
    if (alteradas) this.revisao++;
    return this.fontesVisiveis;
  }

  destroy() {
    this.luzes.length = 0;
    this.estados.length = 0;
    this.fontesVisiveis.length = 0;
  }
}

export { CAMADA_LUZ_EMERGENCIA };
