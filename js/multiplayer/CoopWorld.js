import { COOP } from "./CoopProtocol.js";
import { localizarTelasSupercomputador } from "../enemies/novoBoss/NovoBossSupercomputador.js";
import { novoBossConfig } from "../enemies/novoBoss/NovoBossConfig.js";
import { Inventory } from "../inventory/Inventory.js";

const sharedKey = key => key === "factoryGeneratorPowered" || /^factoryDoorOpen(?::porta\d+)?$/.test(key);
export class CoopWorld {
  constructor(runtime) {
    this.r = runtime; this.scene = runtime.scene; this.pending = new Set();
    this.applying = false; this.transitioning = false;
    this.manager = runtime.manager;
    this.manager.room.coopProgress ||= { flags: {}, collected: {} };
    this.onRegistry = (_parent, key, value) => {
      if (!this.applying && sharedKey(key) && value === true) {
        this.manager.sendCoopAction("progress", { key, value });
      }
    };
    this.scene.game.registry.events.on("changedata", this.onRegistry);
    this.screens = localizarTelasSupercomputador(this.scene.map, novoBossConfig.arena)
      .flatMap(t => t.celulas.map(c => c.tile));
  }
  collect(pickup) {
    if (this.pending.has(pickup.uniqueId)) return false;
    const preview = new Inventory({ slots: this.scene.inventory.getSlots(), collectedItemIds: [] });
    if (!preview.addItem(pickup.itemId, pickup.quantity)) {
      this.scene.mostrarAvisoInventarioCheio?.(); return false;
    }
    this.pending.add(pickup.uniqueId);
    return this.manager.sendCoopAction("pickup", { uid: pickup.uniqueId });
  }
  receive(action) {
    const p = action.payload || {}, r = this.r, s = this.scene;
    if (action.authority) {
      if (action.kind === "collected") this.applyCollected(p);
      else if (action.kind === "pickupRejected") this.pending.delete(p.uid);
      else if (action.kind === "progressState") this.applyFlags(p.flags);
      else if (action.kind === "map") this.applyMap(p);
      return;
    }
    if (!r.host) return;
    const player = action.playerId === this.manager.playerId ? s.player : r.players.remotes.get(action.playerId)?.actor;
    if (!player?.active) return;
    const progress = this.manager.room.coopProgress;
    if (action.kind === "pickup") {
      const pickup = s.itensColetaveis.find(i => i.uniqueId === p.uid);
      if (!pickup || progress.collected[p.uid] || Math.hypot(player.x - pickup.x, player.y - pickup.y) > pickup.range + 32) {
        this.manager.sendCoopAction("pickupRejected", { uid: p.uid }, { authority: true, targetId: action.playerId }); return;
      }
      const grant = { uid: pickup.uniqueId, itemId: pickup.itemId, quantity: pickup.quantity, playerId: action.playerId };
      progress.collected[p.uid] = grant;
      this.applyCollected(grant);
      this.manager.sendCoopAction("collected", grant, { authority: true });
      this.manager.publishState();
    } else if (action.kind === "progress" && sharedKey(p.key) && p.value === true) {
      // O evento só é publicado após a interação solo consumir/validar os requisitos.
      if (r.mapKey !== "Level1Parte2") return;
      progress.flags[p.key] = true;
      this.applyFlags(progress.flags);
      this.manager.sendCoopAction("progressState", { flags: progress.flags }, { authority: true });
      this.manager.publishState();
    } else if (action.kind === "map" && COOP.maps.includes(p.key) && p.key !== r.mapKey) {
      const target = p.key === "Level1Parte2" ? { key: p.key, x: 98, y: -1040 } : { key: p.key, x: 72, y: -2160 };
      const nearDoor = r.mapKey === "Level1" ? Math.hypot(player.x - 72, player.y + 2184) < 160 :
        Math.hypot(player.x - 95, player.y + 916) < 180;
      if (!nearDoor && !s.developerMode) return;
      this.manager.room.coopMap = target;
      this.manager.sendCoopAction("map", target, { authority: true });
      this.applyMap(target);
      this.manager.publishState();
    }
  }
  applyCollected(grant) {
    const s = this.scene;
    this.pending.delete(grant.uid);
    if (s.inventory.hasCollected(grant.uid)) return;
    if (grant.playerId === this.manager.playerId && !s.inventory.addItem(grant.itemId, grant.quantity)) return;
    s.inventory.markCollected(grant.uid);
    for (const item of s.itensColetaveis) if (item.uniqueId === grant.uid) {
      item.marker?.destroy?.(); item.image.destroy();
    }
    s.itensColetaveis = s.itensColetaveis.filter(i => i.uniqueId !== grant.uid);
    if (s.itemColetavelProximo?.uniqueId === grant.uid) s.itemColetavelProximo = null;
  }
  applyFlags(flags = {}) {
    const s = this.scene;
    this.applying = true;
    try {
      for (const [key, value] of Object.entries(flags)) if (sharedKey(key) && value === true) s.game.registry.set(key, true);
      if (flags.factoryGeneratorPowered && !s.luzFabricaAcesa) s.acenderLuzFabrica?.();
      for (const door of s.portasFabrica || []) {
        const key = door.nome === "porta01" ? "factoryDoorOpen" : `factoryDoorOpen:${door.nome}`;
        if (flags[key] && !door.bloqueadaPorBoss && door.estado === "fechada") door.aplicarEstadoRede?.({ estado: "aberta", progresso: 1 });
      }
    } finally { this.applying = false; }
  }
  restore() {
    const progress = this.manager.room.coopProgress;
    this.applyFlags(progress?.flags);
    for (const grant of Object.values(progress?.collected || {})) this.applyCollected(grant);
  }
  requestMap(key) {
    if (this.transitioning) return false;
    return this.manager.sendCoopAction("map", { key });
  }
  applyMap(data) {
    const s = this.scene;
    if (this.transitioning || data.key === this.r.mapKey || !COOP.maps.includes(data.key)) return;
    this.transitioning = true; s.transicaoEmAndamento = true;
    s.player.setVelocity(0, 0); s.movimentoBloqueado = true;
    s.cameras.main.fadeOut(250, 0, 0, 0);
    s.cameras.main.once("camerafadeoutcomplete", () => s.scene.start(data.key, {
      personagem: s.personagemSelecionada, multiplayer: true, spawnX: data.x, spawnY: data.y,
      portaAberta: data.key === "Level1", transicao: true }));
  }
  snapshot() {
    const s = this.scene;
    return { progress: this.manager.room.coopProgress,
      doors: (s.portasFabrica || []).map(d => ({ nome: d.nome, estado: d.estado,
        progresso: d.progresso, bloqueadaPorBoss: d.bloqueadaPorBoss })),
      screens: this.screens.map(t => t.index),
      introCamera: s.cenaEntradaBossAtiva ? { x: s.cameras.main.midPoint.x,
        y: s.cameras.main.midPoint.y, zoom: s.cameras.main.zoom } : null };
  }
  receiveFrame(packet) {
    this.manager.room.coopProgress = packet.progress;
    this.restore();
    for (const d of packet.doors || []) this.scene.portasFabrica?.find(p => p.nome === d.nome)?.aplicarEstadoRede?.(d);
    if (Array.isArray(packet.screens) && packet.screens.length === this.screens.length)
      this.screens.forEach((tile, i) => { tile.index = packet.screens[i]; });
    const s = this.scene;
    if (packet.introCamera && this.r.inArena(s.player)) {
      if (!this.introLock) this.savedLock = !!s.movimentoBloqueado;
      this.introLock = true; s.movimentoBloqueado = true; s.cenaEntradaBossAtiva = true;
      s.player.setVelocity(0, 0); s.cameras.main.stopFollow();
      s.cameras.main.setZoom(packet.introCamera.zoom).centerOn(packet.introCamera.x, packet.introCamera.y);
    } else if (this.introLock) {
      this.introLock = false; s.movimentoBloqueado = this.savedLock; s.cenaEntradaBossAtiva = false;
      s.cameras.main.startFollow(s.player, false);
    }
  }
  destroy() { this.scene.game.registry.events.off("changedata", this.onRegistry); }
}
