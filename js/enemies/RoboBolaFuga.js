export const CONFIG_FUGA_ROBO_BOLA = Object.freeze({
  distancia: 1200, duracaoMs: 3000, intervaloMs: 500, combateRecenteMs: 3000,
  margemCamera: 64, validadePosicaoRemotaMs: 4500,
});

function posicao(actor) {
  if (!actor?.active) return null;
  const ponto = actor.body?.center ?? actor;
  return Number.isFinite(ponto.x) && Number.isFinite(ponto.y) ? ponto : null;
}

function posicoesParticipantes(scene) {
  const pontos = [posicao(scene.player)];
  if (!scene.multiplayer) return pontos;

  const manager = scene.multiplayerManager;
  if (!manager?.room?.players || manager.mqtt?.connected === false) return null;
  const agora = Date.now();
  for (const jogador of manager.room.players) {
    if (jogador.id === manager.playerId) continue;
    const idade = agora - jogador.positionReceivedAt;
    const posicaoConfirmada = jogador.positionKnown === true && idade >= 0 &&
      idade <= CONFIG_FUGA_ROBO_BOLA.validadePosicaoRemotaMs;
    if (posicaoConfirmada && jogador.mapKey && jogador.mapKey !== "Level1Parte2") continue;
    const ator = scene.remotePlayers?.get(jogador.id);
    const ponto = scene.coopRuntime ? posicao(ator) : posicao({ ...jogador, active: ator?.active });
    pontos.push(posicaoConfirmada ? ponto : null);
  }
  return pontos;
}

export function removerRoboExploracao(scene, robo) {
  scene.inimigos = scene.inimigos.filter(inimigo => inimigo !== robo);
  if (scene.inimigoTeste === robo) scene.inimigoTeste = scene.inimigos[0] ?? null;
  if (robo.body) robo.body.enable = false;
  robo.destroy();
}

export function criarFugaRoboBola(scene) {
  const config = CONFIG_FUGA_ROBO_BOLA;
  const distancia2 = config.distancia ** 2;
  let anterior = -Infinity;
  let longeDesde = new WeakMap();
  return function atualizar(time) {
    if (time - anterior < config.intervaloMs) return;
    if (scene.fabricaDescarregada || scene.robosFabricaDescarregados ||
        (scene.multiplayer && !scene.isMultiplayerHost)) {
      longeDesde = new WeakMap();
      anterior = time;
      return;
    }
    // Uma pausa longa do jogo deixa um intervalo sem observações.
    if (time - anterior > 2 * config.intervaloMs) longeDesde = new WeakMap();
    anterior = time;
    const jogadores = posicoesParticipantes(scene);
    if (!jogadores?.length || jogadores.some(p => !p)) {
      longeDesde = new WeakMap();
      return;
    }
    const vista = scene.cameras?.main?.worldView;
    const margem = config.margemCamera;
    for (const robo of scene.inimigos ?? []) {
      if (robo.spawnAreaRoboBolaId == null || robo.prologoEncontroId || robo.remoteOnly || robo.morto) continue;
      const ponto = posicao(robo);
      const visivel = ponto && vista && ponto.x >= vista.x - margem && ponto.x <= vista.right + margem &&
        ponto.y >= vista.y - margem && ponto.y <= vista.bottom + margem;
      const combateRecente = time - (robo.ultimoCombateOnda ?? -Infinity) < config.combateRecenteMs;
      if (!ponto || visivel || combateRecente || jogadores.some(p => (p.x - ponto.x) ** 2 + (p.y - ponto.y) ** 2 <= distancia2)) {
        longeDesde.delete(robo);
        continue;
      }
      const inicio = longeDesde.get(robo) ?? time;
      if (time - inicio >= config.duracaoMs) removerRoboExploracao(scene, robo);
      else longeDesde.set(robo, inicio);
    }
  };
}
