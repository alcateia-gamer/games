/** Formato único de checkpoint; converte partidas anteriores sem duplicar estados. */
export const MEMORY_PROGRESS_KEY = 'memoryDecryptionComplete';
export const LEGACY_NETWORK_KEY = 'networkReconstructionComplete';
export function normalizarCheckpoint(checkpoint = {}) {
  const count = Number.isInteger(checkpoint.memoryModules) ? Math.max(0, Math.min(3, checkpoint.memoryModules)) : checkpoint.network === true ? 3 : 0;
  return { memoryModules: count, hostConnected: count === 3 && (checkpoint.hostConnected === true || checkpoint.hostPasso >= 7) };
}
export function mesclarCheckpoint(a, b) {
  const left = normalizarCheckpoint(a), right = normalizarCheckpoint(b);
  return { memoryModules: Math.max(left.memoryModules, right.memoryModules), hostConnected: left.hostConnected || right.hostConnected };
}
