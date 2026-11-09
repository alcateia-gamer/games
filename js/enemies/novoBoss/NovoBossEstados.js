/** Vida e relógio local; apenas a barreira protege contra golpes válidos. */
import { jogadorNaArenaNovoBoss } from "./NovoBossConfig.js";
import {
  areasSobrepostasNovoBoss,
  atualizarTeleporteNovoBoss,
  cancelarTeleporteNovoBoss,
  iniciarTeleporteNovoBoss,
  sincronizarCorpoNovoBoss,
} from "./NovoBossTeleporte.js";

function alterarEstado(scene, encontro, estado) {
  if (encontro.estado === estado) return;
  const anterior = encontro.estado;
  encontro.estado = estado;
  encontro.tempoEstado = 0;
  if (estado === "vulneravel") encontro.acertosNaAbertura = 0;
  scene.events?.emit("novo-boss:estado", { encontro, anterior, estado });
}

function podeAvancar(scene, encontro) {
  return Boolean(scene && encontro?.sprite?.active && encontro.active !== false &&
    !encontro.encerrado && !encontro.morto && !encontro.suspenso &&
    !scene.multiplayer && !scene.morteEmAndamento &&
    !(Number.isFinite(scene.vida) && scene.vida <= 0) &&
    encontro.jogadorNaArena !== false &&
    jogadorNaArenaNovoBoss(scene.player, encontro.config.arena));
}

export function inicializarCombateNovoBoss(scene, encontro) {
  if (!encontro || encontro.combateInicializado) return encontro;
  encontro.combateInicializado = true;
  encontro.vidaMaxima = encontro.config.combate.vidaMaxima;
  encontro.vida = encontro.vidaMaxima;
  encontro.morto = false;
  encontro.relogioCombate = 0;
  encontro.tempoEstado = 0;
  encontro.tempoSemAproximacao = 0;
  encontro.ultimoTeleporteEm = -Infinity;
  encontro.teleportePendente = null;
  encontro.proximaTentativaTeleporteEm = 0;
  encontro.teleporte = null;
  encontro.acertosNaAbertura = 0;
  encontro.proximoAcertoEm = 0;
  sincronizarCorpoNovoBoss(encontro);
  scene.events?.emit("novo-boss:vida", { encontro, vida: encontro.vida, vidaMaxima: encontro.vidaMaxima });
  return encontro;
}

function derrotar(scene, encontro) {
  if (encontro.morto) return;
  encontro.vida = 0;
  encontro.morto = true;
  encontro.invulneravelClonesAte = 0;
  encontro.transicaoFase2Pendente = false;
  encontro.proximaOndaClonesEm = Infinity;
  encontro.cancelarAtaque?.();
  encontro.prologo?.destruir();
  encontro.sistemaGeradores?.destruir();
  encontro.sistemaIlusoes?.destruir();
  encontro.sistemaClones?.destruir();
  encontro.teleportePendente = null;
  cancelarTeleporteNovoBoss(encontro);
  if (encontro.sprite?.body) encontro.sprite.body.enable = false;
  if (encontro.sprite?.setAlpha) encontro.sprite.setAlpha(0.35);
  else if (encontro.sprite) encontro.sprite.alpha = 0.35;
  encontro.sprite?.anims?.pause?.();
  alterarEstado(scene, encontro, "derrotada");
  scene.events?.emit("novo-boss:derrotada", { encontro });
}

function tentarTeleportePendente(scene, encontro) {
  if (!encontro.teleportePendente || encontro.teleporte || encontro.ataqueAtual || encontro.estado === "vulneravel" ||
      encontro.relogioCombate < encontro.proximaTentativaTeleporteEm ||
      encontro.relogioCombate < encontro.ultimoTeleporteEm + encontro.config.teleporte.intervaloMinimoMs) return false;
  const motivo = encontro.teleportePendente;
  if (!iniciarTeleporteNovoBoss(scene, encontro, motivo)) {
    encontro.pendencia = "teleporte-sem-destino";
    encontro.proximaTentativaTeleporteEm = encontro.relogioCombate + encontro.config.teleporte.reavaliarDestinoMs;
    return false;
  }
  encontro.pendencia = null;
  encontro.teleportePendente = null;
  encontro.ultimoTeleporteEm = encontro.relogioCombate;
  encontro.tempoSemAproximacao = 0;
  alterarEstado(scene, encontro, "teletransportando");
  return true;
}

function aproximado(scene, encontro) {
  return Math.hypot(scene.player.x - encontro.sprite.x, scene.player.y - encontro.sprite.y) <=
    encontro.config.teleporte.distanciaAproximacao;
}

function avancarRelogio(encontro, delta) {
  encontro.relogioCombate += delta;
  encontro.avancarTentaculos?.(delta);
}

