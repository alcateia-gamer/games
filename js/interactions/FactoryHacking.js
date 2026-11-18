import { normalizarCheckpoint, LEGACY_NETWORK_KEY } from '../puzzles/HackingProgress.js';
import { HACKING_KEYS as K, TERMINAIS_HACKING as T } from '../puzzles/HackingConfig.js';
import { criarPainelInvasao } from '../ui/CoreInvasionPanel.js';
import { criarPainelBruteforce } from '../ui/BruteforcePanel.js';
import { INTELLIGENCE_KEY, gerarMissao, podeEntrarBoss } from '../puzzles/MissionIntelligence.js';
import { HackingSession } from '../puzzles/HackingSession.js';
import { criarPainelHacking } from '../ui/HackingPanel.js';
import { criarRegistroHacking } from '../ui/HackingRecordPanel.js';
import { criarSonsLeitorCartao } from '../sounds/leitorCartao.js';
import { criarFalaFlutuante } from '../ui/PlayerSpeechBubble.js';
import { drawCollectibleMarker } from '../ui/CollectibleMarker.js';
import { prepararPetNoTerminal } from './HackingPetDock.js';
import { atualizarAnimacaoParado } from '../controls/PlayerAnimations.js';

const tutoriaisPorJogo = new WeakMap();

