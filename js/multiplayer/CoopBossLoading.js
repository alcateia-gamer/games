/** Barreira coletiva do boss. Recursos são locais; decisões e revisões pertencem ao host. */
import { verificarEquipeViva } from "./CoopRevival.js";
import { CHARACTER_NAMES } from "../systems/UpgradeDefinitions.js";
import { mergeBossPreparation } from "./CoopProtocol.js";
import { planejarEntradaBoss } from "./CoopBossEntrance.js";
import { distanceToInteractionArea } from "../interactions/FactoryGenerator.js";
import { limparGrupoRobos } from "../enemies/EnemyTest.js";

const entradas = scene => (scene.portasFabrica ?? []).filter(p => ["porta02", "porta03"].includes(p.nome));
const vivo = p => !p.dead && (p.health ?? 1) > 0;
const CONTROLES_BOSS = new Set(["bossAccess", "bossPrepared", "bossPreparation", "bossIntro"]);
const ESPERA_SEM_PROGRESSO_MS = 15000;
export const isBossControl = action => CONTROLES_BOSS.has(action.kind);

export class CoopBossLoading {
  constructor(world) {
    this.world = world; this.r = world.r; this.scene = world.scene; this.manager = world.manager;
    this.state = null; this.lastReport = null; this.lastReportAt = -Infinity;
    this.destroyed = false; this.remoteLocks = new Map();
    this.acceptedSequences = new Map();
  }
  get local() { return this.scene.preparacaoBoss; }
  now() {
    if (this.r.host) return Date.now();
    const offset = this.r.music?.hostOffset;
    return Number.isFinite(offset) ? performance.now() + offset : Date.now() + (this.manager.hollowClockOffset || 0);
  }
  current(state = this.state) {
    const room = this.manager.room;
    return Boolean(state && room && state.roomCode === room.roomCode && state.mapId === (room.coopMap?.id ?? 0));
  }
  publish(intro = false) {
    this.state = { ...this.state, revision: this.state.revision + 1 };
    this.manager.room.coopBossPreparation = this.state;
    this.manager.sendCoopAction(intro ? "bossIntro" : "bossPreparation", { preparation: this.state }, { authority: true });
    this.manager.publishState();
  }
  begin() {
    if (!this.r.host || this.r.mapKey !== "Level1Parte2") return false;
    if (this.current()) return true;
    const room = this.manager.room, mapId = room.coopMap?.id ?? 0;
    // streamId já distingue navegador e visita, inclusive em HTTP sem crypto.randomUUID.
    this.state = { roomCode: room.roomCode, mapId, id: `${room.roomCode}:${mapId}:${this.r.streamId}`,
      revision: 0, phase: "loading", participants: room.players.map(p => p.id), clients: {} };
    this.publish(); this.apply(this.state);
    return true;
  }
  teamStatus() { return verificarEquipeViva(this.r); }
  rescueLines(unavailable) {
    if (unavailable.some(p => !p.dead)) return ["Preciso aguardar a confirmação da equipe antes de entrar."];
    if (unavailable.length >= 3) return ["Não podemos entrar agora. Precisamos reviver toda a equipe!",
      "Não podemos deixar ninguém para trás!"];
    const nomes = unavailable.map(p => CHARACTER_NAMES[p.character]).filter(Boolean);
    if (nomes.length !== unavailable.length || !nomes.length) return ["Não podemos deixar ninguém para trás!"];
    const aliados = nomes.join(" e ");
    if (nomes.length === 2) return [`Precisamos salvar ${aliados} antes de entrar!`,
      `Primeiro precisamos reviver ${aliados}.`];
    return [`Não podemos entrar ainda. Precisamos salvar ${aliados}!`,
      `${aliados} ficou para trás. Tenho que ajudar!`,
      `Não vou enfrentar essa máquina sem ${aliados}!`,
      `Primeiro precisamos reviver ${aliados}.`,
      `Ainda falta alguém. Vamos buscar ${aliados}!`, "Não podemos deixar ninguém para trás!"];
  }
  denyTeam(playerId, status = this.teamStatus()) {
    if (playerId === this.manager.playerId) {
      this.accessRequested = false;
      this.scene.leitorCartaoFabrica?.fala?.mostrar(this.rescueLines(status.unavailable));
    } else if (this.r.host) {
      this.manager.sendCoopAction("bossAccess", { denied: true, unavailable: status.unavailable,
        roomCode: this.manager.room.roomCode, mapId: this.manager.room.coopMap?.id ?? 0,
        session: this.manager.room.players.find(p => p.id === playerId)?.coop?.sceneSession },
        { authority: true, targetId: playerId });
    }
    return false;
  }
  checkReaderTeam() {
    const status = this.teamStatus();
    return status.alive || this.denyTeam(this.manager.playerId, status);
  }
  releaseAccess() {
    if (this.destroyed || this.r.teamDefeated || !this.r.host || this.current() ||
        !this.teamStatus().alive || !this.scene.liberarPortasArenaAutorizadas?.()) return false;
    return this.begin();
  }
  confirmCard(playerId = this.manager.playerId) {
    if (this.destroyed || this.r.teamDefeated || this.r.mapKey !== "Level1Parte2") return false;
    if (!this.r.host) {
      this.accessRequested = true; this.accessRequestedAt = Date.now();
      return this.manager.sendCoopAction("bossAccess", { roomCode: this.manager.room.roomCode,
        mapId: this.manager.room.coopMap?.id ?? 0, session: this.r.streamId });
    }
    if (this.current()) return false;
    const context = playerId === this.manager.playerId ? this.r.localContext : this.r.players.remotes.get(playerId)?.context;
    const data = this.manager.room.players.find(p => p.id === playerId);
    const reader = this.scene.leitorCartaoFabrica?.area;
    if (!context?.player?.active || !data || !vivo(data) || context.morteEmAndamento ||
        !reader || !this.scene.luzFabricaAcesa ||
        distanceToInteractionArea(context.player.x, context.player.y, reader) > 64) return false;
    const inventory = playerId === this.manager.playerId ? this.scene.inventory : {
      getQuantity: key => key === "card" && data.coop?.accessCard === true ? 1 : 0,
    };
    if (!(inventory?.getQuantity("card") > 0)) return false;
    const status = this.teamStatus();
    if (!status.alive) return this.denyTeam(playerId, status);
    const autorizacao = { player: context.player, inventory, morteEmAndamento: false,
      generatorMenuOpen: false };
    if (!this.scene.abrirPortasArenaAposCartao?.(autorizacao)) return false;
    return this.releaseAccess();
  }
  receive(action) {
    if (!isBossControl(action)) return false;
    if (this.destroyed || this.r.teamDefeated) return true;
    if (action.authority) {
      if (action.playerId && action.playerId !== this.manager.room.hostId) return true;
      if (action.kind === "bossAccess" && action.payload?.denied &&
          action.targetId === this.manager.playerId && !this.current() &&
          action.payload.roomCode === this.manager.room.roomCode &&
          action.payload.mapId === (this.manager.room.coopMap?.id ?? 0) && action.payload.session === this.r.streamId) {
        this.accessRequested = false;
        this.scene.leitorCartaoFabrica?.fala?.mostrar(this.rescueLines(action.payload.unavailable ?? []));
      }
      if (["bossPreparation", "bossIntro"].includes(action.kind)) this.apply(action.payload?.preparation);
    } else if (this.r.host && this.manager.room.players.some(p => p.id === action.playerId)) {
      if (action.kind === "bossAccess") {
        const p = action.payload, data = this.manager.room.players.find(p => p.id === action.playerId);
        const session = action.playerId === this.manager.playerId ? this.r.streamId : data?.coop?.sceneSession;
        if (p?.roomCode === this.manager.room.roomCode && p.mapId === (this.manager.room.coopMap?.id ?? 0) &&
            p.session === session) this.confirmCard(action.playerId);
      }
      if (action.kind === "bossPrepared") this.acceptStatus(action.playerId, action.payload);
    }
    return true;
  }
  apply(next) {
    const accepted = next === this.state ? this.state : mergeBossPreparation(this.manager.room, this.state, next);
    if (!accepted || !this.current(accepted)) return;
    const changed = accepted !== this.state;
    this.state = accepted;
    this.accessRequested = false;
    this.manager.room.coopBossPreparation = accepted;
    if (this.cleanedSession !== accepted.id) {
      const s = this.scene;
      s.robosFabricaDescarregados = true;
      s.spawnAreasRoboBola?.destruir();
      s.enemySpawnManager?.destroy();
      s.spawnAreasRoboBola = s.enemySpawnManager = null;
      const quantidade = (s.inimigos ?? []).filter(robo => robo && !robo.prologoEncontroId).length;
      limparGrupoRobos(s, (s.inimigos ?? []).some(robo => robo?.prologoEncontroId));
      this.r.clearFactoryRobotReplicas?.();
      this.r.audio?.clearFactoryRobotSounds?.();
      this.r.forceKeyframe = true;
      this.cleanedSession = accepted.id;
      this.debug(`Limpeza da fábrica concluída (${quantidade} robôs removidos)`);
    }
    if (!this.local) return;
    if (changed || this.local.estado === "ocioso") this.local.iniciar();
    if (accepted.entrada) {
      this.world.aplicarEntradaBoss(accepted.entrada);
      if (!this.canStart()) this.wait();
      else if (!this.local.aguardando) this.scene.coopBossWaiting = false;
    }
    if (accepted.phase === "intro" && !this.r.host && !this.world.introCamera) this.world.introCamera = accepted.camera;
    if (accepted.phase === "complete") this.world.introCamera = null;
  }
  wait() {
    if (!this.local || this.local.aguardando || this.scene.morteEmAndamento) return;
    this.scene.coopBossWaiting = true;
    this.local.aguardar(() => {
      this.scene.coopBossWaiting = false;
      this.restoreRemoteLocks();
      if (!this.r.host) this.world.update(0);
    }, { podeContinuar: () => this.canStart() || this.state?.phase === "loading" &&
        this.local.pronto && this.r.bossAssetsPrepared, cancelavel: false,
      aoTentarNovamente: () => this.retry(),
      cancelar: () => { this.scene.coopBossWaiting = false; this.restoreRemoteLocks(); } });
  }
  acceptStatus(playerId, report) {
    if (!this.r.host || !this.current() || report?.id !== this.state.id ||
        report.roomCode !== this.state.roomCode || report.mapId !== this.state.mapId ||
        !this.state.participants.includes(playerId) || !["loading", "ready", "failed"].includes(report.status)) return;
    const player = this.manager.room.players.find(p => p.id === playerId);
    const session = playerId === this.manager.playerId ? this.r.streamId : player?.coop?.sceneSession;
    if (!session || report.session !== session) return;
    if (!Number.isSafeInteger(report.sequence) || report.sequence < 1) return;
    const previous = this.state.clients[playerId];
    const ultimo = this.acceptedSequences.get(playerId);
    if (Math.max(previous?.session === session ? previous.sequence : 0,
      ultimo?.session === session ? ultimo.sequence : 0) >= report.sequence) return;
    this.acceptedSequences.set(playerId, { session, sequence: report.sequence });
    const next = { session, status: report.status,
      placed: report.placed === true && (report.placement ?? 0) === (this.state.entrada?.revision ?? 0),
      sequence: report.sequence,
      systems: report.systems === true && report.systemsEpoch === this.state.systemsEpoch,
      systemsEpoch: typeof report.systemsEpoch === "string" && report.systemsEpoch.length <= 160 ? report.systemsEpoch : null };
    if (previous?.session === next.session && previous.status === next.status && previous.placed === next.placed &&
        previous.systems === next.systems && previous.systemsEpoch === next.systemsEpoch) {
      // Protege contra relatórios antigos sem avançar a revisão para um mero reenvio.
      return;
    }
    this.state = { ...this.state, clients: { ...this.state.clients, [playerId]: next } };
    this.publish();
  }
  placed() {
    const ponto = this.state?.entrada?.jogadores[this.manager.playerId];
    return Boolean(ponto && Math.hypot(this.scene.player.x - ponto.x, this.scene.player.y - ponto.y) < 4 &&
      entradas(this.scene).every(p => p.estado === "fechada"));
  }
  report() {
    if (!this.current() || this.cleanedSession !== this.state.id || !this.local) return;
    let status = this.local.pronto ? "ready" : this.local.estado === "falhou" ? "failed" : "loading";
    if (status === "ready" && !this.r.prepareBossAssets()) {
      this.local.falhar(this.r.bossPreparationError?.message ?? "Animações do boss indisponíveis.");
      this.debug("Falha ao preparar assets", this.r.bossPreparationError);
      status = "failed";
    }
    if (!this.state.participants.includes(this.manager.playerId)) return;
    const report = { id: this.state.id, roomCode: this.state.roomCode, mapId: this.state.mapId,
      session: this.r.streamId, status, placed: this.placed(), systemsEpoch: this.state.systemsEpoch ?? null,
      placement: this.state.entrada?.revision ?? 0,
      systems: this.state.systemsPrepared === true && this.r.bossVisualsReady() };
    const json = JSON.stringify(report), stored = this.state.clients[this.manager.playerId];
    if (json !== this.lastReport || (stored?.session !== report.session || stored?.status !== status || stored?.placed !== report.placed ||
        stored?.systems !== report.systems || stored?.systemsEpoch !== report.systemsEpoch) &&
        (this.now() < this.lastReportAt || this.now() - this.lastReportAt > 1000)) {
      this.lastReport = json; this.lastReportAt = this.now();
      this.reportSequence = (this.reportSequence || 0) + 1;
      const packet = { ...report, sequence: this.reportSequence };
      if (this.r.host) this.acceptStatus(this.manager.playerId, packet);
      else this.manager.sendCoopAction("bossPrepared", packet);
    }
    if (status === "failed" && !this.local.aguardando) this.wait();
  }
  assemble() {
    const entrada = this.state.entrada;
    const reunindoNovoJogador = this.state.phase === "assembling" &&
      this.state.participants.some(id => !entrada?.jogadores[id]);
    if (this.state.phase !== "loading" && !reunindoNovoJogador || this.r.revival?.participants().some(p => p.dead)) return;
    const people = this.r.playerContexts().filter(c => c.player?.active && c.vida > 0 && !c.morteEmAndamento)
      .map(c => ({ id: c.coopRemotePlayerId ?? this.manager.playerId, player: c.player, context: c }));
    if (this.state.participants.some(id => !people.some(p => p.id === id))) return;
    const origem = people.find(p => this.r.inArena(p.player))?.player;
    if (!origem || entradas(this.scene).some(p => p.estado === "abrindo" || this.overlap(origem, p.area))) return;
    const encontro = this.scene.novoBoss;
    if (!encontro) return;
    const destinos = planejarEntradaBoss(this.scene, encontro, origem, people);
    if (!destinos) return;
    const clients = Object.fromEntries(Object.entries(this.state.clients).map(([id, client]) => [id, { ...client, placed: false }]));
    this.state = { ...this.state, clients, phase: "assembling", entrada: { id: this.state.id,
      revision: entrada ? (entrada.revision ?? 0) + 1 : 0, jogadores: destinos } };
    this.publish(); this.apply(this.state);
  }
  overlap(player, area) {
    const b = player.body;
    return b && [b.x, b.y, b.width, b.height, area.x, area.width].every(Number.isFinite) &&
      b.x < area.x + area.width && b.x + b.width > area.x && b.y < area.y + area.height && b.y + b.height > area.y;
  }
  lockRemotes() {
    if (!this.r.host || !this.scene.coopBossWaiting) return;
    const contexts = this.r.players.contexts();
    for (const c of this.remoteLocks.keys()) if (!contexts.includes(c)) this.remoteLocks.delete(c);
    for (const c of contexts) {
      if (!this.remoteLocks.has(c)) this.remoteLocks.set(c, c.movimentoBloqueado);
      c.movimentoBloqueado = true; c.player.setVelocity(0, 0);
    }
  }
  restoreRemoteLocks() {
    for (const [context, previous] of this.remoteLocks) context.movimentoBloqueado = previous;
    this.remoteLocks.clear();
  }
  ready(systems = false) {
    return this.state.participants.every(id => {
      const player = this.manager.room.players.find(p => p.id === id), c = this.state.clients[id];
      const session = id === this.manager.playerId ? this.r.streamId : player?.coop?.sceneSession;
      return player && vivo(player) && session && c?.session === session && c.status === "ready" && c.placed &&
        (!systems || c.systems && c.systemsEpoch === this.state.systemsEpoch);
    });
  }
  canStart() {
    const allowed = this.current() && ["intro", "complete"].includes(this.state.phase) &&
      (this.state.phase === "complete" || this.now() >= this.state.startAt) &&
      this.local?.pronto && this.r.bossAssetsPrepared === true &&
      (this.released || !this.state.systemsPrepared || this.r.bossVisualsReady()) &&
      (this.state.phase === "complete" || entradas(this.scene).every(p => p.estado === "fechada"));
    // 'intro' é o compromisso do host, publicado somente depois de ready(true).
    // O cliente verifica os próprios recursos, sem bloquear por uma cópia antiga das sessões alheias.
    if (!allowed || this.state.phase === "intro" && !this.state.participants.includes(this.manager.playerId)) return false;
    this.released = true;
    return true;
  }
  debug(message, detail) {
  }
  retry() {
    this.lastReport = null;
    this.lastProgressAt = this.now();
    this.report();
    if (this.r.host) this.r.forceKeyframe = true;
    else this.manager.sendCoopAction("keyframe", {});
  }
  updateWatchdog() {
    const state = this.state, local = this.local;
    if (!local || this.released) { local?.informarEspera?.(null); return; }
    const clients = state.participants.map(id => {
      const c = state.clients[id];
      return [id, c?.session, c?.status, c?.placed, c?.systems, c?.systemsEpoch];
    });
    const progress = JSON.stringify([state.phase, state.entrada?.revision, state.systemsEpoch,
      local.estado, local.progresso, entradas(this.scene).map(p => p.estado), clients]);
    const agora = this.now();
    if (state.phase !== this.lastPhase) {
      this.lastPhase = state.phase;
      this.phaseStartedAt = agora;
      this.debug(`Fase ${state.phase}`, { sessao: state.id, desde: agora });
    }
    if (progress !== this.lastProgress || agora < this.lastProgressAt) {
      this.lastProgress = progress; this.lastProgressAt = agora;
      this.watchdogLogged = false;
    }
    if (agora - this.lastProgressAt < ESPERA_SEM_PROGRESSO_MS) { local.informarEspera?.(null); return; }
    let pendencia;
    if (!local.pronto) pendencia = local.estado === "carregando"
      ? `Download local sem avanço (${Math.round((local.progresso ?? 0) * 100)}%).`
      : "Recursos locais do boss indisponíveis.";
    else if (!state.entrada) pendencia = this.r.revival?.participants().some(p => p.dead)
      ? "Aguardando o resgate de um jogador." : "Aguardando um posicionamento seguro para a equipe.";
    else if (entradas(this.scene).some(p => p.estado !== "fechada")) pendencia = "Aguardando o fechamento das portas.";
    else if (state.systemsPrepared && !this.r.bossVisualsReady()) pendencia = "Aguardando os visuais do boss.";
    else {
      const i = state.participants.findIndex(id => {
        const c = state.clients[id];
        const session = id === this.manager.playerId ? this.r.streamId : this.manager.room.players.find(p => p.id === id)?.coop?.sceneSession;
        return !session || c?.session !== session || c.status !== "ready" || !c.placed ||
          (state.systemsPrepared && (!c.systems || c.systemsEpoch !== state.systemsEpoch));
      });
      pendencia = i < 0 ? "Aguardando autorização do host." : `Aguardando a confirmação do jogador ${i + 1}.`;
    }
    if (!this.watchdogLogged) {
      this.watchdogLogged = true;
      this.debug(pendencia, { fase: state.phase, desde: this.phaseStartedAt, sessao: state.id });
    }
    if (state.entrada || local.aguardando || this.r.inArena(this.scene.player))
      local.informarEspera?.(pendencia, () => this.retry());
  }
  update() {
    if (this.destroyed || this.r.mapKey !== "Level1Parte2") return;
    this.apply(this.manager.room.coopBossPreparation);
    if (!this.current()) {
      if (this.accessRequested && Date.now() - this.accessRequestedAt >= 1000) {
        const reader = this.scene.leitorCartaoFabrica?.area, p = this.scene.player;
        if (reader && p?.active && !this.scene.morteEmAndamento && this.scene.luzFabricaAcesa &&
            this.scene.inventory?.getQuantity("card") > 0 && distanceToInteractionArea(p.x, p.y, reader) <= 64)
          this.confirmCard(); // O host pode ainda estar concluindo seu próprio preload da fábrica.
        else this.accessRequested = false;
      }
      // Entrada DEV/save é exceção explícita ao leitor, sem antecipar a exploração normal.
      if (this.r.host && (this.manager.room.coopMap?.boss ||
          this.r.playerContexts().some(c => c.player?.active && c.vida > 0 && !c.morteEmAndamento && this.r.inArena(c.player)) ||
          this.manager.room.coopProgress?.flags?.["factoryDoorOpen:porta02"])) this.begin();
      return;
    }
    this.report();
    this.local?.informarFalhaRemota(this.state.participants.some(id => id !== this.manager.playerId &&
      this.state.clients[id]?.status === "failed"));
    if (this.state.entrada && !this.canStart()) { this.scene.coopBossWaiting = true; this.wait(); this.lockRemotes(); }
    this.updateWatchdog();
    if (!this.r.host) return;
    const active = this.manager.room.players.map(p => p.id);
    const required = active;
    if (["loading", "assembling"].includes(this.state.phase) &&
        (required.length !== this.state.participants.length || required.some(id => !this.state.participants.includes(id)))) {
      this.state = { ...this.state, participants: required,
        clients: Object.fromEntries(Object.entries(this.state.clients).filter(([id]) => required.includes(id))) };
      this.publish();
    }
    this.assemble();
    if (this.state.phase === "assembling" && this.ready() && !this.r.bossVisualsReady() &&
        (!this.r.prepareBossEncounter() || !this.r.bossVisualsReady())) {
      const detalhe = this.r.bossPreparationError?.message ?? this.scene.novoBoss?.pendencia ?? "Visuais do boss incompletos.";
      this.local.falhar(detalhe);
      this.debug("Falha na preparação visual", this.r.bossPreparationError ?? detalhe);
      return;
    }
    if (this.state.phase === "assembling" && this.ready() &&
        (!this.state.systemsPrepared || this.state.systemsEpoch !== this.r.streamId)) {
      this.state = { ...this.state, systemsPrepared: true, systemsEpoch: this.r.streamId };
      this.r.forceKeyframe = true;
      this.publish();
    }
    if (this.state.phase === "assembling" && this.ready(true) &&
        entradas(this.scene).every(p => p.estado === "fechada") &&
        !this.r.revival?.participants().some(p => p.dead) && this.r.bossVisualsReady()) {
      const camera = this.scene.cameras.main;
      const retomada = this.recommitAt !== undefined;
      this.state = { ...this.state, phase: "intro", startAt: retomada ? Math.max(this.now(), this.recommitAt) : this.now() + 350,
        camera: { x: camera.midPoint?.x ?? this.scene.player.x, y: camera.midPoint?.y ?? this.scene.player.y, zoom: camera.zoom } };
      this.recommitAt = undefined;
      this.publish(!retomada);
      this.debug("Equipe pronta. Introdução autorizada");
    }
    const encontro = this.scene.novoBoss;
    if (this.state.phase === "intro" && this.released && encontro &&
        (!encontro.introducao || encontro.introducao.snapshot().concluida)) {
      this.state = { ...this.state, phase: "complete" }; this.publish();
    }
  }
  destroy() { this.destroyed = true; this.restoreRemoteLocks(); this.scene.coopBossWaiting = false; }

  retimeAfterMigration(previousNow) {
    if (!this.current() || this.state.phase !== "intro" || this.released) return;
    this.recommitAt = this.now() + Math.max(0, this.state.startAt - previousNow);
    this.state = { ...this.state, phase: "assembling", startAt: null, camera: null,
      systemsPrepared: false, systemsEpoch: null };
    this.r.forceKeyframe = true;
    this.publish(); // Mesma entrada. A confirmação visual passa a apontar para o novo stream.
  }
}
