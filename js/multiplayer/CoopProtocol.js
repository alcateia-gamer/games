/** Limites do protocolo cooperativo. Movimento é descartável; ações são deduplicadas. */
export const COOP = Object.freeze({ version: 2, inputHz: 20, worldHz: 12,
  keyframeMs: 2000, transitionGraceMs: 60000, maxNodes: 900, maxCommands: 8192, maxEffects: 96,
  maps: Object.freeze(["Level1", "Level1Parte2"]) });

export const round = (n, precision = 10) => Number.isFinite(n) ? Math.round(n * precision) / precision : 0;
/** Progresso é monotônico; um frame em trânsito não desfaz uma ação confiável. */
export function mergeCoopProgress(previous = {}, next = {}) {
  const flags = { ...previous?.flags };
  for (const [key, value] of Object.entries(next?.flags || {})) if (value === true) flags[key] = true;
  return { ...previous, ...next, flags,
    collected: { ...previous?.collected, ...next?.collected },
    generatorStartedAt: Number.isFinite(next?.generatorStartedAt)
      ? next.generatorStartedAt : previous?.generatorStartedAt };
}
export function sameMap(player, map) { return (player?.mapKey || "Level1") === map && !player?.dead; }
export function validPlayerState(state) {
  return state && Number.isFinite(state.x) && Number.isFinite(state.y) &&
    Math.abs(state.x) < 100000 && Math.abs(state.y) < 100000 &&
    COOP.maps.includes(state.mapKey || "Level1");
}

/** IDs limitados também impedem crescimento indefinido após uma partida longa. */
export class RecentActions {
  constructor(limit = 2048) { this.limit = limit; this.ids = new Set(); }
  accept(id) {
    if (typeof id !== "string" || !id || id.length > 160 || this.ids.has(id)) return false;
    this.ids.add(id);
    if (this.ids.size > this.limit) this.ids.delete(this.ids.values().next().value);
    return true;
  }
  clear() { this.ids.clear(); }
}
