/** Arandelas da sala do boss: faixa luminosa fixa e iluminação difusa para dentro da sala. */
import { lerCorTiled, luzAfetaCamera } from "./FactoryLighting.js";

const CAMADA_LUZ_BOSS = "IluminaçãoBoss";
const COR_AMARELA = "#FFD35A";
const DIRECOES = [["Direita", 0], ["Baixo", Math.PI / 2], ["Esquerda", Math.PI], ["Cima", -Math.PI / 2]];
const CORES = { Amarelo: COR_AMARELA, Vermelho: "#FF4444", Verde: "#65FF95",
  Azul: "#579BFF", Ciano: "#5AEAFF", Roxo: "#BD7AFF", Laranja: "#FF964A", Branco: "#FFFFFF" };

function propriedade(objeto, nome) {
  return Array.isArray(objeto.properties)
    ? objeto.properties.find(item => item.name === nome)?.value : objeto.properties?.[nome];
}

export function lerLuzesParedeBoss(map, avisar = console.warn) {
  const camada = map.getObjectLayer(CAMADA_LUZ_BOSS);
  return (camada?.objects ?? []).flatMap(objeto => {
    const direcoes = DIRECOES.filter(([nome]) => propriedade(objeto, nome) === true);
    if (objeto.point !== true || !Number.isFinite(objeto.x) || !Number.isFinite(objeto.y) || direcoes.length !== 1) {
      avisar(`[IluminaçãoBoss] Objeto ${objeto.id} ignorado: use Point e marque uma direção (Esquerda, Direita, Cima ou Baixo).`);
      return [];
    }
    const cor = propriedade(objeto, "Cor");
    const nomeCor = Object.keys(CORES).find(nome => propriedade(objeto, nome) === true);
    const raio = propriedade(objeto, "Raio"), intensidade = propriedade(objeto, "Intensidade");
    return [{ id: objeto.id, x: objeto.x, y: objeto.y,
      direcao: direcoes[0][0], angulo: direcoes[0][1],
      cor: lerCorTiled(typeof cor === "string" ? cor : CORES[nomeCor] ?? COR_AMARELA),
      raio: Number.isFinite(raio) && raio > 0 ? raio : 120,
      intensidade: Number.isFinite(intensidade) && intensidade >= 0 ? Math.min(1, intensidade) : 0.9,
      ligada: propriedade(objeto, "Ligada") !== false && camada.visible !== false && objeto.visible !== false,
    }];
  });
}

/** Perfil local: X positivo entra na sala; o pequeno segmento vertical forma a lâmpada. */
export function calcularEmissorLuzParede(x, y) {
  if (x < 0 || x >= 1 || Math.abs(y) >= 0.09) return 0;
  const ponta = Math.max(0, (Math.abs(y) - 0.06) / 0.03);
  return Math.exp(-0.5 * (x / 0.009) ** 2) * (1 - ponta * ponta * (3 - 2 * ponta));
}

export function calcularPerfilLuzParede(x, y) {
  const r = Math.hypot(x, y);
  if (x < 0 || r >= 1) return 0;
  const fade = (1 - r) ** 2 * (1 + 2 * r);
  const largura = 0.14 + x * 0.42;
  const banho = 0.72 * Math.exp(-0.5 * (x / 0.4) ** 2 - 0.5 * (y / largura) ** 2) * fade;
  const halo = 0.2 * Math.exp(-0.5 * (x / 0.55) ** 2 - 0.5 * (y / 0.38) ** 2) * fade;
  return Math.min(1, Math.max(calcularEmissorLuzParede(x, y), banho + halo));
}

export default class BossWallLighting {
  constructor(map) {
    this.luzes = lerLuzesParedeBoss(map);
    this.estados = this.luzes.map(luz => ({ luz, angulo: luz.angulo, intensidade: 0 }));
    this.fontesVisiveis = [];
    this.revisao = 0;
  }

  atualizar(agora, camera, zonas = null) {
    let quantidade = 0, alteradas = false;
    for (const estado of this.estados) {
      const luz = estado.luz;
      const intensidade = luz.intensidade * luz.cor.alpha * (zonas?.fatorLuz(luz, agora) ?? 1);
      if (!luz.ligada || intensidade === 0 || !luzAfetaCamera(luz, camera)) continue;
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
    this.luzes.length = this.estados.length = this.fontesVisiveis.length = 0;
  }
}

export { CAMADA_LUZ_BOSS };
