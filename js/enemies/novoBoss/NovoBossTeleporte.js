/** Teletransporte da mesma entidade, sem timers ou dependência de Phaser global. */
import { retanguloLivreDoMapa } from "../EnemyPathfinding.js";
import { areaCorpoNovoBoss } from "./NovoBossConfig.js";
import { tocarSomTeleporteBoss } from "../../sounds/teleporteBoss.js";

export function areasSobrepostasNovoBoss(a, b) {
  return Boolean(a && b && a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0 &&
    a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y);
}

function areaJogador(player) {
  const body = player?.body;
  if (body && [body.x, body.y, body.width, body.height].every(Number.isFinite) &&
      body.width > 0 && body.height > 0) return body;
  if (![player?.x, player?.y].every(Number.isFinite)) return null;
  // Fallback para jogadores sem corpo disponível durante a criação da cena.
  return { x: player.x - 8, y: player.y - 8, width: 16, height: 16 };
}

export function destinoValidoNovoBoss(scene, encontro, ponto) {
  if (![ponto?.x, ponto?.y].every(Number.isFinite)) return false;
  const area = areaCorpoNovoBoss(encontro.config, ponto);
  const arena = encontro.config.arena;
  if (area.x < arena.xMin || area.y < arena.yMin ||
      area.x + area.width > arena.xMax || area.y + area.height > arena.yMax ||
      !retanguloLivreDoMapa(scene, area) || areasSobrepostasNovoBoss(area, areaJogador(scene.player))) {
    return false;
  }
  // Geradores futuros podem registrar seus corpos sem mudar a seleção de destino.
  return !(encontro.obstaculosTeleporte || []).some((objeto) => {
    const body = objeto?.body || objeto;
    return body?.enable !== false && areasSobrepostasNovoBoss(area, body);
  });
}

/** Prefere o ponto válido mais distante; empates seguem a ordem da configuração. */
export function escolherDestinoNovoBoss(scene, encontro) {
  const sprite = encontro.sprite;
  if (!sprite) return null;
  const pontos = encontro.config.teleporte.pontos.filter((ponto) =>
    Math.hypot(ponto.x - sprite.x, ponto.y - sprite.y) > 1 &&
    destinoValidoNovoBoss(scene, encontro, ponto));
  let escolhido = null;
  let distanciaMaior = -Infinity;
  for (const ponto of pontos) {
    const distancia = (ponto.x - scene.player.x) ** 2 + (ponto.y - scene.player.y) ** 2;
    if (distancia > distanciaMaior) {
      distanciaMaior = distancia;
      escolhido = ponto;
    }
  }
  return escolhido;
}

function definirAlpha(sprite, alpha) {
  if (sprite.setAlpha) sprite.setAlpha(alpha);
  else sprite.alpha = alpha;
}

/** Atualiza posição, corpo e a única hitbox de dano dentro da mesma chamada. */
export function sincronizarCorpoNovoBoss(encontro, ponto = encontro.sprite) {
  const sprite = encontro.sprite;
  if (!sprite || !ponto) return;
  if (sprite.setPosition) sprite.setPosition(ponto.x, ponto.y);
  else { sprite.x = ponto.x; sprite.y = ponto.y; }
  sprite.body?.reset?.(ponto.x, ponto.y);
  sprite.body?.updateFromGameObject?.();
  const area = areaCorpoNovoBoss(encontro.config, ponto);
  if (encontro.hitboxDano?.setTo) {
    encontro.hitboxDano.setTo(area.x, area.y, area.width, area.height);
  } else if (encontro.hitboxDano) {
    Object.assign(encontro.hitboxDano, area);
  } else {
    encontro.hitboxDano = { ...area };
  }
  encontro.hitbox = encontro.hitboxDano;
}

export function iniciarTeleporteNovoBoss(scene, encontro, motivo, opcoes = {}) {
  if (encontro.prologo?.bloqueiaCombatePrincipal) return false;
  if (encontro.teleporte || encontro.morto || !encontro.sprite) return false;
  const destino = opcoes.destino
    ? (destinoValidoNovoBoss(scene, encontro, opcoes.destino) ? opcoes.destino : null)
    : escolherDestinoNovoBoss(scene, encontro);
  if (!destino) return false;
  if (!opcoes.preservarIlusoes) encontro.sistemaIlusoes?.encerrarQuatro();
  encontro.teleporte = {
    origem: { x: encontro.sprite.x, y: encontro.sprite.y },
    destino, motivo, etapa: "desaparecendo", decorrido: 0,
    preservarIlusoes: Boolean(opcoes.preservarIlusoes),
  };
  if (encontro.sprite.body) encontro.sprite.body.enable = false;
  definirAlpha(encontro.sprite, 1);
  tocarSomTeleporteBoss(scene, encontro.teleporte.origem);
  scene.events?.emit("novo-boss:teleporte-iniciado", { encontro, destino, motivo });
  return true;
}

