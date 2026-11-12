import { planejarEntradaBoss } from "./CoopBossEntrance.js";
import { tocarSomColocando } from "../sounds/colocando.js";
import { COOP, mergeCoopProgress } from "./CoopProtocol.js";
import { localizarTelasSupercomputador } from "../enemies/novoBoss/NovoBossSupercomputador.js";
import { novoBossConfig } from "../enemies/novoBoss/NovoBossConfig.js";
import { Inventory } from "../inventory/Inventory.js";
import { GENERATOR_LOOP_START_SECONDS } from "../sounds/gerador.js";
import { ocultarHUDDuranteCena } from "../ui/HudCinematic.js";

const sharedKey = key => key === "factoryGeneratorPowered" || /^factoryDoorOpen(?::porta\d+)?$/.test(key);
export class CoopWorld {
  constructor(runtime) {
    this.r = runtime; this.scene = runtime.scene; this.pending = new Set();
    this.applying = false; this.transitioning = false;
    this.manager = runtime.manager;
    this.manager.room.coopProgress ||= { flags: {}, collected: {} };
    this.onRegistry = (_parent, key, value) => {
      if (!this.applying && sharedKey(key) && value === true) {
        this.manager.sendCoopAction("progress", { key, value,
          generatorStartedAt: this.manager.room.coopProgress.generatorStartedAt });
      }
    };
    this.scene.game.registry.events.on("changedata", this.onRegistry);
    this.scene.game.registry.events.on("setdata", this.onRegistry);
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
      else if (action.kind === "progressState") {
        if (p.devLighting === null || typeof p.devLighting === "boolean") this.manager.room.coopDevLighting = p.devLighting;
        this.manager.room.coopProgress = mergeCoopProgress(this.manager.room.coopProgress, p.progress);
        this.applyFlags(p.flags || p.progress?.flags);
      }
      else if (action.kind === "map") this.applyMap(p);
      else if (action.kind === "bossIntro") {
        if (!p.entrada || (this.bossAssembly && p.entrada.id <= this.bossAssembly.id)) return;
        this.introCamera = p.camera;
        this.aplicarEntradaBoss(p.entrada);
        if (!this.r.host) this.update(0);
      }
      else if (action.kind === "devLightingState") {
        this.manager.room.coopDevLighting = p.on;
        this.applyDevLighting(p.on);
      }
      return;
    }
    if (!r.host) return;
    const player = action.playerId === this.manager.playerId ? s.player : r.players.remotes.get(action.playerId)?.actor;
    if (!player?.active) return;
    const progress = this.manager.room.coopProgress;
    const developer = action.playerId === this.manager.playerId ? s.developerMode :
      r.players.remotes.get(action.playerId)?.data.coop?.developer;
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
    } else if (action.kind === "devLighting" && developer && typeof p.on === "boolean" && r.mapKey === "Level1Parte2") {
      this.manager.room.coopDevLighting = p.on;
      this.applyDevLighting(p.on);
      this.manager.sendCoopAction("devLightingState", { on: p.on }, { authority: true });
      this.manager.publishState();
    } else if (action.kind === "progress" && sharedKey(p.key) && p.value === true) {
      // O evento só é publicado após a interação solo consumir/validar os requisitos.
      if (r.mapKey !== "Level1Parte2") return;
      progress.flags[p.key] = true;
      if (p.key === "factoryGeneratorPowered" && p.reactivate) this.manager.room.coopDevLighting = null;
      if (p.key === "factoryGeneratorPowered" && !progress.generatorStartedAt) {
        progress.generatorStartedAt = Number.isFinite(p.generatorStartedAt)
          ? Math.min(Date.now(), Math.max(Date.now() - 10000, p.generatorStartedAt)) : Date.now();
      }
      this.applyFlags(progress.flags);
      this.manager.sendCoopAction("progressState", { progress,
        devLighting: this.manager.room.coopDevLighting ?? null }, { authority: true });
      this.manager.publishState();
    } else if (action.kind === "map" && !this.transitioning && p.from === r.mapKey &&
        COOP.maps.includes(p.key) && p.key !== r.mapKey) {
      if (p.key === "Level1" && progress.flags.factoryGeneratorPowered) return;
      // A equipe precisa resgatar os caídos antes de mudar de mapa.
      if (r.revival?.participants().some(p => p.dead)) return;
      const boss = !!(p.boss && developer && p.key === "Level1Parte2");
      const target = { ...(boss ? { key: p.key, x: -1085, y: -5169 } : p.key === "Level1Parte2" ? { key: p.key, x: 98, y: -1040 } :
        { key: p.key, x: 72, y: -2160 }), from: r.mapKey,
        id: (this.manager.room.coopMap?.id || 0) + 1 };
      const nearDoor = r.mapKey === "Level1" ? Math.hypot(player.x - 72, player.y + 2184) < 160 :
        Math.hypot(player.x - 95, player.y + 916) < 180;
      if (!nearDoor && !developer) return;
      this.manager.room.coopMap = target;
      this.manager.sendCoopAction("map", target, { authority: true });
      this.applyMap(target);
      this.manager.publishState();
    }
  }
  applyCollected(grant) {
    const s = this.scene;
    const coletaLocalPendente = this.pending.has(grant.uid);
    this.pending.delete(grant.uid);
    if (s.inventory.hasCollected(grant.uid)) return;
    if (grant.playerId === this.manager.playerId && !s.inventory.addItem(grant.itemId, grant.quantity)) return;
    s.inventory.markCollected(grant.uid);
    // Restauração de progresso e coletas de outros jogadores não são novas coletas locais.
    if (coletaLocalPendente && grant.playerId === this.manager.playerId) tocarSomColocando(s);
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
      if (flags.factoryGeneratorPowered && !s.luzFabricaAcesa && this.manager.room.coopDevLighting !== false) s.acenderLuzFabrica?.();
      if (typeof this.manager.room.coopDevLighting === "boolean") this.applyDevLighting(this.manager.room.coopDevLighting);
      for (const door of s.portasFabrica || []) {
        const key = door.nome === "porta01" ? "factoryDoorOpen" : `factoryDoorOpen:${door.nome}`;
        if (flags[key] && !door.bloqueadaPorBoss && door.estado === "fechada" &&
            (door.nome !== "porta05" || s.novoBoss?.morto === true)) door.aplicarEstadoRede?.({ estado: "aberta", progresso: 1 });
      }
    } finally { this.applying = false; }
  }
  applyDevLighting(on) {
    const s = this.scene;
    if (this.r.mapKey !== "Level1Parte2" || typeof on !== "boolean" || s.luzFabricaAcesa === on) return;
    s.luzFabricaAcesa = on;
    s.definirIluminacaoFabrica?.(on);
  }
  restore() {
    const progress = this.manager.room.coopProgress;
    this.applyFlags(progress?.flags);
    for (const grant of Object.values(progress?.collected || {})) this.applyCollected(grant);
  }
  generatorProgress() {
    const progress = this.manager.room.coopProgress;
    progress.generatorStartedAt ||= Date.now();
    if (!this.applying) this.manager.sendCoopAction("progress", { key: "factoryGeneratorPowered", value: true,
      generatorStartedAt: progress.generatorStartedAt, reactivate: true });
    return () => Math.max(0, Math.min(1,
      (Date.now() - (this.manager.room?.coopProgress?.generatorStartedAt || progress.generatorStartedAt)) /
        (GENERATOR_LOOP_START_SECONDS * 1000)));
  }
  requestMap(key, options = {}) {
    if (this.transitioning || Date.now() < (this.nextMapRequest || 0)) return false;
    this.nextMapRequest = Date.now() + 500;
    return this.manager.sendCoopAction("map", { ...options, key, from: this.r.mapKey });
  }
  receiveMap(data) {
    if (!data || !Number.isSafeInteger(data.id) || data.id <= (this.manager.coopMapAppliedId || 0)) return;
    if (data.key === this.r.mapKey) this.manager.coopMapAppliedId = data.id;
    else this.applyMap(data);
  }
  applyMap(data) {
    const s = this.scene;
    if (this.transitioning || !Number.isSafeInteger(data.id) || ![data.x, data.y].every(Number.isFinite) ||
        data.id <= (this.manager.coopMapAppliedId || 0) ||
        data.key === this.r.mapKey || !COOP.maps.includes(data.key)) return;
    this.manager.coopMapAppliedId = data.id;
    this.manager.room.coopMap = data;
    this.manager.coopTransitionUntil = Date.now() + COOP.transitionGraceMs;
    this.transitioning = true; s.transicaoEmAndamento = true;
    this.restoreIntro();
    s.player.setVelocity(0, 0); s.movimentoBloqueado = true;
    s.cameras.main.once("camerafadeoutcomplete", () => {
      if (data.key === "Level1Parte2") s.registry.set("fabricaVisitada", true);
      s.scene.start(data.key, {
        personagem: s.personagemSelecionada, multiplayer: true, spawnX: data.x, spawnY: data.y,
        developerMode: !!s.developerMode,
        portaAberta: data.key === "Level1", transicao: true });
    });
    s.cameras.main.fadeEffect?.reset();
    s.cameras.main.fadeOut(250, 0, 0, 0);
  }
  iniciarIntroducaoBoss(encontro, origem) {
    if (!this.r.host) return false;
    if (this.r.revival?.participants().some(p => p.dead)) return false;
    if (this.bossAssembly) return true;
    const participantes = this.r.playerContexts().filter(c => c.player?.active && c.vida > 0 && !c.morteEmAndamento)
      .map(c => ({ id: c.coopRemotePlayerId ?? this.manager.playerId, player: c.player, context: c }));
    const destinos = planejarEntradaBoss(this.scene, encontro, origem, participantes);
    if (!destinos) return false;
    const entrada = { id: 1, jogadores: destinos };
    this.aplicarEntradaBoss(entrada);
    for (const { context, player } of participantes) {
      if (context.estadoDash) context.estadoDash.ativo = false;
      context.companionPet?.setPosition(player.x - 45, player.y + 35);
    }
    const camera = this.scene.cameras.main;
    camera.centerOn(this.scene.player.x, this.scene.player.y);
    this.manager.sendCoopAction("bossIntro", { entrada,
      camera: { x: camera.midPoint?.x ?? origem.x, y: camera.midPoint?.y ?? origem.y, zoom: camera.zoom } },
      { authority: true });
    return true;
  }
  aplicarEntradaBoss(entrada) {
    if (!entrada || this.r.mapKey !== "Level1Parte2") return;
    if (!this.bossAssembly || entrada.id > this.bossAssembly.id) {
      this.bossAssembly = entrada;
      const local = entrada.jogadores[this.manager.playerId];
      if (local) {
        this.r.teleport(local.x, local.y);
        if (this.scene.estadoDash) this.scene.estadoDash.ativo = false;
        this.scene.cameras.main.centerOn(local.x, local.y);
      }
      for (const [id, ponto] of Object.entries(entrada.jogadores)) {
        const entry = this.r.players.remotes.get(id);
        if (!entry) continue;
        entry.actor.body.reset(ponto.x, ponto.y);
        entry.actor.body.updateFromGameObject();
        entry.actor.setVelocity(0, 0);
        entry.actor.coopTargetX = ponto.x; entry.actor.coopTargetY = ponto.y;
      }
    }
    this.scene.descarregarFabricaParaBoss?.();
  }
  snapshot() {
    const s = this.scene;
    return { progress: this.manager.room.coopProgress, map: this.manager.room.coopMap,
      bossAssembly: this.bossAssembly,
      devLighting: this.manager.room.coopDevLighting ?? null,
      lighting: s.iluminacaoFabrica?.snapshotRede(s.time.now),
      lightingZones: s.zonasLuzApagada?.snapshotRede(s.time.now),
      doors: (s.portasFabrica || []).map(d => ({ nome: d.nome, estado: d.estado,
        progresso: d.progresso, bloqueadaPorBoss: d.bloqueadaPorBoss })),
      screens: this.screens.map(t => t.index),
      introCamera: s.cenaEntradaBossAtiva ? { x: s.cameras.main.midPoint.x,
        y: s.cameras.main.midPoint.y, zoom: s.cameras.main.zoom } : null };
  }
  receiveFrame(packet) {
    if (typeof packet.devLighting === "boolean" || packet.devLighting === null)
      this.manager.room.coopDevLighting = packet.devLighting;
    if (packet.progress) this.manager.room.coopProgress = mergeCoopProgress(this.manager.room.coopProgress, packet.progress);
    this.receiveMap(packet.map);
    this.restore();
    this.aplicarEntradaBoss(packet.bossAssembly);
    this.scene.iluminacaoFabrica?.aplicarEstadoRede(packet.lighting, this.scene.time.now);
    for (const d of packet.doors || []) this.scene.portasFabrica?.find(p => p.nome === d.nome)?.aplicarEstadoRede?.(d);
    this.scene.zonasLuzApagada?.aplicarEstadoRede(packet.lightingZones, this.scene.time.now,
      this.scene.portasFabrica || [], this.scene.luzFabricaAcesa);
    if (Array.isArray(packet.screens) && packet.screens.length === this.screens.length)
      this.screens.forEach((tile, i) => { tile.index = packet.screens[i]; });
    this.introCamera = packet.introCamera;
    this.update(0);
  }
  update(delta = 0) {
    const s = this.scene, camera = s.cameras.main, target = this.introCamera;
    if (!this.transitioning && target && this.r.inArena(s.player) && !s.morteEmAndamento) {
      if (!this.introLock) {
        this.savedIntro = { lock: !!s.movimentoBloqueado, zoomX: camera.zoomX ?? camera.zoom,
          zoomY: camera.zoomY ?? camera.zoom, paused: s.player.anims?.isPaused,
          input: s.input.enabled, keyboard: s.input.keyboard?.enabled,
          follow: camera._follow || s.player, roundPixels: camera.roundPixels,
          lerpX: camera.lerp?.x, lerpY: camera.lerp?.y,
          offsetX: camera.followOffset?.x, offsetY: camera.followOffset?.y };
        this.hud = ocultarHUDDuranteCena(s, camera);
        this.cameraPose = { ...target };
        this.introLock = true;
        s.player.anims?.pause(); s.input.enabled = false;
        if (s.input.keyboard) { s.input.keyboard.resetKeys(); s.input.keyboard.enabled = false; }
      }
      s.movimentoBloqueado = true; s.cenaEntradaBossAtiva = true;
      s.player.setVelocity(0, 0); camera.stopFollow();
      const alpha = 1 - Math.exp(-Math.max(0, delta) / 65);
      for (const key of ["x", "y", "zoom"]) this.cameraPose[key] += (target[key] - this.cameraPose[key]) * alpha;
      camera.setZoom(this.cameraPose.zoom).centerOn(this.cameraPose.x, this.cameraPose.y);
    } else this.restoreIntro();
  }
  restoreIntro() {
    if (!this.introLock) return;
    const s = this.scene, previous = this.savedIntro, camera = s.cameras.main;
    this.introLock = false; s.movimentoBloqueado = previous.lock; s.cenaEntradaBossAtiva = false;
    this.hud?.restaurar(); this.hud = null;
    camera.setZoom(previous.zoomX, previous.zoomY);
    camera.startFollow(previous.follow?.active ? previous.follow : s.player, previous.roundPixels,
      previous.lerpX, previous.lerpY, previous.offsetX, previous.offsetY);
    if (!previous.paused) s.player.anims?.resume();
    s.input.enabled = previous.input;
    if (s.input.keyboard) { s.input.keyboard.resetKeys(); s.input.keyboard.enabled = previous.keyboard; }
  }
  destroy() {
    this.restoreIntro();
    this.scene.game.registry.events.off("changedata", this.onRegistry);
    this.scene.game.registry.events.off("setdata", this.onRegistry);
  }
}
