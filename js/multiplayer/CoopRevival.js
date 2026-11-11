/** O host confirma o resgate; cada jogador conserva sua posição e pose ao cair. */
export const REVIVE_RADIUS = 64;
export const REVIVE_MS = 3000;
export const DOWN_SHEETS = {
  "kai-mercer": "KAI_MERCER 1/KAI_DEAD.png",
  "magnus-force": "MAGNUS_FORCE 2/magnus_dead.png",
  "aria-kade": "ARIA_KADE 3/ARIA_DEAD.png",
  nyx: "NYX_4/nyx_dead.png",
};

export function carregarQuedasCoop(loader) {
  for (const [personagem, arquivo] of Object.entries(DOWN_SHEETS)) {
    loader.spritesheet(`coop-down-${personagem}`, `PERSONAGENS/PERSONAGENS PRICIPAIS/${arquivo}`,
      { frameWidth: 64, frameHeight: 64 });
  }
}

export function animarQuedaCoop(scene) {
  const key = `coop-down-${scene.personagemSelecionada}`;
  if (!scene.anims.exists(key)) scene.anims.create({ key,
    frames: scene.anims.generateFrameNumbers(key, { start: 0, end: 5 }), frameRate: 8, repeat: 0 });
  scene.player.anims.stop();
  scene.player.setTexture(key, 0).setOrigin(0.5, 0.5).setRotation(0).setAlpha(1).clearTint();
  scene.player.anims.play(key);
}

export class CoopRevival {
  constructor(runtime) {
    this.r = runtime;
    this.progress = new Map(); this.pending = new Map(); this.labels = new Map();
  }
  participants() {
    const r = this.r, s = r.scene;
    return [{ id: r.manager.playerId, actor: s.player, dead: s.morteEmAndamento || s.vida <= 0,
      downId: s.coopDownId, health: s.vida },
    ...[...r.players.remotes.values()].map(e => ({ id: e.data.id, actor: e.actor,
      dead: e.data.dead || e.health <= 0, downId: e.data.coop?.downId, health: e.health }))];
  }
  update(delta) {
    const people = this.participants();
    if (this.r.host) {
      const down = new Set();
      for (const p of people) {
        if (!p.dead || !p.actor?.active || !p.downId) continue;
        down.add(p.id);
        if (this.pending.get(p.id) === p.downId) continue;
        const helper = people.find(a => a.id !== p.id && !a.dead && a.health > 0 && a.actor?.active &&
          Math.hypot(a.actor.x - p.actor.x, a.actor.y - p.actor.y) <= REVIVE_RADIUS);
        const previous = this.progress.get(p.id);
        const elapsed = helper ? (previous?.helper === helper.id && previous.downId === p.downId ? previous.elapsed : 0) +
          Math.min(100, Math.max(0, delta)) : 0;
        this.progress.set(p.id, { downId: p.downId, helper: helper?.id, elapsed });
        if (elapsed >= REVIVE_MS) {
          this.pending.set(p.id, p.downId);
          if (p.id === this.r.manager.playerId) this.r.revivePlayer(p.downId);
          else this.r.manager.sendCoopAction("revive", { downId: p.downId }, { authority: true, targetId: p.id });
        }
      }
      for (const id of this.progress.keys()) if (!down.has(id)) this.progress.delete(id);
      for (const id of this.pending.keys()) if (!down.has(id)) this.pending.delete(id);
    }
    const visible = new Set();
    for (const p of people) {
      if (!p.dead || !p.actor?.active) continue;
      visible.add(p.id);
      let label = this.labels.get(p.id);
      if (!label) {
        label = this.r.scene.add.text(0, 0, "", { fontFamily: "monospace", fontSize: "11px",
          align: "center", color: "#ffb9c6", backgroundColor: "#10101ddd", padding: { x: 5, y: 3 } })
          .setOrigin(0.5, 1).setDepth(90);
        label.coopLocalVisual = true;
        this.labels.set(p.id, label);
      }
      const state = this.progress.get(p.id);
      const seconds = state?.downId === p.downId && state?.elapsed > 0 ? Math.max(1, Math.ceil((REVIVE_MS - state.elapsed) / 1000)) : null;
      label.setPosition(p.actor.x, p.actor.y - 28).setText(seconds ? `REVIVENDO · ${seconds}s` : "CAÍDO\nAproxime-se por 3s para reviver");
    }
    for (const [id, label] of this.labels) if (!visible.has(id)) { label.destroy(); this.labels.delete(id); }
  }
  snapshot() { return [...this.progress].map(([id, state]) => ({ id, ...state })); }
  receive(states) {
    if (this.r.host || !Array.isArray(states)) return;
    this.progress = new Map(states.filter(s => typeof s.id === "string" && Number.isFinite(s.elapsed))
      .slice(0, 4).map(s => [s.id, s]));
  }
  destroy() {
    for (const label of this.labels.values()) label.destroy();
    this.labels.clear(); this.progress.clear(); this.pending.clear();
  }
}