function prepararReaparecimento(encontro, viagem, destino) {
  viagem.destino = { ...destino };
  viagem.etapa = "reaparecendo";
  viagem.decorrido = 0;
  viagem.cancelado = Math.hypot(destino.x - viagem.origem.x, destino.y - viagem.origem.y) <= 1;
  sincronizarCorpoNovoBoss(encontro, destino);
  if (encontro.sprite.body) encontro.sprite.body.enable = false;
  definirAlpha(encontro.sprite, 0);
  encontro.pendencia = null;
}

/**
 * Um ponto ocupado no meio da viagem nunca habilita um corpo. Tenta outro ponto,
 * depois a origem e, por último, o local atual caso já tenha ficado livre. Sem
 * local seguro, mantém uma silhueta visível, sem colisão, e reavalia mais tarde.
 */
function recuperarDestino(scene, encontro, viagem) {
  const destino = escolherDestinoNovoBoss(scene, encontro) ||
    (destinoValidoNovoBoss(scene, encontro, viagem.origem) ? viagem.origem : null) ||
    (destinoValidoNovoBoss(scene, encontro, encontro.sprite) ? encontro.sprite : null);
  if (destino) {
    prepararReaparecimento(encontro, viagem, destino);
    return;
  }
  viagem.etapa = "aguardando-destino";
  viagem.decorrido = 0;
  encontro.pendencia = "teleporte-aguardando-destino";
  if (encontro.sprite.body) encontro.sprite.body.enable = false;
  definirAlpha(encontro.sprite, 0.35);
}

/** Retorna o tempo consumido, permitindo processar deltas que cruzam estados. */
export function atualizarTeleporteNovoBoss(scene, encontro, delta) {
  const viagem = encontro.teleporte;
  if (!viagem) return { consumido: 0, terminou: true };
  const config = encontro.config.teleporte;
  const duracao = viagem.etapa === "desaparecendo" ? config.desaparecerMs
    : viagem.etapa === "aguardando-destino" ? Math.max(1, config.reavaliarDestinoMs) : config.reaparecerMs;
  const consumido = Math.min(delta, Math.max(0, duracao - viagem.decorrido));
  viagem.decorrido += consumido;
  const progresso = duracao > 0 ? Math.min(1, viagem.decorrido / duracao) : 1;
  definirAlpha(encontro.sprite, viagem.etapa === "desaparecendo" ? 1 - progresso
    : viagem.etapa === "aguardando-destino" ? 0.35 : progresso);
  if (viagem.decorrido < duracao) return { consumido, terminou: false };
  if (viagem.etapa === "aguardando-destino") {
    recuperarDestino(scene, encontro, viagem);
    return { consumido, terminou: false };
  }
  if (viagem.etapa === "desaparecendo") {
    // O jogador/obstáculo pode ter ocupado o destino durante o desaparecimento.
    if (destinoValidoNovoBoss(scene, encontro, viagem.destino)) {
      prepararReaparecimento(encontro, viagem, viagem.destino);
    } else recuperarDestino(scene, encontro, viagem);
    return { consumido, terminou: false };
  }
  // Revalida imediatamente antes de habilitar o corpo: o destino também pode
  // ser ocupado durante os frames do reaparecimento, depois da mudança visual.
  if (!destinoValidoNovoBoss(scene, encontro, viagem.destino)) {
    recuperarDestino(scene, encontro, viagem);
    return { consumido, terminou: false };
  }
  encontro.teleporte = null;
  encontro.pendencia = null;
  definirAlpha(encontro.sprite, 1);
  if (encontro.sprite.body) encontro.sprite.body.enable = !encontro.suspenso && !encontro.morto;
  scene.events?.emit("novo-boss:teleporte-concluido", { encontro, destino: viagem.destino });
  return { consumido, terminou: true, cancelado: viagem.cancelado, motivo: viagem.motivo };
}

export function cancelarTeleporteNovoBoss(encontro) {
  encontro.teleporte = null;
  if (!encontro.sprite) return;
  definirAlpha(encontro.sprite, 1);
  // Cancelamento é usado na derrota; sem acesso à cena não se pode garantir
  // que o local atual esteja livre para reabilitar física com segurança.
  if (encontro.sprite.body) encontro.sprite.body.enable = false;
}
