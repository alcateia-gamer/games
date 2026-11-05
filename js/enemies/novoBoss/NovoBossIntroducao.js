/** Apresenta o boss, devolve a câmera e fecha as duas persianas antes de iniciar a luta. */
const PORTAS_ENTRADA = new Set(["porta02", "porta03"]);
const duracao = (valor, padrao) => Number.isFinite(valor) && valor >= 0 ? valor : padrao;
const suavizar = p => p * p * (3 - 2 * p);

function jogadorNaPorta(player, porta) {
  const a = player.body?.width > 0 && player.body?.height > 0 ? player.body : player.getBounds?.();
  const b = porta.area;
  if (!b) return false;
  if (!a) return player.x >= b.x && player.x <= b.x + b.width &&
    player.y >= b.y && player.y <= b.y + b.height;
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

export function prepararIntroducaoNovoBoss(scene, encontro) {
  const config = encontro.config.cenaEntrada;
  const principal = scene.cameras?.main;
  if (config?.ativo === false || !principal?.centerOn || !principal.stopFollow || !principal.startFollow) return null;
  let etapa = "aguardando", tempo = 0, concluida = false, destruida = false;
  let camera = null, anterior = null, portas = [];
  let origem = null, foco = null, retorno = null;
  let portasLiberadas = false;

  function liberarPortas() {
    if (portasLiberadas) return;
    for (const porta of portas) porta.liberarAposBoss?.();
    portasLiberadas = true;
  }

  function restaurarControle(cancelada = false) {
    if (!anterior) return;
    if (camera?.scene !== null) {
      if (anterior.alvo?.active !== false && anterior.alvo) {
        camera.startFollow(anterior.alvo, anterior.roundPixels, anterior.lerpX, anterior.lerpY,
          anterior.offsetX, anterior.offsetY);
      } else if (cancelada) camera.centerOn(origem.x, origem.y);
    }
    scene.movimentoBloqueado = anterior.movimento;
    scene.cenaEntradaBossAtiva = anterior.cenaAtiva;
    if (!anterior.animacaoPausada) scene.player?.anims?.resume?.();
    if (anterior.input) anterior.input.enabled = anterior.inputEnabled;
    if (anterior.keyboard) {
      anterior.keyboard.resetKeys?.();
      anterior.keyboard.enabled = anterior.keyboardEnabled;
    }
    anterior = null;
    camera = null;
  }

  function cancelar() {
    restaurarControle(true);
    liberarPortas();
    etapa = "aguardando";
    tempo = 0;
  }

  function iniciar() {
    camera = scene.cameras.main;
    const keyboard = scene.input?.keyboard;
    anterior = { alvo: camera._follow ?? scene.player, roundPixels: camera.roundPixels,
      lerpX: camera.lerp?.x ?? 1, lerpY: camera.lerp?.y ?? 1,
      offsetX: camera.followOffset?.x ?? 0, offsetY: camera.followOffset?.y ?? 0,
      movimento: scene.movimentoBloqueado, cenaAtiva: scene.cenaEntradaBossAtiva,
      animacaoPausada: scene.player.anims?.isPaused,
      input: scene.input, inputEnabled: scene.input?.enabled,
      keyboard, keyboardEnabled: keyboard?.enabled };
    origem = { x: camera.midPoint?.x ?? scene.player.x, y: camera.midPoint?.y ?? scene.player.y };
    foco = { x: encontro.sprite.x, y: encontro.sprite.y };
    retorno = { x: scene.player.x - anterior.offsetX, y: scene.player.y - anterior.offsetY };
    camera.stopFollow();
    scene.movimentoBloqueado = true;
    scene.cenaEntradaBossAtiva = true;
    scene.player.setVelocity?.(0, 0);
    scene.player.anims?.pause?.();
    keyboard?.resetKeys?.();
    if (scene.input) scene.input.enabled = false;
    if (keyboard) keyboard.enabled = false;
    portasLiberadas = false;
    etapa = "indo";
    tempo = 0;
  }

  function deslocar(de, para, progresso) {
    const p = suavizar(progresso);
    camera.centerOn(de.x + (para.x - de.x) * p, de.y + (para.y - de.y) * p);
  }

  const sistema = {
    get bloqueiaCombate() { return !destruida && !concluida && encontro.jogadorNaArena && !encontro.morto; },
    atualizar(delta = 0) {
      if (destruida) return false;
      const valido = encontro.sprite?.active && encontro.jogadorNaArena && !encontro.morto &&
        !encontro.encerrado && !encontro.suspenso && !scene.multiplayer && !scene.morteEmAndamento &&
        scene.player?.active && !scene.player.morto && (scene.vida ?? 1) > 0;
      if (!valido || (camera && camera !== scene.cameras?.main)) {
        if (anterior) cancelar();
        if (encontro.morto || encontro.encerrado || scene.morteEmAndamento || (scene.vida ?? 1) <= 0) liberarPortas();
        return false;
      }
      if (concluida) return false;
      if (etapa === "aguardando") {
        portas = (scene.portasFabrica ?? []).filter(porta => PORTAS_ENTRADA.has(porta.nome));
        // O corpo inteiro precisa terminar a passagem antes de congelar o personagem.
        if (scene.movimentoBloqueado || scene.generatorMenuOpen || scene.devItemMenuOpen || scene.atacando ||
            portas.some(porta => porta.estado === "abrindo" || jogadorNaPorta(scene.player, porta))) return true;
        iniciar();
        return true;
      }
      scene.player.setVelocity?.(0, 0);
      let restante = Number.isFinite(delta) ? Math.max(0, delta) : 0;
      while (etapa !== "fechando") {
        const total = etapa === "indo" ? duracao(config?.idaMs, 900)
          : etapa === "mostrando" ? duracao(config?.pausaMs, 650) : duracao(config?.voltaMs, 900);
        const passo = Math.min(restante, Math.max(0, total - tempo));
        tempo += passo;
        restante -= passo;
        const progresso = total > 0 ? Math.min(1, tempo / total) : 1;
        if (etapa === "indo") deslocar(origem, foco, progresso);
        else if (etapa === "voltando") deslocar(foco, retorno, progresso);
        if (tempo < total) return true;
        tempo = 0;
        if (etapa === "indo") etapa = "mostrando";
        else if (etapa === "mostrando") etapa = "voltando";
        else {
          etapa = "fechando";
          for (const porta of portas) porta.fecharParaBoss?.();
        }
        if (restante <= 0 && etapa !== "fechando") return true;
      }
      if (portas.some(porta => porta.estado !== "fechada")) return true;
      etapa = "concluida";
      concluida = true;
      restaurarControle();
      // O frame que encerra a cena ainda não pertence ao relógio de combate.
      return true;
    },
    destruir() {
      if (destruida) return;
      restaurarControle(true);
      liberarPortas();
      destruida = true;
      scene.events?.off("novo-boss:derrotada", derrotada);
    },
    snapshot() { return { etapa, concluida, destruida }; },
  };
  const derrotada = evento => { if (evento.encontro === encontro) liberarPortas(); };
  scene.events?.on("novo-boss:derrotada", derrotada);
  return sistema;
}
