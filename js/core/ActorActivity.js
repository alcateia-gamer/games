// A física continua a cada quadro. Só decisões e desenhos distantes são espaçados.
const proximasDecisoes = new WeakMap();

export function atorRelevante(scene, ator) {
  if (scene.sys?.settings?.key !== "Level1Parte2") return true;
  const view = scene.cameras?.main?.worldView;
  if (!view) return true;
  const x = ator.x, y = ator.y, margem = 160;
  if (x >= view.x - margem && x <= view.x + view.width + margem &&
      y >= view.y - margem && y <= view.y + view.height + margem) return true;
  const perto = player => player?.active && !player.morto &&
    (x - player.x) ** 2 + (y - player.y) ** 2 <= 800 ** 2;
  if (perto(scene.player)) return true;
  // O host simula também o que está perto dos outros jogadores, mesmo fora de sua câmera.
  for (const player of scene.remotePlayers?.values?.() ?? []) if (perto(player)) return true;
  return false;
}

export function atualizarDecisaoAtor(scene, ator, time) {
  if (atorRelevante(scene, ator) || !Number.isFinite(time)) {
    proximasDecisoes.delete(ator);
    return true;
  }
  if (time < (proximasDecisoes.get(ator) ?? -Infinity)) return false;
  const mobile = scene.sys?.game?.device?.input?.touch || scene.sys?.game?.device?.os?.desktop === false;
  proximasDecisoes.set(ator, time + (mobile ? 250 : 150));
  return true;
}

const barrasOcultas = new WeakMap();
/** Oculta barras distantes sem deixá-las paradas na última posição visível. */
export function atualizarBarrasDistantes(ator, relevante) {
  if (!relevante && !barrasOcultas.has(ator)) {
    const barras = [ator.fundoVida, ator.barraVida, ator.bordaVida]
      .filter(barra => barra?.active && barra.setVisible);
    barrasOcultas.set(ator, barras.map(barra => [barra, barra.visible]));
    for (const barra of barras) barra.setVisible(false);
  } else if (relevante && barrasOcultas.has(ator)) {
    for (const [barra, visivel] of barrasOcultas.get(ator)) if (barra.active) barra.setVisible(visivel);
    barrasOcultas.delete(ator);
  }
}
