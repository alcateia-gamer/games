/** Mesmas regras de colisão do solo, resolvidas para todos os participantes vivos. */
import { capturarJogadorNovoBoss, liberarJogadorNovoBoss } from "../player/PlayerControlEffects.js";
import { tempoImpactoFlecha } from "../player/ArrowCollision.js";

export function coopBossServices(runtime, encounter, original) {
  let hits = [];
  const captures = new Map();
  const players = () => runtime.playerContexts().filter(c => c.player.active && c.vida > 0 &&
    !c.morteEmAndamento && runtime.inArena(c.player));
  return {
    ...original,
    jogadorAtingeCirculo(x, y, radius) {
      hits = players().filter(c => {
        const b = c.hitboxDanoPlayer;
        if (!b) return false;
        const px = Math.max(b.x, Math.min(x, b.x + b.width));
        const py = Math.max(b.y, Math.min(y, b.y + b.height));
        return Math.hypot(px - x, py - y) <= radius;
      });
      return hits.length > 0;
    },
    danoJogador(amount, origin, options) {
      let accepted = false;
      for (const c of hits) accepted = runtime.damage(c, amount, origin, options) || accepted;
      hits = [];
      return accepted;
    },
    atingirJogadorComLaser(start, end, radius, amount, origin, visual) {
      const length = Math.hypot(end.x - start.x, end.y - start.y) || 1;
      const vector = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
      const candidates = players().map(c => ({ c, t: tempoImpactoFlecha(start, end, vector,
        c.hitboxDanoPlayer, radius, radius) })).filter(p => p.t !== null).sort((a, b) => a.t - b.t);
      for (const c of players()) {
        if (visual && c.tentarInterceptarLaserEspecial?.(visual)) return false;
        if (visual && c.acertarHologramaEspecial?.(visual)) return true;
      }
      if (!candidates.length) return false;
      runtime.damage(candidates[0].c, amount, origin);
      return true;
    },
    capturarJogador(source, duration, point, options) {
      for (const c of hits) if (capturarJogadorNovoBoss(c, source, duration, point, options)) {
        captures.set(source, c); runtime.sendControl(c); return true;
      }
      return false;
    },
    capturaAtiva(source) { return captures.get(source)?.restricaoControleNovoBoss?.fonte === source; },
    liberarJogador(source) {
      const c = captures.get(source);
      if (c) { liberarJogadorNovoBoss(c, source); runtime.sendControl(c); captures.delete(source); }
    },
  };
}
