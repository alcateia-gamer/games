/** Valores finais por inimigo e por acerto; não aplicar multiplicadores adicionais. */
const CENARIOS = [
  { vidas: [100, 120, 85, 1000, 120], danos: [6.24, 12, 10, 20, 30, 40] },
  { vidas: [125, 150, 106, 1100, 140], danos: [7, 13.5, 11.25, 25, 35, 45] },
  { vidas: [150, 180, 128, 2000, 140], danos: [8, 15, 12.5, 30, 40, 50] },
  { vidas: [175, 210, 149, 3000, 140], danos: [9, 16.5, 13.75, 35, 45, 55] },
  { vidas: [200, 240, 170, 4000, 140], danos: [10, 18, 15, 40, 50, 60] },
].map(({ vidas, danos }) => Object.freeze({
  padrao: Object.freeze({ vida: vidas[0], dano: danos[0] }),
  serra: Object.freeze({ vida: vidas[1], dano: danos[1] }),
  bola: Object.freeze({ vida: vidas[2], dano: danos[2] }),
  boss: Object.freeze({ vida: vidas[3], laser: danos[3], pulso: danos[4], chuva: danos[5] }),
  torre: Object.freeze({ vida: vidas[4], dano: 0 }),
  copia: Object.freeze({ vida: 1, dano: 0 }),
}));

/** Os contextos cooperativos expõem multiplayer=false para reutilizar a IA solo. */
export function obterBalanceamentoInimigos(scene) {
  if (!scene?.multiplayer && !scene?.coopRuntime) return CENARIOS[0];
  const manager = scene.coopRuntime?.manager ?? scene.multiplayerManager;
  const participantes = manager?.room?.players?.length ?? 1;
  return CENARIOS[Math.max(1, Math.min(4, participantes))];
}

/** Copia apenas os atributos balanceados, preservando padrões, tempos e habilidades. */
export function configurarBalanceamentoBoss(scene, config) {
  const { boss, torre } = obterBalanceamentoInimigos(scene);
  return {
    ...config,
    combate: { ...config.combate, vidaMaxima: boss.vida },
    geradores: { ...config.geradores, vidaTorre: torre.vida },
    prologo: { ...config.prologo, lasers: { ...config.prologo?.lasers, dano: boss.laser } },
    ataques: {
      ...config.ataques,
      lasersEspiral: { ...config.ataques?.lasersEspiral, dano: boss.laser },
      pulsoRepulsao: { ...config.ataques?.pulsoRepulsao, dano: boss.pulso },
      chuvaRaios: { ...config.ataques?.chuvaRaios, dano: boss.chuva },
    },
  };
}
