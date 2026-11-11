/** Luzes móveis dos ataques, do escudo e da aura emitida pelo boss. */
import { luzAfetaCamera, MULTIPLICADOR_ALCANCE_FABRICA } from "./FactoryLighting.js";
import { CAMPOS_POSE_AURA } from "./BossAuraLightCache.js";

export function calcularPerfilAuraBoss(x, y) {
  const r = Math.hypot(x / 0.82, y);
  if (r >= 1) return 0;
  return (0.65 * Math.exp(-0.5 * (r / 0.38) ** 2) +
    0.35 * Math.exp(-0.5 * (r / 0.72) ** 2)) * (1 - r * r) ** 2;
}

export function calcularPerfilEnergiaBoss(x, y, escudo = false) {
  const r = Math.hypot(x, y);
  if (r >= 1) return 0;
  const fade = (1 - r * r) ** 2;
  return escudo
    ? (0.32 * Math.exp(-0.5 * (r / 0.65) ** 2) +
      0.75 * Math.exp(-0.5 * ((r - 1 / 1.7) / 0.16) ** 2)) * fade
    : 0.95 * Math.exp(-0.5 * (r / 0.32) ** 2) * fade;
}

export default class BossEnergyLighting {
  constructor(scene) {
    this.scene = scene;
    this.fontesVisiveis = [];
    this.estados = new WeakMap();
    this.auras = new WeakMap();
    this.revisao = 0;
    this.quadro = 0;
  }

  atualizar(camera) {
    const scene = this.scene, encontro = scene.novoBoss;
    let quantidade = 0, alteradas = false;
    this.quadro++;
    const adicionar = (objeto, x, y, raio, intensidade, escudo = false, vermelha = false, choqueTorre = false) => {
      if (objeto.active === false || objeto.visible === false || intensidade <= 0 ||
          !Number.isFinite(x) || !Number.isFinite(y)) return;
      const estados = vermelha ? this.auras : this.estados;
      let estado = estados.get(objeto);
      if (!estado) {
        estado = { luz: {}, intensidade: 0, escudo, vermelha, choqueTorre, emissor: vermelha ? objeto : null };
        estados.set(objeto, estado);
      }
      if (estado.quadro === this.quadro) return;
      estado.quadro = this.quadro;
      const luz = estado.luz;
      let mudou = luz.x !== x || luz.y !== y || luz.raio !== raio || estado.intensidade !== intensidade;
      if (vermelha) for (const campo of CAMPOS_POSE_AURA) {
        if (estado[campo] !== objeto[campo]) mudou = true;
        estado[campo] = objeto[campo];
      }
      luz.x = x;
      luz.y = y;
      luz.raio = raio;
      estado.intensidade = intensidade;
      if (!luzAfetaCamera(luz, camera)) return;
      if (mudou || this.fontesVisiveis[quantidade] !== estado) alteradas = true;
      this.fontesVisiveis[quantidade++] = estado;
    };
    if (encontro && !encontro.encerrado && !encontro.morto && !encontro.suspenso &&
        encontro.jogadorNaArena !== false && (!scene.multiplayer || scene.coopRuntime) && !scene.morteEmAndamento &&
        (scene.vida ?? 1) > 0) {
      const projetil = objeto => adicionar(objeto, objeto.x, objeto.y, 36,
        Math.max(0, Math.min(1, objeto.alpha ?? 1)) * 0.9);
      for (const objeto of encontro.projeteisBoss ?? []) projetil(objeto);
      // Inclui as cópias visuais: a iluminação não denuncia os ataques ilusórios.
      for (const objeto of scene.children?.list ?? []) {
        if (objeto.novoBossDisparoEnergia) projetil(objeto);
      }
      // Usa o mesmo quadro que a torre já desenha, sem temporizador ou leitura de pixels em jogo.
      for (const torre of encontro.geradores ?? []) {
        const choque = torre.luzChoqueIdle;
        if (!torre.torre || torre.morto || torre.ligado === false || torre.estado !== "idle" || !choque) continue;
        adicionar(torre.visual, choque.x, choque.y, choque.raio,
          choque.intensidade * Math.max(0, Math.min(1, torre.visual.alpha ?? 1)) * 0.95,
          false, false, true);
      }
      const sprite = encontro.sprite;
      const fatorAura = encontro.introducao?.iluminacao?.aura ?? 1;
      const aura = objeto => {
        if (objeto) adicionar(objeto, objeto.x, objeto.y - 8, 156,
          Math.max(0, Math.min(1, objeto.alpha ?? 1)) * 0.9 * fatorAura, false, true);
      };
      aura(sprite);
      for (const alvo of encontro.alvosIlusorios ?? []) {
        if (alvo.active && alvo.visible !== false) aura(alvo.sprite);
      }
      if (sprite && encontro.barreiraAtiva && !encontro.teleporte &&
          encontro.sistemaGeradores?.corpoBarreira?.enable !== false) {
        const raio = encontro.config?.geradores?.raioBarreira ?? 95;
        adicionar(sprite, sprite.x, sprite.y + 16, raio * 1.7 / MULTIPLICADOR_ALCANCE_FABRICA,
          Math.max(0, Math.min(1, sprite.alpha ?? 1)) * 0.85 *
            (encontro.sistemaGeradores?.cargaEscudo ?? 1), true);
      }
    }
    if (quantidade !== this.fontesVisiveis.length) alteradas = true;
    this.fontesVisiveis.length = quantidade;
    if (alteradas) this.revisao++;
    return this.fontesVisiveis;
  }

  destroy() {
    this.fontesVisiveis.length = 0;
    this.estados = new WeakMap();
    this.auras = new WeakMap();
    this.scene = null;
  }
}
