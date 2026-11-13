export const UPGRADE_NPC = Object.freeze({ x: -410, y: 8817, range: 90, frame: 180 }); // LPC: linha 10, coluna 0, célula 64px.
export const UPGRADE_NPCS = Object.freeze({
  Level1: UPGRADE_NPC,
  Level1Parte2: Object.freeze({ ...UPGRADE_NPC, x: -1253, y: -1928 }),
});
export const SCRAP_BALANCE = Object.freeze({ maxDrops: 48, maxPerZone: 5, maxCampaign: 96,
  profiles: Object.freeze({ padrao: { chance: .75, min: 1, max: 3 }, serra: { chance: .9, min: 2, max: 4 },
    bola: { chance: .75, min: 1, max: 3 }, olhao: { chance: 1, min: 4, max: 7 } }) });
export function rollScrap(type, random = Math.random) {
  const p = SCRAP_BALANCE.profiles[type];
  return !p || random() >= p.chance ? 0 : p.min + Math.min(p.max - p.min, Math.floor(random() * (p.max - p.min + 1)));
}