/** Deltas só avançam dentro da arena e com o jogador vivo; sair não cura a boss. */
export function atualizarCombateNovoBoss(scene, encontro, delta = 0) {
  if (encontro?.prologo?.bloqueiaCombatePrincipal) return encontro;
  if (!encontro?.combateInicializado || encontro.encerrado || encontro.morto) return encontro;
  if (encontro.vida <= 0) { derrotar(scene, encontro); return encontro; }
  if (!podeAvancar(scene, encontro) || !Number.isFinite(delta) || delta < 0) return encontro;
  if (encontro.estado === "posicionada") alterarEstado(scene, encontro, "preparando");
  if (encontro.estado === "aguardando" || encontro.estado === "encerrada") return encontro;

  let restante = delta;
  // Processa fronteiras de estado, sem perder o excedente de frames demorados.
  do {
    if (!encontro.teleporte && aproximado(scene, encontro)) {
      encontro.tempoSemAproximacao = 0;
      if (encontro.teleportePendente === "preventivo") encontro.teleportePendente = null;
    }
    if (!encontro.teleporte && encontro.tempoSemAproximacao >= encontro.config.teleporte.preventivoMs &&
        !encontro.teleportePendente) encontro.teleportePendente = "preventivo";
    tentarTeleportePendente(scene, encontro);

    if (encontro.estado === "atacando" && encontro.ataqueAtual) {
      const resultado = encontro.avancarAtaque(restante);
      avancarRelogio(encontro, resultado.consumido);
      if (!aproximado(scene, encontro)) encontro.tempoSemAproximacao += resultado.consumido;
      restante -= resultado.consumido;
      if (resultado.terminou) {
        // A tentativa pendente espera a abertura completa, sem apagar o tempo de afastamento.
        alterarEstado(scene, encontro, "vulneravel");
      }
      if (restante <= 0 || resultado.consumido === 0) break;
      continue;
    }

    if (encontro.teleporte) {
      const origemViagem = encontro.teleporte.origem;
      const resultado = atualizarTeleporteNovoBoss(scene, encontro, restante);
      avancarRelogio(encontro, resultado.consumido);
      restante -= resultado.consumido;
      if (resultado.terminou) {
        alterarEstado(scene, encontro, "preparando");
        const ataqueTratado = encontro.concluirPosicionamentoAtaque?.(resultado, origemViagem) ||
          encontro.concluirPosicionamentoClones?.(resultado);
        if (resultado.cancelado && !ataqueTratado) {
          encontro.teleportePendente = resultado.motivo;
          encontro.proximaTentativaTeleporteEm = encontro.relogioCombate + encontro.config.teleporte.reavaliarDestinoMs;
        }
      }
      if (!resultado.terminou && resultado.consumido === 0 && restante === 0) break;
      // Mesmo com delta zero, encerra uma etapa de duração zero na próxima volta.
      if (restante <= 0 && encontro.teleporte?.etapa !== "reaparecendo") break;
      if (restante <= 0 && encontro.config.teleporte.reaparecerMs > 0) break;
      continue;
    }

    const duracao = encontro.estado === "vulneravel"
      ? encontro.config.combate.janelaVulneravelMs : encontro.config.combate.preparacaoMs;
    const ateEstado = Math.max(0, duracao - encontro.tempoEstado);
    const perto = aproximado(scene, encontro);
    const abertura = encontro.estado === "vulneravel";
    const atePreventivo = abertura || perto || encontro.teleportePendente ? Infinity
      : Math.max(0, encontro.config.teleporte.preventivoMs - encontro.tempoSemAproximacao);
    const ateTentativa = !abertura && encontro.teleportePendente
      ? Math.max(0, Math.max(encontro.proximaTentativaTeleporteEm,
        encontro.ultimoTeleporteEm + encontro.config.teleporte.intervaloMinimoMs) - encontro.relogioCombate)
      : Infinity;
    const passo = Math.min(restante, ateEstado, atePreventivo, ateTentativa);
    avancarRelogio(encontro, passo);
    encontro.tempoEstado += passo;
    if (!perto) encontro.tempoSemAproximacao += passo;
    restante -= passo;
    if (encontro.tempoEstado >= duracao) {
      if (encontro.estado === "vulneravel") {
        if (encontro.acertosNaAbertura > 0) {
          encontro.teleportePendente = "reativo";
          encontro.proximaTentativaTeleporteEm = encontro.relogioCombate;
        }
        alterarEstado(scene, encontro, "preparando");
      } else if (!encontro.iniciarAtaqueAutomatico?.()) alterarEstado(scene, encontro, "vulneravel");
    }
    if (restante <= 0) break;
  } while (restante > 0 || encontro.teleporte);
  // Resolve também eventos exatamente na fronteira do último milissegundo.
  if (!encontro.teleporte && !aproximado(scene, encontro) &&
      encontro.tempoSemAproximacao >= encontro.config.teleporte.preventivoMs &&
      !encontro.teleportePendente) encontro.teleportePendente = "preventivo";
  tentarTeleportePendente(scene, encontro);
  return encontro;
}

/** Sem escudo, ataques, clonagem e teleporte não criam invulnerabilidade. */
export function causarDanoNovoBoss(scene, encontro, quantidade, area = null, ataque = null) {
  if (!encontro?.combateInicializado || !podeAvancar(scene, encontro) ||
      encontro.barreiraAtiva || !Number.isFinite(quantidade) || quantidade <= 0 ||
      (area && !areasSobrepostasNovoBoss(area, encontro.hitboxDano))) return false;
  if (encontro.prologo?.bloqueiaCombatePrincipal) return encontro.prologo.receberDanoBoss(quantidade, ataque ?? area);
  const anterior = encontro.vida;
  if (encontro.estado === "vulneravel") encontro.acertosNaAbertura = (encontro.acertosNaAbertura ?? 0) + 1;
  encontro.vida = Math.max(0, encontro.vida - quantidade - (encontro.danoAdiadoPrologo ?? 0));
  encontro.danoAdiadoPrologo = 0;
  scene.events?.emit("novo-boss:vida", { encontro, anterior, vida: encontro.vida, vidaMaxima: encontro.vidaMaxima });
  if (encontro.vida <= 0) {
    derrotar(scene, encontro);
  } else {
    encontro.verificarFase?.();
    if (encontro.estado === "vulneravel" &&
        encontro.acertosNaAbertura >= Math.max(1, encontro.config.combate.acertosPorAbertura ?? 1)) {
      alterarEstado(scene, encontro, "preparando");
      encontro.teleportePendente = "reativo";
      encontro.proximaTentativaTeleporteEm = encontro.relogioCombate;
      tentarTeleportePendente(scene, encontro);
    }
  }
  return true;
}