/** Usa o botão de interação existente; simulação solo/host e apresentação local separadas. */
export function criarHackingFabrica(scene) {
  if (scene.hackingTerminals && !scene.hackingTerminals.destruido) return scene.hackingTerminals;
  const registry = scene.game.registry;
  const tutoriaisMostrados = tutoriaisPorJogo.get(scene.game) ?? new Map();
  tutoriaisPorJogo.set(scene.game, tutoriaisMostrados);
  const som = criarSonsLeitorCartao(scene), fala = criarFalaFlutuante(scene, 'hacking-speech', { falante: 'nova' });
  let destruido = false, view = null, hostDock = null, clientDock = null, painel = null;
  let localId = null, anteriorTeclado = true, anteriorInput = true, sequence = 0, jamAte = 0;
  let terminalPetPronto = false, victory = null, ultimaReplica = null, pausaSolo = false;
  let revisao = 0, revisaoRecebida = -1, replicaHost = null;
  let registro = null, falaPendente = null;
  const dizer = frase => { if (scene.generatorMenuOpen) falaPendente = frase; else fala.mostrar(frase); };
  const runtime = () => scene.coopRuntime;
  const autoridade = () => !scene.multiplayer || !!runtime()?.host;
  const meuId = () => runtime()?.manager.playerId ?? 'solo';
  let eraAutoridade = autoridade();
  const contexto = id => id === meuId() ? runtime()?.localContext ?? scene : runtime()?.players.remotes.get(id)?.context;
  function missao() {
    const shared = runtime()?.manager.room?.coopProgress?.intelligence;
    let m = shared ?? registry.get(INTELLIGENCE_KEY);
    if (!m && autoridade()) m = { config: gerarMissao((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0), checkpoint: {} };
    if (m) {
      const checkpoint = normalizarCheckpoint(m.checkpoint);
      const flags = runtime()?.manager.room?.coopProgress?.flags;
      if (registry.get(K.memory) === true || flags?.[K.memory] === true || registry.get(LEGACY_NETWORK_KEY) === true || flags?.[LEGACY_NETWORK_KEY] === true) checkpoint.memoryModules = 3;
      if (checkpoint.memoryModules === 3 && (registry.get(K.host) === true || flags?.[K.host] === true)) checkpoint.hostConnected = true;
      if (JSON.stringify(checkpoint) !== JSON.stringify(m.checkpoint)) m = { ...m, checkpoint };
      if (checkpoint.memoryModules === 3) registry.set(K.memory, true);
      if (registry.get(LEGACY_NETWORK_KEY) !== undefined) registry.remove(LEGACY_NETWORK_KEY);
      registry.set(INTELLIGENCE_KEY, m);
      const progress = runtime()?.manager.room?.coopProgress;
      if (progress && autoridade()) progress.intelligence = m;
    }
    return m;
  }
  function salvarCheckpoint(checkpoint) {
    const m = missao(); if (!m) return;
    const next = { ...m, checkpoint }; registry.set(INTELLIGENCE_KEY, next);
    if (runtime()?.manager.room?.coopProgress) runtime().manager.room.coopProgress.intelligence = next;
    if (checkpoint.memoryModules === 3) registry.set(K.memory, true);
    if (checkpoint.hostConnected) registry.set(K.host, true);
    publicar();
  }
  const progresso = () => {
    const flags = runtime()?.manager.room?.coopProgress?.flags;
    const replica = !autoridade() && ultimaReplica?.hostId === runtime()?.manager.room?.hostId
      ? ultimaReplica.progress : null;
    return Object.fromEntries(Object.entries(K).map(([k, key]) => [k,
      registry.get(key) === true || flags?.[key] === true || replica?.[k] === true]));
  };
  const engine = new HackingSession((tipo, resultado) => {
    if (tipo === 'fabrica') {
      registry.set(K.fabrica, true);
      for (const bonus of ['robos', 'registro']) if (resultado.concluidos.includes(bonus)) registry.set(K[bonus], true);
      if (resultado.concluidos.includes('robos')) jamAte = scene.time.now + 12000;
      const arquivo = resultado.concluidos.includes('registro')
        ? 'Arquivo EV041_EDEN_NETWORK_ARCHIVE.LOG recuperado. Consulte NULLNET.'
        : 'O arquivo segue criptografado. Complete REGISTRO DA AXIOM no terminal.';
      dizer(`N.O.V.A.: Portas liberadas. ${arquivo}${resultado.concluidos.includes('robos') ? ' Robôs isolados por 12 segundos.' : ''}`);
      som.tocar('acesso', 500); scene.events.emit('hacking:fabrica-concluida', { resultado });
    } else if (tipo === 'bruteforce') {
      registry.set(K.bruteforce, true); som.tocar('acesso', 500);
      dizer('N.O.V.A.: EV041_ESCAPE_PROTOCOL.DAT recuperado. Autorização digital aprovada. Autentique também o cartão no leitor do SENTINEL.');
      scene.events.emit('hacking:bruteforce-concluido');
    } else {
      registry.set(K.final, true); scene.events.emit('hacking:matrix-concluida', { suporteVidaPreservado: true });
    }
    publicar();
  }, () => missao(), salvarCheckpoint, () => {
    const p = progresso();
    return [['portas', p.fabrica], ['robos', p.robos], ['registro', p.registro]]
      .filter(([, concluido]) => concluido).map(([id]) => id);
  }, tutoriaisMostrados);
  const marcadores = Object.fromEntries(Object.entries(T).map(([tipo, t]) => {
    const marker = scene.add.graphics().setPosition(t.x, t.y - 48).setDepth(90);
    drawCollectibleMarker(marker, 0, 0, 18); marker.coopLocalVisual = true;
    const label = scene.add.text(t.x, t.y - 72, t.nome, { fontFamily: 'monospace', fontSize: '12px', color: '#a9eee0',
      backgroundColor: '#031420dd', padding: { x: 5, y: 4 } }).setOrigin(.5, 1).setDepth(90);
    label.coopLocalVisual = true;
    return [tipo, { marker, label }];
  }));
  // A estação usa o equipamento já desenhado no mapa; somente a interação é adicionada.
  function snapshot() {
    return { revisao, hostId: runtime()?.manager.room?.hostId ?? meuId(), intelligence: missao(), progress: progresso(), session: engine.snapshot(), dock: hostDock?.snapshot() ?? null,
      pronto: !!hostDock?.pronto };
  }
  function publicar() {
    if (!autoridade() || destruido) return;
    revisao++;
    const state = snapshot(); projetar(state);
    if (runtime()) runtime().manager.sendCoopAction('hackingState', { mapKey: 'Level1Parte2', state }, { authority: true });
  }
  function limparDockHost() {
    hostDock?.destruir(); hostDock = null;
    if (pausaSolo && !victory) scene.physics.resume();
    pausaSolo = false;
  }
  function fecharRegistro() {
    if (!registro) return;
    const atual = registro; registro = null;
    atual.painel.destruir();
    scene.movimentoBloqueado = atual.movimento; scene.generatorMenuOpen = atual.menu;
    scene.input.enabled = atual.input;
    if (scene.input.keyboard) { scene.input.keyboard.resetKeys?.(); scene.input.keyboard.enabled = atual.teclado; }
    if (scene.player?.active && scene.player.body) scene.player.body.moves = atual.moves;
    if (atual.pausou && !victory && scene.physics.world) scene.physics.resume();
    scene.joystick?.reset?.();
  }
  function abrirRegistro(livre = false) {
    const t = T.fabrica, p = progresso();
    if (destruido || registro || p.final || (api.temSessao() && view?.owner === meuId()) ||
        !scene.player?.active || scene.vida <= 0 || scene.morteEmAndamento || scene.cenaEntradaBossAtiva ||
        scene.generatorMenuOpen || scene.devItemMenuOpen || scene.upgradeMenuOpen || scene.upgradeDialogueOpen || scene.atacando ||
        scene.ariaAtaqueCarregando || scene.estadoDash?.ativo ||
        (!livre && Math.hypot(scene.player.x - t.x, scene.player.y - t.y) > t.alcance)) return false;
    registro = { movimento: scene.movimentoBloqueado, menu: scene.generatorMenuOpen, input: scene.input.enabled,
      teclado: scene.input.keyboard?.enabled, moves: scene.player.body.moves,
      pausou: !scene.multiplayer && !scene.physics.world.isPaused };
    scene.movimentoBloqueado = true; scene.generatorMenuOpen = true; scene.input.enabled = false;
    if (scene.input.keyboard) { scene.input.keyboard.resetKeys?.(); scene.input.keyboard.enabled = false; }
    scene.player.setVelocity(0, 0); scene.player.body.moves = false; scene.somCorrida?.stop();
    scene.joystick?.reset?.(); scene.ariaAttackJoystick?.cancelar?.(); atualizarAnimacaoParado(scene);
    if (registro.pausou) scene.physics.pause();
    registro.painel = criarRegistroHacking(fecharRegistro, missao().config, progresso);
    if (p.registro) scene.events.emit("hacking:registro-aberto");
    return true;
  }
  function fecharLocal() {
    fecharRegistro();
    painel?.destruir(); painel = null;
    clientDock?.destruir(); clientDock = null;
    if (localId != null && scene.input?.keyboard) { scene.input.keyboard.resetKeys?.(); scene.input.keyboard.enabled = anteriorTeclado; }
    if (localId != null && scene.input) scene.input.enabled = anteriorInput;
    localId = null;
  }
  function vitoria() {
    if (victory || destruido) return;
    fecharLocal(); limparDockHost();
    scene.movimentoBloqueado = true; scene.generatorMenuOpen = true;
    scene.player?.setVelocity(0, 0); scene.physics.pause();
    victory = document.createElement('section'); victory.className = 'hacking-victory';
    victory.style.cssText = 'position:fixed;inset:0;z-index:10070;background:#030d19f5;color:#caf8e4;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px;box-sizing:border-box;text-align:center;font:16px monospace';
    victory.innerHTML = `<div style="max-width:640px;margin:auto"><p style="color:#b498ee">THE HOLLOW / TRANSMISSÃO RESTABELECIDA</p><h1>MISSÃO CONCLUÍDA</h1><p>O Vírus Zero alcançou o núcleo.</p><p>O controle da AXIOM sobre o EDEN começou a se romper. O despertar será gradual.</p><p style="color:#7dffc4">SUPORTE À VIDA PRESERVADO</p><p>AXIOM: “A verdade não garante felicidade.”</p><p>N.O.V.A.: “Durante vinte e seis anos, a humanidade viveu um sonho. Agora poderá escolher quando abrir os olhos.”</p><button style="font:inherit;min-height:48px;padding:12px 24px;border:1px solid #70d6b4;background:#123e35;color:#e5fff5;cursor:pointer">Jogar novamente</button></div>`;
    victory.querySelector('button').onclick = () => window.location.reload(); document.body.append(victory);
  }
  function projetar(state) {
    if (destruido || !state) return;
    // Um frame anterior ao cancelamento não deve reabrir a interface pelo atraso da rede.
    if (!autoridade()) {
      const host = runtime()?.manager.room?.hostId;
      if (state.hostId && state.hostId !== host) return;
      if (replicaHost !== host) { replicaHost = host; revisaoRecebida = -1; }
      if (!Number.isSafeInteger(state.revisao) || state.revisao < revisaoRecebida) return;
      revisaoRecebida = state.revisao;
    }
    if (state.intelligence) {
      registry.set(INTELLIGENCE_KEY, state.intelligence);
      if (runtime()?.manager.room?.coopProgress) runtime().manager.room.coopProgress.intelligence = state.intelligence;
    }
    if (!autoridade()) for (const [key, value] of Object.entries(state.progress ?? {})) if (K[key] && value === true) registry.set(K[key], true);
    ultimaReplica = state;
    const session = state.session;
    if (session && session.id !== view?.id) scene.events.emit("hacking:terminal-aberto", session.tipo);
    view = session;
    if (state.progress?.final) { vitoria(); return; }
    if (!session || session.owner !== meuId()) { if (localId != null) fecharLocal(); return; }
    if (localId !== session.id) {
      fecharLocal(); localId = session.id; sequence = session.seq ?? 0;
      anteriorTeclado = scene.input.keyboard?.enabled ?? true;
      anteriorInput = scene.input.enabled; scene.input.enabled = false;
      if (scene.input.keyboard) { scene.input.keyboard.resetKeys?.(); scene.input.keyboard.enabled = false; }
      if (!autoridade()) clientDock = prepararPetNoTerminal(scene, scene, T[session.tipo], { destino: state.dock?.player, criarPet: false });
    }
    sequence = Math.max(sequence, session.seq ?? 0);
    if (!state.pronto) return;
    if (session.tipo === 'fabrica') {
      painel ??= criarPainelHacking(command => api.enviar(command), som);
      painel.atualizar(session.model);
    } else if (session.tipo === 'bruteforce') {
      painel ??= criarPainelBruteforce(command => api.enviar(command));
      painel.atualizar(session.model);
    } else {
      painel ??= criarPainelInvasao(command => api.enviar(command), missao().config, progresso);
      painel.atualizar(session.model);
    }
  }

  function solicitar(owner, payload) {
    if (destruido || !autoridade()) return false;
    const ctx = contexto(owner);
    if (!ctx?.player?.active || ctx.vida <= 0 || ctx.morteEmAndamento) return false;
    if (payload.op === 'abrir') {
      const t = T[payload.tipo], p = progresso();
      if (!t || engine.atual || p.final || (payload.tipo === 'fabrica' && (p.registro || !scene.luzFabricaAcesa)) ||
          (payload.tipo === 'bruteforce' && (p.bruteforce || !p.fabrica || !scene.luzFabricaAcesa)) ||
          (payload.tipo === 'matrix' && (!p.fabrica || !p.bruteforce || !p.cartao || !scene.novoBoss?.morto)) || scene.cenaEntradaBossAtiva ||
          ctx.generatorMenuOpen || ctx.devItemMenuOpen || ctx.upgradeMenuOpen || ctx.upgradeDialogueOpen || ctx.atacando || ctx.ariaAtaqueCarregando ||
          ctx.estadoDash?.ativo || Math.hypot(ctx.player.x - t.x, ctx.player.y - t.y) > t.alcance + 32) return false;
      if (!engine.abrir(payload.tipo, owner)) return false;
      hostDock = prepararPetNoTerminal(scene, ctx, t);
      if (!scene.multiplayer) { pausaSolo = !scene.physics.world.isPaused; scene.physics.pause(); }
      terminalPetPronto = false; publicar(); return true;
    }
    const accepted = engine.comando(owner, payload);
    if (accepted) {
      if (!engine.atual) limparDockHost();
      // Movimento contínuo já segue nos snapshots do mundo; reservar QoS1 para decisões.
      if (payload.op !== 'mover') publicar();
    }
    return accepted;
  }
  const databaseButton = document.createElement('button');
  databaseButton.textContent = 'NULLNET · ARQUIVOS'; databaseButton.className = 'nullnet-database-button';
  databaseButton.style.cssText = 'position:fixed;left:0;top:0;transform:translate(-50%,-50%);z-index:10010;width:min(180px,calc(100vw - 24px));min-height:44px;padding:8px;background:#09271f;color:#9bffcb;border:1px solid #3c8966;font:12px monospace;cursor:pointer';
  databaseButton.onclick = () => abrirRegistro(true); databaseButton.hidden = true; document.body.append(databaseButton);
  const posicionarDatabaseButton = () => {
    const camera = scene.cameras.main, canvas = scene.game.canvas;
    if (!camera || !canvas?.isConnected) return;
    scene.minimap?.layout(camera);
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const scaleX = bounds.width / camera.width, scaleY = bounds.height / camera.height;
    const devY = scene.minimap?.devScreenY ?? 24;
    const devHeight = (scene.botaoDesenvolvedor?.height ?? 30) * scaleY / 2;
    const devWidth = (scene.botaoDesenvolvedor?.width ?? 80) * scaleX;
    const devCenterX = bounds.left + (camera.x + camera.width - 40) * scaleX;
    const buttonHeight = databaseButton.getBoundingClientRect().height || 44;
    const buttonWidth = databaseButton.getBoundingClientRect().width || 180;
    databaseButton.style.left = `${devCenterX + devWidth / 2 - buttonWidth / 2}px`;
    databaseButton.style.top = `${bounds.top + (camera.y + devY) * scaleY + devHeight + 10 + buttonHeight / 2}px`;
  };
  scene.events.on(Phaser.Scenes.Events.PRE_RENDER, posicionarDatabaseButton);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
    scene.events.off(Phaser.Scenes.Events.PRE_RENDER, posicionarDatabaseButton));
  const api = {
    get destruido() { return destruido; },
    databaseButton,
    permitePortas() { return progresso().fabrica; },
    permiteBoss() { return podeEntrarBoss(registry); },
    abrirRegistro: () => abrirRegistro(true),
    temSessao() { return !!(autoridade() ? engine.atual : view); },
    estadoLocal() { return view; },
    snapshot,
    enviar(command) {
      const payload = command.op === 'abrir' ? command : { ...command, id: view?.id, seq: ++sequence };
      if (autoridade()) return solicitar(meuId(), payload);
      return runtime()?.manager.sendCoopAction('hacking', payload) ?? false;
    },
    receberAcao(action) {
      if (action.kind === 'hacking' && !action.authority && autoridade()) {
        const ok = solicitar(action.playerId, action.payload ?? {});
        if (!ok && action.payload?.op === 'abrir') publicar();
        return true;
      }
      if (action.kind === 'hackingState' && action.authority && action.playerId === runtime()?.manager.room?.hostId && !autoridade() && action.payload?.mapKey === 'Level1Parte2') {
        projetar(action.payload.state); return true;
      }
      return false;
    },
    receberSnapshot(state) { if (!autoridade() && state) projetar(state); },
    cancelarPorMorte() {
      fecharRegistro();
      if (autoridade() && engine.atual?.owner === meuId()) {
        engine.cancelar(meuId()); limparDockHost(); publicar();
      } else if (localId) { api.enviar({ op: 'cancelar' }); fecharLocal(); }
    },
    atualizar(_time, delta) {
      if (destruido) return false;
      if (registro && (scene.vida <= 0 || scene.morteEmAndamento ||
          (scene.multiplayer && (!runtime()?.manager.room || runtime()?.manager.mqtt?.connected === false)))) fecharRegistro();
      if (eraAutoridade !== autoridade()) {
        eraAutoridade = autoridade();
        revisaoRecebida = -1;
        engine.atual = null; limparDockHost(); fecharLocal(); view = null;
        if (eraAutoridade) publicar();
      }
      if (autoridade()) {
        const owner = engine.atual?.owner, ctx = owner && contexto(owner);
        if (owner && ((scene.multiplayer && !runtime()?.manager.room?.players?.some(p => p.id === owner)) || !ctx?.player?.active || ctx.vida <= 0 || ctx.morteEmAndamento)) {
          engine.cancelar(owner); limparDockHost(); publicar();
        }
        hostDock?.atualizar(delta);
        if (hostDock?.pronto) {
          if (!terminalPetPronto) { terminalPetPronto = true; publicar(); }
          const tutorialAnterior = engine.atual?.tutorialTipo;
          engine.atualizar(delta);
          if (engine.atual && engine.atual.tutorialTipo !== tutorialAnterior) publicar();
        }
        if (!engine.atual && hostDock) { limparDockHost(); publicar(); }
        if (jamAte > scene.time.now) for (const robo of scene.inimigos ?? []) if (robo.active && !robo.morto) {
          robo.especialAtordoadoAte = Math.max(robo.especialAtordoadoAte ?? 0, jamAte);
          robo.especialEmpurraoAte = scene.time.now; robo.setVelocity(0, 0);
        }
        projetar(snapshot());
      } else {
        clientDock?.atualizar(delta);
        if ((!runtime()?.manager.room || runtime()?.manager.mqtt?.connected === false) && localId) {
          fecharLocal(); view = null;
        }
      }
      const p = autoridade() ? progresso() : ultimaReplica?.progress ?? progresso();
      if (p.final) vitoria();
      databaseButton.hidden = p.final || !!registro || !!localId || scene.generatorMenuOpen || scene.upgradeMenuOpen || scene.upgradeDialogueOpen || scene.morteEmAndamento || scene.vida <= 0 || scene.cenaEntradaBossAtiva;
      let proxima = null;
      for (const [tipo, t] of Object.entries(T)) {
        const m = marcadores[tipo], concluido = tipo === 'fabrica' ? p.fabrica : p.final;
        const podeLer = (tipo === 'fabrica' && p.fabrica && p.registro) || (tipo === 'bruteforce' && p.bruteforce);
        const disponivel = !p.final && (tipo === 'matrix' ? !concluido && !!scene.novoBoss?.morto : !scene.fabricaDescarregada);
        m.marker.setVisible(disponivel); m.label.setVisible(disponivel);
        m.label.setText(view?.tipo === tipo ? `N.O.V.A. INVADINDO · ${tipo === 'matrix' ? view.model.etapaTipo === 'memory' ? `ARQUIVOS ${view.model.recuperados}/3` : `RASTRO ${Math.floor(view.model.rastro ?? 0)}%` : tipo === 'fabrica' ? `${view.model.selecoes.length}/10` : `${view.model.confirmadas.filter(Boolean).length}/8`}`
          : podeLer ? 'ELIAS VOSS · NULLNET · LER' : tipo === 'fabrica' && p.fabrica ? 'REGISTRO DA AXIOM · RECUPERAR' : t.nome);
        const distance = Math.hypot(scene.player.x - t.x, scene.player.y - t.y);
        if (disponivel && !registro && !api.temSessao() && !scene.generatorMenuOpen && !scene.morteEmAndamento && distance <= t.alcance &&
            (!proxima || distance < proxima.distance)) proxima = { distance, interact: () => {
              if (podeLer) return abrirRegistro(true);
              if (!scene.luzFabricaAcesa && tipo !== 'matrix') { dizer('N.O.V.A.: ligue o gerador para energizar o terminal.'); return true; }
              return api.enviar({ op: 'abrir', tipo });
            } };
      }
      scene.interacaoHackingProxima = proxima;
      if (falaPendente && !scene.generatorMenuOpen) { const frase = falaPendente; falaPendente = null; fala.mostrar(frase); }
      fala.atualizar();
      return !!victory || (!scene.multiplayer && (!!engine.atual || !!registro));
    },
    destruir() {
      if (destruido) return; destruido = true;
      scene.events.off(Phaser.Scenes.Events.PRE_RENDER, posicionarDatabaseButton);
      databaseButton.remove();
      fecharLocal(); limparDockHost(); engine.atual = null;
      victory?.remove(); victory = null; som.destruir(); fala.destroy();
      for (const m of Object.values(marcadores)) { m.marker.destroy(); m.label.destroy(); }
      scene.interacaoHackingProxima = null; scene.events.off('shutdown', api.destruir);
      if (scene.hackingTerminals === api) scene.hackingTerminals = null;
    },
  };
  scene.hackingTerminals = api; scene.events.once('shutdown', api.destruir);
  return api;
}
