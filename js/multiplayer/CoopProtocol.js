/** Limites do protocolo cooperativo. Movimento é descartável; ações são deduplicadas. */
export const COOP = Object.freeze({ version: 2, inputHz: 20, worldHz: 12,
  keyframeMs: 2000, transitionGraceMs: 60000, maxNodes: 900, maxCommands: 8192, maxEffects: 96,
  maps: Object.freeze(["Level1", "Level1Parte2"]) });

export const round = (n, precision = 10) => Number.isFinite(n) ? Math.round(n * precision) / precision : 0;

/** Uma preparação pertence a uma única sala/transição; revisões antigas nunca a desfazem. */
export function mergeBossPreparation(room, previous, next) {
  if (!room || !next || next.roomCode !== room.roomCode || next.mapId !== (room.coopMap?.id ?? 0) ||
      typeof next.id !== "string" || !next.id || next.id.length > 160 ||
      !Number.isSafeInteger(next.revision) || next.revision < 1 ||
      !["loading", "assembling", "intro", "complete"].includes(next.phase) ||
      !Array.isArray(next.participants) || next.participants.length > 4 ||
      new Set(next.participants).size !== next.participants.length ||
      next.participants.some(id => typeof id !== "string" || id.length > 100) ||
      !next.clients || typeof next.clients !== "object" || Object.keys(next.clients).length > 4) return previous;
  if (previous?.roomCode === next.roomCode && previous.mapId === next.mapId &&
      (previous.id !== next.id || previous.revision >= next.revision)) return previous;
  if (next.entrada && (next.entrada.id !== next.id || !next.entrada.jogadores ||
      Object.keys(next.entrada.jogadores).length > 4 || Object.values(next.entrada.jogadores)
        .some(p => ![p?.x, p?.y].every(n => Number.isFinite(n) && Math.abs(n) < 100000)))) return previous;
  if (next.phase === "intro" && (!next.entrada || !Number.isFinite(next.startAt) ||
      next.systemsPrepared !== true || typeof next.systemsEpoch !== "string" || next.systemsEpoch.length > 160 ||
      ![next.camera?.x, next.camera?.y, next.camera?.zoom].every(Number.isFinite))) return previous;
  return next;
}
/** Progresso é monotônico; um frame em trânsito não desfaz uma ação confiável. */
export function mergeCoopProgress(previous = {}, next = {}) {
  const flags = { ...previous?.flags };
  for (const [key, value] of Object.entries(next?.flags || {})) if (value === true) flags[key] = true;
  return { ...previous, ...next, flags,
    collected: { ...previous?.collected, ...next?.collected },
    ...((previous?.inventoryDrops || next?.inventoryDrops) ? {
      inventoryDrops: { ...previous?.inventoryDrops, ...next?.inventoryDrops },
    } : {}),
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
