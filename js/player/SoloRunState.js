/** Recursos da partida solo; o registry atravessa mudanças de mapa. */
export const SOLO_PET_REVIVALS_KEY = "soloPetRevivesUsed";
export const SOLO_PET_REVIVALS_MAX = 2;

export function reiniciarResgatesSolo(registry) {
  registry.set(SOLO_PET_REVIVALS_KEY, 0);
}

export function resgatesSoloUsados(registry) {
  const usados = registry?.get(SOLO_PET_REVIVALS_KEY);
  return Number.isFinite(usados) ? Math.max(0, Math.min(SOLO_PET_REVIVALS_MAX, Math.floor(usados))) : 0;
}

export function consumirResgateSolo(registry) {
  const usados = resgatesSoloUsados(registry);
  if (!registry || usados >= SOLO_PET_REVIVALS_MAX) return false;
  registry.set(SOLO_PET_REVIVALS_KEY, usados + 1);
  return true;
}
