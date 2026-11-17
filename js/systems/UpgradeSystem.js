import { obterBalanceamento } from '../combat/CharacterBalance.js';
import { upgradeDefinitions } from './UpgradeDefinitions.js';
const modifierCache = new WeakMap();
export const ECONOMY_KEY = 'nullborns:upgrades:run';
export function createEconomy(shared = false) {
  return { revision: 0, accounts: {}, drops: {}, zones: {}, rewarded: 0, sequence: 0,
    ...(shared ? { sharedScrap: true, teamWallet: { scrap: 0 } } : {}) };
}
export function economyFor(scene) {
  if ((scene.multiplayer || scene.coopRuntime) && scene.multiplayerManager?.room) {
    const state = scene.multiplayerManager.room.upgradeEconomy ??= createEconomy(true);
    enableSharedScrap(state); return state;
  }
  const registry = scene.game.registry;
  let state = registry.get(ECONOMY_KEY);
  if (!state) { state = createEconomy(); registry.set(ECONOMY_KEY, state); }
  return state;
}
/** Migra saldos antigos uma única vez; níveis continuam separados por jogador. */
export function enableSharedScrap(economy) {
  if (economy.sharedScrap) return economy;
  economy.teamWallet = { scrap: 0 };
  for (const account of Object.values(economy.accounts)) {
    if (Number.isSafeInteger(account.scrap) && account.scrap > 0)
      economy.teamWallet.scrap = Math.min(Number.MAX_SAFE_INTEGER, economy.teamWallet.scrap + account.scrap);
    account.scrap = 0;
  }
  economy.sharedScrap = true; economy.revision++;
  return economy;
}
export function scrapAccount(economy, id, character) {
  return economy.sharedScrap ? economy.teamWallet : playerAccount(economy, id, character);
}
export function walletFor(scene) {
  return scrapAccount(economyFor(scene), localPlayerId(scene), scene.personagemSelecionada);
}
export function playerAccount(economy, id, character) {
  const account = economy.accounts[id] ??= { scrap: 0, characters: {} };
  account.characters[character] ??= {};
  return account;
}
export function localPlayerId(scene) { return scene.coopRemotePlayerId ?? ((scene.multiplayer || scene.coopRuntime) ? scene.multiplayerManager?.playerId : 'solo') ?? 'solo'; }
export function accountFor(scene) { return playerAccount(economyFor(scene), localPlayerId(scene), scene.personagemSelecionada); }
export function modifiers(character, levels = {}) {
  const values = {};
  for (const d of upgradeDefinitions(character)) values[d.stat] = d.values[Math.max(0, Math.min(d.max, Math.trunc(levels[d.id]) || 0))];
  return values;
}
export function modifiersFor(scene) {
  if (!scene.game?.registry && !scene.multiplayerManager?.room) return {};
  const account = accountFor(scene), levels = account.characters[scene.personagemSelecionada];
  const revision = economyFor(scene).revision, cached = modifierCache.get(levels);
  if (cached?.revision === revision && cached.character === scene.personagemSelecionada) return cached.values;
  const values = modifiers(scene.personagemSelecionada, levels);
  modifierCache.set(levels, { revision, character: scene.personagemSelecionada, values });
  return values;
}
export function purchase(economy, playerId, character, id, expectedLevel) {
  const d = upgradeDefinitions(character).find(d => d.id === id);
  if (!d) return { ok: false, reason: 'MÓDULO INCOMPATÍVEL' };
  const account = playerAccount(economy, playerId, character), levels = account.characters[character], level = levels[id] || 0;
  if (level !== expectedLevel) return { ok: false, reason: 'ESTADO ATUALIZADO. SELECIONE NOVAMENTE.' };
  if (level >= d.max) return { ok: false, reason: 'NÍVEL MÁXIMO' };
  const cost = d.prices[level], wallet = scrapAccount(economy, playerId, character);
  if (!Number.isSafeInteger(wallet.scrap) || wallet.scrap < cost) return { ok: false, reason: 'SUCATAS INSUFICIENTES' };
  wallet.scrap -= cost; levels[id] = level + 1; economy.revision++;
  return { ok: true, cost, level: level + 1, reason: 'MELHORIA INSTALADA COM SUCESSO' };
}
export function maximumHealth(character, bonus = 0) { return obterBalanceamento(character).vida * (1 + bonus); }
export function cooldownWithModifiers(character, base, m) {
  return Math.max(character === "kai-mercer" ? 6800 : 3000, base * (1 - (m.cooldown || 0) - (m.recovery || 0)));
}
/** Recalcula dos valores de origem; reaplicar não cura e não multiplica bônus anteriores. */
export function applyUpgrades(scene) {
  const m = modifiersFor(scene);
  const max = maximumHealth(scene.personagemSelecionada, m.health || 0);
  if (scene.vidaMaxima === max) return;
  const ratio = Number.isFinite(scene.vida) && scene.vidaMaxima > 0 ? scene.vida / scene.vidaMaxima : 1;
  scene.vidaMaxima = max; scene.vida = Math.max(0, Math.min(max, ratio * max));
}
export function basicDamage(scene, base, ranged = false) {
  const m = modifiersFor(scene); return base * (1 + (m.weapon || 0) + (ranged ? 0 : m.melee || 0));
}
export function specialCooldown(scene, base) {
  const m = modifiersFor(scene);
  // Preserva o piso de recarga dos aprimoramentos; o domo agora dura 4s.
  return cooldownWithModifiers(scene.personagemSelecionada, base, m);
}
