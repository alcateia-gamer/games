import { obterBalanceamento } from "../combat/CharacterBalance.js";
import { ARIA_ATTACK_CONFIG } from "../controls/AriaAttackConfig.js";
import { CoopRevival, animarQuedaCoop } from "./CoopRevival.js";
import { tocarSomAuraNyx, pararSomAuraNyx } from "../sounds/SOUNDS_PERSONAGENS.js/sounds_Nyx,.js";
import { NYX_AURA } from "../combat/NyxHealingAura.js";
/** Integração cooperativa dos dois mapas; uma simulação, réplicas interpoladas. */
import { COOP, round, sameMap } from "./CoopProtocol.js";
import { VisualSender, VisualReceiver } from "./CoopVisuals.js";
import { soloContext } from "./CoopContext.js";
import { CoopPlayers, playerVisualObjects } from "./CoopPlayers.js";
import { BossReplica, describeBoss, describeCombatTarget } from "./CoopBossReplica.js";
import { prepararBoss, atualizarBoss, destruirBoss } from "../enemies/BossPrincipal.js";
import { novoBossConfig, jogadorNaArenaNovoBoss } from "../enemies/novoBoss/NovoBossConfig.js";
import { assetsNovoBoss, criarAnimacoesNovoBoss } from "../enemies/novoBoss/NovoBossAssets.js";
import { pontosTorresNovoBoss } from "../enemies/novoBoss/NovoBossTorres.js";
import { prepararPisoTorre } from "../enemies/novoBoss/NovoBossTorrePiso.js";
import { causarDanoInimigo } from "../enemies/EnemyHealth.js";
import { causarDanoPlayer } from "../enemies/EnemyLaser.js";
import { atualizarInimigoTeste } from "../enemies/EnemyTest.js";
import { configurarSomPropulsaoRoboBola } from "../sounds/propulsaoRoboBola.js";
import { atualizarRoboBola } from "../enemies/RoboBola.js";
import { causarDanoAlvoAdicional, alvosAdicionaisCombate } from "../combat/CombatTargets.js";
import { recuperarVida } from "../player/PlayerStatus.js";
import { registrarApertoLibertacaoNovoBoss, atualizarRestricaoNovoBoss } from "../player/PlayerControlEffects.js";
import { iniciarAnimacaoMarreta } from "../combat/SpecialAbilityEffects.js";
import { respawnPlayer } from "../player/Player.js";
import { CoopWorld } from "./CoopWorld.js";
import { prepararTexturaMunicaoRobo } from "../enemies/WarRobotProjectile.js";
import { obterFilhosGrupoSeguro } from "../enemies/EnemyPathfinding.js";
import { executarSpawnDev } from "../controls/DeveloperSpawns.js";
import { playReplicatedHitEffects } from "../combat/CombatEffects.js";
import { CoopMusic } from "./CoopMusic.js";
import mostrarTelaMorte from "../scenes/DeathScreen.js";
import { droparInventarioAoMorrer } from "../inventory/InventoryDrops.js";

export function criarRuntimeCoop(scene) {
  if (!scene.multiplayer || !scene.multiplayerManager?.room) return null;
  scene.coopRuntime?.destroy();
  return scene.coopRuntime = new CoopRuntime(scene);
}

