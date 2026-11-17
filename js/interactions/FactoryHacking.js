import { HACKING_KEYS as K, TERMINAIS_HACKING as T } from '../puzzles/HackingConfig.js';
import { HackingSession } from '../puzzles/HackingSession.js';
import { criarPainelHacking } from '../ui/HackingPanel.js';
import { criarRegistroHacking } from '../ui/HackingRecordPanel.js';
import { criarSonsLeitorCartao } from '../sounds/leitorCartao.js';
import { criarFalaFlutuante } from '../ui/PlayerSpeechBubble.js';
import { drawCollectibleMarker } from '../ui/CollectibleMarker.js';
import { prepararPetNoTerminal } from './HackingPetDock.js';
import { ocultarHUDDuranteCena } from '../ui/HudCinematic.js';
import { atualizarAnimacaoParado } from '../controls/PlayerAnimations.js';

/** Usa o botão de interação existente; simulação solo/host e apresentação local separadas. */
export function criarHackingFabrica(scene) {
  if (scene.hackingTerminals && !scene.hackingTerminals.destruido) return scene.hackingTerminals;
  const registry = scene.game.registry;
  const som = criarSonsLeitorCartao(scene), fala = criarFalaFlutuante(scene, 'hacking-speech');
  let destruido = false, view = null, hostDock = null, clientDock = null, painel = null;
  let localId = null, openingMatrix = null, anteriorTeclado = true, anteriorInput = true, sequence = 0, jamAte = 0;
  let matrixHUD = null, matrixDOM = null, matrixVisibilidade = null;
  let terminalPetPronto = false, victory = null, ultimaReplica = null, pausaSolo = false;
  let revisao = 0, revisaoRecebida = -1;
  let registro = null;
  const runtime = () => scene.coopRuntime;
  const autoridade = () => !scene.multiplayer || !!runtime()?.host;
  const meuId = () => runtime()?.manager.playerId ?? 'solo';
  let eraAutoridade = autoridade();
  const contexto = id => id === meuId() ? runtime()?.localContext ?? scene : runtime()?.players.remotes.get(id)?.context;
  const progresso = () => Object.fromEntries(Object.entries(K).map(([k, key]) => [k, registry.get(key) === true]));
  const engine = new HackingSession((tipo, resultado) => {
    if (tipo === 'fabrica') {
      registry.set(K.fabrica, true);
      for (const bonus of ['robos', 'registro']) if (resultado.concluidos.includes(bonus)) registry.set(K[bonus], true);
      if (resultado.concluidos.includes('robos')) jamAte = scene.time.now + 12000;
      fala.mostrar(`N.O.V.A.: portas liberadas.${resultado.concluidos.includes('robos') ? ' Robôs isolados por 12 segundos.' : ''}${resultado.concluidos.includes('registro') ? ' Registro recuperado: token de manutenção em 04 segundos.' : ''}`);
      som.tocar('acesso', 500); scene.events.emit('hacking:fabrica-concluida', { resultado });
    } else {
      registry.set(K.final, true); scene.events.emit('hacking:matrix-concluida', { suporteVidaPreservado: true });
    }
    publicar();
  });
  const marcadores = Object.fromEntries(Object.entries(T).map(([tipo, t]) => {
    const marker = scene.add.graphics().setPosition(t.x, t.y - 48).setDepth(90);
    drawCollectibleMarker(marker, 0, 0, 18); marker.coopLocalVisual = true;
    const label = scene.add.text(t.x, t.y - 72, t.nome, { fontFamily: 'monospace', fontSize: '12px', color: '#a9eee0',
      backgroundColor: '#031420dd', padding: { x: 5, y: 4 } }).setOrigin(.5, 1).setDepth(90);
    label.coopLocalVisual = true;
    return [tipo, { marker, label }];
  }));
  function snapshot() {
    return { revisao, progress: progresso(), session: engine.snapshot(), dock: hostDock?.snapshot() ?? null,
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
  function abrirRegistro() {
    const t = T.fabrica, p = progresso();
    if (destruido || registro || !p.fabrica || p.final || api.temSessao() || scene.fabricaDescarregada ||
        !scene.player?.active || scene.vida <= 0 || scene.morteEmAndamento || scene.cenaEntradaBossAtiva ||
        scene.generatorMenuOpen || scene.devItemMenuOpen || scene.upgradeMenuOpen || scene.atacando ||
        scene.ariaAtaqueCarregando || scene.estadoDash?.ativo ||
        Math.hypot(scene.player.x - t.x, scene.player.y - t.y) > t.alcance) return false;
    registro = { movimento: scene.movimentoBloqueado, menu: scene.generatorMenuOpen, input: scene.input.enabled,
      teclado: scene.input.keyboard?.enabled, moves: scene.player.body.moves,
      pausou: !scene.multiplayer && !scene.physics.world.isPaused };
    scene.movimentoBloqueado = true; scene.generatorMenuOpen = true; scene.input.enabled = false;
    if (scene.input.keyboard) { scene.input.keyboard.resetKeys?.(); scene.input.keyboard.enabled = false; }
    scene.player.setVelocity(0, 0); scene.player.body.moves = false; scene.somCorrida?.stop();
    scene.joystick?.reset?.(); scene.ariaAttackJoystick?.cancelar?.(); atualizarAnimacaoParado(scene);
    if (registro.pausou) scene.physics.pause();
    registro.painel = criarRegistroHacking(fecharRegistro);
    return true;
  }
  function fecharLocal() {
    fecharRegistro();
    painel?.destruir(); painel = null; openingMatrix = null;
    if (scene.game.scene.keys.MatrixHacking) scene.scene.stop('MatrixHacking');
    if (matrixVisibilidade !== null) scene.scene.setVisible(matrixVisibilidade);
    matrixVisibilidade = null;
    matrixHUD?.restaurar(); matrixHUD = null;
    if (matrixDOM !== null && scene.game.domContainer) scene.game.domContainer.style.display = matrixDOM;
    matrixDOM = null;
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
    victory.style.cssText = 'position:fixed;inset:0;z-index:10070;background:#030d19f5;color:#caf8e4;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;text-align:center;font:16px monospace';
    victory.innerHTML = `<div style="max-width:640px"><p style="color:#b498ee">THE HOLLOW / TRANSMISSÃO RESTABELECIDA</p><h1>MISSÃO CONCLUÍDA</h1><p>O Vírus Zero alcançou o núcleo.</p><p>O controle da AXIOM sobre o EDEN começou a se romper. O despertar será gradual.</p><p style="color:#7dffc4">SUPORTE À VIDA PRESERVADO</p><p>AXIOM: “Continuarei mantendo essas pessoas vivas.”</p><button style="font:inherit;min-height:48px;padding:12px 24px;border:1px solid #70d6b4;background:#123e35;color:#e5fff5;cursor:pointer">Jogar novamente</button></div>`;
    victory.querySelector('button').onclick = () => window.location.reload(); document.body.append(victory);
  }
  function projetar(state) {
    if (destruido || !state) return;
    // Um frame anterior ao cancelamento não deve reabrir a interface pelo atraso da rede.
    if (!autoridade()) {
      if (!Number.isSafeInteger(state.revisao) || state.revisao < revisaoRecebida) return;
      revisaoRecebida = state.revisao;
    }
    ultimaReplica = state;
    const session = state.session;
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
    } else if (openingMatrix !== session.id) {
      openingMatrix = session.id;
      void import('../scenes/MatrixHacking.js').then(({ default: Matrix }) => {
        if (destruido || view?.id !== session.id || openingMatrix !== session.id) return;
        if (!scene.game.scene.keys.MatrixHacking) scene.game.scene.add('MatrixHacking', Matrix);
        matrixHUD = ocultarHUDDuranteCena(scene, scene.cameras.main);
        if (scene.game.domContainer) { matrixDOM = scene.game.domContainer.style.display; scene.game.domContainer.style.display = 'none'; }
        // A cena digital cobre a tela: conservar a simulação, sem redesenhar a fábrica atrás.
        matrixVisibilidade = scene.sys.settings.visible;
        scene.scene.setVisible(false);
        scene.scene.launch('MatrixHacking', { controller: api }); scene.scene.bringToTop('MatrixHacking');
      }).catch(error => { console.error('MATRIX:', error); api.enviar({ op: 'cancelar' }); fala.mostrar('Canal indisponível. Aproxime-se para tentar novamente.'); });
    }
  }
  function solicitar(owner, payload) {
    if (destruido || !autoridade()) return false;
    const ctx = contexto(owner);
    if (!ctx?.player?.active || ctx.vida <= 0 || ctx.morteEmAndamento) return false;
    if (payload.op === 'abrir') {
      const t = T[payload.tipo], p = progresso();
      if (!t || engine.atual || p.final || (payload.tipo === 'fabrica' && (p.fabrica || !scene.luzFabricaAcesa)) ||
          (payload.tipo === 'matrix' && (!p.fabrica || !scene.novoBoss?.morto)) || scene.cenaEntradaBossAtiva ||
          ctx.generatorMenuOpen || ctx.devItemMenuOpen || ctx.upgradeMenuOpen || ctx.atacando || ctx.ariaAtaqueCarregando ||
          ctx.estadoDash?.ativo || Math.hypot(ctx.player.x - t.x, ctx.player.y - t.y) > t.alcance + 32) return false;
      if (!engine.abrir(payload.tipo, owner, p.registro)) return false;
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
  const api = {
    get destruido() { return destruido; },
    permitePortas() { return progresso().fabrica; },
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
      if (action.kind === 'hackingState' && action.authority && !autoridade() && action.payload?.mapKey === 'Level1Parte2') {
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
        if (owner && (!ctx?.player?.active || ctx.vida <= 0 || ctx.morteEmAndamento)) {
          engine.cancelar(owner); limparDockHost(); publicar();
        }
        hostDock?.atualizar(delta);
        if (hostDock?.pronto) {
          if (!terminalPetPronto) { terminalPetPronto = true; publicar(); }
          engine.atualizar(delta);
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
      let proxima = null;
      for (const [tipo, t] of Object.entries(T)) {
        const m = marcadores[tipo], concluido = tipo === 'fabrica' ? p.fabrica : p.final;
        const disponivel = !p.final && (tipo === 'fabrica' ? !scene.fabricaDescarregada : !concluido && !!scene.novoBoss?.morto);
        m.marker.setVisible(disponivel); m.label.setVisible(disponivel);
        m.label.setText(view?.tipo === tipo ? `N.O.V.A. INVADINDO · ${tipo === 'matrix' ? `RASTRO ${Math.floor(view.model.rastro)}%` : `${view.model.selecoes.length}/10`}`
          : tipo === 'fabrica' && p.fabrica ? 'REGISTRO DA AXIOM · LER' : t.nome);
        const distance = Math.hypot(scene.player.x - t.x, scene.player.y - t.y);
        if (disponivel && !registro && !api.temSessao() && !scene.generatorMenuOpen && !scene.morteEmAndamento && distance <= t.alcance &&
            (!proxima || distance < proxima.distance)) proxima = { distance, interact: () => {
              if (tipo === 'fabrica' && p.fabrica) return abrirRegistro();
              if (!scene.luzFabricaAcesa && tipo === 'fabrica') { fala.mostrar('N.O.V.A.: ligue o gerador para energizar o terminal.'); return true; }
              return api.enviar({ op: 'abrir', tipo });
            } };
      }
      scene.interacaoHackingProxima = proxima; fala.atualizar();
      return !!victory || (!scene.multiplayer && (!!engine.atual || !!registro));
    },
    destruir() {
      if (destruido) return; destruido = true;
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
