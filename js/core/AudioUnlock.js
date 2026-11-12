/** Cada aba precisa poder retomar seu próprio contexto após gestos e novas suspensões. */
export function registrarDesbloqueioAudio(game, alvo = window, pagina = document) {
  const retomar = async () => {
    try {
      const sound = game.sound;
      if (sound?.locked && typeof sound.unlock === "function") sound.unlock();
      if (sound?.context?.state === "suspended") await sound.context.resume();
      // Não usar resumeAll: músicas e efeitos pausados pela rede devem continuar pausados.
    } catch (error) {
      console.warn("Audio não pôde ser desbloqueado:", error);
    }
  };
  const aoMostrar = () => { if (!pagina.hidden) return retomar(); };
  const eventos = ["pointerdown", "touchstart", "keydown", "focus", "pageshow"];
  for (const evento of eventos) alvo.addEventListener(evento, retomar, { passive: true });
  pagina.addEventListener("visibilitychange", aoMostrar);
  return () => {
    for (const evento of eventos) alvo.removeEventListener(evento, retomar);
    pagina.removeEventListener("visibilitychange", aoMostrar);
  };
}
