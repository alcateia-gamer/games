/** Progresso da partida; a ferramenta DEV só muda a iluminação atual. */
export const FLASHLIGHT_RETIRED_KEY = 'factoryFlashlightRetired';
export function lanternaDesativada(scene) {
  const registry = scene.game?.registry ?? scene.registry;
  const flags = (scene.multiplayer === true || scene.coopRuntime) ? (scene.coopRuntime?.manager.room?.coopProgress?.flags ??
    scene.multiplayerManager?.room?.coopProgress?.flags ?? registry?.get?.('multiplayer')?.room?.coopProgress?.flags) : null;
  return registry?.get?.(FLASHLIGHT_RETIRED_KEY) === true ||
    registry?.get?.('factoryGeneratorPowered') === true || flags?.factoryGeneratorPowered === true;
}
export function desativarLanternaDefinitivamente(scene) {
  const registry = scene.game?.registry ?? scene.registry;
  if (registry?.get?.(FLASHLIGHT_RETIRED_KEY) !== true) registry?.set?.(FLASHLIGHT_RETIRED_KEY, true);
  if (scene.recursosLanterna) scene.descarregarLanterna?.();
}
