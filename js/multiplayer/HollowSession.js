import { validCast } from '../narrative/HollowDialogue.js';

export function validHollowSession(state) {
  if (!state || typeof state.id !== 'string' || state.id.length > 120 ||
      !Array.isArray(state.cast) || state.cast.length < 1 || state.cast.length > 4 ||
      validCast(state.cast).length !== state.cast.length || typeof state.skipApproved !== 'boolean') return false;
  return ['ready', 'skipped', 'done'].every(key => Array.isArray(state[key]) && state[key].length <= 4 &&
    state[key].every(id => typeof id === 'string')) &&
    ['startAt', 'releaseAt'].every(key => state[key] === null || Number.isFinite(state[key]));
}

/** Estado retido na sala atual; comandos idempotentes usam os tópicos MQTT existentes. */
export function createHollowSession(players, now) {
  return { id: `hollow:${now}`, cast: validCast(players.map(p => p.character)),
    ready: [], skipped: [], done: [], startAt: null, releaseAt: null, skipApproved: false };
}

export function updateHollowSession(room, action, now = Date.now()) {
  const state = room?.hollow;
  if (!validHollowSession(state) || state.releaseAt) return false;
  const players = room.players.map(p => p.id);
  let changed = false;
  if (action) {
    if (action.sessionId !== state.id || !players.includes(action.playerId) ||
        (action.clientId && action.clientId !== action.playerId)) return false;
    const field = { hollow_ready: 'ready', hollow_skip: 'skipped', hollow_done: 'done' }[action.type];
    if (!field || (field === 'done' && !state.startAt)) return false;
    if (!state[field].includes(action.playerId)) {
      state[field].push(action.playerId); changed = true;
    }
  }
  const every = field => players.length > 0 && players.every(id => state[field].includes(id));
  if (!state.skipApproved && every('skipped')) { state.skipApproved = true; changed = true; }
  if (!state.startAt && every('ready')) {
    state.cast = validCast(room.players.map(p => p.character));
    state.startAt = now + 1000; changed = true;
  }
  if (every('ready') && (state.skipApproved || every('done'))) {
    state.releaseAt = now + 700; changed = true;
  }
  return changed;
}
