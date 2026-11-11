import { soloContext } from "./CoopContext.js";
import { describeVisual, applyVisual, createVisual, VisualSender, VisualReceiver } from "./CoopVisuals.js";
import { COOP, sameMap, round } from "./CoopProtocol.js";
import { supportsCompression } from "./CoopCompression.js";
import { criarSistemaEspeciais, atualizarSistemaEspeciais } from "../combat/PlayerSpecialAbilities.js";
import { atualizarRestricaoNovoBoss } from "../player/PlayerControlEffects.js";
import { criarFalaFlutuante } from "../ui/PlayerSpeechBubble.js";
import { atualizarPoseLanterna } from "../effects/FlashlightPose.js";

export function playerVisualObjects(scene) {
  return (scene.projeteisPlayer?.getChildren?.() || []).filter(o => o?.active);
}

export class CoopPlayers {
  constructor(runtime) { this.r = runtime; this.scene = runtime.scene; this.remotes = new Map();
    this.sender = new VisualSender(); this.effects = new Map(); }
  localState() {
    const s = this.scene, r = this.r;
    const health = s.vida || 0;
    const visual = describeVisual(s.player);
    this.flashlightPose ||= {};
    atualizarPoseLanterna(s, this.flashlightPose);
    // Posição segue no envelope; não invalida novamente a comparação da pose.
    if (visual) { visual.x = 0; visual.y = 0; }
    return { mapKey: r.mapKey, health: round(health), maxHealth: s.vidaMaxima,
      dead: !!s.morteEmAndamento || health <= 0,
      coop: { visual, downId: s.coopDownId ?? null, compression: supportsCompression(),
        inventoryDrop: s.coopInventoryDrop ?? null,
        developer: !!s.developerMode,
        flashlight: { angle: round(this.flashlightPose.angulo, 10000) },
        speech: [...(s.coopSpeechBubbles?.values() || [])].map(b => b.snapshot()).filter(Boolean),
        effects: this.sender.capture(playerVisualObjects(s), true),
        hitbox: s.hitboxDanoPlayer && { dx: round(s.hitboxDanoPlayer.x - s.player.x),
          dy: round(s.hitboxDanoPlayer.y - s.player.y), w: round(s.hitboxDanoPlayer.width), h: round(s.hitboxDanoPlayer.height) },
        invulnerable: !!s.player.invulneravel, dash: !!s.estadoDash?.ativo,
        special: r.host ? r.specialSnapshot(s) : null } };
  }
  receive(players) {
    const s = this.scene, r = this.r, ids = new Set();
    for (const data of players) {
      if (data.id === r.manager.playerId || !data.character || !sameMap(data, r.mapKey) && !data.dead) continue;
      if (data.mapKey && data.mapKey !== r.mapKey) continue;
      ids.add(data.id);
      let entry = this.remotes.get(data.id);
      const desc = data.coop?.visual;
      if (!entry) {
        if (!desc) continue;
        const actor = createVisual(s, { ...desc, x: data.x, y: data.y });
        if (!actor) continue;
        actor.id = data.id; actor.coopPlayer = true;
        actor.mapCharacter = data.character;
        actor.setName(`coop-player-${data.id}`);
        s.physics.add.existing(actor);
        // add.existing cria o corpo, mas não adiciona os métodos de Arcade.Sprite.
        // Teleporte, captura e a marreta usam a mesma API do jogador solo.
        Object.assign(actor, Phaser.Physics.Arcade.Components.Velocity);
        actor.body.setAllowGravity(false); actor.body.moves = false;
        actor.body.setImmovable(true);
        entry = { actor, data, health: data.health, invulnerableUntil: 0, speeches: new Map() };
        this.remotes.set(data.id, entry); s.remotePlayers.set(data.id, actor);
        this.effects.set(data.id, new VisualReceiver(s));
        Object.defineProperties(actor, {
          vida: { get: () => entry.health, set: value => {
            const delta = value - entry.health; entry.health = value;
            if (r.host && delta > 0) r.manager.sendCoopAction("heal", { amount: delta }, { authority: true, targetId: data.id });
          } },
          vidaMaxima: { get: () => entry.data.maxHealth || 100 },
        });
        if (r.host) this.prepareContext(entry);
      }
      entry.data = data; entry.health = data.health;
      const actor = entry.actor;
      actor.coopTargetX = data.x; actor.coopTargetY = data.y;
      actor.morto = !!data.dead;
      if (data.dead && entry.context) {
        entry.context.atacando = false; entry.context.restricaoControleNovoBoss = null;
      }
      actor.coopFlashlightAngle = Number.isFinite(data.coop?.flashlight?.angle) ? data.coop.flashlight.angle : null;
      actor.direcaoAtual = data.direction;
      // Nunca substitui o movimento autoritativo do puxão pela posição anterior do cliente.
      if (!entry.context?.restricaoControleNovoBoss && !entry.context?.atacando && desc) {
        applyVisual(s, actor, { ...desc, x: data.x, y: data.y }, !r.host);
      }
      if (r.host && !entry.context?.restricaoControleNovoBoss) actor.setPosition(data.x, data.y);
      const b = data.coop?.hitbox || { dx: -15, dy: -20, w: 30, h: 46 };
      entry.hitbox = new Phaser.Geom.Rectangle(actor.x + b.dx, actor.y + b.dy, b.w, b.h);
      const speech = new Map((data.coop?.speech || []).filter(p => typeof p.nome === "string" &&
        typeof p.frase === "string" && p.frase.length <= 1000).slice(0, 8).map(p => [p.nome, p]));
      for (const [name, state] of speech) {
        if (!entry.speeches.has(name)) {
          const ctx = { add: s.add, time: s.time, player: actor, personagemSelecionada: data.character,
            get morteEmAndamento() { return !!entry.data.dead; },
            get hitboxDanoPlayer() { return { y: actor.y + (entry.data.coop?.hitbox?.dy ?? -20) }; } };
          entry.speeches.set(name, criarFalaFlutuante(ctx, `coop-${data.id}-${name}`, { replica: true }));
        }
        entry.speeches.get(name).aplicarEstadoRede(state);
      }
      for (const [name, bubble] of entry.speeches) if (!speech.has(name)) bubble.ocultar();
      // Corpo no chão, como no solo. É usado por barreiras e geradores.
      actor.body.setSize(30 / Math.abs(actor.scaleX), 15 / Math.abs(actor.scaleY));
      actor.body.setOffset(actor.displayOriginX - 15 / Math.abs(actor.scaleX),
        actor.displayOriginY + 11 / Math.abs(actor.scaleY));
      actor.body.updateFromGameObject(); actor.body.enable = !data.dead;
      if (entry.context) {
        entry.context.direcaoAtual = data.direction;
        entry.context.morteEmAndamento = data.dead;
      }
      this.effects.get(data.id).receive(data.coop?.effects);
    }
    for (const [id, entry] of this.remotes) if (!ids.has(id)) {
      entry.context?.events.emit("shutdown"); entry.context?.companionPet?.destroy(); entry.actor.destroy();
      for (const bubble of entry.speeches.values()) bubble.destroy();
      this.effects.get(id)?.destroy(); this.effects.delete(id);
      this.remotes.delete(id); s.remotePlayers.delete(id);
    }
  }
  prepareContext(entry) {
    const r = this.r, s = this.scene, actor = entry.actor;
    const fields = { player: actor, events: new Phaser.Events.EventEmitter(),
      personagemSelecionada: entry.data.character, direcaoAtual: entry.data.direction,
      get developerMode() { return !!entry.data.coop?.developer; },
      estadoEspecial: null, companionPet: null, restricaoControleNovoBoss: null,
      limparSistemaEspeciais: null,
      botaoEspecial: null, atacando: false, estadoDash: null, generatorMenuOpen: false, movimentoBloqueado: false,
      get vida() { return entry.health; }, set vida(value) { actor.vida = value; },
      get vidaMaxima() { return actor.vidaMaxima; },
      get hitboxDanoPlayer() { return entry.hitbox; },
      get aliados() { return r.playerContexts().map(c => c.player).filter(p => p !== actor); },
      input: { ...s.input, keyboard: null }, coopRemotePlayerId: entry.data.id };
    const ctx = entry.context = soloContext(s, fields, true, entry.data.id);
    criarSistemaEspeciais(ctx);
    actor.on("animationcomplete", () => { ctx.atacando = false; });
  }
  update(time, delta) {
    const s = this.scene, r = this.r;
    for (const entry of this.remotes.values()) {
      for (const bubble of entry.speeches.values()) bubble.atualizar();
      if (r.host && entry.context) {
        const c = entry.context;
        c.events.emit("preupdate", time, delta);
        if (!entry.data.dead) {
          atualizarRestricaoNovoBoss(c, delta);
          atualizarSistemaEspeciais(c, delta);
        }
        c.events.emit("postupdate", time, delta);
        if (c.restricaoControleNovoBoss) r.sendControl(c);
      } else {
        const a = entry.actor, factor = Math.hypot(a.coopTargetX - a.x, a.coopTargetY - a.y) > 180 ? 1 :
          1 - Math.exp(-Math.min(100, delta) / 65);
        a.setPosition(a.x + (a.coopTargetX - a.x) * factor, a.y + (a.coopTargetY - a.y) * factor);
        a.body.updateFromGameObject();
      }
    }
    for (const effects of this.effects.values()) effects.update(delta);
  }
  contexts() { return [...this.remotes.values()].map(e => e.context).filter(Boolean); }
  objects() { return [...this.remotes.values()].map(e => e.actor); }
  destroy() {
    for (const e of this.remotes.values()) {
      e.context?.events.emit("shutdown"); e.context?.companionPet?.destroy(); e.actor.destroy();
      for (const bubble of e.speeches.values()) bubble.destroy();
    }
    for (const e of this.effects.values()) e.destroy();
    this.remotes.clear(); this.effects.clear(); this.scene.remotePlayers.clear();
  }
}