export class CoopRuntime {
  constructor(scene) {
    this.scene = scene; this.manager = scene.multiplayerManager;
    this.mapKey = scene.sys.settings.key;
    this.host = this.manager.room.hostId === this.manager.playerId;
    this.manager.coopTransitionUntil = Date.now() + COOP.transitionGraceMs;
    this.streamId = `${this.manager.playerId}:${Date.now()}:${++this.manager.coopStreamSequence}`;
    prepararTexturaMunicaoRobo(scene);
    this.manager.enableCoop();
    scene.coopRuntime = this;
    this.sender = new VisualSender(); this.receiver = new VisualReceiver(scene);
    this.baseline = new Set(scene.children.list);
    this.players = new CoopPlayers(this);
    this.localContext = soloContext(scene);
    this.world = new CoopWorld(this);
    this.music = new CoopMusic(this);
    this.revival = new CoopRevival(this);
    this.replica = new BossReplica(this);
    this.lastInput = this.lastFrame = this.lastKeyframe = -Infinity;
    this.forceKeyframe = true; this.disposed = false;
    this.attackIds = new WeakMap(); this.attackSequence = 0;
    this.metrics = { frames: 0, bytes: 0, maxBytes: 0, captureMs: 0, nodes: 0 };
    this.controlsSent = new Map();
    // Limpa a representação antiga antes de instalar a representação atual.
    for (const actor of scene.remotePlayers.values()) actor.destroy();
    scene.remotePlayers.clear();
    destruirBoss(scene);
    if (this.mapKey === "Level1Parte2") {
      criarAnimacoesNovoBoss(scene);
      const poses = { summon: assetsNovoBoss.torreSummon, idle: assetsNovoBoss.torreIdle,
        attacked: assetsNovoBoss.torreAttacked, death: assetsNovoBoss.torreDeath };
      for (const p of pontosTorresNovoBoss(scene) || []) prepararPisoTorre(scene, p, poses);
    }
    const saved = this.manager.localVitals;
    if (saved && saved.health > 0) {
      scene.vida = Math.min(scene.vidaMaxima, saved.health);
      scene.estamina = Math.min(scene.estaminaMaxima, saved.stamina);
    }
    this.onFrame = packet => this.receiveFrame(packet);
    this.onAction = action => this.receiveAction(action);
    this.onRoom = room => this.receiveRoom(room);
    this.onInput = () => { if (!this.teamDefeated) this.players.receive(this.manager.room.players); };
    this.onPost = (time, delta) => this.update(time, delta);
    this.onShutdown = () => this.destroy();
    this.onPointer = (pointer, objects = []) => {
      if (scene.restricaoControleNovoBoss && (objects.includes(scene.botaoAtaque) ||
          objects.length === 0 && pointer.leftButtonDown?.())) this.escape();
    };
    this.manager.on("coopFrame", this.onFrame);
    this.manager.on("coopAction", this.onAction);
    this.manager.on("roomUpdated", this.onRoom);
    this.manager.on("playerInput", this.onInput);
    scene.events.on("postupdate", this.onPost);
    scene.events.once("shutdown", this.onShutdown);
    scene.input.on("pointerdown", this.onPointer);
    if (this.host) this.prepareAuthority();
    this.receiveRoom(this.manager.room);
    this.world.restore();
    this.manager.sendCoopAction("keyframe", {});
  }
  prepareAuthority() {
    const runtime = this, scene = this.scene;
    this.bossContext = soloContext(scene, {
      get player() { return runtime.bossTarget()?.player || scene.player; },
      get hitboxDanoPlayer() { return runtime.bossTarget()?.hitboxDanoPlayer || scene.hitboxDanoPlayer; },
      get vida() { return runtime.bossTarget()?.vida ?? scene.vida; },
      get morteEmAndamento() { return runtime.playerContexts().every(c => c.morteEmAndamento || c.vida <= 0); },
      restricaoControleNovoBoss: null,
    });
    if (this.mapKey === "Level1Parte2") prepararBoss(this.bossContext, scene.novoBossConfig || novoBossConfig);
    scene.aliados = this.players.objects();
    Object.defineProperties(scene.player, {
      vida: { configurable: true, get: () => scene.vida, set: value => { scene.vida = value; } },
      vidaMaxima: { configurable: true, get: () => scene.vidaMaxima },
    });
  }
  playerContexts() { return [this.localContext, ...this.players.contexts()]; }
  inArena(player) { return jogadorNaArenaNovoBoss(player, this.scene.novoBoss?.config.arena || novoBossConfig.arena); }
  bossTarget() {
    const boss = this.scene.novoBoss;
    return this.playerContexts().filter(c => c.player?.active && c.vida > 0 && !c.morteEmAndamento && this.inArena(c.player))
      .sort((a, b) => Math.hypot(a.player.x - (boss?.x || -1080), a.player.y - (boss?.y || -5810)) -
        Math.hypot(b.player.x - (boss?.x || -1080), b.player.y - (boss?.y || -5810)))[0];
  }
  updateBoss(time, delta) {
    if (this.host) atualizarBoss(this.bossContext, time, delta);
  }
  specialSnapshot(context) {
    const e = context.estadoEspecial;
    return { cooldown: Math.max(0, (e?.proximoUso || 0) - this.scene.time.now),
      parry: Math.max(0, (e?.parryAte || 0) - this.scene.time.now),
      hologram: !!e?.holograma?.active };
  }
  requestSpecial() {
    if (this.teamDefeated || this.scene.morteEmAndamento || this.scene.vida <= 0) return false;
    return this.manager.sendCoopAction("special", {});
  }
  escape() {
    if (this.host) return registrarApertoLibertacaoNovoBoss(this.localContext);
    return this.manager.sendCoopAction("escape", {});
  }
  requestDamage(target, amount, area = null, attack = null) {
    if (this.teamDefeated || this.scene.morteEmAndamento || this.scene.vida <= 0) return false;
    if (!(amount > 0) || !Number.isFinite(amount)) return false;
    let attackId = null;
    if (attack && typeof attack === "object") {
      if (!this.attackIds.has(attack)) this.attackIds.set(attack, ++this.attackSequence);
      attackId = this.attackIds.get(attack);
    }
    return this.manager.sendCoopAction("damage", { target, amount,
      area: area && { x: area.x, y: area.y, width: area.width, height: area.height }, attackId,
      basic: attack?.ataqueBasico ?? null });
  }
  damage(context, amount, origin = null, options = {}) {
    if (context.vida <= 0 || context.morteEmAndamento || context.player.invulneravel ||
        context.tentarBloquearDanoEspecial?.(origin)) return false;
    if (!context.coopRemotePlayerId) {
      const before = this.scene.vida; causarDanoPlayer(this.scene, amount, origin);
      return this.scene.vida < before;
    }
    const entry = this.players.remotes.get(context.coopRemotePlayerId);
    if (!entry || this.scene.time.now < entry.invulnerableUntil || entry.data.coop?.invulnerable) return false;
    entry.invulnerableUntil = this.scene.time.now + 500;
    this.manager.sendCoopAction("hurt", { amount, origin: origin && { x: origin.x, y: origin.y }, options },
      { authority: true, targetId: context.coopRemotePlayerId });
    return true;
  }
  sendControl(context) {
    const id = context.coopRemotePlayerId;
    if (!id) return;
    const r = context.restricaoControleNovoBoss;
    const state = r ? { fonte: r.fonte, restanteMs: r.restanteMs,
      apertos: r.apertos, apertosNecessarios: r.apertosNecessarios,
      x: round(context.player.x), y: round(context.player.y) } : null;
    const now = this.scene.time.now, last = this.controlsSent.get(id);
    if (last && now - last.time < 50 && JSON.stringify(last.state) === JSON.stringify(state)) return;
    this.controlsSent.set(id, { time: now, state });
    this.manager.sendCoopAction("control", { state }, { authority: true, targetId: id });
  }
  receiveRoom(room) {
    if (this.disposed || this.teamDefeated || !room) return;
    const host = room.hostId === this.manager.playerId;
    if (host !== this.host) this.changeAuthority(host);
    this.scene.isMultiplayerHost = host;
    this.players.receive(room.players || []);
    if (this.host) this.scene.aliados = this.players.objects();
    this.world.receiveMap(room.coopMap);
  }
  receiveAction(action) {
    if (this.disposed) return;
    if (action.authority && action.kind === "teamDefeated") { this.finishTeamGame(); return; }
    if (this.teamDefeated) return;
    if (action.kind === "musicClock") { this.music.receiveClock(action); return; }
    const s = this.scene, p = action.payload || {};
    if (action.authority) {
      if (action.kind === "combatHit" && !this.host) {
        playReplicatedHitEffects(s, this.receiver.get(p.visual), p);
      } else if (action.kind === "nyxAuraSound") {
        if (!this.host && p.mapKey === this.mapKey) {
          if (p.stop) pararSomAuraNyx(s, p.id);
          else tocarSomAuraNyx(s, { id: p.id, fase: p.fase, duracaoMs: p.fase === "cura" ? NYX_AURA.duracao : NYX_AURA.animacao,
            idadeMs: Number.isFinite(p.startedAt) ? Math.max(0, Date.now() - p.startedAt) : 0 });
        }
      } else if (action.kind === "hurt") causarDanoPlayer(s, p.amount, p.origin);
      else if (action.kind === "heal" && s.vida > 0 && !s.morteEmAndamento) recuperarVida(s, p.amount);
      else if (action.kind === "stamina" && Number.isFinite(p.amount)) {
        s.estamina = Math.max(0, Math.min(s.estaminaMaxima, s.estamina + p.amount));
      }
      else if (action.kind === "revive") this.revivePlayer(p.downId);
      else if (action.kind === "teleport") this.teleport(p.x, p.y);
      else if (action.kind === "specialPose") {
        if (s.personagemSelecionada === "magnus-force") iniciarAnimacaoMarreta(s);
      } else if (action.kind === "control") {
        s.restricaoControleNovoBoss = p.state;
        if (p.state) this.teleport(p.state.x, p.state.y);
      } else this.world.receive(action);
      return;
    }
    if (!this.host) return;
    // A queda já bloqueou o jogador; seus itens ainda precisam chegar ao mundo.
    if (action.kind === "inventoryDrop") { this.world.receive(action); return; }
    const context = action.playerId === this.manager.playerId ? this.localContext : this.players.remotes.get(action.playerId)?.context;
    if (action.kind === "keyframe") { this.forceKeyframe = true; return; }
    if (!context || context.morteEmAndamento || context.vida <= 0) return;
    if (action.kind === "special") {
      const before = { x: context.player.x, y: context.player.y };
      if (context.executarHabilidadeEspecial?.() !== true) return;
      if (context.coopRemotePlayerId && context.atacando && context.personagemSelecionada === "magnus-force") {
        this.manager.sendCoopAction("specialPose", {}, { authority: true, targetId: action.playerId });
      }
      if (before.x !== context.player.x || before.y !== context.player.y) {
        this.manager.sendCoopAction("teleport", { x: context.player.x, y: context.player.y },
          { authority: true, targetId: action.playerId });
      }
    } else if (action.kind === "devSpawn" && ["padrao", "serra", "bola"].includes(p.tipo) &&
        Number.isInteger(p.quantidade) && p.quantidade >= 1 && p.quantidade <= 3) {
      executarSpawnDev(soloContext(s, { player: context.player }), p.tipo, p.quantidade);
    } else if (action.kind === "escape") registrarApertoLibertacaoNovoBoss(context);
    else if (action.kind === "damage") this.applyDamage(context, p, action.playerId);
    else this.world.receive(action);
  }
  applyDamage(context, payload, playerId) {
    const s = this.scene;
    if (!Number.isFinite(payload.amount) || payload.amount <= 0 || payload.amount > 100) return;
    let amount = payload.amount;
    if (payload.basic) {
      if (!Number.isSafeInteger(payload.basic.id) || payload.basic.id <= 0) return;
      amount = obterBalanceamento(context.personagemSelecionada, true).dano;
      if (context.personagemSelecionada === "aria-kade") {
        if (!Number.isFinite(payload.basic.danoAria)) return;
        amount = Math.max(amount, Math.min(ARIA_ATTACK_CONFIG.maxDamage, payload.basic.danoAria));
      }
    }
    const target = (s.inimigos || []).find(e => e.networkId === payload.target) ||
      alvosAdicionaisCombate(this.localContext).find(e => this.combatId(e) === payload.target);
    if (!target?.active || target.morto || Math.hypot(context.player.x - target.x, context.player.y - target.y) > 850) return;
    if (payload.area && ![payload.area.x, payload.area.y, payload.area.width, payload.area.height].every(Number.isFinite)) return;
    // A mesma identidade é reutilizada pelos alvos de um golpe e pelos pacotes repetidos.
    this.damageAttacks ||= new Map();
    const key = `${playerId}:${payload.basic ? `basic:${payload.basic.id}` : payload.attackId ?? "hit"}`;
    if (!this.damageAttacks.has(key)) this.damageAttacks.set(key, {});
    if (this.damageAttacks.size > 1024) this.damageAttacks.delete(this.damageAttacks.keys().next().value);
    const attack = this.damageAttacks.get(key);
    if (payload.basic) {
      attack.targets ||= new Set();
      if (attack.targets.has(payload.target)) return;
      attack.targets.add(payload.target);
    }
    if (target.tipoRobo) causarDanoInimigo(s, target, amount, {
      attacker: context.player, playerId, localFeedback: playerId === this.manager.playerId });
    else causarDanoAlvoAdicional(this.localContext, target, amount, payload.area, attack);
  }
  broadcastHit(enemy, damage, options = {}) {
    if (!this.host) return;
    this.manager.sendCoopAction("combatHit", { visual: this.sender.id(enemy),
      x: enemy.x, y: enemy.y, depth: enemy.depth, dead: enemy.vida <= 0, damage,
      playerId: options.playerId || this.manager.playerId,
      particles: options.particles, hitStop: options.hitStop,
      shakeDuration: options.shakeDuration, playSound: !!options.playSound }, { authority: true });
  }
  combatId(target) {
    if (target === this.scene.novoBoss) return "boss";
    return target.torre ? `torre:${target.id}` : `copia:${this.sender.id(target.sprite)}`;
  }
  receiveFrame(packet) {
    if (this.host || this.teamDefeated) return;
    if (Object.prototype.hasOwnProperty.call(packet, "music")) this.music.receive(packet.music, packet.streamId);
    if (packet.mapKey !== this.mapKey) return;
    this.revival.receive(packet.revivals);
    if (this.receivedStream !== packet.streamId) {
      this.receivedStream = packet.streamId;
      this.receiver.destroy(); this.replica.destroy();
      this.receivedSequence = null;
      this.awaitingKeyframe = true;
    }
    if ((!this.receivedSequence || packet.sequence > this.receivedSequence + 1) && !packet.visuals?.full)
      this.awaitingKeyframe = true;
    this.receivedSequence = packet.sequence;
    this.latestFrame = packet;
    if (this.awaitingKeyframe && !packet.visuals?.full) {
      if (!this.keyframeRequestedAt || Date.now() - this.keyframeRequestedAt > 500) {
        this.manager.sendCoopAction("keyframe", {}); this.keyframeRequestedAt = Date.now();
      }
      this.world.receiveFrame(packet);
      return;
    }
    this.awaitingKeyframe = false; this.keyframeRequestedAt = 0;
    this.receiver.receive(packet.visuals);
    const s = this.scene;
    s.inimigos = (packet.targets || []).map(data => {
      const actor = this.receiver.get(data.visual);
      if (!actor) return null;
      Object.assign(actor, { remoteOnly: true, networkId: data.id, tipoRobo: data.tipoRobo,
        vida: data.vida, vidaMaxima: data.vidaMaxima, morto: data.morto, origemSpawn: data.origemSpawn,
        direcaoAtual: data.direcaoAtual,
        hitboxDano: data.hitbox && new Phaser.Geom.Rectangle(...Object.values(data.hitbox)),
        // A réplica não simula física. GameObject.body é reservado a corpos
        // do Phaser, que precisam implementar destroy() ao trocar de cena.
        coopBody: data.body && new Phaser.Geom.Rectangle(...Object.values(data.body)) });
      configurarSomPropulsaoRoboBola(s, actor);
      return actor;
    }).filter(Boolean);
    s.inimigoTeste = s.inimigos[0] || null;
    this.replica.receive(packet.boss);
    const self = packet.players.find(p => p.id === this.manager.playerId);
    const state = self?.coop?.special;
    if (state && s.estadoEspecial) {
      s.estadoEspecial.proximoUso = s.time.now + state.cooldown;
      s.coopParryUntil = s.time.now + state.parry;
      s.coopHologram = state.hologram;
    }
    this.world.receiveFrame(packet);
  }
  worldObjects() {
    const s = this.scene, excluded = new Set([s.player, ...this.players.objects(), ...playerVisualObjects(s)]);
    for (const effects of this.players.effects.values()) for (const { object } of effects.entries.values()) excluded.add(object);
    const objects = [];
    function visit(o) {
      if (!o?.active || o.coopReplica || o.coopLocalVisual || excluded.has(o) || o.scrollFactorX === 0 || o.scrollFactorY === 0) return;
      if (!o.visible && !o.body && o.type === "Graphics") return;
      objects.push(o);
      if (o.type === "Container") for (const child of o.list) visit(child);
    }
    for (const o of s.children.list) if (!this.baseline.has(o)) visit(o);
    return objects;
  }
  update(time, delta) {
    if (this.disposed || this.teamDefeated || !this.manager.room || !Number.isFinite(delta)) return;
    if (this.host) this.world.syncInventoryDrops();
    if (this.checkTeamDefeat()) return;
    const s = this.scene;
    this.players.update(time, delta);
    this.music.update();
    this.revival.update(delta);
    if (this.host) {
      atualizarRestricaoNovoBoss(this.localContext, delta);
      if (s.morteEmAndamento) { atualizarInimigoTeste(s, time); atualizarRoboBola(s, time, delta); }
      this.checkRemoteProjectiles();
    } else { this.receiver.update(delta); this.replica.update(delta); this.world.update(delta); }
    if (time - this.lastInput >= 1000 / COOP.inputHz) {
      this.lastInput = time;
      const extra = this.players.localState();
      this.manager.sendPlayerState(round(s.player.x), round(s.player.y), s.direcaoAtual,
        (s.player.body?.velocity?.lengthSq() || 0) > 0, s.atacando,
        s.direcaoAtaque || s.direcaoAtual, s.networkAttackId, s.attackPhase, [], extra);
    }
    if (this.host && time - this.lastFrame >= 1000 / COOP.worldHz) {
      this.lastFrame = time;
      const start = performance.now(), full = this.forceKeyframe || time - this.lastKeyframe >= COOP.keyframeMs;
      if (full) { this.lastKeyframe = time; this.forceKeyframe = false; }
      for (const e of s.inimigos || []) if (!e.networkId) e.networkId = `enemy:${this.sender.id(e)}`;
      const players = this.manager.room.players;
      for (const e of this.players.remotes.values()) if (e.context) {
        const data = players.find(p => p.id === e.data.id);
        if (data?.coop) data.coop.special = this.specialSnapshot(e.context);
      }
      const packet = { mapKey: this.mapKey, streamId: this.streamId,
        music: this.music.snapshot(), revivals: this.revival.snapshot(),
        visuals: this.sender.capture(this.worldObjects(), full),
        targets: (s.inimigos || []).filter(e => e.active && !e.morto).map(e => describeCombatTarget(e, e.networkId, this.sender)),
        boss: describeBoss(s, this.sender), ...this.world.snapshot() };
      this.manager.publishCoopFrame(packet);
      const bytes = JSON.stringify(packet).length;
      Object.assign(this.metrics, { frames: this.metrics.frames + 1, bytes: this.metrics.bytes + bytes,
        maxBytes: Math.max(this.metrics.maxBytes, bytes), captureMs: performance.now() - start,
        nodes: this.sender.previous.size });
    }
  }
  checkRemoteProjectiles() {
    const s = this.scene;
    for (const laser of obterFilhosGrupoSeguro(s.lasersInimigo)) {
      if (!laser.active || laser.especialRefletido) continue;
      for (const c of this.players.contexts()) {
        if (c.vida <= 0 || c.morteEmAndamento) continue;
        if (c.tentarInterceptarLaserEspecial?.(laser)) break;
        if (c.acertarHologramaEspecial?.(laser)) break;
        const box = c.hitboxDanoPlayer;
        if (box && Phaser.Geom.Intersects.RectangleToRectangle(box, laser.getBounds())) {
          const velocity = laser.body?.velocity;
          const origin = velocity && (velocity.x || velocity.y)
            ? { x: c.player.x - velocity.x, y: c.player.y - velocity.y } : laser;
          this.damage(c, laser.danoLaser || laser.especialAtirador?.danoLaser || 5, origin);
          laser.destroy(); break;
        }
      }
    }
  }
  teleport(x, y) {
    if (![x, y].every(Number.isFinite)) return;
    const p = this.scene.player; p.body.reset(x, y); p.body.updateFromGameObject(); p.setVelocity(0, 0);
  }
  checkTeamDefeat() {
    if (!this.host || this.teamDefeated) return false;
    const players = this.manager.room?.players ?? [];
    if (!players.length || !players.every(p => p.id === this.manager.playerId
      ? this.scene.morteEmAndamento || this.scene.vida <= 0
      : p.dead || (Number.isFinite(p.health) && p.health <= 0))) return false;
    this.manager.sendCoopAction("teamDefeated", {}, { authority: true });
    this.finishTeamGame();
    return true;
  }
  finishTeamGame() {
    if (this.teamDefeated) return;
    this.teamDefeated = true;
    this.scene.ariaAttackJoystick?.cancelar();
    this.scene.atacando = false;
    this.scene.attackBufferedUntil = 0;
    this.scene.ariaAtaqueCarregando = false;
    this.revival.destroy();
    mostrarTelaMorte(this.scene, { equipeDerrotada: true });
  }
  downPlayer() {
    const s = this.scene;
    if (s.morteEmAndamento) return;
    s.ariaAttackJoystick?.cancelar();
    s.morteEmAndamento = true; s.vida = 0; s.player.morto = true;
    s.coopDownId = `${this.manager.playerId}:${Date.now()}:${this.downSequence = (this.downSequence || 0) + 1}`;
    droparInventarioAoMorrer(s);
    s.atacando = false; s.attackBufferedUntil = 0; s.attackPhase = "normal";
    s.ariaAtaqueCarregando = false; s.ariaCargaInicio = null;
    if (s.estadoDash) s.estadoDash.ativo = false;
    s.player.setVelocity(0, 0); s.player.body.enable = false;
    s.restricaoControleNovoBoss = null;
    s.somCorrida?.stop();
    animarQuedaCoop(s);
    this.lastInput = -Infinity;
  }
  revivePlayer(downId) {
    const s = this.scene;
    if (this.teamDefeated) return false;
    if (!s.morteEmAndamento || !downId || downId !== s.coopDownId) return false;
    const posicao = { x: s.player.x, y: s.player.y };
    s.morteEmAndamento = false; s.player.morto = false; s.player.body.enable = true;
    s.player.invulneravel = false; s.restricaoControleNovoBoss = null;
    respawnPlayer(s, posicao); s.player.body.updateFromGameObject();
    s.coopDownId = null; this.lastInput = -Infinity;
    return true;
  }
  changeAuthority(host) {
    this.host = host;
    this.music.changeAuthority(host);
    if (!host) return;
    this.manager.coopReceivedSequence = -1;
    this.forceKeyframe = true;
    this.replica.destroy(); this.receiver.destroy();
    if (this.scene.iluminacaoFabrica) this.scene.iluminacaoFabrica.coopReplica = false;
    this.scene.inimigos = []; this.scene.novoBoss = null;
    for (const entry of this.players.remotes.values()) if (!entry.context) this.players.prepareContext(entry);
    this.prepareAuthority();
    this.world.restore();
  }
  destroy() {
    if (this.disposed) return;
    this.disposed = true;
    this.manager.localVitals = { health: this.scene.vida, stamina: this.scene.estamina };
    this.manager.off("coopFrame", this.onFrame); this.manager.off("coopAction", this.onAction);
    this.manager.off("roomUpdated", this.onRoom);
    this.manager.off("playerInput", this.onInput);
    this.scene.events.off("postupdate", this.onPost); this.scene.events.off("shutdown", this.onShutdown);
    this.scene.input.off("pointerdown", this.onPointer);
    this.players.destroy(); this.replica.destroy(); this.receiver.destroy(); this.world.destroy(); this.music.destroy(); this.revival.destroy();
    if (this.scene.coopRuntime === this) this.scene.coopRuntime = null;
  }
}
