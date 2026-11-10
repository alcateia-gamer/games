/** Tela cheia deve ser solicitada durante o gesto que inicia o jogo. */
export function dispositivoComToque() {
  return typeof window !== "undefined" &&
    (navigator.maxTouchPoints > 0 || window.matchMedia?.("(pointer: coarse)").matches === true);
}

export async function solicitarTelaCheiaMobile() {
  if (!dispositivoComToque() || document.fullscreenElement || document.webkitFullscreenElement) return;
  const elemento = document.documentElement;
  try {
    if (elemento.requestFullscreen) {
      await elemento.requestFullscreen({ navigationUI: "hide" });
    } else {
      await elemento.webkitRequestFullscreen?.();
    }
  } catch (_) {
    // O jogo continua preenchendo a janela quando o navegador recusa tela cheia.
  }
}

/** Acompanha a área real do container, inclusive barras móveis e mudanças de orientação. */
export function registrarAtualizacaoDeViewport(game) {
  const container = document.getElementById("game-container");
  let quadroPendente = null;
  let encerrado = false;
  const atualizar = () => {
    if (encerrado || quadroPendente !== null) return;
    quadroPendente = window.requestAnimationFrame(() => {
      quadroPendente = null;
      if (encerrado || !game.isBooted) return;
      const { width, height } = container.getBoundingClientRect();
      if (width > 0 && height > 0) game.scale.setParentSize(width, height);
    });
  };
  const eventos = [
    [window, "resize"], [window, "orientationchange"],
    [document, "fullscreenchange"], [document, "webkitfullscreenchange"],
    ...(window.visualViewport ? [[window.visualViewport, "resize"]] : []),
  ];
  for (const [alvo, evento] of eventos) alvo.addEventListener(evento, atualizar, { passive: true });
  const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(atualizar) : null;
  observer?.observe(container);
  game.events.once("ready", atualizar);
  const limpar = () => {
    if (encerrado) return;
    encerrado = true;
    for (const [alvo, evento] of eventos) alvo.removeEventListener(evento, atualizar);
    observer?.disconnect();
    if (quadroPendente !== null) {
      window.cancelAnimationFrame(quadroPendente);
      quadroPendente = null;
    }
    game.events.off("ready", atualizar);
    game.events.off("destroy", limpar);
  };
  game.events.once("destroy", limpar);
  atualizar();
  return limpar;
}
